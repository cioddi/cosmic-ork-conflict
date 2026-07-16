# Runtime Error Checks

## What We Fixed

### ✅ Build Status
- Build completes successfully
- Only minor eslint warnings (React hooks)
- No TypeScript errors

### ✅ Pathfinding System - Jump Point Search (JPS)

**Why JPS?**
- 10-100x faster than A* on uniform grids
- Used by modern RTS games (StarCraft 2, Age of Empires 4)
- Well-proven algorithm from classic RTS games

**Grid Configuration:**
- Cell size: 18 meters (fast pathfinding, good for RTS gameplay)
- Grid dynamically sized based on map bounds (~280x246 cells = ~69,000 total)
- Uses spatial grid to quickly find nearby buildings
- **Blocking threshold**: cell covered >50% by building area (geometric intersection)
- Cells not near buildings = automatically walkable
- FAST - spatial grid filtering + geometric intersection for nearby buildings
- **Zoom level 14** for building extraction (more detailed building data)

**Safety Features:**
- ✅ Units NEVER walk through buildings (no fallback to direct path)
- ✅ Blocked start/goal positions automatically find nearest walkable cell
- ✅ If no path exists, unit stays in place (doesn't move)
- ✅ Path simplification removes unnecessary waypoints

### ✅ Navigation Interface Compatibility

**Methods used by Game.tsx:**
- [x] `navigation.planMovement()` - ✅ Exists
- [x] `navigation.executeMovement()` - ✅ Exists

**Methods used by SequentialAI.tsx:**
- [x] `navigation.planMovement()` - ✅ Exists
- [x] `navigation.clearCache()` - ✅ Exists

**Methods used by App.tsx:**
- [x] `navigation.getBuildingIndex()` - ✅ Exists

**Methods used by GameContext.tsx:**
- [x] `navigation.getBuildingIndex()` - ✅ Exists

## Potential Runtime Issues to Watch For

### 1. Navigation Initialization
**What to watch:** Console errors during game initialization

**Expected console output:**
```
Initializing simple navigation model...
Processing 16 tiles for buildings...
Processing tile 1/16 (0 buildings so far)
Processing tile 11/16 (234 buildings so far)
Extracted 456 buildings (skipped 23 invalid)
Creating JPS grid: 280x246 = 68880 cells
Cell size: 18m (0.000162°)
Marking grid cells with buildings...
Processing grid: 280x246 cells
Grid complete: 62000 walkable, 6880 blocked (10.0%)
Navigation initialized with Jump Point Search
Grid info: {...}
```

**When units move, you'll see:**
```
[JPS] Pathfinding from (120,85) to (145,92)
[JPS] Start cell walkable: true
[JPS] Goal cell walkable: true
[JPS] Running jump point search...
JPS found path in 234 iterations
[JPS] Success! 15 cells → 5 waypoints
```

**If you see:**
- ❌ "Navigation not initialized" - Navigation failed to initialize
- ❌ Fetch errors for tiles - Network issue or CORS problem
- ❌ "Failed to process tile" - Tile parsing issue

### 2. Unit Spawning
**What to watch:** Units spawning inside buildings or errors during spawn

**Expected behavior:**
- Units spawn in player setup areas
- Units are outside buildings
- No console errors

**If you see:**
- ❌ "Cannot read property 'buildings' of null" - BuildingIndex not ready
- ❌ Units spawn inside buildings - Collision check not working

### 3. Pathfinding (Jump Point Search)
**What to watch:** Console errors when units move

**Expected console output:**
```
[JPS] Pathfinding from (120,85) to (145,92)
[JPS] Start cell walkable: true
[JPS] Goal cell walkable: true
[JPS] Running jump point search...
JPS found path in 234 iterations
[JPS] Success! 15 cells → 5 waypoints
```

**If you see these messages, it's WORKING CORRECTLY:**
- ✅ `[JPS] No valid path found - unit will not move` - No path exists (unit stays in place)
- ✅ `[JPS] Start was blocked, moved to nearest walkable` - Finding valid start position
- ✅ `[JPS] Goal was blocked, moved to nearest walkable` - Finding valid goal position

**If you see these, there may be an issue:**
- ⚠️ `[JPS] Start cell walkable: false` + `no walkable cell nearby` - Start position inside building, no escape
- ⚠️ `[JPS] Search exhausted` - No path exists between start and goal (islands of walkable cells)
- ❌ `[JPS] Hit max iterations` - Path search taking too long (very rare)
- ❌ TypeError - Missing method or property

**Debugging Tips:**
1. Enable "Show Grid" and "Blocked Cells" in Grid Debug panel
2. Check if blocked cells (red) align with buildings
3. Check if start/goal positions are in walkable (non-red) areas
4. If everything is red → blocking is too aggressive
5. If nothing is red → blocking is not working

### 4. Debug Layers
**What to watch:** Debug visualization layers

**Available Layers:**
- **Show Buildings** - Red building outlines from vector tiles
- **Show Grid** - Pathfinding grid cells
  - Blocked Cells (Red) - Cells fully covered by buildings
  - Walkable Cells (Green) - Cells that units can move through
- **Show Tile Bounds** - Blue outlines showing vector tile boundaries

**Expected behavior:**
- Toggle checkboxes in "Debug Layers" panel (top-right)
- Corresponding layers appear on map
- Layer stats show in panel

**If you see:**
- ❌ No buildings shown - BuildingIndex is null or empty
- ❌ No tiles shown - Tile data not loaded
- ❌ Console errors - DeckGL layer issue

## Common Runtime Errors & Fixes

### Error: "Cannot read property 'planMovement' of undefined"
**Cause:** Navigation not initialized before game starts
**Fix:** Wait for navigation initialization in GameContext

### Error: "Cannot read property 'buildings' of null"
**Cause:** BuildingIndex not extracted yet
**Fix:** Check if navigation.getBuildingIndex() returns null

### Message: "No valid path found - unit will not move"
**This is NOT an error!** This is correct behavior when:
- Unit is completely surrounded by buildings
- Target is unreachable
- Unit will stay in place (safe behavior)

### Message: "Start/Goal was blocked, moved to nearest walkable"
**This is NOT an error!** The pathfinder automatically:
- Detects if start/goal is inside a building
- Finds nearest walkable cell (within 20 cells)
- Continues pathfinding from valid position

### Performance: "JPS hit max iterations"
**Rare but ok** - Path is very complex
- Max iterations: 50,000 (much higher than A*)
- JPS explores far fewer nodes than A*
- If this happens often, consider larger cell size

## Testing Steps

1. **Start the app**
   - Watch console for initialization messages
   - Should complete in 1-2 seconds

2. **Wait for units to spawn**
   - Units should appear on map
   - Check console for any errors

3. **Start the game**
   - Click "Start Game"
   - Units should move toward enemies

4. **Watch movement**
   - Units should avoid buildings
   - Smooth paths with few waypoints

5. **Toggle debug layer**
   - Enable "Show Buildings"
   - Red outlines should appear

## Success Indicators

✅ **Initialization Complete:**
```
Navigation initialized with Jump Point Search
Grid: 22500 walkable, 2700 blocked (10.7%)
```

✅ **Units Moving:**
```
unit_1_123: MOVE 25m toward unit_2_456 (150m away)
JPS found path in 234 iterations
JPS: 47 cells → 8 waypoints
```

✅ **Units Avoiding Buildings:**
- Units path around buildings (never through)
- Smooth movement with few waypoints
- If completely blocked, unit stays in place

✅ **No Errors:**
- No red errors in console
- No browser freezing
- Units move smoothly
- Fast pathfinding (< 10ms per path)

## If Problems Occur

1. **Open Browser DevTools** (F12)
2. **Check Console tab** for errors
3. **Look for red error messages**
4. **Copy the error message**
5. **Note what action caused it**

The most likely place for errors:
- During initialization (building extraction)
- During first unit movement (pathfinding)
- When toggling debug layer (DeckGL)
