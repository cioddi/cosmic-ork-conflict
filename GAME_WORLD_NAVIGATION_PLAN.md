# Game World, Navigation, and Rendering Plan

## Status

This document defines the architecture for collision-safe unit movement,
headless game simulation, and smooth rendering. The first canonical
implementation is now present under `src/game/world`, `src/game/navigation`,
and `src/game/view`; this document remains the contract for future changes.

Implemented foundations include:

- a game-owned vector-tile loader with required-tile failure handling;
- a local meter projection and immutable obstacle/spatial-index model;
- conservative grid A* with exact connector and smoothing validation;
- engine-boundary validation of every complete and partial movement segment;
- deterministic collision-aware spawning;
- reachable approach-point routing plus collision-safe local progress when a
  complete route is unavailable;
- renderer-neutral snapshots and multi-segment movement traces;
- smooth trace sampling in the MapLibre adapter;
- shared MapLibre unit layers instead of one source per unit; and
- headless geometry, routing, engine, loader, and animation tests.

Potential later extensions, rather than prerequisites for the invariant, are
dynamic unit-to-unit avoidance, Web Worker path searches for much larger maps,
and a replay persistence format.

The primary invariant is:

> A unit position may only be committed when its entire swept movement path is
> valid in the immutable game world.

MapLibre is a view of the game. It is not a terrain provider, collision system,
simulation clock, or source of authoritative state.

## Current problems

The active game currently calculates a direct bearing to the nearest enemy and
updates the unit position without consulting terrain. The game also exposes its
state directly as GeoJSON and the React game controller uses MapLibre hooks for
camera behavior. This couples simulation, presentation, and resource loading.

There are several experimental navigation implementations in the working tree.
They contain useful tile and geometry code, but they are not connected to the
active game and must not be treated as a finished migration. Known unsafe
patterns include:

- direct-movement fallbacks after pathfinding failure;
- occupancy tests based only on a grid-cell center or coverage threshold;
- unvalidated first or final path connectors;
- treating unavailable building data as walkable terrain; and
- spawn fallbacks that can return an invalid position.

These patterns must not be carried into the canonical implementation.

## Target architecture

```text
WorldDefinition
  playable area, setup zones, tile source, collision policy
        |
        v
VectorTileWorldLoader
  fetch, decode, normalize, project, index
        |
        v
Immutable GameWorld
  obstacles, bounds, spatial index, navigation grids
        |
        v
GameEngine.step()
  AI, collision-safe movement, combat, deterministic state
        |
        v
GameSnapshot + MovementTrace[]
        |
        +---------------------------+
        |                           |
        v                           v
MapLibreViewAdapter          tests, replay, server,
GeoJSON + animation          or another renderer
```

Dependencies point inward. The engine and world packages must not import React,
MapLibre, Deck.gl, DOM types, or application stores.

## World definition

A `WorldDefinition` explicitly describes the simulation environment:

- stable world identifier and data version;
- playable polygon or bounds;
- player setup polygons;
- routing padding outside the directly playable area;
- vector-tile URL template, zoom, and source-layer names;
- supported mobility profiles;
- collision clearance for each mobility profile; and
- policy for unavailable or invalid terrain data.

The vector-tile source is game configuration. A MapLibre style URL is view
configuration and must not be used as the authoritative way to discover game
collision data.

The first world definition will describe the existing Paris play area. Keeping
it declarative makes later maps and fixture worlds easy to add.

## Game-owned tile loading

`VectorTileWorldLoader` loads the terrain independently of MapLibre:

1. Compute all tiles intersecting the padded simulation bounds.
2. Fetch them with bounded concurrency, cancellation, and retry handling.
3. Decode configured building layers from PBF.
4. Flatten polygons and multipolygons while retaining interior holes.
5. Reject or repair malformed geometry according to an explicit policy.
6. Remove duplicate features where stable identifiers are available.
7. Project geographic coordinates into the world's local metric space.
8. Build immutable obstacle and navigation indexes.

The loader receives a `TileFetcher` dependency. Production uses `fetch`; unit
tests use local byte fixtures or an in-memory provider. The loader must not read
`window.location`, a MapLibre source cache, or rendered map features.

Unknown terrain is never assumed to be safe. If a required tile cannot be
loaded or decoded after its retry policy, world creation fails and the game does
not start. A future offline mode may instead mark missing tile bounds blocked,
but it must remain fail-closed.

## Coordinate systems

The engine operates in a local metric coordinate system:

```ts
type WorldPoint = { x: number; y: number };
```

Longitude and latitude are converted only at I/O boundaries. This avoids
repeating geodesic calculations during every tick and makes movement speed,
clearance, distance, and grid size use the same unit: meters.

The world owns the reversible projection used by loaders and view adapters. A
single projection implementation must be used consistently for obstacles,
units, paths, and rendered snapshots.

## Immutable static world model

`GameWorld` contains static data shared by every game state:

- world and routing bounds;
- normalized building footprints;
- buffered footprints for supported mobility profiles;
- a spatial index from cells to candidate obstacle identifiers;
- conservative occupancy grids for pathfinding;
- optional connected-component identifiers for fast unreachable checks; and
- projection metadata.

Static geometry is prepared once. It is never rebuilt during a simulation tick.
Dynamic units and effects live in `GameState`, not `GameWorld`.

### Collision footprints

Buildings are stored as exact polygons. Each mobility profile uses a buffered
obstacle set based on unit footprint plus a small safety margin. The existing
unit `size` fields must be audited before choosing the conversion because some
dimensions appear presentation-oriented.

A navigation cell is blocked if it intersects any buffered obstacle. Blocking
only cells whose center is inside a building, or cells with more than a chosen
coverage percentage, can erase narrow buildings and wall edges.

Exact polygon checks remain the final authority even when a grid is used for
fast candidate lookup.

## Navigation

The first canonical pathfinder should be conservative grid A*:

- a binary heap for the open set;
- eight-direction movement;
- no diagonal corner cutting;
- occupancy grids cached by mobility profile;
- exact validation of the connector from the real start to the grid path;
- exact validation of the connector from the grid path to the goal;
- deterministic tie breaking where practical; and
- an empty result when the goal is unreachable.

Path smoothing may remove waypoints only if the replacement segment passes the
same exact traversal test used by the engine.

Paths are cached by world version, mobility profile, start cell, and goal cell.
A unit replans when its target changes materially, the path is exhausted, the
unit diverges from it, or dynamic collision support later invalidates it.

World loading is asynchronous. Path following and `GameEngine.step()` are
synchronous and perform no network or map-resource access.

## Engine movement boundary

The pathfinder proposes a path; the engine authorizes movement. This is a
deliberate second line of defense.

Expected world APIs are conceptually:

```ts
world.canOccupy(point, mobilityProfile)
world.canTraverse(from, to, mobilityProfile)
navigation.findPath(from, goal, mobilityProfile)
```

Expected engine behavior is conceptually:

```ts
engine.tryMoveUnit(unitId, path, movementBudget)
```

`tryMoveUnit` consumes path segments up to the movement budget, validates every
complete and partial segment, and commits one state transition. Position changes
must not bypass this boundary through public mutation.

Rules at this boundary:

- pathfinding failure activates bounded local progress sampling;
- unavailable world data means the engine cannot start;
- out-of-bounds destinations are blocked;
- first, intermediate, final, and partial segments are all validated;
- fallback movement is a short validated segment, never an unchecked line to
  the target; and
- blocked movement is observable as a typed result, not only a console message.

AI should navigate toward a valid approach point based on attack range and unit
footprints rather than the exact center of another unit.

## Spawning

Units spawn only after world construction succeeds. Spawn selection:

1. Samples inside the actual setup polygon, not only its bounding box.
2. Uses the same occupancy rule as movement.
3. Accounts for the unit mobility profile and footprint.
4. Uses an injected seeded random-number generator.
5. Has bounded attempts.
6. Returns a typed setup error if enough valid positions cannot be found.

Centroids or first polygon coordinates must not be returned without validation.

### Continuous progress without relocation

Units are never teleported after spawning. Navigation targets the closest grid
cell in the mover's connected component when an enemy's exact position cannot
be occupied with that mover's clearance. This lets a larger unit approach a
smaller unit standing close to a building without treating the enemy center as
an invalid all-or-nothing destination.

If full routing still produces no movement, the engine samples headings around
the unit at successively smaller distances. It selects the longest distance
with at least one valid candidate, then chooses the candidate closest to the
target. Every sampled segment passes the same exact `GameWorld.canTraverse`
check as a routed segment and is emitted as an ordinary movement trace. The
minimum attempted distance is a game rule so it can be tuned without changing
the navigation implementation.

Provided the unit has any traversable neighboring position, an idle unit with a
living enemy therefore moves on every turn. A physically immobile position
(with no valid segment even at the minimum distance) remains blocked rather
than violating collision rules.

### Startup cost controls

The Paris world keeps only obstacles intersecting the routing bounds and uses a
small routing margin, avoiding tile geometry that can never affect the match.
All mobility profiles share one grid built with the largest configured
clearance; profile-specific exact geometry checks still validate connectors and
committed movement. In development, concurrent React mounts reuse the same
in-flight world promise, preventing Strict Mode from downloading and decoding
the terrain twice.

The simulation clock remains stopped after engine creation until the view
reports that the initial MapLibre load has completed, all shared unit images are
decoded and registered, and the initial unit layers have had two animation
frames to mount. The tick counter therefore remains at zero throughout loading;
there is no hidden backlog of turns for the animation adapter to fast-forward
through. Circles, labels, and icons become visible as one ready state rather
than exposing placeholder circles while symbol images are still loading.

### Per-turn performance controls

Enemy selection returns the chosen enemy and its computed path as one plan. The
movement boundary consumes that path directly instead of running A* a second
time for the same unit and target. A* owns reusable cost, predecessor, visited,
and closed buffers on the immutable navigation grid; generation markers reset
only cells touched by the current search. Its hot neighbor loop and binary heap
use numeric storage to avoid per-cell object and array allocation.

The MapLibre adapter publishes animated units through one shared GeoJSON source
used by the circle, icon, and label layers. Only that source receives animation
updates, capped at 30 frames per second, rather than serializing identical data
through three sources on every browser frame. Selection remains a small optional
overlay.

## Deterministic game engine

`GameEngine` receives its dependencies explicitly:

- immutable `GameWorld`;
- initial players and units;
- seeded random-number generator;
- rules/configuration; and
- optionally an injected clock for event timestamps.

The engine exposes a synchronous `step()` and immutable snapshots. It does not
know whether a React application, replay tool, Node process, or test consumes
those snapshots.

Suggested lifecycle states are:

- `loading-world`;
- `creating-game`;
- `running`;
- `finished`; and
- `error`.

The controller starts the simulation clock only after terrain and spawn
validation complete. It prevents overlapping ticks.

## Smooth movement rendering

Simulation and rendering run at different frequencies:

- the engine advances authoritative state at the configured turn/tick rate;
- the view renders intermediate positions with `requestAnimationFrame`; and
- animation never writes interpolated positions back into the engine.

Each successful engine movement emits a `MovementTrace`:

```ts
interface MovementTrace {
  unitId: string;
  points: WorldPoint[];
  segmentLengths: number[];
  totalDistance: number;
  startedAtTick: number;
}
```

The view samples the trace by cumulative distance. It must not interpolate a
single straight line between tick endpoints because that visual chord could cut
through a building when the authoritative path went around a corner.

The animation adapter also derives bearing from the active path segment. New
snapshots are queued or completed according to one documented policy so an
animation cannot be silently replaced halfway through. Reduced-motion settings
can render the authoritative endpoint immediately.

For the current unit count, a single MapLibre GeoJSON source with shared symbol,
circle, and text layers is sufficient. The source data can be updated by the
view adapter on animation frames without triggering a full React tree render.
Deck.gl remains an optional renderer for substantially larger unit counts; it is
not required to make movement smooth.

## MapLibre adapter

The MapLibre integration is responsible only for:

- converting world-space snapshots to longitude/latitude GeoJSON;
- rendering units, labels, obstacles, and debug paths;
- sampling movement traces for animation;
- selection and pointer interaction; and
- camera transitions.

Camera movement currently located in the game provider moves into this adapter.
The game must continue to load and simulate if the MapLibre view is omitted.

Debug overlays should render the exact obstacle buffers, occupied cells, and
paths used by the engine. A separate approximate debug representation can hide
collision defects.

## State and rendering contracts

Core snapshots should be renderer-neutral. GeoJSON belongs to the MapLibre
adapter rather than `GameEngine`.

Snapshots and traces are immutable data-transfer objects. Views may cache or
interpolate them, but cannot mutate units. This also enables deterministic
replays and comparison of engine output across renderers.

## Testing strategy

The current placeholder test and dependency mismatch must be fixed before the
feature is considered implemented. Test suites should cover the following.

### Tile loader

- correct tile enumeration at bounds and tile edges;
- configured source-layer extraction;
- polygons, multipolygons, and holes;
- malformed geometry policy;
- retry, cancellation, and required-tile failure; and
- deterministic fixture loading without network access.

### World geometry

- points inside, outside, and on buffered obstacle boundaries;
- segments crossing, touching, and narrowly missing a building;
- buildings narrower than a navigation cell;
- polygon holes;
- per-profile clearance;
- routing bounds; and
- consistency of geographic/world coordinate round trips.

### Pathfinder

- unobstructed direct route;
- route around a rectangular building;
- no diagonal corner cutting;
- unreachable destination;
- blocked start or goal policy;
- valid first and final connectors;
- smoothing never introduces an invalid segment; and
- every returned segment passes `canTraverse`.

### Movement and spawning

- exact movement-budget clipping;
- complete and partial multi-segment traversal;
- invalid proposed path results in zero committed movement;
- no world or no route produces no movement;
- spawn lies in the setup polygon and outside obstacles;
- deterministic spawning from a seed; and
- typed failure when a setup area cannot fit all units.

### Smooth animation

`sampleMovementTrace` is a pure function and is tested separately:

- start, end, and segment-boundary samples;
- constant-speed sampling across unequal segment lengths;
- correct bearing on each segment;
- clamping before and after the animation duration;
- multi-corner traces never use an endpoint chord;
- interruption/queue policy; and
- reduced-motion behavior.

### Headless integration

Construct a fixture world with a building between two units. Run a fixed-seed
game for multiple ticks without React, MapLibre, DOM, or network access. Assert:

- the unit routes around the obstacle;
- every committed trace segment is traversable;
- every resulting unit position is occupiable;
- snapshots are deterministic; and
- pathfinding failure produces only exact collision-validated local movement.

### View adapter

- world positions convert to expected GeoJSON coordinates;
- interpolated render data does not mutate the snapshot;
- selection/camera commands remain view-only; and
- the engine still runs when no view is instantiated.

## Maintainability rules

- Keep one canonical world loader and one canonical pathfinder.
- Prefer small interfaces and dependency injection over singletons.
- Keep geometry operations pure where possible.
- Use typed success/error results for expected failures.
- Document coordinate units and ownership on public types.
- Avoid hidden fallbacks and magic distance limits.
- Keep logging behind an injectable logger or development diagnostics flag.
- Add tests with every collision policy or grid-resolution adjustment.
- Benchmark with representative fixtures, but avoid flaky wall-clock assertions
  in ordinary unit tests.
- Record architectural decisions when changing projection, collision clearance,
  grid resolution, failure policy, or animation semantics.

## Implementation sequence

1. Repair and normalize direct dependencies and the test runner.
2. Add renderer-neutral world types, projection, and world definition.
3. Implement the injected vector-tile loader and fixture tests.
4. Build the immutable collision index and conservative navigation grids.
5. Implement and test canonical A* and exact segment validation.
6. Move spawning and all position commits behind `GameWorld` validation.
7. Refactor AI and `GameEngine` to emit snapshots and movement traces.
8. Move GeoJSON, camera, and animation behavior into the MapLibre adapter.
9. Add debug overlays backed by the authoritative world data.
10. Run headless, type, build, browser, and performance verification.
11. Retire superseded experimental navigation code only after validation and
    without discarding unrelated working-tree changes.

## Acceptance criteria

Implementation is complete when:

- the game owns and decodes its terrain tiles independently of MapLibre;
- a deterministic game runs without React, DOM, MapLibre, or network after its
  world fixture/model has been provided;
- missing required terrain prevents simulation startup;
- no spawn intersects a buffered building;
- every committed movement segment is collision-valid;
- non-engaged units make collision-safe progress without relocation;
- units visibly and authoritatively follow routes around buildings;
- visual movement follows emitted path traces smoothly between ticks;
- removing the MapLibre view does not affect simulation results;
- unit and integration tests cover the invariant and adjustment points; and
- the repository documents the chosen world, collision, navigation, and
  animation contracts.
