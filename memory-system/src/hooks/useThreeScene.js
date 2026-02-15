import { useEffect, useRef } from 'react';

const useThreeScene = (mountRef, categories, selectedNode, setSelectedNode, isZooming, setIsZooming) => {
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const nodesRef = useRef([]);
  const linesRef = useRef([]);
  const labelsRef = useRef([]);
  const isDraggingRef = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const targetCameraPosition = useRef({ x: 0, y: 1, z: 8 });

  const getNodeRadius = (dataCount) => {
    const minRadius = 0.12;
    const maxRadius = 0.4;
    const minData = 5;
    const maxData = 20;
    const normalized = Math.min(Math.max((dataCount - minData) / (maxData - minData), 0), 1);
    return minRadius + (maxRadius - minRadius) * normalized;
  };

  const zoomToNode = (nodeId) => {
    const node = nodesRef.current.find(n => n.userData.id === nodeId);
    if (!node) return;

    setIsZooming(true);
    const targetPos = node.position;
    targetCameraPosition.current = {
      x: targetPos.x,
      y: targetPos.y,
      z: targetPos.z + 2.5
    };

    setTimeout(() => setIsZooming(false), 1000);
  };

  const resetCamera = () => {
    setIsZooming(true);
    targetCameraPosition.current = { x: 0, y: 1, z: 8 };
    setSelectedNode(null);
    
    // Reset all node highlights
    nodesRef.current.forEach(node => {
      node.material.emissiveIntensity = 0.3;
      node.material.opacity = 0.9;
      node.material.emissive.setHex(0x9966cc);
      node.userData.pulsing = false;
      node.userData.lit = false;
    });
    
    // Reset all line highlights
    linesRef.current.forEach(line => {
      line.material.opacity = 0.5;
      line.material.color.setHex(0x4a3d66);
    });
    
    // Hide all labels
    labelsRef.current.forEach(label => {
      if (label) label.style.display = 'none';
    });
    
    setTimeout(() => setIsZooming(false), 1000);
  };

  useEffect(() => {
    if (!mountRef.current) return;

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    script.async = true;
    
    script.onload = () => {
      const THREE = window.THREE;
      
      const scene = new THREE.Scene();
      
      // Create depth background with gradient
      const canvas = document.createElement('canvas');
      canvas.width = 2048;
      canvas.height = 2048;
      const context = canvas.getContext('2d');
      
      const gradient = context.createRadialGradient(1024, 1024, 0, 1024, 1024, 1024);
      gradient.addColorStop(0, '#2a2d4a');
      gradient.addColorStop(0.5, '#1e2139');
      gradient.addColorStop(1, '#0f1123');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 2048, 2048);
      
      const texture = new THREE.CanvasTexture(canvas);
      scene.background = texture;
      
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(
        75,
        mountRef.current.clientWidth / mountRef.current.clientHeight,
        0.1,
        1000
      );
      camera.position.set(0, 1, 8);
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      mountRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Enhanced lighting
      const ambientLight = new THREE.AmbientLight(0x9966cc, 0.5);
      scene.add(ambientLight);

      const pointLight1 = new THREE.PointLight(0x9966cc, 1.5, 100);
      pointLight1.position.set(8, 8, 8);
      scene.add(pointLight1);

      const pointLight2 = new THREE.PointLight(0xb899e0, 1.2, 100);
      pointLight2.position.set(-8, -8, -8);
      scene.add(pointLight2);

      const pointLight3 = new THREE.PointLight(0x7744aa, 1, 100);
      pointLight3.position.set(0, -8, 0);
      scene.add(pointLight3);

      // Create nodes
      const nodeGeometries = [];
      const nodeMaterials = [];
      
      categories.forEach((category) => {
        const radius = getNodeRadius(category.dataCount);
        const geometry = new THREE.SphereGeometry(radius, 32, 32);
        const material = new THREE.MeshPhongMaterial({
          color: 0x9966cc,
          emissive: 0x9966cc,
          emissiveIntensity: 0.3,
          shininess: 100,
          transparent: true,
          opacity: 0.9
        });

        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.set(category.x, category.y, category.z);
        sphere.userData = { id: category.id, category };
        scene.add(sphere);
        nodesRef.current.push(sphere);
        nodeGeometries.push(geometry);
        nodeMaterials.push(material);
      });

      // Create connections
      const lineMaterial = new THREE.LineBasicMaterial({
        color: 0x4a3d66,
        transparent: true,
        opacity: 0.5,
        linewidth: 3
      });

      categories.forEach((category) => {
        if (category.children) {
          category.children.forEach((childId) => {
            const childCategory = categories.find(c => c.id === childId);
            if (childCategory) {
              const points = [];
              points.push(new THREE.Vector3(category.x, category.y, category.z));
              points.push(new THREE.Vector3(childCategory.x, childCategory.y, childCategory.z));
              
              const geometry = new THREE.BufferGeometry().setFromPoints(points);
              const line = new THREE.Line(geometry, lineMaterial);
              line.userData = { from: category.id, to: childId };
              scene.add(line);
              linesRef.current.push(line);
            }
          });
        }
      });

      // Particles
      const particlesGeometry = new THREE.BufferGeometry();
      const particlesCount = 2000;
      const posArray = new Float32Array(particlesCount * 3);
      
      for (let i = 0; i < particlesCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 20;
      }
      
      particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
      const particlesMaterial = new THREE.PointsMaterial({
        size: 0.015,
        color: 0x9966cc,
        transparent: true,
        opacity: 0.3
      });
      
      const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
      scene.add(particlesMesh);

      // Animation loop
      let rotationSpeed = 0.0008;
      let pulseTime = 0;
      
      const animate = () => {
        requestAnimationFrame(animate);

        pulseTime += 0.05;

        // Pulsing effect for lit nodes
        nodesRef.current.forEach(node => {
          if (node.userData.pulsing && node.userData.lit) {
            const pulse = Math.sin(pulseTime) * 0.3 + 1.5;
            node.material.emissiveIntensity = pulse;
          }
        });

        // Smooth camera movement
        if (isZooming) {
          camera.position.x += (targetCameraPosition.current.x - camera.position.x) * 0.05;
          camera.position.y += (targetCameraPosition.current.y - camera.position.y) * 0.05;
          camera.position.z += (targetCameraPosition.current.z - camera.position.z) * 0.05;
          camera.lookAt(targetCameraPosition.current.x, targetCameraPosition.current.y, 0);
        }

        // Auto-rotate
        if (!isDraggingRef.current && !isZooming) {
          nodesRef.current.forEach(node => {
            const pos = node.position;
            const angle = rotationSpeed;
            const newX = pos.x * Math.cos(angle) - pos.z * Math.sin(angle);
            const newZ = pos.x * Math.sin(angle) + pos.z * Math.cos(angle);
            node.position.x = newX;
            node.position.z = newZ;
          });

          linesRef.current.forEach(line => {
            const fromNode = nodesRef.current.find(n => n.userData.id === line.userData.from);
            const toNode = nodesRef.current.find(n => n.userData.id === line.userData.to);
            if (fromNode && toNode) {
              const positions = line.geometry.attributes.position.array;
              positions[0] = fromNode.position.x;
              positions[1] = fromNode.position.y;
              positions[2] = fromNode.position.z;
              positions[3] = toNode.position.x;
              positions[4] = toNode.position.y;
              positions[5] = toNode.position.z;
              line.geometry.attributes.position.needsUpdate = true;
            }
          });
        }

        // Update label positions
        labelsRef.current.forEach((label) => {
          if (label && label.style && label.style.display !== 'none') {
            const nodeId = parseInt(label.dataset.nodeId);
            const node = nodesRef.current.find(n => n.userData.id === nodeId);
            if (node) {
              const vector = new THREE.Vector3(node.position.x, node.position.y + 0.5, node.position.z);
              vector.project(camera);
              
              const x = (vector.x * 0.5 + 0.5) * mountRef.current.clientWidth;
              const y = (-(vector.y * 0.5) + 0.5) * mountRef.current.clientHeight;
              
              label.style.left = `${x}px`;
              label.style.top = `${y}px`;
            }
          }
        });

        particlesMesh.rotation.y += 0.0003;

        renderer.render(scene, camera);
      };

      animate();

      // Event handlers
      const handleResize = () => {
        if (!mountRef.current) return;
        camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      };
      window.addEventListener('resize', handleResize);

      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();

      const onMouseClick = (event) => {
        const rect = mountRef.current.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(nodesRef.current);

        if (intersects.length > 0) {
          const clickedNode = intersects[0].object;
          setSelectedNode(clickedNode.userData.id);
          zoomToNode(clickedNode.userData.id);
          
          // Hide all labels first
          labelsRef.current.forEach(label => {
            if (label) label.style.display = 'none';
          });
          
          // Show selected node label
          const labelIndex = categories.findIndex(c => c.id === clickedNode.userData.id);
          if (labelIndex !== -1 && labelsRef.current[labelIndex]) {
            labelsRef.current[labelIndex].style.display = 'block';
          }
          
          nodesRef.current.forEach(node => {
            if (node.userData.id === clickedNode.userData.id) {
              node.material.emissiveIntensity = 0.8;
              node.material.opacity = 1;
              node.material.emissive.setHex(0x9966cc);
              node.userData.pulsing = false;
              node.userData.lit = false;
            } else {
              node.material.emissiveIntensity = 0.3;
              node.material.opacity = 0.9;
              node.material.emissive.setHex(0x9966cc);
              node.userData.pulsing = false;
              node.userData.lit = false;
            }
          });

          linesRef.current.forEach(line => {
            if (line.userData.from === clickedNode.userData.id || 
                line.userData.to === clickedNode.userData.id) {
              line.material.opacity = 0.9;
              line.material.color.setHex(0x9966cc);
            } else {
              line.material.opacity = 0.5;
              line.material.color.setHex(0x4a3d66);
            }
          });
        }
      };

      const onMouseDown = (event) => {
        isDraggingRef.current = true;
        previousMousePosition.current = { x: event.clientX, y: event.clientY };
      };

      const onMouseMove = (event) => {
        if (isDraggingRef.current) {
          const deltaX = event.clientX - previousMousePosition.current.x;
          const deltaY = event.clientY - previousMousePosition.current.y;

          nodesRef.current.forEach(node => {
            const pos = node.position;
            
            const angleY = deltaX * 0.005;
            const newXY = pos.x * Math.cos(angleY) - pos.z * Math.sin(angleY);
            const newZY = pos.x * Math.sin(angleY) + pos.z * Math.cos(angleY);
            
            const angleX = deltaY * 0.005;
            const newYX = pos.y * Math.cos(angleX) - newZY * Math.sin(angleX);
            const newZX = pos.y * Math.sin(angleX) + newZY * Math.cos(angleX);
            
            node.position.set(newXY, newYX, newZX);
          });

          linesRef.current.forEach(line => {
            const fromNode = nodesRef.current.find(n => n.userData.id === line.userData.from);
            const toNode = nodesRef.current.find(n => n.userData.id === line.userData.to);
            if (fromNode && toNode) {
              const positions = line.geometry.attributes.position.array;
              positions[0] = fromNode.position.x;
              positions[1] = fromNode.position.y;
              positions[2] = fromNode.position.z;
              positions[3] = toNode.position.x;
              positions[4] = toNode.position.y;
              positions[5] = toNode.position.z;
              line.geometry.attributes.position.needsUpdate = true;
            }
          });

          previousMousePosition.current = { x: event.clientX, y: event.clientY };
        }
      };

      const onMouseUp = () => {
        isDraggingRef.current = false;
      };

      const onWheel = (event) => {
        event.preventDefault();
        const delta = event.deltaY * 0.002;
        camera.position.z = Math.max(2, Math.min(15, camera.position.z + delta));
      };

      renderer.domElement.addEventListener('click', onMouseClick);
      renderer.domElement.addEventListener('mousedown', onMouseDown);
      renderer.domElement.addEventListener('mousemove', onMouseMove);
      renderer.domElement.addEventListener('mouseup', onMouseUp);
      renderer.domElement.addEventListener('mouseleave', onMouseUp);
      renderer.domElement.addEventListener('wheel', onWheel);

      return () => {
        window.removeEventListener('resize', handleResize);
        renderer.domElement.removeEventListener('click', onMouseClick);
        renderer.domElement.removeEventListener('mousedown', onMouseDown);
        renderer.domElement.removeEventListener('mousemove', onMouseMove);
        renderer.domElement.removeEventListener('mouseup', onMouseUp);
        renderer.domElement.removeEventListener('mouseleave', onMouseUp);
        renderer.domElement.removeEventListener('wheel', onWheel);
        
        if (mountRef.current && renderer.domElement) {
          mountRef.current.removeChild(renderer.domElement);
        }
        
        nodeGeometries.forEach(geo => geo.dispose());
        nodeMaterials.forEach(mat => mat.dispose());
        renderer.dispose();
      };
    };

    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [categories]);

  return {
    nodesRef,
    linesRef,
    labelsRef,
    sceneRef,
    cameraRef,
    resetCamera
  };
};

export default useThreeScene;
