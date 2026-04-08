// ============================================================
// inventario.js — Categorías, productos, imagen upload
// ============================================================
import { db, storage, state, fmt, toast, abrirModal, cerrarModal } from "./app.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs,
  onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ── Suscripción en tiempo real ────────────────────────────
export function suscribirInventario() {
  if (state.unsubCategorias) state.unsubCategorias();
  state.unsubCategorias = onSnapshot(
    collection(db, 'negocios', state.negocioId, 'categorias'),
    async snap => {
      state.categorias = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      localStorage.setItem(`cats_${state.negocioId}`, JSON.stringify(state.categorias));
      renderCategoriasPos();
      populateCatSelects();
      await cargarTodosProductos();
    }
  );
}

export async function cargarTodosProductos() {
  const nuevos = [];
  for (const cat of state.categorias) {
    const snap = await getDocs(collection(db, 'negocios', state.negocioId, 'categorias', cat.id, 'productos'));
    snap.docs.forEach(d => nuevos.push({ id: d.id, categoriaId: cat.id, categoriaNombre: cat.nombre, ...d.data() }));
  }
  state.productos = nuevos;
  localStorage.setItem(`prods_${state.negocioId}`, JSON.stringify(state.productos));
  state.categoriaActual ? renderProductosCategoria(state.categoriaActual) : renderCategoriasPos();
  renderInventario();
}

export function populateCatSelects() {
  ['pos-categoria-filtro', 'inv-cat-filtro', 'prod-categoria'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const prev   = sel.value;
    const prefix = id === 'prod-categoria'
      ? '<option value="">Selecciona categoría...</option>'
      : '<option value="">Todas las categorías</option>';
    sel.innerHTML = prefix + state.categorias.map(c => `<option value="${c.id}">${c.emoji || '📦'} ${c.nombre}</option>`).join('');
    if (prev && state.categorias.find(c => c.id === prev)) sel.value = prev;
  });
}

// ── POS: categorías y productos ───────────────────────────
export function renderCategoriasPos() {
  const area = document.getElementById('pos-productos-area');
  if (!area) return;

  const sel = document.getElementById('pos-categoria-filtro');
  if (sel) {
    const prev = sel.value;
    sel.innerHTML = '<option value="">Todas las categorías</option>' +
      state.categorias.map(c => `<option value="${c.id}">${c.emoji || '📦'} ${c.nombre}</option>`).join('');
    sel.value = prev;
  }

  if (!state.categorias.length) {
    area.innerHTML = `<div class="empty-state"><i class="fas fa-folder-open"></i><p>No hay categorías creadas.<br>Ve a Inventario para crear categorías y productos.</p></div>`;
    return;
  }

  area.innerHTML = `<div class="categorias-grid">${state.categorias.map(c => `
    <div class="cat-card" onclick="verProductosCategoria('${c.id}')">
      ${c.imagen ? `<img src="${c.imagen}" alt="${c.nombre}" onerror="this.style.display='none'">` : `<span class="cat-emoji">${c.emoji || '📦'}</span>`}
      <span>${c.nombre}</span>
      <small>${state.productos.filter(p => p.categoriaId === c.id).length} productos</small>
    </div>`).join('')}</div>`;
}

window.verProductosCategoria = (catId) => {
  state.categoriaActual = catId;
  renderProductosCategoria(catId);
};

export function renderProductosCategoria(catId, busqueda = '') {
  const area = document.getElementById('pos-productos-area');
  const cat  = state.categorias.find(c => c.id === catId);
  let prods  = state.productos.filter(p => p.categoriaId === catId);
  if (busqueda) prods = prods.filter(p =>
    p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.codigoBarras || '').includes(busqueda)
  );
  if (!area) return;
  area.innerHTML = `
    <div class="productos-header">
      <button class="back-btn" onclick="volverCategorias()"><i class="fas fa-arrow-left"></i> Categorías</button>
      <strong style="font-size:15px;">${cat?.nombre || 'Productos'}</strong>
    </div>
    <div class="productos-grid ${state.gridSize}" id="productos-grid">
      ${prods.length ? prods.map(renderProdCard).join('') : '<div class="empty-state"><i class="fas fa-box-open"></i><p>Sin productos en esta categoría</p></div>'}
    </div>`;
}

function renderProdCard(p) {
  const sinStock = p.stock <= 0;
  return `<div class="prod-card ${sinStock ? 'sin-stock' : ''}" onclick="agregarAlCarrito('${p.id}')">
    ${p.imagen ? `<img src="${p.imagen}" alt="${p.nombre}" loading="lazy" onerror="this.outerHTML='<div class=&quot;prod-emoji&quot;>📦</div>'">` : `<div class="prod-emoji">📦</div>`}
    ${p.stock <= (p.stockMin || 5) && p.stock > 0 ? `<div class="stock-badge">⚠️ Bajo</div>` : ''}
    ${sinStock ? `<div class="stock-badge">Sin stock</div>` : ''}
    <div class="prod-info">
      <div class="prod-nombre">${p.nombre}</div>
      <div class="prod-precio">${fmt(p.precio)}</div>
      <div class="prod-stock">Stock: ${p.stock}</div>
    </div>
  </div>`;
}

window.volverCategorias = () => {
  state.categoriaActual = null;
  renderCategoriasPos();
};

window.buscarProductos = (q) => {
  if (!q) { state.categoriaActual ? renderProductosCategoria(state.categoriaActual) : renderCategoriasPos(); return; }
  const found = state.productos.filter(p =>
    p.nombre?.toLowerCase().includes(q.toLowerCase()) || (p.codigoBarras || '').includes(q)
  );
  const area = document.getElementById('pos-productos-area');
  if (!area) return;
  area.innerHTML = `
    <div class="productos-header">
      <button class="back-btn" onclick="volverCategorias()"><i class="fas fa-arrow-left"></i> Categorías</button>
      <span style="font-size:14px;color:var(--gris-suave);">${found.length} resultado(s) para "${q}"</span>
    </div>
    <div class="productos-grid ${state.gridSize}">${found.length ? found.map(renderProdCard).join('') : '<div class="empty-state"><p>Sin resultados</p></div>'}</div>`;
};

window.filtrarPorCategoria = (catId) => {
  if (!catId) { state.categoriaActual = null; renderCategoriasPos(); }
  else        { state.categoriaActual = catId; renderProductosCategoria(catId); }
};

window.setGridSize = (size) => {
  state.gridSize = size;
  document.getElementById('btn-grid-grande').classList.toggle('active', size === 'grande');
  document.getElementById('btn-grid-peq').classList.toggle('active', size === 'pequena');
  const grid = document.getElementById('productos-grid');
  if (grid) grid.className = `productos-grid ${size}`;
};

window.abrirScaner = () => {
  document.getElementById('scanner-input').value = '';
  abrirModal('modal-scanner');
  setTimeout(() => document.getElementById('scanner-input').focus(), 300);
};

window.buscarPorBarcode = () => {
  const codigo = document.getElementById('scanner-input').value.trim();
  if (!codigo) return;
  const prod = state.productos.find(p => p.codigoBarras === codigo);
  if (prod) {
    import('./facturacion.js').then(m => m.agregarAlCarritoObj(prod));
    cerrarModal('modal-scanner');
    toast(`"${prod.nombre}" agregado`, 'success');
  } else {
    toast('Producto no encontrado con ese código', 'error');
  }
};

// ── Inventario page ───────────────────────────────────────
export function renderInventario() {
  const area = document.getElementById('inv-contenido');
  if (!area) return;

  const buscar   = document.getElementById('inv-buscar')?.value?.toLowerCase() || '';
  const catFiltro = document.getElementById('inv-cat-filtro')?.value || '';
  const prods    = state.productos.filter(p => {
    if (buscar    && !p.nombre?.toLowerCase().includes(buscar) && !(p.codigoBarras || '').includes(buscar)) return false;
    if (catFiltro && p.categoriaId !== catFiltro) return false;
    return true;
  });

  if (!prods.length) {
    area.innerHTML = `<div class="empty-state"><i class="fas fa-box-open"></i><p>No hay productos. Haz clic en "Producto" para agregar.</p></div>`;
    return;
  }

  if (state.invViewGrid) {
    area.innerHTML = `<div class="inv-grid">${prods.map(p => `
      <div class="inv-card">
        ${p.imagen ? `<img src="${p.imagen}" alt="${p.nombre}" onerror="this.outerHTML='<div class=&quot;inv-emoji&quot;>📦</div>'">` : `<div class="inv-emoji">📦</div>`}
        <div class="inv-body">
          <div class="inv-nombre">${p.nombre}</div>
          ${p.codigoBarras ? `<div class="inv-codigo">${p.codigoBarras}</div>` : ''}
          <div class="inv-precios">
            <div class="inv-precio-venta">${fmt(p.precio)}</div>
            ${p.costo ? `<div class="inv-precio-costo">Costo: ${fmt(p.costo)}</div>` : ''}
          </div>
          <div class="inv-stock-bar"><div class="inv-stock-fill ${p.stock <= (p.stockMin || 5) ? 'bajo' : ''}" style="width:${Math.min(100, (p.stock || 0) / Math.max(1, (p.stock || 0) + 10) * 100)}%"></div></div>
          <div style="font-size:12px;color:${p.stock <= (p.stockMin || 5) ? '#e03131' : '#868e96'};">Stock: ${p.stock || 0}${p.unidad ? ' ' + p.unidad : ''}</div>
          <div class="inv-acciones" style="margin-top:8px;">
            <button class="btn-sm gris" onclick="editarProducto('${p.id}')" style="padding:6px 10px;font-size:12px;"><i class="fas fa-edit"></i></button>
            <button class="btn-sm" onclick="eliminarProducto('${p.id}')" style="padding:6px 10px;font-size:12px;background:#ffe3e3;color:#e03131;"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      </div>`).join('')}</div>`;
  } else {
    area.innerHTML = `<div class="full-table-wrap"><table class="inv-tabla">
      <thead><tr><th>Imagen</th><th>Nombre</th><th>Código</th><th>Categoría</th><th>Precio Venta</th><th>Costo</th><th>Stock</th><th>Acciones</th></tr></thead>
      <tbody>${prods.map(p => `<tr>
        <td>${p.imagen ? `<img src="${p.imagen}" class="inv-thumb" onerror="this.outerHTML='📦'">` : '📦'}</td>
        <td style="font-weight:700;">${p.nombre}</td>
        <td style="font-family:var(--font-mono);font-size:11px;">${p.codigoBarras || '-'}</td>
        <td>${p.categoriaNombre || '-'}</td>
        <td style="font-family:var(--font-mono);color:#00b341;font-weight:700;">${fmt(p.precio)}</td>
        <td style="font-family:var(--font-mono);">${p.costo ? fmt(p.costo) : '-'}</td>
        <td style="color:${p.stock <= (p.stockMin || 5) ? '#e03131' : 'inherit'};font-weight:700;">${p.stock || 0}</td>
        <td>
          <button class="btn-sm gris" onclick="editarProducto('${p.id}')" style="padding:6px 10px;font-size:12px;"><i class="fas fa-edit"></i></button>
          <button class="btn-sm" onclick="eliminarProducto('${p.id}')" style="padding:6px 10px;font-size:12px;background:#ffe3e3;color:#e03131;margin-left:4px;"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }
}

window.filtrarInventario = () => renderInventario();

window.toggleInvView = () => {
  state.invViewGrid = !state.invViewGrid;
  document.getElementById('btn-inv-view').innerHTML = state.invViewGrid
    ? '<i class="fas fa-list"></i> Lista'
    : '<i class="fas fa-th"></i> Cuadrícula';
  renderInventario();
};

// ── Categoría modal ───────────────────────────────────────
window.abrirModalCategoria = () => {
  document.getElementById('cat-nombre').value       = '';
  document.getElementById('cat-emoji').value        = '';
  document.getElementById('cat-img-preview').src    = '';
  document.getElementById('cat-img-preview').style.display = 'none';
  abrirModal('modal-categoria');
};

window.guardarCategoria = async () => {
  const nombre = document.getElementById('cat-nombre').value.trim();
  const emoji  = document.getElementById('cat-emoji').value.trim() || '📦';
  if (!nombre) { toast('Ingresa el nombre de la categoría', 'error'); return; }

  let imagen = '';
  const preview = document.getElementById('cat-img-preview');
  if (preview.src && preview.src !== window.location.href && preview.style.display !== 'none') {
    imagen = await subirImagenBase64(preview.src, `cats/${state.negocioId}/${Date.now()}`);
  }

  try {
    await addDoc(collection(db, 'negocios', state.negocioId, 'categorias'), { nombre, emoji, imagen, creadoEn: serverTimestamp() });
    cerrarModal('modal-categoria');
    toast('Categoría creada', 'success');
  } catch (e) { toast('Error: ' + e.message, 'error'); }
};

// ── Producto modal ────────────────────────────────────────
window.abrirModalProducto = () => {
  state.productoEnEdicion = null;
  document.getElementById('modal-prod-titulo').innerHTML = '<i class="fas fa-box" style="color:#00b341;"></i> Nuevo Producto';
  ['prod-nombre','prod-barcode','prod-precio','prod-costo','prod-stock','prod-stock-min'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('prod-id').value            = '';
  document.getElementById('prod-img-preview').src     = '';
  document.getElementById('prod-img-preview').style.display = 'none';
  document.getElementById('prod-unidad').value        = 'Unidad';
  document.getElementById('prod-itbis').value         = '1';
  populateCatSelects();
  abrirModal('modal-producto');
};

window.editarProducto = (id) => {
  const p = state.productos.find(pr => pr.id === id);
  if (!p) return;
  state.productoEnEdicion = p;
  document.getElementById('modal-prod-titulo').innerHTML = '<i class="fas fa-edit" style="color:#1971c2;"></i> Editar Producto';
  document.getElementById('prod-id').value        = p.id;
  document.getElementById('prod-nombre').value    = p.nombre    || '';
  document.getElementById('prod-barcode').value   = p.codigoBarras || '';
  document.getElementById('prod-precio').value    = p.precio    || '';
  document.getElementById('prod-costo').value     = p.costo     || '';
  document.getElementById('prod-stock').value     = p.stock     || '';
  document.getElementById('prod-stock-min').value = p.stockMin  || '';
  document.getElementById('prod-unidad').value    = p.unidad    || 'Unidad';
  document.getElementById('prod-itbis').value     = p.itbis !== false ? '1' : '0';
  populateCatSelects();
  document.getElementById('prod-categoria').value = p.categoriaId || '';
  if (p.imagen) {
    document.getElementById('prod-img-preview').src          = p.imagen;
    document.getElementById('prod-img-preview').style.display = 'block';
  }
  abrirModal('modal-producto');
};

window.guardarProducto = async () => {
  const nombre = document.getElementById('prod-nombre').value.trim();
  const precio = parseFloat(document.getElementById('prod-precio').value);
  const catId  = document.getElementById('prod-categoria').value;
  if (!nombre || isNaN(precio) || !catId) { toast('Nombre, precio y categoría son requeridos', 'error'); return; }

  const data = {
    nombre, precio,
    costo:        parseFloat(document.getElementById('prod-costo').value)    || 0,
    stock:        parseInt(document.getElementById('prod-stock').value)       || 0,
    stockMin:     parseInt(document.getElementById('prod-stock-min').value)   || 5,
    codigoBarras: document.getElementById('prod-barcode').value.trim(),
    unidad:       document.getElementById('prod-unidad').value,
    itbis:        document.getElementById('prod-itbis').value === '1',
    categoriaId:  catId,
    actualizadoEn: serverTimestamp()
  };

  const preview = document.getElementById('prod-img-preview');
  if (preview.src && !preview.src.startsWith('http') && preview.style.display !== 'none') {
    data.imagen = await subirImagenBase64(preview.src, `prods/${state.negocioId}/${Date.now()}`);
  } else if (state.productoEnEdicion?.imagen) {
    data.imagen = state.productoEnEdicion.imagen;
  }

  try {
    const prodId = document.getElementById('prod-id').value;
    if (prodId) {
      await updateDoc(doc(db, 'negocios', state.negocioId, 'categorias', catId, 'productos', prodId), data);
      if (state.productoEnEdicion?.categoriaId !== catId) {
        await deleteDoc(doc(db, 'negocios', state.negocioId, 'categorias', state.productoEnEdicion.categoriaId, 'productos', prodId));
      }
      toast('Producto actualizado', 'success');
    } else {
      data.creadoEn = serverTimestamp();
      await addDoc(collection(db, 'negocios', state.negocioId, 'categorias', catId, 'productos'), data);
      toast('Producto creado', 'success');
    }
    cerrarModal('modal-producto');
    await cargarTodosProductos();
    renderInventario();
  } catch (e) { toast('Error: ' + e.message, 'error'); }
};

window.eliminarProducto = async (id) => {
  if (!confirm('¿Eliminar este producto?')) return;
  const p = state.productos.find(pr => pr.id === id);
  if (!p) return;
  try {
    await deleteDoc(doc(db, 'negocios', state.negocioId, 'categorias', p.categoriaId, 'productos', id));
    toast('Producto eliminado', 'success');
    await cargarTodosProductos();
    renderInventario();
  } catch (e) { toast('Error: ' + e.message, 'error'); }
};

// ── Imágenes ──────────────────────────────────────────────
window.previewImagen = (input) => {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const prev = document.getElementById('prod-img-preview');
    prev.src = e.target.result; prev.style.display = 'block';
  };
  reader.readAsDataURL(file);
};

window.previewCatImagen = (input) => {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const prev = document.getElementById('cat-img-preview');
    prev.src = e.target.result; prev.style.display = 'block';
  };
  reader.readAsDataURL(file);
};

window.escanearBarcodeProducto = () => {
  const val = prompt('Ingresa el código de barras:');
  if (val) document.getElementById('prod-barcode').value = val;
};

export async function subirImagenBase64(dataUrl, path) {
  try {
    const imgRef = ref(storage, path);
    await uploadString(imgRef, dataUrl, 'data_url');
    return await getDownloadURL(imgRef);
  } catch (e) {
    console.warn('Error subiendo imagen:', e);
    return dataUrl;
  }
}
