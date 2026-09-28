/* ============================================================
   FIBERANDES — Hero Photonics & Seismic Canvas Engine
   Simulates Coherent OTDR laser pulses and acoustic/strain wavefields
   ============================================================ */
(function() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let w = 0, h = 0;
  let dpr = 1;
  let t = 0;
  let mouse = { x: -1000, y: -1000, active: false };

  // Fiber route points (Andean rock profile & tunnel traverse)
  let fiberPoints = [];
  let laserPulses = [];
  let seismicWaves = [];
  let backscatterParticles = [];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.parentElement.offsetWidth;
    h = canvas.parentElement.offsetHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    generateFiberRoute();
  }

  function generateFiberRoute() {
    fiberPoints = [];
    const numPoints = Math.max(12, Math.floor(w / 80));
    const baseY = h * 0.58;

    for (let i = 0; i <= numPoints; i++) {
      const x = (i / numPoints) * w;
      // Gentle Andean elevation profile with underground descent
      const elevation = Math.sin(i * 0.45) * 45 + Math.cos(i * 0.2) * 35;
      const y = baseY + elevation + (i > numPoints * 0.6 ? 40 : 0);
      fiberPoints.push({ x, y });
    }
  }

  // Laser pulse travelling along the fiber
  class LaserPulse {
    constructor() {
      this.progress = 0; // 0 to 1
      this.speed = 0.0035 + Math.random() * 0.002;
      this.color = Math.random() > 0.4 ? '#00F0FF' : (Math.random() > 0.5 ? '#00FFA3' : '#B066FF');
      this.size = 3.5;
    }

    update() {
      this.progress += this.speed;
      return this.progress <= 1;
    }

    getPos() {
      const idx = this.progress * (fiberPoints.length - 1);
      const i = Math.floor(idx);
      const frac = idx - i;
      const p1 = fiberPoints[i];
      const p2 = fiberPoints[Math.min(i + 1, fiberPoints.length - 1)];
      if (!p1 || !p2) return { x: 0, y: 0 };
      return {
        x: p1.x + (p2.x - p1.x) * frac,
        y: p1.y + (p2.y - p1.y) * frac
      };
    }
  }

  // Seismic / acoustic event ripple
  class SeismicWave {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.radius = 4;
      this.maxRadius = 140 + Math.random() * 100;
      this.speed = 1.4;
      this.opacity = 0.7;
    }

    update() {
      this.radius += this.speed;
      this.opacity = Math.max(0, 0.7 * (1 - this.radius / this.maxRadius));
      return this.radius < this.maxRadius;
    }

    draw(context) {
      context.save();
      context.beginPath();
      context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      context.strokeStyle = `rgba(0, 240, 255, ${this.opacity * 0.6})`;
      context.lineWidth = 1.5;
      context.stroke();

      // Secondary echo
      if (this.radius > 25) {
        context.beginPath();
        context.arc(this.x, this.y, this.radius - 22, 0, Math.PI * 2);
        context.strokeStyle = `rgba(0, 255, 163, ${this.opacity * 0.35})`;
        context.lineWidth = 1;
        context.stroke();
      }
      context.restore();
    }
  }

  // Rayleigh backscatter particle
  class BackscatterParticle {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.vx = (Math.random() - 0.5) * 1.5;
      this.vy = (Math.random() - 0.5) * 1.5;
      this.life = 1;
      this.decay = 0.02 + Math.random() * 0.02;
      this.color = Math.random() > 0.5 ? '#00FFA3' : '#00F0FF';
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.life -= this.decay;
      return this.life > 0;
    }
    draw(context) {
      context.save();
      context.fillStyle = this.color;
      context.globalAlpha = this.life * 0.8;
      context.beginPath();
      context.arc(this.x, this.y, 1.8, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  function spawnWave(x, y) {
    seismicWaves.push(new SeismicWave(x, y));
  }

  // Periodic events
  let lastAutoWave = 0;

  function render() {
    t += 0.016;
    ctx.clearRect(0, 0, w, h);

    // Occasional natural microseism in the rock mass
    if (t - lastAutoWave > 3.2) {
      lastAutoWave = t;
      const targetPoint = fiberPoints[Math.floor(Math.random() * fiberPoints.length)];
      if (targetPoint) {
        spawnWave(targetPoint.x + (Math.random() - 0.5) * 120, targetPoint.y + 40 + Math.random() * 60);
      }
    }

    // Occasional laser pulse injection from the interrogator
    if (Math.random() < 0.04 && laserPulses.length < 9) {
      laserPulses.push(new LaserPulse());
    }

    // 1. Draw Subsurface geological layer lines (Andes strata)
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let layer = 1; layer <= 4; layer++) {
      ctx.beginPath();
      for (let i = 0; i < fiberPoints.length; i++) {
        const pt = fiberPoints[i];
        const offset = layer * 45 + Math.sin(i * 0.8 + t * 0.2) * 8;
        if (i === 0) ctx.moveTo(pt.x, pt.y + offset);
        else ctx.lineTo(pt.x, pt.y + offset);
      }
      ctx.stroke();
    }
    ctx.restore();

    // 2. Draw seismic wavefields
    seismicWaves = seismicWaves.filter(wave => {
      const alive = wave.update();
      if (alive) wave.draw(ctx);
      return alive;
    });

    // 3. Draw Continuous Optical Fiber Line
    if (fiberPoints.length > 1) {
      ctx.save();

      // Outer Glow
      ctx.beginPath();
      ctx.moveTo(fiberPoints[0].x, fiberPoints[0].y);
      for (let i = 1; i < fiberPoints.length; i++) {
        ctx.lineTo(fiberPoints[i].x, fiberPoints[i].y);
      }
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
      ctx.lineWidth = 8;
      ctx.stroke();

      // Core Glass Fiber Waveguide
      ctx.beginPath();
      ctx.moveTo(fiberPoints[0].x, fiberPoints[0].y);
      for (let i = 1; i < fiberPoints.length; i++) {
        ctx.lineTo(fiberPoints[i].x, fiberPoints[i].y);
      }
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Virtual Sensor Nodes every X meters along the fiber
      for (let i = 0; i < fiberPoints.length; i++) {
        const pt = fiberPoints[i];
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#00F0FF';
        ctx.fill();

        // Subtle node readout lines
        if (i % 3 === 0) {
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y - 4);
          ctx.lineTo(pt.x, pt.y - 12);
          ctx.strokeStyle = 'rgba(0, 255, 163, 0.4)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      ctx.restore();
    }

    // 4. Update and Draw Laser Pulses
    laserPulses = laserPulses.filter(pulse => {
      const alive = pulse.update();
      if (alive) {
        const pos = pulse.getPos();

        // Glow
        ctx.save();
        ctx.shadowColor = pulse.color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, pulse.size, 0, Math.PI * 2);
        ctx.fill();

        // Secondary ring
        ctx.strokeStyle = pulse.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, pulse.size + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Spawn Rayleigh backscatter
        if (Math.random() < 0.25) {
          backscatterParticles.push(new BackscatterParticle(pos.x, pos.y));
        }
      }
      return alive;
    });

    // 5. Update and Draw Backscatter particles
    backscatterParticles = backscatterParticles.filter(p => {
      const alive = p.update();
      if (alive) p.draw(ctx);
      return alive;
    });

    requestAnimationFrame(render);
  }

  // Mouse interaction: clicking or moving creates localized acoustic excitation
  window.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    if (Math.random() < 0.08 && mouse.y < h) {
      spawnWave(mouse.x, mouse.y);
    }
  });

  window.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    if (mx >= 0 && mx <= w && my >= 0 && my <= h) {
      spawnWave(mx, my);
      laserPulses.push(new LaserPulse());
    }
  });

  window.addEventListener('resize', resize);
  resize();
  render();
})();
