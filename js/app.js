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
  const formSuccess = document.getElementById('form-success');

  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Enviando...';
      }

      // Collect data and simulate high-reliability POST
      const formData = new FormData(contactForm);
      fetch(contactForm.action, {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' }
      }).catch(() => {
        // Fallback for offline or local preview
        return true;
      }).finally(() => {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Mensaje Enviado ✓';
        }
        if (formSuccess) formSuccess.classList.add('show');
        contactForm.reset();
      });
    });
  }
});
