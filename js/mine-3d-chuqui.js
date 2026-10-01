/* ============================================================
   FIBERANDES — Modelo 3D Interactivo: Caving & Monitoreo Sísmico
   Inspirado en el esquema de Caving Andino:
   - Relieve de montaña andina en superficie (glacier blue / cordillera)
   - Chimenea / Columna de caving vertical central
   - Plataformas horizontales de explotación (niveles de producción e infraestructura)
   - Geófonos tradicionales en los niveles inferiores de explotación
   - Cables DAS que van de arriba a abajo (cobertura vertical y volumétrica continua)
   - Modo Video con giro continuo 360° suave (turntable)
   ============================================================ */
(function() {
  'use strict';

  const container = document.getElementById('mine-3d-canvas-container');
  if (!container) return;

  // Clear container
  container.innerHTML = '';

  // Verify Three.js
  if (typeof THREE === 'undefined') {
    container.innerHTML = '<div style="color:var(--cyan); padding:40px; text-align:center; font-family:var(--font-mono);">Cargando motor 3D Three.js...</div>';
    return;
  }

  // Simulation State
  let activeMode = 'geophones'; // 'geophones' (default) or 'dfos' (DAS active)
  let dasCoverageAmount = 0.0;  // 0.0 = Traditional (Geophones only), 1.0 = DAS full coverage
  let dasCoverageTarget = 0.0;
  let isAutoRotating = true;   // Modo video / giro continuo 360°

  let scene, camera, renderer, controls;
  let animId = null;
  let time = 0;

  // Scene Groups
  const groupWorld = new THREE.Group(); // Root group for smooth 360 rotation
  const groupMountain = new THREE.Group();
  const groupFunnel = new THREE.Group();
  const groupLevels = new THREE.Group();
  const groupGeophones = new THREE.Group();
  const groupDasCables = new THREE.Group();
  const groupBlindZone = new THREE.Group();
  const groupWaves = new THREE.Group();
  const groupLabels = new THREE.Group();

  let blindMeshTop = null;
  let blindMeshHatch = null;
  let dasEnvelope = null;

  // Cables & Photon Pulses
  const fiberCablesData = [];
  const photonPulses = [];

  // Active Seismic Waves
  let activeWaves = [];

  // Interactive Raycasting
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const interactiveMeshes = [];

  // Elevation Coordinates
  // Mountain peaks: Y = +7 to +12
  // Mountain base: Y = +4.5
  // Upper colored blocks: Y = +2.5 and +1.2
  // Exploitation Level 1 (Lift 1): Y = -3.2 (Beige platform)
  // Exploitation Level 2 (Lift 2 / Haulage): Y = -7.0 (Grey platform)
  // Deep base: Y = -11.0
  const Y_MOUNTAIN_BASE = 4.5;
  const Y_EXP_LEVEL_1 = -3.2;
  const Y_EXP_LEVEL_2 = -7.0;
  const Y_DEEP_BASE = -10.5;

  function init() {
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 560;

    // 1. Scene & Renderer
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040711);
    scene.fog = new THREE.FogExp2(0x040711, 0.012);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    container.appendChild(renderer.domElement);

    // 2. Camera Setup (Angled aerial perspective like reference image)
    camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 400);
    camera.position.set(28, 16, 32);

    // 3. OrbitControls
    if (typeof THREE.OrbitControls !== 'undefined') {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.target.set(0, -1.5, 0);
      controls.minDistance = 14;
      controls.maxDistance = 120;
      controls.maxPolarAngle = Math.PI / 2 + 0.15;
    }

    // 4. Lighting
    const ambLight = new THREE.AmbientLight(0x22334d, 1.8);
    scene.add(ambLight);

    // Main Sun Light sculpting mountain peaks
    const sunLight = new THREE.DirectionalLight(0xe8f2ff, 1.6);
    sunLight.position.set(30, 45, 25);
    scene.add(sunLight);

    // Cyan Rim Light for futuristic aesthetic
    const rimLight = new THREE.DirectionalLight(0x00f0ff, 0.9);
    rimLight.position.set(-25, -5, -20);
    scene.add(rimLight);

    // Interior Warm Mining Lighting for lower levels
    const warmLight = new THREE.PointLight(0xffaa20, 2.0, 35);
    warmLight.position.set(0, Y_EXP_LEVEL_1 + 1, 0);
    scene.add(warmLight);

    // 5. Build 3D Model Elements (Inspired by user image)
    buildAndeanMountainSurface();
    buildCentralCavingFunnel();
    buildHorizontalExploitationLevels();
    buildTraditionalGeophones();
    buildVerticalDasCables();
    buildRedBlindZone();
    buildFloatingLabels();

    groupWorld.add(groupMountain);
    groupWorld.add(groupFunnel);
    groupWorld.add(groupLevels);
    groupWorld.add(groupGeophones);
    groupWorld.add(groupDasCables);
    groupWorld.add(groupBlindZone);
    groupWorld.add(groupWaves);
    groupWorld.add(groupLabels);

    scene.add(groupWorld);

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('click', onCanvasClick);
    setupUIControls();

    // Start in Geophones mode
    setMode('geophones');

    // Run animation
    animate();
  }

  // -------------------------------------------------------------
  // 1. RELIEVE DE MONTAÑA ANDINA EN SUPERFICIE
  // Esculpido con picos y cordillera en tono azul glaciar / slate
  // -------------------------------------------------------------
  function buildAndeanMountainSurface() {
    const geo = new THREE.PlaneGeometry(38, 38, 48, 48);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      // Distance from center funnel
      const distFromCenter = Math.hypot(x, z);

      // Mountain mountain ridges & peaks
      let elevation = 0;
      // High background ridge
      elevation += Math.sin(x * 0.16 + 1.2) * 2.8;
      elevation += Math.cos(z * 0.14 - 0.8) * 3.2;
      // Secondary rugged peaks
      elevation += Math.sin(x * 0.35) * Math.cos(z * 0.32) * 1.8;
      // Micro ruggedness
      elevation += (Math.sin(x * 0.8) * Math.sin(z * 0.7)) * 0.6;

      // Base elevation + dip towards center crater
      const centerDip = Math.max(0, 1.0 - (distFromCenter / 7.5)) * 3.5;
      const finalY = Y_MOUNTAIN_BASE + 2.5 + elevation - centerDip;

      pos.setY(i, finalY);
    }
    geo.computeVertexNormals();

    // Glacier Blue / Andesite Material (as in user image)
    const mountainMat = new THREE.MeshStandardMaterial({
      color: 0x4a7e9e,
      roughness: 0.65,
      metalness: 0.2,
      side: THREE.DoubleSide,
      flatShading: false
    });

    const mountainMesh = new THREE.Mesh(geo, mountainMat);
    mountainMesh.userData = { name: 'Superficie de Montaña Andina · Cordillera' };
    groupMountain.add(mountainMesh);
    interactiveMeshes.push(mountainMesh);

    // Subtle cyan wireframe overlay on the mountain crests
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.12
    });
    const wireMesh = new THREE.Mesh(geo, wireMat);
    groupMountain.add(wireMesh);
  }

  // -------------------------------------------------------------
  // 2. COLUMNA / CHIMENEA DE CAVING CENTRAL VERTICAL
  // Embudo paraboloide translúcido que baja desde la montaña
  // -------------------------------------------------------------
  function buildCentralCavingFunnel() {
    const height = Y_MOUNTAIN_BASE + 1.5 - Y_DEEP_BASE;
    const funnelGeo = new THREE.CylinderGeometry(5.8, 2.2, height, 36, 18, true);

    // Smooth bell-shaped contour
    const pos = funnelGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = (y + height / 2) / height; // 0 (bottom) to 1 (top)
      const radiusScale = 1.0 + Math.pow(t, 2.2) * 0.45;
      pos.setX(i, pos.getX(i) * radiusScale);
      pos.setZ(i, pos.getZ(i) * radiusScale);
    }
    funnelGeo.computeVertexNormals();

    const funnelMat = new THREE.MeshStandardMaterial({
      color: 0x68b6d8,
      emissive: 0x1a4565,
      emissiveIntensity: 0.4,
      roughness: 0.35,
      metalness: 0.25,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    const funnelMesh = new THREE.Mesh(funnelGeo, funnelMat);
    funnelMesh.position.set(0, (Y_MOUNTAIN_BASE + 1.5 + Y_DEEP_BASE) / 2, 0);
    funnelMesh.userData = { name: 'Columna / Chimenea de Caving · Macizo Mineralizado' };
    groupFunnel.add(funnelMesh);
    interactiveMeshes.push(funnelMesh);

    // Wireframe contour lines along the funnel
    const funnelEdges = new THREE.EdgesGeometry(funnelGeo);
    const funnelLines = new THREE.LineSegments(funnelEdges, new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.28
    }));
    funnelLines.position.copy(funnelMesh.position);
    groupFunnel.add(funnelLines);
  }

  // -------------------------------------------------------------
  // 3. PLATAFORMAS HORIZONTALES (NIVELES DE EXPLOTACIÓN)
  // Niveles superiores coloreados + Losas inferiores de producción
  // -------------------------------------------------------------
  function buildHorizontalExploitationLevels() {
    // A. Upper Colored Mining Slabs (as in user image: Red, Green, Blue, Yellow blocks)
    const upperBlocks = [
      { x: 3.5, y: 2.2, z: -2.5, w: 5.5, d: 3.8, h: 0.6, color: 0xd93829, name: 'Cuerpo Mineralizado Superior (Rojo)' },
      { x: 4.2, y: 1.2, z: 2.0, w: 6.2, d: 4.5, h: 0.6, color: 0x2ba84a, name: 'Sector de Explotación Inicial (Verde)' },
      { x: -3.8, y: 2.0, z: -3.0, w: 4.8, d: 3.5, h: 0.6, color: 0x1e60d0, name: 'Sector Norte (Azul)' },
      { x: 4.5, y: 2.6, z: 0.5, w: 2.5, d: 2.0, h: 0.5, color: 0xd4a017, name: 'Sub-bloque de Alta Ley (Amarillo)' }
    ];

    upperBlocks.forEach(b => {
      const mat = new THREE.MeshStandardMaterial({
        color: b.color,
        roughness: 0.5,
        metalness: 0.2
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mat);
      mesh.position.set(b.x, b.y, b.z);
      mesh.userData = { name: b.name };
      groupLevels.add(mesh);
      interactiveMeshes.push(mesh);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 })
      );
      edges.position.copy(mesh.position);
      groupLevels.add(edges);
    });

    // B. Main Exploitation Footprint Platform 1 (Lift 1, Beige/Cream slab like image)
    const slab1Geo = new THREE.BoxGeometry(24, 0.75, 18);
    const slab1Mat = new THREE.MeshStandardMaterial({
      color: 0xd9ceb8,
      roughness: 0.75,
      metalness: 0.15
    });
    const slab1Mesh = new THREE.Mesh(slab1Geo, slab1Mat);
    slab1Mesh.position.set(0, Y_EXP_LEVEL_1, 0);
    slab1Mesh.userData = { name: 'Nivel Principal de Explotación (Lift 1) · Galerías de Producción' };
    groupLevels.add(slab1Mesh);
    interactiveMeshes.push(slab1Mesh);

    const slab1Edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(slab1Geo),
      new THREE.LineBasicMaterial({ color: 0x5a5242, transparent: true, opacity: 0.7 })
    );
    slab1Edges.position.copy(slab1Mesh.position);
    groupLevels.add(slab1Edges);

    // C. Lower Infrastructure & Haulage Platform 2 (Grey slab like image)
    const slab2Geo = new THREE.BoxGeometry(26, 0.85, 20);
    const slab2Mat = new THREE.MeshStandardMaterial({
      color: 0x8a929d,
      roughness: 0.78,
      metalness: 0.2
    });
    const slab2Mesh = new THREE.Mesh(slab2Geo, slab2Mat);
    slab2Mesh.position.set(0, Y_EXP_LEVEL_2, 0);
    slab2Mesh.userData = { name: 'Nivel de Transporte e Infraestructura (Lift 2) · Acarreo y Chancado' };
    groupLevels.add(slab2Mesh);
    interactiveMeshes.push(slab2Mesh);

    const slab2Edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(slab2Geo),
      new THREE.LineBasicMaterial({ color: 0x3d434d, transparent: true, opacity: 0.7 })
    );
    slab2Edges.position.copy(slab2Mesh.position);
    groupLevels.add(slab2Edges);
  }

  // -------------------------------------------------------------
  // 4. GEÓFONOS TRADICIONALES EN NIVELES DE EXPLOTACIÓN (ABAJO)
  // Estaciones discretas confinadas en los planos horizontales
  // -------------------------------------------------------------
  const geophoneStations = [];
  function buildTraditionalGeophones() {
    const geoMat = new THREE.MeshStandardMaterial({
      color: 0xffb020,
      emissive: 0x995500,
      emissiveIntensity: 0.7,
      roughness: 0.2,
      metalness: 0.5
    });

    const geoSphereMat = new THREE.MeshBasicMaterial({
      color: 0xffb020,
      wireframe: true,
      transparent: true,
      opacity: 0.12
    });

    // Geophones are installed ONLY in the lower exploitation levels
    const coords = [
      // Level 1 (Lift 1, Y = -3.2)
      { x: -7.5, y: Y_EXP_LEVEL_1 + 0.6, z: -5.5, id: 'G-L1-01' },
      { x: 0.0, y: Y_EXP_LEVEL_1 + 0.6, z: -6.5, id: 'G-L1-02' },
      { x: 7.5, y: Y_EXP_LEVEL_1 + 0.6, z: -5.5, id: 'G-L1-03' },
      { x: -8.0, y: Y_EXP_LEVEL_1 + 0.6, z: 0.0, id: 'G-L1-04' },
      { x: 8.0, y: Y_EXP_LEVEL_1 + 0.6, z: 0.0, id: 'G-L1-05' },
      { x: -7.5, y: Y_EXP_LEVEL_1 + 0.6, z: 5.5, id: 'G-L1-06' },
      { x: 0.0, y: Y_EXP_LEVEL_1 + 0.6, z: 6.5, id: 'G-L1-07' },
      { x: 7.5, y: Y_EXP_LEVEL_1 + 0.6, z: 5.5, id: 'G-L1-08' },
      // Level 2 (Transporte, Y = -7.0)
      { x: -9.0, y: Y_EXP_LEVEL_2 + 0.6, z: -6.5, id: 'G-L2-01' },
      { x: 9.0, y: Y_EXP_LEVEL_2 + 0.6, z: -6.5, id: 'G-L2-02' },
      { x: -9.0, y: Y_EXP_LEVEL_2 + 0.6, z: 6.5, id: 'G-L2-03' },
      { x: 9.0, y: Y_EXP_LEVEL_2 + 0.6, z: 6.5, id: 'G-L2-04' }
    ];

    coords.forEach(c => {
      // Golden cube sensor
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), geoMat);
      cube.position.set(c.x, c.y, c.z);
      cube.userData = { name: `Geófono Triaxial ${c.id} · Confinado en Nivel de Explotación (-300 m alcance)` };
      groupGeophones.add(cube);
      geophoneStations.push({ mesh: cube, ...c });
      interactiveMeshes.push(cube);

      // Sensitivity lobe sphere (300m range ~ 5.5 units)
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(5.2, 14, 10), geoSphereMat);
      lobe.position.copy(cube.position);
      groupGeophones.add(lobe);
    });
  }

  // -------------------------------------------------------------
  // 5. CABLES FIBERANDES DAS QUE VAN DE ARRIBA A ABAJO
  // Fibras continuas que descienden desde la superficie de la montaña
  // atravesando toda la columna vertical hasta las profundidades
  // -------------------------------------------------------------
  function buildVerticalDasCables() {
    const fiberMatCyan = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      linewidth: 3,
      transparent: true,
      opacity: 0.95
    });
    const fiberMatGreen = new THREE.LineBasicMaterial({
      color: 0x00ffa3,
      linewidth: 3,
      transparent: true,
      opacity: 0.95
    });

    // 6 Vertical fibers descending from mountain crest down into the mine
    const cableTrajectories = [
      // Cable 1: Flanco Oeste Vertical (Superficie -> Fondo)
      [
        new THREE.Vector3(-8.5, Y_MOUNTAIN_BASE + 4.5, -6),
        new THREE.Vector3(-6.5, Y_MOUNTAIN_BASE, -4),
        new THREE.Vector3(-5.2, 0, -2.5),
        new THREE.Vector3(-4.2, Y_EXP_LEVEL_1, -1.5),
        new THREE.Vector3(-3.2, Y_EXP_LEVEL_2, -1.0),
        new THREE.Vector3(-2.5, Y_DEEP_BASE, 0)
      ],
      // Cable 2: Flanco Este Vertical (Superficie -> Fondo)
      [
        new THREE.Vector3(8.5, Y_MOUNTAIN_BASE + 3.8, 6),
        new THREE.Vector3(6.8, Y_MOUNTAIN_BASE, 4),
        new THREE.Vector3(5.2, 0, 2.5),
        new THREE.Vector3(4.2, Y_EXP_LEVEL_1, 1.5),
        new THREE.Vector3(3.2, Y_EXP_LEVEL_2, 1.0),
        new THREE.Vector3(2.5, Y_DEEP_BASE, 0)
      ],
      // Cable 3: Central Norte (Atravesando la columna verticalmente)
      [
        new THREE.Vector3(0, Y_MOUNTAIN_BASE + 2.0, -7.5),
        new THREE.Vector3(0, Y_MOUNTAIN_BASE - 1.0, -4.5),
        new THREE.Vector3(0, 0, -2.5),
        new THREE.Vector3(0, Y_EXP_LEVEL_1, -1.8),
        new THREE.Vector3(0, Y_EXP_LEVEL_2, -1.2),
        new THREE.Vector3(0, Y_DEEP_BASE, 0)
      ],
      // Cable 4: Central Sur (Atravesando la columna verticalmente)
      [
        new THREE.Vector3(0, Y_MOUNTAIN_BASE + 2.2, 7.5),
        new THREE.Vector3(0, Y_MOUNTAIN_BASE - 1.0, 4.5),
        new THREE.Vector3(0, 0, 2.5),
        new THREE.Vector3(0, Y_EXP_LEVEL_1, 1.8),
        new THREE.Vector3(0, Y_EXP_LEVEL_2, 1.2),
        new THREE.Vector3(0, Y_DEEP_BASE, 0)
      ],
      // Cable 5: Lazo Perimetral en Daisy-Chain (Nivel 1 & 2)
      [
        new THREE.Vector3(-10, Y_EXP_LEVEL_1 + 0.2, -7),
        new THREE.Vector3(10, Y_EXP_LEVEL_1 + 0.2, -7),
        new THREE.Vector3(10, Y_EXP_LEVEL_1 + 0.2, 7),
        new THREE.Vector3(-10, Y_EXP_LEVEL_1 + 0.2, 7),
        new THREE.Vector3(-10, Y_EXP_LEVEL_1 + 0.2, -7)
      ],
      // Cable 6: Lazo Perimetral en Daisy-Chain (Nivel 2)
      [
        new THREE.Vector3(-11, Y_EXP_LEVEL_2 + 0.2, -8),
        new THREE.Vector3(11, Y_EXP_LEVEL_2 + 0.2, -8),
        new THREE.Vector3(11, Y_EXP_LEVEL_2 + 0.2, 8),
        new THREE.Vector3(-11, Y_EXP_LEVEL_2 + 0.2, 8),
        new THREE.Vector3(-11, Y_EXP_LEVEL_2 + 0.2, -8)
      ]
    ];

    cableTrajectories.forEach((pts, idx) => {
      const curve = new THREE.CatmullRomCurve3(pts);
      const curveGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(60));
      const color = idx % 2 === 0 ? 0x00f0ff : 0x00ffa3;
      const mat = idx % 2 === 0 ? fiberMatCyan : fiberMatGreen;
      const line = new THREE.Line(curveGeo, mat);
      groupDasCables.add(line);

      fiberCablesData.push({
        curve,
        color,
        speed: 0.12 + (idx * 0.02)
      });
    });

    // Photon laser pulse particles running along cables from top to bottom
    for (let i = 0; i < 32; i++) {
      const pMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      groupDasCables.add(pMesh);
      photonPulses.push({
        mesh: pMesh,
        cableIdx: i % fiberCablesData.length,
        progress: (i * 0.12) % 1.0
      });
    }

    // Volumetric 100% DAS Cyan Envelope
    const envGeo = new THREE.CylinderGeometry(6.5, 3.0, Y_MOUNTAIN_BASE + 3 - Y_DEEP_BASE, 28, 6, true);
    const envMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.0
    });
    dasEnvelope = new THREE.Mesh(envGeo, envMat);
    dasEnvelope.position.set(0, (Y_MOUNTAIN_BASE + 3 + Y_DEEP_BASE) / 2, 0);
    groupDasCables.add(dasEnvelope);
  }

  // -------------------------------------------------------------
  // 6. ÁREA ROJA CIEGA FUERA DE ALCANCE (>300 m DE LOS TÚNELES)
  // Domina la parte superior de la columna cuando solo hay geófonos
  // -------------------------------------------------------------
  function buildRedBlindZone() {
    const blindHeight = Y_MOUNTAIN_BASE + 2.0 - Y_EXP_LEVEL_1;
    const blindGeo = new THREE.CylinderGeometry(6.2, 4.2, blindHeight, 32);

    const blindMat = new THREE.MeshStandardMaterial({
      color: 0xff2020,
      emissive: 0x990000,
      emissiveIntensity: 0.45,
      roughness: 0.5,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });

    blindMeshTop = new THREE.Mesh(blindGeo, blindMat);
    blindMeshTop.position.set(0, (Y_MOUNTAIN_BASE + 2.0 + Y_EXP_LEVEL_1) / 2, 0);
    blindMeshTop.userData = { name: '🔴 Área Roja Fuera de Alcance (>300 m de túneles) · Geófonos Ciegos en la Corona' };
    groupBlindZone.add(blindMeshTop);
    interactiveMeshes.push(blindMeshTop);

    // Red warning wireframe contour
    const hatchEdges = new THREE.EdgesGeometry(blindGeo);
    blindMeshHatch = new THREE.LineSegments(hatchEdges, new THREE.LineBasicMaterial({
      color: 0xff4b55,
      transparent: true,
      opacity: 0.85
    }));
    blindMeshHatch.position.copy(blindMeshTop.position);
    groupBlindZone.add(blindMeshHatch);
  }

  // -------------------------------------------------------------
  // 7. ETIQUETAS FLOTANTES 3D (CANVAS SPRITES)
  // -------------------------------------------------------------
  function makeSprite(text, color = '#00f0ff', bgColor = 'rgba(4, 10, 20, 0.88)') {
    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 68;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = bgColor;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(4, 4, 352, 60, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = 'bold 19px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 180, 34);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
    sprite.scale.set(6.2, 1.2, 1);
    return sprite;
  }

  function buildFloatingLabels() {
    const spMount = makeSprite('SUPERFICIE CORDILLERA', '#7dc4ea');
    spMount.position.set(0, Y_MOUNTAIN_BASE + 5.5, 0);
    groupLabels.add(spMount);

    const spLevels = makeSprite('NIVELES DE EXPLOTACIÓN', '#e2d5bd');
    spLevels.position.set(13, Y_EXP_LEVEL_1, 0);
    groupLabels.add(spLevels);

    const spGeos = makeSprite('GEÓFONOS (CONFINADOS ABAJO)', '#ffb020');
    spGeos.position.set(-13, Y_EXP_LEVEL_1, 0);
    groupLabels.add(spGeos);
  }

  // -------------------------------------------------------------
  // 8. PROPAGACIÓN DE ONDAS SÍSMICAS
  // -------------------------------------------------------------
  function triggerSeismicEvent(x, y, z, zone = 'top') {
    const wave = {
      x, y, z,
      radiusP: 0.1,
      radiusS: 0.05,
      speedP: 0.26,
      speedS: 0.15,
      maxRadius: 15.0,
      zone,
      meshP: null,
      meshS: null
    };

    // P-wave sphere (cyan/white)
    const pMat = new THREE.MeshBasicMaterial({
      color: dasCoverageAmount > 0.5 ? 0x00f0ff : 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.85
    });
    wave.meshP = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), pMat);
    wave.meshP.position.set(x, y, z);
    groupWaves.add(wave.meshP);

    // S-wave sphere (amber)
    const sMat = new THREE.MeshBasicMaterial({
      color: 0xffaa20,
      wireframe: true,
      transparent: true,
      opacity: 0.75
    });
    wave.meshS = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), sMat);
    wave.meshS.position.set(x, y, z);
    groupWaves.add(wave.meshS);

    activeWaves.push(wave);

    // Dynamic Banner Reaction
    const banner = document.getElementById('sim-status-banner');
    if (!banner) return;

    if (dasCoverageAmount > 0.5) {
      // DAS COBERTURA VERTICAL TOTAL
      banner.className = 'sim-status-banner detected';
      if (zone === 'top') {
        banner.innerHTML = '<strong>⚡ FRACTURA EN COLUMNA SUPERIOR CAPTURADA POR CABLE DAS</strong> — Registro acústico directo por la fibra vertical que desciende desde la superficie · Cero atenuación';
      } else {
        banner.innerHTML = '<strong>⚡ EVENTO EN NIVEL DE EXPLOTACIÓN CAPTURADO</strong> — Localización instantánea al metro exacto mediante la red en cascada · Sin puntos ciegos';
      }
    } else {
      // GEÓFONOS CONFINADOS ABAJO
      if (zone === 'top' || y > Y_EXP_LEVEL_1 + 3.0) {
        banner.className = 'sim-status-banner blindspot';
        banner.innerHTML = '<strong>❌ ONDA ATENUADA EN ZONA CIEGA SUPERIOR (>300 m)</strong> — Los geófonos están confinados abajo y no captan el sismo en la corona · <strong>Haz clic en "Cables DAS (De Arriba a Abajo)" para conectarlo</strong>';
      } else {
        banner.className = 'sim-status-banner detected';
        banner.innerHTML = '<strong>⚠️ DETECCIÓN PARCIAL POR GEÓFONOS EN TÚNELES</strong> — Capturado cerca de la plataforma pero con alta incertidumbre hipocentral (±26 m)';
      }
    }
  }

  // -------------------------------------------------------------
  // 9. MODO SWITCH & ANIMACIÓN
  // -------------------------------------------------------------
  function setMode(mode) {
    activeMode = mode;
    dasCoverageTarget = (mode === 'dfos') ? 1.0 : 0.0;
    const banner = document.getElementById('sim-status-banner');

    if (mode === 'dfos') {
      if (banner) {
        banner.className = 'sim-status-banner detected';
        banner.innerHTML = '<strong>⚡ CABLES FIBERANDES DAS DESPLEGADOS (DE ARRIBA A ABAJO)</strong> — Los cables ópticos verticales conectan la superficie con el fondo eliminando la zona ciega superior · 100% Cobertura Volumétrica';
      }
    } else {
      if (banner) {
        banner.className = 'sim-status-banner blindspot';
        banner.innerHTML = '<strong>📡 RED TRADICIONAL (GEÓFONOS EN NIVELES DE EXPLOTACIÓN)</strong> — Sensores confinados abajo dejan un <strong>área roja ciega masiva en la parte superior</strong> · Haz clic en <em>"Cables DAS (De Arriba a Abajo)"</em>';
      }
    }
  }

  function updateTelemetry(cov, sensors, uncert, status) {
    const elCov = document.getElementById('tel-val-cov');
    const elSens = document.getElementById('tel-val-sens');
    const elUncert = document.getElementById('tel-val-uncert');
    const elStrain = document.getElementById('tel-val-strain');

    if (elCov) elCov.textContent = cov + '%';
    if (elSens) elSens.textContent = sensors;
    if (elUncert) elUncert.textContent = uncert;
    if (elStrain) elStrain.textContent = status;
  }

  // -------------------------------------------------------------
  // 10. CONTROLES UI & MODO VIDEO
  // -------------------------------------------------------------
  function setupUIControls() {
    const btnDfos = document.getElementById('btn-mode-dfos');
    const btnEsi = document.getElementById('btn-mode-esi');
    const btnSimEvent = document.getElementById('btn-sim-caveback') || document.getElementById('btn-simulate-event');
    const btnSimLevel = document.getElementById('btn-sim-rockburst');
    const btnRotate = document.getElementById('btn-cam-general') || document.getElementById('btn-mode-rotate');

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

    // Trigger Fracture Event in Upper Column (Top blind zone)
    if (btnSimEvent) {
      btnSimEvent.addEventListener('click', () => {
        triggerSeismicEvent(0, Y_MOUNTAIN_BASE - 1.2, 0, 'top');
      });
    }

    // Trigger Fracture in Lower Exploitation Level
    if (btnSimLevel) {
      btnSimLevel.addEventListener('click', () => {
        triggerSeismicEvent(4.5, Y_EXP_LEVEL_1 + 0.5, 2.0, 'level');
      });
    }

    // Modo Video (Auto-rotate toggle)
    if (btnRotate) {
      btnRotate.addEventListener('click', () => {
        isAutoRotating = !isAutoRotating;
        btnRotate.innerHTML = isAutoRotating ? '⏸ Pausar Giro' : '▶ Reproducir Giro 360°';
      });
    }
  }

  function onMouseMove(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactiveMeshes, false);

    const hudText = document.getElementById('sim-hud-text');
    if (intersects.length > 0 && hudText) {
      const obj = intersects[0].object;
      if (obj.userData && obj.userData.name) {
        hudText.innerHTML = `📍 <strong>${obj.userData.name}</strong>`;
      }
    }
  }

  function onCanvasClick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactiveMeshes, false);

    if (intersects.length > 0) {
      const p = intersects[0].point;
      const zone = p.y > Y_EXP_LEVEL_1 + 2.0 ? 'top' : 'level';
      triggerSeismicEvent(p.x, p.y, p.z, zone);
    }
  }

  function onWindowResize() {
    if (!renderer || !camera || !container) return;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 560;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  // -------------------------------------------------------------
  // 11. ANIMATION LOOP (MODO VIDEO 360 + DINÁMICA DAS)
  // -------------------------------------------------------------
  function animate() {
    animId = requestAnimationFrame(animate);
    time += 0.02;

    if (controls) controls.update();

    // Modo Video: Giro continuo suave 360°
    if (isAutoRotating) {
      groupWorld.rotation.y += 0.004;
    }

    // Smooth DAS Coverage Interpolation
    dasCoverageAmount += (dasCoverageTarget - dasCoverageAmount) * 0.055;
    if (Math.abs(dasCoverageTarget - dasCoverageAmount) < 0.003) {
      dasCoverageAmount = dasCoverageTarget;
    }

    // Dynamic Telemetry
    const curCov = Math.round(35 + dasCoverageAmount * 64);
    const curSens = dasCoverageAmount > 0.5 ? '12.000 Canales DAS (De Arriba a Abajo)' : '12 Geófonos en Niveles de Explotación';
    const curUncert = (26.0 - dasCoverageAmount * 24.5).toFixed(1) + ' m';
    const curStatus = dasCoverageAmount > 0.5 ? 'Cero Puntos Ciegos (100% Activo)' : 'Zona Roja Ciega Superior (>300 m)';
    updateTelemetry(curCov, curSens, '±' + curUncert, curStatus);

    // Shrink Red Blind Zone when DAS activates
    const blindFactor = 1.0 - dasCoverageAmount;
    if (blindMeshTop) {
      blindMeshTop.scale.set(1.0, Math.max(0.001, blindFactor), 1.0);
      blindMeshTop.material.opacity = 0.35 * blindFactor;
    }
    if (blindMeshHatch) {
      blindMeshHatch.scale.set(1.0, Math.max(0.001, blindFactor), 1.0);
      blindMeshHatch.material.opacity = 0.85 * blindFactor;
    }

    // Expand Cyan DAS Envelope
    if (dasEnvelope) {
      dasEnvelope.material.opacity = 0.22 * dasCoverageAmount;
    }

    // DAS Cables Glow & Photon Pulses
    groupDasCables.children.forEach(c => {
      if (c.material && c !== dasEnvelope) {
        c.material.opacity = Math.max(0.15, dasCoverageAmount);
      }
    });

    if (dasCoverageAmount > 0.2) {
      photonPulses.forEach(pp => {
        pp.progress = (pp.progress + 0.009) % 1.0;
        const cable = fiberCablesData[pp.cableIdx];
        if (cable && cable.curve) {
          const pt = cable.curve.getPointAt(pp.progress);
          pp.mesh.position.copy(pt);
          pp.mesh.visible = true;
        }
      });
    } else {
      photonPulses.forEach(pp => { pp.mesh.visible = false; });
    }

    // Animate Seismic Waves
    for (let i = activeWaves.length - 1; i >= 0; i--) {
      const w = activeWaves[i];
      w.radiusP += w.speedP;
      w.radiusS += w.speedS;

      const atten = Math.max(0, 1.0 - (w.radiusP / w.maxRadius));
      if (w.meshP) {
        w.meshP.scale.set(w.radiusP, w.radiusP, w.radiusP);
        w.meshP.material.opacity = atten * 0.85;
      }
      if (w.meshS) {
        w.meshS.scale.set(w.radiusS, w.radiusS, w.radiusS);
        w.meshS.material.opacity = atten * 0.75;
      }

      if (atten <= 0.02 || w.radiusP >= w.maxRadius) {
        if (w.meshP) groupWaves.remove(w.meshP);
        if (w.meshS) groupWaves.remove(w.meshS);
        activeWaves.splice(i, 1);
      }
    }

    renderer.render(scene, camera);
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
