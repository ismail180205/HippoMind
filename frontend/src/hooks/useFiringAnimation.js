import { useEffect, useState } from 'react';

const useFiringAnimation = (
  categories,
  nodesRef,
  linesRef,
  labelsRef,
  setSelectedNode,
  setIsZooming
) => {
  const [firingAnimation, setFiringAnimation] = useState(null);

  const triggerNeuronFiring = (targetNodeId) => {
    console.log('Firing animation triggered for node:', targetNodeId);
    
    // Find path from root to target
    const path = [];
    const visited = new Set();
    
    const dfs = (currentId, currentPath) => {
      if (visited.has(currentId)) return false;
      visited.add(currentId);
      
      const newPath = [...currentPath, currentId];
      
      if (currentId === targetNodeId) {
        path.push(...newPath);
        return true;
      }
      
      const current = categories.find(c => c.id === currentId);
      if (current && current.children) {
        for (const childId of current.children) {
          if (dfs(childId, newPath)) {
            return true;
          }
        }
      }
      
      return false;
    };
    
    dfs(1, []); // Start from root (id: 1)
    
    console.log('Path found:', path);
    
    if (path.length === 0) {
      console.log('No path found to node:', targetNodeId);
      return;
    }
    
    setFiringAnimation({
      path: path,
      currentIndex: 0,
      startTime: Date.now()
    });
    
    // Zoom to target node
    const node = nodesRef.current.find(n => n.userData.id === targetNodeId);
    if (node) {
      setIsZooming(true);
      const targetPos = node.position;
      const targetCameraPosition = {
        x: targetPos.x,
        y: targetPos.y,
        z: targetPos.z + 2.5
      };
      setTimeout(() => setIsZooming(false), 1000);
    }
  };

  // Handle firing animation
  useEffect(() => {
    if (!firingAnimation || nodesRef.current.length === 0) return;

    console.log('Starting firing animation with path:', firingAnimation.path);

    const nodeDelay = 300;
    let timeoutIds = [];

    firingAnimation.path.forEach((nodeId, index) => {
      const timeoutId = setTimeout(() => {
        const currentNode = nodesRef.current.find(n => n.userData.id === nodeId);
        
        if (currentNode) {
          console.log('Firing node:', nodeId);
          
          // Flash the node
          currentNode.material.emissive.setHex(0xffffff);
          currentNode.material.emissiveIntensity = 2;
          
          // Highlight the path edge
          if (index > 0) {
            const prevNodeId = firingAnimation.path[index - 1];
            const line = linesRef.current.find(l => 
              (l.userData.from === prevNodeId && l.userData.to === nodeId) ||
              (l.userData.to === prevNodeId && l.userData.from === nodeId)
            );
            if (line) {
              line.material.opacity = 1;
              line.material.color.setHex(0xffffff);
            }
          }
          
          // Return to normal or keep lit if final node
          setTimeout(() => {
            if (index === firingAnimation.path.length - 1) {
              // Final node - keep lit
              currentNode.material.emissive.setHex(0xffffff);
              currentNode.material.emissiveIntensity = 1.5;
              currentNode.userData.lit = true;
              currentNode.userData.pulsing = true;
              setSelectedNode(nodeId);
              
              // Show label
              const labelIndex = categories.findIndex(c => c.id === nodeId);
              if (labelIndex !== -1 && labelsRef.current[labelIndex]) {
                const label = labelsRef.current[labelIndex];
                if (label && label.style) {
                  label.style.display = 'block';
                }
              }
            } else {
              // Intermediate node - dim down
              currentNode.material.emissive.setHex(0x9966cc);
              currentNode.material.emissiveIntensity = 0.5;
            }
          }, 200);
        }
      }, index * nodeDelay);

      timeoutIds.push(timeoutId);
    });

    // Cleanup
    return () => {
      timeoutIds.forEach(id => clearTimeout(id));
    };
  }, [firingAnimation, categories, nodesRef, linesRef, labelsRef, setSelectedNode]);

  return {
    firingAnimation,
    triggerNeuronFiring
  };
};

export default useFiringAnimation;
