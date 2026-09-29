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

  // Geomechanical Hover Inspector HUD (Slim 1-line top badge that doesn't obstruct the model)
  const hudInspector = document.createElement('div');
  hudInspector.id = 'sim-hud-inspector';
  hudInspector.className = 'sim-hud-inspector';
  hudInspector.innerHTML = '<span class="sim-hud-dot"></span><span id="sim-hud-text">💡 Pasa el cursor por el modelo para inspeccionar cada elemento</span>';
  container.appendChild(hudInspector);

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
  // In canvas depth scale (0 to 2200m), 300m corresponds to ~70-85px
  function getAttenRadius() {
    const ppm = (height - 94) / 2200;
    return Math.max(68, Math.round(320 * ppm)); // ~320m in rock mass
  }

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
      speedP: 2.6,   // P-wave compressional speed
      speedS: 1.5,   // S-wave shear speed
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

    const depthEst = Math.round(((y - 52) / (height - 94)) * 2200);
    const ppm = (height - 94) / 2200;
    const r300 = getAttenRadius();

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
        const geophones = getGeophoneStations(mainWidth, getDepthY(1820), getDepthY(1650), getDepthY(2040), (mainWidth * 0.32) - 70, mainWidth * 0.32, mainWidth * 0.72, (mainWidth * 0.32 + mainWidth * 0.72) / 2);

        let minDistPx = Infinity;
        let inRangeCount = 0;

        geophones.forEach(g => {
          const d = Math.hypot(g.x - x, g.y - y);
          if (d < minDistPx) minDistPx = d;
          if (d <= r300) inRangeCount++;
        });

        const distMeters = Math.round(minDistPx / ppm);

        if (zone === 'pillar') {
          banner.className = 'sim-status-banner blindspot';
          banner.innerHTML = `<strong>💥 ESTALLIDO EN PILAR: BOREHOLES CAPTURAN ONDA (${inRangeCount} est. a ${distMeters} m) PERO 0% PRE-ALERTA</strong> — Los sensores capturan la llegada destructiva pero no registran la lenta acumulación de esfuerzo previa (0 Hz) · <strong>Sin tiempo de evacuación</strong> · Incertidumbre: ±22 m`;
          updateTelemetry(25, "12 Geófonos en Boreholes", "±22 metros", "0% (Ciego a slow-strain)");
        } else if (inRangeCount === 0) {
          banner.className = 'sim-status-banner blindspot';
          banner.innerHTML = `<strong>❌ ONDA ATENUADA: INVISIBLE A BOREHOLES INFERIORES</strong> — El evento ocurrió a <strong>${distMeters} m</strong> de la estación más cercana (límite físico: 300 m) · Frecuencias >150 Hz absorbidas por fricción inelástica antes de llegar a los túneles · Geófonos: 0% detección`;
          updateTelemetry(10, "12 Geófonos en Boreholes", "No detectado (Atenuado)", "0% (Ciego en macizo)");
        } else if (inRangeCount >= 4) {
          banner.className = 'sim-status-banner detected';
          banner.innerHTML = `<strong>⚠️ DETECCIÓN MULTIESTACIÓN (${inRangeCount} estaciones a ${distMeters} m ≤ 300 m)</strong> — Señal capturada localmente fuera de la EDZ · Permite triangulación puntual · Cero datos continuos de deformación del macizo · Incertidumbre: ±18 m`;
          updateTelemetry(30, "12 Geófonos en Boreholes", "±18 metros", "0% (Sin slow-strain)");
        } else {
          banner.className = 'sim-status-banner blindspot';
          banner.innerHTML = `<strong>⚠️ COBERTURA INSUFICIENTE PARA LOCALIZACIÓN (${inRangeCount} estación a ${distMeters} m)</strong> — Se requieren ≥4 estaciones triaxiales para resolver hipocentro en 3D · Error de posición severo · Incertidumbre: ±38 m`;
          updateTelemetry(15, "12 Geófonos en Boreholes", "±38 metros (No localizable)", "0% (Sin slow-strain)");
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

  let hoverX = -1;
  let hoverY = -1;

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    hoverX = e.clientX - rect.left;
    hoverY = e.clientY - rect.top;
  });

  canvas.addEventListener('mouseleave', () => {
    hoverX = -1;
    hoverY = -1;
    const hudText = document.getElementById('sim-hud-text');
    if (hudText) {
      hudText.innerHTML = '💡 Pasa el cursor por el modelo para inspeccionar cada elemento';
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

  // Helper to render high-speed laser interrogation pulses traveling inside optical fiber cables
  function drawFiberLaserRay(points, speed, pulseCount, color, tailLen = 28) {
    if (!points || points.length < 2) return;
    const segLens = [];
    let totalLen = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const d = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
      segLens.push(d);
      totalLen += d;
    }
    if (totalLen <= 0) return;

    function getPosAt(s) {
      s = ((s % totalLen) + totalLen) % totalLen;
      let acc = 0;
      for (let i = 0; i < segLens.length; i++) {
        if (acc + segLens[i] >= s) {
          const tSeg = (s - acc) / segLens[i];
          return {
            x: points[i].x + tSeg * (points[i + 1].x - points[i].x),
            y: points[i].y + tSeg * (points[i + 1].y - points[i].y)
          };
        }
        acc += segLens[i];
      }
      return points[points.length - 1];
    }

    for (let p = 0; p < pulseCount; p++) {
      const distHead = (time * speed + p * (totalLen / pulseCount)) % totalLen;
      const head = getPosAt(distHead);

      // Trailing laser tail along the fiber path
      const steps = 6;
      ctx.save();
      for (let s = 1; s <= steps; s++) {
        const d1 = distHead - (s / steps) * tailLen;
        const d2 = distHead - ((s - 1) / steps) * tailLen;
        const pA = getPosAt(d1);
        const pB = getPosAt(d2);
        const fade = 1 - (s / steps);

        ctx.strokeStyle = color;
        ctx.globalAlpha = fade * 0.95;
        ctx.lineWidth = 1.0 + fade * 2.5;
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.stroke();
      }
      ctx.restore();

      // Glowing laser photon core
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(head.x, head.y, 2.3, 0, Math.PI * 2);
      ctx.fill();

      // Outer light corona
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(head.x, head.y, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
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

    const geophoneStations = getGeophoneStations(mainWidth, yProduction, yUndercut, yHaulage, shaftX, caveLeft, caveRight, caveCenterX);
    const r300 = getAttenRadius();

    // 0. UPDATE GEOMECHANICAL HOVER INSPECTOR HUD
    const hudText = document.getElementById('sim-hud-text');
    if (hudText && hoverX > 0 && hoverY > 0 && hoverX < mainWidth) {
      const depthEst = Math.round(((hoverY - ySurface) / (yBottom - ySurface)) * 2200);
      const distCave = Math.hypot(hoverX - caveCenterX, hoverY - yCaveTop);
      const isVoid = (hoverX >= caveLeft + 20 && hoverX <= caveRight - 20 && hoverY >= yCaveTop && hoverY <= yAirGap + 15);
      const isMuckpile = (hoverX >= caveLeft + 15 && hoverX <= caveRight - 15 && hoverY > yAirGap + 15 && hoverY <= yUndercut);

      // Check proximity to fiber boreholes in DFOS mode
      const nearFiberBorehole = activeMode === 'dfos' && [
        { p1: { x: caveLeft - 30, y: ySurface }, p2: { x: caveLeft - 30, y: yHaulage + 20 } },
        { p1: { x: mainWidth * 0.22, y: ySurface }, p2: { x: caveCenterX, y: yProduction + 10 } },
        { p1: { x: caveRight + 30, y: ySurface }, p2: { x: caveRight + 30, y: yHaulage + 20 } },
        { p1: { x: caveRight + 65, y: ySurface }, p2: { x: caveCenterX + 40, y: yAirGap - 30 } }
      ].some(bh => distToSegment({ x: hoverX, y: hoverY }, bh.p1, bh.p2) < 14);

      // Check proximity to geophones in traditional mode
      const nearGeophone = activeMode === 'geophones' && geophoneStations.find(g => Math.hypot(g.x - hoverX, g.y - hoverY) < 16);

      if (hoverY < ySurface) {
        hudText.innerHTML = '🏔️ <strong>Superficie (Cota 0 m):</strong> Caseta con Interrogador DAS · Transmisión continua de pulsos láser a 10 kHz';
      } else if (nearFiberBorehole) {
        hudText.innerHTML = '💡 <strong>Sondaje con Fibra Óptica (DAS/DSS):</strong> Rayos láser continuos interrogando la roca cada 1 metro en tiempo real';
      } else if (nearGeophone) {
        hudText.innerHTML = `📡 <strong>Estación Sísmica ${nearGeophone.id}:</strong> Geófono triaxial en pozo cimentado de ${nearGeophone.depth} (Alcance radial: 300 m)`;
      } else if (Math.abs(hoverX - shaftX) < 18) {
        hudText.innerHTML = '🌬️ <strong>Pique de Ventilación:</strong> Pozo vertical de infraestructura y paso de fibra troncal a galerías';
      } else if (distCave < 42) {
        hudText.innerHTML = '⚡ <strong>Bóveda Cave-Back (-1.000 m):</strong> Arco activo de quiebre sismogénico (foco de microsismos)';
      } else if (isVoid) {
        hudText.innerHTML = '🕳️ <strong>Air Gap (-1.400 m):</strong> Cavidad subterránea abierta (el aire no propaga ondas sísmicas hacia la base)';
      } else if (isMuckpile) {
        hudText.innerHTML = '🪨 <strong>Muckpile:</strong> Columna de mineral quebrado que desciende hacia las bateas de extracción';
      } else if (Math.abs(hoverY - yProduction) < 16) {
        hudText.innerHTML = '⚠️ <strong>Nivel Producción (-1.820 m):</strong> Pilares entre bateas con riesgo de estallido de roca (rockburst)';
      } else if (Math.abs(hoverY - yUndercut) < 14) {
        hudText.innerHTML = '⛏️ <strong>Nivel Undercut (-1.650 m):</strong> Base de socavación y quebramiento inicial del macizo';
      } else if (Math.abs(hoverY - yHaulage) < 16) {
        hudText.innerHTML = '🚂 <strong>Nivel Transporte (-2.040 m):</strong> Infraestructura de vaciado y acarreo profundo';
      } else if (Math.abs(hoverX - (mainWidth * 0.23)) < 24 && hoverY > yCaveTop && hoverY < yProduction) {
        hudText.innerHTML = '📐 <strong>Falla Geológica Abutment:</strong> Plano estructural de cizalle bajo alta concentración de esfuerzo';
      } else if (activeMode === 'geophones' && hoverY > ySurface && hoverY < (yCaveTop - 10)) {
        hudText.innerHTML = '⚠️ <strong>Zona Fuera de Alcance (>300 m de túneles):</strong> Ondas de alta frecuencia disipadas por atenuación inelástica';
      } else {
        hudText.innerHTML = `⛏️ <strong>Macizo Rocoso Andino (-${depthEst} m):</strong> Haz clic en cualquier punto para detonar un sismo`;
      }
    }

    // 1. Rock Mass Background with Geological Joint Sets (Diaclasas Andinas J1 & J2)
    const rockGrad = ctx.createLinearGradient(0, ySurface, 0, yBottom);
    rockGrad.addColorStop(0, '#0a101f');
    rockGrad.addColorStop(0.35, '#070b16');
    rockGrad.addColorStop(0.75, '#050811');
    rockGrad.addColorStop(1, '#020408');
    ctx.fillStyle = rockGrad;
    ctx.fillRect(0, ySurface, mainWidth, yBottom - ySurface);

    // Natural structural joints (familias de diaclasas andinas en macizo virgen)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.022)';
    ctx.lineWidth = 1;
    for (let j = 0; j < mainWidth; j += 42) {
      // Joint set J1 (+40 deg)
      ctx.beginPath();
      ctx.moveTo(j, ySurface);
      ctx.lineTo(j + (yBottom - ySurface) * 0.45, yBottom);
      ctx.stroke();

      // Joint set J2 (-60 deg)
      ctx.beginPath();
      ctx.moveTo(j, yBottom);
      ctx.lineTo(j + (yBottom - ySurface) * 0.35, ySurface);
      ctx.stroke();
    }
    ctx.restore();

    // Geological Fault Plane (Falla Geológica en Abutment Oeste)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 100, 50, 0.32)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(mainWidth * 0.16, ySurface + 30);
    ctx.lineTo(mainWidth * 0.30, yHaulage + 20);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 120, 70, 0.7)';
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

    // 3. Realistic Andean Topography Profile (Cordillera de los Andes con nieve y caseta DAS)
    ctx.save();
    // Sky gradient above ground
    const skyGrad = ctx.createLinearGradient(0, 0, 0, ySurface);
    skyGrad.addColorStop(0, '#03060c');
    skyGrad.addColorStop(1, '#081224');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, mainWidth, ySurface);

    // Mountain silhouettes in background
    ctx.fillStyle = '#0a1424';
    ctx.beginPath();
    ctx.moveTo(0, ySurface);
    ctx.lineTo(0, ySurface - 16);
    ctx.lineTo(mainWidth * 0.14, ySurface - 38);
    ctx.lineTo(mainWidth * 0.26, ySurface - 18);
    ctx.lineTo(mainWidth * 0.44, ySurface - 46);
    ctx.lineTo(mainWidth * 0.60, ySurface - 24);
    ctx.lineTo(mainWidth * 0.76, ySurface - 48);
    ctx.lineTo(mainWidth * 0.88, ySurface - 26);
    ctx.lineTo(mainWidth, ySurface - 15);
    ctx.lineTo(mainWidth, ySurface);
    ctx.closePath();
    ctx.fill();

    // Snow caps on highest Andean ridges
    ctx.fillStyle = 'rgba(215, 235, 255, 0.32)';
    ctx.beginPath();
    ctx.moveTo(mainWidth * 0.44, ySurface - 46);
    ctx.lineTo(mainWidth * 0.40, ySurface - 32);
    ctx.lineTo(mainWidth * 0.48, ySurface - 32);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(mainWidth * 0.76, ySurface - 48);
    ctx.lineTo(mainWidth * 0.71, ySurface - 34);
    ctx.lineTo(mainWidth * 0.81, ySurface - 34);
    ctx.closePath();
    ctx.fill();

    // Foreground mountain ground surface
    ctx.fillStyle = '#060a12';
    ctx.beginPath();
    ctx.moveTo(0, ySurface - 6);
    ctx.bezierCurveTo(mainWidth * 0.3, ySurface + 8, mainWidth * 0.7, ySurface - 12, mainWidth, ySurface);
    ctx.lineTo(mainWidth, ySurface + 4);
    ctx.lineTo(0, ySurface + 4);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#2b446a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, ySurface - 6);
    ctx.bezierCurveTo(mainWidth * 0.3, ySurface + 8, mainWidth * 0.7, ySurface - 12, mainWidth, ySurface);
    ctx.stroke();

    // Surface facilities: DAS Interrogator Shack + Communication mast
    const shackX = mainWidth * 0.22;
    ctx.fillStyle = '#0b1c2e';
    ctx.fillRect(shackX - 12, ySurface - 24, 24, 20);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(shackX - 12, ySurface - 24, 24, 20);

    // Antenna mast
    ctx.strokeStyle = '#8f9fb6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(shackX + 6, ySurface - 24);
    ctx.lineTo(shackX + 6, ySurface - 38);
    ctx.stroke();

    // Blinking telemetry LED on shack
    ctx.fillStyle = (Math.floor(time * 5) % 2 === 0) ? '#00ffa3' : '#00f0ff';
    ctx.beginPath();
    ctx.arc(shackX - 6, ySurface - 14, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CASETA DAS (0 m)', shackX, ySurface - 28);
    ctx.restore();

    // 4. BLOCK CAVING GEOMETRY & SEISMOGENIC ZONES
    // A. Muckpile (Broken Rock Column with Realistic Ore Clasts)
    ctx.fillStyle = '#141b26';
    ctx.beginPath();
    ctx.moveTo(caveLeft + 15, yUndercut);
    ctx.lineTo(caveRight - 15, yUndercut);
    ctx.lineTo(caveRight - 25, yAirGap + 20);
    ctx.quadraticCurveTo(caveCenterX, yAirGap + 5, caveLeft + 25, yAirGap + 20);
    ctx.closePath();
    ctx.fill();

    // Realistic fractured ore clasts (pebbles and blocks of copper mineral)
    ctx.save();
    for (let r = 0; r < 40; r++) {
      const rx = caveLeft + 24 + ((r * 41) % (caveRight - caveLeft - 50));
      const ry = yAirGap + 24 + ((r * 33) % (yUndercut - yAirGap - 34));
      const clastSize = 5 + (r % 6);
      ctx.fillStyle = (r % 3 === 0) ? 'rgba(55, 68, 88, 0.45)' : 'rgba(38, 48, 64, 0.55)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(rx, ry, clastSize, clastSize * 0.7);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(143, 159, 182, 0.55)';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
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
    if (activeMode === 'geophones') {
      // ---------------------------------------------------------
      // MODE: TRADITIONAL POINT SEISMOLOGY (GEOPHONES IN TUNNELS)
      // ---------------------------------------------------------

      // Helper to compute the uppermost reach of 300m geophone coverage across the cross section
      function getUpperCoverageY(xVal) {
        let topY = yBottom;
        geophoneStations.forEach(g => {
          const dx = Math.abs(xVal - g.x);
          if (dx <= r300) {
            const dy = Math.sqrt(r300 * r300 - dx * dx);
            const candidateY = g.y - dy;
            if (candidateY < topY) {
              topY = candidateY;
            }
          }
        });
        return topY;
      }

      // A. Real Curved Out-of-Range Area (Zona Fuera de Alcance >300 m)
      // Follows the exact mathematical envelope of 300m detection circles from borehole geophones
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, ySurface);
      ctx.lineTo(mainWidth, ySurface);
      ctx.lineTo(mainWidth, Math.min(yBottom, getUpperCoverageY(mainWidth)));
      for (let px = mainWidth; px >= 0; px -= 4) {
        const py = Math.min(yBottom, getUpperCoverageY(px));
        ctx.lineTo(px, py);
      }
      ctx.closePath();

      // Subtle warning gradient across true out-of-range rock mass
      const blindGrad = ctx.createLinearGradient(0, ySurface, 0, yCaveTop + 40);
      blindGrad.addColorStop(0, 'rgba(255, 40, 26, 0.16)');
      blindGrad.addColorStop(0.7, 'rgba(255, 40, 26, 0.10)');
      blindGrad.addColorStop(1, 'rgba(255, 40, 26, 0.02)');
      ctx.fillStyle = blindGrad;
      ctx.fill();

      // Curved boundary dashed stroke (strictly >300 m from all geophones)
      ctx.strokeStyle = 'rgba(255, 75, 85, 0.65)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Diagonal attenuation hatching in out-of-range zone
      ctx.strokeStyle = 'rgba(255, 75, 85, 0.04)';
      ctx.lineWidth = 1;
      for (let hx = -height; hx < mainWidth + height; hx += 32) {
        ctx.beginPath();
        ctx.moveTo(hx, ySurface);
        ctx.lineTo(hx + 180, ySurface + 180);
        ctx.stroke();
      }
      ctx.restore();

      // Sleek Warning Callout in Upper Out-of-Range Zone (centered above cave-back)
      ctx.save();
      ctx.fillStyle = 'rgba(16, 6, 8, 0.90)';
      ctx.shadowColor = '#ff281a';
      ctx.shadowBlur = 8;
      const bW = 360;
      ctx.fillRect(caveCenterX - bW / 2, yCaveTop - 74, bW, 42);
      ctx.strokeStyle = 'rgba(255, 75, 85, 0.75)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(caveCenterX - bW / 2, yCaveTop - 74, bW, 42);

      ctx.fillStyle = '#ff6b6b';
      ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚠️ ZONA FUERA DE ALCANCE (>300 m DE BOREHOLES EN TÚNELES)', caveCenterX, yCaveTop - 57);
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.fillStyle = '#fca5a5';
      ctx.fillText('Límite físico de atenuación: ondas de alta frecuencia (>150 Hz) disipadas por fricción', caveCenterX, yCaveTop - 45);
      ctx.fillText('Bóveda y roca superior sin estaciones en cota · 0% apertura tridimensional', caveCenterX, yCaveTop - 34);
      ctx.restore();

      // Sombra Acústica del Air Gap (Acoustic Void Shadow Cone)
      ctx.save();
      ctx.fillStyle = 'rgba(10, 15, 25, 0.55)';
      ctx.beginPath();
      ctx.moveTo(caveLeft - 5, yAirGap);
      ctx.lineTo(caveRight + 5, yAirGap);
      ctx.lineTo(caveRight + 18, yUndercut);
      ctx.lineTo(caveLeft - 18, yUndercut);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 120, 0, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(255, 170, 0, 0.75)';
      ctx.font = '7.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SOMBRA ACÚSTICA: El vacío bloquea la transmisión directa de ondas hacia túneles', caveCenterX, (yAirGap + yUndercut) / 2);
      ctx.restore();

      // B. Individual 300m Sensitivity Lobes around each borehole station
      geophoneStations.forEach((geo) => {
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 225, 255, 0.22)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.arc(geo.x, geo.y, r300, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        const radGrad = ctx.createRadialGradient(geo.x, geo.y, 0, geo.x, geo.y, r300);
        radGrad.addColorStop(0, 'rgba(0, 225, 255, 0.04)');
        radGrad.addColorStop(0.8, 'rgba(0, 225, 255, 0.012)');
        radGrad.addColorStop(1, 'rgba(0, 225, 255, 0)');
        ctx.fillStyle = radGrad;
        ctx.fill();
        ctx.restore();
      });

      // C. Excavation Damaged Zone (EDZ, 2-4m) around drifts
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

      // D. Discrete Triaxial Geophone Stations in Cemented Boreholes (15–25m into Virgin Rock)
      geophoneStations.forEach((geo, idx) => {
        let hitIntensity = 0;
        activeWaves.forEach(w => {
          const d = Math.hypot(geo.x - w.x, geo.y - w.y);
          if (Math.abs(d - w.radiusP) < 18) {
            const atten = Math.pow(Math.max(0, 1.0 - (d / r300)), 2.0);
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
            const unattenuatedFactor = Math.pow(Math.max(0, 1.0 - (d / r300)), 1.4);
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

      // CONTINUOUS LASER INTERROGATION PULSES (Rayo viajando dentro de la fibra)
      fiberBoreholes.forEach((bh, bIdx) => {
        const speed = 75 + (bIdx % 3) * 12;
        const pColor = bh.color === '#00ffa3' ? '#00ffa3' : '#00f0ff';
        drawFiberLaserRay([bh.p1, bh.p2], speed, 2, pColor, 26);
      });

      // Shaft trunk + Production drift continuous pulse stream
      const shaftAndDriftPath = [
        { x: mainWidth * 0.22, y: ySurface },
        { x: shaftX, y: ySurface },
        { x: shaftX, y: yProduction - 5 },
        { x: caveLeft - 60, y: yProduction - 5 },
        { x: caveRight + 60, y: yProduction - 5 }
      ];
      drawFiberLaserRay(shaftAndDriftPath, 95, 3, '#00f0ff', 30);

      // Undercut drift continuous laser pulse
      const undercutPath = [
        { x: caveLeft - 30, y: yUndercut - 4 },
        { x: caveRight + 30, y: yUndercut - 4 }
      ];
      drawFiberLaserRay(undercutPath, 85, 2, '#00f0ff', 24);
    }

    // 7. SEISMIC WAVE PROPAGATION WITH PHYSICAL INELASTIC ATTENUATION
    for (let wIdx = activeWaves.length - 1; wIdx >= 0; wIdx--) {
      const w = activeWaves[wIdx];
      w.radiusP += w.speedP;
      w.radiusS += w.speedS;

      const distNormP = w.radiusP / r300;
      const attenP = Math.pow(Math.max(0, 1.0 - distNormP), 1.9) * Math.exp(-distNormP * 1.3);

      const distNormS = w.radiusS / r300;
      const attenS = Math.pow(Math.max(0, 1.0 - distNormS), 2.2) * Math.exp(-distNormS * 1.5);

      if (attenP <= 0.005) {
        activeWaves.splice(wIdx, 1);
        continue;
      }

      // Attenuation Boundary Radius Circle around source
      ctx.save();
      ctx.strokeStyle = 'rgba(77, 92, 117, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(w.x, w.y, r300, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      if (w.radiusP > 20 && w.radiusP < 95) {
        ctx.fillStyle = 'rgba(143, 159, 182, 0.75)';
        ctx.font = '8px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Límite físico de microsismos (300 m) · f > 150 Hz disipadas', w.x, w.y + r300 + 11);
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

