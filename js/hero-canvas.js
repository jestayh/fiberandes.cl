/* ============================================================
   FIBERANDES — Hero Photonics & Seismic Canvas Engine
   Interrogator fires laser pulses down the fiber. Each event source
   (earthquake, blast, traffic...) emits waves with its own signature;
   the first wave to reach the fiber is located by km and classified,
   and a simulated distance-time DAS record scrolls under the fiber.
   ============================================================ */
(function () {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  // Second canvas sits above .hero-veil so the interrogator, labels and record aren't dimmed.
  const uiCanvas = document.getElementById('hero-canvas-ui');
  const ui = uiCanvas ? uiCanvas.getContext('2d') : ctx;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FIBER_KM = 65;
  const CYAN = '#00F0FF';
  const EMERALD = '#00FFA3';
  const AMBER = '#FFB020';
  const MAX_EVENTS = 4;
  const MAX_SOURCES = 4;
  // The fiber crosses a mine, a pipeline and a road; each section only reports events plausible there.
  const ZONES = [
    { toKm: 15, name: 'MINA', classes: ['MICROSISMO', 'TRONADURA', 'DESPRENDIMIENTO DE ROCAS'] },
    { toKm: 45, name: 'DUCTO', classes: ['MAQUINARIA CERCA DEL DUCTO', 'POSIBLE FUGA EN DUCTO'] },
    { toKm: FIBER_KM, name: 'CAMINO', classes: ['TRÁNSITO'] }
  ];
  const CLASSIFY_DELAY = 30;
  const LABEL_LIFE = 200;
  const tr = s => (window.faI18n ? window.faI18n.t(s) : s);

  let w = 0, h = 0, t = 0, frame = 0;
  let fiberPoints = [];
  let pulses = [];
  let waves = [];
  let sources = [];
  let particles = [];
  let returns = [];
  let events = [];
  let ledFlash = 0;
  let ledColor = EMERALD;
  let running = false;
  let visible = true;
  let lastAutoSource = 0;
  let lastMouseSource = 0;
  let laneTop = 0;
  let strip = null;

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
    buildStrip();
  }

  // The fiber sits in the .hero-demo-stage lane, between its hint line and the record strip.
  function fiberLane() {
    const stage = document.querySelector('.hero-demo-stage');
    const stripH = w < 600 ? 44 : 60;
    if (!stage) return { center: h * 0.58, height: 200, top: 0, stripTop: h * 0.8, stripH };
    const r = stage.getBoundingClientRect();
    const hint = stage.querySelector('.hero-demo-hint');
    const canvasTop = canvas.getBoundingClientRect().top;
    const top = (hint ? hint.getBoundingClientRect().bottom : r.top) + 30;
    const stripTop = r.bottom - stripH - 4;
    // room under the fiber for the section labels
    const bottom = stripTop - 30;
    return {
      center: (top + bottom) / 2 - canvasTop,
      height: bottom - top,
      top: top - 30 - canvasTop,
      stripTop: stripTop - canvasTop,
      stripH
    };
  }

  function generateFiberRoute() {
    fiberPoints = [];
    const startX = INTERROGATOR_X;
    const n = Math.max(12, Math.floor((w - startX) / 80));
    const lane = fiberLane();
    laneTop = lane.top;
    // The raw profile spans roughly -80..+120 around its baseline.
    const amp = Math.max(0.3, Math.min(1, lane.height / 200));
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

  function zoneAt(progress) {
    const km = progress * FIBER_KM;
    return ZONES.find(z => km <= z.toKm) || ZONES[ZONES.length - 1];
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

  // One expanding wavefront. Strength drives both the ring and the record strip.
  class Wave {
    constructor(src, x, y, opt) {
      this.src = src;
      this.x = x;
      this.y = y;
      this.radius = 3;
      this.speed = opt.speed;
      this.maxRadius = opt.maxRadius;
      this.strength = opt.strength;
      this.rgb = opt.rgb || '0, 240, 255';
      this.lineWidth = opt.lineWidth || 1.5;
      this.hit = closestOnFiber(x, y);
      this.detected = this.hit.dist > this.maxRadius;
    }
    get fade() {
      return Math.max(0, 1 - this.radius / this.maxRadius);
    }
    update() {
      this.radius += this.speed;
      if (!this.detected && this.radius >= this.hit.dist) {
        this.detected = true;
        this.src.report(this.hit);
      }
      return this.radius < this.maxRadius;
    }
    draw() {
      ctx.save();
      // rings live in the ground above the record strip; deep sources only show once they rise into it
      if (strip) {
        ctx.beginPath();
        ctx.rect(0, 0, w, strip.y - 4);
        ctx.clip();
      }
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${this.rgb}, ${0.6 * this.fade * Math.min(1, this.strength + 0.3)})`;
      ctx.lineWidth = this.lineWidth;
      ctx.stroke();
      ctx.restore();
    }
  }

  // P wave first (fast, weaker), S wave behind it (slower, stronger), then the coda:
  // scattered energy trailing the S wave and decaying over time.
  function quake(s, reach, scale, codaLife) {
    if (s.age === 0) {
      s.wave({ speed: 2.6 * scale.speed, maxRadius: reach + 60, strength: 0.6 * scale.amp });
      s.wave({ speed: 1.35 * scale.speed, maxRadius: reach + 30, strength: 1.0 * scale.amp, rgb: '0, 255, 163', lineWidth: 2 });
    } else if (s.age >= 15 && s.age < codaLife) {
      const k = Math.exp(-(s.age - 15) / 22) * (0.6 + 0.4 * Math.random());
      s.wave({ speed: 1.35 * scale.speed, maxRadius: reach + 30, strength: 0.45 * k * scale.amp, rgb: '0, 255, 163', lineWidth: 1 });
    }
  }

  // Each event type has its own signature, so the class shown matches what the visitor sees.
  // place: 'deep' (far below the fiber), 'below' (in the ground under it), 'any' (either side), or a fixed `near` offset.
  const SIGNATURES = {
    // Natural earthquake: deep source, so the whole cable records a broad, nearly flat arrival.
    'SISMO': { life: 80, every: 5, place: 'deep', emit(s) {
      quake(s, s.reach, { speed: 2.2, amp: 1 }, 80);
    } },
    // Mining-induced microseism: shallow source near the excavations, tight arcs.
    'MICROSISMO': { life: 50, every: 5, place: 'below', emit(s) {
      quake(s, 150, { speed: 1, amp: 0.75 }, 50);
    } },
    'TRONADURA': { life: 1, place: 'any', emit(s) {
      s.wave({ speed: 2.2, maxRadius: 190, strength: 1.4, rgb: '255, 255, 255', lineWidth: 3 });
    } },
    'DESPRENDIMIENTO DE ROCAS': { life: 26, every: 9, place: 'any', emit(s) {
      s.wave({ speed: 1.6, maxRadius: 150, strength: 0.55 });
    } },
    'MAQUINARIA CERCA DEL DUCTO': { life: 100, every: 14, near: 45, emit(s) {
      s.wave({ speed: 1.5, maxRadius: 120, strength: 0.4 });
    } },
    'POSIBLE FUGA EN DUCTO': { life: 160, every: 6, near: 14, emit(s) {
      s.wave({ speed: 1.2, maxRadius: 60, strength: 0.28 });
    } },
    'TRÁNSITO': { life: 170, every: 10, near: 24, moving: true, emit(s) {
      s.wave({ speed: 1.5, maxRadius: 90, strength: 0.4 });
    } }
  };

  class Source {
    // auto: placed by the animation (random side and distance); otherwise it starts where the visitor pointed.
    constructor(x, y, auto) {
      const hit = closestOnFiber(x, y);
      const zone = zoneAt(hit.progress);
      // Natural earthquakes can be felt anywhere along the cable; the rest depend on the section.
      this.cls = Math.random() < 0.2 ? 'SISMO' : zone.classes[Math.floor(Math.random() * zone.classes.length)];
      this.sig = SIGNATURES[this.cls];
      const sig = this.sig;
      const groundTop = laneTop + 8;
      const groundBottom = strip ? strip.y - 10 : h;
      const offset = 20 + Math.random() * 110;
      let side = auto ? (Math.random() < 0.5 ? -1 : 1) : (y >= hit.y ? 1 : -1);
      if (sig.near) {
        x = hit.x;
        y = hit.y + side * sig.near;
      } else if (sig.place === 'deep') {
        x = hit.x + (Math.random() - 0.5) * 160;
        y = groundBottom + 140 + Math.random() * 160;
      } else {
        if (sig.place === 'below') side = 1;
        if (auto || sig.place === 'below') y = hit.y + side * (auto ? offset : Math.abs(y - hit.y));
      }
      if (sig.place !== 'deep') y = Math.min(Math.max(y, groundTop), groundBottom);
      this.x = x;
      this.y = y;
      this.reach = closestOnFiber(this.x, this.y).dist + 220;
      this.age = 0;
      this.reported = false;
    }
    wave(opt) {
      waves.push(new Wave(this, this.x, this.y, opt));
    }
    report(hit) {
      if (this.reported) return;
      this.reported = true;
      onFiberContact(hit, this.cls);
    }
    update() {
      const sig = this.sig;
      if (this.age === 0 || (sig.every && this.age % sig.every === 0 && this.age < sig.life)) sig.emit(this);
      if (sig.moving) this.x += 1.6;
      this.age++;
      return this.age < sig.life;
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

  // A wave reached the fiber: flash there, then send the signal back to the interrogator.
  function onFiberContact(hit, cls) {
    const ev = {
      x: hit.x,
      y: hit.y,
      km: hit.progress * FIBER_KM,
      cls,
      age: 0,
      labelAge: -1
    };
    events.push(ev);
    if (events.length > MAX_EVENTS) events.shift();
    returns.push({ progress: hit.progress, ev });
  }

  function spawnSource(x, y, auto = false) {
    if (sources.length >= MAX_SOURCES) return false;
    sources.push(new Source(x, y, auto));
    return true;
  }

  // ---------- Simulated distance-time record (waterfall) ----------
  // Columns follow the fiber's x, so a column sits right under its km; newest time is the top row.
  function buildStrip() {
    const lane = fiberLane();
    const x0 = INTERROGATOR_X;
    const cols = Math.max(40, Math.floor((w - x0) / 3));
    const rows = Math.max(16, Math.floor(lane.stripH / 2));
    const off = document.createElement('canvas');
    off.width = cols;
    off.height = rows;
    const octx = off.getContext('2d');
    octx.fillStyle = 'rgb(9, 14, 26)';
    octx.fillRect(0, 0, cols, rows);
    const pts = [];
    for (let c = 0; c < cols; c++) pts.push(pointAt(c / (cols - 1)));
    // Coupling: each stretch of fiber senses the ground differently (smooth bands),
    // plus a few channels that are always noisy or nearly dead, as in field records.
    const raw = Array.from({ length: cols }, () => Math.random());
    const gain = raw.map((_, c) => {
      let s = 0, n = 0;
      for (let k = -6; k <= 6; k++) { const j = c + k; if (j >= 0 && j < cols) { s += raw[j]; n++; } }
      return 0.45 + 1.1 * (s / n);
    });
    const noiseAmp = gain.map(() => 0.16);
    for (let c = 0; c < cols; c++) {
      const r = Math.random();
      if (r < 0.025) noiseAmp[c] = 0.55;
      else if (r < 0.035) gain[c] = 0.12;
    }
    strip = {
      x: x0, y: lane.stripTop, w: w - x0, h: lane.stripH, cols, rows, off, octx, pts,
      row: octx.createImageData(cols, 1), gain, noiseAmp, noise: new Float32Array(cols)
    };
  }

  function stripSample(p) {
    let v = 0;
    for (const wv of waves) {
      const d = Math.hypot(p.x - wv.x, p.y - wv.y) - wv.radius;
      if (d > 14 || d < -14) continue;
      v += wv.strength * wv.fade * Math.exp(-(d * d) / 18) * Math.cos(d * 0.7);
    }
    return v;
  }

  function updateStrip() {
    if (!strip) return;
    const { cols, rows, octx, off, pts, row, gain, noiseAmp, noise } = strip;
    octx.drawImage(off, 0, 0, cols, rows - 1, 0, 1, cols, rows - 1);
    const data = row.data;
    for (let c = 0; c < cols; c++) {
      // ambient noise correlated in time (short streaks) plus a slow, long-wavelength microseism band
      noise[c] = 0.8 * noise[c] + 0.2 * (Math.random() - 0.5) * 2 * noiseAmp[c];
      const micro = 0.07 * Math.sin((c / cols) * 9 - frame * 0.02);
      const v = (stripSample(pts[c]) * 2.4 + micro) * gain[c] + noise[c];
      const a = Math.min(1, Math.abs(v));
      // dark background blended toward cyan (compression) or amber (extension)
      const [r2, g2, b2] = v >= 0 ? [0, 240, 255] : [255, 176, 32];
      const i = c * 4;
      data[i] = 9 + (r2 - 9) * a;
      data[i + 1] = 14 + (g2 - 14) * a;
      data[i + 2] = 26 + (b2 - 26) * a;
      data[i + 3] = 255;
    }
    octx.putImageData(row, 0, 0);
  }

  function drawStrip() {
    if (!strip) return;
    ui.save();
    ui.globalAlpha = 0.95;
    ui.imageSmoothingEnabled = true;
    ui.drawImage(strip.off, strip.x, strip.y, strip.w, strip.h);
    ui.globalAlpha = 1;
    ui.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    ui.lineWidth = 1;
    ui.strokeRect(strip.x + 0.5, strip.y + 0.5, strip.w - 1, strip.h - 1);
    ui.font = '600 9px "IBM Plex Mono", monospace';
    ui.textBaseline = 'top';
    ui.fillStyle = 'rgba(0, 240, 255, 0.7)';
    ui.fillText(tr('REGISTRO DAS SIMULADO · DISTANCIA × TIEMPO'), strip.x + 6, strip.y + 4);
    ui.textAlign = 'right';
    ui.fillText(`KM ${FIBER_KM}`, strip.x + strip.w - 6, strip.y + 4);
    ui.restore();
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

    ui.font = '600 9px "IBM Plex Mono", monospace';
    ui.fillStyle = 'rgba(0, 240, 255, 0.75)';
    ui.fillText('KM 0', x, y - 6);

    // curved arrow + label pointing at the box, so it reads as the interrogator
    const label = tr('INTERROGADOR');
    // below the box on wide screens; above it on phones, where the section label sits underneath
    const below = w >= 600 && fiberLane().height > 110;
    const tipX = x + bw / 2 + 4;
    const tipY = below ? y + bh + 3 : y - 3;
    const endX = tipX + (below ? 42 : 34);
    const endY = tipY + (below ? 26 : -26);
    ui.strokeStyle = 'rgba(0, 240, 255, 0.55)';
    ui.lineWidth = 1.2;
    const dir = below ? 1 : -1;
    ui.beginPath();
    ui.moveTo(endX, endY);
    ui.quadraticCurveTo(endX - 24, endY, tipX + 3, tipY + 5 * dir);
    ui.stroke();
    ui.fillStyle = 'rgba(0, 240, 255, 0.55)';
    ui.beginPath();
    ui.moveTo(tipX, tipY);
    ui.lineTo(tipX + 8.5, tipY + 3.2 * dir);
    ui.lineTo(tipX + 4.2, tipY + 8.4 * dir);
    ui.closePath();
    ui.fill();
    ui.font = '600 9px "IBM Plex Mono", monospace';
    ui.fillStyle = 'rgba(0, 240, 255, 0.8)';
    ui.textBaseline = 'middle';
    ui.fillText(label, endX + 4, endY);
    ui.restore();
  }

  function drawZones() {
    if (fiberPoints.length < 2) return;
    ui.save();
    ui.font = '600 9px "IBM Plex Mono", monospace';
    ui.textAlign = 'center';
    ui.textBaseline = 'top';
    const compact = w < 600;
    let fromKm = 0;
    ZONES.forEach((z, i) => {
      const mid = pointAt((fromKm + z.toKm) / 2 / FIBER_KM);
      ui.fillStyle = 'rgba(0, 240, 255, 0.45)';
      ui.fillText(compact ? tr(z.name) : `KM ${fromKm}–${z.toKm} · ${tr(z.name)}`, mid.x, mid.y + 18);
      if (i < ZONES.length - 1) {
        const b = pointAt(z.toKm / FIBER_KM);
        ui.strokeStyle = 'rgba(0, 240, 255, 0.35)';
        ui.lineWidth = 1;
        ui.setLineDash([2, 3]);
        ui.beginPath();
        ui.moveTo(b.x, b.y + 6);
        ui.lineTo(b.x, b.y + 26);
        ui.stroke();
        ui.setLineDash([]);
      }
      fromKm = z.toKm;
    });
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
    // Only the newest reported event carries a label, so labels never stack.
    const labeled = events.filter(e => e.labelAge >= 0);
    const newest = labeled.length ? labeled.reduce((a, b) => (b.labelAge < a.labelAge ? b : a)) : null;
    events = events.filter(ev => {
      ev.age++;
      if (ev.labelAge >= 0) ev.labelAge++;
      if (ev.labelAge > LABEL_LIFE) return false;

      ui.save();
      if (ev.age < 50) {
        const k = ev.age / 50;
        ui.strokeStyle = `rgba(255, 176, 32, ${0.9 * (1 - k)})`;
        ui.lineWidth = 2;
        ui.beginPath();
        ui.arc(ev.x, ev.y, 4 + k * 22, 0, Math.PI * 2);
        ui.stroke();
      }
      const dotAlpha = ev.labelAge < 0 ? 1 : Math.max(0, 1 - ev.labelAge / LABEL_LIFE);
      ui.globalAlpha = dotAlpha;
      ui.fillStyle = AMBER;
      ui.shadowColor = AMBER;
      ui.shadowBlur = 10;
      ui.beginPath();
      ui.arc(ev.x, ev.y, 3.5, 0, Math.PI * 2);
      ui.fill();
      ui.shadowBlur = 0;

      if (ev === newest) {
        const fadeIn = Math.min(1, ev.labelAge / 12);
        const fadeOut = Math.max(0, 1 - Math.max(0, ev.labelAge - (LABEL_LIFE - 50)) / 50);
        ui.globalAlpha = fadeIn * fadeOut;
        const text = `${tr('EVENTO DETECTADO')} · KM ${ev.km.toFixed(1)}`;
        // Second line is the analysis layer: "analyzing" first, then what the event was.
        const classified = ev.labelAge >= CLASSIFY_DELAY;
        const ctext = `${tr('IA')} → ${classified ? tr(ev.cls) : tr('ANALIZANDO…')}`;
        const finalC = `${tr('IA')} → ${tr(ev.cls)}`;
        ui.font = '700 11px "IBM Plex Mono", monospace';
        const bw = Math.max(ui.measureText(text).width, ui.measureText(finalC).width) + 16;
        const lx = Math.min(Math.max(ev.x - bw / 2, INTERROGATOR_X + 8), w - bw - 8);
        // Above the event, unless that would cover the hint text above the lane.
        const above = ev.y - 58 >= laneTop;
        const ly = above ? ev.y - 58 : ev.y + 18;
        ui.strokeStyle = 'rgba(255, 176, 32, 0.6)';
        ui.lineWidth = 1;
        ui.beginPath();
        ui.moveTo(ev.x, above ? ev.y - 6 : ev.y + 6);
        ui.lineTo(ev.x, above ? ly + 40 : ly);
        ui.stroke();
        ui.fillStyle = 'rgba(9, 14, 26, 0.92)';
        ui.fillRect(lx, ly, bw, 40);
        ui.strokeRect(lx, ly, bw, 40);
        ui.fillStyle = AMBER;
        ui.fillText(text, lx + 8, ly + 16);
        ui.fillStyle = classified ? CYAN : 'rgba(0, 240, 255, 0.5)';
        ui.fillText(ctext, lx + 8, ly + 33);
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
    frame++;
    ledFlash = Math.max(0, ledFlash - 0.04);
    ctx.clearRect(0, 0, w, h);
    ui.clearRect(0, 0, w, h);

    if (!reduceMotion) {
      if (t - lastAutoSource > 3.2) {
        lastAutoSource = t;
        const pt = fiberPoints[1 + Math.floor(Math.random() * (fiberPoints.length - 1))];
        if (pt) spawnSource(pt.x + (Math.random() - 0.5) * 120, pt.y, true);
      }
      if (Math.random() < 0.04 && pulses.length < 9) pulses.push(new LaserPulse());
    }

    sources = sources.filter(s => s.update());
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
    if (!reduceMotion && frame % 2 === 0) updateStrip();
    drawStrip();
    drawZones();
    drawReturns();
    drawInterrogator();
    drawEvents();

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
    // the record strip is not part of the ground: no events from it
    if (strip && y >= strip.y) return null;
    return x >= 0 && x <= w && y >= 0 && y <= h ? { x, y } : null;
  }

  window.addEventListener('mousemove', e => {
    if (!running) return;
    const now = performance.now();
    if (now - lastMouseSource < 600) return;
    const p = canvasPoint(e);
    if (!p) return;
    if (spawnSource(p.x, p.y)) lastMouseSource = now;
  });

  window.addEventListener('click', e => {
    const p = canvasPoint(e);
    if (!p) return;
    spawnSource(p.x, p.y);
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
  // Switching language changes the hero text length, which moves the fiber lane.
  document.addEventListener('fa:langchange', resize);
  resize();
  start();
})();
