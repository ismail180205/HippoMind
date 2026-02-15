# Component Architecture

## Component Tree

```
App (Main Container)
│
├── DataPanel (Left Sidebar)
│   ├── ImageGrid
│   │   └── Multiple image items
│   └── FileList
│       └── Multiple file items
│
└── Main Content (Right Side)
    │
    ├── BrainVisualization (Top - 58%)
    │   ├── Three.js Scene (via useThreeScene hook)
    │   ├── Node Labels
    │   ├── Camera Controls
    │   └── Reset Button
    │
    └── QueryInterface (Bottom - 42%)
        ├── QueryOption (Recent memories)
        ├── QueryOption (Browse by category)
        ├── QueryOption (Search content)
        ├── QueryOption (View timeline)
        └── Continue Button
```

## Data Flow

```
memoryData.js (Data Source)
    │
    ├── categories → App → BrainVisualization → useThreeScene
    ├── dataItems → App → DataPanel → ImageGrid/FileList
    └── queryOptions → App → QueryInterface → QueryOption
```

## State Management

```
App.jsx (State Container)
│
├── selectedNode (state)
│   ├── Set by: BrainVisualization (on node click)
│   ├── Used by: DataPanel (to show data)
│   └── Used by: BrainVisualization (to highlight)
│
└── selectedOption (state)
    ├── Set by: QueryInterface (on option click)
    └── Used by: QueryInterface (to show continue button)
```

## Hook Dependencies

```
BrainVisualization
│
├── useThreeScene
│   ├── Creates Three.js scene
│   ├── Manages nodes and connections
│   ├── Handles interactions (click, drag, zoom)
│   └── Provides resetCamera function
│
└── useFiringAnimation
    ├── Triggers neuron firing
    ├── Finds path from root to target
    └── Animates nodes along path
```

## CSS Architecture

Each component has its own CSS file:

```
App.css                    → Global app styles
DataPanel.css              → Left sidebar styles
BrainVisualization.css     → 3D brain container styles
QueryInterface.css         → Bottom panel styles
ImageGrid.css              → Image grid layout
FileList.css               → File list layout
QueryOption.css            → Option button styles
```

## Event Flow

### Node Selection
```
User clicks node
    → BrainVisualization (onClick handler)
    → setSelectedNode(nodeId)
    → App state updates
    → DataPanel re-renders with new data
    → BrainVisualization highlights node
```

### Query Option Selection
```
User clicks option
    → QueryOption (onClick)
    → QueryInterface (setSelectedOption)
    → App state updates
    → Continue button appears
    → Optional: Trigger neuron firing animation
```

### Camera Reset
```
User clicks reset button
    → BrainVisualization (handleReset)
    → useThreeScene.resetCamera()
    → Camera animates to default position
    → Node highlights cleared
    → Labels hidden
```

## Responsibilities

### App.jsx
- Coordinate all components
- Manage global state
- Pass props to children

### DataPanel.jsx
- Display selected node data
- Render images and files
- Handle empty states

### BrainVisualization.jsx
- Render 3D brain
- Handle user interactions
- Manage camera controls
- Show node labels

### QueryInterface.jsx
- Display query options
- Handle option selection
- Show continue button

### useThreeScene.js
- Initialize Three.js
- Create scene, camera, renderer
- Manage nodes and connections
- Handle animations
- Cleanup on unmount

### useFiringAnimation.js
- Path-finding algorithm
- Animation sequencing
- Node highlighting
- Edge highlighting
