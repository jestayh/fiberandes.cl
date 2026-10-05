# FiberAndes — Distributed Fiber Optic Sensing (DFOS) en Chile

Sitio web oficial de **FiberAndes** ([www.fiberandes.cl](https://www.fiberandes.cl)), la primera empresa en Chile especializada en **Distributed Fiber Optic Sensing (DFOS)** aplicada a escala industrial.

---

## 🏔️ Propuesta de Valor y Ventaja Competitiva

FiberAndes revoluciona la instrumentación geotécnica y estructural frente a tecnologías convencionales de sensores discretos / puntuales (geófonos):

* **Toda la fibra es el sensor:** Convierte un cable de fibra óptica monomodo o blindado en más de 50.000 puntos de medición virtuales continuos cada 1 metro.
* **Cero puntos ciegos:** Detección y georreferenciación métrica de cualquier microfractura, deformación o filtración en tiempo real.
* **100% pasivo en terreno:** Solo viaja luz en campo. Sin electrónica, baterías ni paneles solares en zonas de riesgo o expuestas a tronaduras. Inmune a interferencia electromagnética (EMI), rayos y humedad.
* **Tres tecnologías físicas simultáneas (DAS · DSS · DTS):**
  * **DAS (Distributed Acoustic Sensing):** Detección acústica y microsismicidad por dispersión Rayleigh ($\Phi$-OTDR) con tasas de muestreo de hasta 20 kHz.
  * **DSS (Distributed Strain Sensing):** Monitoreo continuo de deformación milimétrica por dispersión Brillouin (BOTDA/BOTDR, $\pm 2\,\mu\varepsilon$) para convergencia en túneles y taludes.
  * **DTS (Distributed Temperature Sensing):** Detección térmica continua por dispersión Raman (resolución hasta 0.01 °C) para detección instantánea de filtraciones (seepage) en tranques de relaves y fugas en mineroductos.

---

## 📁 Estructura del Repositorio

```text
fiberandes.cl/
├── CNAME                    # Configuración de dominio personalizado para GitHub Pages
├── .nojekyll                # Desactiva Jekyll para carga rápida y soporte estático puro
├── index.html               # Página web principal optimizada para SEO, responsive y accesible
├── robots.txt               # Directivas para motores de búsqueda
├── sitemap.xml              # Mapa del sitio para indexación
├── css/
│   └── styles.css           # Sistema de diseño: modo oscuro fotónico, glassmorphism y responsive
├── js/
│   ├── app.js               # Controlador principal, scroll reveal, menú móvil y drawer modal
│   ├── drawer-data.js       # Fichas técnicas detalladas y física optoelectrónica
│   ├── hero-canvas.js       # Animación interactiva en Canvas de ondas sísmicas y pulsos láser
│   ├── simulator.js         # Simulador interactivo comparativo: DFOS vs. sensores discretos (geófonos)
│   ├── configurator.js      # Cotizador y recomendador interactivo de arquitectura DFOS
│   └── i18n.js              # Motor bilingüe en memoria (Español / Inglés)
└── assets/
    ├── logo.svg             # Logotipo vectorial FiberAndes
    ├── favicon.svg          # Favicon vectorial
    ├── og-image.jpg         # Imagen OpenGraph para redes sociales y WhatsApp
    ├── app-macizorocoso.jpg # Fotografía industrial: Monitoreo en macizo rocoso y minería subterránea
    ├── app-relaves.jpg      # Fotografía industrial: Tranques y presas de relave en la cordillera
    ├── app-civil.jpg        # Fotografía industrial: Puentes, presas y obras civiles
    └── hardware-interrogador.jpg # Unidad interrogadora optoelectrónica FiberAndes Core
```

---

## 🚀 Despliegue en GitHub Pages

Este repositorio está 100% optimizado para alojarse directamente en **GitHub Pages** sin necesidad de pasos de compilación ni dependencias externas:

1. **Subir cambios a GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Lanzamiento web FiberAndes"
   git branch -M main
   git remote add origin https://github.com/<tu-usuario>/fiberandes.cl.git
   git push -u origin main
   ```

2. **Activar GitHub Pages:**
   * En tu repositorio de GitHub, dirígete a **Settings** > **Pages**.
   * En **Build and deployment** > **Source**, selecciona `Deploy from a branch`.
   * Selecciona la rama `main` y la carpeta `/ (root)`, luego haz clic en **Save**.
   * En **Custom domain**, confirma que figure `www.fiberandes.cl` (detectado automáticamente gracias al archivo `CNAME`).
   * Marca la casilla **Enforce HTTPS** (se activará una vez propagado el certificado SSL de GitHub).

3. **Configuración de DNS en tu proveedor de dominio (ej. NIC Chile / Cloudflare / GoDaddy):**
   * **Para `www.fiberandes.cl`:**
     * Tipo: `CNAME`
     * Host / Nombre: `www`
     * Destino: `<tu-usuario>.github.io.`
   * **Para el dominio raíz `fiberandes.cl` (Apex Domain):**
     * Registros `A` apuntando a las IPs oficiales de GitHub Pages:
       * `185.199.108.153`
       * `185.199.109.153`
       * `185.199.110.153`
       * `185.199.111.153`

---

## 💻 Vista Previa Local

Para probar o visualizar el sitio localmente en tu equipo:

```bash
# Con Python
python -m http.server 8080

# Luego abre en tu navegador:
http://localhost:8080/index.html
```

---

© 2026 FiberAndes. Todos los derechos reservados.
San Felipe, Chile.
