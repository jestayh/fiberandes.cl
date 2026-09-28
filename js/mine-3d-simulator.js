/* ============================================================
   FIBERANDES — 3D Mine Geomechanics & Caving Simulator
   Interactive 3D WebGL Model: Boreholes (DAS) vs. Tunnel Geophones
   Inspired by Block Caving Geomechanics & Sintela/Silixa Research
   ============================================================ */
(function() {
  'use strict';

  const container = document.getElementById('mine-3d-canvas-container');
  if (!container) return;

  // Verify Three.js availability
  if (typeof THREE === 'undefined') {
    container.innerHTML = '<div style="color:var(--cyan); padding:40px; text-align:center; font-family:var(--font-mono);">Cargando motor 3D Three.js...</div>';
    return;
  }

  // State
  let activeMode = 'dfos'; // 'dfos' or 'geophones'
  let scene, camera, renderer, controls;
  let animId = null;
  let shockwaveMesh = null;
  let shockwaveActive = false;
  let shockwaveRadius = 0;
  let pulseTime = 0;

  // Scene Objects Groups
  const groupRock = new THREE.Group();
  const groupTunnels = new THREE.Group();
  const groupCave = new THREE.Group();
  const groupBoreholes = new THREE.Group();
  const groupGeophones = new THREE.Group();
  const groupBlindSpots = new THREE.Group();
  const groupLabels = new THREE.Group();
  let seismogenicParticles = null;
  let laserPulseMeshes = [];

  // Dimensions & Scale (1 unit = ~50 meters, total depth ~2.000m)
  // Surface at Y = +10 (0m), Cave back at Y = -2 (-1000m), Production at Y = -12 (-1800m), Bottom at Y = -15 (-2000m)
  const Y_SURFACE = 10;
  const Y_CAVE_TOP = -2;
  const Y_AIR_GAP = -6;
  const Y_PRODUCTION = -12;
  const Y_BOTTOM = -15;

  function init() {
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 540;

    // 1. Scene & Renderer
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040711);
    scene.fog = new THREE.FogExp2(0x040711, 0.012);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = false;
    container.appendChild(renderer.domElement);

    // 2. Camera
    camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 300);
    camera.position.set(38, 16, 42);

    // 3. OrbitControls
    if (typeof THREE.OrbitControls !== 'undefined') {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.target.set(0, -3, 0);
      controls.minDistance = 14;
      controls.maxDistance = 120;
      controls.maxPolarAngle = Math.PI / 2 + 0.15; // Don't flip all the way underneath
    }

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0x1a263d, 1.4);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xd4eaff, 1.2);
    dirLight1.position.set(20, 40, 25);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x00f0ff, 0.6);
    dirLight2.position.set(-20, -10, -20);
    scene.add(dirLight2);

    // Tunnel amber light
    const tunnelLight = new THREE.PointLight(0xffb020, 1.5, 30);
    tunnelLight.position.set(0, Y_PRODUCTION + 1, 0);
    scene.add(tunnelLight);

    // 5. Build Scene Layers
    buildBoundingBoxAndDepthGrid();
    buildTerrainSurface();
    buildUndergroundTunnels();
    buildBlockCaveGeometry();
    buildBoreholeFiberArray();
    buildGeophoneArray();
    buildShockwaveSystem();

    scene.add(groupRock);
    scene.add(groupTunnels);
    scene.add(groupCave);
    scene.add(groupBoreholes);
    scene.add(groupGeophones);
    scene.add(groupBlindSpots);
    scene.add(groupLabels);

    // Set initial mode visibility
    setMode(activeMode);

    // Events
    window.addEventListener('resize', onWindowResize);
    setupUIControls();

    // Start loop
    animate();
  }

  // -------------------------------------------------------------
  // BUILD: Bounding Box & Depth Grid
  // -------------------------------------------------------------
  function buildBoundingBoxAndDepthGrid() {
    // Outer wireframe block
    const boxGeo = new THREE.BoxGeometry(32, Y_SURFACE - Y_BOTTOM, 26);
    const boxEdges = new THREE.EdgesGeometry(boxGeo);
    const boxMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.18 });
    const wireframeBox = new THREE.LineSegments(boxEdges, boxMat);
    wireframeBox.position.set(0, (Y_SURFACE + Y_BOTTOM) / 2, 0);
    groupRock.add(wireframeBox);

    // Depth planes / grid rings
    const depthLevels = [
      { y: Y_SURFACE, label: "0 m (Superficie)", color: 0x71829e },
      { y: 4, label: "-600 m", color: 0x4d5c75 },
      { y: Y_CAVE_TOP, label: "-1.000 m (Cave-Back)", color: 0x00f0ff },
      { y: Y_AIR_GAP, label: "-1.400 m (Air Gap)", color: 0xe27d60 },
      { y: Y_PRODUCTION, label: "-1.800 m (Producción)", color: 0xffb020 },
      { y: Y_BOTTOM, label: "-2.000 m (Fondo)", color: 0x4d5c75 }
    ];

    depthLevels.forEach(dl => {
      const planeGeo = new THREE.PlaneGeometry(32, 26);
      const planeEdges = new THREE.EdgesGeometry(planeGeo);
      const planeMat = new THREE.LineBasicMaterial({ color: dl.color, transparent: true, opacity: 0.12 });
      const planeLines = new THREE.LineSegments(planeEdges, planeMat);
      planeLines.rotation.x = Math.PI / 2;
      planeLines.position.y = dl.y;
      groupRock.add(planeLines);
    });
  }

  // -------------------------------------------------------------
  // BUILD: Topographic Surface
  // -------------------------------------------------------------
  function buildTerrainSurface() {
    const terrainGeo = new THREE.PlaneGeometry(33, 27, 24, 20);
    terrainGeo.rotateX(-Math.PI / 2);

    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // Gentle Andean slope topography
      const elevation = Y_SURFACE + Math.sin(x * 0.18) * 0.8 + Math.cos(z * 0.15) * 0.6 + (x * 0.05);
      pos.setY(i, elevation);
    }
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x111c2f,
      roughness: 0.85,
      metalness: 0.1,
      wireframe: false,
      transparent: true,
      opacity: 0.75
    });

    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    groupRock.add(terrainMesh);

    // Surface wireframe overlay
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true, transparent: true, opacity: 0.15 });
    const wireMesh = new THREE.Mesh(terrainGeo, wireMat);
    groupRock.add(wireMesh);
  }

  // -------------------------------------------------------------
  // BUILD: Underground Tunnels & Galerías
  // -------------------------------------------------------------
  function buildUndergroundTunnels() {
    const tunnelMat = new THREE.MeshStandardMaterial({
      color: 0x223552,
      roughness: 0.6,
      metalness: 0.3,
      emissive: 0x0a1424,
      emissiveIntensity: 0.4
    });

    // 1. Production Level (-1.800m): Grid of extraction drifts
    const driftSpacing = 4.2;
    for (let x = -8.4; x <= 8.4; x += driftSpacing) {
      const driftGeo = new THREE.CylinderGeometry(0.55, 0.55, 20, 12);
      driftGeo.rotateX(Math.PI / 2);
      const driftMesh = new THREE.Mesh(driftGeo, tunnelMat);
      driftMesh.position.set(x, Y_PRODUCTION, 0);
      groupTunnels.add(driftMesh);
    }

    // Cross-cuts (perpendicular connecting drifts)
    for (let z = -8; z <= 8; z += 8) {
      const crossGeo = new THREE.CylinderGeometry(0.55, 0.55, 19, 12);
      crossGeo.rotateZ(Math.PI / 2);
      const crossMesh = new THREE.Mesh(crossGeo, tunnelMat);
      crossMesh.position.set(0, Y_PRODUCTION, z);
      groupTunnels.add(crossMesh);
    }

    // 2. Undercut Level (-1.550m, slightly above production)
    for (let x = -6.3; x <= 6.3; x += driftSpacing) {
      const ucGeo = new THREE.CylinderGeometry(0.45, 0.45, 16, 10);
      ucGeo.rotateX(Math.PI / 2);
      const ucMesh = new THREE.Mesh(ucGeo, tunnelMat);
      ucMesh.position.set(x, Y_PRODUCTION + 2.2, 0);
      groupTunnels.add(ucMesh);
    }

    // 3. Haulage / Transport Drift (-2.000m)
    const haulageGeo = new THREE.CylinderGeometry(0.7, 0.7, 24, 12);
    haulageGeo.rotateZ(Math.PI / 2);
    const haulageMesh = new THREE.Mesh(haulageGeo, tunnelMat);
    haulageMesh.position.set(0, Y_BOTTOM + 1.2, -9);
    groupTunnels.add(haulageMesh);

    // 4. Helical / Incline Access Ramp (connecting levels)
    const rampPoints = [];
    const rampTurns = 3.2;
    for (let t = 0; t <= 100; t++) {
      const p = t / 100;
      const angle = p * Math.PI * 2 * rampTurns;
      const radius = 12 + Math.sin(p * Math.PI) * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = THREE.MathUtils.lerp(Y_SURFACE, Y_PRODUCTION, p);
      rampPoints.push(new THREE.Vector3(x, y, z));
    }
    const rampCurve = new THREE.CatmullRomCurve3(rampPoints);
    const rampGeo = new THREE.TubeGeometry(rampCurve, 80, 0.5, 8, false);
    const rampMesh = new THREE.Mesh(rampGeo, tunnelMat);
    groupTunnels.add(rampMesh);

    // 5. Ventilation Shaft (Pique vertical)
    const shaftGeo = new THREE.CylinderGeometry(0.5, 0.5, Y_SURFACE - Y_PRODUCTION, 12);
    const shaftMesh = new THREE.Mesh(shaftGeo, tunnelMat);
    shaftMesh.position.set(-13, (Y_SURFACE + Y_PRODUCTION) / 2, 7);
    groupTunnels.add(shaftMesh);
  }

  // -------------------------------------------------------------
  // BUILD: Block Cave Geometry (Yielded Zone, Air Gap, Seismogenic Zone)
  // -------------------------------------------------------------
  function buildBlockCaveGeometry() {
    // 1. Yielded Zone (Muckpile / Broken rock cone above drawpoints)
    const yieldedGeo = new THREE.ConeGeometry(8.5, 5.5, 24, 6, true);
    yieldedGeo.rotateX(Math.PI);
    const yieldedMat = new THREE.MeshStandardMaterial({
      color: 0x1b434d,
      roughness: 0.9,
      metalness: 0.2,
      wireframe: false,
      transparent: true,
      opacity: 0.85
    });
    const yieldedMesh = new THREE.Mesh(yieldedGeo, yieldedMat);
    yieldedMesh.position.set(0, Y_PRODUCTION + 3.2, 0);
    groupCave.add(yieldedMesh);

    // Drawbells / Funnel shape representation at base
    const drawbellMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true, transparent: true, opacity: 0.2 });
    const drawbellMesh = new THREE.Mesh(yieldedGeo, drawbellMat);
    drawbellMesh.position.copy(yieldedMesh.position);
    groupCave.add(drawbellMesh);

    // 2. Air Gap (Cavity void dome)
    const airGapGeo = new THREE.SphereGeometry(6.2, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    const airGapMat = new THREE.MeshBasicMaterial({
      color: 0x070b14,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.95
    });
    const airGapMesh = new THREE.Mesh(airGapGeo, airGapMat);
    airGapMesh.position.set(0, Y_AIR_GAP + 0.8, 0);
    groupCave.add(airGapMesh);

    // 3. Seismogenic Zone: Particle Swarm (Microseismic Cloud)
    // Cloud of ~750 microseismic events arching above the cave back
    const particleCount = 750;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    const cBlue = new THREE.Color(0x00c7ff);
    const cGreen = new THREE.Color(0x00ffa3);
    const cYellow = new THREE.Color(0xffb020);
    const cRed = new THREE.Color(0xff4b55);

    for (let i = 0; i < particleCount; i++) {
      // Parabolic / Arch shell distribution
      const theta = Math.random() * Math.PI * 2;
      const r = 2.5 + Math.random() * 5.8;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r * 0.85;

      // Vertical arch: highest in center, dropping on sides
      const arch = Math.max(0, 1 - (r * r) / 64);
      const y = Y_CAVE_TOP + (arch * 4.8) + (Math.random() - 0.5) * 2.2;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Magnitude distribution: mostly low magnitudes Mw < 0
      const magRand = Math.random();
      let pColor = cBlue;
      let pSize = 1.4;

      if (magRand > 0.92) {
        pColor = cRed; // Rare large event Mw > 0.5
        pSize = 2.8;
      } else if (magRand > 0.75) {
        pColor = cYellow; // Moderate event Mw ~ 0
        pSize = 2.2;
      } else if (magRand > 0.40) {
        pColor = cGreen; // Microevent Mw ~ -1.0
        pSize = 1.8;
      } else {
        pColor = cBlue; // Ultra-microevent Mw < -1.5
        pSize = 1.4;
      }

      colors[i * 3] = pColor.r;
      colors[i * 3 + 1] = pColor.g;
      colors[i * 3 + 2] = pColor.b;
      sizes[i] = pSize;
    }

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Custom circle particle texture
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 32;
    pCanvas.height = 32;
    const pCtx = pCanvas.getContext('2d');
    const grad = pCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(0,240,255,0.9)');
    grad.addColorStop(1, 'rgba(0,240,255,0)');
    pCtx.fillStyle = grad;
    pCtx.fillRect(0, 0, 32, 32);
    const pTex = new THREE.CanvasTexture(pCanvas);

    const pMat = new THREE.PointsMaterial({
      size: 1.6,
      vertexColors: true,
      map: pTex,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    seismogenicParticles = new THREE.Points(pGeo, pMat);
    groupCave.add(seismogenicParticles);

    // 4. Elastic Zone (Boundary iso-contour)
    const elasticGeo = new THREE.SphereGeometry(12.5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const elasticEdges = new THREE.EdgesGeometry(elasticGeo);
    const elasticMat = new THREE.LineBasicMaterial({ color: 0x71829e, transparent: true, opacity: 0.22 });
    const elasticWire = new THREE.LineSegments(elasticEdges, elasticMat);
    elasticWire.position.set(0, Y_AIR_GAP - 1, 0);
    groupCave.add(elasticWire);
  }

  // -------------------------------------------------------------
  // BUILD: Boreholes & Fiber Optic Cable Array (FiberAndes DAS)
  // -------------------------------------------------------------
  function buildBoreholeFiberArray() {
    // Borehole Paths: Surface to Deep Rock & around caving
    const boreholeConfigs = [
      // 1. Central Deep Borehole (passes right through seismogenic zone)
      { start: [0, Y_SURFACE, 0], end: [0, Y_CAVE_TOP + 1.2, 0], type: 'central' },
      // 2. North Vertical Borehole
      { start: [-3.8, Y_SURFACE, 2.5], end: [-3.8, Y_BOTTOM + 2, 2.5], type: 'deep' },
      // 3. South Vertical Borehole
      { start: [3.8, Y_SURFACE, -2.5], end: [3.8, Y_BOTTOM + 2, -2.5], type: 'deep' },
      // 4. East Inclined Borehole (65° angle flanking cave)
      { start: [8.5, Y_SURFACE, 0], end: [1.5, Y_BOTTOM + 1, 0], type: 'inclined' },
      // 5. West Inclined Borehole
      { start: [-8.5, Y_SURFACE, 0], end: [-1.5, Y_BOTTOM + 1, 0], type: 'inclined' },
      // 6. Underground sub-horizontal probe drilled from Ramp into rock mass
      { start: [11.5, Y_CAVE_TOP + 3, 0], end: [2, Y_CAVE_TOP + 2.5, 0], type: 'horizontal' },
      { start: [-11.5, Y_CAVE_TOP + 3, 0], end: [-2, Y_CAVE_TOP + 2.5, 0], type: 'horizontal' }
    ];

    const fiberMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const boreholeCasingMat = new THREE.MeshStandardMaterial({
      color: 0x0b2038,
      roughness: 0.4,
      metalness: 0.8,
      transparent: true,
      opacity: 0.55
    });

    boreholeConfigs.forEach((bh, idx) => {
      const p1 = new THREE.Vector3(...bh.start);
      const p2 = new THREE.Vector3(...bh.end);
      const dir = new THREE.Vector3().subVectors(p2, p1);
      const len = dir.length();
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

      // Casing tube
      const casingGeo = new THREE.CylinderGeometry(0.22, 0.22, len, 8);
      const casingMesh = new THREE.Mesh(casingGeo, boreholeCasingMat);
      casingMesh.position.copy(mid);
      casingMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      groupBoreholes.add(casingMesh);

      // Fiber Core line (Glowing Laser Line)
      const fiberLineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const fiberLineMat = new THREE.LineBasicMaterial({
        color: 0x00f0ff,
        linewidth: 2,
        transparent: true,
        opacity: 0.95
      });
      const fiberLine = new THREE.Line(fiberLineGeo, fiberLineMat);
      groupBoreholes.add(fiberLine);

      // Virtual Sensor Nodes along borehole (one every ~1 unit / 50m)
      const nodeCount = Math.floor(len / 1.1);
      for (let n = 1; n < nodeCount; n++) {
        const nodePos = new THREE.Vector3().lerpVectors(p1, p2, n / nodeCount);
        const nodeGeo = new THREE.SphereGeometry(0.12, 6, 6);
        const nodeMat = new THREE.MeshBasicMaterial({ color: 0x00ffa3 });
        const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
        nodeMesh.position.copy(nodePos);
        groupBoreholes.add(nodeMesh);
      }

      // Animated Laser Pulse
      const pulseGeo = new THREE.SphereGeometry(0.32, 8, 8);
      const pulseMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
      pulseMesh.userData = { p1, p2, speed: 0.008 + (idx * 0.002), progress: Math.random() };
      groupBoreholes.add(pulseMesh);
      laserPulseMeshes.push(pulseMesh);
    });

    // Also connect horizontal tunnels with fiber (gallery loop)
    const galleryFiberPoints = [
      new THREE.Vector3(-8.4, Y_PRODUCTION, -8),
      new THREE.Vector3(8.4, Y_PRODUCTION, -8),
      new THREE.Vector3(8.4, Y_PRODUCTION, 8),
      new THREE.Vector3(-8.4, Y_PRODUCTION, 8),
      new THREE.Vector3(-8.4, Y_PRODUCTION, -8)
    ];
    const galLineGeo = new THREE.BufferGeometry().setFromPoints(galleryFiberPoints);
    const galLineMat = new THREE.LineBasicMaterial({ color: 0x00ffa3, linewidth: 2 });
    const galLine = new THREE.Line(galLineGeo, galLineMat);
    groupBoreholes.add(galLine);
  }

  // -------------------------------------------------------------
  // BUILD: Traditional Geophone Array & Massive Blind Spot
  // -------------------------------------------------------------
  function buildGeophoneArray() {
    // Discrete geophones are strictly confined to accessible tunnels
    const geophonePositions = [
      [-8.4, Y_PRODUCTION, -6],
      [-8.4, Y_PRODUCTION, 2],
      [8.4, Y_PRODUCTION, -4],
      [8.4, Y_PRODUCTION, 4],
      [0, Y_PRODUCTION, -8],
      [0, Y_PRODUCTION, 8],
      [-4.2, Y_PRODUCTION + 2.2, -5],
      [4.2, Y_PRODUCTION + 2.2, 5],
      [-13, Y_SURFACE - 4, 7],
      [-13, Y_PRODUCTION + 4, 7],
      [0, Y_BOTTOM + 1.2, -9],
      [6, Y_BOTTOM + 1.2, -9]
    ];

    const geoMat = new THREE.MeshStandardMaterial({
      color: 0xffb020,
      emissive: 0xff9900,
      emissiveIntensity: 0.6,
      roughness: 0.3
    });

    geophonePositions.forEach((pos, idx) => {
      // Octahedron representing discrete triaxial geophone station
      const gMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), geoMat);
      gMesh.position.set(...pos);
      groupGeophones.add(gMesh);

      // Pulsing detection range ring
      const ringGeo = new THREE.RingGeometry(0.8, 1.1, 16);
      ringGeo.rotateX(Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xffb020, side: THREE.DoubleSide, transparent: true, opacity: 0.4 });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.set(...pos);
      groupGeophones.add(ringMesh);
    });

    // Massive Blind Spot Volume (Rock mass & Cave-back inaccessible from tunnels)
    // Red/Amber volumetric dome covering the entire virgin rock
    const blindGeo = new THREE.SphereGeometry(10.5, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    blindGeo.rotateX(Math.PI);
    const blindMat = new THREE.MeshBasicMaterial({
      color: 0xff4b55,
      wireframe: true,
      transparent: true,
      opacity: 0.28
    });
    const blindMesh = new THREE.Mesh(blindGeo, blindMat);
    blindMesh.position.set(0, Y_CAVE_TOP + 1, 0);
    groupBlindSpots.add(blindMesh);

    // Large Red Warning Label Sprite in Blind Spot center
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(255, 75, 85, 0.85)';
    ctx.roundRect(4, 4, 248, 56, 8);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('PUNTO CIEGO CRÍTICO', 128, 38);

    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(7, 1.8, 1);
    sprite.position.set(0, Y_CAVE_TOP + 3.5, 0);
    groupBlindSpots.add(sprite);
  }

  // -------------------------------------------------------------
  // BUILD: Dynamic Shockwave / Microseismic Simulation Event
  // -------------------------------------------------------------
  function buildShockwaveSystem() {
    const shockGeo = new THREE.SphereGeometry(1, 24, 16);
    const shockMat = new THREE.MeshBasicMaterial({
      color: 0xfff000,
      wireframe: true,
      transparent: true,
      opacity: 0.8
    });
    shockwaveMesh = new THREE.Mesh(shockGeo, shockMat);
    shockwaveMesh.position.set(0, Y_CAVE_TOP + 2.2, 0);
    shockwaveMesh.visible = false;
    scene.add(shockwaveMesh);
  }

  // -------------------------------------------------------------
  // ACTION: Trigger Microseismic Shockwave Event
  // -------------------------------------------------------------
  function triggerEvent() {
    shockwaveActive = true;
    shockwaveRadius = 0.5;
    shockwaveMesh.visible = true;
    shockwaveMesh.scale.set(1, 1, 1);
    shockwaveMesh.material.opacity = 0.9;

    const banner = document.getElementById('sim-status-banner');
    if (activeMode === 'dfos') {
      shockwaveMesh.material.color.setHex(0x00f0ff);
      if (banner) {
        banner.className = 'sim-status-banner detected';
        banner.innerHTML = `<strong>⚡ EVENTO DETECTADO EN SONDAJE B-02 (-1.020 m)</strong> — Mw -1.4 · Ondas P/S cruzaron 85 canales continuos · Incertidumbre: ±2.1 m · Tasa de deformación activa`;
      }
    } else {
      shockwaveMesh.material.color.setHex(0xff4b55);
      if (banner) {
        banner.className = 'sim-status-banner blindspot';
        banner.innerHTML = `<strong>❌ EVENTO EN PUNTO CIEGO DE ROCA PROFUNDA</strong> — Geófonos en túneles a >400m de distancia · Señal atenuada · Incertidumbre: ±26 m · 0% datos de deformación`;
      }
    }
  }

  // -------------------------------------------------------------
  // MODE TOGGLE: DFOS (Sondajes) vs Geófonos (Solo Túneles)
  // -------------------------------------------------------------
  function setMode(mode) {
    activeMode = mode;

    if (mode === 'dfos') {
      groupBoreholes.visible = true;
      groupGeophones.visible = false;
      groupBlindSpots.visible = false;

      const banner = document.getElementById('sim-status-banner');
      if (banner) {
        banner.className = 'sim-status-banner detected';
        banner.innerHTML = `<strong>FIBERANDES DFOS: SONDAJES + GALERÍAS</strong> — 8.500 sensores continuos · Cobertura 98% · Detección Mw &lt; 0 y Slow-Strain en roca profunda`;
      }

      updateTelemetry(98, "8.500 Sensores", "±2.5 metros", "Activo (Doble Banda)");
    } else {
      groupBoreholes.visible = false;
      groupGeophones.visible = true;
      groupBlindSpots.visible = true;

      const banner = document.getElementById('sim-status-banner');
      if (banner) {
        banner.className = 'sim-status-banner blindspot';
        banner.innerHTML = `<strong>GEÓFONOS CONVENCIONALES: SOLO EN TÚNELES</strong> — 12 puntos discretos · 76% de la roca en punto ciego · Ciego a deformación lenta`;
      }

      updateTelemetry(24, "12 Estaciones", "±24 metros", "0% (Ciego fuera de túneles)");
    }
  }

  function updateTelemetry(cov, sensors, uncert, strain) {
    const elCov = document.getElementById('tel-val-cov');
    const elSens = document.getElementById('tel-val-sens');
    const elUncert = document.getElementById('tel-val-uncert');
    const elStrain = document.getElementById('tel-val-strain');

    if (elCov) elCov.textContent = cov + '%';
    if (elSens) elSens.textContent = sensors;
    if (elUncert) elUncert.textContent = uncert;
    if (elStrain) elStrain.textContent = strain;
  }

  // -------------------------------------------------------------
  // UI & BUTTONS SETUP
  // -------------------------------------------------------------
  function setupUIControls() {
    const btnDfos = document.getElementById('btn-mode-dfos');
    const btnEsi = document.getElementById('btn-mode-esi');
    const btnSimulate = document.getElementById('btn-simulate-event');
    const btnResetCam = document.getElementById('btn-reset-cam');

    if (btnDfos) {
      btnDfos.addEventListener('click', () => {
        btnDfos.classList.add('active');
        if (btnEsi) btnEsi.classList.remove('active');
        setMode('dfos');
      });
    }

    if (btnEsi) {
      btnEsi.addEventListener('click', () => {
        btnEsi.classList.add('active');
        if (btnDfos) btnDfos.classList.remove('active');
        setMode('geophones');
      });
    }

    if (btnSimulate) {
      btnSimulate.addEventListener('click', triggerEvent);
    }

    if (btnResetCam) {
      btnResetCam.addEventListener('click', () => {
        if (controls) {
          controls.reset();
          camera.position.set(38, 16, 42);
        }
      });
    }
  }

  // -------------------------------------------------------------
  // ANIMATION LOOP
  // -------------------------------------------------------------
  function animate() {
    animId = requestAnimationFrame(animate);

    pulseTime += 0.02;

    if (controls) controls.update();

    // 1. Animate Laser pulses traveling down boreholes
    laserPulseMeshes.forEach(p => {
      p.userData.progress += p.userData.speed;
      if (p.userData.progress > 1) p.userData.progress = 0;
      p.position.lerpVectors(p.userData.p1, p.userData.p2, p.userData.progress);
    });

    // 2. Animate Seismogenic cloud subtle breathing
    if (seismogenicParticles) {
      const pScale = 1 + Math.sin(pulseTime * 1.5) * 0.02;
      seismogenicParticles.scale.set(pScale, pScale, pScale);
    }

    // 3. Shockwave expansion
    if (shockwaveActive && shockwaveMesh) {
      shockwaveRadius += 0.35;
      shockwaveMesh.scale.set(shockwaveRadius, shockwaveRadius, shockwaveRadius);
      shockwaveMesh.material.opacity = Math.max(0, 0.9 - (shockwaveRadius / 18));

      if (shockwaveRadius > 18) {
        shockwaveActive = false;
        shockwaveMesh.visible = false;
      }
    }

    renderer.render(scene, camera);
  }

  function onWindowResize() {
    if (!container || !renderer || !camera) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  // Auto-init once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
