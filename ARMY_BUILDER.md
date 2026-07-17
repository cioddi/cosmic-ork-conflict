# Army builder

The army workshop is implemented entirely with React, browser `localStorage`,
and existing project dependencies. It does not download army lists, execute
stored markup, or rely on a third-party persistence service.

## Catalogue and points

Every unit has a stable catalogue ID. Point values are derived locally from the
unit's hit points, armour, speed, attacks, weapons, range, and type by
`calculateUnitPointCost`. The formula rounds to five-point increments and is
covered by unit tests. Keeping the formula explicit makes balance changes
reviewable and prevents remote data changes from silently altering saved armies.

An army records catalogue IDs and counts rather than full unit objects. It may
have either a numeric point limit or `null` for unrestricted building. Every
army still has a calculated point total, allowing an unrestricted army to be
matched against a random opponent of similar strength.

## Persistence

Saved armies use the versioned key `cosmic-ork-conflict.armies.v1`. Data read
from storage is parsed as `unknown` and accepted only when:

- the outer schema version matches;
- identifiers and names have the expected primitive types;
- every unit ID exists in the current local catalogue;
- counts are positive integers;
- the army has 1–48 units; and
- a constrained army does not exceed its limit.

Names are trimmed and length-limited. Invalid JSON, obsolete versions, unknown
units, and unusable armies fail closed. Storage errors are reported in the UI
without preventing an unsaved battle.

## Match setup

The editable army can fight either:

- a generated opponent within eight percent (at least 15 points) of its point
  total; or
- any saved army, including another user-created army.

Starting a battle expands catalogue IDs into fresh `Miniature` instances and
uses the existing collision-safe spawn service. Returning to the workshop stops
the active simulation and allows another matchup without reloading terrain.

## Rendering and dependencies

The workshop does not mount the map renderer. Terrain preparation happens in
the game layer while the inexpensive HTML interface becomes usable immediately;
MapLibre is created only after deployment. The active battle view talks to
MapLibre through a small local React context instead of the former third-party
provider, whose bundled React version could crash startup.

Unit images are registered once and rendered by one shared symbol layer. Each
catalogue image has a stable icon ID, so special sprites such as Orc Biker stay
distinct from generic vehicle and character fallbacks without adding a layer
per unit. No package was added for this feature.
