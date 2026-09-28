/* ============================================================
   FIBERANDES — 2D Interactive Mine Geomechanics Simulator
   Corte Transversal Block Caving & DFOS vs. Sensores Puntuales
   ============================================================ */
(function() {
  'use strict';

  const container = document.getElementById('mine-3d-canvas-container');
  if (!container) return;

  // Clear previous 3D viewport content and create dedicated 2D canvas
  container.innerHTML = '';

  const canvas = document.createElement('canvas');
  canvas.id = 'mine-2d-canvas';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.cursor = 'crosshair';
  container.appendChild(canvas);

  // Re-inject HUD elements inside container
  const overlayHint = document.createElement('div');
  overlayHint.className = 'sim-overlay-hint';
  overlayHint.innerHTML = '<span>🖱️ Haz clic en cualquier lugar del macizo rocoso para detonar una microsismicidad</span>';
  container.appendChild(overlayHint);

  const statusBanner = document.createElement('div');
  statusBanner.id = 'sim-status-banner';
  statusBanner.className = 'sim-status-banner detected';
  statusBanner.innerHTML = '<strong>FIBERANDES DFOS: SONDAJES + GALERÍAS</strong> — 8.500 canales ópticos continuos (sin baterías) · Cobertura 98% · Captura sísmica Mw &lt; 0 y perfil continuo Slow-Strain';
  container.appendChild(statusBanner);

  // Legend
  const legend = document.createElement('div');
  legend.className = 'sim-3d-legend';
  legend.innerHTML = `
    <div class="legend-item"><span class="legend-color cyan"></span><span>Sondajes DAS Fibra Continua (FiberAndes)</span></div>
    <div class="legend-item"><span class="legend-color" style="background:#ff6600; box-shadow:0 0 6px #ff6600;"></span><span>Balizas Discretas &amp; Geófonos (Puntual)</span></div>
    <div class="legend-item"><span class="legend-color" style="background:#ff281a; box-shadow:0 0 8px rgba(255,40,26,0.7);"></span><span>Bóveda Cave-Back &amp; Air Gap (Hundimiento)</span></div>
    <div class="legend-item"><span class="legend-color dark" style="background:#1b434d; border:1px solid #00f0ff;"></span><span>Muckpile (Mineral Quebrado en Extracción)</span></div>
    <div class="legend-item"><span class="legend-color blue"></span><span>Niveles de Producción &amp; Galerías</span></div>
    <div class="legend-item"><span class="legend-color red"></span><span>Punto Ciego Geomecánico Tradicional</span></div>
  `;
  container.appendChild(legend);

  // Telemetry strip
  const telemetry = document.createElement('div');
  telemetry.className = 'sim-3d-telemetry';
  telemetry.innerHTML = `
    <div class="sim-tel-cell">
      <span class="l">COBERTURA VOLUMÉTRICA</span>
      <span class="v" id="tel-val-cov" style="color:var(--emerald);">98%</span>
    </div>
    <div class="sim-tel-cell">
      <span class="l">SENSORES ACTIVOS</span>
      <span class="v" id="tel-val-sens" style="color:#fff;">8.500 Canales Ópticos</span>
    </div>
    <div class="sim-tel-cell">
      <span class="l">INCERTIDUMBRE HIPOCENTRO</span>
      <span class="v" id="tel-val-uncert" style="color:var(--cyan);">±1.8 metros</span>
    </div>
    <div class="sim-tel-cell">
      <span class="l">SLOW-STRAIN EN ROCA</span>
      <span class="v" id="tel-val-strain" style="color:var(--emerald);">Activo (Doble Banda)</span>
    </div>
  `;
  container.appendChild(telemetry);

  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let dpr = 1;

  // State
  let activeMode = 'dfos'; // 'dfos' or 'geophones'
  let animId = null;
  let time = 0;

  // Active seismic waves pool
  let activeWaves = [];
  // Spontaneous microseismic cracks
  let microCracks = [];
  // Fiber excitation flashes
  let fiberFlashes = [];

  // Synthetic DAS Waterfall history buffer (time rolling)
  const WATERFALL_WIDTH = 130;
  const WATERFALL_ROWS = 70;
  const waterfallBuffer = [];
  for (let r = 0; r < WATERFALL_ROWS; r++) {
    waterfallBuffer.push(new Float32Array(WATERFALL_WIDTH));
  }

  // Geotechnical Coordinate Model
  // Mapping depth: Y_TOP = 50px (0m Surface), Y_BOTTOM = 520px (-2.200m Fondo)
  function getDepthY(depthMeters) {
    // 0m -> 50px, -2200m -> height - 35px
    const yTop = 52;
    const yBottom = height - 42;
    return yTop + (Math.abs(depthMeters) / 2200) * (yBottom - yTop);
  }

  function resize() {
    const rect = container.getBoundingClientRect();
    width = rect.width || 800;
    height = rect.height || 560;
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }

  window.addEventListener('resize', resize);
  resize();

  // -------------------------------------------------------------
  // SEISMIC WAVE TRIGGER
  // -------------------------------------------------------------
  function triggerSeismicEvent(x, y, mag = -1.2, isCaveBackFracture = false) {
    const wave = {
      x,
      y,
      mag,
      radiusP: 0,
      radiusS: 0,
      speedP: 3.8,  // P-wave compressional speed (~5.5 km/s scaled)
      speedS: 2.2,  // S-wave shear speed (~3.2 km/s scaled)
      maxRadius: Math.max(width, height) * 0.95,
      alpha: 1.0,
      isCaveBack: isCaveBackFracture,
      hitFiberChannels: new Set(),
      hitGeophones: new Set()
    };
    activeWaves.push(wave);

    // Microcrack flash graphic
    microCracks.push({
      x,
      y,
      alpha: 1.0,
      size: 6 + Math.abs(mag) * 4,
      color: mag > -0.5 ? '#ff4b55' : (mag > -1.2 ? '#ffc83b' : '#00f0ff')
    });

    // Update banner
    const banner = document.getElementById('sim-status-banner');
    if (banner) {
      if (activeMode === 'dfos') {
        const depthEst = Math.round(((y - 52) / (height - 94)) * 2200);
        banner.className = 'sim-status-banner detected';
        banner.innerHTML = `<strong>⚡ EVENTO REGISTRADO EN TIEMPO REAL</strong> — Profundidad: -${depthEst} m · Mw ${mag.toFixed(1)} · Cobertura continua DAS: 100% frentes P/S detectados · Incertidumbre: ±1.8 m`;
      } else {
        // Check if inside blind spot (above production level and away from drifts)
        const inBlind = y < getDepthY(1550);
        if (inBlind) {
          banner.className = 'sim-status-banner blindspot';
          banner.innerHTML = `<strong>❌ ALERTA: FRACTURA EN ZONA CIEGA DEL MACIZO ROCOSO</strong> — Ocurrió en roca virgen sin instrumentación · Geófonos en túneles reciben señal tardía/atenuada · Incertidumbre: ±25 m · Sin datos de deformación (slow-strain)`;
        } else {
          banner.className = 'sim-status-banner detected';
          banner.innerHTML = `<strong>⚠️ EVENTO DETECTADO POR GEÓFONOS EN TÚNEL</strong> — Señal puntual capturada · Alta atenuación · Incertidumbre: ±18 m`;
        }
      }
    }
  }

  // -------------------------------------------------------------
  // USER CLICK INTERACTION
  // -------------------------------------------------------------
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Only trigger if inside the rock mass (below surface)
    if (y > 45 && x < width - 150) {
      const mag = -0.4 - Math.random() * 1.5;
      triggerSeismicEvent(x, y, mag, false);
    }
  });

  // Mode Switch
  function setMode(mode) {
    activeMode = mode;
    const banner = document.getElementById('sim-status-banner');

    if (mode === 'dfos') {
      if (banner) {
        banner.className = 'sim-status-banner detected';
        banner.innerHTML = '<strong>FIBERANDES DFOS: SONDAJES + GALERÍAS</strong> — 8.500 canales ópticos continuos (sin baterías) · Cobertura 98% · Captura sísmica Mw &lt; 0 y perfil continuo Slow-Strain';
      }
      updateTelemetry(98, "8.500 Canales Ópticos", "±1.8 metros", "Activo (Doble Banda)");
    } else {
      if (banner) {
        banner.className = 'sim-status-banner blindspot';
        banner.innerHTML = '<strong>TECNOLOGÍA TRADICIONAL: BALIZAS DE BATERÍA &amp; GEÓFONOS</strong> — 8 balizas en sondajes + 12 geófonos en túneles · 78% de la roca en punto ciego · Ciego a deformación continua';
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
      btnSimulate.addEventListener('click', () => {
        // Trigger major fracture at Cave-Back apex (-1020m)
        const caveCenterX = (width - 150) * 0.52;
        const caveBackY = getDepthY(1020);
        triggerSeismicEvent(caveCenterX, caveBackY, -1.3, true);
      });
    }

    if (btnResetCam) {
      btnResetCam.style.display = 'none'; // Not needed in 2D
    }
  }

  // -------------------------------------------------------------
  // RENDER PIPELINE
  // -------------------------------------------------------------
  function draw() {
    time += 0.02;

    ctx.clearRect(0, 0, width, height);

    const mainWidth = width > 750 ? width - 165 : width; // reserve right space for waterfall on desktop
    const showWaterfall = width > 750;

    const ySurface = 52;
    const yCaveTop = getDepthY(1000);
    const yAirGap = getDepthY(1400);
    const yUndercut = getDepthY(1650);
    const yProduction = getDepthY(1820);
    const yHaulage = getDepthY(2040);
    const yBottom = height - 38;

    const caveLeft = mainWidth * 0.32;
    const caveRight = mainWidth * 0.72;
    const caveCenterX = (caveLeft + caveRight) / 2;

    // 1. Rock Mass Background
    const rockGrad = ctx.createLinearGradient(0, ySurface, 0, yBottom);
    rockGrad.addColorStop(0, '#0a101f');
    rockGrad.addColorStop(0.35, '#070b16');
    rockGrad.addColorStop(0.75, '#050811');
    rockGrad.addColorStop(1, '#020408');
    ctx.fillStyle = rockGrad;
    ctx.fillRect(0, ySurface, mainWidth, yBottom - ySurface);

    // Geological Structural Joint Sets (Fallas / Diaclasas)
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 12]);
    for (let j = 0; j < 7; j++) {
      const jy = ySurface + 40 + j * 65;
      ctx.beginPath();
      ctx.moveTo(40, jy - 15);
      ctx.lineTo(mainWidth, jy + 25);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    // 2. Depth Scale (Left Margin)
    ctx.fillStyle = '#4d5c75';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';

    const depthMarkers = [
      { d: 0, label: '0 m (Sup)' },
      { d: 500, label: '-500 m' },
      { d: 1000, label: '-1.000 m Cave-Back' },
      { d: 1400, label: '-1.400 m Air-Gap' },
      { d: 1650, label: '-1.650 m Undercut' },
      { d: 1820, label: '-1.820 m Producción' },
      { d: 2040, label: '-2.040 m Transporte' }
    ];

    depthMarkers.forEach(m => {
      const my = getDepthY(m.d);
      ctx.fillText(m.label, 80, my - 2);

      ctx.strokeStyle = m.d === 1000 ? 'rgba(255,40,26,0.3)' : 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(85, my);
      ctx.lineTo(mainWidth, my);
      ctx.stroke();
    });

    // 3. Topographic Surface Profile
    ctx.fillStyle = '#060a12';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(mainWidth, 0);
    ctx.lineTo(mainWidth, ySurface);
    // Mountain slope
    ctx.bezierCurveTo(mainWidth * 0.7, ySurface - 12, mainWidth * 0.3, ySurface + 8, 0, ySurface - 5);
    ctx.closePath();
    ctx.fill();

    // Surface line neon crest
    ctx.strokeStyle = '#2b3f5c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, ySurface - 5);
    ctx.bezierCurveTo(mainWidth * 0.3, ySurface + 8, mainWidth * 0.7, ySurface - 12, mainWidth, ySurface);
    ctx.stroke();

    // Surface facilities icon (Headframe / Interrogator shack)
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(mainWidth * 0.22 - 8, ySurface - 22, 16, 18);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(mainWidth * 0.22 - 8, ySurface - 22, 16, 18);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DAS INTERROGATOR', mainWidth * 0.22, ySurface - 26);

    // 4. BLOCK CAVING GEOMETRY
    // A. Muckpile (Broken Rock Mass Column)
    ctx.fillStyle = '#171e2b';
    ctx.beginPath();
    ctx.moveTo(caveLeft + 15, yUndercut);
    ctx.lineTo(caveRight - 15, yUndercut);
    ctx.lineTo(caveRight - 25, yAirGap + 20);
    ctx.quadraticCurveTo(caveCenterX, yAirGap + 5, caveLeft + 25, yAirGap + 20);
    ctx.closePath();
    ctx.fill();

    // Broken rock fragments texture
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let r = 0; r < 24; r++) {
      const rx = caveLeft + 30 + ((r * 37) % (caveRight - caveLeft - 60));
      const ry = yAirGap + 25 + ((r * 29) % (yUndercut - yAirGap - 35));
      ctx.strokeRect(rx, ry, 6 + (r % 5), 4 + (r % 4));
    }

    // B. Air Gap (Void Space)
    ctx.fillStyle = 'rgba(4, 7, 13, 0.95)';
    ctx.beginPath();
    ctx.moveTo(caveLeft + 25, yAirGap + 20);
    ctx.quadraticCurveTo(caveCenterX, yAirGap + 5, caveRight - 25, yAirGap + 20);
    ctx.lineTo(caveRight - 10, yAirGap - 15);
    ctx.quadraticCurveTo(caveCenterX, yCaveTop + 25, caveLeft + 10, yAirGap - 15);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 140, 40, 0.7)';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('AIR GAP (CAVIDAD ABIERTA)', caveCenterX, yAirGap - 2);

    // C. Cave-Back Active Failure Dome (Bóveda Sísmica)
    ctx.save();
    ctx.strokeStyle = '#ff281a';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ff281a';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(caveLeft - 10, yAirGap);
    ctx.quadraticCurveTo(caveCenterX, yCaveTop, caveRight + 10, yAirGap);
    ctx.stroke();

    // Semi-transparent failure envelope
    ctx.fillStyle = 'rgba(255, 40, 26, 0.12)';
    ctx.beginPath();
    ctx.moveTo(caveLeft - 10, yAirGap);
    ctx.quadraticCurveTo(caveCenterX, yCaveTop, caveRight + 10, yAirGap);
    ctx.lineTo(caveRight - 10, yAirGap - 15);
    ctx.quadraticCurveTo(caveCenterX, yCaveTop + 25, caveLeft + 10, yAirGap - 15);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#ff6644';
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BÓVEDA CAVE-BACK (-1.000 m)', caveCenterX, yCaveTop - 12);
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = '#8f9fb6';
    ctx.fillText('Zona de alta concentración de esfuerzos y rockburst', caveCenterX, yCaveTop + 1);

    // D. Drawbells (Zanjas y Bateas de Extracción)
    const bellCount = 5;
    const bellSpacing = (caveRight - caveLeft - 30) / (bellCount - 1);
    ctx.fillStyle = '#ff7700';
    for (let b = 0; b < bellCount; b++) {
      const bx = caveLeft + 15 + b * bellSpacing;
      // Inverted funnel
      ctx.beginPath();
      ctx.moveTo(bx - 12, yUndercut);
      ctx.lineTo(bx + 12, yUndercut);
      ctx.lineTo(bx + 5, yProduction - 8);
      ctx.lineTo(bx - 5, yProduction - 8);
      ctx.closePath();
      ctx.fillStyle = '#1c2536';
      ctx.fill();
      ctx.strokeStyle = '#ff7700';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Extraction mouth marker
      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(bx - 4, yProduction - 10, 8, 4);
    }

    // 5. UNDERGROUND MINING TUNNELS (Galerías y Piques)
    // A. Undercut Level Drift
    ctx.fillStyle = '#111c2b';
    ctx.strokeStyle = '#00e1ff';
    ctx.lineWidth = 1;
    ctx.fillRect(caveLeft - 30, yUndercut - 5, (caveRight - caveLeft) + 60, 10);
    ctx.strokeRect(caveLeft - 30, yUndercut - 5, (caveRight - caveLeft) + 60, 10);

    // B. Production Level (Drifts & Crosscuts)
    ctx.fillStyle = '#111c2b';
    ctx.fillRect(caveLeft - 60, yProduction - 6, (caveRight - caveLeft) + 120, 12);
    ctx.strokeRect(caveLeft - 60, yProduction - 6, (caveRight - caveLeft) + 120, 12);

    // Amber lamps inside production drift
    for (let lx = caveLeft - 50; lx <= caveRight + 50; lx += 45) {
      ctx.fillStyle = '#ffb020';
      ctx.beginPath();
      ctx.arc(lx, yProduction - 2, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // C. Haulage Level (Transporte de mineral)
    ctx.fillStyle = '#0d1624';
    ctx.fillRect(caveLeft - 80, yHaulage - 8, (caveRight - caveLeft) + 160, 16);
    ctx.strokeStyle = '#00a3ff';
    ctx.strokeRect(caveLeft - 80, yHaulage - 8, (caveRight - caveLeft) + 160, 16);

    // D. Vertical Ventilation Shaft (Pique)
    const shaftX = caveLeft - 70;
    ctx.fillStyle = '#0c1522';
    ctx.fillRect(shaftX - 6, ySurface, 12, yHaulage - ySurface);
    ctx.strokeStyle = 'rgba(0, 225, 255, 0.4)';
    ctx.strokeRect(shaftX - 6, ySurface, 12, yHaulage - ySurface);

    // 6. INSTRUMENTATION LAYERS (Mode Dependent)
    if (activeMode === 'geophones') {
      // ---------------------------------------------------------
      // MODE: TRADITIONAL DISCRETE GEOPHONES & BATTERY BEACONS
      // ---------------------------------------------------------

      // A. Massive Red Blind Spot Shading
      ctx.save();
      ctx.fillStyle = 'rgba(255, 75, 85, 0.16)';
      ctx.beginPath();
      ctx.moveTo(caveLeft - 60, yUndercut);
      ctx.lineTo(caveRight + 60, yUndercut);
      ctx.lineTo(caveRight + 60, ySurface + 30);
      ctx.lineTo(caveLeft - 60, ySurface + 30);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 75, 85, 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.stroke();
      ctx.restore();

      // Warning Badge in Blind Spot Center
      ctx.save();
      ctx.fillStyle = 'rgba(255, 40, 26, 0.88)';
      ctx.shadowColor = '#ff281a';
      ctx.shadowBlur = 10;
      ctx.fillRect(caveCenterX - 110, yCaveTop - 75, 220, 36);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(caveCenterX - 110, yCaveTop - 75, 220, 36);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚠️ PUNTO CIEGO GEOMECÁNICO', caveCenterX, yCaveTop - 60);
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText('78% del macizo rocoso sin visibilidad', caveCenterX, yCaveTop - 46);
      ctx.restore();

      // B. Discrete Geophones (Triangles in Tunnels Only)
      const geophoneXList = [
        caveLeft - 50, caveLeft - 10, caveLeft + 40, caveCenterX, caveRight - 40, caveRight + 10, caveRight + 50
      ];

      geophoneXList.forEach((gx, idx) => {
        // Draw triaxial station
        ctx.fillStyle = '#ffb020';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(gx, yProduction - 14);
        ctx.lineTo(gx + 6, yProduction - 3);
        ctx.lineTo(gx - 6, yProduction - 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Pulsing reception ring
        const ringR = 8 + Math.sin(time * 3 + idx) * 3;
        ctx.strokeStyle = 'rgba(255, 176, 32, 0.4)';
        ctx.beginPath();
        ctx.arc(gx, yProduction - 8, ringR, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Geophones in Haulage
      [caveLeft - 30, caveCenterX, caveRight + 30].forEach((gx) => {
        ctx.fillStyle = '#ffb020';
        ctx.beginPath();
        ctx.moveTo(gx, yHaulage - 14);
        ctx.lineTo(gx + 6, yHaulage - 3);
        ctx.lineTo(gx - 6, yHaulage - 3);
        ctx.closePath();
        ctx.fill();
      });

      // C. Discrete Battery Beacons in Borehole (Sparse dots every 80m)
      const beaconBoreholes = [
        { x: caveLeft - 15, y1: ySurface, y2: yProduction },
        { x: caveRight + 15, y1: ySurface, y2: yProduction }
      ];

      beaconBoreholes.forEach(bb => {
        // Dashed borehole line
        ctx.strokeStyle = '#71829e';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(bb.x, bb.y1);
        ctx.lineTo(bb.x, bb.y2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Only 3-4 battery beacons along the entire 1,800m!
        const fractions = [0.25, 0.50, 0.75, 0.92];
        fractions.forEach(frac => {
          const by = bb.y1 + (bb.y2 - bb.y1) * frac;
          ctx.fillStyle = '#ff6600';
          ctx.beginPath();
          ctx.arc(bb.x, by, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Battery icon indication
          ctx.fillStyle = '#ffc83b';
          ctx.font = '8px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText('🔋 Baliza', bb.x + 8, by + 3);
        });
      });

    } else {
      // ---------------------------------------------------------
      // MODE: FIBERANDES DFOS (CONTINUOUS FIBER ARRAY)
      // ---------------------------------------------------------

      // Deep Boreholes Array (Surface to deep rock mass & underground fans)
      const fiberBoreholes = [
        // B-01: Deep west vertical
        { p1: { x: caveLeft - 30, y: ySurface }, p2: { x: caveLeft - 30, y: yHaulage + 20 }, color: '#00f0ff', label: 'B-01 (DAS)' },
        // B-02: Central inclined borehole brushing cave-back
        { p1: { x: mainWidth * 0.22, y: ySurface }, p2: { x: caveCenterX, y: yProduction + 10 }, color: '#00f0ff', label: 'B-02 (DAS Doble Banda)' },
        // B-03: East deep borehole
        { p1: { x: caveRight + 30, y: ySurface }, p2: { x: caveRight + 30, y: yHaulage + 20 }, color: '#00ffa3', label: 'B-03 (DSS Strain)' },
        // B-04: East inclined borehole
        { p1: { x: caveRight + 65, y: ySurface }, p2: { x: caveCenterX + 40, y: yAirGap - 30 }, color: '#00f0ff', label: 'B-04 (DAS)' },
        // Underground probes drilled from production drift into virgin abutment
        { p1: { x: caveLeft - 60, y: yProduction }, p2: { x: caveLeft - 110, y: yCaveTop + 20 }, color: '#00ffa3', label: 'Sondaje Abutment' },
        { p1: { x: caveRight + 60, y: yProduction }, p2: { x: caveRight + 110, y: yCaveTop + 20 }, color: '#00ffa3', label: 'Sondaje Abutment' }
      ];

      // Draw Steel Casing & Continuous Optical Filament
      fiberBoreholes.forEach((bh, idx) => {
        // Casing tube
        ctx.strokeStyle = 'rgba(11, 32, 56, 0.85)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(bh.p1.x, bh.p1.y);
        ctx.lineTo(bh.p2.x, bh.p2.y);
        ctx.stroke();

        // Check if any active seismic waves intersect this cable
        let cableBurst = 0;
        activeWaves.forEach(w => {
          // Approximate distance from wave hypocenter to line segment
          const d = distToSegment({ x: w.x, y: w.y }, bh.p1, bh.p2);
          if (Math.abs(d - w.radiusP) < 14) {
            cableBurst = Math.max(cableBurst, 1.0 - (w.radiusP / w.maxRadius));
          }
        });

        // Breathing glow + acoustic burst
        const breathing = Math.sin(time * 3 + idx * 0.8) * 0.15;
        const alpha = Math.min(1.0, 0.72 + breathing + cableBurst * 0.5);

        // Neon Plasma Aura
        ctx.save();
        ctx.strokeStyle = cableBurst > 0.1 ? '#ffffff' : bh.color;
        ctx.lineWidth = cableBurst > 0.1 ? 3.5 : 2.2;
        ctx.shadowColor = bh.color;
        ctx.shadowBlur = cableBurst > 0.1 ? 16 : 8;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(bh.p1.x, bh.p1.y);
        ctx.lineTo(bh.p2.x, bh.p2.y);
        ctx.stroke();
        ctx.restore();

        // White-hot center filament
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bh.p1.x, bh.p1.y);
        ctx.lineTo(bh.p2.x, bh.p2.y);
        ctx.stroke();

        // Label at top
        if (bh.p1.y === ySurface) {
          ctx.fillStyle = bh.color;
          ctx.font = '8px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(bh.label, bh.p1.x, bh.p1.y - 6);
        }
      });

      // Tunnel Fiber Cable (Continuous loop on drift roofs)
      ctx.save();
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      // Production drift roof loop
      ctx.moveTo(caveLeft - 60, yProduction - 5);
      ctx.lineTo(caveRight + 60, yProduction - 5);
      // Undercut drift roof loop
      ctx.moveTo(caveLeft - 30, yUndercut - 4);
      ctx.lineTo(caveRight + 30, yUndercut - 4);
      ctx.stroke();
      ctx.restore();

      // Optical Trunk Cable up the shaft to interrogator
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(caveLeft - 60, yProduction - 5);
      ctx.lineTo(shaftX, yProduction - 5);
      ctx.lineTo(shaftX, ySurface);
      ctx.lineTo(mainWidth * 0.22, ySurface);
      ctx.stroke();
    }

    // 7. SEISMIC WAVEFIELD PROPAGATION (P-wave & S-wavefronts)
    for (let wIdx = activeWaves.length - 1; wIdx >= 0; wIdx--) {
      const w = activeWaves[wIdx];
      w.radiusP += w.speedP;
      w.radiusS += w.speedS;
      w.alpha = Math.max(0, 1.0 - (w.radiusP / w.maxRadius));

      if (w.alpha <= 0) {
        activeWaves.splice(wIdx, 1);
        continue;
      }

      // Fast Compressional P-wave (Cyan / White)
      ctx.save();
      ctx.strokeStyle = activeMode === 'dfos' ? 'rgba(0, 240, 255, ' + (w.alpha * 0.85) + ')' : 'rgba(255, 75, 85, ' + (w.alpha * 0.75) + ')';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.radiusP, 0, Math.PI * 2);
      ctx.stroke();

      // Slower Shear S-wave (Amber)
      if (w.radiusS > 0) {
        ctx.strokeStyle = 'rgba(255, 200, 59, ' + (w.alpha * 0.65) + ')';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(w.x, w.y, w.radiusS, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // Push into Waterfall buffer if in DFOS mode
      if (activeMode === 'dfos' && showWaterfall) {
        const row = Math.floor(Math.min(WATERFALL_ROWS - 1, Math.max(0, ((w.y - ySurface) / (yBottom - ySurface)) * WATERFALL_ROWS)));
        const intensity = Math.min(1.0, w.alpha * 1.5);
        waterfallBuffer[row][0] = Math.max(waterfallBuffer[row][0], intensity);
        // Chevron spread to adjacent channels
        const spread = Math.floor(w.radiusP / 12);
        if (row - spread >= 0) waterfallBuffer[row - spread][0] = Math.max(waterfallBuffer[row - spread][0], intensity * 0.7);
        if (row + spread < WATERFALL_ROWS) waterfallBuffer[row + spread][0] = Math.max(waterfallBuffer[row + spread][0], intensity * 0.7);
      }
    }

    // 8. MICROSEISMIC FRACTURE SPOTS (Appearing and fading)
    for (let cIdx = microCracks.length - 1; cIdx >= 0; cIdx--) {
      const c = microCracks[cIdx];
      c.alpha -= 0.015;

      if (c.alpha <= 0) {
        microCracks.splice(cIdx, 1);
        continue;
      }

      ctx.save();
      ctx.fillStyle = c.color;
      ctx.globalAlpha = c.alpha;
      ctx.shadowColor = c.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.size * (0.6 + (1.0 - c.alpha) * 0.4), 0, Math.PI * 2);
      ctx.fill();

      // Star crossburst
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      const s = c.size * 1.2;
      ctx.beginPath();
      ctx.moveTo(c.x - s, c.y);
      ctx.lineTo(c.x + s, c.y);
      ctx.moveTo(c.x, c.y - s);
      ctx.lineTo(c.x, c.y + s);
      ctx.stroke();
      ctx.restore();
    }

    // Organic Natural Fracturing around Cave-Back: Trigger spontaneous microevent
    if (Math.random() < 0.025) {
      const angle = Math.random() * Math.PI;
      const rx = caveCenterX + Math.cos(angle) * (caveRight - caveLeft) * 0.45;
      const ry = yCaveTop + 25 + (Math.sin(angle) * 45) + (Math.random() - 0.5) * 35;
      const mag = -1.2 - Math.random() * 1.2;
      triggerSeismicEvent(rx, ry, mag, true);
    }

    // 9. LIVE SYNTHETIC DAS WATERFALL DISPLAY (Right side dock)
    if (showWaterfall) {
      drawDASWaterfall(mainWidth, ySurface, width - mainWidth - 10, yBottom - ySurface);
    }

    animId = requestAnimationFrame(draw);
  }

  // -------------------------------------------------------------
  // DAS WATERFALL RENDERER (Depth vs Time matrix)
  // -------------------------------------------------------------
  function drawDASWaterfall(x, y, w, h) {
    // Scroll waterfall columns to the right
    for (let r = 0; r < WATERFALL_ROWS; r++) {
      const row = waterfallBuffer[r];
      for (let c = WATERFALL_WIDTH - 1; c > 0; c--) {
        row[c] = row[c - 1] * 0.985; // smooth temporal decay
      }
      row[0] *= 0.88; // decay incoming tap
    }

    ctx.save();
    // Sub-panel box
    ctx.fillStyle = '#050912';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // Title banner
    ctx.fillStyle = 'rgba(6, 15, 28, 0.9)';
    ctx.fillRect(x, y, w, 22);
    ctx.fillStyle = activeMode === 'dfos' ? '#00f0ff' : '#ff4b55';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(activeMode === 'dfos' ? 'DAS WATERFALL · B-02' : 'SIN DATOS CONTINUOS', x + w / 2, y + 14);

    if (activeMode === 'dfos') {
      const cellW = (w - 8) / WATERFALL_WIDTH;
      const cellH = (h - 32) / WATERFALL_ROWS;

      for (let r = 0; r < WATERFALL_ROWS; r++) {
        const ry = y + 26 + r * cellH;
        for (let c = 0; c < WATERFALL_WIDTH; c++) {
          const val = waterfallBuffer[r][c];
          if (val > 0.05) {
            const rx = x + 4 + c * cellW;
            // False-color colormap (Navy -> Cyan -> Yellow -> White)
            if (val > 0.7) ctx.fillStyle = 'rgba(255, 255, 255, ' + val + ')';
            else if (val > 0.4) ctx.fillStyle = 'rgba(255, 200, 50, ' + val + ')';
            else ctx.fillStyle = 'rgba(0, 240, 255, ' + val + ')';

            ctx.fillRect(rx, ry, cellW + 0.5, cellH + 0.5);
          }
        }
      }

      // Depth ticks along waterfall
      ctx.fillStyle = '#4d5c75';
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('0 m', x + 6, y + 36);
      ctx.fillText('-1000m', x + 6, y + (h * 0.45));
      ctx.fillText('-2000m', x + 6, y + h - 8);

      // Time arrow
      ctx.textAlign = 'right';
      ctx.fillText('t →', x + w - 6, y + h - 8);
    } else {
      // Traditional mode: no continuous waterfall data!
      ctx.fillStyle = 'rgba(255, 75, 85, 0.6)';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('0 canales continuos', x + w / 2, y + h * 0.4);
      ctx.fillText('Solo 4 balizas discretas', x + w / 2, y + h * 0.4 + 16);
      ctx.fillText('Ciego a ondas P/S', x + w / 2, y + h * 0.4 + 32);
    }

    ctx.restore();
  }

  // Math helper: distance from point p to line segment (v, w)
  function distToSegment(p, v, w) {
    const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  }

  // Auto-init
  setupUIControls();
  draw();

})();
