// ============================================================
// login.js — Autenticación: login, registro
// ============================================================
import { auth, db, showScreen }    from "./app.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword }
                                    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, serverTimestamp }
                                    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export function initLogin() {
  window.authTab  = authTab;
  window.login    = login;
  window.registrar = registrar;
}

function authTab(tab) {
  document.getElementById('auth-login').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('auth-registro').style.display = tab === 'registro' ? 'block' : 'none';
  document.querySelectorAll('.auth-tab').forEach((b, i) =>
    b.classList.toggle('active', (i === 0) === (tab === 'login'))
  );
}

async function login() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  if (!email || !pass) { showAuthMsg('Completa todos los campos', 'error'); return; }
  try {
    showAuthMsg('Iniciando sesión...', 'success');
    await signInWithEmailAndPassword(auth, email, pass);
  } catch {
    showAuthMsg('Credenciales incorrectas. Verifica tu email y contraseña.', 'error');
  }
}

async function registrar() {
  const nombre    = document.getElementById('reg-nombre').value.trim();
  const rnc       = document.getElementById('reg-rnc').value.trim();
  const direccion = document.getElementById('reg-direccion').value.trim();
  const telefono  = document.getElementById('reg-telefono').value.trim();
  const email     = document.getElementById('reg-email').value.trim();
  const pass      = document.getElementById('reg-pass').value;

  if (!nombre || !email || !pass) { showAuthMsg('Nombre, email y contraseña son requeridos', 'error'); return; }
  if (pass.length < 6)            { showAuthMsg('La contraseña debe tener mínimo 6 caracteres', 'error'); return; }

  try {
    showAuthMsg('Registrando colmado...', 'success');
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const uid  = cred.user.uid;

    await setDoc(doc(db, 'negocios', uid), {
      nombre, rnc, direccion, telefono,
      propietarioUid: uid, plan: 'basico', creadoEn: serverTimestamp()
    });
    await setDoc(doc(db, 'negocios', uid, 'configuraciones', 'general'), {
      itbisPct: 18, itbisCliente: true, ncfPrefijo: 'B01', ncfSeq: 1
    });
    await setDoc(doc(db, 'negocios', uid, 'empleados', uid), {
      nombre: 'Administrador', email, rol: 'admin', uid, activo: true, creadoEn: serverTimestamp()
    });
    showAuthMsg('Registro exitoso. Inicia sesión.', 'success');
    authTab('login');
  } catch (e) {
    let msg = 'Error al registrar. ';
    if (e.code === 'auth/email-already-in-use') msg += 'Ese email ya está registrado.';
    else msg += e.message;
    showAuthMsg(msg, 'error');
  }
}

function showAuthMsg(msg, type) {
  const el = document.getElementById('auth-msg');
  el.className  = `auth-msg ${type}`;
  el.textContent = msg;
}
