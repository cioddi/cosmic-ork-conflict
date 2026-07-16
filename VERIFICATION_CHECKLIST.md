# Pathfinding Migration Verification Checklist

## ✅ Code Quality
- [x] No TypeScript errors
- [x] Production build successful
- [x] All imports updated
- [x] Old PathNetwork imports removed

## 🎯 What Should Happen Now

### 1. Game Initialization
When you start the game, you should see in the console:
```
Initializing simple navigation model...
Extracting buildings from vector tiles...
Extracted X buildings
Simple navigation model initialized
Building index loaded: X buildings
```

### 2. Unit Movement
- Units should walk **directly** toward enemies
- Units should **go around** buildings when blocked
- Paths should be **smooth** with minimal waypoints
- No more following road networks

### 3. Debug Visualization
Toggle the debug layer (top-right corner):
- **Red lines** show building boundaries
- Buildings are extracted from the vector tile data
- Should see real building shapes from OpenStreetMap

## 🧪 Test Cases

### Test 1: Direct Path
1. Select a unit
2. Click on empty ground nearby
3. **Expected**: Unit walks straight there

### Test 2: Building Obstacle
1. Select a unit
2. Click on the opposite side of a building
3. **Expected**: Unit walks around the building

### Test 3: Debug Layer
1. Click "Show Buildings" checkbox (top-right)
2. **Expected**: See red building outlines on the map

### Test 4: AI Movement
1. Start the game
2. Watch AI units move
3. **Expected**:
   - Units walk toward enemies
   - Units avoid buildings
   - No errors in console

## 🐛 If Something Goes Wrong

### No buildings showing
- Check console for "Extracted X buildings"
- Verify vector tiles are loading
- Check building layer exists in tiles

### Units walking through buildings
- Check if pathfinding is initialized
- Look for pathfinding errors in console
- Verify building collision detection

### Performance issues
- Check building count (should be 500-2000)
- Monitor console for pathfinding timeouts
- Verify spatial grid is working

## 📊 Expected Console Output

### Good Initialization:
```
Initializing simple navigation model...
Processing X tiles for building extraction...
Extracted 1234 buildings
Simple navigation model initialized
Navigation object: SimpleNavigationModel {...}
Building index: {buildings: Map(1234), ...}
Building index loaded: 1234 buildings
```

### During Gameplay:
```
Planning new path for unit_1
A* found path in X iterations with Y nodes
Path smoothed to Z waypoints
```

## 🔍 Key Differences from Old System

| Aspect | Old (PathNetwork) | New (Building-Aware) |
|--------|------------------|---------------------|
| **Initialization** | "Generating transportation network" | "Extracting buildings" |
| **Debug Layer** | Orange/green nodes & lines | Red building outlines |
| **Unit Movement** | Follows roads/nodes | Direct paths avoiding buildings |
| **Console Logs** | Node count, network simplified | Building count, spatial cells |

## ✅ Success Criteria

The migration is successful if:
1. ✅ No TypeScript errors
2. ✅ Game initializes without crashes
3. ✅ Units spawn outside buildings
4. ✅ Units walk around buildings (not through)
5. ✅ Debug layer shows buildings (not roads)
6. ✅ Performance is good (2-3 sec initialization)

## 📝 Notes

- First time running may take a bit to extract buildings
- Building data is cached in the navigation singleton
- Debug layer is OFF by default (toggle top-right)
- Old PathNetwork code is still in the repo but not used
