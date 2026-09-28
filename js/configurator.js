/* ============================================================
   FIBERANDES — Interactive Project Configurator / Advisor
   Calculates optimal DFOS sensor architecture based on project parameters
   ============================================================ */
(function() {
  const assetButtons = document.querySelectorAll('[data-cfg-asset]');
  const priorityButtons = document.querySelectorAll('[data-cfg-priority]');
  const lengthSlider = document.getElementById('cfg-length-slider');
  const lengthValDisplay = document.getElementById('cfg-length-val');

  if (!lengthSlider) return;

  let selectedAsset = 'tailings';
  let selectedPriority = 'all';
  let lengthKm = 5;

  const assetData = {
    rockmass: {
      name: 'Macizo Rocoso & Minería Subterránea',
      defaultTech: ['das', 'dss'],
      cable: 'Cable de fibra monomodo blindado con armadura de acero corrugado (resistencia a tracción >5 kN e impactos de roca)',
      summary: 'Monitoreo continuo de desprendimientos, caving y convergencia de galerías. Detección inmediata de microfracturación inducida antes de estallidos de roca.'
    },
    tailings: {
      name: 'Tranque y Presa de Relaves',
      defaultTech: ['dts', 'dss', 'das'],
      cable: 'Cable híbrido sensor de deformación y temperatura (DSS + DTS) resistente a lixiviación, enterrado a lo largo del talud y coronamiento',
      summary: 'Detección temprana milimétrica de infiltraciones y líneas de flujo saturado (DTS) combinada con asentamiento diferencial y tensión del dique (DSS).'
    },
    openpit: {
      name: 'Rajo Abierto & Taludes',
      defaultTech: ['dss', 'das'],
      cable: 'Cable superficial reforzado con chaqueta anti-UV y anclaje continuo para captura de cizallamiento en grietas de tensión',
      summary: 'Perfil continuo de deformación de bancos y bermas con resolución métrica. Supera radares terrestres al medir subsuperficie continua sin bloqueo por niebla o polvo.'
    },
    civil: {
      name: 'Presas de Embalse, Puentes & Estructuras',
      defaultTech: ['dss', 'das'],
      cable: 'Fibra de alta adherencia para acoplamiento elástico directo a hormigón y vigas de acero',
      summary: 'Salud estructural continua (SHM). Monitoreo dinámico de frecuencias propias de vibración, flechas elásticas y detección de grietas estructurales.'
    },
    pipeline: {
      name: 'Ductos, Mineroductos & Acueductos',
      defaultTech: ['dts', 'das'],
      cable: 'Cable dieléctrico adosado a la generatriz del ducto con detección de impacto y gradiente térmico de fluidos',
      summary: 'Localización métrica instantánea de fugas de concentrado o relave por gradiente térmico diferencial, más detección perimetral de interferencia de terceros.'
    }
  };

  function updateRecommendation() {
    const asset = assetData[selectedAsset] || assetData.tailings;
    lengthKm = parseFloat(lengthSlider.value);
    if (lengthValDisplay) {
      lengthValDisplay.textContent = `${lengthKm} km`;
    }

    // Determine technologies
    let techList = [];
    if (selectedPriority === 'all') {
      techList = asset.defaultTech;
    } else if (selectedPriority === 'vibrations') {
      techList = ['das'];
    } else if (selectedPriority === 'strain') {
      techList = ['dss'];
    } else if (selectedPriority === 'seepage') {
      techList = ['dts'];
    }

    // Number of virtual continuous points (1 meter resolution)
    const virtualSensors = (lengthKm * 1000).toLocaleString('es-CL');

    // Update UI elements
    const sysEl = document.getElementById('cfg-res-system');
    if (sysEl) sysEl.textContent = `FiberAndes Core · ${techList.map(t => t.toUpperCase()).join(' + ')}`;

    const tagsEl = document.getElementById('cfg-res-tags');
    if (tagsEl) {
      tagsEl.innerHTML = techList.map(t => `<span class="cfg-res-tag ${t}">${t.toUpperCase()}</span>`).join('');
    }

    const summaryEl = document.getElementById('cfg-res-summary');
    if (summaryEl) {
      summaryEl.innerHTML = `
        <p><strong>Activo:</strong> ${asset.name} (${lengthKm} km de trazado).</p>
        <p style="margin-top:8px;"><strong>Sensores Virtuales:</strong> ${virtualSensors} puntos de medición continuos en tiempo real (1 cada metro).</p>
        <p style="margin-top:8px;"><strong>Cable Recomendado:</strong> ${asset.cable}.</p>
        <p style="margin-top:8px; color:var(--cyan);">${asset.summary}</p>
      `;
    }

    // Update CTA link to auto-populate contact message
    const ctaBtn = document.getElementById('cfg-cta-btn');
    if (ctaBtn) {
      ctaBtn.onclick = function() {
        const msgField = document.querySelector('textarea[name="message"]');
        const roleField = document.querySelector('input[name="role"]');
        if (msgField) {
          msgField.value = `Hola equipo FiberAndes, me interesa evaluar una solución de sensoramiento DFOS para ${asset.name}, con una longitud aproximada de ${lengthKm} km y tecnologías prioritarias ${techList.map(t => t.toUpperCase()).join(', ')}.`;
          msgField.scrollIntoView({ behavior: 'smooth' });
          msgField.focus();
        }
      };
    }
  }

  // Event listeners
  assetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      assetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedAsset = btn.getAttribute('data-cfg-asset');
      updateRecommendation();
    });
  });

  priorityButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      priorityButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedPriority = btn.getAttribute('data-cfg-priority');
      updateRecommendation();
    });
  });

  lengthSlider.addEventListener('input', updateRecommendation);

  updateRecommendation();
})();
