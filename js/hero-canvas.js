/* ============================================================
   FIBERANDES — Hero Photonics & Seismic Canvas Engine
   Interrogator fires laser pulses down the fiber; seismic waves that
   reach the fiber send a return signal back and get located by km.
   ============================================================ */
(function () {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  // Second canvas sits above .hero-veil so the interrogator and event labels aren't dimmed.
  const uiCanvas = document.getElementById('hero-canvas-ui');
  const ui = uiCanvas ? uiCanvas.getContext('2d') : ctx;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FIBER_KM = 65;
  const CYAN = '#00F0FF';
  const EMERALD = '#00FFA3';
  const AMBER = '#FFB020';
  const MAX_EVENTS = 4;

  let w = 0, h = 0, t = 0;
  let fiberPoints = [];
  let pulses = [];
  let waves = [];
  let particles = [];
  let returns = [];
  let events = [];
  let ledFlash = 0;
  let ledColor = EMERALD;
  let running = false;
  let visible = true;
  let lastAutoWave = 0;
  let lastMouseWave = 0;

  const INTERROGATOR_X = 46;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.parentElement.offsetWidth;
    h = canvas.parentElement.offsetHeight;
    [canvas, uiCanvas].forEach(c => {
      if (!c) return;
      c.width = w * dpr;
      c.height = h * dpr;
    });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ui.setTransform(dpr, 0, 0, dpr, 0, 0);
    generateFiberRoute();
  }

  // Fit the fiber inside the .hero-demo-stage lane (below its hint line).
  function fiberLane() {
    const stage = document.querySelector('.hero-demo-stage');
    if (!stage) return { center: h * 0.58, height: 200 };
    const r = stage.getBoundingClientRect();
    const hint = stage.querySelector('.hero-demo-hint');
    const top = (hint ? hint.getBoundingClientRect().bottom : r.top) + 30;
    const bottom = r.bottom - 10;
    const canvasTop = canvas.getBoundingClientRect().top;
    return { center: (top + bottom) / 2 - canvasTop, height: bottom - top };
  }

  function generateFiberRoute() {
    fiberPoints = [];
    const startX = INTERROGATOR_X;
    const n = Math.max(12, Math.floor((w - startX) / 80));
    const lane = fiberLane();
    // The raw profile spans roughly -80..+120 around its baseline.
    const amp = Math.min(1, lane.height / 200);
    const baseY = lane.center - 20 * amp;
    for (let i = 0; i <= n; i++) {
      const x = startX + (i / n) * (w - startX);
      const elevation = (Math.sin(i * 0.45) * 45 + Math.cos(i * 0.2) * 35 + (i > n * 0.6 ? 40 : 0)) * amp;
      fiberPoints.push({ x, y: baseY + elevation });
    }
  }

  function pointAt(progress) {
    const idx = progress * (fiberPoints.length - 1);
    const i = Math.floor(idx);
    const frac = idx - i;
    const p1 = fiberPoints[i];
    const p2 = fiberPoints[Math.min(i + 1, fiberPoints.length - 1)];
    if (!p1 || !p2) return { x: 0, y: 0 };
    return { x: p1.x + (p2.x - p1.x) * frac, y: p1.y + (p2.y - p1.y) * frac };
  }

  function closestOnFiber(x, y) {
    let best = { dist: Infinity, x: 0, y: 0, progress: 0 };
    const segs = fiberPoints.length - 1;
    for (let i = 0; i < segs; i++) {
      const a = fiberPoints[i];
      const b = fiberPoints[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const s = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
      const px = a.x + dx * s;
      const py = a.y + dy * s;
      const d = Math.hypot(x - px, y - py);
      if (d < best.dist) best = { dist: d, x: px, y: py, progress: (i + s) / segs };
    }
    return best;
  }

  function flashLed(color) {
    if (color === AMBER || ledColor !== AMBER || ledFlash < 0.3) {
      ledColor = color;
      ledFlash = 1;
    }
  }

  class LaserPulse {
    constructor() {
      this.progress = 0;
      this.speed = 0.0035 + Math.random() * 0.002;
      flashLed(CYAN);
    }
    update() {
      this.progress += this.speed;
      return this.progress <= 1;
    }
  }

  class SeismicWave {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.radius = 4;
      this.maxRadius = 140 + Math.random() * 100;
      this.speed = 1.4;
      this.opacity = 0.7;
      this.hit = closestOnFiber(x, y);
      this.detected = this.hit.dist > this.maxRadius;
    }
    update() {
      this.radius += this.speed;
      this.opacity = Math.max(0, 0.7 * (1 - this.radius / this.maxRadius));
      if (!this.detected && this.radius >= this.hit.dist) {
        this.detected = true;
        onFiberContact(this.hit);
      }
      return this.radius < this.maxRadius;
    }
    draw() {
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 240, 255, ${this.opacity * 0.6})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (this.radius > 25) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius - 22, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 255, 163, ${this.opacity * 0.35})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  class BackscatterParticle {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.vx = (Math.random() - 0.5) * 1.5;
      this.vy = (Math.random() - 0.5) * 1.5;
      this.life = 1;
      this.decay = 0.02 + Math.random() * 0.02;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.life -= this.decay;
      return this.life > 0;
    }
    draw() {
      ctx.save();
      ctx.fillStyle = CYAN;
      ctx.globalAlpha = this.life * 0.8;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // A wave touched the fiber: flash there, then send the signal back to the interrogator.
  function onFiberContact(hit) {
    const ev = {
      x: hit.x,
      y: hit.y,
      km: hit.progress * FIBER_KM,
      age: 0,
      labelAge: -1
    };
    events.push(ev);
    if (events.length > MAX_EVENTS) events.shift();
    returns.push({ progress: hit.progress, ev });
  }

  function spawnWave(x, y) {
    waves.push(new SeismicWave(x, y));
  }

  function drawStrata() {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let layer = 1; layer <= 4; layer++) {
      ctx.beginPath();
      fiberPoints.forEach((pt, i) => {
        const y = pt.y + layer * 45 + Math.sin(i * 0.8 + t * 0.2) * 8;
        if (i === 0) ctx.moveTo(pt.x, y);
        else ctx.lineTo(pt.x, y);
      });
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFiber() {
    if (fiberPoints.length < 2) return;
    ctx.save();
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(fiberPoints[0].x, fiberPoints[0].y);
      for (let i = 1; i < fiberPoints.length; i++) ctx.lineTo(fiberPoints[i].x, fiberPoints[i].y);
    };
    trace();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
    ctx.lineWidth = 8;
    ctx.stroke();
    trace();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    fiberPoints.forEach((pt, i) => {
      if (i === 0) return;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = CYAN;
      ctx.fill();
      if (i % 3 === 0) {
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y - 4);
        ctx.lineTo(pt.x, pt.y - 12);
        ctx.strokeStyle = 'rgba(0, 255, 163, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
    ctx.restore();
  }

  function drawInterrogator() {
    const p = fiberPoints[0];
    if (!p) return;
    const bw = 30, bh = 20;
    const x = p.x - bw;
    const y = p.y - bh / 2;

    ui.save();
    ui.beginPath();
    if (ui.roundRect) ui.roundRect(x, y, bw, bh, 4);
    else ui.rect(x, y, bw, bh);
    ui.fillStyle = 'rgba(9, 14, 26, 0.95)';
    ui.fill();
    ui.strokeStyle = 'rgba(0, 240, 255, 0.8)';
    ui.lineWidth = 1.2;
    ui.stroke();

    ui.fillStyle = 'rgba(0, 240, 255, 0.35)';
    ui.fillRect(x + 5, y + 6, 12, 2);
    ui.fillRect(x + 5, y + 11, 8, 2);

    ui.fillStyle = ledFlash > 0.05 ? ledColor : 'rgba(0, 255, 163, 0.45)';
    ui.shadowColor = ledColor;
    ui.shadowBlur = 12 * ledFlash;
    ui.beginPath();
    ui.arc(x + bw - 7, y + bh / 2, 2.5, 0, Math.PI * 2);
    ui.fill();
    ui.shadowBlur = 0;

    ui.font = '600 9px "JetBrains Mono", monospace';
    ui.fillStyle = 'rgba(0, 240, 255, 0.75)';
    ui.fillText('KM 0', x, y - 6);
    ui.restore();
  }

  function drawPulses() {
    pulses = pulses.filter(pulse => {
      if (!pulse.update()) return false;
      const pos = pointAt(pulse.progress);
      ctx.save();
      ctx.shadowColor = CYAN;
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 7.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (Math.random() < 0.25) particles.push(new BackscatterParticle(pos.x, pos.y));
      return true;
    });
  }

  function drawReturns() {
    returns = returns.filter(r => {
      r.progress -= 0.012;
      if (r.progress <= 0) {
        flashLed(AMBER);
        r.ev.labelAge = 0;
        return false;
      }
      ui.save();
      ui.fillStyle = AMBER;
      ui.shadowColor = AMBER;
      ui.shadowBlur = 10;
      for (let k = 0; k < 4; k++) {
        const pos = pointAt(Math.min(1, r.progress + k * 0.006));
        ui.globalAlpha = 1 - k * 0.25;
        ui.beginPath();
        ui.arc(pos.x, pos.y, 2.6 - k * 0.4, 0, Math.PI * 2);
        ui.fill();
      }
      ui.restore();
      return true;
    });
  }

  function drawEvents() {
    events = events.filter(ev => {
      ev.age++;
      if (ev.labelAge >= 0) ev.labelAge++;
      if (ev.labelAge > 170) return false;

      ui.save();
      if (ev.age < 50) {
        const k = ev.age / 50;
        ui.strokeStyle = `rgba(255, 176, 32, ${0.9 * (1 - k)})`;
        ui.lineWidth = 2;
        ui.beginPath();
        ui.arc(ev.x, ev.y, 4 + k * 22, 0, Math.PI * 2);
        ui.stroke();
      }
      const dotAlpha = ev.labelAge < 0 ? 1 : Math.max(0, 1 - ev.labelAge / 170);
      ui.globalAlpha = dotAlpha;
      ui.fillStyle = AMBER;
      ui.shadowColor = AMBER;
      ui.shadowBlur = 10;
      ui.beginPath();
      ui.arc(ev.x, ev.y, 3.5, 0, Math.PI * 2);
      ui.fill();
      ui.shadowBlur = 0;

      if (ev.labelAge >= 0) {
        const fadeIn = Math.min(1, ev.labelAge / 12);
        const fadeOut = Math.max(0, 1 - Math.max(0, ev.labelAge - 120) / 50);
        ui.globalAlpha = fadeIn * fadeOut;
        const text = `EVENTO DETECTADO · KM ${ev.km.toFixed(1)}`;
        ui.font = '700 11px "JetBrains Mono", monospace';
        const tw = ui.measureText(text).width;
        const lx = Math.min(Math.max(ev.x - tw / 2 - 8, 8), w - tw - 24);
        const ly = ev.y - 44;
        ui.strokeStyle = 'rgba(255, 176, 32, 0.6)';
        ui.lineWidth = 1;
        ui.beginPath();
        ui.moveTo(ev.x, ev.y - 6);
        ui.lineTo(ev.x, ly + 22);
        ui.stroke();
        ui.fillStyle = 'rgba(9, 14, 26, 0.9)';
        ui.fillRect(lx, ly, tw + 16, 22);
        ui.strokeRect(lx, ly, tw + 16, 22);
        ui.fillStyle = AMBER;
        ui.fillText(text, lx + 8, ly + 15);
      }
      ui.restore();
      return true;
    });
  }

  function render() {
    if (!visible) {
      running = false;
      return;
    }
    t += 0.016;
    ledFlash = Math.max(0, ledFlash - 0.04);
    ctx.clearRect(0, 0, w, h);
    ui.clearRect(0, 0, w, h);

    if (!reduceMotion) {
      if (t - lastAutoWave > 3.2) {
        lastAutoWave = t;
        const pt = fiberPoints[1 + Math.floor(Math.random() * (fiberPoints.length - 1))];
        if (pt) spawnWave(pt.x + (Math.random() - 0.5) * 120, pt.y + 40 + Math.random() * 60);
      }
      if (Math.random() < 0.04 && pulses.length < 9) pulses.push(new LaserPulse());
    }

    drawStrata();
    waves = waves.filter(wave => {
      const alive = wave.update();
      if (alive) wave.draw();
      return alive;
    });
    drawFiber();
    drawPulses();
    particles = particles.filter(p => {
      const alive = p.update();
      if (alive) p.draw();
      return alive;
    });
    drawReturns();
    drawEvents();
    drawInterrogator();

    requestAnimationFrame(render);
  }

  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(render);
  }

  function canvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return x >= 0 && x <= w && y >= 0 && y <= h ? { x, y } : null;
  }

  window.addEventListener('mousemove', e => {
    if (!running) return;
    const now = performance.now();
    if (now - lastMouseWave < 450) return;
    const p = canvasPoint(e);
    if (!p) return;
    lastMouseWave = now;
    spawnWave(p.x, p.y);
  });

  window.addEventListener('click', e => {
    const p = canvasPoint(e);
    if (!p) return;
    spawnWave(p.x, p.y);
    pulses.push(new LaserPulse());
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
    }).observe(canvas);
  }

  window.addEventListener('resize', resize);
  // Web fonts change the hero layout after first paint; re-anchor the fiber once they're in.
  window.addEventListener('load', resize);
  resize();
  start();
})();
