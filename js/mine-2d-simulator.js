/* ============================================================
   FIBERANDES — 2D Interactive Mine Geomechanics Simulator
   Corte Transversal Block Caving: DAS Continuo vs. Geófonos en Túneles
   Enfoque en Atenuación Sísmica (1/r y Q) & Detección de Microsismos (Mw < 0)
   ============================================================ */
(function() {
  'use strict';

  const container = document.getElementById('mine-3d-canvas-container');
  if (!container) return;

  container.innerHTML = '';

  const canvas = document.createElement('canvas');
  canvas.id = 'mine-2d-canvas';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.cursor = 'crosshair';
  container.appendChild(canvas);

  // Overlay hint
  const overlayHint = document.createElement('div');
  overlayHint.className = 'sim-overlay-hint';
  overlayHint.innerHTML = '<span>🖱️ Haz clic en cualquier lugar del macizo rocoso para detonar una microsismicidad y observar su atenuación</span>';
  container.appendChild(overlayHint);

  // Status banner
  const statusBanner = document.createElement('div');
  statusBanner.id = 'sim-status-banner';
  statusBanner.className = 'sim-status-banner detected';
  statusBanner.innerHTML = '<strong>FIBERANDES DAS: SONDAJES + GALERÍAS</strong> — 8.500 canales ópticos continuos cada 1m · Captura la onda a corta distancia antes de que la roca la atenúe · Incertidumbre: ±1.8 m';
  container.appendChild(statusBanner);

  // Technical Legend
  const legend = document.createElement('div');
  legend.className = 'sim-3d-legend';
  legend.innerHTML = `
    <div class="legend-item"><span class="legend-color cyan"></span><span>Sondajes DAS Fibra Continua (FiberAndes)</span></div>
    <div class="legend-item"><span class="legend-color" style="background:#ffb020; box-shadow:0 0 6px #ffb020;"></span><span>Geófonos &amp; Sismógrafos Puntuales (En Túneles)</span></div>
    <div class="legend-item"><span class="legend-color" style="background:#ff281a; box-shadow:0 0 8px rgba(255,40,26,0.7);"></span><span>Bóveda Cave-Back &amp; Air Gap (Hundimiento)</span></div>
    <div class="legend-item"><span class="legend-color" style="background:#00ffa3; box-shadow:0 0 6px #00ffa3;"></span><span>Onda Sísmica Fresca (Alta Energía / SNR &gt; 35 dB)</span></div>
    <div class="legend-item"><span class="legend-color" style="background:#4d5c75; box-shadow:0 0 4px #4d5c75;"></span><span>Límite de Atenuación Inelástica (Señal disipada)</span></div>
    <div class="legend-item"><span class="legend-color red"></span><span>Zona Ciega por Distancia (&gt;300 m a Túneles)</span></div>
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

  // Active seismic waves
  let activeWaves = [];
  let microCracks = [];

  // Attenuation physics constants
  // Microseisms (Mw < 0, ~200-800 Hz) attenuate severely in jointed rock
  // In our model: ~210px corresponds to ~320m in the rock mass where high frequencies die
  const ATTENUATION_LIMIT_RADIUS = 210;

  // Synthetic DAS Waterfall history buffer (time rolling)
  const WATERFALL_WIDTH = 130;
  const WATERFALL_ROWS = 70;
  const waterfallBuffer = [];
  for (let r = 0; r < WATERFALL_ROWS; r++) {
    waterfallBuffer.push(new Float32Array(WATERFALL_WIDTH));
  }

  function getDepthY(depthMeters) {
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

  // Geophone network station locations (in mining tunnels)
  function getGeophoneStations(mainWidth, yProduction, yUndercut, yHaulage, shaftX, caveLeft, caveRight, caveCenterX) {
    return [
      { id: 'G-01', x: caveLeft - 50, y: yProduction, name: 'Producción Oeste' },
      { id: 'G-02', x: caveLeft - 10, y: yProduction, name: 'Producción Central O' },
      { id: 'G-03', x: caveCenterX, y: yProduction, name: 'Producción Eje' },
      { id: 'G-04', x: caveRight + 10, y: yProduction, name: 'Producción Central E' },
      { id: 'G-05', x: caveRight + 50, y: yProduction, name: 'Producción Este' },
      { id: 'G-06', x: caveLeft - 20, y: yUndercut, name: 'Undercut O' },
      { id: 'G-07', x: caveCenterX, y: yUndercut, name: 'Undercut Eje' },
      { id: 'G-08', x: caveRight + 20, y: yUndercut, name: 'Undercut E' },
      { id: 'G-09', x: caveLeft - 40, y: yHaulage, name: 'Transporte O' },
      { id: 'G-10', x: caveRight + 40, y: yHaulage, name: 'Transporte E' },
      { id: 'G-11', x: shaftX, y: (yProduction + 52) / 2, name: 'Pique Ventilación' }
    ];
  }

  // -------------------------------------------------------------
  // TRIGGER SEISMIC EVENT WITH ATTENUATION
  // -------------------------------------------------------------
  function triggerSeismicEvent(x, y, mag = -1.2, isCaveBackFracture = false) {
    const wave = {
      x,
      y,
      mag,
      radiusP: 0,
      radiusS: 0,
      speedP: 4.2,   // P-wave compressional speed (~5.5 km/s)
      speedS: 2.4,   // S-wave shear speed (~3.2 km/s)
      maxRadius: Math.max(width, height),
      alpha: 1.0,
      isCaveBack: isCaveBackFracture,
      closestFiberDist: Infinity,
      closestGeophoneDist: Infinity,
      detectedByDAS: false,
      detectedByGeophone: false
    };
    activeWaves.push(wave);

    microCracks.push({
      x,
      y,
      alpha: 1.0,
      size: 7 + Math.abs(mag) * 3,
      color: mag > -0.5 ? '#ff4b55' : (mag > -1.2 ? '#ffc83b' : '#00f0ff')
    });

    // Check distance to closest tunnel geophone (production level is around getDepthY(1820))
    const yProduction = getDepthY(1820);
    const distToTunnels = Math.abs(y - yProduction);

    const banner = document.getElementById('sim-status-banner');
    if (banner) {
      if (activeMode === 'dfos') {
        const depthEst = Math.round(((y - 52) / (height - 94)) * 2200);
        banner.className = 'sim-status-banner detected';
        banner.innerHTML = `<strong>⚡ EVENTO DETECTADO POR DAS EN MACIZO ROCOSO</strong> — Profundidad: -${depthEst} m · Mw ${mag.toFixed(1)} · Capturado a &lt;35 m antes de atenuarse (SNR 44 dB) · Incertidumbre: ±1.8 m`;
      } else {
        // In Traditional Mode: check if wave attenuates before reaching tunnels
        if (distToTunnels > ATTENUATION_LIMIT_RADIUS * 0.85) {
          banner.className = 'sim-status-banner blindspot';
          banner.innerHTML = `<strong>❌ ONDA ATENUADA: EVENTO INVISIBLE PARA GEÓFONOS</strong> — A ${Math.round(distToTunnels * 1.6)} m de distancia, las ondas P/S (&gt;150 Hz) se disiparon en la roca bajo el piso de ruido · Geófonos en túneles: 0% detección`;
        } else {
          banner.className = 'sim-status-banner detected';
          banner.innerHTML = `<strong>⚠️ EVENTO DETECTADO POR GEÓFONO CERCANO</strong> — Captado en galería de producción · Alta incertidumbre por red plana: ±26 m · 0% datos de deformación continua`;
        }
      }
    }
  }

  // Click on rock mass
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (y > 45 && x < width - 150) {
      const mag = -0.5 - Math.random() * 1.5;
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
        banner.innerHTML = '<strong>FIBERANDES DAS: SONDAJES + GALERÍAS</strong> — 8.500 canales ópticos continuos cada 1m · Captura la onda a corta distancia antes de que la roca la atenúe · Incertidumbre: ±1.8 m';
      }
      updateTelemetry(98, "8.500 Canales Ópticos", "±1.8 metros", "Activo (Doble Banda)");
    } else {
      if (banner) {
        banner.className = 'sim-status-banner blindspot';
        banner.innerHTML = '<strong>RED SÍSMICA TRADICIONAL (GEÓFONOS EN TÚNELES)</strong> — 11 geófonos confinados a galerías · Ondas de microsismos se atenúan a &gt;250m · 82% del macizo rocoso sin visibilidad';
      }
      updateTelemetry(18, "11 Geófonos en Túneles", "±28 metros", "0% (Ciego en macizo)");
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
        const caveCenterX = (width - 150) * 0.52;
        const caveBackY = getDepthY(1020);
        triggerSeismicEvent(caveCenterX, caveBackY, -1.3, true);
      });
    }
  }

  // -------------------------------------------------------------
  // MAIN RENDER LOOP
  // -------------------------------------------------------------
  function draw() {
    time += 0.02;

    ctx.clearRect(0, 0, width, height);

    const mainWidth = width > 750 ? width - 165 : width;
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
    const shaftX = caveLeft - 70;

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
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.035)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 14]);
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
    ctx.bezierCurveTo(mainWidth * 0.7, ySurface - 12, mainWidth * 0.3, ySurface + 8, 0, ySurface - 5);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#2b3f5c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, ySurface - 5);
    ctx.bezierCurveTo(mainWidth * 0.3, ySurface + 8, mainWidth * 0.7, ySurface - 12, mainWidth, ySurface);
    ctx.stroke();

    // Surface facilities (Headframe / Interrogator)
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

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let r = 0; r < 24; r++) {
      const rx = caveLeft + 30 + ((r * 37) % (caveRight - caveLeft - 60));
      const ry = yAirGap + 25 + ((r * 29) % (yUndercut - yAirGap - 35));
      ctx.strokeRect(rx, ry, 6 + (r % 5), 4 + (r % 4));
    }

    // B. Air Gap
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
    ctx.fillText('Foco de microsismicidad activa (Mw < 0) y fracturamiento', caveCenterX, yCaveTop + 1);

    // D. Drawbells (Zanjas de Extracción)
    const bellCount = 5;
    const bellSpacing = (caveRight - caveLeft - 30) / (bellCount - 1);
    for (let b = 0; b < bellCount; b++) {
      const bx = caveLeft + 15 + b * bellSpacing;
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

      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(bx - 4, yProduction - 10, 8, 4);
    }

    // 5. MINING TUNNELS (Galerías de Mina)
    // Undercut Level
    ctx.fillStyle = '#111c2b';
    ctx.strokeStyle = '#00e1ff';
    ctx.lineWidth = 1;
    ctx.fillRect(caveLeft - 30, yUndercut - 5, (caveRight - caveLeft) + 60, 10);
    ctx.strokeRect(caveLeft - 30, yUndercut - 5, (caveRight - caveLeft) + 60, 10);

    // Production Level
    ctx.fillStyle = '#111c2b';
    ctx.fillRect(caveLeft - 60, yProduction - 6, (caveRight - caveLeft) + 120, 12);
    ctx.strokeRect(caveLeft - 60, yProduction - 6, (caveRight - caveLeft) + 120, 12);

    for (let lx = caveLeft - 50; lx <= caveRight + 50; lx += 45) {
      ctx.fillStyle = '#ffb020';
      ctx.beginPath();
      ctx.arc(lx, yProduction - 2, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Haulage Level
    ctx.fillStyle = '#0d1624';
    ctx.fillRect(caveLeft - 80, yHaulage - 8, (caveRight - caveLeft) + 160, 16);
    ctx.strokeStyle = '#00a3ff';
    ctx.strokeRect(caveLeft - 80, yHaulage - 8, (caveRight - caveLeft) + 160, 16);

    // Ventilation Shaft
    ctx.fillStyle = '#0c1522';
    ctx.fillRect(shaftX - 6, ySurface, 12, yHaulage - ySurface);
    ctx.strokeStyle = 'rgba(0, 225, 255, 0.4)';
    ctx.strokeRect(shaftX - 6, ySurface, 12, yHaulage - ySurface);

    // 6. INSTRUMENTATION LAYERS (Mode Dependent)
    const geophoneStations = getGeophoneStations(mainWidth, yProduction, yUndercut, yHaulage, shaftX, caveLeft, caveRight, caveCenterX);

    if (activeMode === 'geophones') {
      // ---------------------------------------------------------
      // MODE: TRADITIONAL POINT SEISMOLOGY (GEOPHONES IN TUNNELS)
      // ---------------------------------------------------------

      // A. Massive Red Blind Spot Shading (Rock Mass with NO sensors)
      ctx.save();
      ctx.fillStyle = 'rgba(255, 75, 85, 0.16)';
      ctx.beginPath();
      ctx.moveTo(caveLeft - 60, yUndercut - 10);
      ctx.lineTo(caveRight + 60, yUndercut - 10);
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
      ctx.fillRect(caveCenterX - 130, yCaveTop - 78, 260, 40);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(caveCenterX - 130, yCaveTop - 78, 260, 40);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚠️ ZONA CIEGA POR ATENUACIÓN', caveCenterX, yCaveTop - 62);
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText('>350 m a los geófonos de túnel · Frecuencias >150 Hz disipadas', caveCenterX, yCaveTop - 47);
      ctx.restore();

      // B. Discrete Geophone / Seismograph Stations (Only inside tunnels)
      geophoneStations.forEach((geo, idx) => {
        // Check if any active seismic waves reached this geophone
        let hitIntensity = 0;
        activeWaves.forEach(w => {
          const d = Math.hypot(geo.x - w.x, geo.y - w.y);
          // If wave reached station
          if (Math.abs(d - w.radiusP) < 18) {
            // Check attenuation at this distance
            const atten = Math.pow(Math.max(0, 1.0 - (d / ATTENUATION_LIMIT_RADIUS)), 2.0);
            hitIntensity = Math.max(hitIntensity, atten);
          }
        });

        // Geophone station triangle icon
        ctx.save();
        ctx.fillStyle = hitIntensity > 0.08 ? '#ff4b55' : '#ffb020';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(geo.x, geo.y - 14);
        ctx.lineTo(geo.x + 6, geo.y - 3);
        ctx.lineTo(geo.x - 6, geo.y - 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Pulsing reception ring
        const ringR = 7 + Math.sin(time * 3 + idx) * 2.5;
        ctx.strokeStyle = hitIntensity > 0.08 ? 'rgba(255, 75, 85, 0.8)' : 'rgba(255, 176, 32, 0.35)';
        ctx.beginPath();
        ctx.arc(geo.x, geo.y - 8, ringR, 0, Math.PI * 2);
        ctx.stroke();

        // Label
        ctx.fillStyle = '#ffc83b';
        ctx.font = '8px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(geo.id, geo.x, geo.y + 10);
        ctx.restore();
      });

    } else {
      // ---------------------------------------------------------
      // MODE: FIBERANDES DFOS (CONTINUOUS FIBER ARRAY IN BOREHOLES)
      // ---------------------------------------------------------

      const fiberBoreholes = [
        { p1: { x: caveLeft - 30, y: ySurface }, p2: { x: caveLeft - 30, y: yHaulage + 20 }, color: '#00f0ff', label: 'B-01 (DAS)' },
        { p1: { x: mainWidth * 0.22, y: ySurface }, p2: { x: caveCenterX, y: yProduction + 10 }, color: '#00f0ff', label: 'B-02 (DAS Doble Banda)' },
        { p1: { x: caveRight + 30, y: ySurface }, p2: { x: caveRight + 30, y: yHaulage + 20 }, color: '#00ffa3', label: 'B-03 (DSS Strain)' },
        { p1: { x: caveRight + 65, y: ySurface }, p2: { x: caveCenterX + 40, y: yAirGap - 30 }, color: '#00f0ff', label: 'B-04 (DAS)' },
        { p1: { x: caveLeft - 60, y: yProduction }, p2: { x: caveLeft - 110, y: yCaveTop + 20 }, color: '#00ffa3', label: 'Sondaje Abutment' },
        { p1: { x: caveRight + 60, y: yProduction }, p2: { x: caveRight + 110, y: yCaveTop + 20 }, color: '#00ffa3', label: 'Sondaje Abutment' }
      ];

      fiberBoreholes.forEach((bh, idx) => {
        // Casing tube
        ctx.strokeStyle = 'rgba(11, 32, 56, 0.85)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(bh.p1.x, bh.p1.y);
        ctx.lineTo(bh.p2.x, bh.p2.y);
        ctx.stroke();

        // Check if wave intersects this cable within fresh unattenuated distance
        let cableBurst = 0;
        activeWaves.forEach(w => {
          const d = distToSegment({ x: w.x, y: w.y }, bh.p1, bh.p2);
          if (Math.abs(d - w.radiusP) < 14) {
            // Signal strength depends on distance from hypocenter to cable
            const unattenuatedFactor = Math.pow(Math.max(0, 1.0 - (d / ATTENUATION_LIMIT_RADIUS)), 1.4);
            cableBurst = Math.max(cableBurst, unattenuatedFactor);
          }
        });

        const breathing = Math.sin(time * 3 + idx * 0.8) * 0.12;
        const alpha = Math.min(1.0, 0.72 + breathing + cableBurst * 0.6);

        // Neon Plasma Aura
        ctx.save();
        ctx.strokeStyle = cableBurst > 0.15 ? '#ffffff' : bh.color;
        ctx.lineWidth = cableBurst > 0.15 ? 3.8 : 2.2;
        ctx.shadowColor = bh.color;
        ctx.shadowBlur = cableBurst > 0.15 ? 18 : 8;
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

        if (bh.p1.y === ySurface) {
          ctx.fillStyle = bh.color;
          ctx.font = '8px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(bh.label, bh.p1.x, bh.p1.y - 6);
        }
      });

      // Continuous Fiber in Tunnels
      ctx.save();
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.8;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(caveLeft - 60, yProduction - 5);
      ctx.lineTo(caveRight + 60, yProduction - 5);
      ctx.moveTo(caveLeft - 30, yUndercut - 4);
      ctx.lineTo(caveRight + 30, yUndercut - 4);
      ctx.stroke();
      ctx.restore();

      // Optical Trunk Cable up the shaft
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(caveLeft - 60, yProduction - 5);
      ctx.lineTo(shaftX, yProduction - 5);
      ctx.lineTo(shaftX, ySurface);
      ctx.lineTo(mainWidth * 0.22, ySurface);
      ctx.stroke();
    }

    // 7. SEISMIC WAVE PROPAGATION WITH PHYSICAL INELASTIC ATTENUATION
    for (let wIdx = activeWaves.length - 1; wIdx >= 0; wIdx--) {
      const w = activeWaves[wIdx];
      w.radiusP += w.speedP;
      w.radiusS += w.speedS;

      // Real Inelastic Attenuation (1/r and Q damping in rock mass)
      const distNormP = w.radiusP / ATTENUATION_LIMIT_RADIUS;
      const attenP = Math.pow(Math.max(0, 1.0 - distNormP), 1.9) * Math.exp(-distNormP * 1.3);

      const distNormS = w.radiusS / ATTENUATION_LIMIT_RADIUS;
      const attenS = Math.pow(Math.max(0, 1.0 - distNormS), 2.2) * Math.exp(-distNormS * 1.5);

      if (attenP <= 0.005) {
        activeWaves.splice(wIdx, 1);
        continue;
      }

      // Draw Attenuation Boundary Radius Circle around source
      ctx.save();
      ctx.strokeStyle = 'rgba(77, 92, 117, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(w.x, w.y, ATTENUATION_LIMIT_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label at bottom of attenuation sphere
      if (w.radiusP > 40 && w.radiusP < 140) {
        ctx.fillStyle = 'rgba(143, 159, 182, 0.7)';
        ctx.font = '8px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Límite de Detección de Microsismos (~300 m) · Frecuencias >150 Hz disipadas', w.x, w.y + ATTENUATION_LIMIT_RADIUS + 12);
      }
      ctx.restore();

      // Fast Compressional P-wave (Color and opacity attenuate with distance)
      ctx.save();
      if (activeMode === 'dfos') {
        // High-energy cyan near source, softening to faint cyan
        ctx.strokeStyle = 'rgba(0, 240, 255, ' + (attenP * 0.95) + ')';
        ctx.lineWidth = Math.max(1, 3.0 * attenP);
        if (attenP > 0.4) {
          ctx.shadowColor = '#00f0ff';
          ctx.shadowBlur = 10 * attenP;
        }
      } else {
        // Traditional mode: red wave that rapidly fades into extinction
        ctx.strokeStyle = 'rgba(255, 75, 85, ' + (attenP * 0.9) + ')';
        ctx.lineWidth = Math.max(1, 2.5 * attenP);
      }
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.radiusP, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Slower Shear S-wave (Amber, attenuates even faster due to higher shear damping)
      if (w.radiusS > 0 && attenS > 0.01) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 200, 59, ' + (attenS * 0.8) + ')';
        ctx.lineWidth = Math.max(1, 2.0 * attenS);
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(w.x, w.y, w.radiusS, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Waterfall push in DFOS mode
      if (activeMode === 'dfos' && showWaterfall) {
        const row = Math.floor(Math.min(WATERFALL_ROWS - 1, Math.max(0, ((w.y - ySurface) / (yBottom - ySurface)) * WATERFALL_ROWS)));
        const intensity = Math.min(1.0, attenP * 1.8);
        waterfallBuffer[row][0] = Math.max(waterfallBuffer[row][0], intensity);
        const spread = Math.floor(w.radiusP / 12);
        if (row - spread >= 0) waterfallBuffer[row - spread][0] = Math.max(waterfallBuffer[row - spread][0], intensity * 0.7);
        if (row + spread < WATERFALL_ROWS) waterfallBuffer[row + spread][0] = Math.max(waterfallBuffer[row + spread][0], intensity * 0.7);
      }
    }

    // 8. MICROSEISMIC FRACTURE SPOTS
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

    // Organic Natural Fracturing around Cave-Back
    if (Math.random() < 0.022) {
      const angle = Math.random() * Math.PI;
      const rx = caveCenterX + Math.cos(angle) * (caveRight - caveLeft) * 0.45;
      const ry = yCaveTop + 25 + (Math.sin(angle) * 45) + (Math.random() - 0.5) * 35;
      const mag = -1.2 - Math.random() * 1.2;
      triggerSeismicEvent(rx, ry, mag, true);
    }

    // 9. LIVE SYNTHETIC DAS WATERFALL DISPLAY
    if (showWaterfall) {
      drawDASWaterfall(mainWidth, ySurface, width - mainWidth - 10, yBottom - ySurface);
    }

    animId = requestAnimationFrame(draw);
  }

  // -------------------------------------------------------------
  // DAS WATERFALL RENDERER
  // -------------------------------------------------------------
  function drawDASWaterfall(x, y, w, h) {
    for (let r = 0; r < WATERFALL_ROWS; r++) {
      const row = waterfallBuffer[r];
      for (let c = WATERFALL_WIDTH - 1; c > 0; c--) {
        row[c] = row[c - 1] * 0.985;
      }
      row[0] *= 0.88;
    }

    ctx.save();
    ctx.fillStyle = '#050912';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = 'rgba(6, 15, 28, 0.9)';
    ctx.fillRect(x, y, w, 22);
    ctx.fillStyle = activeMode === 'dfos' ? '#00f0ff' : '#ff4b55';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(activeMode === 'dfos' ? 'DAS WATERFALL · B-02' : 'SIN REGISTRO CONTINUO', x + w / 2, y + 14);

    if (activeMode === 'dfos') {
      const cellW = (w - 8) / WATERFALL_WIDTH;
      const cellH = (h - 32) / WATERFALL_ROWS;

      for (let r = 0; r < WATERFALL_ROWS; r++) {
        const ry = y + 26 + r * cellH;
        for (let c = 0; c < WATERFALL_WIDTH; c++) {
          const val = waterfallBuffer[r][c];
          if (val > 0.05) {
            const rx = x + 4 + c * cellW;
            if (val > 0.7) ctx.fillStyle = 'rgba(255, 255, 255, ' + val + ')';
            else if (val > 0.4) ctx.fillStyle = 'rgba(255, 200, 50, ' + val + ')';
            else ctx.fillStyle = 'rgba(0, 240, 255, ' + val + ')';

            ctx.fillRect(rx, ry, cellW + 0.5, cellH + 0.5);
          }
        }
      }

      ctx.fillStyle = '#4d5c75';
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('0 m', x + 6, y + 36);
      ctx.fillText('-1000m', x + 6, y + (h * 0.45));
      ctx.fillText('-2000m', x + 6, y + h - 8);

      ctx.textAlign = 'right';
      ctx.fillText('t →', x + w - 6, y + h - 8);
    } else {
      ctx.fillStyle = 'rgba(255, 75, 85, 0.7)';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Geófonos a >300 m', x + w / 2, y + h * 0.38);
      ctx.fillText('Onda atenuada en roca', x + w / 2, y + h * 0.38 + 16);
      ctx.fillText('SNR < 1 (Bajo ruido)', x + w / 2, y + h * 0.38 + 32);
    }

    ctx.restore();
  }

  function distToSegment(p, v, w) {
    const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  }

  setupUIControls();
  draw();

})();
