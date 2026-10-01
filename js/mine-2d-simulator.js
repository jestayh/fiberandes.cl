/* ============================================================
   FIBERANDES — 2D Interactive Mine Geomechanics Simulator
   Corte Transversal Block Caving: DAS Continuo vs. Geófonos en Túneles
   Zona Sismogénica, Riesgo de Estallido de Roca (Rockburst) y Atenuación Inelástica
   ============================================================ */
(function() {
  'use strict';

  const container = document.getElementById('mine-3d-canvas-container');
  if (!container) return;

  // Clean canvas container: contains ONLY the canvas (zero overlay boxes covering the model)
  container.innerHTML = '';

  const canvas = document.createElement('canvas');
  canvas.id = 'mine-2d-canvas';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.cursor = 'crosshair';
  container.appendChild(canvas);

  // References to external console elements (outside the canvas)
  const statusBanner = document.getElementById('sim-status-banner');
  const hudInspector = document.getElementById('sim-hud-inspector');
  const hudText = document.getElementById('sim-hud-text');

  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let dpr = 1;

  // State
  let activeMode = 'geophones'; // 'dfos' or 'geophones'
  let dasCoverageAmount = 0.0; // 0.0 = Traditional (Geophones only, full red area), 1.0 = DAS Active (Red area shrunk to 0%)
  let dasCoverageTarget = 0.0;
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
    const yAirGap = getDepthY(1080); // Minimal, controlled air gap in V2
    const yUndercut = getDepthY(1650);
    const yProduction = getDepthY(1820);

    // Check if inside horizontal bounds of the cave cavity
    if (x >= caveLeft && x <= caveRight) {
      // Cave-back arch height at x
      const normX = (x - caveCenterX) / ((caveRight - caveLeft) / 2);
      const archY = yCaveTop + (normX * normX) * 22;

      // Check if inside Air Gap void or Muckpile column
      if (y >= archY && y <= yUndercut) {
        // It's in the void or broken muckpile!
        // If clicked in upper half, snap up into the solid active seismogenic arch
        if (y < (archY + yUndercut) / 2) {
          showNotice('ℹ️ Air Gap / Bóveda: sismo reubicado en la roca activa del Cave Back');
          return { x, y: archY - 14, zone: 'cave-back' };
        } else {
          // If clicked in lower half, snap down into solid extraction pillars between drawpoints
          showNotice('ℹ️ Muckpile quebrado: sismo reubicado en pilares en carga entre bateas');
          return { x, y: yProduction - 4, zone: 'pillar' };
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
    const el = document.getElementById('sim-hud-text');
    if (el) el.innerHTML = text;
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
      if (dasCoverageAmount > 0.5) {
        // DAS COVERAGE IS ACTIVE (ZERO BLIND SPOTS)
        if (zone === 'pillar') {
          banner.className = 'sim-status-banner detected';
          banner.innerHTML = '<strong>⚠️ ESTALLIDO EN PILAR CAPTURADO POR FIBRA DAS EN GALERÍA (-' + depthEst + ' m)</strong> — La fibra en nivel de producción localiza la falla dinámica al metro exacto · Alerta continua en túneles';
        } else if (zone === 'cave-back') {
          banner.className = 'sim-status-banner detected';
          banner.innerHTML = '<strong>⚡ FRACTURA EN CAVE-BACK (-' + depthEst + ' m) CAPTURADA POR FIBRA DE SACRIFICIO B-SAC</strong> — Registro acústico directo a 14 m del foco en el área antes ciega · Cero atenuación';
        } else {
          banner.className = 'sim-status-banner detected';
          banner.innerHTML = '<strong>⚡ EVENTO EN MACIZO ROCOSO (-' + depthEst + ' m)</strong> — Capturado por la red perimetral vertical en Daisy-Chain (Furlong & Anderson) · Incertidumbre hipocentral reducida a ±1.8 m';
        }
      } else {
        // TRADITIONAL GEOPHONE NETWORK (ONLY IN TUNNELS)
        const geophones = getGeophoneStations(mainWidth, getDepthY(1820), getDepthY(1650), getDepthY(2040), (mainWidth * 0.32) - 70, mainWidth * 0.32, mainWidth * 0.72, (mainWidth * 0.32 + mainWidth * 0.72) / 2);

        let minDistPx = Infinity;
        let inRangeCount = 0;

        geophones.forEach(g => {
          const d = Math.hypot(g.x - x, g.y - y);
          if (d < minDistPx) minDistPx = d;
          if (d <= r300) inRangeCount++;
        });

        const distMeters = Math.round(minDistPx / ppm);

        if (zone === 'cave-back' || inRangeCount === 0) {
          banner.className = 'sim-status-banner blindspot';
          banner.innerHTML = '<strong>❌ ONDA ATENUADA EN ÁREA ROJA FUERA DE ALCANCE (' + distMeters + ' m de túneles)</strong> — Geófonos ciegos por atenuación inelástica (>300 m) · <strong>Haz clic en "Encender Cobertura DAS" para ver cómo se reduce el área roja y se captura el sismo</strong>';
        } else {
          banner.className = 'sim-status-banner detected';
          banner.innerHTML = '<strong>⚠️ DETECCIÓN PARCIAL (' + inRangeCount + ' geófonos a ' + distMeters + ' m)</strong> — Capturado cerca del túnel pero con alta incertidumbre (±22 m) · Sin cobertura vertical en la corona';
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

  // Mode Switch & Smooth DAS Coverage Transition
  function setMode(mode) {
    activeMode = mode;
    dasCoverageTarget = (mode === 'dfos') ? 1.0 : 0.0;
    const banner = document.getElementById('sim-status-banner');

    if (mode === 'dfos') {
      if (banner) {
        banner.className = 'sim-status-banner detected';
        banner.innerHTML = '<strong>⚡ COBERTURA FIBERANDES DAS ACTIVADA</strong> — Los sondajes perimetrales verticales y de sacrificio (Furlong & Anderson) eliminan el área roja fuera de alcance · 100% Cobertura Continua';
      }
    } else {
      if (banner) {
        banner.className = 'sim-status-banner blindspot';
        banner.innerHTML = '<strong>📡 RED SÍSMICA TRADICIONAL (GEÓFONOS EN TÚNELES)</strong> — Límite físico de 300 m genera un <strong>área roja ciega masiva sobre el Cave-Back</strong> · Haz clic en <em>"Encender Cobertura FiberAndes DAS"</em> para ver cómo se reduce';
      }
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

        // Prevent seam jumping: if points are far apart, they wrap across path endpoints
        const stepDist = Math.hypot(pB.x - pA.x, pB.y - pA.y);
        if (stepDist > tailLen * 1.4) continue;

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

    // Smoothly animate dasCoverageAmount towards target (0.0 to 1.0)
    dasCoverageAmount += (dasCoverageTarget - dasCoverageAmount) * 0.055;
    if (Math.abs(dasCoverageTarget - dasCoverageAmount) < 0.003) {
      dasCoverageAmount = dasCoverageTarget;
    }

    // Dynamic telemetry interpolation based on active coverage
    const curCov = Math.round(42 + dasCoverageAmount * 56);
    const curSens = dasCoverageAmount > 0.5 ? "12.000 Canales DAS (1 Interrogador)" : "36 Geófonos Triaxiales en Túneles";
    const curUncert = (22 - dasCoverageAmount * 20.2).toFixed(1) + " m";
    const curStatus = dasCoverageAmount > 0.5 ? "Cero Puntos Ciegos (100% Activo)" : "Área Roja Ciega (>300 m)";
    updateTelemetry(curCov, curSens, "±" + curUncert, curStatus);

    ctx.clearRect(0, 0, width, height);

    const mainWidth = width > 750 ? width - 165 : width;
    const showWaterfall = width > 750;

    const ySurface = 52;
    const yCaveTop = getDepthY(1000);
    const yAirGap = getDepthY(1080);
    const yUndercut = getDepthY(1650);
    const yProduction = getDepthY(1820);
    const yHaulage = getDepthY(2040);
    const yBottom = height - 38;

    const caveLeft = mainWidth * 0.32;
    const caveRight = mainWidth * 0.72;
    const caveCenterX = (caveLeft + caveRight) / 2;
    const shaftX = caveLeft - 70;
    const shackX = mainWidth * 0.22;

    const geophoneStations = getGeophoneStations(mainWidth, yProduction, yUndercut, yHaulage, shaftX, caveLeft, caveRight, caveCenterX);
    const r300 = getAttenRadius();

    // 0. UPDATE GEOMECHANICAL HOVER INSPECTOR HUD
    const hudText = document.getElementById('sim-hud-text');
    if (hudText && hoverX > 0 && hoverY > 0 && hoverX < mainWidth) {
      const depthEst = Math.round(((hoverY - ySurface) / (yBottom - ySurface)) * 2200);
      const distCave = Math.hypot(hoverX - caveCenterX, hoverY - yCaveTop);
      const isVoid = (hoverX >= caveLeft + 20 && hoverX <= caveRight - 20 && hoverY >= yCaveTop && hoverY <= yAirGap + 15);
      const isMuckpile = (hoverX >= caveLeft + 15 && hoverX <= caveRight - 15 && hoverY > yAirGap + 15 && hoverY <= yUndercut);

      // Check proximity to fiber boreholes in DAS mode (Furlong & Anderson)
      const bPermWestX = caveLeft - 44;
      const bPermEastX = caveRight + 44;
      const bSac1X = caveCenterX - 24;
      const bSac2X = caveCenterX + 24;

      const fiberBoreholeMatches = activeMode === 'dfos' ? [
        { id: 'B-Perm-W', p1: { x: bPermWestX, y: ySurface }, p2: { x: bPermWestX, y: yHaulage + 28 }, role: 'perimeter_permanent' },
        { id: 'B-Perm-E', p1: { x: bPermEastX, y: ySurface }, p2: { x: bPermEastX, y: yHaulage + 28 }, role: 'perimeter_permanent' },
        { id: 'B-Sac-1', p1: { x: bSac1X, y: ySurface }, p2: { x: bSac1X, y: yCaveTop + 14 }, role: 'sacrificial' },
        { id: 'B-Sac-2', p1: { x: bSac2X, y: ySurface }, p2: { x: bSac2X, y: yCaveTop + 14 }, role: 'sacrificial' }
      ].find(bh => distToSegment({ x: hoverX, y: hoverY }, bh.p1, bh.p2) < 14) : null;

      // Check proximity to geophones in traditional mode
      const nearGeophone = activeMode === 'geophones' && geophoneStations.find(g => Math.hypot(g.x - hoverX, g.y - hoverY) < 16);

      if (hoverY < ySurface) {
        if (Math.abs(hoverX - shackX) < 32) {
          hudText.innerHTML = '🏔️ <strong>Caseta Central DAS (Superficie):</strong> Un único <strong>Interrogador DAS de alta coherencia</strong> que monitorea en tiempo real toda la red de sondajes perimetrales, cables de sacrificio y galerías en Daisy-Chain';
        } else {
          hudText.innerHTML = '🔗 <strong>Troncal en Daisy-Chain (Furlong & Anderson):</strong> Un solo cable continuo conecta en serie los sondajes perimetrales y el pique sin requerir interrogadores adicionales';
        }
      } else if (fiberBoreholeMatches) {
        if (fiberBoreholeMatches.role === 'sacrificial') {
          hudText.innerHTML = `⚡ <strong>Fibra DAS de Sacrificio (${fiberBoreholeMatches.id}):</strong> Instalada en el macizo a explotar. Registra la microfracturación acústica hasta cortarse al desprenderse el mineral. La fibra superior sigue operativa hasta la cota del quiebre (Furlong & Anderson).`;
        } else {
          hudText.innerHTML = `🔗 <strong>Fibra DAS Perimetral Permanente (${fiberBoreholeMatches.id}):</strong> Sondaje vertical en roca competente fuera del caving. Larga vida útil permanente, conectada en Daisy-Chain con el flanco opuesto para rodear el yacimiento.`;
        }
      } else if (nearGeophone) {
        hudText.innerHTML = `📡 <strong>Estación Sísmica ${nearGeophone.id}:</strong> Geófono triaxial en pozo cimentado de ${nearGeophone.depth} (Alcance radial: 300 m)`;
      } else if (Math.abs(hoverX - shaftX) < 18) {
        hudText.innerHTML = '🌬️ <strong>Pique de Ventilación:</strong> Pozo vertical con troncal de fibra óptica permanente que alimenta las galerías de undercut y producción en bucle';
      } else if (distCave < 42) {
        hudText.innerHTML = '⚡ <strong>Bóveda Cave-Back (-1.000 m):</strong> Límite activo de quiebre sismogénico. La fibra de sacrificio registra el estiramiento y corte para calcular la velocidad de propagación vertical del caving.';
      } else if (isVoid) {
        hudText.innerHTML = '🕳️ <strong>Air Gap (-1.400 m):</strong> Cavidad de aire crítica que se intenta MINIMIZAR. Si el techo colapsa de golpe actúa como pistón provocando un violento "Air Blast" hacia túneles. La fibra de sacrificio regula la extracción para mantener el muckpile en contacto.';
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

    // Surface facilities: DAS/DSS Central Interrogator Shack + Communication mast
    ctx.fillStyle = '#0b1c2e';
    ctx.fillRect(shackX - 16, ySurface - 24, 32, 20);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(shackX - 16, ySurface - 24, 32, 20);

    // Antenna mast
    ctx.strokeStyle = '#8f9fb6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(shackX + 8, ySurface - 24);
    ctx.lineTo(shackX + 8, ySurface - 38);
    ctx.stroke();

    // Blinking telemetry LED on shack
    ctx.fillStyle = (Math.floor(time * 5) % 2 === 0) ? '#00ffa3' : '#00f0ff';
    ctx.beginPath();
    ctx.arc(shackX - 8, ySurface - 14, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CASETA FIBERANDES DAS', shackX, ySurface - 28);
    ctx.restore();

    // -------------------------------------------------------------
    // 4. BLOCK CAVING GEOMETRY V2 (FACETED OREBODY · CONTROLLED MINIMAL AIR GAP · DRAWPOINTS)
    // -------------------------------------------------------------
    const yWasteTop = ySurface + 6;
    const yWasteBot = ySurface + 44;
    const yAirGapBot = yCaveTop + 22; // Minimal, controlled air gap (avoiding air blast hazard)

    // Silhouette coordinates of the block cave column
    const colLeftBase = caveLeft - 18;
    const colRightBase = caveRight + 18;
    const colLeftMid = caveLeft - 28;
    const colRightMid = caveRight + 28;
    const colLeftTop = caveLeft + 26;
    const colRightTop = caveRight - 26;
    const colLeftWaste = caveLeft + 38;
    const colRightWaste = caveRight - 38;

    // A. SOLID OREBODY (FACETED CHISELED GEOLOGY IN GRAPHITE/SLATE)
    // Facet 1: Upper-left ore facet
    ctx.save();
    ctx.fillStyle = '#0f1828';
    ctx.beginPath();
    ctx.moveTo(colLeftTop, yWasteBot);
    ctx.lineTo(caveCenterX - 25, yWasteBot + 4);
    ctx.lineTo(caveCenterX - 55, yCaveTop - 25);
    ctx.lineTo(colLeftMid, yCaveTop - 12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Facet 2: Upper-right ore facet
    ctx.fillStyle = '#142136';
    ctx.beginPath();
    ctx.moveTo(caveCenterX - 25, yWasteBot + 4);
    ctx.lineTo(colRightTop, yWasteBot);
    ctx.lineTo(colRightMid, yCaveTop - 16);
    ctx.lineTo(caveCenterX + 35, yCaveTop - 32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Facet 3: Central ore column facet
    ctx.fillStyle = '#192b45';
    ctx.beginPath();
    ctx.moveTo(caveCenterX - 25, yWasteBot + 4);
    ctx.lineTo(caveCenterX + 35, yCaveTop - 32);
    ctx.lineTo(caveCenterX + 12, yCaveTop - 8);
    ctx.lineTo(caveCenterX - 55, yCaveTop - 25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Facet 4: West lower flank facet
    ctx.fillStyle = '#0a121f';
    ctx.beginPath();
    ctx.moveTo(colLeftMid, yCaveTop - 12);
    ctx.lineTo(colLeftBase, yUndercut);
    ctx.lineTo(caveLeft + 15, yUndercut);
    ctx.lineTo(caveLeft - 5, yAirGapBot);
    ctx.lineTo(caveLeft + 8, yCaveTop);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Facet 5: East lower flank facet
    ctx.fillStyle = '#0d1726';
    ctx.beginPath();
    ctx.moveTo(colRightMid, yCaveTop - 16);
    ctx.lineTo(colRightBase, yUndercut);
    ctx.lineTo(caveRight - 15, yUndercut);
    ctx.lineTo(caveRight + 5, yAirGapBot);
    ctx.lineTo(caveRight - 8, yCaveTop);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // B. TOP WASTE CAP (SOBRECARGA / ESTÉRIL TRAPEZOIDAL EN ÁMBAR / TERRACOTA)
    ctx.save();
    const wasteGrad = ctx.createLinearGradient(0, yWasteTop, 0, yWasteBot);
    wasteGrad.addColorStop(0, '#ff701e');
    wasteGrad.addColorStop(1, '#c04408');
    ctx.fillStyle = wasteGrad;
    ctx.beginPath();
    ctx.moveTo(colLeftWaste, yWasteTop + 8);
    ctx.lineTo(caveCenterX, yWasteTop);
    ctx.lineTo(colRightWaste, yWasteTop + 8);
    ctx.lineTo(colRightTop, yWasteBot);
    ctx.lineTo(colLeftTop, yWasteBot);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Waste label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText('Waste', caveCenterX, (yWasteTop + yWasteBot) / 2 + 1);
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(255, 235, 220, 0.9)';
    ctx.fillText('Sobrecarga Estéril', caveCenterX, (yWasteTop + yWasteBot) / 2 + 12);
    ctx.restore();

    // C. ORE LABEL (MACIZO MINERALIZADO)
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Ore', caveCenterX, yWasteBot + 24);
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(0, 240, 255, 0.85)';
    ctx.fillText('Macizo Mineralizado', caveCenterX, yWasteBot + 35);
    ctx.restore();

    // D. CAVE PROPAGATION VECTOR (ARROW & TYPOGRAPHY)
    ctx.save();
    const arrowX = caveCenterX - 24;
    const arrowBaseY = yCaveTop - 18;
    const arrowTipY = yCaveTop - 68;
    const arrowPulse = Math.sin(time * 4) * 3;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.2;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowBaseY);
    ctx.lineTo(arrowX, arrowTipY + arrowPulse);
    // Arrowhead
    ctx.lineTo(arrowX - 5, arrowTipY + 9 + arrowPulse);
    ctx.moveTo(arrowX, arrowTipY + arrowPulse);
    ctx.lineTo(arrowX + 5, arrowTipY + 9 + arrowPulse);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '600 10.5px "Space Grotesk", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Cave Propagation', arrowX + 12, (arrowBaseY + arrowTipY) / 2 - 2);
    ctx.font = '7.5px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(180, 205, 230, 0.85)';
    ctx.fillText('Propagación de Socavación', arrowX + 12, (arrowBaseY + arrowTipY) / 2 + 9);
    ctx.restore();

    // E. CAVE BACK ARCH & MICROCRACK SWARM (BÓVEDA DE QUIEBRE Y MICROFISURACIÓN)
    ctx.save();
    // 1. Vault Arch
    ctx.strokeStyle = '#ff3322';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ff281a';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(caveLeft - 6, yAirGapBot - 4);
    ctx.quadraticCurveTo(caveCenterX, yCaveTop, caveRight + 6, yAirGapBot - 4);
    ctx.stroke();

    // 2. Microcracks swarm (En echelon white fracture lines) ahead of cave back
    const microcracks = [
      { x: caveLeft + 18, y: yCaveTop + 36, len: 12, ang: -0.42 },
      { x: caveLeft + 35, y: yCaveTop + 24, len: 14, ang: 0.58 },
      { x: caveLeft + 54, y: yCaveTop + 14, len: 13, ang: -0.32 },
      { x: caveLeft + 78, y: yCaveTop + 8, len: 15, ang: 0.48 },
      { x: caveCenterX - 52, y: yCaveTop + 2, len: 14, ang: -0.62 },
      { x: caveCenterX - 26, y: yCaveTop - 4, len: 15, ang: 0.38 },
      { x: caveCenterX, y: yCaveTop - 8, len: 17, ang: 0.12 },
      { x: caveCenterX + 25, y: yCaveTop - 5, len: 15, ang: -0.40 },
      { x: caveCenterX + 52, y: yCaveTop + 3, len: 14, ang: 0.55 },
      { x: caveRight - 76, y: yCaveTop + 10, len: 15, ang: -0.35 },
      { x: caveRight - 52, y: yCaveTop + 18, len: 14, ang: 0.60 },
      { x: caveRight - 32, y: yCaveTop + 28, len: 15, ang: -0.48 },
      { x: caveRight - 16, y: yCaveTop + 38, len: 12, ang: 0.42 },
      // Upper echelon ring
      { x: caveLeft + 42, y: yCaveTop + 10, len: 11, ang: -0.52 },
      { x: caveCenterX - 38, y: yCaveTop - 14, len: 13, ang: 0.46 },
      { x: caveCenterX + 12, y: yCaveTop - 18, len: 14, ang: -0.28 },
      { x: caveRight - 42, y: yCaveTop + 6, len: 12, ang: 0.62 }
    ];

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.4;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 6;
    microcracks.forEach(c => {
      const hx = Math.cos(c.ang) * (c.len / 2);
      const hy = Math.sin(c.ang) * (c.len / 2);
      ctx.beginPath();
      ctx.moveTo(c.x - hx, c.y - hy);
      ctx.lineTo(c.x + hx, c.y + hy);
      ctx.stroke();
    });

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Cave Back', caveCenterX, yCaveTop + 12);
    ctx.font = '7.5px "JetBrains Mono", monospace';
    ctx.fillStyle = '#ff9988';
    ctx.fillText('Bóveda de Quiebre & Microfisuras (-1.000 m)', caveCenterX, yCaveTop + 22);
    ctx.restore();

    // F. AIR GAP (MINIMAL & CONTROLLED ZONE · SE EVITA EN MINERÍA PARA PREVENIR AIR BLAST)
    ctx.save();
    ctx.fillStyle = 'rgba(2, 5, 12, 0.94)';
    ctx.beginPath();
    ctx.moveTo(caveLeft - 6, yAirGapBot - 4);
    ctx.quadraticCurveTo(caveCenterX, yCaveTop, caveRight + 6, yAirGapBot - 4);
    ctx.lineTo(caveRight - 8, yAirGapBot + 14);
    ctx.quadraticCurveTo(caveCenterX, yAirGapBot + 2, caveLeft + 8, yAirGapBot + 14);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 140, 40, 0.65)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#ffaa33';
    ctx.font = 'bold 10px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Air Gap', caveCenterX, yAirGapBot + 7);
    ctx.font = '7px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(255, 180, 80, 0.85)';
    ctx.fillText('Mínimo / Crítico · Se evita para prevenir Air Blast', caveCenterX, yAirGapBot + 15);
    ctx.restore();

    // G. MUCKPILE (BROKEN ORE GRAVEL COLUMN WITH DOWNWARD GRAVITY FLOW ARROWS)
    ctx.save();
    ctx.fillStyle = '#111722';
    ctx.beginPath();
    ctx.moveTo(caveLeft + 8, yAirGapBot + 14);
    ctx.quadraticCurveTo(caveCenterX, yAirGapBot + 2, caveRight - 8, yAirGapBot + 14);
    ctx.lineTo(caveRight - 10, yUndercut);
    ctx.lineTo(caveLeft + 10, yUndercut);
    ctx.closePath();
    ctx.fill();

    // Rich clasts and rock fragments (Muckpile gravel texture)
    for (let r = 0; r < 48; r++) {
      const rx = caveLeft + 22 + ((r * 37) % (caveRight - caveLeft - 44));
      const ry = yAirGapBot + 20 + ((r * 29) % (yUndercut - yAirGapBot - 28));
      const clastSize = 4 + (r % 5);
      ctx.fillStyle = (r % 3 === 0) ? 'rgba(58, 72, 92, 0.6)' : 'rgba(35, 45, 60, 0.7)';
      ctx.fillRect(rx, ry, clastSize, clastSize * 0.75);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Muckpile', caveCenterX, (yAirGapBot + yUndercut) / 2 - 4);
    ctx.font = '7.5px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(160, 180, 205, 0.85)';
    ctx.fillText('Mineral Quebrado en Descenso', caveCenterX, (yAirGapBot + yUndercut) / 2 + 6);

    // Severed fiber fragments in Muckpile (Furlong & Anderson model)
    // As rock yields and falls into the muckpile, sacrificial fibers shear away and drop
    const severedCables = [
      { x1: caveCenterX - 24, y1: yAirGapBot + 24, x2: caveCenterX - 18, y2: yAirGapBot + 42 },
      { x1: caveCenterX - 12, y1: yAirGapBot + 52, x2: caveCenterX - 26, y2: yAirGapBot + 70 },
      { x1: caveCenterX + 18, y1: yAirGapBot + 28, x2: caveCenterX + 28, y2: yAirGapBot + 50 },
      { x1: caveCenterX + 32, y1: yAirGapBot + 62, x2: caveCenterX + 16, y2: yAirGapBot + 80 },
      { x1: caveCenterX - 4,  y1: yAirGapBot + 38, x2: caveCenterX + 6,  y2: yAirGapBot + 58 }
    ];

    severedCables.forEach(sc => {
      ctx.strokeStyle = '#ff9900';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(sc.x1, sc.y1);
      ctx.lineTo(sc.x2, sc.y2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Severed shear break dots
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(sc.x1, sc.y1, 1.8, 0, Math.PI * 2);
      ctx.arc(sc.x2, sc.y2, 1.8, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = 'rgba(255, 170, 0, 0.85)';
    ctx.font = '7.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ Fibras de sacrificio cortadas al desprenderse el mineral (Furlong & Anderson)', caveCenterX, yAirGapBot + 86);

    // 5 Downward Flow Arrows (aligned with each drawbell below!)
    const bellCount = 5;
    const bellSpacing = (caveRight - caveLeft - 30) / (bellCount - 1);
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    for (let b = 0; b < bellCount; b++) {
      const bx = caveLeft + 15 + b * bellSpacing;
      const arrowY = (yAirGapBot + yUndercut) / 2 + 20;
      ctx.beginPath();
      ctx.moveTo(bx, arrowY - 7);
      ctx.lineTo(bx, arrowY + 5);
      ctx.lineTo(bx - 3.5, arrowY + 1);
      ctx.moveTo(bx, arrowY + 5);
      ctx.lineTo(bx + 3.5, arrowY + 1);
      ctx.stroke();
    }
    ctx.restore();

    // H. DRAWPOINTS & BATEAS (INVERTED-V HOPPERS & PENTAGONAL TUNNELS)
    ctx.save();
    for (let b = 0; b < bellCount; b++) {
      const bx = caveLeft + 15 + b * bellSpacing;

      // Drawbell funnel (trough / batea de extracción)
      ctx.beginPath();
      ctx.moveTo(bx - 14, yUndercut);
      ctx.lineTo(bx + 14, yUndercut);
      ctx.lineTo(bx + 6, yProduction - 10);
      ctx.lineTo(bx - 6, yProduction - 10);
      ctx.closePath();
      ctx.fillStyle = '#182232';
      ctx.fill();
      ctx.strokeStyle = '#ff7700';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Pentagonal drift tunnel portal (gabled roof / bóveda de galería minera)
      ctx.beginPath();
      ctx.moveTo(bx - 10, yProduction + 6);
      ctx.lineTo(bx - 10, yProduction - 4);
      ctx.lineTo(bx, yProduction - 10); // Gable peak
      ctx.lineTo(bx + 10, yProduction - 4);
      ctx.lineTo(bx + 10, yProduction + 6);
      ctx.closePath();
      ctx.fillStyle = '#0a101a';
      ctx.fill();
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Batea opening / LHD ore chute
      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(bx - 3, yProduction - 9, 6, 4);
    }

    // Inverted-V Apex Pillars between drawpoints (high stress / rockburst hazard)
    for (let b = 0; b < bellCount - 1; b++) {
      const pLeft = caveLeft + 15 + b * bellSpacing + 14;
      const pRight = caveLeft + 15 + (b + 1) * bellSpacing - 14;
      const pMid = (pLeft + pRight) / 2;

      ctx.beginPath();
      ctx.moveTo(pLeft, yUndercut);
      ctx.lineTo(pRight, yUndercut);
      ctx.lineTo(pMid, yProduction - 10);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 102, 0, 0.22)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 130, 20, 0.55)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Production floor line
    ctx.strokeStyle = '#2b3f5c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(caveLeft - 50, yProduction + 6);
    ctx.lineTo(caveRight + 50, yProduction + 6);
    ctx.stroke();

    // Educational footnote below drawpoints
    ctx.fillStyle = 'rgba(160, 185, 215, 0.75)';
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('El mineral quebrado fluye simultáneamente por múltiples bateas hacia el nivel de producción', caveCenterX, yProduction + 22);
    ctx.restore();

    // 5. UNDERGROUND MINING DRIFTS & VENTILATION SHAFT
    // Undercut Drift run
    ctx.fillStyle = '#111c2b';
    ctx.strokeStyle = '#00e1ff';
    ctx.lineWidth = 1;
    ctx.fillRect(caveLeft - 30, yUndercut - 5, (caveRight - caveLeft) + 60, 10);
    ctx.strokeRect(caveLeft - 30, yUndercut - 5, (caveRight - caveLeft) + 60, 10);

    // Production Drift run
    ctx.fillStyle = '#111c2b';
    ctx.fillRect(caveLeft - 60, yProduction - 6, (caveRight - caveLeft) + 120, 12);
    ctx.strokeRect(caveLeft - 60, yProduction - 6, (caveRight - caveLeft) + 120, 12);

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

    // -------------------------------------------------------------
    // 6. INSTRUMENTATION LAYERS (UNIFIED GEOPHONES + DYNAMIC DAS COVERAGE EXPANSION)
    // Demonstrates physically how turning ON DAS coverage shrinks and eliminates the red blind area
    // -------------------------------------------------------------

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

    // =========================================================
    // A. DYNAMIC RED OUT-OF-RANGE AREA (SHRINKS WHEN DAS IS TURNED ON)
    // =========================================================
    if (dasCoverageAmount < 0.99) {
      const redAlpha = Math.max(0, 1.0 - dasCoverageAmount);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, ySurface);
      ctx.lineTo(mainWidth, ySurface);

      // As dasCoverageAmount increases from 0 to 1, the red blind area's lower edge shrinks upward towards ySurface:
      const rightFullY = Math.min(yBottom, getUpperCoverageY(mainWidth));
      const rightShrunkY = ySurface + (rightFullY - ySurface) * (1.0 - dasCoverageAmount);
      ctx.lineTo(mainWidth, rightShrunkY);

      for (let px = mainWidth; px >= 0; px -= 4) {
        const fullBlindY = Math.min(yBottom, getUpperCoverageY(px));
        const shrunkBlindY = ySurface + (fullBlindY - ySurface) * (1.0 - dasCoverageAmount);
        ctx.lineTo(px, shrunkBlindY);
      }
      ctx.closePath();

      // Red warning gradient across the remaining blind area
      const blindGrad = ctx.createLinearGradient(0, ySurface, 0, yCaveTop + 40);
      blindGrad.addColorStop(0, "rgba(255, 30, 20, " + (0.22 * redAlpha) + ")");
      blindGrad.addColorStop(0.7, "rgba(255, 40, 26, " + (0.14 * redAlpha) + ")");
      blindGrad.addColorStop(1, "rgba(255, 40, 26, " + (0.03 * redAlpha) + ")");
      ctx.fillStyle = blindGrad;
      ctx.fill();

      // Shrunk boundary dashed stroke
      ctx.strokeStyle = "rgba(255, 75, 85, " + (0.85 * redAlpha) + ")";
      ctx.lineWidth = 1.8;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Diagonal attenuation hatching
      ctx.strokeStyle = "rgba(255, 75, 85, " + (0.05 * redAlpha) + ")";
      ctx.lineWidth = 1;
      for (let hx = -height; hx < mainWidth + height; hx += 32) {
        ctx.beginPath();
        ctx.moveTo(hx, ySurface);
        ctx.lineTo(hx + 180, ySurface + 180);
        ctx.stroke();
      }

      // Explanatory badge in the center of the shrinking red area
      const blindCenterY = ySurface + (yCaveTop - 50 - ySurface) * (1.0 - dasCoverageAmount);
      if (blindCenterY > ySurface + 14) {
        ctx.fillStyle = "rgba(255, 90, 90, " + (0.9 * redAlpha) + ")";
        ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        if (dasCoverageAmount < 0.2) {
          ctx.fillText('🔴 ÁREA ROJA FUERA DE ALCANCE (>300 m DE BOREHOLES DE TÚNEL)', caveCenterX, blindCenterY);
          ctx.font = '8px "JetBrains Mono", monospace';
          ctx.fillStyle = "rgba(255, 170, 170, " + (0.75 * redAlpha) + ")";
          ctx.fillText('Vacío superior ciego: ondas >150 Hz disipadas antes de llegar a los geófonos', caveCenterX, blindCenterY + 13);
        } else {
          ctx.fillText('⚡ REDUCIENDO ÁREA CIEGA... (' + Math.round((1 - dasCoverageAmount) * 58) + '% RESTANTE)', caveCenterX, blindCenterY);
        }
      }
      ctx.restore();

      // Sombra Acústica del Air Gap en modo geófonos
      if (dasCoverageAmount < 0.5) {
        ctx.save();
        ctx.fillStyle = "rgba(10, 15, 25, " + (0.6 * (1.0 - dasCoverageAmount * 2)) + ")";
        ctx.beginPath();
        ctx.moveTo(caveLeft - 5, yAirGap);
        ctx.lineTo(caveRight + 5, yAirGap);
        ctx.lineTo(caveRight + 18, yUndercut);
        ctx.lineTo(caveLeft - 18, yUndercut);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // =========================================================
    // B. EXPANDING DAS COVERAGE ENVELOPE (LIGHTS UP AS DAS ACTIVATES)
    // =========================================================
    if (dasCoverageAmount > 0.05) {
      ctx.save();
      const dasAlpha = dasCoverageAmount;
      const bPermWestX = caveLeft - 44;
      const bPermEastX = caveRight + 44;

      const dasGrad = ctx.createLinearGradient(0, ySurface, 0, yProduction);
      dasGrad.addColorStop(0, "rgba(0, 240, 255, " + (0.07 * dasAlpha) + ")");
      dasGrad.addColorStop(0.5, "rgba(0, 255, 163, " + (0.05 * dasAlpha) + ")");
      dasGrad.addColorStop(1, "rgba(0, 240, 255, " + (0.02 * dasAlpha) + ")");
      ctx.fillStyle = dasGrad;

      // Draw coverage envelope encompassing the entire caving volume and flanks
      ctx.beginPath();
      ctx.moveTo(bPermWestX - 16, ySurface);
      ctx.lineTo(bPermEastX + 16, ySurface);
      ctx.lineTo(bPermEastX + 16, yHaulage + 20);
      ctx.lineTo(bPermWestX - 16, yHaulage + 20);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "rgba(0, 240, 255, " + (0.35 * dasAlpha) + ")";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      if (dasCoverageAmount > 0.6) {
        ctx.save();
        const badgeText = '✅ COBERTURA VOLUMÉTRICA DAS 100% · CERO PUNTOS CIEGOS (FURLONG & ANDERSON)';
        ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
        const txtWidth = ctx.measureText(badgeText).width;
        ctx.fillStyle = 'rgba(4, 10, 20, 0.92)';
        ctx.strokeStyle = 'rgba(0, 240, 255, ' + (0.75 * dasAlpha) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(caveCenterX - txtWidth / 2 - 8, ySurface + 6, txtWidth + 16, 16, 3);
        } else {
          ctx.rect(caveCenterX - txtWidth / 2 - 8, ySurface + 6, txtWidth + 16, 16);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#00f0ff';
        ctx.textAlign = 'center';
        ctx.fillText(badgeText, caveCenterX, ySurface + 17.5);
        ctx.restore();
      }
      ctx.restore();
    }

    // =========================================================
    // C. TRADITIONAL BOREHOLE GEOPHONES (ALWAYS PRESENT IN TUNNELS)
    // =========================================================
    // Sensitivity lobes around each borehole station (300m)
    geophoneStations.forEach((geo) => {
      ctx.save();
      const geoAlpha = (dasCoverageAmount > 0.6) ? 0.35 : 1.0;
      ctx.strokeStyle = "rgba(0, 225, 255, " + (0.18 * geoAlpha) + ")";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.arc(geo.x, geo.y, r300, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const radGrad = ctx.createRadialGradient(geo.x, geo.y, 0, geo.x, geo.y, r300);
      radGrad.addColorStop(0, "rgba(0, 225, 255, " + (0.03 * geoAlpha) + ")");
      radGrad.addColorStop(0.8, "rgba(0, 225, 255, " + (0.008 * geoAlpha) + ")");
      radGrad.addColorStop(1, 'rgba(0, 225, 255, 0)');
      ctx.fillStyle = radGrad;
      ctx.fill();
      ctx.restore();
    });

    // Cemented borehole lines and geophone capsules
    geophoneStations.forEach((geo, idx) => {
      let hitIntensity = 0;
      activeWaves.forEach(w => {
        const d = Math.hypot(geo.x - w.x, geo.y - w.y);
        if (Math.abs(d - w.radiusP) < 18) {
          const atten = Math.pow(Math.max(0, 1.0 - (d / r300)), 2.0);
          hitIntensity = Math.max(hitIntensity, atten);
        }
      });

      const geoAlpha = (dasCoverageAmount > 0.6) ? 0.45 : 1.0;

      // 1. Drilled Borehole line & Grout Sheath
      ctx.save();
      ctx.globalAlpha = geoAlpha;
      ctx.strokeStyle = 'rgba(100, 120, 150, 0.45)';
      ctx.lineWidth = 3.5;
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

      // Collar
      ctx.fillStyle = '#ffb020';
      ctx.fillRect(geo.tunnelX - 2, geo.tunnelY - 2, 4, 4);

      // Capsule
      const capsuleColor = hitIntensity > 0.08 ? '#ff4b55' : '#ffb020';
      ctx.fillStyle = capsuleColor;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.shadowColor = capsuleColor;
      ctx.shadowBlur = hitIntensity > 0.08 ? 14 : 4;

      const sSize = 6.5;
      ctx.fillRect(geo.x - sSize / 2, geo.y - sSize / 2, sSize, sSize);
      ctx.strokeRect(geo.x - sSize / 2, geo.y - sSize / 2, sSize, sSize);

      // Station ID
      ctx.fillStyle = '#ffc83b';
      ctx.font = 'bold 7.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(geo.id, geo.x, geo.y - 5);
      ctx.restore();
    });

    // =========================================================
    // D. FIBERANDES DAS ARRAY (LIGHTS UP AS DAS COVERAGE ACTIVATES)
    // =========================================================
    const bPermWestX = caveLeft - 44;   // Permanent West Flank Borehole
    const bPermEastX = caveRight + 44;  // Permanent East Flank Borehole
    const bSac1X = caveCenterX - 24;     // Sacrificial 1 in Orebody
    const bSac2X = caveCenterX + 24;     // Sacrificial 2 in Orebody
    const yTrunkSurface = ySurface - 2;
    const yBoreholeBottom = yHaulage + 28;

    // DAS fibers opacity scales with dasCoverageAmount (visible as subtle ghost when off, fully glowing when on)
    const fiberAlpha = Math.max(0.18, dasCoverageAmount);

    ctx.save();
    ctx.globalAlpha = fiberAlpha;

    // 1. Surface Trunk Line (Caseta to all boreholes in daisy chain)
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
    ctx.lineWidth = 2.2;
    ctx.setLineDash([4, 2]);
    ctx.beginPath();
    ctx.moveTo(bPermWestX, yTrunkSurface);
    ctx.lineTo(shackX, yTrunkSurface);
    ctx.lineTo(shaftX, yTrunkSurface);
    ctx.lineTo(bSac1X, yTrunkSurface);
    ctx.lineTo(bSac2X, yTrunkSurface);
    ctx.lineTo(bPermEastX, yTrunkSurface);
    ctx.stroke();
    ctx.setLineDash([]);

    // Hermetic ODF splice nodes
    [bPermWestX, shackX, shaftX, bSac1X, bSac2X, bPermEastX].forEach(cx => {
      ctx.fillStyle = cx === shackX ? '#00ffa3' : '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(cx, yTrunkSurface, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    });

    // 2. DAS Boreholes (Perimeter loops + Sacrificial cables)
    const fiberBoreholes = [
      { id: 'B-Perm-W', p1: { x: bPermWestX, y: ySurface }, p2: { x: bPermWestX, y: yBoreholeBottom }, color: '#00f0ff', label: 'B-Perm-W (Loop Flanco Oeste)', isLoop: true, isSacrificial: false },
      { id: 'B-Sac-1', p1: { x: bSac1X, y: ySurface }, p2: { x: bSac1X, y: yCaveTop + 14 }, color: '#ffaa00', label: 'B-Sac-1 (DAS Sacrificio)', isLoop: false, isSacrificial: true },
      { id: 'B-Sac-2', p1: { x: bSac2X, y: ySurface }, p2: { x: bSac2X, y: yCaveTop + 14 }, color: '#ffaa00', label: 'B-Sac-2 (DAS Sacrificio)', isLoop: false, isSacrificial: true },
      { id: 'B-Perm-E', p1: { x: bPermEastX, y: ySurface }, p2: { x: bPermEastX, y: yBoreholeBottom }, color: '#00f0ff', label: 'B-Perm-E (Loop Flanco Este)', isLoop: true, isSacrificial: false }
    ];

    fiberBoreholes.forEach((bh, idx) => {
      const dx = bh.p2.x - bh.p1.x;
      const dy = bh.p2.y - bh.p1.y;
      const bLen = Math.hypot(dx, dy) || 1;
      const nx = (-dy / bLen) * 2.2;
      const ny = (dx / bLen) * 2.2;

      // Cement grout sheath
      ctx.strokeStyle = 'rgba(11, 32, 56, 0.85)';
      ctx.lineWidth = bh.isLoop ? 7 : 5;
      ctx.beginPath();
      ctx.moveTo(bh.p1.x, bh.p1.y);
      ctx.lineTo(bh.p2.x, bh.p2.y);
      ctx.stroke();

      let cableBurst = 0;
      activeWaves.forEach(w => {
        const d = distToSegment({ x: w.x, y: w.y }, bh.p1, bh.p2);
        if (Math.abs(d - w.radiusP) < 14) {
          cableBurst = Math.max(cableBurst, 1.0);
        }
      });

      const breathing = Math.sin(time * 3 + idx * 0.8) * 0.12;
      const alpha = Math.min(1.0, 0.75 + breathing + cableBurst * 0.6);

      ctx.save();
      ctx.strokeStyle = cableBurst > 0.15 ? '#ffffff' : bh.color;
      ctx.lineWidth = cableBurst > 0.15 ? 3.8 : 2.2;
      ctx.shadowColor = bh.color;
      ctx.shadowBlur = cableBurst > 0.15 ? 18 : 8;
      ctx.globalAlpha = alpha * fiberAlpha;

      if (bh.isLoop) {
        ctx.beginPath();
        ctx.moveTo(bh.p1.x + nx, bh.p1.y + ny);
        ctx.lineTo(bh.p2.x + nx, bh.p2.y + ny);
        ctx.quadraticCurveTo(
          bh.p2.x + (dx / bLen) * 3.5, bh.p2.y + (dy / bLen) * 3.5,
          bh.p2.x - nx, bh.p2.y - ny
        );
        ctx.lineTo(bh.p1.x - nx, bh.p1.y - ny);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(bh.p1.x, bh.p1.y);
        ctx.lineTo(bh.p2.x, bh.p2.y);
        ctx.stroke();
      }
      ctx.restore();

      // Optical core line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (bh.isLoop) {
        ctx.moveTo(bh.p1.x + nx, bh.p1.y + ny);
        ctx.lineTo(bh.p2.x + nx, bh.p2.y + ny);
        ctx.quadraticCurveTo(
          bh.p2.x + (dx / bLen) * 3.5, bh.p2.y + (dy / bLen) * 3.5,
          bh.p2.x - nx, bh.p2.y - ny
        );
        ctx.lineTo(bh.p1.x - nx, bh.p1.y - ny);
      } else {
        ctx.moveTo(bh.p1.x, bh.p1.y);
        ctx.lineTo(bh.p2.x, bh.p2.y);
      }
      ctx.stroke();

      if (bh.isSacrificial) {
        ctx.save();
        ctx.fillStyle = '#ffaa00';
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(bh.p2.x, bh.p2.y, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bh.p2.x - 3.5, bh.p2.y - 2.5);
        ctx.lineTo(bh.p2.x + 3.5, bh.p2.y + 2.5);
        ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = bh.color;
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      const labelY = (idx % 2 === 0) ? bh.p1.y - 7 : bh.p1.y - 17;
      ctx.fillText(bh.label, bh.p1.x, labelY);
    });

    // 3. Multi-level Underground Gallery Fiber Network (Daisy-Chain)
    ctx.strokeStyle = '#00ffa3';
    ctx.lineWidth = 2.0;
    ctx.shadowColor = '#00ffa3';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(shaftX, ySurface);
    ctx.lineTo(shaftX, yUndercut - 4);
    ctx.lineTo(caveRight + 30, yUndercut - 4);
    ctx.lineTo(caveRight + 30, yProduction - 5);
    ctx.lineTo(caveLeft - 60, yProduction - 5);
    ctx.lineTo(caveLeft - 60, yHaulage - 6);
    ctx.lineTo(caveRight + 60, yHaulage - 6);
    ctx.stroke();

    // Gallery Splice Nodes
    const ugSpliceBoxes = [
      { x: shaftX, y: yUndercut - 4 },
      { x: caveRight + 30, y: yUndercut - 4 },
      { x: caveRight + 30, y: yProduction - 5 },
      { x: caveLeft - 60, y: yProduction - 5 },
      { x: caveLeft - 60, y: yHaulage - 6 },
      { x: caveRight + 60, y: yHaulage - 6 }
    ];
    ugSpliceBoxes.forEach(sb => {
      ctx.fillStyle = '#00ffa3';
      ctx.shadowColor = '#00ffa3';
      ctx.shadowBlur = 6;
      ctx.fillRect(sb.x - 2.5, sb.y - 2.5, 5, 5);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(sb.x - 2.5, sb.y - 2.5, 5, 5);
    });

    // 4. Continuous Laser Pulses (active when dasCoverageAmount > 0.25)
    if (dasCoverageAmount > 0.25) {
      const perimeterDaisyChainPath = [
        { x: shackX, y: yTrunkSurface },
        { x: bPermWestX - 2, y: yTrunkSurface },
        { x: bPermWestX - 2, y: yBoreholeBottom },
        { x: bPermWestX + 2, y: yBoreholeBottom },
        { x: bPermWestX + 2, y: yTrunkSurface },
        { x: bPermEastX - 2, y: yTrunkSurface },
        { x: bPermEastX - 2, y: yBoreholeBottom },
        { x: bPermEastX + 2, y: yBoreholeBottom },
        { x: bPermEastX + 2, y: yTrunkSurface },
        { x: shackX, y: yTrunkSurface }
      ];
      drawFiberLaserRay(perimeterDaisyChainPath, 130, 2, '#00f0ff', 28);

      const galleryDaisyChainPath = [
        { x: shackX, y: yTrunkSurface },
        { x: shaftX, y: yTrunkSurface },
        { x: shaftX, y: yUndercut - 4 },
        { x: caveRight + 30, y: yUndercut - 4 },
        { x: caveRight + 30, y: yProduction - 5 },
        { x: caveLeft - 60, y: yProduction - 5 },
        { x: caveLeft - 60, y: yHaulage - 6 },
        { x: caveRight + 60, y: yHaulage - 6 },
        { x: shaftX, y: yHaulage - 6 },
        { x: shaftX, y: ySurface },
        { x: shackX, y: yTrunkSurface }
      ];
      drawFiberLaserRay(galleryDaisyChainPath, 110, 2, '#00ffa3', 28);

      const bSac1Path = [
        { x: shackX, y: yTrunkSurface },
        { x: bSac1X, y: yTrunkSurface },
        { x: bSac1X, y: yCaveTop + 14 },
        { x: bSac1X, y: yTrunkSurface },
        { x: shackX, y: yTrunkSurface }
      ];
      drawFiberLaserRay(bSac1Path, 75, 1, '#ffaa00', 24);

      const bSac2Path = [
        { x: shackX, y: yTrunkSurface },
        { x: bSac2X, y: yTrunkSurface },
        { x: bSac2X, y: yCaveTop + 14 },
        { x: bSac2X, y: yTrunkSurface },
        { x: shackX, y: yTrunkSurface }
      ];
      drawFiberLaserRay(bSac2Path, 82, 1, '#ffaa00', 24);
    }
    ctx.restore();

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

