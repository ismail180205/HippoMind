# Memory System UI - React Component Architecture

A beautiful 3D brain visualization for exploring memory data, refactored into modular React components.

## Project Structure

```
memory-system/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── BrainVisualization.jsx    # 3D brain graph with Three.js
│   │   ├── BrainVisualization.css
│   │   ├── DataPanel.jsx              # Left sidebar for node data
│   │   ├── DataPanel.css
│   │   ├── QueryInterface.jsx         # Bottom query options panel
│   │   ├── QueryInterface.css
│   │   ├── ImageGrid.jsx              # Grid display for images
│   │   ├── ImageGrid.css
│   │   ├── FileList.jsx               # List display for files
│   │   ├── FileList.css
│   │   ├── QueryOption.jsx            # Individual query option button
│   │   └── QueryOption.css
│   ├── hooks/
│   │   ├── useThreeScene.js           # Custom hook for Three.js scene
│   │   └── useFiringAnimation.js      # Custom hook for neuron firing
│   ├── data/
│   │   └── memoryData.js              # Categories, data items, and options
│   ├── App.jsx                        # Main app component
│   ├── App.css                        # Main app styles
│   ├── index.js                       # Entry point
│   └── index.css                      # Global styles
├── package.json
└── README.md
```

## Component Overview

### Main Components

1. **App.jsx**
   - Root component that orchestrates the entire application
   - Manages state for selected node and query option
   - Renders DataPanel, BrainVisualization, and QueryInterface

2. **DataPanel.jsx**
   - Left sidebar displaying data for selected memory node
   - Shows images and files associated with the node
   - Renders ImageGrid and FileList components

3. **BrainVisualization.jsx**
   - Main 3D brain graph visualization
   - Uses Three.js for rendering
   - Handles node selection and camera controls
   - Displays node labels and selected node badge

4. **QueryInterface.jsx**
   - Bottom panel with query options
   - Allows users to choose how to explore memories
   - Renders QueryOption components

### Sub-Components

5. **ImageGrid.jsx**
   - Grid layout for displaying images
   - Hover effects for interaction

6. **FileList.jsx**
   - List layout for displaying files
   - Shows file name, size, and type

7. **QueryOption.jsx**
   - Individual query option button
   - Handles selection state and styling

### Custom Hooks

8. **useThreeScene.js**
   - Manages entire Three.js scene lifecycle
   - Handles nodes, connections, lighting, and particles
   - Provides camera controls and interactions
   - Manages auto-rotation and drag functionality

9. **useFiringAnimation.js**
   - Implements neuron firing animation
   - Finds path from root to target node
   - Animates nodes and connections along the path

### Data

10. **memoryData.js**
    - Contains all memory categories (50 nodes)
    - Data items associated with each category
    - Query options configuration

## Features

- **3D Brain Visualization**: Interactive 3D graph of memory nodes using Three.js
- **Dynamic Node Sizing**: Nodes scale based on data count
- **Hierarchical Structure**: Tree-based organization of memories
- **Interactive Controls**: 
  - Click nodes to select and zoom
  - Drag to rotate the brain
  - Scroll to zoom in/out
  - Reset camera view
- **Neuron Firing Animation**: Path-finding animation from root to selected node
- **Data Display**: View images and files for each memory category
- **Query Interface**: Multiple ways to explore memories
- **Responsive Design**: Clean, modern UI with purple theme
- **Smooth Animations**: Pulsing effects and smooth transitions

## Installation

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

## Usage

1. **Explore the Brain**: Click and drag to rotate the 3D brain visualization
2. **Select a Node**: Click on any node to view its associated data
3. **View Data**: See images and files in the left panel
4. **Query Options**: Choose from different exploration methods at the bottom
5. **Reset View**: Click the maximize button to reset the camera

## Technology Stack

- **React 18**: Component-based UI
- **Three.js**: 3D graphics rendering
- **Lucide React**: Icon library
- **Custom Hooks**: Reusable logic for scene and animations
- **CSS Modules**: Component-scoped styling

## Key Design Patterns

1. **Component Composition**: Breaking down complex UI into smaller, reusable components
2. **Custom Hooks**: Extracting complex logic into reusable hooks
3. **Separation of Concerns**: Data, logic, and presentation are separated
4. **State Management**: Centralized state in App component with props drilling
5. **CSS Organization**: Each component has its own CSS file

## Future Enhancements

- Add search functionality
- Implement timeline view
- Add data filtering and sorting
- Store/retrieve actual memory data
- Add animations for data loading
- Implement keyboard shortcuts
- Add accessibility features

## License

MIT
