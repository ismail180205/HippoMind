import { useEffect, useRef, useCallback } from "react";

/**
 * Generic Three.js scene that renders a set of **nodes** (spheres) with
 * connecting lines.  Nodes can represent either static brain-categories or
 * dynamic search-clusters.
 *
 * When the `nodes` array changes the scene is rebuilt with a zoom transition.
 *
 * Each node: { id, name, size?, color? }
 * Positions are auto-computed via golden-ratio spherical packing.
 * Connections are auto-generated between close neighbours.
 */
const useThreeScene = (
  mountRef,
  nodes, // [{ id, name, size?, color? }, …]
  selectedNode,
  onNodeClick, // (nodeId) => void
  zoomTarget, // id of node the user just picked (triggers zoom-in on rebuild)
) => {
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const nodesRef = useRef([]);
  const linesRef = useRef([]);
  const labelsRef = useRef([]);
  const isDraggingRef = useRef(false);
  const prevMouse = useRef({ x: 0, y: 0 });
  const targetCamPos = useRef({ x: 0, y: 1, z: 8 });
  const isZoomingRef = useRef(false);
  const animFrameRef = useRef(null);
  const cleanupRef = useRef(null); // event-listener teardown
  const particlesRef = useRef(null);

  // ── helpers ──────────────────────────────────────────────────────────
  const nodeRadius = (sz) => {
    const t = Math.min(Math.max(((sz || 5) - 2) / 38, 0), 1);
    return 0.15 + 0.3 * t;
  };

  /** Golden-ratio spherical packing. */
  const layout = useCallback((items) => {
    const R = 3.2;
    const phi = (1 + Math.sqrt(5)) / 2;
    return items.map((it, i) => {
      const theta = Math.acos(1 - (2 * (i + 0.5)) / items.length);
      const psi = (2 * Math.PI * i) / phi;
      return {
        ...it,
        _x: R * Math.sin(theta) * Math.cos(psi),
        _y: R * Math.sin(theta) * Math.sin(psi),
        _z: R * Math.cos(theta),
      };
    });
  }, []);

  /** Auto-generate edges between close nodes. */
  const buildEdges = (laid) => {
    const edges = [];
    const thresh = 4.0;
    for (let i = 0; i < laid.length; i++) {
      for (let j = i + 1; j < laid.length; j++) {
        const a = laid[i],
          b = laid[j];
        const d = Math.hypot(a._x - b._x, a._y - b._y, a._z - b._z);
        if (d < thresh) edges.push([a.id, b.id]);
      }
    }
    // guarantee every node has ≥1 edge
    laid.forEach((n) => {
      if (edges.some(([a, b]) => a === n.id || b === n.id)) return;
      if (laid.length <= 1) return;
      let best = null,
        bestD = Infinity;
      laid.forEach((m) => {
        if (m.id === n.id) return;
        const d = Math.hypot(n._x - m._x, n._y - m._y, n._z - m._z);
        if (d < bestD) {
          bestD = d;
          best = m;
        }
      });
      if (best) edges.push([n.id, best.id]);
    });
    return edges;
  };

  // ── reset camera ────────────────────────────────────────────────────
  const resetCamera = useCallback(() => {
    isZoomingRef.current = true;
    targetCamPos.current = { x: 0, y: 1, z: 8 };
    if (onNodeClick) onNodeClick(null);

    nodesRef.current.forEach((node) => {
      node.material.emissiveIntensity = 0.3;
      node.material.opacity = 0.9;
      node.material.emissive.setHex(node.userData.baseColor || 0x9966cc);
      node.userData.pulsing = false;
    });
    linesRef.current.forEach((l) => {
      l.material.opacity = 0.4;
      l.material.color.setHex(0x4a3d66);
    });
    labelsRef.current.forEach((l) => {
      if (l) l.style.display = "none";
    });
    setTimeout(() => {
      isZoomingRef.current = false;
    }, 1000);
  }, [onNodeClick]);

  // ── build / rebuild scene whenever `nodes` changes ──────────────────
  useEffect(() => {
    if (!mountRef.current) return;

    const boot = (THREE) => {
      // ── tear down previous meshes (keep renderer / scene shell) ──
      if (cleanupRef.current) cleanupRef.current();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

      nodesRef.current.forEach((n) => {
        sceneRef.current?.remove(n);
        n.geometry.dispose();
        n.material.dispose();
      });
      linesRef.current.forEach((l) => {
        sceneRef.current?.remove(l);
        l.geometry.dispose();
        l.material.dispose();
      });
      nodesRef.current = [];
      linesRef.current = [];

      // ── scene (once) ─────────────────────────────────────────────
      let scene = sceneRef.current;
      if (!scene) {
        scene = new THREE.Scene();
        const cv = document.createElement("canvas");
        cv.width = 2048;
        cv.height = 2048;
        const cx = cv.getContext("2d");
        const g = cx.createRadialGradient(1024, 1024, 0, 1024, 1024, 1024);
        g.addColorStop(0, "#2a2d4a");
        g.addColorStop(0.5, "#1e2139");
        g.addColorStop(1, "#0f1123");
        cx.fillStyle = g;
        cx.fillRect(0, 0, 2048, 2048);
        scene.background = new THREE.CanvasTexture(cv);
        sceneRef.current = scene;
      }

      // ── camera (once) ────────────────────────────────────────────
      let camera = cameraRef.current;
      if (!camera) {
        camera = new THREE.PerspectiveCamera(
          75,
          mountRef.current.clientWidth / mountRef.current.clientHeight,
          0.1,
          1000,
        );
        camera.position.set(0, 1, 8);
        cameraRef.current = camera;
      }

      // ── renderer (once) ──────────────────────────────────────────
      let renderer = rendererRef.current;
      if (!renderer) {
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(
          mountRef.current.clientWidth,
          mountRef.current.clientHeight,
        );
        mountRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        scene.add(new THREE.AmbientLight(0x9966cc, 0.5));
        const p1 = new THREE.PointLight(0x9966cc, 1.5, 100);
        p1.position.set(8, 8, 8);
        scene.add(p1);
        const p2 = new THREE.PointLight(0xb899e0, 1.2, 100);
        p2.position.set(-8, -8, -8);
        scene.add(p2);
        const p3 = new THREE.PointLight(0x7744aa, 1, 100);
        p3.position.set(0, -8, 0);
        scene.add(p3);

        // particles
        const pGeo = new THREE.BufferGeometry();
        const N = 2000,
          arr = new Float32Array(N * 3);
        for (let i = 0; i < N * 3; i++) arr[i] = (Math.random() - 0.5) * 20;
        pGeo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
        const pMat = new THREE.PointsMaterial({
          size: 0.015,
          color: 0x9966cc,
          transparent: true,
          opacity: 0.3,
        });
        const particles = new THREE.Points(pGeo, pMat);
        scene.add(particles);
        particlesRef.current = particles;
      }

      // ── lay out current nodes ────────────────────────────────────
      const laid = layout(nodes);
      const edges = buildEdges(laid);

      const palette = [
        0x9966cc, 0x6688dd, 0x44aaaa, 0xcc7744, 0x88bb44, 0xcc5577, 0x55bbdd,
        0xddaa33,
      ];

      laid.forEach((n, idx) => {
        const r = nodeRadius(n.size || n.dataCount || 8);
        const baseColor = n.color || palette[idx % palette.length];
        const geo = new THREE.SphereGeometry(r, 32, 32);
        const mat = new THREE.MeshPhongMaterial({
          color: baseColor,
          emissive: baseColor,
          emissiveIntensity: 0.3,
          shininess: 100,
          transparent: true,
          opacity: 0.9,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(n._x, n._y, n._z);
        mesh.userData = { id: n.id, name: n.name, baseColor };
        scene.add(mesh);
        nodesRef.current.push(mesh);
      });

      edges.forEach(([aId, bId]) => {
        const aM = nodesRef.current.find((m) => m.userData.id === aId);
        const bM = nodesRef.current.find((m) => m.userData.id === bId);
        if (!aM || !bM) return;
        const pts = [
          new THREE.Vector3(aM.position.x, aM.position.y, aM.position.z),
          new THREE.Vector3(bM.position.x, bM.position.y, bM.position.z),
        ];
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({
          color: 0x4a3d66,
          transparent: true,
          opacity: 0.4,
        });
        const line = new THREE.Line(geo, mat);
        line.userData = { from: aId, to: bId };
        scene.add(line);
        linesRef.current.push(line);
      });

      // ── zoom transition when cluster picked ──────────────────────
      if (zoomTarget != null) {
        camera.position.set(0, 0, 1.5);
        isZoomingRef.current = true;
        targetCamPos.current = { x: 0, y: 1, z: 8 };
        setTimeout(() => {
          isZoomingRef.current = false;
        }, 1200);
      }

      // ── animation loop ───────────────────────────────────────────
      let pulseT = 0;
      const rotSpeed = 0.0008;

      const animate = () => {
        animFrameRef.current = requestAnimationFrame(animate);
        pulseT += 0.05;

        nodesRef.current.forEach((node) => {
          if (node.userData.pulsing) {
            node.material.emissiveIntensity = Math.sin(pulseT) * 0.3 + 1.5;
          }
        });

        // smooth camera
        if (isZoomingRef.current) {
          camera.position.x +=
            (targetCamPos.current.x - camera.position.x) * 0.05;
          camera.position.y +=
            (targetCamPos.current.y - camera.position.y) * 0.05;
          camera.position.z +=
            (targetCamPos.current.z - camera.position.z) * 0.05;
          camera.lookAt(targetCamPos.current.x, targetCamPos.current.y, 0);
        }

        // auto-rotate
        if (!isDraggingRef.current && !isZoomingRef.current) {
          nodesRef.current.forEach((node) => {
            const p = node.position;
            const a = rotSpeed;
            const nx = p.x * Math.cos(a) - p.z * Math.sin(a);
            const nz = p.x * Math.sin(a) + p.z * Math.cos(a);
            p.x = nx;
            p.z = nz;
          });
          linesRef.current.forEach((line) => {
            const f = nodesRef.current.find(
              (n) => n.userData.id === line.userData.from,
            );
            const t = nodesRef.current.find(
              (n) => n.userData.id === line.userData.to,
            );
            if (f && t) {
              const a = line.geometry.attributes.position.array;
              a[0] = f.position.x;
              a[1] = f.position.y;
              a[2] = f.position.z;
              a[3] = t.position.x;
              a[4] = t.position.y;
              a[5] = t.position.z;
              line.geometry.attributes.position.needsUpdate = true;
            }
          });
        }

        // labels
        labelsRef.current.forEach((label) => {
          if (!label || label.style.display === "none") return;
          const nid = label.dataset.nodeId;
          const node = nodesRef.current.find(
            (n) => String(n.userData.id) === nid,
          );
          if (node && mountRef.current) {
            const v = new THREE.Vector3(
              node.position.x,
              node.position.y + 0.5,
              node.position.z,
            );
            v.project(camera);
            label.style.left = `${(v.x * 0.5 + 0.5) * mountRef.current.clientWidth}px`;
            label.style.top = `${(-(v.y * 0.5) + 0.5) * mountRef.current.clientHeight}px`;
          }
        });

        if (particlesRef.current) particlesRef.current.rotation.y += 0.0003;
        renderer.render(scene, camera);
      };
      animate();

      // ── event handlers ───────────────────────────────────────────
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();

      const onClick = (e) => {
        const rect = mountRef.current.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(nodesRef.current);
        if (hits.length > 0) {
          const clicked = hits[0].object;
          const nid = clicked.userData.id;

          // zoom toward clicked node
          isZoomingRef.current = true;
          const tp = clicked.position;
          targetCamPos.current = { x: tp.x, y: tp.y, z: tp.z + 2.5 };
          setTimeout(() => {
            isZoomingRef.current = false;
          }, 1000);

          // highlight
          nodesRef.current.forEach((node) => {
            if (node.userData.id === nid) {
              node.material.emissiveIntensity = 0.8;
              node.material.opacity = 1;
              node.userData.pulsing = true;
            } else {
              node.material.emissiveIntensity = 0.3;
              node.material.opacity = 0.9;
              node.userData.pulsing = false;
            }
          });

          // show label
          labelsRef.current.forEach((l) => {
            if (l) l.style.display = "none";
          });
          const li = nodes.findIndex((n) => n.id === nid);
          if (li !== -1 && labelsRef.current[li])
            labelsRef.current[li].style.display = "block";

          // highlight edges
          linesRef.current.forEach((line) => {
            if (line.userData.from === nid || line.userData.to === nid) {
              line.material.opacity = 0.9;
              line.material.color.setHex(0x9966cc);
            } else {
              line.material.opacity = 0.4;
              line.material.color.setHex(0x4a3d66);
            }
          });

          if (onNodeClick) onNodeClick(nid);
        }
      };

      const onDown = (e) => {
        isDraggingRef.current = true;
        prevMouse.current = { x: e.clientX, y: e.clientY };
      };
      const onMove = (e) => {
        if (!isDraggingRef.current) return;
        const dx = e.clientX - prevMouse.current.x;
        const dy = e.clientY - prevMouse.current.y;
        nodesRef.current.forEach((node) => {
          const p = node.position;
          const aY = dx * 0.005;
          const nx = p.x * Math.cos(aY) - p.z * Math.sin(aY);
          const nz = p.x * Math.sin(aY) + p.z * Math.cos(aY);
          const aX = dy * 0.005;
          const ny = p.y * Math.cos(aX) - nz * Math.sin(aX);
          const nz2 = p.y * Math.sin(aX) + nz * Math.cos(aX);
          p.set(nx, ny, nz2);
        });
        linesRef.current.forEach((line) => {
          const f = nodesRef.current.find(
            (n) => n.userData.id === line.userData.from,
          );
          const t = nodesRef.current.find(
            (n) => n.userData.id === line.userData.to,
          );
          if (f && t) {
            const a = line.geometry.attributes.position.array;
            a[0] = f.position.x;
            a[1] = f.position.y;
            a[2] = f.position.z;
            a[3] = t.position.x;
            a[4] = t.position.y;
            a[5] = t.position.z;
            line.geometry.attributes.position.needsUpdate = true;
          }
        });
        prevMouse.current = { x: e.clientX, y: e.clientY };
      };
      const onUp = () => {
        isDraggingRef.current = false;
      };
      const onWheel = (e) => {
        e.preventDefault();
        camera.position.z = Math.max(
          2,
          Math.min(15, camera.position.z + e.deltaY * 0.002),
        );
      };
      const onResize = () => {
        if (!mountRef.current) return;
        camera.aspect =
          mountRef.current.clientWidth / mountRef.current.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(
          mountRef.current.clientWidth,
          mountRef.current.clientHeight,
        );
      };

      const el = renderer.domElement;
      el.addEventListener("click", onClick);
      el.addEventListener("mousedown", onDown);
      el.addEventListener("mousemove", onMove);
      el.addEventListener("mouseup", onUp);
      el.addEventListener("mouseleave", onUp);
      el.addEventListener("wheel", onWheel);
      window.addEventListener("resize", onResize);

      cleanupRef.current = () => {
        el.removeEventListener("click", onClick);
        el.removeEventListener("mousedown", onDown);
        el.removeEventListener("mousemove", onMove);
        el.removeEventListener("mouseup", onUp);
        el.removeEventListener("mouseleave", onUp);
        el.removeEventListener("wheel", onWheel);
        window.removeEventListener("resize", onResize);
      };
    };

    // bootstrap Three.js
    if (window.THREE) {
      boot(window.THREE);
    } else {
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
      script.async = true;
      script.onload = () => boot(window.THREE);
      document.head.appendChild(script);
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (cleanupRef.current) cleanupRef.current();
    };
  }, [nodes, zoomTarget]); // rebuild when nodes change

  // ── full teardown on unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (cleanupRef.current) cleanupRef.current();
      if (rendererRef.current) {
        if (mountRef.current && rendererRef.current.domElement) {
          try {
            mountRef.current.removeChild(rendererRef.current.domElement);
          } catch {}
        }
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      sceneRef.current = null;
      cameraRef.current = null;
    };
  }, []);

  return { nodesRef, linesRef, labelsRef, cameraRef, resetCamera };
};

export default useThreeScene;
