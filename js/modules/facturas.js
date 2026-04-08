import { db } from '../firebase-config.js';
import { collection, getDocs, query, orderBy, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { AppState, fmt, toast, openModal, closeModal, on } from '../utils/helpers.js';

let initialized = false;

export async function initFacturas(state) {
  if (initialized) return;
  initialized = true;
  
  await cargarFacturas();
  
  document.getElementById('fact-buscar')?.addEventListener('input', () => filtrarFacturas());
  document.getElementById('fact-fecha-ini')?.addEventListener('change', () => filtrarFacturas());
  document.getElementById('fact-fecha-fin')?.addEventListener('change', () => filtrarFacturas());
  document.getElementById('fact-estado')?.addEventListener('change', () => filtrarFacturas());
  document.getElementById('fact-metodo')?.addEventListener('change', () => filtrarFacturas());
  document.getElementById('btn-limpiar-filtros')?.addEventListener('click', limpiarFiltros);
  
  on('factura:created', () => cargarFacturas());
}

async function cargarFacturas() {
  const q = query(collection(db, 'negocios', AppState.negocioId, 'facturas'), orderBy('fecha', 'desc'), limit(200));
  const snap = await getDocs(q);
  AppState.facturas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderFacturas(AppState.facturas);
}

function renderFacturas(facturas) {
  const tbody = document.getElementById('tbody-facturas');
  if (!tbody) return;
  if (!facturas.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Sin facturas</td></tr>';
    return;
  }
  tbody.innerHTML = facturas.map(f => {
    const fecha = f.fecha?.toDate?.()?.toLocaleString('es-DO') || '-';
    return `<tr>
      <td style="font-weight:700;">${f.numero || '-'}</td>
      <td>${f.ncf || '-'}</td>
      <td>${fecha}</td>
      <td>${f.empleadoNombre || '-'}</td>
      <td>${f.metodoPago || '-'}</td>
      <td style="font-weight:700;">${fmt(f.total)}</td>
      <td><span class="badge ${f.estado}">${f.estado === 'pagada' ? 'Pagada' : 'Pendiente'}</span></td>
      <td><button class="btn-sm gris ver-factura" data-id="${f.id}">Ver</button> ${f.estado === 'pendiente' ? `<button class="btn-sm verde pagar-factura" data-id="${f.id}">Pagar</button>` : ''}</td>
    </tr>`;
  }).join('');
  
  document.querySelectorAll('.ver-factura').forEach(btn => {
    btn.addEventListener('click', () => verFactura(btn.dataset.id));
  });
  document.querySelectorAll('.pagar-factura').forEach(btn => {
    btn.addEventListener('click', () => marcarPagada(btn.dataset.id));
  });
}

function filtrarFacturas() {
  const buscar = document.getElementById('fact-buscar').value.toLowerCase();
  const estado = document.getElementById('fact-estado').value;
  const metodo = document.getElementById('fact-metodo').value;
  const fechaIni = document.getElementById('fact-fecha-ini').value;
  const fechaFin = document.getElementById('fact-fecha-fin').value;
  
  let filtradas = AppState.facturas.filter(f => {
    if (buscar && !f.numero?.toLowerCase().includes(buscar)) return false;
    if (estado && f.estado !== estado) return false;
    if (metodo && f.metodoPago !== metodo) return false;
    if (fechaIni || fechaFin) {
      const fecha = f.fecha?.toDate?.();
      if (!fecha) return false;
      if (fechaIni && fecha < new Date(fechaIni)) return false;
      if (fechaFin && fecha > new Date(fechaFin + 'T23:59:59')) return false;
    }
    return true;
  });
  renderFacturas(filtradas);
}

function limpiarFiltros() {
  document.getElementById('fact-buscar').value = '';
  document.getElementById('fact-fecha-ini').value = '';
  document.getElementById('fact-fecha-fin').value = '';
  document.getElementById('fact-estado').value = '';
  document.getElementById('fact-metodo').value = '';
  renderFacturas(AppState.facturas);
}

function verFactura(id) {
  const f = AppState.facturas.find(f => f.id === id);
  if (!f) return;
  const fecha = f.fecha?.toDate?.()?.toLocaleString('es-DO') || '-';
  const itemsHtml = (f.items || []).map(i => `<div class="ticket-row"><span>${i.nombre} x${i.qty}</span><span>${fmt(i.subtotal)}</span></div>`).join('');
  const bodyHtml = `<div class="ticket"><div class="ticket-header"><strong>${AppState.negocioData?.nombre || 'Colmado'}</strong><br>Factura: ${f.numero}<br>NCF: ${f.ncf}<br>${fecha}</div>${itemsHtml}<div class="ticket-total"><div class="ticket-row"><span>Total</span><span>${fmt(f.total)}</span></div></div><div>Método: ${f.metodoPago}<br>Estado: ${f.estado}</div></div>`;
  openModal(`Factura ${f.numero}`, bodyHtml, null, 'Cerrar');
}

async function marcarPagada(id) {
  try {
    await updateDoc(doc(db, 'negocios', AppState.negocioId, 'facturas', id), { estado: 'pagada' });
    const f = AppState.facturas.find(f => f.id === id);
    if (f && AppState.cajaActual) {
      await addDoc(collection(db, 'negocios', AppState.negocioId, 'movimientos'), {
        tipo: 'ingreso', descripcion: `Pago factura ${f.numero}`, monto: f.total,
        fecha: serverTimestamp(), uid: AppState.currentUser?.uid,
        facturaId: id, cajaId: AppState.cajaActual.id
      });
      await updateDoc(doc(db, 'negocios', AppState.negocioId, 'caja', AppState.cajaActual.id), {
        ingresos: (AppState.cajaActual.ingresos || 0) + f.total
      });
    }
    toast('Factura pagada', 'success');
    await cargarFacturas();
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}