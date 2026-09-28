/* ============================================================
   FIBERANDES — Technical Drawer Datasheets & Physics Engine Data
   ============================================================ */
const drawerData = {
  das: {
    tag: 'TECNOLOGÍA DAS · DISPERSIÓN RAYLEIGH COHERENTE',
    title: 'DAS: Distributed Acoustic & Vibration Sensing',
    lead: 'Transforma una fibra óptica monomodo estándar en una matriz densa de miles de geófonos acústicos de alta frecuencia con muestreo en tiempo real.',
    specs: [
      { k: 'Principio Físico', v: 'Phase-sensitive Coherent OTDR ( $\\Phi$-OTDR) / Dispersión Rayleigh' },
      { k: 'Rango de Frecuencia', v: '0.05 Hz hasta 20 kHz (personalizable por tramo)' },
      { k: 'Resolución Espacial (Gauge Length)', v: '1 m a 10 m configurable' },
      { k: 'Alcance Óptico', v: 'Hasta 50 km por canal óptico (sin repetidores)' },
      { k: 'Tasa de Muestreo Acústico', v: 'Hasta 40.000 trazas / segundo' },
      { k: 'Inmunidad Ambiental', v: '100% dieléctrico, inmune a EMI, rayos y tronaduras' },
      { k: 'Aplicaciones Clave', v: 'Microsismicidad inducida en roca, control de tronaduras, tráfico pesado, monitoreo perimetral' }
    ],
    body: `
      <h4>Física de la Medición DAS</h4>
      <p>El sistema inyecta pulsos de luz láser ultra-coherente con un ancho de línea espectral menor a 1 kHz. A medida que el pulso viaja a la velocidad de la luz en el núcleo de sílice (n ≈ 1.468), microscópicas inhomogeneidades naturales generan retrodispersión elástica de Rayleigh.</p>
      <p style="margin-top:12px;">Cualquier perturbación acústica, onda sísmica o vibración mecánica comprime o estira dinámicamente la fibra en fracciones de nanómetro. Esto produce un cambio de fase interferométrica que el interrogador FiberAndes demodula instantáneamente a miles de veces por segundo, georreferenciando con exactitud métrica la fuente de la vibración.</p>
      <h4 style="margin-top:20px;">Ventaja Frente a Geófonos Discretos</h4>
      <p>A diferencia de geófonos puntuales (tipo ESI) que solo detectan en la ubicación del pozo o estación de superficie, DAS entrega una imagen continua (waterfall de distancia vs. tiempo) a lo largo de túneles, galerías o rajos, detectando eventos microsísmicos que caerían en los puntos ciegos tradicionales.</p>
    `
  },
  dss: {
    tag: 'TECNOLOGÍA DSS · DISPERSIÓN BRILLOUIN',
    title: 'DSS: Distributed Strain Sensing (Deformación Continua)',
    lead: 'Medición milimétrica continua del perfil de deformación mecánica y esfuerzos estáticos en macizos rocosos, túneles y estructuras.',
    specs: [
      { k: 'Principio Físico', v: 'Brillouin Optical Time/Frequency Domain Analysis (BOTDA / BOTDR)' },
      { k: 'Resolución de Deformación', v: '±2 $\\mu\\varepsilon$ (micro-strain) / 0.002 mm por metro' },
      { k: 'Rango de Medición', v: '-20.000 $\\mu\\varepsilon$ (compresión) a +30.000 $\\mu\\varepsilon$ (tracción)' },
      { k: 'Resolución Espacial', v: '0.2 m a 1 m continuo' },
      { k: 'Alcance Óptico', v: 'Hasta 60 km con interrogador de doble extremo (loop cerrado)' },
      { k: 'Estabilidad a Largo Plazo', v: 'Deriva cero a 20+ años (sensor pasivo de vidrio)' },
      { k: 'Aplicaciones Clave', v: 'Convergencia en túneles, subsidencia de taludes, diques de relaves, flexión de puentes' }
    ],
    body: `
      <h4>Física de la Medición DSS</h4>
      <p>La interacción inelástica entre los fotones del láser incidente y los fonones acústicos (ondas mecánicas térmicas dentro de la sílice) produce un desplazamiento de frecuencia Brillouin proporcional a la tensión longitudinal y temperatura de la fibra.</p>
      <p style="margin-top:12px;">Mediante cables de fibra especialmente acoplados a la roca o estructura con resinas tixotrópicas o anclajes continuos, FiberAndes discrimina la deformación pura con una exactitud de micro-deformaciones (micro-strain), permitiendo advertir cizallamiento y movimientos milimétricos semanas antes de que ocurra una falla visible.</p>
    `
  },
  dts: {
    tag: 'TECNOLOGÍA DTS · DISPERSIÓN RAMAN',
    title: 'DTS: Distributed Temperature Sensing (Temperatura Continua)',
    lead: 'Detección continua de temperatura para localización inmediata de filtraciones en presas de relave, fugas en ductos y sobrecalentamiento.',
    specs: [
      { k: 'Principio Físico', v: 'Raman Optical Time Domain Reflectometry (OTDR)' },
      { k: 'Resolución de Temperatura', v: 'Hasta 0.01 °C' },
      { k: 'Resolución Espacial', v: '1 m a lo largo de toda la extensión' },
      { k: 'Rango de Temperatura', v: '-50 °C hasta +250 °C (con fibras especiales hasta +400 °C)' },
      { k: 'Tiempo de Integración', v: '10 segundos a 60 segundos configurable' },
      { k: 'Resistencia Química', v: 'Inmune a soluciones ácidas, lixiviación y salmueras' },
      { k: 'Aplicaciones Clave', v: 'Filtraciones freáticas en relaves, fugas en mineroductos, cables de potencia, detección de incendios' }
    ],
    body: `
      <h4>Física de la Medición DTS</h4>
      <p>La dispersión inelástica Raman genera dos componentes espectrales: Stokes (insensible a la temperatura) y Anti-Stokes (altamente sensible a la energía térmica de la red cristalina de sílice). FiberAndes calcula la razón de intensidades fotónicas I_anti-stokes / I_stokes para determinar la temperatura absoluta en cada metro de fibra.</p>
      <h4 style="margin-top:20px;">Detección de Filtraciones en Tranques de Relaves</h4>
      <p>El agua de filtración o percolación genera una anomalía térmica detectable frente al terreno circundante. La fibra óptica enterrada en el pie o espaldón del muro identifica exactamente la coordenada métrica de la línea de saturación freática en tiempo real, cumpliendo con los estándares internacionales de seguridad de presas (GISTM) y normativa Sernageomin.</p>
    `
  },
  interrogator: {
    tag: 'HARDWARE · OPTOELECTRÓNICA INDUSTRIAL',
    title: 'Interrogador FiberAndes Core Series',
    lead: 'Chasis robusto rackeable de 19 pulgadas para salas de control o gabinetes de campo autónomos con certificación industrial.',
    specs: [
      { k: 'Factor de Forma', v: 'Rack 19" 2U / 3U o Gabinete NEMA 4X / IP66 para terreno' },
      { k: 'Seguridad Láser', v: 'Clase 1 (Eye-Safe según IEC 60825-1)' },
      { k: 'Canales Ópticos', v: '1 a 16 canales configurables (conmutación óptica ultra rápida)' },
      { k: 'Procesamiento', v: 'FPGA de alta densidad + GPU para inferencia de Machine Learning local' },
      { k: 'Consumo Eléctrico', v: '65 W a 140 W (compatible con sistemas solares aislados)' },
      { k: 'Comunicaciones', v: 'Doble Ethernet Gigabit, Fibra Óptica LAN, Módem 4G/5G, Satelital LEO' },
      { k: 'Protocolos Industriales', v: 'OPC-UA, Modbus TCP, MQTT, Webhook REST API, SCADA integration' }
    ],
    body: `
      <h4>Ventaja Arquitectónica</h4>
      <p>Todo el procesamiento activo, lásers y fotodiodos residen de forma segura en la sala de control o subestación eléctrica. En terreno, en el macizo rocoso o en el talud del relave, únicamente se instala un hilo pasivo de fibra de vidrio dentro de una chaqueta blindada. Cero baterías en la montaña, cero paneles solares que limpiar de polvo minero y cero riesgo de falla por descargas atmosféricas.</p>
    `
  }
};
