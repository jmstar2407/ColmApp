import { db, storage } from '../firebase-config.js';
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { AppState, fmt, toast, openModal, closeModal } from '../utils/helpers.js';

let initialized = false;
let invViewGrid = true;

export async function initInventario(state) {
  if (initialized) return;
  initialized = true;
  
  document.getElementById('btn-nueva-categoria')?.addEventListener('click', abrirModalCategoria);
  document.getElementById('btn-nuevo-producto')?.addEventListener('click', abrirModalProducto);
  document.getElementById('inv-buscar')?.addEventListener('input', () => renderInventario());
  document.getElementById('inv-cat-filtro')?.addEventListener('change', () => renderInventario());
  document.getElementById('btn-toggle-view')?.addEventListener('click', toggleView);
  
  renderInventario();
  updateCatSelect();
}

function updateCatSelect() {
  const sel = document.getElementById('inv-cat-filtro');
  if (!sel) return;
  sel.innerHTML = '<option value="">Todas las categorías</option>' + 
    AppState.categorias.map(c => `<option value="${c.id}">${c.emoji || '📦'} ${c.nombre}</option>`).join('');
}

function renderInventario() {
  const area = document.getElementById('inv-contenido');
  if (!area) return;
  const buscar = document.getElementById('inv-buscar')?.value.toLowerCase() || '';
  const catFiltro = document.getElementById('inv-cat-filtro')?.value || '';
  
  let prods = AppState.productos.filter(p => {
    if (buscar && !p.nombre?.toLowerCase().includes(buscar)) return false;
    if (catFiltro && p.categoriaId !== catFiltro) return false;
    return true;
  });
  
  if (invViewGrid) {
    area.innerHTML = `<div class="inv-grid">${prods.map(p => `
      <div class="inv-card">
        <div class="inv-emoji">📦</div>
        <div class="inv-body">
          <div class="inv-nombre">${p.nombre}</div>
          <div class="inv-precio-venta">${fmt(p.precio)}</div>
          <div class="inv-stock-bar"><div class="inv-stock-fill ${(p.stock || 0) <= (p.stockMin || 5) ? 'bajo' : ''}" style="width:${Math.min(100, ((p.stock || 0) / Math.max(1, p.stock + 10)) * 100)}%"></div></div>
          <div>Stock: ${p.stock || 0}</div>
          <div class="inv-acciones"><button class="btn-sm gris editar-prod" data-id="${p.id}">Editar</button> <button class="btn-sm rojo eliminar-prod" data-id="${p.id}">Eliminar</button></div>
        </div>
      </div>
    `).join('') || '<div class="empty-state">Sin productos</div>'}</div>`;
  } else {
    area.innerHTML = `<table class="facturas-tabla"><thead><tr><th>Nombre</th><th>Precio</th><th>Stock</th><th>Acciones</th></tr></thead><tbody>${prods.map(p => `
      <tr><td>${p.nombre}</td><td>${fmt(p.precio)}</td><td>${p.stock || 0}</td><td><button class="btn-sm gris editar-prod" data-id="${p.id}">Editar</button> <button class="btn-sm rojo eliminar-prod" data-id="${p.id}">Eliminar</button></td></tr>
    `).join('')}</tbody></table>`;
  }
  
  document.querySelectorAll('.editar-prod').forEach(btn => {
    btn.addEventListener('click', () => editarProducto(btn.dataset.id));
  });
  document.querySelectorAll('.eliminar-prod').forEach(btn => {
    btn.addEventListener('click', () => eliminarProducto(btn.dataset.id));
  });
}

function toggleView() {
  invViewGrid = !invViewGrid;
  document.getElementById('btn-toggle-view').innerHTML = invViewGrid ? '<i class="fas fa-list"></i> Lista' : '<i class="fas fa-th"></i> Cuadrícula';
  renderInventario();
}

function abrirModalCategoria() {
  const bodyHtml = `<div class="form-group"><label>Nombre</label><input type="text" id="cat-nombre"></div><div class="form-group"><label>Emoji</label><input type="text" id="cat-emoji" placeholder="📦"></div>`;
  openModal('Nueva Categoría', bodyHtml, async () => {
    const nombre = document.getElementById('cat-nombre').value.trim();
    const emoji = document.getElementById('cat-emoji').value.trim() || '📦';
    if (!nombre) { toast('Ingrese nombre', 'error'); return; }
    await addDoc(collection(db, 'negocios', AppState.negocioId, 'categorias'), { nombre, emoji, creadoEn: serverTimestamp() });
    toast('Categoría creada', 'success');
  }, 'Guardar');
}

function abrirModalProducto() {
  updateCatSelect();
  const bodyHtml = `
    <div class="form-group"><label>Nombre</label><input type="text" id="prod-nombre"></div>
    <div class="form-group"><label>Categoría</label><select id="prod-categoria">${AppState.categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}</select></div>
    <div class="form-group"><label>Precio (RD$)</label><input type="number" id="prod-precio" step="0.01"></div>
    <div class="form-group"><label>Stock</label><input type="number" id="prod-stock"></div>
    <div class="form-group"><label>Código Barras</label><input type="text" id="prod-barcode"></div>
    <input type="hidden" id="prod-id">
  `;
  openModal('Nuevo Producto', bodyHtml, async () => {
    const nombre = document.getElementById('prod-nombre').value.trim();
    const precio = parseFloat(document.getElementById('prod-precio').value);
    const catId = document.getElementById('prod-categoria').value;
    const stock = parseInt(document.getElementById('prod-stock').value) || 0;
    const codigoBarras = document.getElementById('prod-barcode').value;
    if (!nombre || isNaN(precio) || !catId) { toast('Complete campos requeridos', 'error'); return; }
    await addDoc(collection(db, 'negocios', AppState.negocioId, 'categorias', catId, 'productos'), {
      nombre, precio, stock, codigoBarras, creadoEn: serverTimestamp(), itbis: true
    });
    toast('Producto creado', 'success');
    loadAllProducts();
  }, 'Guardar');
}

function editarProducto(id) {
  const p = AppState.productos.find(p => p.id === id);
  if (!p) return;
  updateCatSelect();
  const bodyHtml = `
    <div class="form-group"><label>Nombre</label><input type="text" id="prod-nombre" value="${p.nombre}"></div>
    <div class="form-group"><label>Categoría</label><select id="prod-categoria">${AppState.categorias.map(c => `<option value="${c.id}" ${c.id === p.categoriaId ? 'selected' : ''}>${c.nombre}</option>`).join('')}</select></div>
    <div class="form-group"><label>Precio (RD$)</label><input type="number" id="prod-precio" value="${p.precio}" step="0.01"></div>
    <div class="form-group"><label>Stock</label><input type="number" id="prod-stock" value="${p.stock || 0}"></div>
    <div class="form-group"><label>Código Barras</label><input type="text" id="prod-barcode" value="${p.codigoBarras || ''}"></div>
    <input type="hidden" id="prod-id" value="${p.id}">
  `;
  openModal('Editar Producto', bodyHtml, async () => {
    const nombre = document.getElementById('prod-nombre').value.trim();
    const precio = parseFloat(document.getElementById('prod-precio').value);
    const catId = document.getElementById('prod-categoria').value;
    const stock = parseInt(document.getElementById('prod-stock').value) || 0;
    const codigoBarras = document.getElementById('prod-barcode').value;
    if (!nombre || isNaN(precio) || !catId) { toast('Complete campos', 'error'); return; }
    await updateDoc(doc(db, 'negocios', AppState.negocioId, 'categorias', p.categoriaId, 'productos', id), {
      nombre, precio, stock, codigoBarras
    });
    toast('Producto actualizado', 'success');
    loadAllProducts();
  }, 'Guardar');
}

async function eliminarProducto(id) {
  if (!confirm('¿Eliminar producto?')) return;
  const p = AppState.productos.find(p => p.id === id);
  if (!p) return;
  await deleteDoc(doc(db, 'negocios', AppState.negocioId, 'categorias', p.categoriaId, 'productos', id));
  toast('Producto eliminado', 'success');
  loadAllProducts();
}

async function loadAllProducts() {
  AppState.productos = [];
  for (const cat of AppState.categorias) {
    const snap = await getDocs(collection(db, 'negocios', AppState.negocioId, 'categorias', cat.id, 'productos'));
    snap.docs.forEach(d => {
      AppState.productos.push({ id: d.id, categoriaId: cat.id, ...d.data() });
    });
  }
  renderInventario();
}