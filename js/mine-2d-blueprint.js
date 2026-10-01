/* ============================================================
   FIBERANDES — Simulador Geomecánico 2D: Perfil Técnico de Mina
   Inspirado en el plano de corte transversal minero (Chuquicamata Subterránea):
   - Grilla técnica con cotas de elevación (9300 a 10200 m s.n.m.) y coordenadas (10400 a 11300)
   - Cráter / Rajo de subsidencia superior (Cota 10150 - 10300)
   - Rampa de acceso en zigzag (naranja/coral) descendiendo de 9950 a 9450
   - Nivel de Hundimiento / Explotación horizontal principal en Cota 9800
   - Red sísmica tradicional: Cajas numeradas [1], [2], [3]... [39] confinadas en niveles
   - Despliegue FiberAndes DAS: Cables continuos de ARRIBA A ABAJO + Rampa
   - Modo interactivo: Detección sísmica en tiempo real y reducción del área roja ciega
   ============================================================ */
(function() {
  'use strict';

  const container = document.getElementById('mine-3d-canvas-container');
  if (!container) return;

  // Clear container
  container.innerHTML = '';

  const canvas = document.createElement('canvas');
  canvas.id = 'mine-blueprint-canvas';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.cursor = 'crosshair';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let dpr = 1;

  // External UI elements
  const hudText = document.getElementById('sim-hud-text');
  const statusBanner = document.getElementById('sim-status-banner');
  const telCov = document.getElementById('tel-val-cov');
  const telSens = document.getElementById('tel-val-sens');
  const telUncert = document.getElementById('tel-val-uncert');
  const telStrain = document.getElementById('tel-val-strain');

  // Simulation State
  let activeMode = 'geophones'; // 'geophones' (traditional) or 'dfos' (DAS active)
  let dasCoverageAmount = 0.0;  // 0.0 = Traditional, 1.0 = DAS 100%
  let dasCoverageTarget = 0.0;
  let animId = null;
  let time = 0;

  // Mouse tracking
  let mouseScreenX = -1;
  let mouseScreenY = -1;
  let hoveredStation = null;

  // Active seismic waves
  const activeWaves = [];
  const photonPulses = [];

  // -------------------------------------------------------------
  // 1. SISTEMA DE COORDENADAS MINERAS REALES
  // X: 10300 a 11350 (Easting / Coordenada Local, ancho 1050 m)
  // Y: 9280 a 10340  (Cota de Elevación m s.n.m., alto 1060 m)
  // -------------------------------------------------------------
  const MIN_X = 10300;
  const MAX_X = 11360;
  const MIN_Y = 9260; // Cota más baja
  const MAX_Y = 10340; // Cota más alta (Superficie)

  // Margins for technical frame & coordinate labels
  let padLeft = 60;
  let padRight = 72;
  let padTop = 38;
  let padBottom = 32;

  function toScreenX(mineX) {
    const plotW = width - padLeft - padRight;
    return padLeft + ((mineX - MIN_X) / (MAX_X - MIN_X)) * plotW;
  }

  function toScreenY(mineY) {
    const plotH = height - padTop - padBottom;
    // High elevation (10300) is near top (padTop), low elevation (9300) is near bottom
    return padTop + ((MAX_Y - mineY) / (MAX_Y - MIN_Y)) * plotH;
  }

  function fromScreenX(sX) {
    const plotW = width - padLeft - padRight;
    const ratio = Math.max(0, Math.min(1, (sX - padLeft) / plotW));
    return MIN_X + ratio * (MAX_X - MIN_X);
  }

  function fromScreenY(sY) {
    const plotH = height - padTop - padBottom;
    const ratio = Math.max(0, Math.min(1, (sY - padTop) / plotH));
    return MAX_Y - ratio * (MAX_Y - MIN_Y);
  }

  function resize() {
    const rect = container.getBoundingClientRect();
    width = rect.width || 800;
    height = rect.height || 560;
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }

  window.addEventListener('resize', resize);
  resize();

  // -------------------------------------------------------------
  // 2. ESTACIONES DE GEÓFONOS NUMERADAS (IDÉNTICAS A LA FIGURA)
  // Rectángulos con número de estación en cotas 9700, 9600 y 9460
  // -------------------------------------------------------------
  const geophoneStations = [
    // Subnivel Cota ~9710 - 9730
    { id: 1,  x: 10660, y: 9710, w: 26, h: 18, name: 'Estación 1 · Undercut O' },
    { id: 3,  x: 10735, y: 9735, w: 26, h: 18, name: 'Estación 3 · Rampa Intermedia' },
    { id: 13, x: 10850, y: 9750, w: 26, h: 16, name: 'Estación 13 · Clúster Techo' },
    { id: 12, x: 10885, y: 9750, w: 26, h: 16, name: 'Estación 12 · Clúster Central' },
    { id: 5,  x: 10920, y: 9750, w: 24, h: 16, name: 'Estación 5 · Clúster Techo' },
    { id: 11, x: 10890, y: 9726, w: 26, h: 16, name: 'Estación 11 · Pilar Central' },
    { id: 15, x: 10995, y: 9730, w: 26, h: 18, name: 'Estación 15 · Nivel 9700 E' },
    { id: 9,  x: 11045, y: 9720, w: 26, h: 18, name: 'Estación 9 · Hastial Este' },
    { id: 10, x: 11090, y: 9705, w: 26, h: 18, name: 'Estación 10 · Borde Este 9700' },

    // Subnivel Cota ~9600 - 9635
    { id: 4,  x: 10730, y: 9635, w: 26, h: 18, name: 'Estación 4 · Galería 9600 O' },
    { id: 2,  x: 10730, y: 9605, w: 26, h: 18, name: 'Estación 2 · Piso Nivel 9600 O' },
    { id: 6,  x: 10895, y: 9635, w: 28, h: 20, name: 'Estación 6 · Cámara Central 9600' },
    { id: 16, x: 11025, y: 9630, w: 26, h: 18, name: 'Estación 16 · Galería 9600 E' },
    { id: 7,  x: 11065, y: 9615, w: 24, h: 18, name: 'Estación 7 · Hastial 9600 E' },
    { id: 8,  x: 11110, y: 9595, w: 26, h: 18, name: 'Estación 8 · Extremo Este 9600' },

    // Nivel Transporte Cota ~9450 - 9480
    { id: 20, x: 10600, y: 9460, w: 26, h: 18, name: 'Estación 20 · Rampa Baja 9450' },
    { id: 22, x: 10640, y: 9445, w: 26, h: 18, name: 'Estación 22 · Túnel Acceso Transporte' },
    { id: 23, x: 10680, y: 9455, w: 26, h: 18, name: 'Estación 23 · Acarreo O' },
    { id: 21, x: 10785, y: 9470, w: 26, h: 18, name: 'Estación 21 · Chancado Central' },
    { id: 19, x: 10820, y: 9470, w: 26, h: 18, name: 'Estación 19 · Cámara Transferencia' },
    { id: 38, x: 11035, y: 9480, w: 26, h: 18, name: 'Estación 38 · Buzón Descarga E' },
    { id: 39, x: 11075, y: 9480, w: 26, h: 18, name: 'Estación 39 · Ventilación Baja E' }
  ];

  // -------------------------------------------------------------
  // 3. TRAYECTORIA DE LA RAMPA EN ZIGZAG (Naranja / Coral)
  // Conecta cotas 9960 -> 9420 en el flanco izquierdo
  // -------------------------------------------------------------
  const rampPolyline = [
    { x: 10320, y: 9940 },
    { x: 10420, y: 9900 },
    { x: 10340, y: 9850 },
    { x: 10560, y: 9820 }, // Conexión a Nivel 9800
    { x: 10460, y: 9780 },
    { x: 10540, y: 9740 },
    { x: 10440, y: 9700 },
    { x: 10460, y: 9680 },
    { x: 10360, y: 9620 }, // Lazo hacia el oeste
    { x: 10560, y: 9550 },
    { x: 10420, y: 9470 }, // Lazo bajo
    { x: 10620, y: 9450 }, // Llegada a nivel de acarreo
    { x: 10850, y: 9460 },
    { x: 11090, y: 9470 },
    { x: 10800, y: 9480 },
    { x: 10500, y: 9420 }
  ];

  // -------------------------------------------------------------
  // 4. CABLES FIBERANDES DAS (DE ARRIBA A ABAJO + RAMPA)
  // Fibras continuas que monitorean 100% de la columna
  // -------------------------------------------------------------
  const dasFibers = [
    // Fibra Vertical 1: Flanco Oeste (Superficie Cota 10320 -> Cota 9400)
    {
      id: 'DAS-V01',
      name: 'Fibra Vertical Oeste (Pozo Superficie -> Cota 9400)',
      color: '#00f0ff',
      points: [
        { x: 10500, y: 10320 },
        { x: 10500, y: 10100 },
        { x: 10510, y: 9900 },
        { x: 10520, y: 9700 },
        { x: 10530, y: 9550 },
        { x: 10540, y: 9400 }
      ]
    },
    // Fibra Vertical 2: Borde Central Cráter Oeste -> Profundidad
    {
      id: 'DAS-V02',
      name: 'Fibra Trans-Columna Central (Cráter 10220 -> Cota 9420)',
      color: '#00ffa3',
      points: [
        { x: 10720, y: 10260 },
        { x: 10720, y: 10050 },
        { x: 10730, y: 9880 },
        { x: 10730, y: 9700 },
        { x: 10740, y: 9540 },
        { x: 10740, y: 9420 }
      ]
    },
    // Fibra Vertical 3: Borde Central Cráter Este -> Profundidad
    {
      id: 'DAS-V03',
      name: 'Fibra Trans-Columna Este (Cráter 10240 -> Cota 9420)',
      color: '#00ffa3',
      points: [
        { x: 11060, y: 10280 },
        { x: 11060, y: 10060 },
        { x: 11050, y: 9880 },
        { x: 11050, y: 9700 },
        { x: 11040, y: 9550 },
        { x: 11040, y: 9420 }
      ]
    },
    // Fibra Vertical 4: Flanco Este (Superficie Cota 10320 -> Cota 9400)
    {
      id: 'DAS-V04',
      name: 'Fibra Vertical Este (Pozo Superficie -> Cota 9400)',
      color: '#00f0ff',
      points: [
        { x: 11240, y: 10320 },
        { x: 11230, y: 10100 },
        { x: 11220, y: 9900 },
        { x: 11210, y: 9700 },
        { x: 11200, y: 9550 },
        { x: 11190, y: 9400 }
      ]
    },
    // Fibra 5: Despliegue en Rampa y Niveles (Daisy-Chain continuo)
    {
      id: 'DAS-RAMP',
      name: 'Fibra DAS en Rampa de Acceso & Niveles de Explotación',
      color: '#00ffa3',
      points: rampPolyline
    }
  ];

  // Initialize photon pulses
  dasFibers.forEach((fiber, fIdx) => {
    photonPulses.push({
      fiberIdx: fIdx,
      progress: Math.random(),
      speed: 0.0035 + Math.random() * 0.002
    });
    photonPulses.push({
      fiberIdx: fIdx,
      progress: (Math.random() + 0.5) % 1.0,
      speed: 0.0035 + Math.random() * 0.002
    });
  });

  // -------------------------------------------------------------
  // 5. GEOFÍSICA: ATENUACIÓN SÍSMICA Y ONDAS P & S
  // En roca diaclasada, frecuencias >150 Hz se disipan a ~300 m
  // -------------------------------------------------------------
  function getAttenRadiusPx() {
    // 300 meters in screen pixels
    const p1 = toScreenX(10400);
    const p2 = toScreenX(10700);
    return Math.abs(p2 - p1); // ~300 m
  }

  function triggerSeismicEvent(mineX, mineY, note) {
    const sX = toScreenX(mineX);
    const sY = toScreenY(mineY);
    const attenRadius = getAttenRadiusPx();

    const newWave = {
      mineX,
      mineY,
      sX,
      sY,
      radiusP: 0,
      radiusS: 0,
      speedP: 3.2,
      speedS: 1.8,
      maxRadius: Math.max(width, height) * 0.95,
      attenRadius: attenRadius,
      note: note || `Sismo en X: ${Math.round(mineX)} · Cota: ${Math.round(mineY)}`,
      bornTime: time
    };
    activeWaves.push(newWave);

    // Evaluate detection
    evaluateSeismicDetection(newWave);
  }

  function evaluateSeismicDetection(wave) {
    // Check distance to geophones
    let nearestGeophoneDist = 999999;
    let nearestGeophone = null;

    geophoneStations.forEach(g => {
      const dist = Math.hypot(g.x - wave.mineX, g.y - wave.mineY);
      if (dist < nearestGeophoneDist) {
        nearestGeophoneDist = dist;
        nearestGeophone = g;
      }
    });

    // Check distance to DAS fibers
    let nearestDasDist = 999999;
    dasFibers.forEach(f => {
      for (let i = 0; i < f.points.length - 1; i++) {
        const d = distToSegment(wave.mineX, wave.mineY, f.points[i], f.points[i+1]);
        if (d < nearestDasDist) nearestDasDist = d;
      }
    });

    if (activeMode === 'geophones') {
      if (nearestGeophoneDist <= 320) {
        if (statusBanner) {
          statusBanner.className = 'sim-status-banner safe';
          statusBanner.innerHTML = `📡 <strong>SISMO DETECTADO (COTA ${Math.round(wave.mineY)})</strong> — Captado por Estación [${nearestGeophone.id}] a ${Math.round(nearestGeophoneDist)} m de distancia.`;
        }
      } else {
        if (statusBanner) {
          statusBanner.className = 'sim-status-banner blindspot';
          statusBanner.innerHTML = `⚠️ <strong>SISMO EN ZONA CIEGA (COTA ${Math.round(wave.mineY)}) — NO DETECTADO</strong>: Distancia a geófono más cercano es de <strong>${Math.round(nearestGeophoneDist)} m (>300 m límite físico de atenuación)</strong> · La señal no llega a los túneles inferiores.`;
        }
      }
    } else {
      if (statusBanner) {
        statusBanner.className = 'sim-status-banner safe';
        statusBanner.innerHTML = `⚡ <strong>DETECCIÓN DAS INMEDIATA (COTA ${Math.round(wave.mineY)})</strong>: Cable vertical a solo <strong>${Math.round(nearestDasDist)} m</strong> registra tasa de deformación dinámica ($\dot{\\varepsilon}$) en tiempo real · 100% Cobertura.`;
      }
    }
  }

  function distToSegment(px, py, p1, p2) {
    const l2 = (p2.x - p1.x)**2 + (p2.y - p1.y)**2;
    if (l2 === 0) return Math.hypot(px - p1.x, py - p1.y);
    let t = ((px - p1.x) * (p2.x - p1.x) + (py - p1.y) * (p2.y - p1.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (p1.x + t * (p2.x - p1.x)), py - (p1.y + t * (p2.y - p1.y)));
  }

  // -------------------------------------------------------------
  // 6. RENDERIZADO DEL PERFIL TÉCNICO MINERO (BLUEPRINT)
  // -------------------------------------------------------------
  function draw() {
    ctx.clearRect(0, 0, width, height);

    // Dark technical engineering background
    ctx.fillStyle = '#070c14';
    ctx.fillRect(0, 0, width, height);

    // 1. Technical Coordinate Grid & Elevation Lines
    drawCoordinateGrid();

    // 2. Geological Host Rock & Caving Subsidence Pit
    drawOpenPitCrater();

    // 3. Horizontal Footprint (Cota 9800 - Nivel Principal de Hundimiento)
    drawExploitationFootprint();

    // 4. Sublevels (Cota 9700, 9600) and Haulage Drift (Cota 9460)
    drawSublevelsAndDrifts();

    // 5. Orange Access Ramp (Rampa Caracol en Zigzag)
    drawAccessRamp();

    // 6. Red Blind Zone (Zona Roja Ciega sobre Cota 9800)
    drawRedBlindZone();

    // 7. FiberAndes DAS Cables (Verticales Arriba-Abajo + Rampa)
    drawDasCables();

    // 8. Traditional Geophone Stations (Cajas Numeradas 1 a 39)
    drawGeophoneStations();

    // 9. Seismic Waves Propagation
    drawSeismicWaves();

    // 10. Technical Title & Scale Bar
    drawBlueprintLegend();

    // 11. Mouse Hover Coordinate Reticle
    drawMouseReticle();
  }

  // -------------------------------------------------------------
  // A. GRILLA TÉCNICA (COORDINATE GRID BLUEPRINT)
  // -------------------------------------------------------------
  function drawCoordinateGrid() {
    ctx.save();

    // Minor grid
    ctx.strokeStyle = 'rgba(0, 180, 255, 0.08)';
    ctx.lineWidth = 1;

    // Vertical grid lines (every 100 meters: 10400, 10500... 11300)
    for (let x = 10400; x <= 11300; x += 100) {
      const sx = toScreenX(x);
      ctx.beginPath();
      ctx.moveTo(sx, padTop);
      ctx.lineTo(sx, height - padBottom);
      ctx.stroke();

      // Coordinate label at top (greenish/cyan mono font like reference)
      ctx.fillStyle = 'rgba(0, 240, 255, 0.55)';
      ctx.font = '10px var(--font-mono, monospace)';
      ctx.textAlign = 'center';
      ctx.fillText(x.toString(), sx, padTop - 12);
    }

    // Horizontal grid lines (every 100 meters elevation: 9300 to 10200)
    for (let y = 9300; y <= 10200; y += 100) {
      const sy = toScreenY(y);
      ctx.beginPath();
      ctx.moveTo(padLeft, sy);
      ctx.lineTo(width - padRight, sy);
      ctx.stroke();

      // Elevation label on right margin
      ctx.fillStyle = 'rgba(0, 240, 255, 0.65)';
      ctx.font = '11px var(--font-mono, monospace)';
      ctx.textAlign = 'left';
      ctx.fillText(y.toString(), width - padRight + 10, sy + 4);
    }

    // Outer bounding frame
    ctx.strokeStyle = 'rgba(0, 220, 255, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(padLeft, padTop, width - padLeft - padRight, height - padTop - padBottom);

    ctx.restore();
  }

  // -------------------------------------------------------------
  // B. CRÁTER / RAJO DE SUBSIDENCIA (SUPERFICIE COTA 10150 - 10300)
  // Embudo en V con bancos, escarpes y líneas de falla
  // -------------------------------------------------------------
  function drawOpenPitCrater() {
    ctx.save();

    // Pit contour boundary
    const pitRimLeft = { x: 10660, y: 10320 };
    const pitBottom = { x: 10890, y: 10140 };
    const pitRimRight = { x: 11180, y: 10320 };

    // Fill crater with subtle fractured rock texture
    ctx.beginPath();
    ctx.moveTo(toScreenX(pitRimLeft.x), toScreenY(pitRimLeft.y));
    ctx.lineTo(toScreenX(10740), toScreenY(10260));
    ctx.lineTo(toScreenX(10810), toScreenY(10200));
    ctx.lineTo(toScreenX(pitBottom.x), toScreenY(pitBottom.y));
    ctx.lineTo(toScreenX(10960), toScreenY(10200));
    ctx.lineTo(toScreenX(11060), toScreenY(10260));
    ctx.lineTo(toScreenX(pitRimRight.x), toScreenY(pitRimRight.y));
    ctx.lineTo(toScreenX(pitRimRight.x), toScreenY(10340));
    ctx.lineTo(toScreenX(pitRimLeft.x), toScreenY(10340));
    ctx.closePath();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fill();

    // Crater slope lines & benches (matching user reference drawing)
    ctx.strokeStyle = 'rgba(220, 235, 255, 0.75)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    // Left slope stepped benches
    ctx.moveTo(toScreenX(10660), toScreenY(10320));
    ctx.lineTo(toScreenX(10710), toScreenY(10290));
    ctx.lineTo(toScreenX(10735), toScreenY(10290));
    ctx.lineTo(toScreenX(10775), toScreenY(10245));
    ctx.lineTo(toScreenX(10805), toScreenY(10245));
    ctx.lineTo(toScreenX(10850), toScreenY(10190));
    ctx.lineTo(toScreenX(pitBottom.x), toScreenY(pitBottom.y));
    // Right slope stepped benches
    ctx.lineTo(toScreenX(10940), toScreenY(10190));
    ctx.lineTo(toScreenX(10975), toScreenY(10245));
    ctx.lineTo(toScreenX(11010), toScreenY(10245));
    ctx.lineTo(toScreenX(11080), toScreenY(10290));
    ctx.lineTo(toScreenX(11115), toScreenY(10290));
    ctx.lineTo(toScreenX(11180), toScreenY(10320));
    ctx.stroke();

    // Internal vertical tensile fractures (grietas de subsidencia)
    ctx.strokeStyle = 'rgba(200, 220, 245, 0.45)';
    ctx.lineWidth = 0.9;
    const fractures = [
      [{ x: 10730, y: 10310 }, { x: 10760, y: 10255 }],
      [{ x: 10780, y: 10280 }, { x: 10815, y: 10220 }],
      [{ x: 10840, y: 10260 }, { x: 10870, y: 10170 }],
      [{ x: 10920, y: 10270 }, { x: 10900, y: 10170 }],
      [{ x: 10970, y: 10300 }, { x: 10950, y: 10220 }],
      [{ x: 11040, y: 10310 }, { x: 11015, y: 10250 }]
    ];
    fractures.forEach(fr => {
      ctx.beginPath();
      ctx.moveTo(toScreenX(fr[0].x), toScreenY(fr[0].y));
      ctx.lineTo(toScreenX(fr[1].x), toScreenY(fr[1].y));
      ctx.stroke();
    });

    // Label for Open Pit / Subsidence crater
    ctx.fillStyle = '#a0b9d9';
    ctx.font = '9px var(--font-mono, monospace)';
    ctx.textAlign = 'center';
    ctx.fillText('CRÁTER DE SUBSIDENCIA / RAJO SUPERIOR', toScreenX(10890), toScreenY(10325));

    ctx.restore();
  }

  // -------------------------------------------------------------
  // C. FOOTPRINT DE EXPLOTACIÓN (COTA 9800 - 9820)
  // El bloque horizontal alargado característico de la figura
  // -------------------------------------------------------------
  function drawExploitationFootprint() {
    ctx.save();

    const x1 = toScreenX(10650);
    const x2 = toScreenX(11220);
    const yTop = toScreenY(9830);
    const yBot = toScreenY(9800);

    // Thick footprint box outline (black with crisp double outline)
    ctx.fillStyle = 'rgba(10, 20, 35, 0.95)';
    ctx.fillRect(x1, yTop, x2 - x1, yBot - yTop);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(x1, yTop, x2 - x1, yBot - yTop);

    // Internal production drift horizontal line
    const yMid = toScreenY(9815);
    ctx.strokeStyle = 'rgba(255, 140, 40, 0.8)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x1 + 4, yMid);
    ctx.lineTo(x2 - 4, yMid);
    ctx.stroke();

    // Label
    ctx.fillStyle = '#ff9f43';
    ctx.font = '10px var(--font-mono, monospace)';
    ctx.textAlign = 'left';
    ctx.fillText('NIVEL DE HUNDIMIENTO & PRODUCCIÓN (COTA 9800)', x1 + 10, yMid - 6);

    ctx.restore();
  }

  // -------------------------------------------------------------
  // D. SUBNIVELES (9700, 9600) Y NIVEL DE TRANSPORTE (9460)
  // -------------------------------------------------------------
  function drawSublevelsAndDrifts() {
    ctx.save();

    // Magenta & cyan exploratory geological lines as in reference
    ctx.strokeStyle = 'rgba(235, 77, 180, 0.45)'; // Magenta
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    // Upper exploratory drift Cota ~10060
    ctx.moveTo(toScreenX(10320), toScreenY(10080));
    ctx.lineTo(toScreenX(10480), toScreenY(10040));
    ctx.lineTo(toScreenX(10740), toScreenY(10040));
    ctx.stroke();

    // Sublevel Cota 9700 drift line (Blue-grey)
    ctx.strokeStyle = 'rgba(64, 130, 230, 0.7)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(toScreenX(10650), toScreenY(9720));
    ctx.lineTo(toScreenX(11120), toScreenY(9720));
    ctx.stroke();

    // Sublevel Cota 9600 drift line
    ctx.beginPath();
    ctx.moveTo(toScreenX(10650), toScreenY(9620));
    ctx.lineTo(toScreenX(11120), toScreenY(9620));
    ctx.stroke();

    // Haulage / Transport Level Cota 9460
    ctx.strokeStyle = 'rgba(255, 100, 40, 0.85)';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(toScreenX(10580), toScreenY(9460));
    ctx.lineTo(toScreenX(11140), toScreenY(9460));
    ctx.stroke();

    ctx.fillStyle = '#ff6b35';
    ctx.font = '9px var(--font-mono, monospace)';
    ctx.textAlign = 'right';
    ctx.fillText('NIVEL DE TRANSPORTE Y CHANCADO (COTA 9460)', toScreenX(11140), toScreenY(9460) - 6);

    ctx.restore();
  }

  // -------------------------------------------------------------
  // E. RAMPA DE ACCESO EN ZIGZAG (Naranja / Coral)
  // -------------------------------------------------------------
  function drawAccessRamp() {
    ctx.save();

    // Main orange ramp polyline
    ctx.strokeStyle = '#ff6b35';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    rampPolyline.forEach((pt, idx) => {
      const sx = toScreenX(pt.x);
      const sy = toScreenY(pt.y);
      if (idx === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.stroke();

    // Tunnel rib / stope tick marks along ramp
    ctx.strokeStyle = 'rgba(255, 120, 60, 0.55)';
    ctx.lineWidth = 1;
    for (let i = 0; i < rampPolyline.length - 1; i += 2) {
      const p1 = rampPolyline[i];
      const p2 = rampPolyline[i+1];
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const smx = toScreenX(mx);
      const smy = toScreenY(my);
      ctx.beginPath();
      ctx.arc(smx, smy, 2.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Ramp Label
    ctx.fillStyle = '#ff8c52';
    ctx.font = '10px var(--font-mono, monospace)';
    ctx.textAlign = 'left';
    ctx.fillText('RAMPA DE ACCESO ESPIRAL', toScreenX(10340), toScreenY(9750));

    ctx.restore();
  }

  // -------------------------------------------------------------
  // F. ZONA ROJA CIEGA FUERA DE ALCANCE (>300 m)
  // Columna de roca entre Cota 9820 y Cota 10250
  // -------------------------------------------------------------
  function drawRedBlindZone() {
    const blindFactor = 1.0 - dasCoverageAmount;
    if (blindFactor <= 0.01) return;

    ctx.save();

    const x1 = toScreenX(10600);
    const x2 = toScreenX(11240);
    const yTop = toScreenY(10220);
    const yBot = toScreenY(9830);

    // Red translucent hazard overlay
    const pulseAlpha = (0.28 + Math.sin(time * 3.5) * 0.08) * blindFactor;
    ctx.fillStyle = `rgba(255, 30, 30, ${pulseAlpha})`;
    ctx.fillRect(x1, yTop, x2 - x1, yBot - yTop);

    // Hazard striped hatching
    ctx.strokeStyle = `rgba(255, 60, 60, ${0.45 * blindFactor})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const step = 24;
    for (let x = x1 - (yBot - yTop); x < x2; x += step) {
      ctx.moveTo(x, yBot);
      ctx.lineTo(x + (yBot - yTop), yTop);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(x1, yTop, x2 - x1, yBot - yTop);
    ctx.clip();
    ctx.stroke();
    ctx.restore();

    // Hazard warning banner in center of blind zone
    const midX = (x1 + x2) / 2;
    const midY = (yTop + yBot) / 2;
    ctx.fillStyle = `rgba(18, 4, 6, ${0.85 * blindFactor})`;
    ctx.strokeStyle = `rgba(255, 50, 50, ${0.9 * blindFactor})`;
    ctx.lineWidth = 1.2;
    const bw = 320;
    const bh = 46;
    ctx.fillRect(midX - bw/2, midY - bh/2, bw, bh);
    ctx.strokeRect(midX - bw/2, midY - bh/2, bw, bh);

    ctx.fillStyle = `rgba(255, 80, 80, ${blindFactor})`;
    ctx.font = 'bold 11px var(--font-mono, monospace)';
    ctx.textAlign = 'center';
    ctx.fillText('⚠️ ZONA ROJA CIEGA SUPERIOR (>300 m)', midX, midY - 6);
    ctx.font = '9px var(--font-sans, sans-serif)';
    ctx.fillStyle = `rgba(255, 200, 200, ${blindFactor})`;
    ctx.fillText('Geófonos confinados abajo no detectan fracturamiento aquí', midX, midY + 12);

    ctx.restore();
  }

  // -------------------------------------------------------------
  // G. CABLES FIBERANDES DAS (DE ARRIBA A ABAJO + RAMPA)
  // -------------------------------------------------------------
  function drawDasCables() {
    ctx.save();

    const dasOpacity = Math.max(0.12, dasCoverageAmount);

    dasFibers.forEach((fiber) => {
      // Glow underlay
      if (dasCoverageAmount > 0.2) {
        ctx.strokeStyle = fiber.color;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = 0.25 * dasCoverageAmount;
        ctx.beginPath();
        fiber.points.forEach((pt, pIdx) => {
          const sx = toScreenX(pt.x);
          const sy = toScreenY(pt.y);
          if (pIdx === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.stroke();
      }

      // Core fiber line
      ctx.strokeStyle = fiber.color;
      ctx.lineWidth = 2.4;
      ctx.globalAlpha = dasOpacity;
      ctx.beginPath();
      fiber.points.forEach((pt, pIdx) => {
        const sx = toScreenX(pt.x);
        const sy = toScreenY(pt.y);
        if (pIdx === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();
    });

    // Animated Photon Pulses flowing top-to-bottom
    if (dasCoverageAmount > 0.15) {
      photonPulses.forEach(pp => {
        pp.progress = (pp.progress + pp.speed) % 1.0;
        const fiber = dasFibers[pp.fiberIdx];
        if (!fiber) return;

        // Calculate point along polyline
        const pt = getPolylinePoint(fiber.points, pp.progress);
        if (pt) {
          const sx = toScreenX(pt.x);
          const sy = toScreenY(pt.y);

          // Glowing photon bead
          ctx.globalAlpha = dasCoverageAmount;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = fiber.color;
          ctx.beginPath();
          ctx.arc(sx, sy, 6.0, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    ctx.restore();
  }

  function getPolylinePoint(points, progress) {
    if (points.length < 2) return null;
    let totalLen = 0;
    const lens = [];
    for (let i = 0; i < points.length - 1; i++) {
      const d = Math.hypot(points[i+1].x - points[i].x, points[i+1].y - points[i].y);
      lens.push(d);
      totalLen += d;
    }
    const targetDist = progress * totalLen;
    let acc = 0;
    for (let i = 0; i < lens.length; i++) {
      if (acc + lens[i] >= targetDist) {
        const segProgress = (targetDist - acc) / lens[i];
        return {
          x: points[i].x + segProgress * (points[i+1].x - points[i].x),
          y: points[i].y + segProgress * (points[i+1].y - points[i].y)
        };
      }
      acc += lens[i];
    }
    return points[points.length - 1];
  }

  // -------------------------------------------------------------
  // H. ESTACIONES DE GEÓFONOS (CAJAS NUMERADAS 1 A 39)
  // -------------------------------------------------------------
  function drawGeophoneStations() {
    ctx.save();

    hoveredStation = null;
    const attenRadiusPx = getAttenRadiusPx();

    geophoneStations.forEach(st => {
      const sx = toScreenX(st.x);
      const sy = toScreenY(st.y);

      // Sensitivity lobe circle (300 m) in geophones mode
      if (activeMode === 'geophones') {
        ctx.strokeStyle = 'rgba(255, 176, 32, 0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(sx, sy, attenRadiusPx, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Check mouse hover
      const isHovered = Math.abs(mouseScreenX - sx) < st.w/2 + 2 && Math.abs(mouseScreenY - sy) < st.h/2 + 2;
      if (isHovered) {
        hoveredStation = st;
      }

      // Box shape identical to reference image:
      // White/light box with thin black border and station number
      ctx.fillStyle = isHovered ? '#00f0ff' : '#ffffff';
      ctx.strokeStyle = isHovered ? '#ffffff' : '#111c2b';
      ctx.lineWidth = isHovered ? 1.8 : 1.2;

      ctx.fillRect(sx - st.w/2, sy - st.h/2, st.w, st.h);
      ctx.strokeRect(sx - st.w/2, sy - st.h/2, st.w, st.h);

      // Station number text
      ctx.fillStyle = '#0a101d';
      ctx.font = 'bold 10px var(--font-mono, monospace)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(st.id.toString(), sx, sy);
    });

    ctx.restore();
  }

  // -------------------------------------------------------------
  // I. ONDAS SÍSMICAS P Y S
  // -------------------------------------------------------------
  function drawSeismicWaves() {
    if (activeWaves.length === 0) return;

    ctx.save();
    for (let i = activeWaves.length - 1; i >= 0; i--) {
      const w = activeWaves[i];
      w.radiusP += w.speedP;
      w.radiusS += w.speedS;

      const atten = Math.max(0, 1.0 - (w.radiusP / w.maxRadius));

      // Wave origin star
      ctx.fillStyle = '#ff3344';
      ctx.beginPath();
      ctx.arc(w.sX, w.sY, 5, 0, Math.PI * 2);
      ctx.fill();

      // P Wave (Cian fast)
      ctx.strokeStyle = `rgba(0, 240, 255, ${atten * 0.9})`;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(w.sX, w.sY, w.radiusP, 0, Math.PI * 2);
      ctx.stroke();

      // S Wave (Amber slower)
      ctx.strokeStyle = `rgba(255, 176, 32, ${atten * 0.75})`;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(w.sX, w.sY, w.radiusS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      if (atten <= 0.02 || w.radiusP >= w.maxRadius) {
        activeWaves.splice(i, 1);
      }
    }
    ctx.restore();
  }

  // -------------------------------------------------------------
  // J. LEYENDA TÉCNICA Y ESCALA GRÁFICA
  // -------------------------------------------------------------
  function drawBlueprintLegend() {
    ctx.save();

    // Scale bar in bottom-left
    const scale100mPx = toScreenX(10500) - toScreenX(10400);
    const sbX = padLeft + 15;
    const sbY = height - padBottom - 18;

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sbX, sbY);
    ctx.lineTo(sbX + scale100mPx, sbY);
    ctx.moveTo(sbX, sbY - 4);
    ctx.lineTo(sbX, sbY + 4);
    ctx.moveTo(sbX + scale100mPx, sbY - 4);
    ctx.lineTo(sbX + scale100mPx, sbY + 4);
    ctx.stroke();

    ctx.fillStyle = 'rgba(0, 240, 255, 0.85)';
    ctx.font = '9px var(--font-mono, monospace)';
    ctx.textAlign = 'center';
    ctx.fillText('ESCALA 100 m', sbX + scale100mPx / 2, sbY - 6);

    // Title / Drawing standard header
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = 'bold 10px var(--font-mono, monospace)';
    ctx.textAlign = 'left';
    ctx.fillText('SECCIÓN TRANSVERSAL TÉCNICA · CAVING & RED SÍSMICA', padLeft + 15, padTop + 18);

    ctx.fillStyle = 'rgba(0, 240, 255, 0.6)';
    ctx.font = '9px var(--font-mono, monospace)';
    ctx.fillText('REFERENCIA: GEÓFONOS NUMERADOS vs. CABLES DAS CONTINUOS', padLeft + 15, padTop + 32);

    ctx.restore();
  }

  // -------------------------------------------------------------
  // K. RETÍCULA DE MOUSE (COORDINATE RETICLE)
  // -------------------------------------------------------------
  function drawMouseReticle() {
    if (mouseScreenX < padLeft || mouseScreenX > width - padRight ||
        mouseScreenY < padTop || mouseScreenY > height - padBottom) {
      return;
    }

    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([2, 2]);

    // Crosshair lines
    ctx.beginPath();
    ctx.moveTo(mouseScreenX, padTop);
    ctx.lineTo(mouseScreenX, height - padBottom);
    ctx.moveTo(padLeft, mouseScreenY);
    ctx.lineTo(width - padRight, mouseScreenY);
    ctx.stroke();

    // Coordinates tooltip box
    const mX = Math.round(fromScreenX(mouseScreenX));
    const mY = Math.round(fromScreenY(mouseScreenY));
    const txt = `X: ${mX} · Cota: ${mY} m s.n.m.`;

    ctx.font = '10px var(--font-mono, monospace)';
    const tw = ctx.measureText(txt).width;
    const bx = Math.min(width - padRight - tw - 16, mouseScreenX + 12);
    const by = Math.max(padTop + 14, mouseScreenY - 12);

    ctx.fillStyle = 'rgba(7, 12, 20, 0.9)';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1;
    ctx.fillRect(bx, by - 12, tw + 12, 18);
    ctx.strokeRect(bx, by - 12, tw + 12, 18);

    ctx.fillStyle = '#00f0ff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, bx + 6, by - 3);

    ctx.restore();
  }

  // -------------------------------------------------------------
  // 7. LOOP DE ANIMACIÓN Y TRANSICIONES SUAVES
  // -------------------------------------------------------------
  function animate() {
    animId = requestAnimationFrame(animate);
    time += 0.02;

    // Smooth DAS coverage interpolation
    dasCoverageAmount += (dasCoverageTarget - dasCoverageAmount) * 0.06;
    if (Math.abs(dasCoverageTarget - dasCoverageAmount) < 0.003) {
      dasCoverageAmount = dasCoverageTarget;
    }

    // Dynamic Telemetry update
    const curCov = Math.round(35 + dasCoverageAmount * 64);
    const curSens = dasCoverageAmount > 0.5 ? '12.000 Sensores DAS (De Arriba a Abajo + Rampa)' : '22 Geófonos Numerados en Niveles';
    const curUncert = (26.0 - dasCoverageAmount * 24.5).toFixed(1) + ' m';
    const curStatus = dasCoverageAmount > 0.5 ? 'Cero Puntos Ciegos (100% Activo)' : 'Zona Roja Ciega Superior (>300 m)';

    if (telCov) telCov.textContent = curCov + '%';
    if (telSens) telSens.textContent = curSens;
    if (telUncert) telUncert.textContent = '±' + curUncert;
    if (telStrain) telStrain.textContent = curStatus;

    draw();
  }

  // -------------------------------------------------------------
  // 8. INTERACCIÓN Y EVENTOS DE MOUSE
  // -------------------------------------------------------------
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseScreenX = e.clientX - rect.left;
    mouseScreenY = e.clientY - rect.top;

    const mX = Math.round(fromScreenX(mouseScreenX));
    const mY = Math.round(fromScreenY(mouseScreenY));

    if (hudText) {
      if (hoveredStation) {
        hudText.innerHTML = `📍 <strong>${hoveredStation.name}</strong> · Coordenadas: X ${hoveredStation.x}, Cota ${hoveredStation.y} m s.n.m. (Radio de escucha: 300 m)`;
      } else if (mY > 9820 && mY < 10250 && mX > 10600 && mX < 11250) {
        hudText.innerHTML = `⚠️ <strong>ZONA ROJA CIEGA SUPERIOR</strong> — Cota ${mY} m s.n.m. · Fuera del alcance de los geófonos (>300 m) · Haz clic para detonar un sismo`;
      } else if (mY >= 9800 && mY <= 9830) {
        hudText.innerHTML = `⛏️ <strong>Nivel de Hundimiento & Producción (Cota 9800)</strong> · Footprint de Caving`;
      } else if (mX >= 10320 && mX <= 10600 && mY >= 9440 && mY <= 9950) {
        hudText.innerHTML = `🚗 <strong>Rampa de Acceso Espiral (Naranja)</strong> · Conecta Cota 9950 con Transporte 9460`;
      } else if (mY >= 10150) {
        hudText.innerHTML = `🏔️ <strong>Cráter de Subsidencia / Rajo Abierto</strong> · Cota ${mY} m s.n.m.`;
      } else {
        hudText.innerHTML = `💡 Coordenadas: X ${mX} · Cota ${mY} m s.n.m. · Haz clic en cualquier punto para detonar sismicidad`;
      }
    }
  });

  canvas.addEventListener('mouseleave', () => {
    mouseScreenX = -1;
    mouseScreenY = -1;
    if (hudText) {
      hudText.innerHTML = '💡 Pasa el cursor por el perfil de mina para inspeccionar coordenadas, niveles y estaciones';
    }
  });

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const clickSx = e.clientX - rect.left;
    const clickSy = e.clientY - rect.top;

    const mineX = fromScreenX(clickSx);
    const mineY = fromScreenY(clickSy);

    triggerSeismicEvent(mineX, mineY);
  });

  // -------------------------------------------------------------
  // 9. CONTROLES EXTERNOS (BOTONES DE MODO Y ESCENARIOS)
  // -------------------------------------------------------------
  function setMode(mode) {
    activeMode = mode;
    dasCoverageTarget = (mode === 'dfos') ? 1.0 : 0.0;

    if (mode === 'dfos') {
      if (statusBanner) {
        statusBanner.className = 'sim-status-banner safe';
        statusBanner.innerHTML = '⚡ <strong>FIBERANDES DAS ACTIVO (ARRIBA A ABAJO + RAMPA)</strong> — Fibras continuas cubren el <strong>100% de la columna</strong> · El área roja ciega se redujo a 0%.';
      }
    } else {
      if (statusBanner) {
        statusBanner.className = 'sim-status-banner blindspot';
        statusBanner.innerHTML = '<strong>📡 RED TRADICIONAL (GEÓFONOS NUMERADOS 1 A 39)</strong> — Sensores confinados abajo dejan un <strong>área roja ciega masiva sobre la cota 9800</strong> · Haz clic en <em>"Cables DAS (De Arriba a Abajo)"</em>.';
      }
    }
  }

  function setupControls() {
    const btnDfos = document.getElementById('btn-mode-dfos');
    const btnEsi = document.getElementById('btn-mode-esi');
    const btnSimCaveback = document.getElementById('btn-sim-caveback');
    const btnSimLevel = document.getElementById('btn-cam-general') || document.getElementById('btn-sim-rockburst');

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

    // Trigger seismic event in upper column / crater (cota 10050)
    if (btnSimCaveback) {
      btnSimCaveback.addEventListener('click', () => {
        triggerSeismicEvent(10880, 10050, 'Fracturamiento en Columna / Cráter (Cota 10050)');
      });
    }

    // Trigger seismic event in Lower Ramp / Haulage (cota 9460)
    if (btnSimLevel) {
      btnSimLevel.innerHTML = '⚠️ Sismo en Rampa Baja (Cota 9460)';
      btnSimLevel.addEventListener('click', () => {
        triggerSeismicEvent(10650, 9460, 'Sismo en Rampa de Transporte (Cota 9460)');
      });
    }
  }

  setupControls();
  setMode('geophones');
  animate();
})();
