// ============================================================
// caja.js — Sistema de caja: apertura, cierre, gastos, movimientos
// ============================================================
import { db, state, fmt, toast, abrirModal, cerrarModal, getEmpNombre } from "./app.js";
import {
  collection, doc, addDoc, updateDoc, getDocs, query, where, orderBy, limit,
  onSnapshot, Timestamp, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export function suscribirCaja() {
  const q    = query(collection(db, 'negocios', state.negocioId, 'caja'), where('estado', '==', 'abierta'), limit(1));
  const unsub = onSnapshot(q, snap => {
    state.cajaActual = snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
    updateCajaBanner();
    renderCaja();
  });
  state.unsubscribers.push(unsub);
}

function updateCajaBanner() {
  document.getElementById('caja-pendiente-banner').classList.toggle('visible', !state.cajaActual);
}

// ── Render principal ──────────────────────────────────────
export function renderCaja() {
  const card = document.getElementById('caja-estado-card');
  if (!card) return;

  if (state.cajaActual) {
    const apertura = state.cajaActual.fechaApertura?.toDate
      ? state.cajaActual.fechaApertura.toDate().toLocaleString('es-DO') : 'Desconocida';
    const ingresos = state.cajaActual.ingresos || 0;
    const gastos   = state.cajaActual.gastos   || 0;
    const total    = (state.cajaActual.montoInicial || 0) + ingresos - gastos;
    card.innerHTML = `
      <div class="caja-estado-icon">🟢</div>
      <h2>Caja Abierta</h2>
      <p>Apertura: ${apertura} • Por: ${state.cajaActual.empleadoNombre || '-'}</p>
      <div class="caja-info-grid">
        <div class="caja-info-item"><label>Monto Inicial</label><span>${fmt(state.cajaActual.montoInicial || 0)}</span></div>
        <div class="caja-info-item"><label>Ingresos</label><span style="color:#00b341">+${fmt(ingresos)}</span></div>
        <div class="caja-info-item"><label>Gastos</label><span style="color:#e03131">-${fmt(gastos)}</span></div>
        <div class="caja-info-item"><label>Total Esperado</label><span>${fmt(total)}</span></div>
      </div>
      <div class="caja-btns">
        <button class="btn-caja gasto" onclick="abrirModalGasto()"><i class="fas fa-minus-circle"></i> Registrar Gasto</button>
        <button class="btn-caja cerrar" onclick="abrirModalCerrarCaja()"><i class="fas fa-lock"></i> Cerrar Caja</button>
      </div>`;
  } else {
    card.innerHTML = `
      <div class="caja-estado-icon">🔴</div>
      <h2>Caja Cerrada</h2>
      <p>No hay caja abierta. Debes abrir la caja para poder realizar ventas.</p>
      <div class="caja-btns">
        <button class="btn-caja abrir" onclick="abrirModalAbrirCaja()"><i class="fas fa-lock-open"></i> Abrir Caja</button>
      </div>`;
  }

  cargarMovimientosHoy();
  cargarHistorialCaja();
}

// ── Abrir Caja ────────────────────────────────────────────
window.abrirModalAbrirCaja = () => {
  document.getElementById('caja-monto-inicial').value  = '';
  document.getElementById('caja-notas-apertura').value = '';
  abrirModal('modal-abrir-caja');
};

window.abrirCaja = async () => {
  const monto    = parseFloat(document.getElementById('caja-monto-inicial').value) || 0;
  const notas    = document.getElementById('caja-notas-apertura').value;
  const empNombre = await getEmpNombre();
  try {
    await addDoc(collection(db, 'negocios', state.negocioId, 'caja'), {
      estado: 'abierta', montoInicial: monto, fechaApertura: serverTimestamp(),
      uid: state.currentUser.uid, empleadoNombre: empNombre, notas, ingresos: 0, gastos: 0
    });
    cerrarModal('modal-abrir-caja');
    toast('Caja abierta exitosamente', 'success');
  } catch (e) { toast('Error al abrir caja: ' + e.message, 'error'); }
};

// ── Cerrar Caja ───────────────────────────────────────────
window.abrirModalCerrarCaja = () => {
  if (!state.cajaActual) return;
  const ingresos = state.cajaActual.ingresos || 0;
  const gastos   = state.cajaActual.gastos   || 0;
  const esperado = (state.cajaActual.montoInicial || 0) + ingresos - gastos;
  document.getElementById('cc-monto-inicial').textContent = fmt(state.cajaActual.montoInicial || 0);
  document.getElementById('cc-ingresos').textContent      = fmt(ingresos);
  document.getElementById('cc-gastos').textContent        = fmt(gastos);
  document.getElementById('cc-total').textContent         = fmt(esperado);
  document.getElementById('caja-monto-final').value       = '';
  document.getElementById('diferencia-caja').style.display = 'none';
  abrirModal('modal-cerrar-caja');
};

window.calcularDiferencia = () => {
  if (!state.cajaActual) return;
  const final    = parseFloat(document.getElementById('caja-monto-final').value) || 0;
  const ingresos = state.cajaActual.ingresos || 0;
  const gastos   = state.cajaActual.gastos   || 0;
  const esperado = (state.cajaActual.montoInicial || 0) + ingresos - gastos;
  const diff     = final - esperado;
  const el       = document.getElementById('diferencia-caja');
  el.style.display = 'block';
  if (Math.abs(diff) < 0.01) {
    el.style.background = '#d4edda'; el.style.color = '#155724';
    el.textContent = '✅ Caja cuadra perfectamente';
  } else if (diff > 0) {
    el.style.background = '#fff3cd'; el.style.color = '#856404';
    el.textContent = `⚠️ Sobrante: ${fmt(diff)}`;
  } else {
    el.style.background = '#f8d7da'; el.style.color = '#721c24';
    el.textContent = `❌ Faltante: ${fmt(Math.abs(diff))}`;
  }
};

window.cerrarCaja = async () => {
  if (!state.cajaActual) return;
  const final = parseFloat(document.getElementById('caja-monto-final').value);
  if (isNaN(final)) { toast('Ingresa el monto final', 'error'); return; }
  const notas     = document.getElementById('caja-notas-cierre').value;
  const empNombre = await getEmpNombre();
  try {
    await updateDoc(doc(db, 'negocios', state.negocioId, 'caja', state.cajaActual.id), {
      estado: 'cerrada', montoFinal: final, fechaCierre: serverTimestamp(),
      notasCierre: notas, empleadoCierreNombre: empNombre
    });
    cerrarModal('modal-cerrar-caja');
    toast('Caja cerrada correctamente', 'success');
  } catch (e) { toast('Error: ' + e.message, 'error'); }
};

// ── Gastos ────────────────────────────────────────────────
window.abrirModalGasto = () => {
  if (!state.cajaActual) { toast('La caja debe estar abierta', 'error'); return; }
  document.getElementById('gasto-desc').value  = '';
  document.getElementById('gasto-monto').value = '';
  abrirModal('modal-gasto');
};

window.registrarGasto = async () => {
  const desc  = document.getElementById('gasto-desc').value.trim();
  const monto = parseFloat(document.getElementById('gasto-monto').value);
  const cat   = document.getElementById('gasto-cat').value;
  if (!desc || isNaN(monto) || monto <= 0) { toast('Completa todos los campos', 'error'); return; }
  const empNombre = await getEmpNombre();
  try {
    await addDoc(collection(db, 'negocios', state.negocioId, 'movimientos'), {
      tipo: 'gasto', descripcion: desc, categoria: cat, monto,
      fecha: serverTimestamp(), uid: state.currentUser.uid, empleadoNombre: empNombre,
      cajaId: state.cajaActual.id
    });
    await updateDoc(doc(db, 'negocios', state.negocioId, 'caja', state.cajaActual.id), {
      gastos: (state.cajaActual.gastos || 0) + monto
    });
    cerrarModal('modal-gasto');
    toast('Gasto registrado', 'success');
    cargarMovimientosHoy();
  } catch (e) { toast('Error: ' + e.message, 'error'); }
};

// ── Movimientos ───────────────────────────────────────────
async function cargarMovimientosHoy() {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const q   = query(
    collection(db, 'negocios', state.negocioId, 'movimientos'),
    where('fecha', '>=', Timestamp.fromDate(hoy)),
    orderBy('fecha', 'desc')
  );
  const snap = await getDocs(q);
  state.movimientosCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderMovimientos();
}

function renderMovimientos() {
  const tbody = document.getElementById('tbody-movimientos');
  if (!tbody) return;
  if (!state.movimientosCache.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="fas fa-inbox"></i><p>Sin movimientos hoy</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = state.movimientosCache.map(m => {
    const fecha = m.fecha?.toDate ? m.fecha.toDate() : new Date();
    return `<tr>
      <td>${fecha.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}</td>
      <td><span class="badge ${m.tipo}">${m.tipo === 'ingreso' ? '🟢 Ingreso' : '🔴 Gasto'}</span></td>
      <td>${m.descripcion || '-'}</td>
      <td>${m.empleadoNombre || '-'}</td>
      <td style="font-family:var(--font-mono);font-weight:700;color:${m.tipo === 'ingreso' ? '#00b341' : '#e03131'};">
        ${m.tipo === 'ingreso' ? '+' : '-'}${fmt(m.monto)}</td>
    </tr>`;
  }).join('');
}

async function cargarHistorialCaja() {
  const q    = query(collection(db, 'negocios', state.negocioId, 'caja'), orderBy('fechaApertura', 'desc'), limit(20));
  const snap = await getDocs(q);
  const tbody = document.getElementById('tbody-historial-caja');
  if (!tbody) return;
  const rows = snap.docs.map(d => {
    const data     = d.data();
    const apertura = data.fechaApertura?.toDate ? data.fechaApertura.toDate().toLocaleString('es-DO') : '-';
    const cierre   = data.fechaCierre?.toDate   ? data.fechaCierre.toDate().toLocaleString('es-DO')   : '-';
    return `<tr>
      <td>${apertura}</td><td>${cierre}</td>
      <td>${data.empleadoNombre || '-'}</td>
      <td style="font-family:var(--font-mono);">${fmt(data.montoInicial || 0)}</td>
      <td style="font-family:var(--font-mono);">${data.montoFinal !== undefined ? fmt(data.montoFinal) : '-'}</td>
      <td><span class="badge ${data.estado}">${data.estado}</span></td>
    </tr>`;
  });
  tbody.innerHTML = rows.join('') || `<tr><td colspan="6" style="text-align:center;color:var(--gris-suave);">Sin registros</td></tr>`;
}

window.exportarMovimientos = () => {
  let csv = 'Hora,Tipo,Descripción,Empleado,Monto\n';
  state.movimientosCache.forEach(m => {
    const fecha = m.fecha?.toDate ? m.fecha.toDate().toLocaleTimeString('es-DO') : '-';
    csv += `"${fecha}","${m.tipo}","${m.descripcion}","${m.empleadoNombre || '-'}","${m.monto}"\n`;
  });
  const a = Object.assign(document.createElement('a'), {
    href:     URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
    download: `movimientos_${new Date().toLocaleDateString('es-DO')}.csv`
  });
  a.click();
};
