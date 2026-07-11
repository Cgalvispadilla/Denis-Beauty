/* ============================================================
   Denis Beauty — Tienda · Lógica de la aplicación

   CONFIGURA AQUÍ antes de publicar:
   ============================================================ */
const WHATSAPP_NUMBER = "573234467829";
const CURRENCY        = "$";
const SHEET_JSON_URL  = "https://opensheet.elk.sh/1XQ3SUg4jFQmLmvdR_kkS2UuQGAqoJ6PUepjsT2ijtH4/1";

const SVG_FALLBACK = `<svg class="product-fallback-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`;

/*
  Columnas del Google Sheet (fila 1):
  id | nombre | categoria | subcategoria | marca | precio | foto
*/

/* ============================================================
   Estado
   ============================================================ */
let PRODUCTS    = [];
let cart        = {};
let activeCat   = "Todos";
let activeSub   = "Todas";
let activeBrand = "Todas";
let draftSub    = "Todas";
let draftBrand  = "Todas";
let searchQuery  = "";
let searchTimer  = null;
let toastTimer   = null;
let cartBarTimer = null;

/* ============================================================
   Carga de catálogo
   ============================================================ */
function renderSkeleton(count) {
  const card = `
    <div class="skeleton-card" aria-hidden="true">
      <div class="skeleton-img shimmer"></div>
      <div class="skeleton-body">
        <div class="skeleton-line s shimmer"></div>
        <div class="skeleton-line m shimmer"></div>
        <div class="skeleton-line l shimmer"></div>
        <div class="skeleton-line btn shimmer"></div>
      </div>
    </div>`;
  return Array(count).fill(card).join('');
}

async function loadProducts() {
  const stateMsg = document.getElementById('stateMsg');
  const grid     = document.getElementById('grid');

  grid.innerHTML = renderSkeleton(8);

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
        id:       get('id') || crypto.randomUUID(),
        name:     get('nombre'),
        cat:      get('categoria')    || "Otros",
        subcat:   get('subcategoria') || "",
        brand:    get('marca')        || "",
        price:    Number(get('precio')) || 0,
        img:      get('foto'),
        fallback: SVG_FALLBACK,
      };
    }).filter(p => p.name);

    if (PRODUCTS.length === 0) {
      grid.innerHTML = '';
      stateMsg.textContent = "Tu catálogo está vacío. Agrega productos en el Google Sheet.";
      stateMsg.classList.add('error');
      return;
    }

    initListeners();
    renderAll();
    updateCart();

  } catch (err) {
    grid.innerHTML = '';
    stateMsg.textContent = "No pudimos cargar el catálogo. Revisá que la hoja esté compartida como 'Cualquier persona con el enlace'.";
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
    if (activeCat   !== "Todos" && p.cat    !== activeCat)   return false;
    if (activeSub   !== "Todas" && p.subcat !== activeSub)   return false;
    if (activeBrand !== "Todas" && p.brand  !== activeBrand) return false;
    if (q && ![p.name, p.cat, p.subcat, p.brand].some(v => v.toLowerCase().includes(q))) return false;
    return true;
  });
}

/* ============================================================
   Renderizado completo
   ============================================================ */
function renderAll() {
  renderTabs();
  renderFilterTrigger();
  renderFilterChips();
  renderGrid();
}

function renderTabs() {
  const cats = ["Todos", ...new Set(PRODUCTS.map(p => p.cat).filter(Boolean))];
  document.getElementById('tabs').innerHTML = cats.map(c =>
    `<button class="tab${c === activeCat ? ' active' : ''}" data-val="${escapeHtml(c)}">${escapeHtml(c)}</button>`
  ).join('');
}

function renderFilterTrigger() {
  const trigger = document.getElementById('filterTrigger');
  const badge   = document.getElementById('filterBadge');

  const subs = activeCat === "Todos"
    ? []
    : [...new Set(PRODUCTS.filter(p => p.cat === activeCat).map(p => p.subcat).filter(Boolean))];
  const brands = [...new Set(
    PRODUCTS.filter(p => activeCat === "Todos" || p.cat === activeCat).map(p => p.brand).filter(Boolean)
  )];

  const hasOptions  = subs.length > 0 || brands.length > 0;
  trigger.style.display = hasOptions ? 'flex' : 'none';

  const activeCount = (activeSub !== "Todas" ? 1 : 0) + (activeBrand !== "Todas" ? 1 : 0);
  if (activeCount > 0) {
    badge.textContent = activeCount;
    badge.style.display = 'flex';
    trigger.classList.add('has-active');
  } else {
    badge.style.display = 'none';
    trigger.classList.remove('has-active');
  }
}

function renderFilterChips() {
  const el    = document.getElementById('filterChips');
  const chips = [];
  if (activeSub   !== "Todas") chips.push({ label: activeSub,   type: 'sub'   });
  if (activeBrand !== "Todas") chips.push({ label: activeBrand, type: 'brand' });

  if (chips.length === 0) { el.innerHTML = ''; el.style.display = 'none'; return; }

  el.style.display = 'flex';
  el.innerHTML = chips.map(c =>
    `<button type="button" class="filter-chip" data-type="${c.type}" aria-label="Quitar filtro: ${escapeHtml(c.label)}">
      ${escapeHtml(c.label)}
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
    </button>`
  ).join('');
}

function renderGrid() {
  const items = getFiltered();
  const grid  = document.getElementById('grid');

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="no-results">
        <p>Sin resultados para estos filtros.</p>
        <button type="button" class="clear-btn" id="clearBtn">Limpiar filtros</button>
      </div>`;
    document.getElementById('clearBtn').addEventListener('click', clearFilters);
    return;
  }

  grid.innerHTML = items.map(p => {
    const inCart = cart[p.id] || 0;
    return `
    <div class="product${inCart ? ' in-cart' : ''}">
      <div class="product-img">
        ${p.img ? `<img src="${p.img}" alt="${escapeHtml(p.name)}" loading="lazy">` : p.fallback}
      </div>
      <div class="product-body">
        <span class="product-cat">${escapeHtml(p.cat)}${p.subcat ? ` · ${escapeHtml(p.subcat)}` : ''}</span>
        ${p.brand ? `<span class="product-brand">${escapeHtml(p.brand)}</span>` : ''}
        <span class="product-name">${escapeHtml(p.name)}</span>
        <span class="product-price">${CURRENCY}${p.price.toLocaleString('es')}</span>
        <div class="product-action" data-product-id="${p.id}">
          ${inCart
            ? `<div class="card-qty">
                 <button type="button" class="card-qty-btn" data-id="${p.id}" data-delta="-1" aria-label="Quitar uno">−</button>
                 <span class="card-qty-num">${inCart}</span>
                 <button type="button" class="card-qty-btn" data-id="${p.id}" data-delta="1" aria-label="Agregar uno">+</button>
               </div>`
            : `<button type="button" class="add-btn" data-id="${p.id}">+ Agregar</button>`
          }
        </div>
      </div>
    </div>`;
  }).join('');
}

/* Actualiza solo el botón/controles de una card sin re-renderizar todo el grid */
function updateProductButton(id) {
  const container = document.querySelector(`.product-action[data-product-id="${id}"]`);
  if (!container) return;

  const card = container.closest('.product');
  const qty  = cart[id] || 0;

  if (qty > 0) {
    card && card.classList.add('in-cart');
    container.innerHTML = `
      <div class="card-qty">
        <button type="button" class="card-qty-btn" data-id="${id}" data-delta="-1" aria-label="Quitar uno">−</button>
        <span class="card-qty-num">${qty}</span>
        <button type="button" class="card-qty-btn" data-id="${id}" data-delta="1" aria-label="Agregar uno">+</button>
      </div>`;
  } else {
    card && card.classList.remove('in-cart');
    container.innerHTML = `<button type="button" class="add-btn" data-id="${id}">+ Agregar</button>`;
  }
}

/* ============================================================
   Listeners — se registran una sola vez
   ============================================================ */
function initListeners() {
  /* Búsqueda */
  document.getElementById('searchInput').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = e.target.value.trim().toLowerCase();
      renderGrid();
    }, 280);
  });

  document.getElementById('searchInput').addEventListener('search', e => {
    if (e.target.value === '') { searchQuery = ''; renderGrid(); }
  });

  /* Categorías padre */
  document.getElementById('tabs').addEventListener('click', e => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    activeCat  = btn.dataset.val;
    activeSub  = "Todas";
    activeBrand = "Todas";
    draftSub   = "Todas";
    draftBrand = "Todas";
    closeFilterSheet();
    renderAll();
  });

  /* Chips de filtros activos */
  document.getElementById('filterChips').addEventListener('click', e => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    if (chip.dataset.type === 'sub')   { activeSub   = "Todas"; draftSub   = "Todas"; }
    if (chip.dataset.type === 'brand') { activeBrand = "Todas"; draftBrand = "Todas"; }
    renderFilterTrigger();
    renderFilterChips();
    renderGrid();
  });

  /* Abrir/cerrar sheet */
  document.getElementById('filterTrigger').addEventListener('click', openFilterSheet);
  document.getElementById('filterOverlay').addEventListener('click', closeFilterSheet);
  document.getElementById('filterSheetClose').addEventListener('click', closeFilterSheet);
  document.getElementById('filterSheetClear').addEventListener('click', clearSheetFilters);
  document.getElementById('filterSheetApply').addEventListener('click', applyFilters);

  /* Cambios de radio dentro del sheet */
  document.getElementById('filterSheetBody').addEventListener('change', e => {
    const radio = e.target.closest('input[type="radio"]');
    if (!radio) return;
    if (radio.name === 'subcat') {
      draftSub   = radio.value;
      draftBrand = "Todas";
    } else if (radio.name === 'brand') {
      draftBrand = radio.value;
    }
    renderFilterSheet();
  });

  /* Grid — delegación persistente */
  document.getElementById('grid').addEventListener('click', e => {
    const addBtn = e.target.closest('.add-btn');
    if (addBtn) { addToCart(addBtn.dataset.id); return; }
    const qtyBtn = e.target.closest('.card-qty-btn');
    if (qtyBtn) changeQty(qtyBtn.dataset.id, Number(qtyBtn.dataset.delta));
  });
}

function clearFilters() {
  activeCat  = "Todos";
  activeSub  = "Todas";
  activeBrand = "Todas";
  draftSub   = "Todas";
  draftBrand = "Todas";
  searchQuery = "";
  document.getElementById('searchInput').value = "";
  renderAll();
}

/* ============================================================
   Filter Sheet
   ============================================================ */
function openFilterSheet() {
  closeCart();
  draftSub   = activeSub;
  draftBrand = activeBrand;
  renderFilterSheet();
  document.getElementById('filterSheet').classList.add('open');
  document.getElementById('filterOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeFilterSheet() {
  document.getElementById('filterSheet').classList.remove('open');
  document.getElementById('filterOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function applyFilters() {
  activeSub   = draftSub;
  activeBrand = draftBrand;
  closeFilterSheet();
  renderFilterTrigger();
  renderFilterChips();
  renderGrid();
}

function clearSheetFilters() {
  draftSub   = "Todas";
  draftBrand = "Todas";
  renderFilterSheet();
}

function renderFilterSheet() {
  const subs = activeCat === "Todos"
    ? []
    : [...new Set(PRODUCTS.filter(p => p.cat === activeCat).map(p => p.subcat).filter(Boolean))].sort();

  const relevant = PRODUCTS.filter(p =>
    (activeCat === "Todos" || p.cat    === activeCat) &&
    (draftSub  === "Todas" || p.subcat === draftSub)
  );
  const brands = [...new Set(relevant.map(p => p.brand).filter(Boolean))].sort();

  let html = '';

  if (subs.length > 0) {
    html += `<div class="filter-section">
      <div class="filter-section-title">Subcategoría</div>
      ${["Todas", ...subs].map(s => `
        <label class="filter-option${draftSub === s ? ' selected' : ''}">
          <input type="radio" name="subcat" value="${escapeHtml(s)}" ${draftSub === s ? 'checked' : ''}>
          <span>${escapeHtml(s)}</span>
          <span class="filter-option-check"></span>
        </label>`).join('')}
    </div>`;
  }

  if (brands.length > 0) {
    html += `<div class="filter-section">
      <div class="filter-section-title">Marca</div>
      ${["Todas", ...brands].map(b => `
        <label class="filter-option${draftBrand === b ? ' selected' : ''}">
          <input type="radio" name="brand" value="${escapeHtml(b)}" ${draftBrand === b ? 'checked' : ''}>
          <span>${escapeHtml(b)}</span>
          <span class="filter-option-check"></span>
        </label>`).join('')}
    </div>`;
  }

  if (!html) {
    html = `<p class="filter-empty">No hay opciones de filtro para esta categoría.</p>`;
  }

  document.getElementById('filterSheetBody').innerHTML = html;
  updateApplyButton();
}

function updateApplyButton() {
  const count = (draftSub !== "Todas" ? 1 : 0) + (draftBrand !== "Todas" ? 1 : 0);
  const btn   = document.getElementById('filterSheetApply');
  if (btn) btn.textContent = count > 0 ? `Aplicar (${count})` : 'Aplicar';
}

/* ============================================================
   Carrito
   ============================================================ */
function addToCart(id) {
  const isNew = !cart[id];
  cart[id] = (cart[id] || 0) + 1;
  updateProductButton(id);
  updateCart();
  flashCartBar();
  animateCartCount();
  const p = PRODUCTS.find(p => p.id == id);
  showToast(isNew ? `${escapeHtml(p.name)} agregado al pedido` : `${cart[id]} × ${escapeHtml(p.name)}`);
}

function changeQty(id, delta) {
  cart[id] = (cart[id] || 0) + delta;
  if (cart[id] <= 0) delete cart[id];
  updateProductButton(id);
  updateCart();
  if (delta > 0) { animateCartCount(); flashCartBar(); }
}

function updateCart() {
  const ids   = Object.keys(cart);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  document.getElementById('cartCount').textContent = count;

  const drawerItems = document.getElementById('drawerItems');
  if (ids.length === 0) {
    drawerItems.innerHTML = `<div class="empty-msg">Tu pedido está vacío.<br>Agrega productos del catálogo ✨</div>`;
  } else {
    drawerItems.innerHTML = ids.map(id => {
      const p     = PRODUCTS.find(p => p.id == id);
      const qty   = cart[id];
      const thumb = p.img
        ? `<img src="${p.img}" alt="" style="width:36px;height:36px;object-fit:cover;border-radius:8px;">`
        : p.fallback;
      return `
        <div class="cart-item">
          <span class="cart-item-thumb">${thumb}</span>
          <div class="cart-item-info">
            <div class="cart-item-name">${escapeHtml(p.name)}</div>
            <div class="cart-item-price">${CURRENCY}${p.price.toLocaleString('es')} c/u</div>
          </div>
          <div class="qty">
            <button type="button" onclick="changeQty('${id}', -1)" aria-label="Quitar uno">−</button>
            <span>${qty}</span>
            <button type="button" onclick="changeQty('${id}', 1)" aria-label="Agregar uno">+</button>
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

  updateCartBar(ids, count, total);
}

/* ============================================================
   Barra flotante de carrito
   ============================================================ */
function updateCartBar(ids, count, total) {
  const bar = document.getElementById('cartBar');

  if (!ids || ids.length === 0) {
    clearTimeout(cartBarTimer);
    bar.classList.remove('visible');
    document.body.classList.remove('has-cart');
    return;
  }

  document.body.classList.add('has-cart');
  document.getElementById('cartBarCount').textContent =
    `${count} ${count === 1 ? 'producto' : 'productos'}`;
  document.getElementById('cartBarTotal').textContent = CURRENCY + total.toLocaleString('es');
}

function flashCartBar() {
  const bar = document.getElementById('cartBar');
  bar.classList.add('visible');
  clearTimeout(cartBarTimer);
  cartBarTimer = setTimeout(() => bar.classList.remove('visible'), 3000);
}

/* ============================================================
   Drawer carrito
   ============================================================ */
function openCart() {
  closeFilterSheet();
  document.getElementById('drawer').classList.add('open');
  document.getElementById('overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeCart(); closeFilterSheet(); }
});

/* ============================================================
   Toast & animaciones
   ============================================================ */
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function animateCartCount() {
  const el = document.getElementById('cartCount');
  el.classList.remove('bounce');
  void el.offsetWidth;
  el.classList.add('bounce');
}

/* ============================================================
   Checkout WhatsApp
   ============================================================ */
function checkoutWhatsApp() {
  const ids = Object.keys(cart);
  if (ids.length === 0) return;

  let message = "¡Hola Denis Beauty! ✨ Quiero hacer este pedido:\n\n";
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
