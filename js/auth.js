import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { AppState, toast, emit, on } from './utils/helpers.js';

let authInitialized = false;

export function initAuth() {
  if (authInitialized) return;
  authInitialized = true;
  
  // Login button
  document.getElementById('btn-login')?.addEventListener('click', login);
  document.getElementById('btn-registro')?.addEventListener('click', registrar);
  document.getElementById('btn-logout')?.addEventListener('click', logout);
  
  // Tabs
  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.getElementById('auth-login').style.display = tab === 'login' ? 'block' : 'none';
      document.getElementById('auth-registro').style.display = tab === 'registro' ? 'block' : 'none';
      document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  
  // Auth state
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      AppState.currentUser = user;
      await loadNegocio(user);
    } else {
      AppState.currentUser = null;
      AppState.negocioId = null;
      AppState.negocioData = null;
      showScreen('auth');
    }
  });
}

async function login() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  if (!email || !pass) { toast('Completa todos los campos', 'error'); return; }
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    toast('Bienvenido', 'success');
  } catch (e) {
    toast('Credenciales incorrectas', 'error');
  }
}

async function registrar() {
  const nombre = document.getElementById('reg-nombre').value.trim();
  const rnc = document.getElementById('reg-rnc').value.trim();
  const direccion = document.getElementById('reg-direccion').value.trim();
  const telefono = document.getElementById('reg-telefono').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-pass').value;
  if (!nombre || !email || !pass || pass.length < 6) {
    toast('Complete todos los campos (contraseña mínimo 6 caracteres)', 'error');
    return;
  }
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const uid = cred.user.uid;
    await setDoc(doc(db, 'negocios', uid), {
      nombre, rnc, direccion, telefono, propietarioUid: uid, plan: 'basico', creadoEn: serverTimestamp()
    });
    await setDoc(doc(db, 'negocios', uid, 'configuraciones', 'general'), {
      itbisPct: 18, itbisCliente: true, ncfPrefijo: 'B01', ncfSeq: 1
    });
    await setDoc(doc(db, 'negocios', uid, 'empleados', uid), {
      nombre: 'Administrador', email, rol: 'admin', uid, activo: true, creadoEn: serverTimestamp()
    });
    toast('Negocio registrado exitosamente', 'success');
  } catch (e) {
    toast('Error al registrar: ' + e.message, 'error');
  }
}

async function loadNegocio(user) {
  try {
    let negRef = doc(db, 'negocios', user.uid);
    let negSnap = await getDoc(negRef);
    if (negSnap.exists()) {
      AppState.negocioId = user.uid;
    } else {
      const cached = localStorage.getItem(`negocio_${user.uid}`);
      if (cached) {
        AppState.negocioId = cached;
        negRef = doc(db, 'negocios', cached);
        negSnap = await getDoc(negRef);
        if (!negSnap.exists()) throw new Error('Negocio no encontrado');
      } else {
        throw new Error('No perteneces a ningún negocio');
      }
    }
    AppState.negocioData = negSnap.data();
    localStorage.setItem(`negocio_${user.uid}`, AppState.negocioId);
    
    const empSnap = await getDoc(doc(db, 'negocios', AppState.negocioId, 'empleados', user.uid));
    AppState.userRole = empSnap.exists() ? empSnap.data().rol : 'admin';
    
    emit('auth:ready', AppState);
    showScreen('app');
  } catch (e) {
    console.error(e);
    toast('Error al cargar negocio', 'error');
    await signOut(auth);
    showScreen('auth');
  }
}

async function logout() {
  await signOut(auth);
  AppState.carrito = [];
  AppState.cajaActual = null;
  toast('Sesión cerrada', 'info');
}

function showScreen(screen) {
  document.getElementById('loading-screen').style.display = screen === 'loading' ? 'flex' : 'none';
  document.getElementById('auth-screen').style.display = screen === 'auth' ? 'flex' : 'none';
  document.getElementById('app').style.display = screen === 'app' ? 'flex' : 'none';
}

// Ocultar loading después de 2.5s
setTimeout(() => {
  if (document.getElementById('loading-screen').style.display !== 'none' && !auth.currentUser) {
    showScreen('auth');
  }
}, 2500);