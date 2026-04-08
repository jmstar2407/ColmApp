import { db } from '../firebase-config.js';
import { collection, doc, getDocs, getDoc, addDoc, updateDoc, query, where, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { AppState, fmt, toast, openModal, closeModal, emit, on } from '../utils/helpers.js';

let initialized = false;

export async function initCaja(state) {
  if (initialized) return;
  initialized = true;
  
  subscribeToCaja();
  loadEmpleados();
  
  document.getElementById('btn-exportar-movimientos')?.addEventListener('click', exportarMovimientos);
  document.getElementById('btn-ir-caja')?.addEventListener('click', () => window.showPage('caja'));
}

function subscribeToCaja() {
  const q = query(collection(db, 'negocios', AppState.negocioId, 'caja'), where('estado', '==', 'abierta'), limit(1));
  onSnapshot(q, (snap) => {
    if (!snap.empty) {
      AppState.cajaActual = { id: snap.docs[0].id, ...snap.docs[0].data() };
    } else {
      AppState.cajaActual = null;
    }
    updateCajaBanner();
    renderCaja();
    emit('caja:updated', AppState.cajaActual);
  });
}

function updateCajaBanner() {
  const banner = document.getElementById('caja-pendiente-banner');
  if (!AppState.cajaActual) banner.classList.add('visible');
  else banner.classList.remove('visible');
}

async function renderCaja() {
  const card = document.getElementById('caja-estado-card');
  if (!card) return;
  
  if (AppState.cajaActual) {
    const apertura = AppState.cajaActual.fechaApertura?.toDate?.()?.toLocaleString('es-DO') || 'Desconocida';
    const ingresos = AppState.cajaActual.ingresos || 0;
    const gastos = AppState.cajaActual.gastos || 0;
    const total = (AppState.cajaActual.montoInicial || 0) + ingresos - gastos;
    card.innerHTML = `
      <div class="caja-estado-icon">🟢</div>
      <h2>Caja Abierta</h2>
      <p>Apertura: ${apertura}</p>
      <div class="caja-info-grid">
        <div class="caja-info-item"><label>Monto Inicial</label><span>${fmt(AppState.cajaActual.montoInicial || 0)}</span></div>
        <div class="caja-info-item"><label>Ingresos</label><span style="color:var(--verde)">+${fmt(ingresos)}</span></div>
        <div class="caja-info-item"><label>Gastos</label><span style="color:var(--rojo)">-${fmt(gastos)}</span></div>
        <div class="caja-info-item"><label>Total Esperado</label><span>${fmt(total)}</span></div>
      </div>
      <div class="caja-btns">
        <button class="btn-caja gasto" id="btn-gasto">Registrar Gasto</button>
        <button class="btn-caja cerrar" id="btn-cerrar-caja">Cerrar Caja</button>
      </div>
    `;
    document.getElementById('btn-gasto')?.addEventListener('click', abrirModalGasto);
    document.getElementById('btn-cerrar-caja')?.addEventListener('click', abrirModalCerrarCaja);
  } else {
    card.innerHTML = `
      <div class="caja-estado-icon">🔴</div>
      <h2>Caja Cerrada</h2>
      <div class="caja-btns"><button class="btn-caja abrir" id="btn-abrir-caja">Abrir Caja</button></div>
    `;
    document.getElementById('btn-abrir-caja')?.addEventListener('click', abrirModalAbrirCaja);
  }
  
  await cargarMovimientosHoy();
  await cargarHistorialCaja();
}

async function cargarMovimientosHoy() {
  const hoy = new Date();
  hoy.setHours(0,0,0,0);
  const q = query(collection(db, 'negocios', AppState.negocioId, 'movimientos'), where('fecha', '>=', hoy), orderBy('fecha', 'desc'));
  const snap = await getDocs(q);
  AppState.movimientos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  const tbody = document.getElementById('tbody-movimientos');
  if (!tbody) return;
  if (!AppState.movimientos.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Sin movimientos</td></tr>';
    return;
  }
  tbody.innerHTML = AppState.movimientos.map(m => {
    const fecha = m.fecha?.toDate?.() || new Date();
    return `<tr><td>${fecha.toLocaleTimeString('es-DO')}</td><td><span class="badge ${m.tipo}">${m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}</span></td><td>${m.descripcion || '-'}</td><td>${m.empleadoNombre || '-'}</td><td style="font-family:monospace;font-weight:700;">${fmt(m.monto)}</td></tr>`;
  }).join('');
}

async function cargarHistorialCaja() {
  const q = query(collection(db, 'negocios', AppState.negocioId, 'caja'), orderBy('fechaApertura', 'desc'), limit(20));
  const snap = await getDocs(q);
  const tbody = document.getElementById('tbody-historial-caja');
  if (!tbody) return;
  tbody.innerHTML = snap.docs.map(d => {
    const data = d.data();
    return `<tr><td>${data.fechaApertura?.toDate?.()?.toLocaleString('es-DO') || '-'}</td><td>${data.fechaCierre?.toDate?.()?.toLocaleString('es-DO') || '-'}</td><td>${data.empleadoNombre || '-'}</td><td>${fmt(data.montoInicial || 0)}</td><td>${data.montoFinal !== undefined ? fmt(data.montoFinal) : '-'}</td><td><span class="badge ${data.estado}">${data.estado}</span></td></tr>`;
  }).join('');
}

function abrirModalAbrirCaja() {
  const bodyHtml = `<div class="form-group"><label>Monto Inicial (RD$)</label><input type="number" id="caja-monto-inicial" placeholder="0.00"></div><div class="form-group"><label>Notas</label><input type="text" id="caja-notas"></div>`;
  openModal('Abrir Caja', bodyHtml, async () => {
    const monto = parseFloat(document.getElementById('caja-monto-inicial').value) || 0;
    const notas = document.getElementById('caja-notas').value;
    await addDoc(collection(db, 'negocios', AppState.negocioId, 'caja'), {
      estado: 'abierta', montoInicial: monto, fechaApertura: serverTimestamp(),
      uid: AppState.currentUser?.uid, empleadoNombre: AppState.currentUser?.email, notas, ingresos: 0, gastos: 0
    });
    toast('Caja abierta', 'success');
  }, 'Abrir');
}

function abrirModalCerrarCaja() {
  if (!AppState.cajaActual) return;
  const ingresos = AppState.cajaActual.ingresos || 0;
  const gastos = AppState.cajaActual.gastos || 0;
  const esperado = (AppState.cajaActual.montoInicial || 0) + ingresos - gastos;
  const bodyHtml = `
    <div><strong>Monto Inicial:</strong> ${fmt(AppState.cajaActual.montoInicial || 0)}</div>
    <div><strong>Ingresos:</strong> ${fmt(ingresos)}</div>
    <div><strong>Gastos:</strong> ${fmt(gastos)}</div>
    <div><strong>Total Esperado:</strong> ${fmt(esperado)}</div>
    <div class="form-group"><label>Monto Final (RD$)</label><input type="number" id="caja-monto-final"></div>
    <div class="form-group"><label>Notas</label><input type="text" id="caja-notas-cierre"></div>
  `;
  openModal('Cerrar Caja', bodyHtml, async () => {
    const final = parseFloat(document.getElementById('caja-monto-final').value);
    if (isNaN(final)) { toast('Ingrese monto final', 'error'); return; }
    await updateDoc(doc(db, 'negocios', AppState.negocioId, 'caja', AppState.cajaActual.id), {
      estado: 'cerrada', montoFinal: final, fechaCierre: serverTimestamp(),
      notasCierre: document.getElementById('caja-notas-cierre').value
    });
    toast('Caja cerrada', 'success');
  }, 'Cerrar');
}

function abrirModalGasto() {
  if (!AppState.cajaActual) { toast('Caja no abierta', 'error'); return; }
  const bodyHtml = `
    <div class="form-group"><label>Descripción</label><input type="text" id="gasto-desc"></div>
    <div class="form-group"><label>Monto (RD$)</label><input type="number" id="gasto-monto"></div>
  `;
  openModal('Registrar Gasto', bodyHtml, async () => {
    const desc = document.getElementById('gasto-desc').value.trim();
    const monto = parseFloat(document.getElementById('gasto-monto').value);
    if (!desc || isNaN(monto) || monto <= 0) { toast('Complete los campos', 'error'); return; }
    await addDoc(collection(db, 'negocios', AppState.negocioId, 'movimientos'), {
      tipo: 'gasto', descripcion: desc, monto, fecha: serverTimestamp(),
      uid: AppState.currentUser?.uid, empleadoNombre: AppState.currentUser?.email, cajaId: AppState.cajaActual.id
    });
    await updateDoc(doc(db, 'negocios', AppState.negocioId, 'caja', AppState.cajaActual.id), {
      gastos: (AppState.cajaActual.gastos || 0) + monto
    });
    toast('Gasto registrado', 'success');
  }, 'Registrar');
}

async function loadEmpleados() {
  const snap = await getDocs(collection(db, 'negocios', AppState.negocioId, 'empleados'));
  AppState.empleados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function exportarMovimientos() {
  let csv = 'Hora,Tipo,Descripción,Empleado,Monto\n';
  AppState.movimientos.forEach(m => {
    const fecha = m.fecha?.toDate?.()?.toLocaleTimeString('es-DO') || '-';
    csv += `"${fecha}","${m.tipo}","${m.descripcion}","${m.empleadoNombre || '-'}","${m.monto}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `movimientos_${new Date().toLocaleDateString('es-DO')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}