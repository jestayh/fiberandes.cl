/* ============================================================
   FIBERANDES — Application Controller & Interaction Logic
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Sticky Navigation on Scroll
  const nav = document.querySelector('.nav');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  });

  // 2. Mobile Menu Toggle
  const navToggle = document.querySelector('.nav-toggle');
  const mobileNav = document.querySelector('.mobile-nav');
  if (navToggle && mobileNav) {
    navToggle.addEventListener('click', () => {
      mobileNav.classList.toggle('open');
      const isOpen = mobileNav.classList.contains('open');
      navToggle.setAttribute('aria-expanded', isOpen);
    });

    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('open');
      });
    });
  }

  // 3. Technical Drawer Modal
  const drawerBackdrop = document.getElementById('tech-drawer');
  const drawerTag = document.getElementById('drawer-tag');
  const drawerTitle = document.getElementById('drawer-title');
  const drawerLead = document.getElementById('drawer-lead');
  const drawerSpecsTable = document.getElementById('drawer-specs-body');
  const drawerBodyContent = document.getElementById('drawer-body-content');
  const drawerCloseBtn = document.querySelector('.drawer-close-btn');

  function openDrawer(key) {
    const data = drawerData[key];
    if (!data || !drawerBackdrop) return;

    if (drawerTag) drawerTag.textContent = data.tag;
    if (drawerTitle) drawerTitle.textContent = data.title;
    if (drawerLead) drawerLead.textContent = data.lead;

    if (drawerSpecsTable) {
      drawerSpecsTable.innerHTML = data.specs.map(s => `
        <tr>
          <th>${s.k}</th>
          <td><strong>${s.v}</strong></td>
        </tr>
      `).join('');
    }

    if (drawerBodyContent) {
      drawerBodyContent.innerHTML = data.body;
    }

    drawerBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    if (drawerBackdrop) {
      drawerBackdrop.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  document.querySelectorAll('[data-open-drawer]').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      const key = trigger.getAttribute('data-open-drawer');
      openDrawer(key);
    });
  });

  if (drawerCloseBtn) {
    drawerCloseBtn.addEventListener('click', closeDrawer);
  }

  if (drawerBackdrop) {
    drawerBackdrop.addEventListener('click', (e) => {
      if (e.target === drawerBackdrop) closeDrawer();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDrawer();
      if (mobileNav) mobileNav.classList.remove('open');
    }
  });

  // 4. Scroll Reveal with IntersectionObserver
  const revealElements = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    revealElements.forEach(el => observer.observe(el));
  } else {
    revealElements.forEach(el => el.classList.add('in'));
  }

  // 5. Contact Form Submission
  const contactForm = document.getElementById('contact-form');
  const feedback = document.getElementById('contact-feedback');

  function showFeedback(ok, text) {
    if (!feedback) return;
    feedback.className = `form-feedback ${ok ? 'ok' : 'err'}`;
    feedback.replaceChildren(document.createTextNode(text));
    if (!ok) {
      const mail = document.createElement('a');
      mail.href = 'mailto:contacto@fiberandes.cl';
      mail.textContent = 'contacto@fiberandes.cl';
      const wa = document.createElement('a');
      wa.href = 'https://wa.me/56994290168';
      wa.target = '_blank';
      wa.rel = 'noopener';
      wa.textContent = 'WhatsApp +56 9 9429 0168';
      feedback.append(' Escríbenos directamente a ', mail, ' o por ', wa, '.');
    }
    feedback.style.display = 'block';
  }

  if (contactForm) {
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const submitLabel = submitBtn ? submitBtn.innerHTML : '';

    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (feedback) feedback.style.display = 'none';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';
      }

      try {
        const res = await fetch(contactForm.action, {
          method: 'POST',
          body: new FormData(contactForm),
          headers: { 'Accept': 'application/json' }
        });
        const data = await res.json().catch(() => ({}));
        // FormSubmit answers HTTP 200 with success:"false" for errors such as an unactivated inbox.
        if (!res.ok || String(data.success) !== 'true') {
          throw new Error(data.message || `HTTP ${res.status}`);
        }
        contactForm.reset();
        showFeedback(true, '¡Recibimos tu postulación! Nuestro equipo te contactará pronto.');
      } catch (err) {
        console.error('Contact form submission failed:', err);
        showFeedback(false, 'No pudimos enviar tu mensaje.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = submitLabel;
        }
      }
    });
  }

  // 6. Continuous Optical Backbone & Scroll Telemetry
  const backbone = document.getElementById('optical-backbone');
  const backbonePulse = document.getElementById('backbone-laser-pulse');
  const backboneNodes = document.querySelectorAll('.backbone-node');
  const mobileOtdrSec = document.getElementById('mobile-otdr-section');
  const mobileOtdrKm = document.getElementById('mobile-otdr-km');
  const mobileProgLine = document.getElementById('mobile-telemetry-line');

  const backboneLit = document.getElementById('backbone-fiber-lit');

  const telemetryBar = document.getElementById('optical-telemetry-bar');

  const trackedSections = [
    { id: 'evidencia', km: 1.5, label: '01 · CORDÓN CAULLE' },
    { id: 'pilotos', km: 15, label: '02 · PILOTOS & MINERÍA' },
    { id: 'alianzas', km: 40, label: '03 · REDES & ALIANZAS' },
    { id: 'roadmap', km: 55, label: '04 · DESPLIEGUE ROADMAP' },
    { id: 'contacto', km: 60, label: '05 · CO-DISEÑO PILOTO' }
  ];
  const sectionEls = trackedSections.map(s => document.getElementById(s.id));
  const lastIdx = trackedSections.length - 1;

  // Which station we are at and how far (0..1) we've travelled toward the next one.
  function fiberPosition() {
    const anchor = window.innerHeight * 0.45;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (maxScroll - window.scrollY < 2) return { idx: lastIdx, frac: 0 };

    let idx = 0;
    sectionEls.forEach((el, i) => {
      if (el && el.getBoundingClientRect().top <= anchor) idx = i;
    });

    let frac = 0;
    const cur = sectionEls[idx];
    const next = sectionEls[idx + 1];
    if (cur && next) {
      const a = cur.getBoundingClientRect().top;
      const b = next.getBoundingClientRect().top;
      frac = Math.max(0, Math.min(1, (anchor - a) / (b - a)));
    }
    return { idx, frac };
  }

  function nodeCenter(i) {
    const node = backboneNodes[i];
    return node ? node.offsetTop + node.offsetHeight / 2 : 0;
  }

  function updateOpticalBackbone() {
    // Indicators stay hidden over the hero and appear once section 01 is reached.
    const first = sectionEls[0];
    const started = !!first && first.getBoundingClientRect().top <= window.innerHeight * 0.45;
    if (backbone) backbone.classList.toggle('hidden', !started);
    if (telemetryBar) telemetryBar.classList.toggle('hidden', !started);

    const { idx, frac } = fiberPosition();

    if (backbone && backbone.getClientRects().length && backboneNodes.length) {
      const from = nodeCenter(idx);
      const to = idx < lastIdx ? nodeCenter(idx + 1) : from;
      const y = from + (to - from) * frac;
      if (backbonePulse) backbonePulse.style.top = `${y}px`;
      if (backboneLit) backboneLit.style.height = `${y}px`;
    }

    backboneNodes.forEach((node, i) => {
      node.classList.toggle('active', i === idx);
      node.classList.toggle('passed', i < idx);
    });

    const cur = trackedSections[idx];
    const next = trackedSections[Math.min(idx + 1, lastIdx)];
    const km = cur.km + (next.km - cur.km) * frac;

    if (mobileProgLine) mobileProgLine.style.width = `${((idx + frac) / lastIdx) * 100}%`;
    if (mobileOtdrSec) mobileOtdrSec.textContent = cur.label;
    if (mobileOtdrKm) mobileOtdrKm.textContent = `KM ${km.toFixed(1)} / 60 KM`;
  }

  window.addEventListener('scroll', updateOpticalBackbone, { passive: true });
  window.addEventListener('resize', updateOpticalBackbone);
  updateOpticalBackbone();

  // 7. Field Evidence Lightbox Modal
  const lightbox = document.getElementById('field-lightbox');
  const lightboxImg = document.getElementById('lightbox-modal-img');
  const lightboxTitle = document.getElementById('lightbox-modal-title');
  const lightboxDesc = document.getElementById('lightbox-modal-desc');
  const lightboxTags = document.getElementById('lightbox-modal-tags');
  const lightboxClose = document.getElementById('lightbox-close-btn');

  function openLightbox(card) {
    if (!lightbox) return;
    const imgUrl = card.getAttribute('data-img');
    const title = card.getAttribute('data-title');
    const desc = card.getAttribute('data-desc');
    const tags = (card.getAttribute('data-tags') || '').split(',');

    if (lightboxImg) lightboxImg.src = imgUrl;
    if (lightboxTitle) lightboxTitle.textContent = title;
    if (lightboxDesc) lightboxDesc.textContent = desc;
    if (lightboxTags) {
      lightboxTags.innerHTML = tags.map(t => `<span>${t.trim()}</span>`).join('');
    }

    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.field-photo-card').forEach(card => {
    card.addEventListener('click', () => openLightbox(card));
  });

  // Photo fan: stacked like a hand of cards, deals out into a 3-column grid on click.
  document.querySelectorAll('.photo-fan').forEach(fan => {
    const cards = [...fan.querySelectorAll('.field-photo-card')];
    const toggleBtn = document.querySelector(`.fan-toggle[aria-controls="${fan.id}"]`);
    const n = cards.length;

    function layout() {
      const W = fan.clientWidth;
      const expanded = fan.classList.contains('expanded');
      if (expanded) {
        const cols = 3, gap = 8;
        const cw = (W - gap * (cols - 1)) / cols;
        const ch = cw * 0.75;
        cards.forEach((c, i) => {
          Object.assign(c.style, {
            width: `${cw}px`, height: `${ch}px`,
            left: `${(i % cols) * (cw + gap)}px`, top: `${Math.floor(i / cols) * (ch + gap)}px`,
            transform: 'none', zIndex: 1
          });
        });
        fan.style.height = `${Math.ceil(n / cols) * (ch + gap) - gap}px`;
      } else {
        const cw = Math.min(W * 0.5, 230);
        const ch = cw * 0.75;
        const spread = (W - cw) * 0.32;
        cards.forEach((c, i) => {
          // First photo sits centered on top; the rest fan out symmetrically behind it.
          const t = i === 0 || n < 3 ? 0 : ((i - 1) / (n - 2)) * 2 - 1;
          Object.assign(c.style, {
            width: `${cw}px`, height: `${ch}px`,
            left: `${(W - cw) / 2 + t * spread}px`, top: `${14 + Math.abs(t) * 12}px`,
            transform: `rotate(${t * 12}deg)`, zIndex: i === 0 ? n + 1 : n - i
          });
        });
        fan.style.height = `${ch + 50}px`;
      }
    }

    function setExpanded(expanded) {
      fan.classList.toggle('expanded', expanded);
      fan.setAttribute('role', expanded ? 'group' : 'button');
      fan.tabIndex = expanded ? -1 : 0;
      if (toggleBtn) {
        toggleBtn.textContent = expanded ? 'Agrupar fotos' : 'Click para desplegar';
        toggleBtn.setAttribute('aria-expanded', String(expanded));
      }
      layout();
    }

    // Capture phase: while stacked, a click deals the fan out instead of opening the lightbox.
    fan.addEventListener('click', e => {
      if (fan.classList.contains('expanded')) return;
      e.stopPropagation();
      setExpanded(true);
    }, true);
    fan.addEventListener('keydown', e => {
      if (!fan.classList.contains('expanded') && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        setExpanded(true);
      }
    });
    if (toggleBtn) toggleBtn.addEventListener('click', () => setExpanded(!fan.classList.contains('expanded')));
    window.addEventListener('resize', layout);
    setExpanded(false);
  });

  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });

  // 8. "Cuéntanos tu caso": builds an honest preliminary summary, not a feasibility verdict.
  const SECTORS = {
    mineria: { label: 'Minería', select: 'Minería' },
    energia: { label: 'Energía', select: 'Energía' },
    agua: { label: 'Agua', select: 'Agua' },
    transporte: { label: 'Transporte', select: 'Transporte' },
    geo: { label: 'Peligros geológicos', select: 'Peligros geológicos' }
  };
  const FIBERS = {
    instalada: 'Fibra óptica instalada',
    comunicaciones: 'Cable de comunicaciones con fibra',
    ninguna: 'No hay fibra',
    nose: 'No lo sé'
  };
  const EXTENTS = { e1: '< 5 km', e2: '5–65 km', e3: '65–130 km', e4: '> 130 km' };

  const caseState = { sector: 'mineria', fiber: 'instalada', extent: 'e1' };
  const resultText = document.getElementById('feasibility-text');
  const applyBtn = document.getElementById('btn-apply-feasibility');
  const selectApp = document.getElementById('contact-interest');
  const messageArea = document.getElementById('contact-message');

  function fiberSentence(fiber) {
    if (fiber === 'instalada' || fiber === 'comunicaciones') {
      return 'Con fibra existente, un piloto puede partir sin obras: basta acceder a un hilo libre en un extremo para conectar el interrogador.';
    }
    if (fiber === 'ninguna') {
      return 'Requiere instalar fibra; diseñamos el trazado según la geología del sitio.';
    }
    return 'Revisamos contigo la fibra disponible en la primera reunión.';
  }

  function updateCaseSummary() {
    if (!resultText) return;
    const parts = [fiberSentence(caseState.fiber)];
    if (caseState.extent === 'e4') {
      parts.push('Se necesitaría más de un interrogador o un despliegue por etapas.');
    }
    resultText.replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent = `${SECTORS[caseState.sector].label} · ${EXTENTS[caseState.extent]}: `;
    resultText.append(strong, parts.join(' '));
  }

  [['chip-group-asset', 'sector'], ['chip-group-fiber', 'fiber'], ['chip-group-distance', 'extent']].forEach(([groupId, key]) => {
    const chips = document.querySelectorAll(`#${groupId} .feasibility-chip`);
    chips.forEach(chip => {
      chip.setAttribute('aria-pressed', String(chip.classList.contains('active')));
      chip.addEventListener('click', () => {
        chips.forEach(c => {
          c.classList.toggle('active', c === chip);
          c.setAttribute('aria-pressed', String(c === chip));
        });
        caseState[key] = chip.dataset.val;
        updateCaseSummary();
      });
    });
  });
  updateCaseSummary();

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      if (selectApp) selectApp.value = SECTORS[caseState.sector].select;
      if (messageArea) {
        messageArea.value = `Hola equipo FiberAndes, nos interesa evaluar un piloto de detección acústica distribuida (DAS):\n- Sector: ${SECTORS[caseState.sector].label}\n- Fibra: ${FIBERS[caseState.fiber]}\n- Extensión: ${EXTENTS[caseState.extent]}\n\nNos gustaría coordinar una reunión técnica preliminar para revisar condiciones operacionales.`;
        messageArea.focus();
        messageArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }
});
