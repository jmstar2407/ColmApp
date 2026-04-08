import { db } from '../firebase-config.js';
import { doc, getDocs, collection, setDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from '../firebase-config.js';
import { AppState, fmt, toast, openModal, closeModal } from '../utils/helpers.js';

let initialized = false;

export async function initConfiguracion(state) {
  if (initialized) return;
  initialized = true;
  
  loadConfigToUI();
  loadEmpleados();
  
  document.getElementById('btn-guardar-config')?.addEventListener('click', guardarConfig);
  document.getElementById('btn-guardar-itbis')?.addEventListener('click', guardarItbis);
  document.getElementById('btn-agregar-empleado')?.addEventListener('click', abrirModalEmpleado);
}

function loadConfigToUI() {
  if (!AppState.negocioData) return;
  document.getElementById('cfg-nombre').value = AppState.negocioData.nombre || '';
  document.getElementById('cfg-rnc').value = AppState.negocioData.rnc || '';
  document.getElementById('cfg-direccion').value = AppState.negocioData.direccion || '';
  document.getElementById('cfg-telefono').value = AppState.negocioData.telefono || '';
  document.getElementById('cfg-ncf-prefijo').value = AppState.config.ncfPrefijo || 'B01';
  document.getElementById('cfg-ncf-seq').value = AppState.config.ncfSeq || 1;
  document.getElementById('cfg-itbis-pct').value = AppState.config.itbisPct || 18;
  document.getElementById('cfg-itbis-cliente').checked = AppState.config.itbisCliente !== false;
}

async function guardarConfig() {
  try {
    const negUpdate = {
      nombre: document.getElementById('cfg-nombre').value.trim(),
      rnc: document.getElementById('cfg-rnc').value.trim(),
      direccion: document.getElementById('cfg-direccion').value.trim(),
      telefono: document.getElementById('cfg-telefono').value.trim(),
    };
    const cfgUpdate = {
      ncfPrefijo: document.getElementById('cfg-ncf-prefijo').value.trim() || 'B01',
      ncfSeq: parseInt(document.getElementById('cfg-ncf-seq').value) || 1,
    };
    await updateDoc(doc(db, 'negocios', AppState.negocioId), negUpdate);
    await updateDoc(doc(db, 'negocios', AppState.negocioId, 'configuraciones', 'general'), cfgUpdate);
    AppState.negocioData = { ...AppState.negocioData, ...negUpdate };
    AppState.config = { ...AppState.config, ...cfgUpdate };
    toast('Configuración guardada', 'success');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function guardarItbis() {
  try {
    const itbisPct = parseFloat(document.getElementById('cfg-itbis-pct').value) || 18;
    const itbisCliente = document.getElementById('cfg-itbis-cliente').checked;
    await updateDoc(doc(db, 'negocios', AppState.negocioId, 'configuraciones', 'general'), { itbisPct, itbisCliente });
    AppState.config.itbisPct = itbisPct;
    AppState.config.itbisCliente = itbisCliente;
    toast('Configuración de ITBIS guardada', 'success');
  } catch(e) { toast('Error: ' + e.message, 'error'); }
}

async function loadEmpleados() {
  const snap = await getDocs(collection(db, 'negocios', AppState.negocioId, 'empleados'));
  AppState.empleados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderEmpleados();
}

function renderEmpleados() {
  const lista = document.getElementById('empleados-lista');
  if (!lista) return;
  if (!AppState.empleados.length) {
    lista.innerHTML = '<div class="empty-state">Sin empleados</div>';
    return;
  }
  lista.innerHTML = AppState.empleados.map(e => `
    <div class="empleado-row">
      <div class="empleado-avatar">${(e.nombre || 'E')[0].toUpperCase()}</div>
      <div class="empleado-info"><div class="emp-nombre">${e.nombre}</div><div class="emp-email">${e.email}</div></div>
      <span class="emp-rol ${e.rol}">${e.rol}</span>
      ${e.uid !== AppState.currentUser?.uid ? `<button class="btn-sm rojo eliminar-emp" data-id="${e.id}">Eliminar</button>` : ''}
    </div>
  `).join('');
  document.querySelectorAll('.eliminar-emp').forEach(btn => {
    btn.addEventListener('click', () => eliminarEmpleado(btn.dataset.id));
  });
}

function abrirModalEmpleado() {
  const bodyHtml = `
    <div class="form-group"><label>Nombre</label><input type="text" id="emp-nombre"></div>
    <div class="form-group"><label>Email</label><input type="email" id="emp-email"></div>
    <div class="form-group"><label>Contraseña</label><input type="password" id="emp-pass"></div>
    <div class="form-group"><label>Rol</label><select id="emp-rol"><option value="empleado">Empleado</option><option value="admin">Administrador</option></select></div>
  `;
  openModal('Agregar Empleado', bodyHtml, async () => {
    const nombre = document.getElementById('emp-nombre').value.trim();
    const email = document.getElementById('emp-email').value.trim();
    const pass = document.getElementById('emp-pass').value;
    const rol = document.getElementById('emp-rol').value;
    if (!nombre || !email || !pass || pass.length < 6) {
      toast('Complete todos los campos (contraseña mínimo 6 caracteres)', 'error');
      return;
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      const uid = cred.user.uid;
      localStorage.setItem(`negocio_${uid}`, AppState.negocioId);
      await setDoc(doc(db, 'negocios', AppState.negocioId, 'empleados', uid), {
        nombre, email, rol, uid, activo: true, creadoEn: serverTimestamp()
      });
      toast('Empleado agregado', 'success');
      loadEmpleados();
    } catch(e) {
      toast('Error: ' + (e.code === 'auth/email-already-in-use' ? 'Email ya existe' : e.message), 'error');
    }
  }, 'Agregar');
}

async function eliminarEmpleado(id) {
  if (!confirm('¿Eliminar este empleado?')) return;
  await deleteDoc(doc(db, 'negocios', AppState.negocioId, 'empleados', id));
  toast('Empleado eliminado', 'success');
  loadEmpleados();
}