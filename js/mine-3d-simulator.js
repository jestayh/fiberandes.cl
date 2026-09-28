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
  let fiberCables = [];

  // Dimensions & Scale (1 unit = ~50 meters, total depth ~2.000m)
  // Surface at Y = +10 (0m), Cave back at Y = -2 (-1000m), Production at Y = -12 (-1800m), Bottom at Y = -15 (-2000m)
  const Y_SURFACE = 10;
  const Y_CAVE_TOP = -2;
  const Y_AIR_GAP = -6;
  const Y_PRODUCTION = -12;
  const Y_BOTTOM = -15;

  function init() {
    const mountPoint = document.getElementById('mine-3d-viewport') || container;
    const width = mountPoint.clientWidth || container.clientWidth || 800;
    const height = mountPoint.clientHeight || container.clientHeight || 540;

    // 1. Scene & Renderer
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040711);
    scene.fog = new THREE.FogExp2(0x040711, 0.012);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = false;
    mountPoint.appendChild(renderer.domElement);

    // 2. Camera: Optimized framing for Block Cave & Tunnels
    camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 300);
    camera.position.set(24, 11, 28);

    // 3. OrbitControls
    if (typeof THREE.OrbitControls !== 'undefined') {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.target.set(0, -3.5, 0);
      controls.minDistance = 14;
      controls.maxDistance = 100;
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
  // BUILD: Rock Mass Cutaway Diorama & Depth Grid
  // -------------------------------------------------------------
  function buildBoundingBoxAndDepthGrid() {
    // 1. Cutaway Diorama Rock Walls (Back & Left Rock Face, like Ideon cutaway render)
    const rockWallMat = new THREE.MeshStandardMaterial({
      color: 0x141822,
      roughness: 0.92,
      metalness: 0.15,
      transparent: true,
      opacity: 0.88
    });

    // Back Rock Face
    const backWallGeo = new THREE.BoxGeometry(32, Y_SURFACE - Y_BOTTOM, 1.2);
    const backWall = new THREE.Mesh(backWallGeo, rockWallMat);
    backWall.position.set(0, (Y_SURFACE + Y_BOTTOM) / 2, -13);
    groupRock.add(backWall);

    // Left Rock Face
    const leftWallGeo = new THREE.BoxGeometry(1.2, Y_SURFACE - Y_BOTTOM, 26);
    const leftWall = new THREE.Mesh(leftWallGeo, rockWallMat);
    leftWall.position.set(-16, (Y_SURFACE + Y_BOTTOM) / 2, 0);
    groupRock.add(leftWall);

    // Bottom Base Slab
    const baseGeo = new THREE.BoxGeometry(32.5, 1.2, 26.5);
    const baseMesh = new THREE.Mesh(baseGeo, rockWallMat);
    baseMesh.position.set(0, Y_BOTTOM - 0.6, 0);
    groupRock.add(baseMesh);

    // Outer wireframe outline
    const boxGeo = new THREE.BoxGeometry(32, Y_SURFACE - Y_BOTTOM, 26);
    const boxEdges = new THREE.EdgesGeometry(boxGeo);
    const boxMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.22 });
    const wireframeBox = new THREE.LineSegments(boxEdges, boxMat);
    wireframeBox.position.set(0, (Y_SURFACE + Y_BOTTOM) / 2, 0);
    groupRock.add(wireframeBox);

    // Depth planes / grid rings
    const depthLevels = [
      { y: Y_SURFACE, label: "0 m (Superficie)", color: 0x71829e },
      { y: 4, label: "-600 m", color: 0x4d5c75 },
      { y: Y_CAVE_TOP, label: "-1.000 m (Cave-Back)", color: 0xff3b30 },
      { y: Y_AIR_GAP, label: "-1.400 m (Air Gap)", color: 0xff7733 },
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
      // Andean mountain slope topography
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
      opacity: 0.82
    });

    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    groupRock.add(terrainMesh);

    // Surface wireframe overlay
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true, transparent: true, opacity: 0.16 });
    const wireMesh = new THREE.Mesh(terrainGeo, wireMat);
    groupRock.add(wireMesh);
  }

  // -------------------------------------------------------------
  // BUILD: Underground Tunnels & Galerías (Semi-Transparent X-Ray)
  // -------------------------------------------------------------
  function buildUndergroundTunnels() {
    // Semi-transparent holographic glass-tunnel material to see interior sensors & fiber
    const tunnelMat = new THREE.MeshStandardMaterial({
      color: 0x182c44,
      roughness: 0.3,
      metalness: 0.15,
      emissive: 0x091b2e,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    const tunnelWireMat = new THREE.MeshBasicMaterial({
      color: 0x00e1ff,
      wireframe: true,
      transparent: true,
      opacity: 0.18
    });

    function addDrift(geo, x, y, z, rotX = 0, rotZ = 0) {
      if (rotX) geo.rotateX(rotX);
      if (rotZ) geo.rotateZ(rotZ);
      const mesh = new THREE.Mesh(geo, tunnelMat);
      mesh.position.set(x, y, z);
      groupTunnels.add(mesh);

      const wireMesh = new THREE.Mesh(geo, tunnelWireMat);
      wireMesh.position.set(x, y, z);
      groupTunnels.add(wireMesh);
    }

    // 1. Production Level (-1.800m): Grid of extraction drifts
    const driftSpacing = 4.2;
    for (let x = -8.4; x <= 8.4; x += driftSpacing) {
      const driftGeo = new THREE.CylinderGeometry(0.58, 0.58, 20, 14);
      addDrift(driftGeo, x, Y_PRODUCTION, 0, Math.PI / 2, 0);
    }

    // Cross-cuts (perpendicular connecting drifts)
    for (let z = -8; z <= 8; z += 8) {
      const crossGeo = new THREE.CylinderGeometry(0.58, 0.58, 19, 14);
      addDrift(crossGeo, 0, Y_PRODUCTION, z, 0, Math.PI / 2);
    }

    // 2. Undercut Level (-1.550m, slightly above production)
    for (let x = -6.3; x <= 6.3; x += driftSpacing) {
      const ucGeo = new THREE.CylinderGeometry(0.48, 0.48, 16, 12);
      addDrift(ucGeo, x, Y_PRODUCTION + 2.2, 0, Math.PI / 2, 0);
    }

    // 3. Haulage / Transport Drift (-2.000m)
    const haulageGeo = new THREE.CylinderGeometry(0.72, 0.72, 24, 14);
    addDrift(haulageGeo, 0, Y_BOTTOM + 1.2, -9, 0, Math.PI / 2);

    // 4. Helical / Incline Access Ramp (connecting surface to interior mina)
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
    const rampGeo = new THREE.TubeGeometry(rampCurve, 80, 0.55, 8, false);
    const rampMesh = new THREE.Mesh(rampGeo, tunnelMat);
    groupTunnels.add(rampMesh);

    const rampWire = new THREE.Mesh(rampGeo, tunnelWireMat);
    groupTunnels.add(rampWire);

    // 5. Ventilation Shaft (Pique vertical)
    const shaftGeo = new THREE.CylinderGeometry(0.52, 0.52, Y_SURFACE - Y_PRODUCTION, 12);
    addDrift(shaftGeo, -13, (Y_SURFACE + Y_PRODUCTION) / 2, 7);
  }

  // -------------------------------------------------------------
  // BUILD: Block Cave Geometry & Dynamic Seismicity
  // -------------------------------------------------------------
  let dynamicEvents = [];
  const MAX_DYNAMIC_EVENTS = 140;

  function buildBlockCaveGeometry() {
    // 1. Drawbells / Conical Funnels at Base
    const drawbellMat = new THREE.MeshStandardMaterial({
      color: 0x1f2733,
      roughness: 0.85,
      metalness: 0.2,
      side: THREE.DoubleSide
    });
    const drawbellWireMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true, transparent: true, opacity: 0.25 });

    const bellPositions = [
      [-4.2, Y_PRODUCTION + 1.2, -3.5],
      [-4.2, Y_PRODUCTION + 1.2, 3.5],
      [4.2, Y_PRODUCTION + 1.2, -3.5],
      [4.2, Y_PRODUCTION + 1.2, 3.5],
      [0, Y_PRODUCTION + 1.2, 0]
    ];

    bellPositions.forEach(bPos => {
      const bellGeo = new THREE.ConeGeometry(2.4, 2.5, 16, 2, true);
      bellGeo.rotateX(Math.PI);
      const bellMesh = new THREE.Mesh(bellGeo, drawbellMat);
      bellMesh.position.set(...bPos);
      groupCave.add(bellMesh);

      const bellWire = new THREE.Mesh(bellGeo, drawbellWireMat);
      bellWire.position.copy(bellMesh.position);
      groupCave.add(bellWire);

      // Floor marker plate
      const padGeo = new THREE.BoxGeometry(1.6, 0.2, 1.6);
      const padMat = new THREE.MeshStandardMaterial({
        color: 0xff6600,
        emissive: 0xff4400,
        emissiveIntensity: 0.8,
        roughness: 0.3
      });
      const padMesh = new THREE.Mesh(padGeo, padMat);
      padMesh.position.set(bPos[0], Y_PRODUCTION - 0.2, bPos[2]);
      groupCave.add(padMesh);
    });

    // 2. Muckpile (Broken Rock Mass)
    const muckpileGeo = new THREE.CylinderGeometry(6.8, 8.8, 4.5, 24, 4);
    const muckpileMat = new THREE.MeshStandardMaterial({
      color: 0x22262d,
      roughness: 0.95,
      metalness: 0.1,
      transparent: true,
      opacity: 0.88
    });
    const muckpileMesh = new THREE.Mesh(muckpileGeo, muckpileMat);
    muckpileMesh.position.set(0, Y_PRODUCTION + 3.8, 0);
    groupCave.add(muckpileMesh);

    // Clustered broken rock boulders
    const rockGeo = new THREE.DodecahedronGeometry(0.45, 0);
    for (let r = 0; r < 65; r++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 6.2;
      const rx = Math.cos(angle) * radius;
      const rz = Math.sin(angle) * radius * 0.9;
      const ry = Y_PRODUCTION + 4.2 + (Math.random() * 1.8) - ((radius / 6.2) * 0.8);

      const rMat = new THREE.MeshStandardMaterial({
        color: Math.random() > 0.5 ? 0x2e353f : 0x1b2028,
        roughness: 0.95
      });
      const rMesh = new THREE.Mesh(rockGeo, rMat);
      rMesh.position.set(rx, ry, rz);
      rMesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      const s = 0.6 + Math.random() * 0.8;
      rMesh.scale.set(s, s, s);
      groupCave.add(rMesh);
    }

    // 3. Volumetric Translucent Red Cave-Back Dome & Air Gap Envelope
    const caveBackGeo = new THREE.SphereGeometry(7.2, 28, 20, 0, Math.PI * 2, 0, Math.PI / 1.7);
    caveBackGeo.scale(1.15, 0.85, 1.0);
    const caveBackMat = new THREE.MeshStandardMaterial({
      color: 0xff281a,
      emissive: 0xaa1205,
      emissiveIntensity: 0.7,
      roughness: 0.25,
      metalness: 0.1,
      transparent: true,
      opacity: 0.52,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const caveBackMesh = new THREE.Mesh(caveBackGeo, caveBackMat);
    caveBackMesh.position.set(0, Y_AIR_GAP + 1.2, 0);
    groupCave.add(caveBackMesh);

    const caveBackWireMat = new THREE.MeshBasicMaterial({
      color: 0xff6644,
      wireframe: true,
      transparent: true,
      opacity: 0.35
    });
    const caveBackWire = new THREE.Mesh(caveBackGeo, caveBackWireMat);
    caveBackWire.position.copy(caveBackMesh.position);
    groupCave.add(caveBackWire);

    const caveGlowLight = new THREE.PointLight(0xff3311, 2.2, 22);
    caveGlowLight.position.set(0, Y_CAVE_TOP + 0.5, 0);
    groupCave.add(caveGlowLight);

    // 4. Dynamic Microseismicity (Appearing and Disappearing Fractures)
    // Instead of a static crowded swarm, events burst, radiate and fade away organically
    dynamicEvents = [];
    const positions = new Float32Array(MAX_DYNAMIC_EVENTS * 3);
    const colors = new Float32Array(MAX_DYNAMIC_EVENTS * 3);

    const cCyan = new THREE.Color(0x00f0ff);
    const cGreen = new THREE.Color(0x00ffa3);
    const cYellow = new THREE.Color(0xffc83b);
    const cRed = new THREE.Color(0xff4b55);
    const cFlash = new THREE.Color(0xffffff);

    for (let i = 0; i < MAX_DYNAMIC_EVENTS; i++) {
      // Natural arching distribution around cave-back
      const theta = Math.random() * Math.PI * 2;
      const r = 2.2 + Math.random() * 5.8;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r * 0.85;
      const arch = Math.max(0, 1 - (r * r) / 64);
      const y = Y_CAVE_TOP + (arch * 4.6) + (Math.random() - 0.5) * 2.2;

      const magRand = Math.random();
      let baseColor = cCyan;
      let mag = -1.8;

      if (magRand > 0.93) {
        baseColor = cRed;
        mag = 0.5;
      } else if (magRand > 0.78) {
        baseColor = cYellow;
        mag = -0.2;
      } else if (magRand > 0.45) {
        baseColor = cGreen;
        mag = -1.0;
      }

      const isInitiallyActive = Math.random() < 0.12; // Start with only ~12-16 active events

      dynamicEvents.push({
        homePos: new THREE.Vector3(x, y, z),
        baseColor,
        flashColor: cFlash,
        mag,
        active: isInitiallyActive,
        age: isInitiallyActive ? Math.random() * 1.5 : 0,
        lifespan: 1.2 + Math.random() * 1.6
      });

      positions[i * 3] = x;
      positions[i * 3 + 1] = isInitiallyActive ? y : -999;
      positions[i * 3 + 2] = z;

      colors[i * 3] = baseColor.r;
      colors[i * 3 + 1] = baseColor.g;
      colors[i * 3 + 2] = baseColor.b;
    }

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Custom glowing circle particle texture
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 64;
    pCanvas.height = 64;
    const pCtx = pCanvas.getContext('2d');
    const grad = pCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(0,240,255,0.95)');
    grad.addColorStop(0.7, 'rgba(0,240,255,0.3)');
    grad.addColorStop(1, 'rgba(0,240,255,0)');
    pCtx.fillStyle = grad;
    pCtx.fillRect(0, 0, 64, 64);
    const pTex = new THREE.CanvasTexture(pCanvas);

    const pMat = new THREE.PointsMaterial({
      size: 2.4,
      vertexColors: true,
      map: pTex,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    seismogenicParticles = new THREE.Points(pGeo, pMat);
    groupCave.add(seismogenicParticles);

    // 5. Elastic Zone boundary outer iso-contour
    const elasticGeo = new THREE.SphereGeometry(12.5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const elasticEdges = new THREE.EdgesGeometry(elasticGeo);
    const elasticMat = new THREE.LineBasicMaterial({ color: 0x71829e, transparent: true, opacity: 0.22 });
    const elasticWire = new THREE.LineSegments(elasticEdges, elasticMat);
    elasticWire.position.set(0, Y_AIR_GAP - 1, 0);
    groupCave.add(elasticWire);
  }

  // -------------------------------------------------------------
  // BUILD: Boreholes & Fiber Optic Cable Array
  // Continuous optical nervous system in boreholes + galleries
  // Ultra-clean luminous filaments, harmonic breathing & acoustic wavefield reactivity
  // -------------------------------------------------------------
  function buildBoreholeFiberArray() {
    fiberCables = [];

    // Helper: Build continuous luminous fiber cable (zero traveling spheres/pelotas)
    function addContinuousFiberCable(points, colorHex, type = 'borehole') {
      const curve = new THREE.CatmullRomCurve3(points);

      // 1. White-hot luminous central core (high-tensile optical fiber strand)
      const coreGeo = new THREE.BufferGeometry().setFromPoints(points);
      const coreMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        linewidth: 2,
        transparent: true,
        opacity: 0.95
      });
      const coreLine = new THREE.Line(coreGeo, coreMat);
      groupBoreholes.add(coreLine);

      // 2. Continuous Neon Plasma Sheath (additive glowing tube)
      const auraGeo = new THREE.TubeGeometry(curve, Math.max(16, points.length * 6), 0.12, 8, false);
      const auraMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const auraMesh = new THREE.Mesh(auraGeo, auraMat);
      groupBoreholes.add(auraMesh);

      // Register cable for harmonic breathing & acoustic wavefield reaction
      fiberCables.push({
        curve,
        points,
        coreLine,
        coreMat,
        auraMesh,
        auraMat,
        baseColor: new THREE.Color(colorHex),
        baseOpacity: 0.72,
        burstIntensity: 0.0,
        samplePoints: curve.getPoints(16),
        type
      });
    }

    // A. DEEP BOREHOLES: Drilling through virgin rock mass into seismogenic zone
    const boreholeConfigs = [
      // 1. Central Deep Borehole
      { points: [new THREE.Vector3(0, Y_SURFACE, 0), new THREE.Vector3(0, Y_CAVE_TOP + 1.2, 0)], color: 0x00f0ff },
      // 2. North Vertical Borehole
      { points: [new THREE.Vector3(-3.8, Y_SURFACE, 2.5), new THREE.Vector3(-3.8, Y_BOTTOM + 2, 2.5)], color: 0x00f0ff },
      // 3. South Vertical Borehole
      { points: [new THREE.Vector3(3.8, Y_SURFACE, -2.5), new THREE.Vector3(3.8, Y_BOTTOM + 2, -2.5)], color: 0x00f0ff },
      // 4. East Inclined Borehole
      { points: [new THREE.Vector3(8.5, Y_SURFACE, 0), new THREE.Vector3(1.5, Y_BOTTOM + 1, 0)], color: 0x00f0ff },
      // 5. West Inclined Borehole
      { points: [new THREE.Vector3(-8.5, Y_SURFACE, 0), new THREE.Vector3(-1.5, Y_BOTTOM + 1, 0)], color: 0x00f0ff },
      // 6. Underground probes into virgin rock
      { points: [new THREE.Vector3(11.5, Y_CAVE_TOP + 3, 0), new THREE.Vector3(2, Y_CAVE_TOP + 2.5, 0)], color: 0x00f0ff },
      { points: [new THREE.Vector3(-11.5, Y_CAVE_TOP + 3, 0), new THREE.Vector3(-2, Y_CAVE_TOP + 2.5, 0)], color: 0x00f0ff }
    ];

    const boreholeCasingMat = new THREE.MeshStandardMaterial({
      color: 0x0b2038,
      roughness: 0.4,
      metalness: 0.8,
      transparent: true,
      opacity: 0.45
    });

    boreholeConfigs.forEach(bh => {
      const p1 = bh.points[0];
      const p2 = bh.points[1];
      const dir = new THREE.Vector3().subVectors(p2, p1);
      const len = dir.length();
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

      // Casing tube
      const casingGeo = new THREE.CylinderGeometry(0.24, 0.24, len, 8);
      const casingMesh = new THREE.Mesh(casingGeo, boreholeCasingMat);
      casingMesh.position.copy(mid);
      casingMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      groupBoreholes.add(casingMesh);

      // Continuous fiber optic cable
      addContinuousFiberCable(bh.points, bh.color, 'borehole');
    });

    // B. FIBER OPTIC IN TUNNELS & GALERÍAS (Production Drifts, Cross-cuts, Ramp Trunk)
    // 1. Fiber along crowns of all 5 production drifts
    const driftXs = [-8.4, -4.2, 0, 4.2, 8.4];
    driftXs.forEach((x, i) => {
      const tunnelFiberPoints = [
        new THREE.Vector3(x, Y_PRODUCTION + 0.35, -9.5),
        new THREE.Vector3(x, Y_PRODUCTION + 0.35, 9.5)
      ];
      // Alternate between cyan (DAS Acústico) and emerald (DSS Deformación)
      const color = i % 2 === 0 ? 0x00f0ff : 0x00ffa3;
      addContinuousFiberCable(tunnelFiberPoints, color, 'tunnel');
    });

    // 2. Cross-cut fiber links connecting the drifts
    const crossZ = [-8, 0, 8];
    crossZ.forEach(z => {
      const crossPoints = [
        new THREE.Vector3(-8.4, Y_PRODUCTION + 0.35, z),
        new THREE.Vector3(8.4, Y_PRODUCTION + 0.35, z)
      ];
      addContinuousFiberCable(crossPoints, 0x00ffa3, 'crosscut');
    });

    // 3. Main Optical Trunk Cable down the spiral access ramp
    const rampFiberPoints = [];
    const rampTurns = 3.2;
    for (let t = 0; t <= 60; t++) {
      const p = t / 60;
      const angle = p * Math.PI * 2 * rampTurns;
      const radius = 12 + Math.sin(p * Math.PI) * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = THREE.MathUtils.lerp(Y_SURFACE, Y_PRODUCTION, p) + 0.35;
      rampFiberPoints.push(new THREE.Vector3(x, y, z));
    }
    addContinuousFiberCable(rampFiberPoints, 0x00f0ff, 'ramp');

    // 4. Interrogator Rack Unit in transport drift (-2.000m)
    const rackGeo = new THREE.BoxGeometry(1.4, 2.0, 1.0);
    const rackMat = new THREE.MeshStandardMaterial({
      color: 0x0e243d,
      roughness: 0.3,
      metalness: 0.8
    });
    const rackMesh = new THREE.Mesh(rackGeo, rackMat);
    rackMesh.position.set(-8.4, Y_BOTTOM + 1.2, -9);
    groupBoreholes.add(rackMesh);

    // Pulsing LED panel on interrogator
    const ledGeo = new THREE.BoxGeometry(0.8, 0.3, 0.1);
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const ledMesh = new THREE.Mesh(ledGeo, ledMat);
    ledMesh.position.set(-8.4, Y_BOTTOM + 1.6, -8.45);
    groupBoreholes.add(ledMesh);
  }

  // -------------------------------------------------------------
  // BUILD: Traditional Geophone Array & Discrete Subsurface Beacons
  // (Traditional / Ideon-style discrete battery beacons vs. continuous DAS)
  // -------------------------------------------------------------
  function buildGeophoneArray() {
    // 1. Discrete geophones strictly confined to accessible tunnels
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

    // 2. Discrete Subsurface Beacons (Balizas Subterráneas tipo Ideon/Smart Marker)
    // In traditional setups, boreholes only host 3-4 battery beacons with huge 60-100m blind gaps between them
    const beaconBoreholes = [
      { start: [-3.8, Y_SURFACE, 2.5], end: [-3.8, Y_BOTTOM + 2, 2.5] },
      { start: [3.8, Y_SURFACE, -2.5], end: [3.8, Y_BOTTOM + 2, -2.5] }
    ];

    const beaconGeo = new THREE.SphereGeometry(0.35, 12, 12);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      emissive: 0xff4400,
      emissiveIntensity: 0.9,
      roughness: 0.2
    });

    beaconBoreholes.forEach(bh => {
      const p1 = new THREE.Vector3(...bh.start);
      const p2 = new THREE.Vector3(...bh.end);

      // Dashed line trajectory indicating sparse borehole
      const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const lineMat = new THREE.LineDashedMaterial({
        color: 0xff7722,
        dashSize: 0.7,
        gapSize: 0.7,
        transparent: true,
        opacity: 0.65
      });
      const dashedLine = new THREE.Line(lineGeo, lineMat);
      dashedLine.computeLineDistances();
      groupGeophones.add(dashedLine);

      // Only 3 or 4 discrete beacons along the entire 1,500m pozo!
      const beaconFractions = [0.25, 0.45, 0.70, 0.90];
      beaconFractions.forEach(frac => {
        const bPos = new THREE.Vector3().lerpVectors(p1, p2, frac);
        const bMesh = new THREE.Mesh(beaconGeo, beaconMat);
        bMesh.position.copy(bPos);
        groupGeophones.add(bMesh);

        // Crosshair / glowing ring indicator around beacon (like in Ideon render)
        const crossGeo = new THREE.RingGeometry(0.45, 0.62, 12);
        const crossMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, side: THREE.DoubleSide, transparent: true, opacity: 0.75 });
        const crossMesh = new THREE.Mesh(crossGeo, crossMat);
        crossMesh.position.copy(bPos);
        groupGeophones.add(crossMesh);
      });
    });

    // 3. Massive Blind Spot Volume (Rock mass & Cave-back inaccessible from discrete points)
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
  // ACTION: Acoustic Wavefield Response on Optical Fiber Array
  // (Instantaneous Rayleigh Backscatter disturbance from seismic fractures)
  // -------------------------------------------------------------
  function triggerFiberAcousticReaction(hypoPos, magnitude = 1.0) {
    if (!fiberCables || fiberCables.length === 0) return;
    const maxRange = 18.0;
    for (let i = 0; i < fiberCables.length; i++) {
      const cable = fiberCables[i];
      let minD = Infinity;
      const pts = cable.samplePoints;
      for (let j = 0; j < pts.length; j++) {
        const d = pts[j].distanceTo(hypoPos);
        if (d < minD) minD = d;
      }
      if (minD < maxRange) {
        const factor = Math.pow(Math.max(0, 1.0 - (minD / maxRange)), 1.3) * magnitude;
        cable.burstIntensity = Math.min(2.0, Math.max(cable.burstIntensity, factor * 1.5));
      }
    }
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
      // Direct acoustic wavefield excitation on all nearby sensing fibers
      triggerFiberAcousticReaction(shockwaveMesh.position, 1.8);
      if (banner) {
        banner.className = 'sim-status-banner detected';
        banner.innerHTML = `<strong>⚡ EVENTO DETECTADO EN SONDAJE B-02 (-1.020 m)</strong> — Mw -1.4 · Ondas P/S cruzaron 85 canales continuos · Incertidumbre: ±2.1 m · Tasa de deformación activa`;
      }
    } else {
      shockwaveMesh.material.color.setHex(0xff4b55);
      if (banner) {
        banner.className = 'sim-status-banner blindspot';
        banner.innerHTML = `<strong>❌ EVENTO EN PUNTO CIEGO DE ROCA PROFUNDA</strong> — Ocurrió en el vacío ciego entre balizas a >350m · Señal atenuada en túneles · Incertidumbre: ±25 m · 0% datos de deformación continua`;
      }
    }
  }

  // -------------------------------------------------------------
  // MODE TOGGLE: DFOS (Sondajes) vs Balizas / Geófonos (Puntual)
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
        banner.innerHTML = `<strong>FIBERANDES DFOS: SONDAJES + GALERÍAS</strong> — 8.500 canales ópticos continuos (sin baterías) · Cobertura 98% · Captura sísmica Mw &lt; 0 y perfil continuo Slow-Strain`;
      }

      updateTelemetry(98, "8.500 Canales Ópticos", "±2.1 metros", "Activo (Doble Banda)");
    } else {
      groupBoreholes.visible = false;
      groupGeophones.visible = true;
      groupBlindSpots.visible = true;

      const banner = document.getElementById('sim-status-banner');
      if (banner) {
        banner.className = 'sim-status-banner blindspot';
        banner.innerHTML = `<strong>TECNOLOGÍA TRADICIONAL: BALIZAS DE BATERÍA &amp; GEÓFONOS</strong> — 8 balizas en sondajes + 12 geófonos en túneles · 78% de la roca en punto ciego · Ciego a deformación continua`;
      }

      updateTelemetry(22, "20 Puntos Discretos", "±25 metros", "0% (Ciego entre balizas)");
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

    // 1. Animate Continuous Optical Fiber Cables (Harmonic breathing & Acoustic wave reactivity)
    const whiteColor = new THREE.Color(0xffffff);
    for (let i = 0; i < fiberCables.length; i++) {
      const cable = fiberCables[i];

      // Harmonic breathing glow: subtle sinusoidal modulation
      const breath = Math.sin(pulseTime * 2.6 + i * 0.5) * 0.08;

      // Exponential acoustic burst relaxation
      if (cable.burstIntensity > 0.005) {
        cable.burstIntensity *= 0.91; // decays smoothly in ~0.5s
      } else {
        cable.burstIntensity = 0;
      }

      // Dynamic opacity
      const finalOpacity = Math.min(1.0, Math.max(0.35, cable.baseOpacity + breath + cable.burstIntensity * 0.35));
      cable.auraMat.opacity = finalOpacity;

      // Flare color towards brilliant white-cyan when excited by acoustic waves
      if (cable.burstIntensity > 0) {
        cable.auraMat.color.copy(cable.baseColor).lerp(whiteColor, Math.min(1.0, cable.burstIntensity * 0.75));
        const s = 1.0 + cable.burstIntensity * 0.35;
        cable.auraMesh.scale.set(s, 1.0, s);
      } else {
        cable.auraMat.color.copy(cable.baseColor);
        cable.auraMesh.scale.set(1.0, 1.0, 1.0);
      }
    }

    // 2. Animate Dynamic Microseismicity (Appearing and Disappearing Fractures)
    if (seismogenicParticles && dynamicEvents.length > 0) {
      const posAttr = seismogenicParticles.geometry.attributes.position;
      const colAttr = seismogenicParticles.geometry.attributes.color;
      let needsUpdate = false;

      // Periodic natural fracture trigger: spawns 1-2 new microevents organically
      if (Math.random() < 0.09) {
        const deadEvents = dynamicEvents.filter(e => !e.active);
        if (deadEvents.length > 0) {
          const ev = deadEvents[Math.floor(Math.random() * deadEvents.length)];
          ev.active = true;
          ev.age = 0;
          ev.lifespan = 1.0 + Math.random() * 1.8;
          // Acoustic wavefield excites nearby fiber channels in real time
          if (activeMode === 'dfos') {
            triggerFiberAcousticReaction(ev.homePos, 0.75);
          }
        }
      }

      for (let i = 0; i < dynamicEvents.length; i++) {
        const ev = dynamicEvents[i];
        if (ev.active) {
          ev.age += 0.022;
          const progress = ev.age / ev.lifespan;

          if (progress < 1.0) {
            posAttr.setXYZ(i, ev.homePos.x, ev.homePos.y, ev.homePos.z);

            // Initial explosive fracture flash (first 18% of life)
            if (progress < 0.18) {
              const flashIntensity = 1.0 - (progress / 0.18) * 0.25;
              colAttr.setXYZ(
                i,
                ev.flashColor.r * flashIntensity,
                ev.flashColor.g * flashIntensity,
                ev.flashColor.b * flashIntensity
              );
            } else {
              // Smooth acoustic radiation decay to extinction
              const decay = Math.pow(1.0 - ((progress - 0.18) / 0.82), 1.5);
              colAttr.setXYZ(
                i,
                ev.baseColor.r * decay,
                ev.baseColor.g * decay,
                ev.baseColor.b * decay
              );
            }
          } else {
            // Fracture finished, hide below ground until next rupture
            ev.active = false;
            posAttr.setXYZ(i, ev.homePos.x, -999, ev.homePos.z);
            colAttr.setXYZ(i, 0, 0, 0);
          }
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
      }
    }

    // 3. Shockwave expansion
    if (shockwaveActive && shockwaveMesh) {
      shockwaveRadius += 0.35;
      shockwaveMesh.scale.set(shockwaveRadius, shockwaveRadius, shockwaveRadius);
      shockwaveMesh.material.opacity = Math.max(0, 0.9 - (shockwaveRadius / 18));

      // As wavefront expands, excite fiber cables intersected by the wave
      if (activeMode === 'dfos') {
        for (let i = 0; i < fiberCables.length; i++) {
          const cable = fiberCables[i];
          for (let j = 0; j < cable.samplePoints.length; j += 3) {
            const d = cable.samplePoints[j].distanceTo(shockwaveMesh.position);
            if (Math.abs(d - shockwaveRadius) < 0.9) {
              const pulse = 0.7 * (1.0 - shockwaveRadius / 18);
              cable.burstIntensity = Math.max(cable.burstIntensity, pulse);
            }
          }
        }
      }

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
