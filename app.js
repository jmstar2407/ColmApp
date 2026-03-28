// ============================================================
// APP.JS - Utilidades globales, autenticación y estado
// ============================================================

// ─── ESTADO GLOBAL ───────────────────────────────────────────
const AppState = {
  user: null,
  negocioId: null,
  negocioData: null,
  cajaAbierta: false,
  cajaId: null,
  empleados: []
};

// ─── PROTECCIÓN DE RUTAS ──────────────────────────────────────
function requireAuth(callback) {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = 'index.html';
      return;
    }
    AppState.user = user;
    try {
      await cargarDatosNegocio(user.uid);
      if (callback) callback(user);
    } catch (e) {
      console.error("Error cargando negocio:", e);
      window.location.href = 'index.html';
    }
  });
}

// ─── CARGAR DATOS DEL NEGOCIO ─────────────────────────────────
async function cargarDatosNegocio(uid) {
  // Buscar negocio por propietario o empleado
  let snap = await db.collection('negocios')
    .where('propietarioUid', '==', uid)
    .limit(1)
    .get();

  if (snap.empty) {
    // Buscar como empleado
    snap = await db.collection('negocios')
      .where('empleados', 'array-contains', uid)
      .limit(1)
      .get();
  }

  if (snap.empty) throw new Error("Negocio no encontrado");

  const doc = snap.docs[0];
  AppState.negocioId = doc.id;
  AppState.negocioData = doc.data();

  // Determinar rol
  AppState.isAdmin = AppState.negocioData.propietarioUid === uid;

  return AppState.negocioData;
}

// ─── VERIFICAR CAJA ABIERTA ───────────────────────────────────
async function verificarCaja() {
  const hoy = fechaHoy();
  const snap = await db.collection('negocios').doc(AppState.negocioId)
    .collection('caja')
    .where('fecha', '==', hoy)
    .where('estado', '==', 'abierta')
    .limit(1)
    .get();

  if (!snap.empty) {
    AppState.cajaAbierta = true;
    AppState.cajaId = snap.docs[0].id;
    return snap.docs[0].data();
  }
  AppState.cajaAbierta = false;
  AppState.cajaId = null;
  return null;
}

// ─── HELPERS DE FECHA/HORA RD ─────────────────────────────────
function fechaHora() {
  return new Date().toLocaleString('es-DO', {
    timeZone: 'America/Santo_Domingo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

function fechaHoy() {
  return new Date().toLocaleDateString('es-DO', {
    timeZone: 'America/Santo_Domingo',
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
}

function horaActual() {
  return new Date().toLocaleTimeString('es-DO', {
    timeZone: 'America/Santo_Domingo',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

function timestampRD() {
  return new Date().toLocaleString('es-DO', { timeZone: 'America/Santo_Domingo' });
}

// ─── FORMATEO MONEDA ──────────────────────────────────────────
function formatoMoneda(valor) {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 2
  }).format(valor || 0);
}

// ─── GENERADOR NCF ────────────────────────────────────────────
async function generarNCF(tipo = 'B01') {
  const configRef = db.collection('negocios').doc(AppState.negocioId)
    .collection('configuraciones').doc('ncf');
  
  return await db.runTransaction(async (t) => {
    const doc = await t.get(configRef);
    let secuencia = 1;
    if (doc.exists) {
      secuencia = (doc.data()[`secuencia_${tipo}`] || 0) + 1;
    }
    t.set(configRef, { [`secuencia_${tipo}`]: secuencia }, { merge: true });
    return `${tipo}${String(secuencia).padStart(8, '0')}`;
  });
}

// ─── TOAST NOTIFICATIONS ──────────────────────────────────────
function toast(msg, tipo = 'success', duracion = 3000) {
  const container = document.getElementById('toast-container') || crearToastContainer();
  const t = document.createElement('div');
  t.className = `toast toast-${tipo}`;
  t.innerHTML = `
    <span class="toast-icon">${tipo === 'success' ? '✓' : tipo === 'error' ? '✗' : 'ℹ'}</span>
    <span>${msg}</span>
  `;
  container.appendChild(t);
  setTimeout(() => t.classList.add('toast-show'), 10);
  setTimeout(() => {
    t.classList.remove('toast-show');
    setTimeout(() => t.remove(), 300);
  }, duracion);
}

function crearToastContainer() {
  const c = document.createElement('div');
  c.id = 'toast-container';
  document.body.appendChild(c);
  return c;
}

// ─── MODAL GENÉRICO ───────────────────────────────────────────
function mostrarModal(id) {
  document.getElementById(id)?.classList.add('modal-active');
}
function cerrarModal(id) {
  document.getElementById(id)?.classList.remove('modal-active');
}

// ─── CERRAR SESIÓN ────────────────────────────────────────────
async function cerrarSesion() {
  await auth.signOut();
  window.location.href = 'index.html';
}

// ─── CARGAR EMPLEADOS ─────────────────────────────────────────
async function cargarEmpleados() {
  try {
    const snap = await db.collection('negocios').doc(AppState.negocioId)
      .collection('empleados').get();
    AppState.empleados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return AppState.empleados;
  } catch(e) {
    return [];
  }
}

// ─── DGII MOCK ────────────────────────────────────────────────
async function enviarDGII(factura) {
  console.log("[DGII MOCK] Enviando factura:", factura.ncf);
  return new Promise(resolve => setTimeout(() => resolve({
    success: true,
    mensaje: "Factura enviada exitosamente (simulación DGII)",
    codigo: "200",
    ncf: factura.ncf
  }), 800));
}
