# Denis Beauty — Tienda Online

Tienda de una sola página (`index.html`) que muestra un catálogo de productos
leído en vivo desde un Google Sheet, y arma el pedido para enviarlo por
WhatsApp. No necesita backend, base de datos ni build tools — es HTML, CSS y
JS puro en un solo archivo.

## Estructura

```
denis-beauty-tienda/
└── index.html   ← todo el sitio vive aquí (estilos, catálogo, lógica)
```

## Configuración rápida

Todo se edita al inicio del bloque `<script>` en `index.html`:

```js
const WHATSAPP_NUMBER = "521234567890"; // tu número: código país + número, sin + ni espacios
const CURRENCY = "$";
const SHEET_JSON_URL = "https://opensheet.elk.sh/TU_SHEET_ID/1";
```

### Catálogo (Google Sheets)

1. Crea un Google Sheet con estas columnas exactas en la fila 1:
   `id | nombre | categoria | precio | foto`
2. Comparte la hoja: botón "Compartir" → acceso general
   **"Cualquier persona con el enlace" → Lector**.
3. Copia el ID de tu hoja (la parte larga en la URL, entre `/d/` y `/edit`).
4. Arma tu link así: `https://opensheet.elk.sh/TU_SHEET_ID/1`
   (el `/1` significa "primera pestaña", no hace falta usar el nombre).
5. Pégalo en `SHEET_JSON_URL`.
6. Para las fotos: sube cada imagen a [imgur.com](https://imgur.com) (gratis,
   sin cuenta) y pega el link directo en la columna `foto`. Si la dejas
   vacía, se muestra un ícono como respaldo.

Cada vez que edites la hoja, la tienda se actualiza sola (el servicio
opensheet cachea hasta 30 segundos).

## Correr localmente en VS Code

⚠️ **No abras `index.html` haciendo doble clic** — el catálogo no cargará
porque los navegadores bloquean peticiones a internet desde archivos locales
(`file://`). Necesitas servirlo por HTTP:

**Opción A — extensión Live Server (recomendada):**
1. Instala la extensión "Live Server" de Ritwick Dey en VS Code.
2. Clic derecho sobre `index.html` → "Open with Live Server".
3. Se abre en `http://127.0.0.1:5500` y el catálogo carga normal.

**Opción B — servidor simple con Python:**
```bash
cd denis-beauty-tienda
python3 -m http.server 8000
```
Luego abre `http://localhost:8000` en tu navegador.

## Publicar gratis (para que tus clientas lo usen)

Cualquiera de estas opciones te da un link público con HTTPS, gratis:

- **Netlify Drop**: entra a app.netlify.com/drop y arrastra la carpeta.
- **Vercel**: `npm i -g vercel` → dentro de la carpeta, corre `vercel`.
- **GitHub Pages**: ver instrucciones abajo.

### Desplegar en GitHub Pages

Esta carpeta ya está lista para eso — el `index.html` está en la raíz, tal
como GitHub Pages lo necesita, y el archivo `.nojekyll` evita que GitHub
intente procesar el sitio con Jekyll (no lo necesitamos, es HTML puro).

1. Crea un repositorio nuevo en GitHub (público).
2. Desde la carpeta del proyecto, en terminal:
   ```bash
   git init
   git add .
   git commit -m "Tienda Denis Beauty"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
   git push -u origin main
   ```
3. En el repo: **Settings → Pages**
4. En "Source" elige la rama `main` y la carpeta `/ (root)` → Guardar.
5. Espera 1-2 minutos. Tu link queda en:
   `https://TU_USUARIO.github.io/TU_REPO/`

## Personalizar diseño

Los colores y tipografías están como variables CSS al inicio del `<style>`:

```css
:root{
  --ink:#2E1015;    /* texto principal */
  --bg:#FCF1E8;     /* fondo */
  --rose-deep:#B85C71; /* acentos, botones */
  --gold:#B8912F;   /* detalles */
}
```
