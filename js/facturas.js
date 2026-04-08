// ============================================================
// facturas.js — Página de facturas generadas
// ============================================================
import { db, state, fmt, toast, abrirModal, getEmpNombre } from "./app.js";
import { generarHTMLTicket } from "./facturacion.js";
import {
  collection, doc, addDoc, updateDoc, getDocs,
  query, orderBy, limit, serverTimestamp, where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function cargarFacturas() {
  const tbody = document.getElementById('tbody-facturas');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--gris-suave);"><i class="fas fa-spinner fa-spin"></i> Cargando facturas...</td></tr>`;

  try {
    let snap;
    try {
      // Intenta con orderBy (requiere índice en Firestore)
      const q = query(
        collection(db, 'negocios', state.negocioId, 'facturas'),
        orderBy('fecha', 'desc'),
        limit(100)
      );
      snap = await getDocs(q);
    } catch (indexErr) {
      // Si falla por índice faltante, trae sin orden y ordena en cliente
      console.warn('Índice no disponible, cargando sin orderBy:', indexErr.message);
      const qFallback = query(
        collection(db, 'negocios', state.negocioId, 'facturas'),
        limit(100)
      );
      snap = await getDocs(qFallback);
    }

    state.facturasCache = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const fa = a.fecha?.toDate ? a.fecha.toDate() : new Date(0);
        const fb = b.fecha?.toDate ? b.fecha.toDate() : new Date(0);
        return fb - fa;
      });

    renderTablaFacturas(state.facturasCache);
  } catch (e) {
    console.error('Error cargando facturas:', e);
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fas fa-exclamation-triangle" style="color:#e03131;"></i><p>Error al cargar facturas: ${e.message}</p></div></td></tr>`;
    toast('Error al cargar facturas: ' + e.message, 'error');
  }
}

function renderTablaFacturas(facturas) {
  const tbody = document.getElementById('tbody-facturas');
  if (!tbody) return;

  if (!facturas.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fas fa-file-invoice"></i><p>Sin facturas</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = facturas.map(f => {
    const fecha = f.fecha?.toDate ? f.fecha.toDate().toLocaleString('es-DO') : '-';
    return `<tr>
      <td style="font-family:var(--font-mono);font-weight:700;">${f.numero || '-'}</td>
      <td style="font-family:var(--font-mono);font-size:11px;">${f.ncf || '-'}</td>
      <td>${fecha}</td>
      <td>${f.empleadoNombre || '-'}</td>
      <td>${f.metodoPago || '-'}</td>
      <td style="font-family:var(--font-mono);font-weight:700;">${fmt(f.total)}</td>
      <td><span class="badge ${f.estado}">${f.estado === 'pagada' ? '✅ Pagada' : '⏳ Pendiente'}</span></td>
      <td>
        <button class="btn-sm gris" onclick="verFactura('${f.id}')" style="padding:6px 10px;font-size:12px;"><i class="fas fa-eye"></i></button>
        ${f.estado === 'pendiente'
          ? `<button class="btn-sm verde" onclick="marcarPagada('${f.id}')" style="padding:6px 10px;font-size:12px;margin-left:4px;"><i class="fas fa-check"></i> Pagar</button>`
          : ''}
      </td>
    </tr>`;
  }).join('');
}

window.filtrarFacturas = () => {
  const buscar   = document.getElementById('fact-buscar').value.toLowerCase();
  const estado   = document.getElementById('fact-estado').value;
  const metodo   = document.getElementById('fact-metodo').value;
  const fechaIni = document.getElementById('fact-fecha-ini').value;
  const fechaFin = document.getElementById('fact-fecha-fin').value;

  renderTablaFacturas(state.facturasCache.filter(f => {
    if (buscar  && !f.numero?.toLowerCase().includes(buscar))   return false;
    if (estado  && f.estado     !== estado)                     return false;
    if (metodo  && f.metodoPago !== metodo)                     return false;
    if (fechaIni || fechaFin) {
      const fecha = f.fecha?.toDate ? f.fecha.toDate() : null;
      if (!fecha) return false;
      if (fechaIni && fecha < new Date(fechaIni))               return false;
      if (fechaFin && fecha > new Date(fechaFin + 'T23:59:59')) return false;
    }
    return true;
  }));
};

window.limpiarFiltrosFacturas = () => {
  ['fact-buscar', 'fact-fecha-ini', 'fact-fecha-fin'].forEach(id => document.getElementById(id).value = '');
  ['fact-estado', 'fact-metodo'].forEach(id => document.getElementById(id).value = '');
  renderTablaFacturas(state.facturasCache);
};

window.verFactura = (id) => {
  const f = state.facturasCache.find(f => f.id === id);
  if (!f) return;
  document.getElementById('modal-ver-factura-body').innerHTML = generarHTMLTicket(f);
  abrirModal('modal-ver-factura');
};

window.marcarPagada = async (id) => {
  try {
    await updateDoc(doc(db, 'negocios', state.negocioId, 'facturas', id), { estado: 'pagada' });
    const f = state.facturasCache.find(f => f.id === id);
    if (f && state.cajaActual) {
      await addDoc(collection(db, 'negocios', state.negocioId, 'movimientos'), {
        tipo: 'ingreso', descripcion: `Pago factura ${f.numero}`, monto: f.total,
        fecha: serverTimestamp(), uid: state.currentUser.uid,
        empleadoNombre: await getEmpNombre(),
        facturaId: id, cajaId: state.cajaActual.id
      });
      await updateDoc(doc(db, 'negocios', state.negocioId, 'caja', state.cajaActual.id), {
        ingresos: (state.cajaActual.ingresos || 0) + f.total
      });
    }
    toast('Factura marcada como pagada', 'success');
    await cargarFacturas();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
};