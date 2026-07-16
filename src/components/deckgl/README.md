# DeckGL Components for React-Maplibre

Reusable DeckGL layer components with seamless react-maplibre integration. These components provide a clean, type-safe API for rendering interactive visualizations on Maplibre maps.

## Features

- 🎯 **Type-safe**: Full TypeScript support with proper type definitions
- 🔄 **Lifecycle Management**: Automatic layer initialization, updates, and cleanup
- 🎨 **Highly Customizable**: Extensive props for styling and behavior
- ⚡ **Performance Optimized**: Throttled updates and efficient rendering
- 🧩 **Composable**: Built on a shared base component for consistency
- 🗺️ **Maplibre Integration**: Works seamlessly with @mapcomponents/react-maplibre

## Components

### BaseDeckGLLayer

The foundation for all DeckGL layer components. Handles common lifecycle management and Maplibre integration.

```tsx
import { BaseDeckGLLayer } from './components/deckgl';
import { IconLayer } from '@deck.gl/layers';

<BaseDeckGLLayer
  id="my-layer"
  layerType={IconLayer}
  data={data}
  visible={true}
  mapId="map_1"
  layerProps={{
    // DeckGL layer props
  }}
/>
```

### DeckGLIconLayer

Displays icons/sprites with rotation and interaction support.

```tsx
import { DeckGLIconLayer } from './components/deckgl';

<DeckGLIconLayer
  id="unit-icons"
  data={units}
  getPosition={(d) => d.coordinates}
  getIcon={(d) => ({
    id: d.type,
    url: `/assets/${d.type}.png`,
    width: 64,
    height: 64,
    anchorX: 32,
    anchorY: 32,
  })}
  getAngle={(d) => d.bearing}
  getSize={() => 48}
  pickable={true}
  onClick={(info) => console.log('Clicked:', info.object)}
  autoHighlight={true}
  enableCursorChange={true}
/>
```

**Props:**
- `getPosition`: Extract [lng, lat] from data
- `getIcon`: Return icon descriptor with URL and dimensions
- `getAngle`: Rotation angle in degrees (optional)
- `getSize`: Icon size in pixels (optional)
- `onClick/onHover`: Interaction handlers
- `autoHighlight`: Highlight on hover
- `enableCursorChange`: Change cursor on hover

### DeckGLScatterplotLayer

Displays circles/points with customizable colors and sizes.

```tsx
import { DeckGLScatterplotLayer } from './components/deckgl';

<DeckGLScatterplotLayer
  id="unit-circles"
  data={units}
  getPosition={(d) => d.coordinates}
  getRadius={(d) => d.size * 20}
  getFillColor={(d) => d.color}
  getLineColor={() => [0, 0, 0, 255]}
  getLineWidth={() => 2}
  stroked={true}
  filled={true}
  radiusMinPixels={10}
  radiusMaxPixels={50}
/>
```

**Props:**
- `getPosition`: Extract [lng, lat] from data
- `getRadius`: Circle radius
- `getFillColor/getLineColor`: Colors as [r, g, b, a]
- `getLineWidth`: Stroke width
- `stroked/filled`: Show stroke/fill
- `radiusMinPixels/radiusMaxPixels`: Size constraints

### DeckGLTextLayer

Displays text labels with styling and positioning.

```tsx
import { DeckGLTextLayer } from './components/deckgl';

<DeckGLTextLayer
  id="unit-labels"
  data={units}
  getPosition={(d) => d.coordinates}
  getText={(d) => `${d.name} (${d.hp} hp)`}
  getColor={(d) => d.playerColor}
  getSize={() => 12}
  getPixelOffset={() => [0, -40]}
  getTextAnchor={() => "middle"}
  getAlignmentBaseline={() => "bottom"}
  backgroundColor={[0, 0, 0, 160]}
  backgroundPadding={[4, 2]}
  outlineColor={[0, 0, 0, 255]}
  outlineWidth={1}
  fontFamily="Inter, sans-serif"
/>
```

**Props:**
- `getPosition`: Extract [lng, lat] from data
- `getText`: Extract text string
- `getColor`: Text color [r, g, b, a]
- `getSize`: Font size in pixels
- `getPixelOffset`: Offset from position [x, y]
- `getTextAnchor`: Horizontal alignment
- `getAlignmentBaseline`: Vertical alignment
- `backgroundColor/backgroundPadding`: Background styling
- `outlineColor/outlineWidth`: Text outline

### DeckGLLineLayer

Displays lines between source and target positions.

```tsx
import { DeckGLLineLayer } from './components/deckgl';

<DeckGLLineLayer
  id="connections"
  data={connections}
  getSourcePosition={(d) => d.start}
  getTargetPosition={(d) => d.end}
  getColor={(d) => {
    const cost = d.cost / 100;
    return [255 * cost, 255 * (1 - cost), 0, 100];
  }}
  getWidth={(d) => Math.max(1, 5 - d.distance / 50)}
  widthMinPixels={1}
  widthMaxPixels={10}
/>
```

**Props:**
- `getSourcePosition`: Extract source [lng, lat]
- `getTargetPosition`: Extract target [lng, lat]
- `getColor`: Line color [r, g, b, a]
- `getWidth`: Line width
- `widthMinPixels/widthMaxPixels`: Width constraints

## Utilities

### useLayerCursor

Hook for managing cursor changes on layer hover.

```tsx
import { useLayerCursor } from './components/deckgl';

const { handleHover, resetCursor } = useLayerCursor('map_1');

// Use in layer props
onHover: handleHover
```

## Common Props

All layer components support these common props:

- `id`: Unique layer identifier (required)
- `data`: Array of data items to render (required)
- `visible`: Show/hide layer (default: true)
- `pickable`: Enable mouse interactions (default varies by layer)
- `mapId`: Map instance ID (default: "map_1")
- `onClick/onHover`: Interaction callbacks
- `layerProps`: Additional DeckGL layer props

## Example: Complete Visualization

```tsx
import {
  DeckGLIconLayer,
  DeckGLScatterplotLayer,
  DeckGLTextLayer,
  DeckGLLineLayer
} from './components/deckgl';

function GameVisualization({ units, connections }) {
  return (
    <>
      {/* Background circles */}
      <DeckGLScatterplotLayer
        id="unit-circles"
        data={units}
        getPosition={(d) => d.position}
        getRadius={(d) => d.size * 20}
        getFillColor={(d) => [...d.color, 100]}
        stroked={true}
        filled={true}
      />

      {/* Unit icons */}
      <DeckGLIconLayer
        id="unit-icons"
        data={units}
        getPosition={(d) => d.position}
        getIcon={(d) => getIconDescriptor(d)}
        getAngle={(d) => d.bearing}
        pickable={true}
        onClick={handleUnitClick}
        enableCursorChange={true}
      />

      {/* Labels */}
      <DeckGLTextLayer
        id="unit-labels"
        data={units}
        getPosition={(d) => d.position}
        getText={(d) => `${d.name} (${d.hp})`}
        getColor={(d) => d.playerColor}
        getPixelOffset={() => [0, -40]}
      />

      {/* Connections */}
      <DeckGLLineLayer
        id="paths"
        data={connections}
        getSourcePosition={(d) => d.from}
        getTargetPosition={(d) => d.to}
        getColor={() => [100, 100, 255, 150]}
        getWidth={() => 2}
      />
    </>
  );
}
```

## Performance Tips

1. **Memoize Accessors**: Use `useCallback` for getter functions to prevent unnecessary re-renders
2. **Limit Data**: Cap data arrays for better performance (especially for LineLayer)
3. **Use Visibility**: Toggle `visible` prop instead of conditional rendering
4. **Icon Caching**: Cache icon descriptors to avoid recreating objects

## TypeScript Support

All components are fully typed. Import types as needed:

```tsx
import type {
  DeckGLIconLayerProps,
  DeckGLScatterplotLayerProps,
  DeckGLTextLayerProps,
  DeckGLLineLayerProps,
  IconDescriptor
} from './components/deckgl';
```

## Architecture

```
components/deckgl/
├── BaseDeckGLLayer.tsx       # Core lifecycle management
├── DeckGLIconLayer.tsx        # Icon rendering
├── DeckGLScatterplotLayer.tsx # Circle/point rendering
├── DeckGLTextLayer.tsx        # Text labels
├── DeckGLLineLayer.tsx        # Line connections
├── index.ts                   # Public exports
└── README.md                  # This file
```

Each layer component is built on `BaseDeckGLLayer` which provides:
- Layer initialization and cleanup
- Props update handling
- Maplibre integration
- Throttled rendering
- Error handling
