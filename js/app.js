// ============================================================
// app.js — Firebase init + estado global compartido + utilidades
// ============================================================
import { initializeApp }          from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut }
                                   from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, getDocs }
                                   from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage }              from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

import { initLogin }               from "./login.js";
import { initCaja, suscribirCaja } from "./caja.js";
import { initInventario, suscribirInventario, cargarTodosProductos, populateCatSelects }
                                   from "./inventario.js";
import { initFacturacion }         from "./facturacion.js";
import { initFacturas }            from "./facturas.js";
import { initEstadisticas }        from "./estadisticas.js";
import { initConfig }              from "./configuracion.js";

// ── Firebase ──────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyB7cX3O8Nkhg5XYsuH1UIn0ZDyxoxLzTB4",
  authDomain:        "colmapp-4aaa4.firebaseapp.com",
  projectId:         "colmapp-4aaa4",
  storageBucket:     "colmapp-4aaa4.firebasestorage.app",
  messagingSenderId: "767529335752",
  appId:             "1:767529335752:web:5967b10a0e0da050f91efd",
  measurementId:     "G-22YKHGWTMH"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth        = getAuth(firebaseApp);
export const db          = getFirestore(firebaseApp);
export const storage     = getStorage(firebaseApp);

// ── Estado global ─────────────────────────────────────────
export const state = {
  negocioId:     null,
  negocioData:   null,
  currentUser:   null,
  userRole:      null,
  config:        { itbisPct: 18, itbisCliente: true, ncfPrefijo: 'B01', ncfSeq: 1 },
  categorias:    [],
  productos:     [],
  carrito:       [],
  cajaActual:    null,
  facturasCache: [],
  movimientosCache: [],
  empleadosCache:   [],
  unsubscribers:    [],
  unsubCategorias:  null,
  productoEnEdicion: null,
  facturaActualParaImprimir: null,
  gridSize:      'grande',
  invViewGrid:   true,
  categoriaActual: null,
  metodoPagoSeleccionado:  'efectivo',
  estadoFacturaSeleccionado: 'pagada',
};

// ── Utilidades globales ───────────────────────────────────
export function fmt(val) {
  return `RD$ ${(val || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function toast(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-times-circle' : 'fa-info-circle'}"></i> ${msg}`;
  container.appendChild(t);
  setTimeout(() => t.remove(), duration);
}
window.toast = toast;

export function abrirModal(id)  { document.getElementById(id)?.classList.add('visible'); }
export function cerrarModal(id) { document.getElementById(id)?.classList.remove('visible'); }
window.abrirModal  = abrirModal;
window.cerrarModal = cerrarModal;

// ── Fecha/Hora ────────────────────────────────────────────
function updateDatetime() {
  const now  = new Date();
  const opts = { timeZone: 'America/Santo_Domingo', hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' };
  const dOpt = { timeZone: 'America/Santo_Domingo', weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
  const el   = document.getElementById('nav-datetime');
  if (el) el.innerHTML = `${now.toLocaleDateString('es-DO', dOpt)}<br>${now.toLocaleTimeString('es-DO', opts)}`;
}
setInterval(updateDatetime, 1000);
updateDatetime();

// ── Pantallas ─────────────────────────────────────────────
export function showScreen(screen) {
  document.getElementById('loading-screen').style.display = screen === 'loading' ? 'flex' : 'none';
  document.getElementById('auth-screen').style.display   = screen === 'auth'    ? 'flex' : 'none';
  document.getElementById('app').style.display           = screen === 'app'     ? 'flex' : 'none';
}

// ── Navbar ────────────────────────────────────────────────
function buildNavbar() {
  const btns  = document.getElementById('nav-buttons');
  const pages = [
    { id: 'pos',          label: 'Facturación',   roles: ['admin','empleado'] },
    { id: 'caja',         label: 'Caja',          roles: ['admin','empleado'] },
    { id: 'facturas',     label: 'Facturas',       roles: ['admin','empleado'] },
    { id: 'inventario',   label: 'Inventario',     roles: ['admin']           },
    { id: 'estadisticas', label: 'Estadísticas',   roles: ['admin']           },
    { id: 'config',       label: 'Configuración',  roles: ['admin']           },
  ];
  btns.innerHTML = pages
    .filter(p => p.roles.includes(state.userRole))
    .map(p => `<button class="nav-btn" id="navbtn-${p.id}" onclick="showPage('${p.id}')">${p.label}</button>`)
    .join('');
}

export function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`page-${pageId}`)?.classList.add('active');
  document.getElementById(`navbtn-${pageId}`)?.classList.add('active');

  if (pageId === 'estadisticas') { import('./estadisticas.js').then(m => m.estadisticasHoy()); }
  if (pageId === 'inventario')   { import('./inventario.js').then(m => { m.renderInventario(); m.populateCatSelects(); }); }
  if (pageId === 'config')       { import('./configuracion.js').then(m => { m.renderConfig(); m.renderEmpleados(); }); }
  if (pageId === 'facturas')     { import('./facturas.js').then(m => m.cargarFacturas()); }
  if (pageId === 'caja')         { import('./caja.js').then(m => m.renderCaja()); }
}
window.showPage = showPage;

// ── Auth state ────────────────────────────────────────────
export async function getEmpNombre() {
  const emp = state.empleadosCache.find(e => e.uid === state.currentUser.uid);
  return emp ? emp.nombre : state.currentUser.email;
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    state.currentUser = user;
    await loadNegocio(user);
  } else {
    state.currentUser = null;
    state.negocioId   = null;
    state.negocioData = null;
    showScreen('auth');
  }
});

async function loadNegocio(user) {
  try {
    let negRef  = doc(db, 'negocios', user.uid);
    let negSnap = await getDoc(negRef);

    if (negSnap.exists()) {
      state.negocioId = user.uid;
    } else {
      const cached = localStorage.getItem(`negocio_${user.uid}`);
      if (cached) {
        state.negocioId = cached;
        negSnap         = await getDoc(doc(db, 'negocios', state.negocioId));
        if (!negSnap.exists()) { showScreen('auth'); return; }
      } else {
        showScreen('auth');
        return;
      }
    }

    state.negocioData = negSnap.data();

    const empSnap = await getDoc(doc(db, 'negocios', state.negocioId, 'empleados', user.uid));
    state.userRole = empSnap.exists()
      ? empSnap.data().rol
      : (state.negocioData.propietarioUid === user.uid ? 'admin' : 'empleado');

    localStorage.setItem(`negocio_${user.uid}`, state.negocioId);
    await initApp();
  } catch (e) {
    console.error(e);
    showScreen('auth');
  }
}

async function initApp() {
  showScreen('loading');

  const cfgSnap = await getDoc(doc(db, 'negocios', state.negocioId, 'configuraciones', 'general'));
  if (cfgSnap.exists()) Object.assign(state.config, cfgSnap.data());

  document.getElementById('nav-negocio-nombre').textContent = state.negocioData.nombre || 'Mi Colmado';
  buildNavbar();

  suscribirCaja();
  suscribirInventario();

  // Cargar empleados
  const snap = await getDocs(collection(db, 'negocios', state.negocioId, 'empleados'));
  state.empleadosCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  showScreen('app');
  showPage('pos');
}

// ── Logout ────────────────────────────────────────────────
window.logout = async () => {
  state.unsubscribers.forEach(u => u?.());
  state.unsubscribers = [];
  state.unsubCategorias?.();
  await signOut(auth);
};

// ── Cerrar modales al click fuera ─────────────────────────
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('visible');
  });
});

// ── Init login module ─────────────────────────────────────
initLogin();
