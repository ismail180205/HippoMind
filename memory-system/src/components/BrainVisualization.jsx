import React, { useEffect, useRef, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import useThreeScene from '../hooks/useThreeScene';
import useFiringAnimation from '../hooks/useFiringAnimation';
import './BrainVisualization.css';

const BrainVisualization = ({ categories, selectedNode, setSelectedNode }) => {
  const mountRef = useRef(null);
  const [isZooming, setIsZooming] = useState(false);
  
  const {
    nodesRef,
    linesRef,
    labelsRef,
    cameraRef,
    resetCamera
  } = useThreeScene(mountRef, categories, selectedNode, setSelectedNode, isZooming, setIsZooming);

  const { firingAnimation, triggerNeuronFiring } = useFiringAnimation(
    categories,
    nodesRef,
    linesRef,
    labelsRef,
    setSelectedNode,
    setIsZooming
  );

  const selectedCategory = categories.find(c => c.id === selectedNode);

  const handleReset = () => {
    resetCamera();
  };

  return (
    <div className="brain-visualization">
      <div className="brain-header">
        <div>
          <h1 className="brain-title">
            Memory Brain ({categories.length} nodes)
          </h1>
          <p className="brain-subtitle">
            Drag to rotate • Click to zoom • Scroll to zoom in/out
          </p>
        </div>
        
        <div className="brain-controls">
          {selectedCategory && (
            <div className="selected-node-badge">
              <div className="badge-indicator" />
              {selectedCategory.name}
            </div>
          )}
          
          <button
            onClick={handleReset}
            className="reset-button"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      <div ref={mountRef} className="brain-canvas">
        {/* Node labels */}
        {categories.map((category, index) => (
          <div
            key={category.id}
            ref={el => labelsRef.current[index] = el}
            data-node-id={category.id}
            className="node-label"
          >
            {category.name}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BrainVisualization;
