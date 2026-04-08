// ============================================================
// configuracion.js — Datos del negocio, ITBIS, empleados
// ============================================================
import { auth, db, state, toast, abrirModal, cerrarModal } from "./app.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection, doc, setDoc, updateDoc, deleteDoc, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ── Config del negocio ────────────────────────────────────
export function renderConfig() {
  if (!state.negocioData) return;
  document.getElementById('cfg-nombre').value      = state.negocioData.nombre    || '';
  document.getElementById('cfg-rnc').value         = state.negocioData.rnc       || '';
  document.getElementById('cfg-direccion').value   = state.negocioData.direccion || '';
  document.getElementById('cfg-telefono').value    = state.negocioData.telefono  || '';
  document.getElementById('cfg-ncf-prefijo').value = state.config.ncfPrefijo     || 'B01';
  document.getElementById('cfg-ncf-seq').value     = state.config.ncfSeq         || 1;
  document.getElementById('cfg-itbis-pct').value   = state.config.itbisPct       || 18;
  document.getElementById('cfg-itbis-cliente').checked = state.config.itbisCliente !== false;
}

window.guardarConfig = async () => {
  try {
    const negUpdate = {
      nombre:    document.getElementById('cfg-nombre').value.trim(),
      rnc:       document.getElementById('cfg-rnc').value.trim(),
      direccion: document.getElementById('cfg-direccion').value.trim(),
      telefono:  document.getElementById('cfg-telefono').value.trim(),
    };
    const cfgUpdate = {
      ncfPrefijo:   document.getElementById('cfg-ncf-prefijo').value.trim() || 'B01',
      ncfSeq:       parseInt(document.getElementById('cfg-ncf-seq').value)   || 1,
      itbisPct:     parseFloat(document.getElementById('cfg-itbis-pct').value) || 18,
      itbisCliente: document.getElementById('cfg-itbis-cliente').checked,
    };
    await updateDoc(doc(db, 'negocios', state.negocioId), negUpdate);
    await updateDoc(doc(db, 'negocios', state.negocioId, 'configuraciones', 'general'), cfgUpdate);
    Object.assign(state.negocioData, negUpdate);
    Object.assign(state.config,     cfgUpdate);
    document.getElementById('nav-negocio-nombre').textContent = state.negocioData.nombre || 'Mi Colmado';
    toast('Configuración guardada', 'success');
  } catch (e) { toast('Error: ' + e.message, 'error'); }
};

// ── Empleados ─────────────────────────────────────────────
export function renderEmpleados() {
  const lista = document.getElementById('empleados-lista');
  if (!lista) return;
  if (!state.empleadosCache.length) {
    lista.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Sin empleados</p></div>';
    return;
  }
  lista.innerHTML = state.empleadosCache.map(e => `
    <div class="empleado-row">
      <div class="empleado-avatar">${(e.nombre || 'E')[0].toUpperCase()}</div>
      <div class="empleado-info">
        <div class="emp-nombre">${e.nombre}</div>
        <div class="emp-email">${e.email}</div>
      </div>
      <span class="emp-rol ${e.rol}">${e.rol}</span>
      ${e.uid !== state.currentUser.uid
        ? `<button class="btn-sm" onclick="eliminarEmpleado('${e.id}')" style="background:#ffe3e3;color:#e03131;padding:6px 10px;font-size:12px;"><i class="fas fa-trash"></i></button>`
        : ''}
    </div>`).join('');
}

window.abrirModalEmpleado = () => {
  ['emp-nombre', 'emp-email', 'emp-pass'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('emp-rol').value = 'empleado';
  abrirModal('modal-empleado');
};

window.guardarEmpleado = async () => {
  const nombre = document.getElementById('emp-nombre').value.trim();
  const email  = document.getElementById('emp-email').value.trim();
  const pass   = document.getElementById('emp-pass').value;
  const rol    = document.getElementById('emp-rol').value;
  if (!nombre || !email || !pass) { toast('Todos los campos son requeridos', 'error'); return; }
  if (pass.length < 6)            { toast('La contraseña debe tener mínimo 6 caracteres', 'error'); return; }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const uid  = cred.user.uid;
    localStorage.setItem(`negocio_${uid}`, state.negocioId);
    await setDoc(doc(db, 'negocios', state.negocioId, 'empleados', uid), {
      nombre, email, rol, uid, activo: true, creadoEn: serverTimestamp()
    });
    state.empleadosCache.push({ id: uid, nombre, email, rol, uid });
    renderEmpleados();
    cerrarModal('modal-empleado');
    toast('Empleado agregado', 'success');
  } catch (e) {
    toast('Error: ' + (e.code === 'auth/email-already-in-use' ? 'Ese email ya existe' : e.message), 'error');
  }
};

window.eliminarEmpleado = async (id) => {
  if (!confirm('¿Eliminar este empleado?')) return;
  try {
    await deleteDoc(doc(db, 'negocios', state.negocioId, 'empleados', id));
    state.empleadosCache = state.empleadosCache.filter(e => e.id !== id);
    renderEmpleados();
    toast('Empleado eliminado', 'success');
  } catch (e) { toast('Error: ' + e.message, 'error'); }
};
