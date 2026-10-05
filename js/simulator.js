/* ============================================================
   FIBERANDES — Interactive DFOS vs. discrete geophone Simulator
   Demonstrates continuous coverage vs. dangerous discrete blind spots
   ============================================================ */
(function() {
  const container = document.getElementById('sim-canvas-container');
  if (!container) return;

  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let w = 0, h = 0, dpr = 1;
  let activeMode = 'dfos'; // 'dfos' or 'esi'
  let eventX = 0.42; // Normalized position (0 to 1) along the 10km section
  let isDragging = false;

  // Discrete geophone stations at normalized intervals: 0.1, 0.3, 0.5, 0.7, 0.9
  const esiStations = [0.10, 0.30, 0.50, 0.70, 0.90];
  const SENSOR_RADIUS = 0.04; // Detection radius of discrete sensor (~400m on a 10km scale)

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = container.offsetWidth;
    h = container.offsetHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }

  function getDetectionStatus() {
    const km = (eventX * 10).toFixed(2);

    if (activeMode === 'dfos') {
      return {
        detected: true,
        type: 'dfos',
        title: `EVENTO LOCALIZADO CON PRECISIÓN MÉTRICA`,
        desc: `Punto exacto: Km ${km} · Cobertura 100% continua · 0 puntos ciegos`,
        badgeClass: 'detected'
      };
    } else {
      // Discrete mode: Check distance to closest station
      let minDist = 1;
      let closestStationIdx = -1;
      esiStations.forEach((st, idx) => {
        const d = Math.abs(eventX - st);
        if (d < minDist) {
          minDist = d;
          closestStationIdx = idx;
        }
      });

      if (minDist <= SENSOR_RADIUS) {
        return {
          detected: true,
          type: 'esi-near',
          title: `DETECCIÓN PARCIAL (ESTACIÓN #${closestStationIdx + 1})`,
          desc: `Ubicación estimada con alta incertidumbre (±300 m) · Sin perfil continuo`,
          badgeClass: 'detected'
        };
      } else {
        const distanceMeters = Math.round(minDist * 10000);
        return {
          detected: false,
          type: 'blindspot',
          title: `❌ NO DETECTADO: PUNTO CIEGO CRÍTICO`,
          desc: `Fractura a ${distanceMeters} m de la estación más cercana. La red discreta no se enteró.`,
          badgeClass: 'blindspot'
        };
      }
    }
  }

  function updateStatusUI() {
    const status = getDetectionStatus();
    const banner = document.getElementById('sim-status-banner');
    if (banner) {
      banner.className = `sim-status-banner ${status.badgeClass}`;
      banner.innerHTML = `<strong>${status.title}</strong> — ${status.desc}`;
    }
  }

  let pulseT = 0;

  function render() {
    pulseT += 0.03;
    ctx.clearRect(0, 0, w, h);

    const padX = 40;
    const lineY = h * 0.52;
    const lineWidth = w - padX * 2;

    // 1. Draw Distance / Kilometer Grid
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.textAlign = 'center';

    for (let k = 0; k <= 10; k++) {
      const gx = padX + (k / 10) * lineWidth;
      ctx.fillText(`${k} km`, gx, lineY + 36);

      ctx.beginPath();
      ctx.moveTo(gx, lineY + 12);
      ctx.lineTo(gx, lineY + 20);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 2. Draw Sensing Line or Discrete Network
    if (activeMode === 'dfos') {
      // --- DFOS MODE: Continuous glowing optical fiber ---
      // Ambient fiber glow
      ctx.beginPath();
      ctx.moveTo(padX, lineY);
      ctx.lineTo(padX + lineWidth, lineY);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
      ctx.lineWidth = 10;
      ctx.stroke();

      // Main core line
      ctx.beginPath();
      ctx.moveTo(padX, lineY);
      ctx.lineTo(padX + lineWidth, lineY);
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Virtual sensors every 1% along line (representing 10,000+ points)
      for (let i = 0; i <= 100; i++) {
        const sx = padX + (i / 100) * lineWidth;
        ctx.fillStyle = i % 5 === 0 ? '#00FFA3' : 'rgba(0, 240, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(sx, lineY, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Laser backscatter pulse running from interrogator (left) to event
      const curEventScreenX = padX + eventX * lineWidth;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(padX, lineY);
      ctx.lineTo(curEventScreenX, lineY);
      ctx.strokeStyle = `rgba(0, 255, 163, ${0.6 + Math.sin(pulseT * 2) * 0.3})`;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();

    } else {
      // --- DISCRETE MODE: stations with massive blind spots ---
      // Faint reference line
      ctx.beginPath();
      ctx.moveTo(padX, lineY);
      ctx.lineTo(padX + lineWidth, lineY);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Discrete Stations and their sensing spheres
      esiStations.forEach((st, idx) => {
        const sx = padX + st * lineWidth;
        const sRadiusPx = SENSOR_RADIUS * lineWidth;

        // Station detection reach sphere
        ctx.beginPath();
        ctx.arc(sx, lineY, sRadiusPx, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 176, 32, 0.08)';
        ctx.strokeStyle = 'rgba(255, 176, 32, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.fill();

        // Station physical box
        ctx.fillStyle = '#FFB020';
        ctx.fillRect(sx - 7, lineY - 7, 14, 14);

        // Antenna / Label
        ctx.beginPath();
        ctx.moveTo(sx, lineY - 7);
        ctx.lineTo(sx, lineY - 18);
        ctx.strokeStyle = '#FFB020';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#FFB020';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillText(`G-${idx + 1}`, sx, lineY - 22);
      });

      // Blind spot hazard zones label in between stations
      ctx.fillStyle = 'rgba(255, 75, 85, 0.7)';
      ctx.font = '10px "JetBrains Mono", monospace';
      for (let i = 0; i < esiStations.length - 1; i++) {
        const midX = padX + ((esiStations[i] + esiStations[i + 1]) / 2) * lineWidth;
        ctx.fillText('⚠ PUNTO CIEGO ⚠', midX, lineY - 14);
      }
    }

    // 3. Draw The Active Event (Microfractura / Fuga / Tensión)
    const ex = padX + eventX * lineWidth;
    const status = getDetectionStatus();

    // Pulse rings around event
    const ringRadius = 12 + (Math.sin(pulseT * 3) + 1) * 8;
    ctx.beginPath();
    ctx.arc(ex, lineY, ringRadius, 0, Math.PI * 2);
    ctx.strokeStyle = status.detected ? 'rgba(0, 255, 163, 0.7)' : 'rgba(255, 75, 85, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Event Center Node
    ctx.beginPath();
    ctx.arc(ex, lineY, 6, 0, Math.PI * 2);
    ctx.fillStyle = status.detected ? '#00FFA3' : '#FF4B55';
    ctx.fill();

    // Event Pin / Flag
    ctx.beginPath();
    ctx.moveTo(ex, lineY - 8);
    ctx.lineTo(ex, lineY - 38);
    ctx.strokeStyle = status.detected ? '#00FFA3' : '#FF4B55';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Pin banner
    const eventLabel = status.detected ? '✔ DETECCIÓN' : '✖ NO DETECTADO';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.fillStyle = status.detected ? '#00FFA3' : '#FF4B55';
    ctx.fillText(eventLabel, ex, lineY - 44);

    requestAnimationFrame(render);
  }

  // Mouse & Touch events on canvas to drag the event
  function handleInput(clientX) {
    const rect = canvas.getBoundingClientRect();
    const padX = 40;
    const lineWidth = w - padX * 2;
    const relativeX = (clientX - rect.left - padX) / lineWidth;
    eventX = Math.max(0.01, Math.min(0.99, relativeX));
    updateStatusUI();
  }

  canvas.addEventListener('mousedown', e => {
    isDragging = true;
    handleInput(e.clientX);
  });
  window.addEventListener('mousemove', e => {
    if (isDragging) handleInput(e.clientX);
  });
  window.addEventListener('mouseup', () => { isDragging = false; });

  canvas.addEventListener('touchstart', e => {
    if (e.touches.length > 0) {
      isDragging = true;
      handleInput(e.touches[0].clientX);
    }
  }, { passive: true });
  window.addEventListener('touchmove', e => {
    if (isDragging && e.touches.length > 0) {
      handleInput(e.touches[0].clientX);
    }
  }, { passive: true });
  window.addEventListener('touchend', () => { isDragging = false; });

  // Mode switcher buttons
  const modeButtons = document.querySelectorAll('.sim-mode-btn');
  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      modeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeMode = btn.getAttribute('data-sim');
      updateStatusUI();
    });
  });

  window.addEventListener('resize', resize);
  resize();
  updateStatusUI();
})();
