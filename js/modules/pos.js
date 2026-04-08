import { db } from '../firebase-config.js';
import { collection, getDocs, query, orderBy, onSnapshot, doc, updateDoc, writeBatch, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { AppState, fmt, toast, openModal, closeModal, emit, on } from '../utils/helpers.js';

let initialized = false;
let categoriaActual = null;
let gridSize = 'grande';

export async function initPOS(state) {
  if (initialized) return;
  initialized = true;
  
  // Suscribir a categorías y productos
  subscribeToCategories();
  subscribeToProducts();
  
  // Eventos UI
  document.getElementById('pos-buscar')?.addEventListener('input', (e) => buscarProductos(e.target.value));
  document.getElementById('pos-categoria-filtro')?.addEventListener('change', (e) => filtrarPorCategoria(e.target.value));
  document.getElementById('btn-facturar')?.addEventListener('click', abrirModalFacturar);
  document.getElementById('btn-limpiar-carrito')?.addEventListener('click', limpiarCarrito);
  document.getElementById('btn-scanner')?.addEventListener('click', abrirScanner);
  
  document.querySelectorAll('.grid-btn').forEach(btn => {
    btn.addEventListener('click', () => setGridSize(btn.dataset.grid));
  });
  
  // Escuchar cambios en caja
  on('caja:updated', () => renderCarrito());
}

function subscribeToCategories() {
  const catsRef = collection(db, 'negocios', AppState.negocioId, 'categorias');
  onSnapshot(catsRef, (snap) => {
    AppState.categorias = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCategoriasPos();
    updateCategorySelects();
  });
}

function subscribeToProducts() {
  // Se cargarán bajo demanda
  loadAllProducts();
}

async function loadAllProducts() {
  AppState.productos = [];
  for (const cat of AppState.categorias) {
    const prodsRef = collection(db, 'negocios', AppState.negocioId, 'categorias', cat.id, 'productos');
    const snap = await getDocs(prodsRef);
    snap.docs.forEach(d => {
      AppState.productos.push({ id: d.id, categoriaId: cat.id, categoriaNombre: cat.nombre, ...d.data() });
    });
  }
  if (categoriaActual) renderProductosCategoria(categoriaActual);
  else renderCategoriasPos();
}

function updateCategorySelects() {
  const sel = document.getElementById('pos-categoria-filtro');
  if (!sel) return;
  sel.innerHTML = '<option value="">Todas las categorías</option>' + 
    AppState.categorias.map(c => `<option value="${c.id}">${c.emoji || '📦'} ${c.nombre}</option>`).join('');
}

function renderCategoriasPos() {
  const area = document.getElementById('pos-productos-area');
  if (!area || categoriaActual) return;
  
  if (!AppState.categorias.length) {
    area.innerHTML = '<div class="empty-state"><i class="fas fa-folder-open"></i><p>Sin categorías</p></div>';
    return;
  }
  
  area.innerHTML = `<div class="categorias-grid">${AppState.categorias.map(c => `
    <div class="cat-card" data-cat-id="${c.id}">
      <span class="cat-emoji">${c.emoji || '📦'}</span>
      <span>${c.nombre}</span>
      <small>${AppState.productos.filter(p => p.categoriaId === c.id).length} productos</small>
    </div>
  `).join('')}</div>`;
  
  document.querySelectorAll('.cat-card').forEach(card => {
    card.addEventListener('click', () => verProductosCategoria(card.dataset.catId));
  });
}

function verProductosCategoria(catId) {
  categoriaActual = catId;
  renderProductosCategoria(catId);
}

function renderProductosCategoria(catId, busqueda = '') {
  const area = document.getElementById('pos-productos-area');
  const cat = AppState.categorias.find(c => c.id === catId);
  let prods = AppState.productos.filter(p => p.categoriaId === catId);
  if (busqueda) {
    prods = prods.filter(p => p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || 
      (p.codigoBarras || '').includes(busqueda));
  }
  
  area.innerHTML = `
    <div class="productos-header">
      <button class="back-btn" id="back-categorias"><i class="fas fa-arrow-left"></i> Categorías</button>
      <strong>${cat?.nombre || 'Productos'}</strong>
    </div>
    <div class="productos-grid ${gridSize}" id="productos-grid">
      ${prods.length ? prods.map(p => renderProdCard(p)).join('') : '<div class="empty-state"><p>Sin productos</p></div>'}
    </div>
  `;
  
  document.getElementById('back-categorias')?.addEventListener('click', () => {
    categoriaActual = null;
    renderCategoriasPos();
  });
  
  document.querySelectorAll('.prod-card').forEach(card => {
    card.addEventListener('click', () => agregarAlCarrito(card.dataset.prodId));
  });
}

function renderProdCard(p) {
  const sinStock = (p.stock || 0) <= 0;
  return `<div class="prod-card ${sinStock ? 'sin-stock' : ''}" data-prod-id="${p.id}">
    <div class="prod-emoji">📦</div>
    <div class="prod-info">
      <div class="prod-nombre">${p.nombre}</div>
      <div class="prod-precio">${fmt(p.precio)}</div>
      <div class="prod-stock">Stock: ${p.stock || 0}</div>
    </div>
    <div class="add-overlay"><i class="fas fa-plus-circle"></i></div>
  </div>`;
}

function buscarProductos(q) {
  if (!q) {
    if (categoriaActual) renderProductosCategoria(categoriaActual);
    else renderCategoriasPos();
    return;
  }
  const found = AppState.productos.filter(p => p.nombre?.toLowerCase().includes(q.toLowerCase()));
  const area = document.getElementById('pos-productos-area');
  area.innerHTML = `<div class="productos-grid ${gridSize}">${found.map(p => renderProdCard(p)).join('') || '<div class="empty-state"><p>Sin resultados</p></div>'}</div>`;
  document.querySelectorAll('.prod-card').forEach(card => {
    card.addEventListener('click', () => agregarAlCarrito(card.dataset.prodId));
  });
}

function filtrarPorCategoria(catId) {
  if (!catId) {
    categoriaActual = null;
    renderCategoriasPos();
  } else {
    categoriaActual = catId;
    renderProductosCategoria(catId);
  }
}

function setGridSize(size) {
  gridSize = size;
  document.querySelectorAll('.grid-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.grid === size);
  });
  if (categoriaActual) renderProductosCategoria(categoriaActual);
}

function agregarAlCarrito(prodId) {
  if (!AppState.cajaActual) { toast('La caja no está abierta', 'error'); return; }
  const prod = AppState.productos.find(p => p.id === prodId);
  if (!prod) return;
  if (prod.stock <= 0) { toast('Sin stock', 'error'); return; }
  
  const idx = AppState.carrito.findIndex(i => i.id === prodId);
  if (idx >= 0) {
    if (AppState.carrito[idx].qty >= prod.stock) { toast('Stock insuficiente', 'error'); return; }
    AppState.carrito[idx].qty++;
  } else {
    AppState.carrito.push({ ...prod, qty: 1 });
  }
  renderCarrito();
  toast(`${prod.nombre} agregado`, 'success');
}

function renderCarrito() {
  const items = document.getElementById('carrito-items');
  const count = document.getElementById('carrito-count');
  const totalQty = AppState.carrito.reduce((s, i) => s + i.qty, 0);
  count.textContent = totalQty;
  
  if (!AppState.carrito.length) {
    items.innerHTML = '<div class="carrito-empty"><i class="fas fa-shopping-cart"></i><p>Carrito vacío</p></div>';
  } else {
    items.innerHTML = AppState.carrito.map(item => `
      <div class="carrito-item" data-prod-id="${item.id}">
        <div class="item-emoji">📦</div>
        <div class="item-info"><div class="item-nombre">${item.nombre}</div><div class="item-precio">${fmt(item.precio)}</div></div>
        <div class="item-ctrl"><button class="qty-btn minus">-</button><span class="qty-num">${item.qty}</span><button class="qty-btn plus">+</button></div>
        <span class="item-subtotal">${fmt(item.precio * item.qty)}</span>
      </div>
    `).join('');
    
    document.querySelectorAll('.carrito-item').forEach(row => {
      const id = row.dataset.prodId;
      row.querySelector('.minus')?.addEventListener('click', () => cambiarQty(id, -1));
      row.querySelector('.plus')?.addEventListener('click', () => cambiarQty(id, 1));
    });
  }
  
  const subtotal = AppState.carrito.reduce((s, i) => s + i.precio * i.qty, 0);
  const itbisCliente = AppState.config.itbisCliente !== false;
  const itbis = itbisCliente ? subtotal * (AppState.config.itbisPct / 100) : 0;
  const total = subtotal + itbis;
  
  document.getElementById('cart-subtotal').textContent = fmt(subtotal);
  document.getElementById('cart-itbis-label').innerHTML = `ITBIS (${AppState.config.itbisPct}%)${!itbisCliente ? ' (asumido)' : ''}`;
  document.getElementById('cart-itbis').textContent = fmt(itbis);
  document.getElementById('cart-total').textContent = fmt(total);
}

function cambiarQty(prodId, delta) {
  const idx = AppState.carrito.findIndex(i => i.id === prodId);
  if (idx < 0) return;
  AppState.carrito[idx].qty += delta;
  if (AppState.carrito[idx].qty <= 0) AppState.carrito.splice(idx, 1);
  renderCarrito();
}

function limpiarCarrito() {
  AppState.carrito = [];
  renderCarrito();
}

function abrirModalFacturar() {
  if (!AppState.carrito.length) { toast('Carrito vacío', 'error'); return; }
  if (!AppState.cajaActual) { toast('Caja no abierta', 'error'); return; }
  
  const subtotal = AppState.carrito.reduce((s, i) => s + i.precio * i.qty, 0);
  const itbis = AppState.config.itbisCliente !== false ? subtotal * (AppState.config.itbisPct / 100) : 0;
  const total = subtotal + itbis;
  
  const itemsHtml = AppState.carrito.map(i => `
    <div class="factura-item-row"><span class="fi-nombre">${i.nombre}</span><span class="fi-qty">x${i.qty}</span><span class="fi-precio">${fmt(i.precio * i.qty)}</span></div>
  `).join('');
  
  const bodyHtml = `
    <div class="factura-items-lista">${itemsHtml}</div>
    <div style="background:var(--gris-bg);padding:12px;border-radius:8px;margin-bottom:16px;">
      <div>Subtotal: ${fmt(subtotal)}</div>
      <div>ITBIS (${AppState.config.itbisPct}%): ${fmt(itbis)}</div>
      <div style="font-size:18px;font-weight:800;">Total: ${fmt(total)}</div>
    </div>
    <div class="form-group"><label>Método de Pago</label>
      <select id="fact-metodo-pago">
        <option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option>
      </select>
    </div>
    <div class="form-group"><label>Estado</label>
      <select id="fact-estado-pago">
        <option value="pagada">Pagada</option><option value="pendiente">Pendiente</option>
      </select>
    </div>
  `;
  
  openModal('Procesar Factura', bodyHtml, async () => {
    const metodo = document.getElementById('fact-metodo-pago').value;
    const estado = document.getElementById('fact-estado-pago').value;
    await confirmarFactura(metodo, estado);
  }, 'Confirmar Factura');
}

async function confirmarFactura(metodoPago, estado) {
  const subtotal = AppState.carrito.reduce((s, i) => s + i.precio * i.qty, 0);
  const itbis = AppState.config.itbisCliente !== false ? subtotal * (AppState.config.itbisPct / 100) : 0;
  const total = subtotal + itbis;
  const ncfSeq = AppState.config.ncfSeq || 1;
  const ncf = `${AppState.config.ncfPrefijo || 'B01'}${String(ncfSeq).padStart(8, '0')}`;
  const numFactura = `F-${Date.now()}`;
  
  const facturaData = {
    numero: numFactura, ncf, fecha: serverTimestamp(),
    items: AppState.carrito.map(i => ({ id: i.id, nombre: i.nombre, precio: i.precio, qty: i.qty, subtotal: i.precio * i.qty })),
    subtotal, itbis, itbisPct: AppState.config.itbisPct, total,
    metodoPago, estado, empleadoNombre: AppState.currentUser?.email || 'Admin',
    cajaId: AppState.cajaActual.id, uid: AppState.currentUser?.uid
  };
  
  try {
    const factRef = await addDoc(collection(db, 'negocios', AppState.negocioId, 'facturas'), facturaData);
    
    if (estado === 'pagada') {
      await addDoc(collection(db, 'negocios', AppState.negocioId, 'movimientos'), {
        tipo: 'ingreso', descripcion: `Venta ${numFactura}`, monto: total,
        fecha: serverTimestamp(), uid: AppState.currentUser?.uid, empleadoNombre: AppState.currentUser?.email,
        facturaId: factRef.id, cajaId: AppState.cajaActual.id
      });
      await updateDoc(doc(db, 'negocios', AppState.negocioId, 'caja', AppState.cajaActual.id), {
        ingresos: (AppState.cajaActual.ingresos || 0) + total
      });
    }
    
    await updateDoc(doc(db, 'negocios', AppState.negocioId, 'configuraciones', 'general'), { ncfSeq: ncfSeq + 1 });
    AppState.config.ncfSeq = ncfSeq + 1;
    
    const batch = writeBatch(db);
    for (const item of AppState.carrito) {
      const prodRef = doc(db, 'negocios', AppState.negocioId, 'categorias', item.categoriaId, 'productos', item.id);
      batch.update(prodRef, { stock: (item.stock || 0) - item.qty });
    }
    await batch.commit();
    
    AppState.carrito = [];
    renderCarrito();
    toast('Factura generada', 'success');
    emit('factura:created', facturaData);
  } catch(e) {
    toast('Error: ' + e.message, 'error');
  }
}

function abrirScanner() {
  const bodyHtml = `<input type="text" id="scanner-input" placeholder="Código de barras..." style="width:100%;padding:12px;font-size:16px;"><button class="btn-primary" id="scanner-btn" style="margin-top:12px;">Buscar</button>`;
  openModal('Escanear Producto', bodyHtml, () => {
    const codigo = document.getElementById('scanner-input').value.trim();
    const prod = AppState.productos.find(p => p.codigoBarras === codigo);
    if (prod) { agregarAlCarrito(prod.id); toast(`${prod.nombre} agregado`, 'success'); }
    else toast('Producto no encontrado', 'error');
  }, 'Buscar');
}

// Exponer globalmente para eventos inline
window.agregarAlCarrito = agregarAlCarrito;