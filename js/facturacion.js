// ============================================================
// facturacion.js — POS: carrito, facturar, ticket
// ============================================================
import { db, state, fmt, toast, abrirModal, cerrarModal, getEmpNombre } from "./app.js";
import {
  collection, doc, addDoc, updateDoc, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export function initFacturacion() {
  // Exponer funciones globales
  window.agregarAlCarrito  = agregarAlCarrito;
  window.cambiarQty        = cambiarQty;
  window.limpiarCarrito    = limpiarCarrito;
  window.abrirModalFacturar = abrirModalFacturar;
  window.seleccionarMetodo = seleccionarMetodo;
  window.setEstadoFactura  = setEstadoFactura;
  window.calcularCambio    = calcularCambio;
  window.tecNumero         = tecNumero;
  window.confirmarFactura  = confirmarFactura;
  window.imprimirTicket    = imprimirTicket;
  window.imprimirFacturaActual = imprimirFacturaActual;
  window.nuevaVenta        = nuevaVenta;
}
initFacturacion();

// ── Carrito ───────────────────────────────────────────────
window.agregarAlCarrito = function agregarAlCarrito(prodId) {
  if (!state.cajaActual) { toast('⚠️ La caja no está abierta', 'error'); return; }
  const prod = state.productos.find(p => p.id === prodId);
  if (!prod) return;
  if (prod.stock <= 0) { toast('Sin stock disponible', 'error'); return; }
  agregarAlCarritoObj(prod);
};

export function agregarAlCarritoObj(prod) {
  const idx = state.carrito.findIndex(i => i.id === prod.id);
  if (idx >= 0) {
    if (state.carrito[idx].qty >= prod.stock) { toast('No hay más stock disponible', 'error'); return; }
    state.carrito[idx].qty++;
  } else {
    state.carrito.push({ ...prod, qty: 1 });
  }
  renderCarrito();
  toast(`"${prod.nombre}" agregado`, 'success');
}

window.cambiarQty = function cambiarQty(prodId, delta) {
  const idx = state.carrito.findIndex(i => i.id === prodId);
  if (idx < 0) return;
  state.carrito[idx].qty += delta;
  if (state.carrito[idx].qty <= 0) state.carrito.splice(idx, 1);
  renderCarrito();
};

window.limpiarCarrito = function limpiarCarrito() {
  state.carrito = [];
  renderCarrito();
};

function renderCarrito() {
  const items   = document.getElementById('carrito-items');
  const count   = document.getElementById('carrito-count');
  const totalQty = state.carrito.reduce((s, i) => s + i.qty, 0);
  count.textContent = totalQty;

  items.innerHTML = !state.carrito.length
    ? `<div class="carrito-empty"><i class="fas fa-shopping-cart"></i><p>Agrega productos al carrito</p></div>`
    : state.carrito.map(item => `
      <div class="carrito-item">
        ${item.imagen ? `<img src="${item.imagen}" alt="${item.nombre}" onerror="this.outerHTML='<div class=&quot;item-emoji&quot;>📦</div>'">` : `<div class="item-emoji">📦</div>`}
        <div class="item-info">
          <div class="item-nombre">${item.nombre}</div>
          <div class="item-precio">${fmt(item.precio)} c/u</div>
          <div><span class="item-subtotal">${fmt(item.precio * item.qty)}</span></div>
        </div>
        <div class="item-ctrl">
          <button class="qty-btn minus" onclick="cambiarQty('${item.id}', -1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn plus" onclick="cambiarQty('${item.id}', 1)">+</button>
        </div>
      </div>`).join('');

  const subtotal     = state.carrito.reduce((s, i) => s + i.precio * i.qty, 0);
  const itbisPct     = state.config.itbisPct || 18;
  const itbisCliente = state.config.itbisCliente !== false;
  const itbis        = itbisCliente ? subtotal * (itbisPct / 100) : 0;

  document.getElementById('cart-subtotal').textContent    = fmt(subtotal);
  document.getElementById('cart-itbis-label').textContent = `ITBIS (${itbisPct}%)${!itbisCliente ? ' (asumido)' : ''}`;
  document.getElementById('cart-itbis').textContent       = fmt(itbis);
  document.getElementById('cart-total').textContent       = fmt(subtotal + itbis);
}

// ── Modal Facturar ────────────────────────────────────────
window.abrirModalFacturar = function abrirModalFacturar() {
  if (!state.carrito.length)  { toast('El carrito está vacío', 'error');     return; }
  if (!state.cajaActual)      { toast('La caja no está abierta', 'error');   return; }

  const subtotal     = state.carrito.reduce((s, i) => s + i.precio * i.qty, 0);
  const itbisPct     = state.config.itbisPct || 18;
  const itbisCliente = state.config.itbisCliente !== false;
  const itbis        = itbisCliente ? subtotal * (itbisPct / 100) : 0;

  document.getElementById('factura-items-lista').innerHTML = state.carrito.map(item =>
    `<div class="factura-item-row">
      <span class="fi-nombre">${item.nombre}</span>
      <span class="fi-qty">x${item.qty}</span>
      <span class="fi-precio">${fmt(item.precio * item.qty)}</span>
    </div>`).join('');

  document.getElementById('mfact-subtotal').textContent       = fmt(subtotal);
  document.getElementById('mfact-itbis-lbl').textContent      = `ITBIS (${itbisPct}%)${!itbisCliente ? ' (asumido)' : ''}`;
  document.getElementById('mfact-itbis').textContent          = fmt(itbis);
  document.getElementById('mfact-total').textContent          = fmt(subtotal + itbis);
  document.getElementById('monto-recibido').value             = '';
  document.getElementById('cambio-display').style.display     = 'none';

  const sel   = document.getElementById('fact-empleado');
  sel.innerHTML = state.empleadosCache.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
  const myEmp = state.empleadosCache.find(e => e.uid === state.currentUser.uid);
  if (myEmp) sel.value = myEmp.id;

  seleccionarMetodo('efectivo');
  setEstadoFactura('pagada');
  abrirModal('modal-facturar');
};

window.seleccionarMetodo = function seleccionarMetodo(metodo) {
  state.metodoPagoSeleccionado = metodo;
  const metodos = ['efectivo', 'transferencia', 'tarjeta'];
  document.querySelectorAll('.mpago-btn').forEach((b, i) => b.classList.toggle('selected', metodos[i] === metodo));
  document.getElementById('efectivo-section').classList.toggle('visible', metodo === 'efectivo');
};

window.setEstadoFactura = function setEstadoFactura(estado) {
  state.estadoFacturaSeleccionado = estado;
  document.getElementById('btn-estado-pagada').classList.toggle('selected', estado === 'pagada');
  document.getElementById('btn-estado-pendiente').classList.toggle('selected', estado === 'pendiente');
};

window.calcularCambio = function calcularCambio() {
  const subtotal     = state.carrito.reduce((s, i) => s + i.precio * i.qty, 0);
  const itbisPct     = state.config.itbisPct || 18;
  const itbisCliente = state.config.itbisCliente !== false;
  const total        = subtotal * (1 + (itbisCliente ? itbisPct / 100 : 0));
  const recibido     = parseFloat(document.getElementById('monto-recibido').value) || 0;
  const cambio       = recibido - total;
  const disp         = document.getElementById('cambio-display');
  if (recibido > 0) {
    disp.style.display    = 'flex';
    document.getElementById('cambio-valor').textContent = fmt(Math.max(0, cambio));
    disp.style.background = cambio >= 0 ? '#d4edda' : '#f8d7da';
  } else {
    disp.style.display = 'none';
  }
};

window.tecNumero = function tecNumero(val) {
  const inp = document.getElementById('monto-recibido');
  if      (val === 'C')  inp.value = '';
  else if (val === '⌫') inp.value = inp.value.slice(0, -1);
  else if (val === 'OK') { calcularCambio(); return; }
  else                   inp.value += val;
  calcularCambio();
};

// ── Confirmar factura ─────────────────────────────────────
window.confirmarFactura = async function confirmarFactura() {
  const btn = document.getElementById('btn-confirmar-factura');
  btn.innerHTML = '<span class="loader"></span> Procesando...';
  btn.disabled  = true;

  try {
    const subtotal     = state.carrito.reduce((s, i) => s + i.precio * i.qty, 0);
    const itbisPct     = state.config.itbisPct || 18;
    const itbisCliente = state.config.itbisCliente !== false;
    const itbis        = itbisCliente ? subtotal * (itbisPct / 100) : 0;
    const total        = subtotal + itbis;

    const empId      = document.getElementById('fact-empleado').value;
    const empNombre  = state.empleadosCache.find(e => e.id === empId)?.nombre || await getEmpNombre();
    const ncfSeq     = state.config.ncfSeq || 1;
    const ncf        = `${state.config.ncfPrefijo || 'B01'}${String(ncfSeq).padStart(8, '0')}`;
    const numFactura = `F-${Date.now()}`;

    const facturaData = {
      numero: numFactura, ncf, fecha: serverTimestamp(),
      items: state.carrito.map(i => ({ id: i.id, nombre: i.nombre, precio: i.precio, qty: i.qty, subtotal: i.precio * i.qty })),
      subtotal, itbis, itbisPct, total,
      metodoPago:    state.metodoPagoSeleccionado,
      montoRecibido: parseFloat(document.getElementById('monto-recibido').value) || total,
      estado:        state.estadoFacturaSeleccionado,
      empleadoId:    empId, empleadoNombre: empNombre,
      cajaId:        state.cajaActual.id, uid: state.currentUser.uid
    };

    const factRef = await addDoc(collection(db, 'negocios', state.negocioId, 'facturas'), facturaData);

    if (state.estadoFacturaSeleccionado === 'pagada') {
      await addDoc(collection(db, 'negocios', state.negocioId, 'movimientos'), {
        tipo: 'ingreso', descripcion: `Venta ${numFactura}`, monto: total,
        fecha: serverTimestamp(), uid: state.currentUser.uid, empleadoNombre: empNombre,
        facturaId: factRef.id, cajaId: state.cajaActual.id
      });
      await updateDoc(doc(db, 'negocios', state.negocioId, 'caja', state.cajaActual.id), {
        ingresos: (state.cajaActual.ingresos || 0) + total
      });
    }

    await updateDoc(doc(db, 'negocios', state.negocioId, 'configuraciones', 'general'), { ncfSeq: ncfSeq + 1 });
    state.config.ncfSeq = ncfSeq + 1;

    const batch = writeBatch(db);
    for (const item of state.carrito) {
      batch.update(doc(db, 'negocios', state.negocioId, 'categorias', item.categoriaId, 'productos', item.id), {
        stock: (item.stock || 0) - item.qty
      });
      const pi = state.productos.findIndex(p => p.id === item.id);
      if (pi >= 0) state.productos[pi].stock -= item.qty;
    }
    await batch.commit();
    localStorage.setItem(`prods_${state.negocioId}`, JSON.stringify(state.productos));

    cerrarModal('modal-facturar');
    state.facturaActualParaImprimir = { ...facturaData, id: factRef.id };
    mostrarTicket(state.facturaActualParaImprimir);
    toast('Factura generada exitosamente ✅', 'success');
  } catch (e) {
    toast('Error al procesar: ' + e.message, 'error');
    console.error(e);
  }

  btn.innerHTML = '<i class="fas fa-check"></i> Confirmar Factura';
  btn.disabled  = false;
};

// ── Ticket ────────────────────────────────────────────────
function mostrarTicket(factura) {
  document.getElementById('modal-ticket-body').innerHTML = generarHTMLTicket(factura);
  abrirModal('modal-ticket');
}

export function generarHTMLTicket(factura) {
  const fecha = factura.fecha?.toDate ? factura.fecha.toDate() : new Date();
  return `<div class="ticket">
    <div class="ticket-header">
      <div style="font-size:16px;font-weight:800;">${state.negocioData?.nombre || 'Colmado'}</div>
      <div>${state.negocioData?.direccion || ''}</div>
      <div>${state.negocioData?.telefono  || ''}</div>
      ${state.negocioData?.rnc ? `<div>RNC: ${state.negocioData.rnc}</div>` : ''}
      <div style="margin-top:6px;">━━━━━━━━━━━━━━━━━━━━━━</div>
      <div>Factura: ${factura.numero}</div>
      ${factura.ncf ? `<div>NCF: ${factura.ncf}</div>` : ''}
      <div>${fecha.toLocaleString('es-DO')}</div>
      <div>Empleado: ${factura.empleadoNombre || '-'}</div>
    </div>
    <div>
      ${(factura.items || []).map(i =>
        `<div class="ticket-row"><span>${i.nombre} x${i.qty}</span><span>${fmt(i.subtotal)}</span></div>`
      ).join('')}
    </div>
    <div class="ticket-total">
      <div class="ticket-row"><span>Subtotal</span><span>${fmt(factura.subtotal)}</span></div>
      <div class="ticket-row"><span>ITBIS (${factura.itbisPct}%)</span><span>${fmt(factura.itbis)}</span></div>
      <div class="ticket-row" style="font-size:16px;"><span>TOTAL</span><span>${fmt(factura.total)}</span></div>
      <div class="ticket-row"><span>Método</span><span>${factura.metodoPago}</span></div>
      ${factura.metodoPago === 'efectivo'
        ? `<div class="ticket-row"><span>Recibido</span><span>${fmt(factura.montoRecibido)}</span></div>
           <div class="ticket-row"><span>Cambio</span><span>${fmt(Math.max(0, (factura.montoRecibido || 0) - factura.total))}</span></div>`
        : ''}
    </div>
    <div style="text-align:center;margin-top:12px;font-size:11px;">
      ¡Gracias por su compra!<br>Estado: <strong>${factura.estado === 'pagada' ? '✅ PAGADA' : '⏳ PENDIENTE'}</strong>
    </div>
  </div>`;
}

const printStyle = `body{font-family:monospace;font-size:12px;max-width:300px;margin:0 auto;}
  .ticket-row{display:flex;justify-content:space-between;margin-bottom:4px;}
  .ticket-header{text-align:center;border-bottom:1px dashed #ccc;padding-bottom:8px;margin-bottom:8px;}
  .ticket-total{border-top:1px dashed #ccc;padding-top:6px;margin-top:6px;font-weight:700;}`;

window.imprimirTicket = function imprimirTicket() {
  const content = document.getElementById('modal-ticket-body').innerHTML;
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>Ticket</title><style>${printStyle}</style></head><body>${content}<script>window.print();window.close();<\/script></body></html>`);
  w.document.close();
};

window.imprimirFacturaActual = function imprimirFacturaActual() {
  const content = document.getElementById('modal-ver-factura-body').innerHTML;
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>Factura</title><style>${printStyle}</style></head><body>${content}<script>window.print();window.close();<\/script></body></html>`);
  w.document.close();
};

window.nuevaVenta = function nuevaVenta() {
  state.carrito = [];
  renderCarrito();
  cerrarModal('modal-ticket');
  state.categoriaActual = null;
  import('./inventario.js').then(m => m.renderCategoriasPos());
};
