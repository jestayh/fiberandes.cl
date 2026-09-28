/* ============================================================
   FIBERANDES — Bilingual i18n Dictionary (ES / EN)
   Seamless in-memory translation for Chilean & Global Enterprise Clients
   ============================================================ */
const i18nData = {
  es: {
    // Nav
    'nav.why': '¿Por Qué DFOS?',
    'nav.tech': 'Tecnologías',
    'nav.apps': 'Aplicaciones',
    'nav.hardware': 'Hardware',
    'nav.platform': 'Plataforma Hub',
    'nav.configurator': 'Cotizador',
    'nav.contact': 'Contacto',
    'nav.cta': 'Cotizar Proyecto',
    'nav.status': 'RED ACTIVA · TIEMPO REAL',

    // Hero
    'hero.badge': 'Pioneros en Chile · Sensoramiento Distribuido a Escala Industrial',
    'hero.h1.1': 'Toda la fibra es el sensor.',
    'hero.h1.2': 'Monitoreo continuo en tiempo real y sin puntos ciegos.',
    'hero.sub': 'La primera red de Distributed Fiber Optic Sensing (DFOS) en Chile para minería e infraestructura crítica. Medición simultánea de vibración acústica (DAS), deformación milimétrica (DSS) y gradiente de temperatura (DTS) a lo largo de hasta 50 km.',
    'hero.cta.primary': 'Solicitar Evaluación Técnica',
    'hero.cta.secondary': 'Ver Comparativa vs ESI',
    'hero.t1.l': 'COBERTURA ESPACIAL',
    'hero.t1.d': 'Monitoreo sin interrupciones',
    'hero.t2.l': 'RESOLUCIÓN MÉTRICA',
    'hero.t2.d': 'Puntos virtuales cada metro',
    'hero.t3.l': 'ALCANCE ÓPTICO',
    'hero.t3.d': 'Hasta 50 km por canal',
    'hero.t4.l': 'PUNTOS CIEGOS',
    'hero.t4.d': 'Detección total de eventos',

    // Section 1: Comparison DFOS vs ESI
    'comp.eyebrow': '01 · Cambio de Paradigma',
    'comp.title': 'DFOS vs. Sensores Discretos (ESI): Fin a los puntos ciegos',
    'comp.lead': 'Las redes tradicionales tipo ESI instalan sensores cada 50, 100 o 200 metros. Si una microfractura o filtración ocurre en el espacio intermedio, el sistema no la ve hasta que es demasiado tarde. Con FiberAndes, cada metro de fibra es un sensor activo.',
    'comp.sim.title': 'SIMULADOR EN VIVO · PRUEBA EL IMPACTO DE UN EVENTO',
    'comp.sim.hint': 'Arrastra o haz clic sobre la línea para mover el evento (microfractura/fuga) y comparar la detección.',

    // Section 2: Technologies
    'tech.eyebrow': '02 · Tecnologías DFOS',
    'tech.title': 'Tres pilares físicos sobre la misma fibra óptica',
    'tech.lead': 'Interrogamos el cable mediante pulsos láser coherentes para medir tres fenómenos de retrodispersión óptica independientes:',

    // Section 3: Applications
    'app.eyebrow': '03 · Aplicaciones Industriales',
    'app.title': 'Diseñado para la geología extrema de los Andes',
    'app.lead': 'Desde las profundidades de la minería subterránea chilena hasta tranques de relave y obras civiles de gran envergadura.',

    // Section 4: Hardware
    'hw.eyebrow': '04 · Instrumentación Optoelectrónica',
    'hw.title': 'Unidad Interrogadora FiberAndes Core',
    'hw.lead': 'Potencia láser clase 1 segura, procesamiento FPGA a bordo y cero electrónica en zonas de riesgo.',

    // Section 5: Platform
    'hub.eyebrow': '05 · Software & Analítica',
    'hub.title': 'FiberAndes Hub: De la luz al insight operacional',
    'hub.lead': 'Visualización en cascada (Waterfall plots) 2D/3D en tiempo real, correlación geotécnica y alarmas instantáneas.',

    // Section 6: Configurator
    'cfg.eyebrow': '06 · Asesor Interactivo',
    'cfg.title': 'Configura la arquitectura para tu proyecto',
    'cfg.lead': 'Selecciona tu tipo de activo y objetivo para obtener una recomendación preliminar de instrumentación DFOS.',

    // Section 7: Contact
    'ct.eyebrow': '07 · Hablemos de Ingeniería',
    'ct.title': 'Convierte tu infraestructura en una red inteligente.',
    'ct.lead': 'Nuestro equipo de ingenieros ópticos y geofísicos está listo para desplegar pilotos en faena y proyectos industriales en todo Chile.',
    'ct.btn': 'Enviar Consulta Técnica',
    'ct.whatsapp': 'Escríbenos por WhatsApp',
    'ct.success': '¡Gracias! Hemos recibido tu solicitud. Un ingeniero se contactará contigo en menos de 24 horas.'
  },
  en: {
    // Nav
    'nav.why': 'Why DFOS?',
    'nav.tech': 'Technologies',
    'nav.apps': 'Applications',
    'nav.hardware': 'Hardware',
    'nav.platform': 'Hub Platform',
    'nav.configurator': 'Configurator',
    'nav.contact': 'Contact',
    'nav.cta': 'Request Proposal',
    'nav.status': 'NETWORK ACTIVE · REAL-TIME',

    // Hero
    'hero.badge': 'First in Chile · Industrial-Scale Distributed Sensing',
    'hero.h1.1': 'The entire fiber is the sensor.',
    'hero.h1.2': 'Continuous real-time monitoring with zero blind spots.',
    'hero.sub': 'Chile\'s first Distributed Fiber Optic Sensing (DFOS) platform for mining and critical civil infrastructure. Simultaneous measurement of acoustic vibrations (DAS), millimetric strain (DSS), and temperature gradients (DTS) over up to 50 km.',
    'hero.cta.primary': 'Request Technical Assessment',
    'hero.cta.secondary': 'Compare vs Discrete ESI',
    'hero.t1.l': 'SPATIAL COVERAGE',
    'hero.t1.d': 'Uninterrupted monitoring',
    'hero.t2.l': 'METRIC RESOLUTION',
    'hero.t2.d': 'Virtual sensors every meter',
    'hero.t3.l': 'OPTICAL REACH',
    'hero.t3.d': 'Up to 50 km per channel',
    'hero.t4.l': 'BLIND SPOTS',
    'hero.t4.d': 'Complete event capture',

    // Section 1: Comparison DFOS vs ESI
    'comp.eyebrow': '01 · Paradigm Shift',
    'comp.title': 'DFOS vs. Discrete Sensors (ESI): Eliminating Blind Spots',
    'comp.lead': 'Traditional discrete networks install sensors every 50 to 200 meters. If a microcrack or leak forms between two units, the system remains completely blind until catastrophic failure. With FiberAndes, every single meter of glass fiber is an active sensor.',
    'comp.sim.title': 'LIVE SIMULATOR · TEST AN EVENT IMPACT',
    'comp.sim.hint': 'Drag or click anywhere along the line to move the simulated rock fracture/leak and compare detection.',

    // Section 2: Technologies
    'tech.eyebrow': '02 · DFOS Technologies',
    'tech.title': 'Three physical pillars over a single optical fiber',
    'tech.lead': 'We interrogate the cable using ultra-coherent laser pulses to measure three distinct optical backscattering mechanisms:',

    // Section 3: Applications
    'app.eyebrow': '03 · Industrial Applications',
    'app.title': 'Engineered for the extreme geology of the Chilean Andes',
    'app.lead': 'From deep underground block-caving mines to massive tailings dams and heavy civil infrastructure.',

    // Section 4: Hardware
    'hw.eyebrow': '04 · Optoelectronic Instrumentation',
    'hw.title': 'FiberAndes Core Interrogator Unit',
    'hw.lead': 'Class 1 eye-safe laser, onboard FPGA signal processing, and zero electronics in hazardous areas.',

    // Section 5: Platform
    'hub.eyebrow': '05 · Software & Analytics',
    'hub.title': 'FiberAndes Hub: From photonics to operational insight',
    'hub.lead': 'Real-time 2D/3D waterfall spectrograms, geotechnical correlation, and automated alert dispatch.',

    // Section 6: Configurator
    'cfg.eyebrow': '06 · Interactive Advisor',
    'cfg.title': 'Configure your project architecture',
    'cfg.lead': 'Select your asset type and priority objective to generate an instant preliminary DFOS architecture.',

    // Section 7: Contact
    'ct.eyebrow': '07 · Engineering Consultation',
    'ct.title': 'Turn your critical infrastructure into a smart nervous system.',
    'ct.lead': 'Our team of photonics and geotechnical engineers is ready to deploy pilot systems and industrial-scale projects across Chile.',
    'ct.btn': 'Send Technical Inquiry',
    'ct.whatsapp': 'Chat via WhatsApp',
    'ct.success': 'Thank you! We received your request. An engineer will follow up within 24 business hours.'
  }
};

let currentLang = localStorage.getItem('fiberandes_lang') || 'es';

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('fiberandes_lang', lang);

  // Update active button state
  document.querySelectorAll('.lang-toggle button').forEach(btn => {
    if (btn.getAttribute('data-lang') === lang) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update DOM elements with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (i18nData[lang] && i18nData[lang][key]) {
      el.textContent = i18nData[lang][key];
    }
  });

  document.documentElement.lang = lang;
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.lang-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      setLanguage(btn.getAttribute('data-lang'));
    });
  });
  setLanguage(currentLang);
});
