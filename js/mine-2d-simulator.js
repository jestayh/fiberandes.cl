/* ============================================================
   FIBERANDES — 2D Interactive Mine Geomechanics Simulator
   Corte Transversal Block Caving: DAS Continuo vs. Geófonos en Túneles
   Zona Sismogénica, Riesgo de Estallido de Roca (Rockburst) y Atenuación Inelástica
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
  overlayHint.innerHTML = '<span>🖱️ Haz clic en la roca para detonar sismos · Prueba los 3 escenarios geomecánicos arriba</span>';
  container.appendChild(overlayHint);

  // Status banner
  const statusBanner = document.createElement('div');
  statusBanner.id = 'sim-status-banner';
  statusBanner.className = 'sim-status-banner detected';
  statusBanner.innerHTML = '<strong>FIBERANDES DAS: SONDAJES + GALERÍAS</strong> — 8.500 canales ópticos continuos cada 1m · Captura frentes P/S en macizo y slow-strain previo a estallidos de roca · Incertidumbre: ±1.8 m';
  container.appendChild(statusBanner);

  // Technical Legend
  const legend = document.createElement('div');
  legend.className = 'sim-3d-legend';
  legend.innerHTML = `
    <div class="legend-item"><span class="legend-color cyan"></span><span>Sondajes DAS Fibra Continua (FiberAndes)</span></div>
    <div class="legend-item"><span class="legend-color" style="background:#ffb020; box-shadow:0 0 6px #ffb020;"></span><span>Geófonos Triaxiales en Boreholes (15–25m fuera de EDZ)</span></div>
    <div class="legend-item"><span class="legend-color" style="background:#ff281a; box-shadow:0 0 8px rgba(255,40,26,0.7);"></span><span>Zona Sismogénica Activa (Concentración σ₁)</span></div>
    <div class="legend-item"><span class="legend-color" style="background:#ff6600; box-shadow:0 0 6px #ff6600;"></span><span>Pilares de Producción (Riesgo Estallido / Rockburst)</span></div>
    <div class="legend-item"><span class="legend-color" style="background:#00ffa3; box-shadow:0 0 6px #00ffa3;"></span><span>Onda Sísmica Fresca (Alta Energía / SNR &gt; 35 dB)</span></div>
    <div class="legend-item"><span class="legend-color red"></span><span>Vacío Superior (&gt;350 m a Boreholes)</span></div>
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

  // Active seismic waves and visual effects
  let activeWaves = [];
  let microCracks = [];
  let noticeToast = null; // Toast alert on canvas

  // Attenuation physics: High-frequency microseisms (>150 Hz) attenuate severely in jointed rock
  const ATTENUATION_LIMIT_RADIUS = 210; // ~320m in rock mass

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

  // Geophone network station locations (cemented in 15–25m boreholes outside the EDZ)
  function getGeophoneStations(mainWidth, yProduction, yUndercut, yHaulage, shaftX, caveLeft, caveRight, caveCenterX) {
    return [
      // Undercut Level (boreholes drilled upward/lateral into rock arch/shoulders)
      { id: 'G-01', tunnelX: caveLeft - 25, tunnelY: yUndercut - 5, x: caveLeft - 50, y: yUndercut - 26, depth: '20m', name: 'Undercut O (Borehole 20m +45°)' },
      { id: 'G-02', tunnelX: caveLeft + 25, tunnelY: yUndercut - 5, x: caveLeft + 18, y: yUndercut - 28, depth: '22m', name: 'Undercut Central O (Borehole 22m +80°)' },
      { id: 'G-03', tunnelX: caveRight - 25, tunnelY: yUndercut - 5, x: caveRight - 18, y: yUndercut - 28, depth: '22m', name: 'Undercut Central E (Borehole 22m +80°)' },
      { id: 'G-04', tunnelX: caveRight + 25, tunnelY: yUndercut - 5, x: caveRight + 50, y: yUndercut - 26, depth: '20m', name: 'Undercut E (Borehole 20m +45°)' },

      // Production Level (boreholes in abutments and deep into floor/invert)
      { id: 'G-05', tunnelX: caveLeft - 58, tunnelY: yProduction, x: caveLeft - 92, y: yProduction - 12, depth: '25m', name: 'Producción Abutment O (Borehole 25m horiz)' },
      { id: 'G-06', tunnelX: caveLeft - 15, tunnelY: yProduction + 6, x: caveLeft - 22, y: yProduction + 28, depth: '18m', name: 'Producción Piso O (Borehole 18m -60°)' },
      { id: 'G-07', tunnelX: caveRight + 15, tunnelY: yProduction + 6, x: caveRight + 22, y: yProduction + 28, depth: '18m', name: 'Producción Piso E (Borehole 18m -60°)' },
      { id: 'G-08', tunnelX: caveRight + 58, tunnelY: yProduction, x: caveRight + 92, y: yProduction - 12, depth: '25m', name: 'Producción Abutment E (Borehole 25m horiz)' },

      // Haulage / Transport Level (deep foundation boreholes)
      { id: 'G-09', tunnelX: caveLeft - 45, tunnelY: yHaulage + 8, x: caveLeft - 58, y: yHaulage + 30, depth: '22m', name: 'Transporte O (Borehole 22m piso)' },
      { id: 'G-10', tunnelX: caveRight + 45, tunnelY: yHaulage + 8, x: caveRight + 58, y: yHaulage + 30, depth: '22m', name: 'Transporte E (Borehole 22m piso)' },

      // Ventilation Shaft (competent rock wall boreholes)
      { id: 'G-11', tunnelX: shaftX - 6, tunnelY: (yProduction + 52) / 2, x: shaftX - 30, y: (yProduction + 52) / 2, depth: '20m', name: 'Pique Ventilación (Borehole 20m)' },
      { id: 'G-12', tunnelX: shaftX + 6, tunnelY: (yHaulage + yProduction) / 2, x: shaftX + 30, y: (yHaulage + yProduction) / 2, depth: '20m', name: 'Pique Profundo (Borehole 20m)' }
    ];
  }

  // -------------------------------------------------------------
  // GEOMECHANICAL VOID / MUCKPILE CLAMPING
  // Sismic events CANNOT occur inside the empty air gap or broken muckpile.
  // They occur in solid rock: the seismogenic shell above the cave-back,
  // the abutment pillars, or the production level pillars!
  // -------------------------------------------------------------
  function clampHypocenterToElasticRock(x, y, mainWidth) {
    const caveLeft = mainWidth * 0.32;
    const caveRight = mainWidth * 0.72;
    const caveCenterX = (caveLeft + caveRight) / 2;
    const yCaveTop = getDepthY(1000);
    const yAirGap = getDepthY(1400);
    const yUndercut = getDepthY(1650);
    const yProduction = getDepthY(1820);

    // Check if inside horizontal bounds of the cave cavity
    if (x >= caveLeft && x <= caveRight) {
      // Cave-back arch height at x
      const normX = (x - caveCenterX) / ((caveRight - caveLeft) / 2);
      const archY = yCaveTop + (normX * normX) * (yAirGap - yCaveTop);

      // Check if inside Air Gap void or Muckpile column
      if (y >= archY && y <= yUndercut) {
        // It's in the void or broken muckpile!
        // If clicked in upper half, snap up into the solid active seismogenic arch
        if (y < (archY + yUndercut) / 2) {
          showNotice('ℹ️ Cavidad vacía (Air Gap): sismo reubicado en la bóveda sismogénica de roca');
          return { x, y: archY - 18, zone: 'cave-back' };
        } else {
          // If clicked in lower half, snap down into solid pillars of production
          showNotice('ℹ️ Muckpile quebrado: sismo reubicado en pilares en carga de producción');
          return { x, y: yProduction - 2, zone: 'pillar' };
        }
      }
    }

    // Check if in pillar zone
    if (Math.abs(y - yProduction) < 25) {
      return { x, y, zone: 'pillar' };
    }

    return { x, y, zone: 'rock-mass' };
  }

  function showNotice(text) {
    noticeToast = { text, alpha: 1.0, timer: 180 };
  }

  // -------------------------------------------------------------
  // TRIGGER SEISMIC EVENT WITH ATTENUATION & GEOMECHANICAL INSIGHT
  // -------------------------------------------------------------
  function triggerSeismicEvent(rawX, rawY, mag = -1.2, forcedZone = null) {
    const mainWidth = width > 750 ? width - 165 : width;
    let clamped;

    if (forcedZone) {
      clamped = { x: rawX, y: rawY, zone: forcedZone };
    } else {
      clamped = clampHypocenterToElasticRock(rawX, rawY, mainWidth);
    }

    const { x, y, zone } = clamped;

    const wave = {
      x,
      y,
      mag,
      zone,
      radiusP: 0,
      radiusS: 0,
      speedP: 4.2,   // P-wave compressional speed (~5.5 km/s)
      speedS: 2.4,   // S-wave shear speed (~3.2 km/s)
      maxRadius: Math.max(width, height),
      alpha: 1.0
    };
    activeWaves.push(wave);

    microCracks.push({
      x,
      y,
      alpha: 1.0,
      size: 7 + Math.abs(mag) * 3,
      color: zone === 'pillar' ? '#ffaa00' : (mag > -0.5 ? '#ff4b55' : (mag > -1.2 ? '#ffc83b' : '#00f0ff'))
    });

    const yProduction = getDepthY(1820);
    const distToTunnels = Math.abs(y - yProduction);
    const depthEst = Math.round(((y - 52) / (height - 94)) * 2200);

    const banner = document.getElementById('sim-status-banner');
    if (banner) {
      if (activeMode === 'dfos') {
        if (zone === 'pillar') {
          // Rockburst in extraction pillar: Highlight DSS slow-strain detection before the burst!
          banner.className = 'sim-status-banner detected';
          banner.innerHTML = `<strong>⚠️ ESTALLIDO DE ROCA (ROCKBURST) EN PILAR P-03 (-${depthEst} m)</strong> — DAS localiza el evento dinámico al metro exacto · <strong>Sensor DSS en corona detectó microdeformación lenta previa (slow-strain +540 µε) horas antes</strong> · Geófonos tradicionales son 100% ciegos a la deformación previa`;
          updateTelemetry(98, "8.500 Canales Ópticos", "±1.2 metros", "Pre-alerta DSS (+540 µε)");
        } else if (zone === 'fault') {
          banner.className = 'sim-status-banner detected';
          banner.innerHTML = `<strong>📐 CIZALLE EN FALLA GEOLÓGICA ABUTMENT (-${depthEst} m)</strong> — Sondajes B-01 y sonda lateral interceptan el plano de falla · Captura de frentes P/S sin atenuación (SNR 42 dB) · Incertidumbre: ±1.5 m`;
          updateTelemetry(98, "8.500 Canales Ópticos", "±1.5 metros", "Cizalle Falla Activo");
        } else {
          banner.className = 'sim-status-banner detected';
          banner.innerHTML = `<strong>⚡ EVENTO EN ZONA SISMOGÉNICA CAVE-BACK (-${depthEst} m)</strong> — Sondaje B-02 a 24 m captura la onda fresca antes de disiparse (SNR 45 dB) · Frecuencias >200 Hz intactas · Incertidumbre: ±1.8 m`;
          updateTelemetry(98, "8.500 Canales Ópticos", "±1.8 metros", "Activo (Doble Banda)");
        }
      } else {
        // TRADITIONAL GEOPHONE NETWORK IN 3D BOREHOLES
        if (zone === 'pillar') {
          banner.className = 'sim-status-banner blindspot';
          banner.innerHTML = `<strong>💥 ESTALLIDO EN PILAR: BOREHOLES REGISTRAN ONDA DINÁMICA PERO 0% PRE-ALERTA</strong> — El geófono inercial en borehole captura la llegada de onda, pero no mide deformación lenta previa (0 Hz) · <strong>Sin aviso de evacuación</strong> · Incertidumbre de red: ±22 m`;
          updateTelemetry(25, "12 Geófonos en Boreholes", "±22 metros", "0% (Ciego a slow-strain)");
        } else if (distToTunnels > ATTENUATION_LIMIT_RADIUS * 0.8) {
          banner.className = 'sim-status-banner blindspot';
          banner.innerHTML = `<strong>❌ ONDA ATENUADA: CAVE-BACK INVISIBLE A BOREHOLES INFERIORES</strong> — A ${Math.round(distToTunnels * 1.6)} m de distancia, la roca fracturada disipa frecuencias de microsismos (>150 Hz) antes de llegar a los boreholes de Undercut/Producción · <strong>Vacío superior sobre el caving</strong> · Geófonos: 0% detección`;
          updateTelemetry(20, "12 Geófonos en Boreholes", "No detectado (Atenuado)", "0% (Ciego en macizo)");
        } else {
          banner.className = 'sim-status-banner detected';
          banner.innerHTML = `<strong>⚠️ EVENTO DETECTADO POR BOREHOLES CERCANOS</strong> — Señal puntual capturada fuera de la EDZ del túnel · Malla puntual discreta (12 estaciones) · Cero datos de deformación continua`;
          updateTelemetry(25, "12 Geófonos en Boreholes", "±18 metros", "0% (Sin slow-strain)");
        }
      }
    }
  }

  // Click on rock mass
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const mainWidth = width > 750 ? width - 165 : width;
    if (y > 45 && x < mainWidth) {
      const mag = -0.5 - Math.random() * 1.5;
      triggerSeismicEvent(x, y, mag, null);
    }
  });

  // Mode Switch
  function setMode(mode) {
    activeMode = mode;
    const banner = document.getElementById('sim-status-banner');

    if (mode === 'dfos') {
      if (banner) {
        banner.className = 'sim-status-banner detected';
        banner.innerHTML = '<strong>FIBERANDES DAS: SONDAJES + GALERÍAS</strong> — 8.500 canales ópticos continuos cada 1m · Captura frentes P/S en macizo y slow-strain previo a estallidos de roca · Incertidumbre: ±1.8 m';
      }
      updateTelemetry(98, "8.500 Canales Ópticos", "±1.8 metros", "Activo (Doble Banda)");
    } else {
      if (banner) {
        banner.className = 'sim-status-banner blindspot';
        banner.innerHTML = '<strong>RED SÍSMICA TRADICIONAL (GEÓFONOS TRIAXIALES EN BOREHOLES 3D)</strong> — 12 estaciones en perforaciones de 15-25m para salir de la EDZ · Cobertura 3D limitada a niveles de explotación · <strong>Vacío superior sobre Cave-Back</strong> y ciego a slow-strain previo (0 Hz)';
      }
      updateTelemetry(25, "12 Geófonos en Boreholes", "±22 metros", "0% (Ciego a slow-strain)");
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

    // Scenarios Buttons
    const btnSimCaveBack = document.getElementById('btn-sim-caveback') || document.getElementById('btn-simulate-event');
    const btnSimRockburst = document.getElementById('btn-sim-rockburst');
    const btnSimFault = document.getElementById('btn-sim-fault');

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

    // Scenario 1: Fracture in Seismogenic Cave-Back Arch (-1.000m)
    if (btnSimCaveBack) {
      btnSimCaveBack.addEventListener('click', () => {
        const mainWidth = width > 750 ? width - 165 : width;
        const caveCenterX = (mainWidth * 0.32 + mainWidth * 0.72) / 2;
        const caveBackY = getDepthY(1000) - 20;
        triggerSeismicEvent(caveCenterX, caveBackY, -1.3, 'cave-back');
      });
    }

    // Scenario 2: Rockburst Danger in Production Pillar (-1.820m)
    if (btnSimRockburst) {
      btnSimRockburst.addEventListener('click', () => {
        const mainWidth = width > 750 ? width - 165 : width;
        const caveLeft = mainWidth * 0.32;
        const caveRight = mainWidth * 0.72;
        // Target central extraction pillar between drawbell 2 and 3
        const pillarX = caveLeft + (caveRight - caveLeft) * 0.38;
        const pillarY = getDepthY(1820) - 2;
        triggerSeismicEvent(pillarX, pillarY, -0.6, 'pillar');
      });
    }

    // Scenario 3: Shear Slip in Yielded Fault / Abutment (-1.400m)
    if (btnSimFault) {
      btnSimFault.addEventListener('click', () => {
        const mainWidth = width > 750 ? width - 165 : width;
        const faultX = mainWidth * 0.26;
        const faultY = getDepthY(1400);
        triggerSeismicEvent(faultX, faultY, -1.0, 'fault');
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

    // Geological Fault Plane (Falla Geológica en Abutment Oeste)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 100, 50, 0.28)';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(mainWidth * 0.16, ySurface + 30);
    ctx.lineTo(mainWidth * 0.30, yHaulage + 20);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 120, 70, 0.6)';
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('Falla Geológica Abutment', mainWidth * 0.24, getDepthY(1100));
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

    // Surface facilities (DAS Interrogator shack)
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(mainWidth * 0.22 - 8, ySurface - 22, 16, 18);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(mainWidth * 0.22 - 8, ySurface - 22, 16, 18);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DAS INTERROGATOR', mainWidth * 0.22, ySurface - 26);

    // 4. BLOCK CAVING GEOMETRY & SEISMOGENIC ZONES
    // A. Muckpile (Broken Rock Column - INERT TO ELASTIC SEISMICITY)
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

    ctx.fillStyle = 'rgba(113, 130, 158, 0.45)';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MUCKPILE (MINERAL QUEBRADO · INERTE A CORTE ELÁSTICO)', caveCenterX, (yAirGap + yUndercut) / 2 + 10);

    // B. Air Gap (Open Void Space - CANNOT ACCUMULATE STRESS)
    ctx.fillStyle = 'rgba(3, 6, 12, 0.96)';
    ctx.beginPath();
    ctx.moveTo(caveLeft + 25, yAirGap + 20);
    ctx.quadraticCurveTo(caveCenterX, yAirGap + 5, caveRight - 25, yAirGap + 20);
    ctx.lineTo(caveRight - 10, yAirGap - 15);
    ctx.quadraticCurveTo(caveCenterX, yCaveTop + 25, caveLeft + 10, yAirGap - 15);
    ctx.closePath();
    ctx.fill();

    // Subtle void hatching
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 140, 40, 0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 6]);
    ctx.beginPath();
    ctx.moveTo(caveLeft + 35, yAirGap);
    ctx.lineTo(caveRight - 35, yAirGap);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = 'rgba(255, 140, 40, 0.75)';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('AIR GAP (CAVIDAD ABIERTA · VACÍO)', caveCenterX, yAirGap - 2);

    // C. ACTIVE SEISMOGENIC SHELL (ZONA SISMOGÉNICA ACTIVA - CONCENTRACIÓN σ₁)
    // This is the solid rock envelope surrounding and above the cave-back arch where all caving earthquakes occur
    ctx.save();
    ctx.fillStyle = 'rgba(255, 40, 26, 0.08)';
    ctx.beginPath();
    ctx.moveTo(caveLeft - 25, yAirGap);
    ctx.quadraticCurveTo(caveCenterX, yCaveTop - 55, caveRight + 25, yAirGap);
    ctx.lineTo(caveRight + 10, yAirGap);
    ctx.quadraticCurveTo(caveCenterX, yCaveTop, caveLeft - 10, yAirGap);
    ctx.closePath();
    ctx.fill();

    // Isostress contour rings (concentración de esfuerzos)
    ctx.strokeStyle = 'rgba(255, 75, 85, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(caveLeft - 22, yAirGap);
    ctx.quadraticCurveTo(caveCenterX, yCaveTop - 45, caveRight + 22, yAirGap);
    ctx.moveTo(caveLeft - 15, yAirGap);
    ctx.quadraticCurveTo(caveCenterX, yCaveTop - 25, caveRight + 15, yAirGap);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Cave-Back boundary
    ctx.save();
    ctx.strokeStyle = '#ff281a';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ff281a';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(caveLeft - 10, yAirGap);
    ctx.quadraticCurveTo(caveCenterX, yCaveTop, caveRight + 10, yAirGap);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#ff6644';
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BÓVEDA CAVE-BACK & ZONA SISMOGÉNICA (-1.000 m)', caveCenterX, yCaveTop - 12);
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = '#8f9fb6';
    ctx.fillText('Concentración de esfuerzos σ₁ y microfisuración activa', caveCenterX, yCaveTop + 1);

    // D. Drawbells (Zanjas y Bateas de Extracción)
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

    // 5. UNDERGROUND MINING TUNNELS & EXTRACTION PILLARS (ROCKBURST HAZARD)
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

    // Extraction Pillars (Pilares entre bateas) - Highlighted Rockburst Hazard
    ctx.save();
    for (let b = 0; b < bellCount - 1; b++) {
      const pLeft = caveLeft + 15 + b * bellSpacing + 12;
      const pRight = caveLeft + 15 + (b + 1) * bellSpacing - 12;
      const pWidth = pRight - pLeft;

      // Pillar rock block
      ctx.fillStyle = 'rgba(255, 102, 0, 0.15)';
      ctx.fillRect(pLeft, yUndercut, pWidth, yProduction - yUndercut - 6);
      ctx.strokeStyle = 'rgba(255, 130, 20, 0.45)';
      ctx.lineWidth = 1;
      ctx.strokeRect(pLeft, yUndercut, pWidth, yProduction - yUndercut - 6);
    }

    // Rockburst Danger Callout Label on Pillars
    ctx.fillStyle = '#ffaa33';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⚠️ PILARES EN CARGA: RIESGO DE ESTALLIDO DE ROCA (ROCKBURST)', caveCenterX, yProduction + 22);
    ctx.restore();

    // Amber lamps in production drift
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

      // A. Upper Blind Spot (Vacío Superior & Atenuación Inelástica Q)
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

      // Warning Badge in Upper Blind Spot Center
      ctx.save();
      ctx.fillStyle = 'rgba(255, 40, 26, 0.92)';
      ctx.shadowColor = '#ff281a';
      ctx.shadowBlur = 10;
      const bW = 380;
      ctx.fillRect(caveCenterX - bW / 2, yCaveTop - 84, bW, 48);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(caveCenterX - bW / 2, yCaveTop - 84, bW, 48);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚠️ VACÍO SUPERIOR: SIN TÚNELES SOBRE CAVE-BACK', caveCenterX, yCaveTop - 67);
      ctx.font = '8.5px "JetBrains Mono", monospace';
      ctx.fillStyle = '#fce4e4';
      ctx.fillText('Red 3D pierde apertura en cota al ascender el caving · Distancia >400m', caveCenterX, yCaveTop - 53);
      ctx.fillText('Ondas de alta frecuencia (>150 Hz) disipadas antes de llegar a boreholes inferiores', caveCenterX, yCaveTop - 41);
      ctx.restore();

      // B. Excavation Damaged Zone (EDZ, 2-4m) around drifts
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 176, 32, 0.28)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.strokeRect(caveLeft - 36, yUndercut - 10, (caveRight - caveLeft) + 72, 20);
      ctx.strokeRect(caveLeft - 66, yProduction - 11, (caveRight - caveLeft) + 132, 22);
      ctx.strokeRect(caveLeft - 86, yHaulage - 13, (caveRight - caveLeft) + 172, 26);

      ctx.fillStyle = 'rgba(255, 176, 32, 0.55)';
      ctx.font = '7.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText('Halo EDZ (2-4m daño tronadura)', caveLeft - 72, yProduction - 14);
      ctx.restore();

      // C. Discrete Triaxial Geophone Stations in Cemented Boreholes (15–25m into Virgin Rock)
      geophoneStations.forEach((geo, idx) => {
        let hitIntensity = 0;
        activeWaves.forEach(w => {
          const d = Math.hypot(geo.x - w.x, geo.y - w.y);
          if (Math.abs(d - w.radiusP) < 18) {
            const atten = Math.pow(Math.max(0, 1.0 - (d / ATTENUATION_LIMIT_RADIUS)), 2.0);
            hitIntensity = Math.max(hitIntensity, atten);
          }
        });

        // 1. Drilled Borehole line & Grout Sheath (from tunnel perimeter into solid rock)
        ctx.save();
        ctx.strokeStyle = 'rgba(100, 120, 150, 0.45)';
        ctx.lineWidth = 4; // Cement grout seal
        ctx.beginPath();
        ctx.moveTo(geo.tunnelX, geo.tunnelY);
        ctx.lineTo(geo.x, geo.y);
        ctx.stroke();

        ctx.strokeStyle = '#7a93b4';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(geo.tunnelX, geo.tunnelY);
        ctx.lineTo(geo.x, geo.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Borehole collar at tunnel wall
        ctx.fillStyle = '#ffb020';
        ctx.fillRect(geo.tunnelX - 2, geo.tunnelY - 2, 4, 4);

        // 2. Triaxial Geophone Sensor Capsule in Competent Rock (Beyond EDZ)
        const capsuleColor = hitIntensity > 0.08 ? '#ff4b55' : '#ffb020';
        ctx.fillStyle = capsuleColor;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.shadowColor = capsuleColor;
        ctx.shadowBlur = hitIntensity > 0.08 ? 14 : 5;

        // Triaxial sensor capsule
        const sSize = 7;
        ctx.fillRect(geo.x - sSize / 2, geo.y - sSize / 2, sSize, sSize);
        ctx.strokeRect(geo.x - sSize / 2, geo.y - sSize / 2, sSize, sSize);

        // XYZ triaxial axes cross inside capsule
        ctx.strokeStyle = '#111c2b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(geo.x - 2, geo.y); ctx.lineTo(geo.x + 2, geo.y);
        ctx.moveTo(geo.x, geo.y - 2); ctx.lineTo(geo.x, geo.y + 2);
        ctx.stroke();

        // Wave detection pulse ring
        const ringR = 8 + Math.sin(time * 3 + idx) * 2.5;
        ctx.strokeStyle = hitIntensity > 0.08 ? 'rgba(255, 75, 85, 0.85)' : 'rgba(255, 176, 32, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(geo.x, geo.y, ringR, 0, Math.PI * 2);
        ctx.stroke();

        // Station label & borehole depth info
        ctx.fillStyle = '#ffc83b';
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(geo.id, geo.x, geo.y - 6);
        ctx.font = '7px "JetBrains Mono", monospace';
        ctx.fillStyle = '#8f9fb6';
        ctx.fillText(geo.depth, geo.x, geo.y + 13);
        ctx.restore();
      });

    } else {
      // ---------------------------------------------------------
      // MODE: FIBERANDES DFOS (CONTINUOUS FIBER ARRAY IN BOREHOLES & GALLERIES)
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
        ctx.strokeStyle = 'rgba(11, 32, 56, 0.85)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(bh.p1.x, bh.p1.y);
        ctx.lineTo(bh.p2.x, bh.p2.y);
        ctx.stroke();

        let cableBurst = 0;
        activeWaves.forEach(w => {
          const d = distToSegment({ x: w.x, y: w.y }, bh.p1, bh.p2);
          if (Math.abs(d - w.radiusP) < 14) {
            const unattenuatedFactor = Math.pow(Math.max(0, 1.0 - (d / ATTENUATION_LIMIT_RADIUS)), 1.4);
            cableBurst = Math.max(cableBurst, unattenuatedFactor);
          }
        });

        const breathing = Math.sin(time * 3 + idx * 0.8) * 0.12;
        const alpha = Math.min(1.0, 0.72 + breathing + cableBurst * 0.6);

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

      // Continuous Fiber in Production & Undercut Drifts (Crucial for Rockburst & Slow-Strain!)
      // Check if a pillar rockburst wave intersects the drift fiber
      let driftBurst = 0;
      activeWaves.forEach(w => {
        if (Math.abs(w.y - yProduction) < 40 && w.radiusP < 120) {
          driftBurst = Math.max(driftBurst, 1.0 - (w.radiusP / 120));
        }
      });

      ctx.save();
      ctx.strokeStyle = driftBurst > 0.15 ? '#ffffff' : '#00f0ff';
      ctx.lineWidth = driftBurst > 0.15 ? 3.5 : 2.0;
      ctx.shadowColor = driftBurst > 0.15 ? '#00ffa3' : '#00f0ff';
      ctx.shadowBlur = driftBurst > 0.15 ? 14 : 6;
      ctx.beginPath();
      ctx.moveTo(caveLeft - 60, yProduction - 5);
      ctx.lineTo(caveRight + 60, yProduction - 5);
      ctx.moveTo(caveLeft - 30, yUndercut - 4);
      ctx.lineTo(caveRight + 30, yUndercut - 4);
      ctx.stroke();

      // Optical Trunk Cable up the shaft
      ctx.beginPath();
      ctx.moveTo(caveLeft - 60, yProduction - 5);
      ctx.lineTo(shaftX, yProduction - 5);
      ctx.lineTo(shaftX, ySurface);
      ctx.lineTo(mainWidth * 0.22, ySurface);
      ctx.stroke();
      ctx.restore();
    }

    // 7. SEISMIC WAVE PROPAGATION WITH PHYSICAL INELASTIC ATTENUATION
    for (let wIdx = activeWaves.length - 1; wIdx >= 0; wIdx--) {
      const w = activeWaves[wIdx];
      w.radiusP += w.speedP;
      w.radiusS += w.speedS;

      const distNormP = w.radiusP / ATTENUATION_LIMIT_RADIUS;
      const attenP = Math.pow(Math.max(0, 1.0 - distNormP), 1.9) * Math.exp(-distNormP * 1.3);

      const distNormS = w.radiusS / ATTENUATION_LIMIT_RADIUS;
      const attenS = Math.pow(Math.max(0, 1.0 - distNormS), 2.2) * Math.exp(-distNormS * 1.5);

      if (attenP <= 0.005) {
        activeWaves.splice(wIdx, 1);
        continue;
      }

      // Attenuation Boundary Radius Circle around source
      ctx.save();
      ctx.strokeStyle = 'rgba(77, 92, 117, 0.22)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(w.x, w.y, ATTENUATION_LIMIT_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      if (w.radiusP > 35 && w.radiusP < 140) {
        ctx.fillStyle = 'rgba(143, 159, 182, 0.65)';
        ctx.font = '8px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Límite de Detección de Microsismos (~300 m) · Frecuencias >150 Hz disipadas', w.x, w.y + ATTENUATION_LIMIT_RADIUS + 12);
      }
      ctx.restore();

      // Fast Compressional P-wave
      ctx.save();
      if (activeMode === 'dfos') {
        const waveColor = w.zone === 'pillar' ? 'rgba(255, 170, 0, ' + (attenP * 0.95) + ')' : 'rgba(0, 240, 255, ' + (attenP * 0.95) + ')';
        ctx.strokeStyle = waveColor;
        ctx.lineWidth = Math.max(1, 3.0 * attenP);
        if (attenP > 0.4) {
          ctx.shadowColor = w.zone === 'pillar' ? '#ffaa00' : '#00f0ff';
          ctx.shadowBlur = 10 * attenP;
        }
      } else {
        ctx.strokeStyle = 'rgba(255, 75, 85, ' + (attenP * 0.9) + ')';
        ctx.lineWidth = Math.max(1, 2.5 * attenP);
      }
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.radiusP, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Slower Shear S-wave
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

    // 9. SISMICIDAD CONTROLADA EXCLUSIVAMENTE POR EL USUARIO
    // Los eventos sísmicos solo se generan por clics directos en la roca o mediante los botones de escenario.

    // 10. NOTIFICATION TOAST ON CANVAS
    if (noticeToast) {
      noticeToast.timer--;
      if (noticeToast.timer < 30) noticeToast.alpha = noticeToast.timer / 30;
      if (noticeToast.timer <= 0) noticeToast = null;

      if (noticeToast) {
        ctx.save();
        ctx.fillStyle = 'rgba(6, 15, 28, 0.92)';
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1;
        ctx.globalAlpha = noticeToast.alpha;
        const tw = 440;
        const tx = (mainWidth - tw) / 2;
        const ty = height - 55;
        ctx.fillRect(tx, ty, tw, 26);
        ctx.strokeRect(tx, ty, tw, 26);

        ctx.fillStyle = '#ffffff';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(noticeToast.text, mainWidth / 2, ty + 17);
        ctx.restore();
      }
    }

    // 11. LIVE SYNTHETIC DAS WATERFALL DISPLAY (Right side dock)
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
      ctx.fillText('Ciego a slow-strain previo', x + w / 2, y + h * 0.38 + 32);
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

  // Disparo único demostrativo al inicio para incentivar la interacción del usuario
  setTimeout(() => {
    const mainWidth = width > 750 ? width - 165 : width;
    const caveCenterX = (mainWidth * 0.32 + mainWidth * 0.72) / 2;
    const caveBackY = getDepthY(1000) - 20;
    triggerSeismicEvent(caveCenterX, caveBackY, -1.2, 'cave-back');
    showNotice('👆 Haz clic en cualquier lugar del macizo rocoso para simular fracturas');
  }, 900);

})();

