/* ============================================================
   Denis Beauty — Tienda · Lógica de la aplicación

   CONFIGURA AQUÍ antes de publicar:
   ============================================================ */
const WHATSAPP_NUMBER = "573234467829"; // código país + número, sin + ni espacios
const CURRENCY        = "$";
const SHEET_JSON_URL  = "https://opensheet.elk.sh/1XQ3SUg4jFQmLmvdR_kkS2UuQGAqoJ6PUepjsT2ijtH4/1";

/*
  CÓMO ARMAR TU GOOGLE SHEET
  Columnas exactas en la fila 1:
  id | nombre | categoria | subcategoria | marca | precio | foto

  Comparte la hoja: "Cualquier persona con el enlace → Lector".
  El "/1" al final apunta a la primera pestaña sin importar su nombre.
*/

/* ============================================================
   Estado
   ============================================================ */
let PRODUCTS    = [];
let cart        = {};
let activeCat   = "Todos";
let activeSub   = "Todas";
let activeBrand = "Todas";
let searchQuery = "";
let searchTimer = null;

/* ============================================================
   Carga de catálogo
   ============================================================ */
async function loadProducts() {
  const stateMsg = document.getElementById('stateMsg');
  try {
    const res = await fetch(SHEET_JSON_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Respuesta no OK");

    const rows = await res.json();

    PRODUCTS = rows.map(row => {
      const get = key => {
        const found = Object.keys(row).find(k => k.trim().toLowerCase() === key);
        return found ? String(row[found]).trim() : "";
      };
      return {
        id:     get('id') || crypto.randomUUID(),
        name:   get('nombre'),
        cat:    get('categoria')    || "Otros",
        subcat: get('subcategoria') || "",
        brand:  get('marca')        || "",
        price:  Number(get('precio')) || 0,
        img:    get('foto'),
        emoji:  "💄",
      };
    }).filter(p => p.name);

    if (PRODUCTS.length === 0) {
      stateMsg.textContent = "Tu catálogo está vacío. Agrega productos en el Google Sheet.";
      stateMsg.classList.add('error');
      return;
    }

    stateMsg.style.display = "none";
    initListeners();
    renderAll();
    updateCart();

  } catch (err) {
    stateMsg.textContent = "No pudimos cargar el catálogo. Revisá que la hoja esté compartida como 'Cualquier persona con el enlace' y que el ID sea correcto.";
    stateMsg.classList.add('error');
    console.error(err);
  }
}

/* ============================================================
   Filtrado
   ============================================================ */
function getFiltered() {
  const q = searchQuery.toLowerCase();
  return PRODUCTS.filter(p => {
    if (activeCat   !== "Todos"  && p.cat   !== activeCat)   return false;
    if (activeSub   !== "Todas"  && p.subcat !== activeSub)   return false;
    if (activeBrand !== "Todas"  && p.brand  !== activeBrand) return false;
    if (q && ![p.name, p.cat, p.subcat, p.brand].some(v => v.toLowerCase().includes(q))) return false;
    return true;
  });
}

/* ============================================================
   Renderizado
   ============================================================ */
function renderAll() {
  renderTabs();
  renderSubcats();
  renderBrands();
  renderGrid();
}

function renderTabs() {
  const cats = ["Todos", ...new Set(PRODUCTS.map(p => p.cat).filter(Boolean))];
  document.getElementById('tabs').innerHTML = cats.map(c =>
    `<button class="tab${c === activeCat ? ' active' : ''}" data-val="${escapeHtml(c)}">${escapeHtml(c)}</button>`
  ).join('');
}

function renderSubcats() {
  const container = document.getElementById('subcats');
  const subs = activeCat === "Todos"
    ? []
    : [...new Set(PRODUCTS.filter(p => p.cat === activeCat).map(p => p.subcat).filter(Boolean))].sort();

  if (subs.length === 0) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  container.innerHTML = ["Todas", ...subs].map(s =>
    `<button class="subtab${s === activeSub ? ' active' : ''}" data-val="${escapeHtml(s)}">${escapeHtml(s)}</button>`
  ).join('');
}

function renderBrands() {
  const container = document.getElementById('brands');
  const relevant = PRODUCTS.filter(p =>
    (activeCat === "Todos"  || p.cat   === activeCat) &&
    (activeSub === "Todas"  || p.subcat === activeSub)
  );
  const brandList = [...new Set(relevant.map(p => p.brand).filter(Boolean))].sort();

  if (brandList.length === 0) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  container.innerHTML =
    `<span class="filter-label">Marca</span>` +
    ["Todas", ...brandList].map(b =>
      `<button class="brand-tab${b === activeBrand ? ' active' : ''}" data-val="${escapeHtml(b)}">${escapeHtml(b)}</button>`
    ).join('');
}

function renderGrid() {
  const items = getFiltered();
  const grid  = document.getElementById('grid');

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="no-results">
        <p>Sin resultados para estos filtros.</p>
        <button class="clear-btn" id="clearBtn">Limpiar filtros</button>
      </div>`;
    document.getElementById('clearBtn').addEventListener('click', clearFilters);
    return;
  }

  grid.innerHTML = items.map(p => `
    <div class="product">
      <div class="product-img">
        ${p.img ? `<img src="${p.img}" alt="${escapeHtml(p.name)}" loading="lazy">` : p.emoji}
      </div>
      <div class="product-body">
        <span class="product-cat">${escapeHtml(p.cat)}${p.subcat ? ` · ${escapeHtml(p.subcat)}` : ''}</span>
        ${p.brand ? `<span class="product-brand">${escapeHtml(p.brand)}</span>` : ''}
        <span class="product-name">${escapeHtml(p.name)}</span>
        <span class="product-price">${CURRENCY}${p.price.toLocaleString('es')}</span>
        <button class="add-btn" data-id="${p.id}">Agregar al pedido</button>
      </div>
    </div>
  `).join('');

  // Delegación para botones "Agregar"
  grid.addEventListener('click', e => {
    const btn = e.target.closest('.add-btn');
    if (btn) addToCart(btn.dataset.id);
  }, { once: true });
}

/* ============================================================
   Listeners (una sola vez tras cargar)
   ============================================================ */
function initListeners() {
  // Búsqueda con debounce
  document.getElementById('searchInput').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = e.target.value.trim().toLowerCase();
      renderGrid();
    }, 280);
  });

  // Categorías padre
  document.getElementById('tabs').addEventListener('click', e => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    activeCat   = btn.dataset.val;
    activeSub   = "Todas";
    activeBrand = "Todas";
    renderAll();
  });

  // Subcategorías
  document.getElementById('subcats').addEventListener('click', e => {
    const btn = e.target.closest('.subtab');
    if (!btn) return;
    activeSub   = btn.dataset.val;
    activeBrand = "Todas";
    renderSubcats();
    renderBrands();
    renderGrid();
  });

  // Marcas
  document.getElementById('brands').addEventListener('click', e => {
    const btn = e.target.closest('.brand-tab');
    if (!btn) return;
    activeBrand = btn.dataset.val;
    renderBrands();
    renderGrid();
  });
}

function clearFilters() {
  activeCat   = "Todos";
  activeSub   = "Todas";
  activeBrand = "Todas";
  searchQuery = "";
  document.getElementById('searchInput').value = "";
  renderAll();
}

/* ============================================================
   Carrito
   ============================================================ */
function addToCart(id) {
  cart[id] = (cart[id] || 0) + 1;
  updateCart();
  openCart();
}

function changeQty(id, delta) {
  cart[id] = (cart[id] || 0) + delta;
  if (cart[id] <= 0) delete cart[id];
  updateCart();
}

function updateCart() {
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  document.getElementById('cartCount').textContent = count;

  const ids         = Object.keys(cart);
  const drawerItems = document.getElementById('drawerItems');

  if (ids.length === 0) {
    drawerItems.innerHTML = `<div class="empty-msg">Tu pedido está vacío.<br>Agrega productos del catálogo ✨</div>`;
  } else {
    drawerItems.innerHTML = ids.map(id => {
      const p     = PRODUCTS.find(p => p.id == id);
      const qty   = cart[id];
      const thumb = p.img
        ? `<img src="${p.img}" alt="" style="width:36px;height:36px;object-fit:cover;border-radius:8px;">`
        : p.emoji;
      return `
        <div class="cart-item">
          <span class="cart-item-thumb">${thumb}</span>
          <div class="cart-item-info">
            <div class="cart-item-name">${escapeHtml(p.name)}</div>
            <div class="cart-item-price">${CURRENCY}${p.price.toLocaleString('es')} c/u</div>
          </div>
          <div class="qty">
            <button onclick="changeQty('${id}', -1)" aria-label="Quitar uno">−</button>
            <span>${qty}</span>
            <button onclick="changeQty('${id}', 1)" aria-label="Agregar uno">+</button>
          </div>
        </div>`;
    }).join('');
  }

  const total = ids.reduce((sum, id) => {
    const p = PRODUCTS.find(p => p.id == id);
    return sum + p.price * cart[id];
  }, 0);

  document.getElementById('totalPrice').textContent = CURRENCY + total.toLocaleString('es');
  document.getElementById('waBtn').disabled = ids.length === 0;
}

/* ============================================================
   Drawer
   ============================================================ */
function openCart() {
  document.getElementById('drawer').classList.add('open');
  document.getElementById('overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCart(); });

/* ============================================================
   Checkout WhatsApp
   ============================================================ */
function checkoutWhatsApp() {
  const ids = Object.keys(cart);
  if (ids.length === 0) return;

  let message = "¡Hola Denis Beauty! 💄 Quiero hacer este pedido:\n\n";
  let total   = 0;

  ids.forEach(id => {
    const p        = PRODUCTS.find(p => p.id == id);
    const qty      = cart[id];
    const subtotal = p.price * qty;
    total += subtotal;
    message += `• ${p.name} x${qty} — ${CURRENCY}${subtotal.toLocaleString('es')}\n`;
  });

  message += `\nTotal: ${CURRENCY}${total.toLocaleString('es')}\n\n¿Me confirmás disponibilidad y forma de pago? Gracias 🙌`;
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
}

/* ============================================================
   Utilidades
   ============================================================ */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
  );
}

/* ============================================================
   Inicio
   ============================================================ */
loadProducts();
