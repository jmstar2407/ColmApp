// miColmApp — core.js
// Firebase, auth, sistema offline, estado global, multi-tab, pantallas, nav, caja, suscripción inventario

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, collectionGroup, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, Timestamp, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";


// ── Helpers globales expuestos en window ──
window.fmt = (n) => 'RD$ ' + (parseFloat(n) || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
window.fmtNum = (n) => (parseFloat(n) || 0).toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

window._calcSubtotal = function(carrito) {
  return carrito.reduce((s, i) => {
  if (i.comboActivo && i.comboPrecio && i.comboUnidades >= 2)
   return s + window.calcularPrecioConCombo(i.qty, i.precio, i.comboPrecio, i.comboUnidades);
  if (i._precioBase !== undefined) return s + i._precioBase * i.qty;
  return s + i.precio * i.qty;
  }, 0);
};

window._calcTotal = function(carrito, cfg) {
  cfg = cfg || window.config || {};
  const sub = window._calcSubtotal(carrito);
  const pct = cfg.itbisPct || 18;
  const itbis = cfg.itbisCliente === true ? sub * (pct / 100) : 0;
  return { subtotal: sub, itbis, total: sub + itbis, itbisPct: pct };
};


import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
  import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
  import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, collectionGroup, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot, Timestamp, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
  import { getStorage, ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

  const firebaseConfig = {
   apiKey: "AIzaSyB7cX3O8Nkhg5XYsuH1UIn0ZDyxoxLzTB4",
   authDomain: "colmapp-4aaa4.firebaseapp.com",
   projectId: "colmapp-4aaa4",
   storageBucket: "colmapp-4aaa4.firebasestorage.app",
   messagingSenderId: "767529335752",
   appId: "1:767529335752:web:5967b10a0e0da050f91efd",
   measurementId: "G-22YKHGWTMH"
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);

  // ── FIRESTORE con persistencia IndexedDB multi-pestaña (API moderna Firebase 10) ──
  // persistentMultipleTabManager: todas las pestañas comparten el mismo caché IndexedDB
  // onSnapshot sirve datos offline sin lecturas a red; escrituras se encolan offline
  const db = initializeFirestore(app, {
   localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });

  const storage = getStorage(app);

  // ── AUTH PERSISTENCE: mantener sesión entre recargas sin consulta extra ──
  setPersistence(auth, browserLocalPersistence).catch(() => {});

  // SISTEMA OFFLINE COMPLETO — Cola de imágenes pendientes + indicadores

  // ── Helper: ejecuta una operación Firestore con timeout offline ──────────
  // Si no hay internet, Firestore encola la op internamente y resuelve
  // INMEDIATAMENTE desde el caché local. Si hay red, resuelve con el servidor.
  // Esto evita que los botones queden colgados con el spinner.
  async function _fsOp(fn, timeoutMs = 4000) {
   if (!navigator.onLine) {
    // Sin red: ejecutar sin esperar confirmación del servidor
    // Firestore offline encola la escritura y la resuelve del caché
    try {
     const result = await Promise.race([
      fn(),
      new Promise(res => setTimeout(() => res({ id: 'offline_' + Date.now() }), 800))
     ]);
     return result;
    } catch(e) {
     // Offline: ignorar error de red, devolver ID local
     return { id: 'offline_' + Date.now() };
    }
   }
   // Con red: ejecutar normalmente
   return await fn();
  }

  // ── Cola de imágenes pendientes (base64 guardadas localmente hasta tener red) ──
  const OFFLINE_IMG_QUEUE_KEY = 'offline_img_queue_v1';

  function _getImgQueue() {
   try { return JSON.parse(localStorage.getItem(OFFLINE_IMG_QUEUE_KEY) || '[]'); } catch { return []; }
  }
  function _saveImgQueue(queue) {
   try { localStorage.setItem(OFFLINE_IMG_QUEUE_KEY, JSON.stringify(queue)); } catch(e) { console.warn('No se pudo guardar cola de imágenes:', e); }
  }
  function _addToImgQueue(entry) {
   const queue = _getImgQueue();
   // Reemplazar si ya existe el mismo path
   const idx = queue.findIndex(e => e.path === entry.path);
   if (idx >= 0) queue[idx] = entry; else queue.push(entry);
   _saveImgQueue(queue);
   _actualizarBadgePendientes();
  }
  function _removeFromImgQueue(path) {
   const queue = _getImgQueue().filter(e => e.path !== path);
   _saveImgQueue(queue);
   _actualizarBadgePendientes();
  }
  // Actualiza el firestorePath de una entrada en la cola (útil cuando se crea un doc nuevo y se conoce su ID después)
  function _actualizarFirestoreEnCola(dataUrlOrPath, firestorePath, field) {
   const queue = _getImgQueue();
   // Buscar por dataUrl (cuando no tenemos el path exacto)
   const idx = queue.findIndex(e => e.dataUrl === dataUrlOrPath || e.path === dataUrlOrPath);
   if (idx >= 0) {
    queue[idx].firestorePath = firestorePath;
    queue[idx].field = field || 'imagen';
    _saveImgQueue(queue);
   }
  }

  // ── Actualizar badge de operaciones pendientes ──
  function _actualizarBadgePendientes() {
   const queue = _getImgQueue();
   const badge = document.getElementById('offline-badge');
   if (!badge) return;
   const offline = !navigator.onLine;
   if (offline) {
    badge.style.display = 'flex';
    badge.innerHTML = '<i class="fas fa-wifi-slash"></i> SIN CONEXIÓN';
   } else if (queue.length > 0) {
    badge.style.display = 'flex';
    badge.style.background = '#e67700';
    badge.innerHTML = `<i class="fas fa-sync fa-spin"></i> Sincronizando ${queue.length} imagen${queue.length > 1 ? 'es' : ''}...`;
   } else {
    badge.style.display = 'none';
    badge.style.background = '#e03131';
   }
  }

  // ── Sincronizar imágenes pendientes cuando vuelve la conexión ──
  async function _sincronizarImagenesPendientes() {
   const queue = _getImgQueue();
   if (!queue.length) return;
   console.log(`[Offline] Sincronizando ${queue.length} imagen(es) pendiente(s)...`);
   _actualizarBadgePendientes();

   for (const entry of [...queue]) {
    try {
     const imgRef = ref(storage, entry.path);
     await uploadString(imgRef, entry.dataUrl, 'data_url');
     const downloadURL = await getDownloadURL(imgRef);
     // Actualizar el documento en Firestore con la URL real
     if (entry.firestorePath && entry.field) {
      const parts = entry.firestorePath.split('/');
      let docRef;
      if (parts.length === 2) docRef = doc(db, parts[0], parts[1]);
      else if (parts.length === 4) docRef = doc(db, parts[0], parts[1], parts[2], parts[3]);
      else if (parts.length === 6) docRef = doc(db, parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]);
      if (docRef) await updateDoc(docRef, { [entry.field]: downloadURL });
     }
     _removeFromImgQueue(entry.path);
     console.log(`[Offline] Imagen sincronizada: ${entry.path}`);
    } catch(e) {
     console.warn(`[Offline] Error sincronizando imagen ${entry.path}:`, e);
    }
   }
   _actualizarBadgePendientes();
   const remaining = _getImgQueue().length;
   if (remaining === 0) {
    toast('✅ Datos sincronizados con Firebase', 'success', 3000);
   }
  }

  // ── INDICADOR OFFLINE/ONLINE ──────────────────────────────────────────────
  function _actualizarBadgeOffline() {
   _actualizarBadgePendientes();
  }
  window.addEventListener('online', async () => {
   _actualizarBadgePendientes();
   // Esperar un momento para que Firebase se reconecte
   setTimeout(async () => {
    await _sincronizarImagenesPendientes();
   }, 2000);
  });
  window.addEventListener('offline', _actualizarBadgeOffline);
  _actualizarBadgeOffline(); // estado inicial
  let negocioId = null;
  let negocioData = null;
  let currentUser = null;
  let userRole = null;
  let categorias = [];
  let productos = [];

  // Exponer al scope global para exportar/importar inventario
  Object.defineProperty(window, '_db', { get: () => db, configurable: true });
  Object.defineProperty(window, '_negocioId', { get: () => negocioId, configurable: true });
  Object.defineProperty(window, 'categorias', { get: () => categorias, set: v => { categorias = v; }, configurable: true });
  Object.defineProperty(window, 'productos', { get: () => productos, set: v => { productos = v; }, configurable: true });

  let _invStats = { total: 0, unidades: 0, dinero: 0, porCategoria: {} }; // caché de estadísticas, se recalcula solo cuando productos cambia
  let cajaActual = null;
  let config = { itbisPct: 18, itbisCliente: false, ncfPrefijo: 'B01', ncfSeq: 1 }; // itbisCliente arranca false hasta que Firebase confirme el valor real
  let modoPrueba = false; // Modo de prueba: no guarda facturas ni descuenta stock

  window.toggleModoPrueba = (activo) => {
   modoPrueba = activo;
   // Guardar en localStorage para persistir por sesión
   try { localStorage.setItem(`modo_prueba_${negocioId || 'default'}`, activo ? '1' : '0'); } catch(e) {}
   _aplicarModoPrueba();
  };

  function _aplicarModoPrueba() {
   const badge  = document.getElementById('modo-prueba-badge');
   const warn   = document.getElementById('modo-prueba-warning');
   const chk    = document.getElementById('cfg-modo-prueba');
   if (badge) badge.style.display = modoPrueba ? 'flex' : 'none';
   if (warn)  warn.style.display  = modoPrueba ? 'block' : 'none';
   if (chk)   chk.checked = modoPrueba;
   // Cambiar color del navbar brand icon para indicar modo prueba
   const brandIcon = document.querySelector('.navbar .brand-icon');
   if (brandIcon) {
    brandIcon.style.background = modoPrueba
     ? 'linear-gradient(135deg, #f59f00, #e67700)'
     : 'var(--verde)';
   }
  }
  let facturasPendientes = [];
  let facturasCache = [];
  let movimientosCache = [];
  let empleadosCache = [];
  let metodoPagoSeleccionado = 'efectivo';
  let estadoFacturaSeleccionado = 'pagada';
  let categoriaActual = null;
  let gridSize = localStorage.getItem('pos_grid_size') === 'pequena' ? 'pequena' : 'grande';
  let ordenProductos = localStorage.getItem('pos_orden_productos') || 'original'; // 'original' | 'az'
  let invViewGrid = true;
  let chartVentas = null, chartProductos = null, chartMetodos = null;
  let unsubscribers = [];
  let productoEnEdicion = null;
  let facturaActualParaImprimir = null;
  let unsubCategorias = null;
  let _unsubProductos = {}; // suscripciones en tiempo real por categoría
  let _unsubConfig = null;  // suscripción en tiempo real de configuración
  let _unsubEmpleados = null; // suscripción en tiempo real de empleados

  // NUEVAS VARIABLES PARA DIBUJO
  let signaturePad = null;
  let dibujoDataURL = null;

  // NUEVAS VARIABLES PARA INVENTARIO
  let inventarioCategoriaActual = null;
  let inventarioBusquedaActual = '';
  let modoOrdenActivo = false;

  // Cada factura: { id, nombre, carrito[], direccion, dibujoDataURL }
  let facturasTabs = [];
  let facturaTabActiva = null;

  // Guarda el dibujo de UNA tab en su propia clave (separado del JSON principal)
  function _guardarDibujoTab(tabId, dataURL) {
   if (!negocioId || !tabId) return;
   const key = `dibujo_${negocioId}_${tabId}`;
   try {
    if (dataURL) {
     localStorage.setItem(key, dataURL);
    } else {
     localStorage.removeItem(key);
    }
   } catch (e) {
    console.warn('No se pudo guardar el dibujo en localStorage:', e);
   }
  }

  // Carga el dibujo de una tab desde su propia clave
  function _cargarDibujoTab(tabId) {
   if (!negocioId || !tabId) return null;
   try {
    return localStorage.getItem(`dibujo_${negocioId}_${tabId}`) || null;
   } catch (e) { return null; }
  }

  // Elimina el dibujo guardado de una tab (al cerrarla)
  function _eliminarDibujoTab(tabId) {
   if (!negocioId || !tabId) return;
   try { localStorage.removeItem(`dibujo_${negocioId}_${tabId}`); } catch (e) { }
  }

  function _guardarTabsEnStorage() {
   if (!negocioId) return;
   try {
    // Guardar tabs SIN el dibujoDataURL (eso va en claves separadas)
    const data = facturasTabs.map(t => ({
     id: t.id,
     nombre: t.nombre,
     carrito: t.carrito,
     direccion: t.direccion || ''
    }));
    localStorage.setItem(`tabs_${negocioId}`, JSON.stringify(data));
    localStorage.setItem(`tab_activa_${negocioId}`, facturaTabActiva || '');
   } catch (e) { }
  }

  function _cargarTabsDeStorage() {
   if (!negocioId) return;
   try {
    const raw = localStorage.getItem(`tabs_${negocioId}`);
    if (raw) {
     const parsed = JSON.parse(raw);
     if (Array.isArray(parsed) && parsed.length) {
      // Cargar cada tab y recuperar su dibujo desde su clave propia
      facturasTabs = parsed.map(t => ({
       ...t,
       dibujoDataURL: _cargarDibujoTab(t.id)
      }));
     }
    }
    const activa = localStorage.getItem(`tab_activa_${negocioId}`);
    if (activa && facturasTabs.find(t => t.id === activa)) {
     facturaTabActiva = activa;
    } else if (facturasTabs.length) {
     facturaTabActiva = facturasTabs[0].id;
    }
   } catch (e) { }
  }

  function _crearNuevaTab(nombre) {
   const id = 'tab_' + Date.now();
   const n = nombre || `Factura ${facturasTabs.length + 1}`;
   facturasTabs.push({ id, nombre: n, carrito: [], direccion: '', dibujoDataURL: null });
   return id;
  }

  function _getTabActiva() {
   return facturasTabs.find(t => t.id === facturaTabActiva) || null;
  }

  // Getter/setter del carrito que ahora apunta a la tab activa
  function getCarrito() {
   return _getTabActiva()?.carrito || [];
  }
  function setCarrito(arr) {
   const tab = _getTabActiva();
   if (tab) { tab.carrito = arr; _guardarTabsEnStorage(); }
  }

  function renderFacturasTabs() {
   const bar = document.getElementById('facturas-tabs-bar');
   if (!bar) return;
   bar.innerHTML = facturasTabs.map(t => {
    const count = t.carrito.length; // cantidad de productos distintos, no suma de unidades
    const activa = t.id === facturaTabActiva;
    return `<button class="factura-tab${activa ? ' activa' : ''}" onclick="seleccionarTab('${t.id}')">
     <span>${t.nombre}</span>
     ${count > 0 ? `<span class="tab-badge">${count}</span>` : ''}
     ${facturasTabs.length > 1 ? `<span class="tab-close" onclick="event.stopPropagation();cerrarTab('${t.id}')" title="Cerrar" role="button" tabindex="0"><i class="fas fa-times"></i></span>` : ''}
    </button>`;
   }).join('') + `<button class="btn-nueva-factura-tab" onclick="nuevaFacturaTab()" title="Nueva factura">+</button>`;
   _actualizarBotonesScroll();
  }

  function _actualizarBotonesScroll() {
   const bar = document.getElementById('facturas-tabs-bar');
   const btnL = document.getElementById('tabs-scroll-left');
   const btnR = document.getElementById('tabs-scroll-right');
   if (!bar || !btnL || !btnR) return;
   const overflow = bar.scrollWidth > bar.clientWidth + 2;
   btnL.classList.toggle('visible', overflow);
   btnR.classList.toggle('visible', overflow);
  }

  window.scrollTabs = (dir) => {
   const bar = document.getElementById('facturas-tabs-bar');
   if (!bar) return;
   bar.scrollBy({ left: dir * 120, behavior: 'smooth' });
  };

  // Actualizar botones al hacer scroll manual en la barra
  document.addEventListener('DOMContentLoaded', () => {
   const bar = document.getElementById('facturas-tabs-bar');
   if (bar) bar.addEventListener('scroll', _actualizarBotonesScroll);
  });
  window.seleccionarTab = (id) => {
   // Guardar estado actual antes de cambiar
   const tabAnterior = _getTabActiva();
   if (tabAnterior) {
    const dirInput = document.getElementById('pos-direccion-cliente');
    if (dirInput) tabAnterior.direccion = dirInput.value;
    // Guardar dibujo actual con clave propia de esa tab
    const dataAnterior = (signaturePad && !signaturePad.isEmpty()) ? signaturePad.toDataURL() : null;
    tabAnterior.dibujoDataURL = dataAnterior;
    _guardarDibujoTab(tabAnterior.id, dataAnterior);
   }
   facturaTabActiva = id;
   _guardarTabsEnStorage();
   renderFacturasTabs();
   renderCarrito();
   // Restaurar estado de la nueva tab
   const tab = _getTabActiva();
   const dirInput = document.getElementById('pos-direccion-cliente');
   if (dirInput && tab) dirInput.value = tab.direccion || '';
   // Actualizar visibilidad del botón "x" de dirección
   _syncClearBtn('pos-direccion-cliente', 'pos-dir-clear');
   // Restaurar dibujo de la nueva tab
   dibujoDataURL = tab?.dibujoDataURL || null;
   if (signaturePad) {
    signaturePad.clear();
    if (dibujoDataURL) {
     signaturePad.fromDataURL(dibujoDataURL);
    }
   }
   _actualizarBtnLimpiar();
   // Scroll a la tab activa
   setTimeout(() => {
    const bar = document.getElementById('facturas-tabs-bar');
    const tabActEl = bar?.querySelector('.factura-tab.activa');
    if (tabActEl) tabActEl.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
   }, 50);
  };

  window.nuevaFacturaTab = () => {
   // Guardar dibujo de la tab actual con su clave propia
   const tabAnterior = _getTabActiva();
   if (tabAnterior && signaturePad) {
    const dataAnterior = signaturePad.isEmpty() ? null : signaturePad.toDataURL();
    tabAnterior.dibujoDataURL = dataAnterior;
    _guardarDibujoTab(tabAnterior.id, dataAnterior);
   }
   const id = _crearNuevaTab();
   facturaTabActiva = id;
   _guardarTabsEnStorage();
   renderFacturasTabs();
   renderCarrito();
   const dirInput = document.getElementById('pos-direccion-cliente');
   if (dirInput) dirInput.value = '';
   _syncClearBtn('pos-direccion-cliente', 'pos-dir-clear');
   // Nueva tab empieza sin dibujo
   dibujoDataURL = null;
   if (signaturePad) signaturePad.clear();
   _actualizarBtnLimpiar();
  };

  let _tabPendienteCerrar = null;

  window.cerrarTab = (id) => {
   const tab = facturasTabs.find(t => t.id === id);
   if (!tab) return;
   _tabPendienteCerrar = id;
   const qty = tab.carrito.length; // cantidad de productos distintos
   const msg = document.getElementById('modal-cerrar-tab-msg');
   if (qty > 0) {
    msg.innerHTML = `¿Eliminar <strong>"${tab.nombre}"</strong>?<br><span style="color:#888;font-size:13px;">Se perderán los ${qty} producto${qty !== 1 ? 's' : ''} en el carrito.</span>`;
   } else {
    msg.innerHTML = `¿Cerrar <strong>"${tab.nombre}"</strong>?<br><span style="color:#888;font-size:13px;">El carrito está vacío.</span>`;
   }
   abrirModal('modal-cerrar-tab');
  };

  window.confirmarCerrarTab = () => {
   const id = _tabPendienteCerrar;
   if (!id) return;
   _tabPendienteCerrar = null;
   cerrarModal('modal-cerrar-tab');
   _eliminarDibujoTab(id); // limpiar clave de dibujo
   facturasTabs = facturasTabs.filter(t => t.id !== id);
   if (!facturasTabs.length) _crearNuevaTab('Factura 1');
   if (facturaTabActiva === id) facturaTabActiva = facturasTabs[0].id;
   _guardarTabsEnStorage();
   renderFacturasTabs();
   renderCarrito();
   const tabNueva = _getTabActiva();
   const dirInput = document.getElementById('pos-direccion-cliente');
   if (dirInput && tabNueva) dirInput.value = tabNueva.direccion || '';
   _syncClearBtn('pos-direccion-cliente', 'pos-dir-clear');
   // Restaurar dibujo de la tab que quedó activa
   dibujoDataURL = tabNueva?.dibujoDataURL || null;
   if (signaturePad) {
    signaturePad.clear();
    if (dibujoDataURL) signaturePad.fromDataURL(dibujoDataURL);
   }
   _actualizarBtnLimpiar();
  };

  // Retrocompatibilidad: variable carrito apunta a la tab activa
  Object.defineProperty(window, 'carrito', {
   get() { return getCarrito(); },
   set(v) { setCarrito(v); }
  });

  // Actualizar botones scroll al cambiar tamaño de ventana
  window.addEventListener('resize', _actualizarBotonesScroll);

  window.toggleNavMenu = (e) => {
   e.stopPropagation();
   const dd = document.getElementById('nav-menu-dropdown');
   dd.classList.toggle('open');
  };
  window.closeNavMenu = () => {
   const dd = document.getElementById('nav-menu-dropdown');
   if (dd) dd.classList.remove('open');
  };
  // Cerrar al hacer clic fuera
  document.addEventListener('click', (e) => {
   const wrap = document.getElementById('nav-menu-wrap');
   if (wrap && !wrap.contains(e.target)) closeNavMenu();
  });

  (function () {
   const STORAGE_KEY = 'vk_enabled';
   window._vkEnabled = localStorage.getItem(STORAGE_KEY) !== 'false'; // default ON

   function updateBtn() {
    const btn = document.getElementById('btn-vk-toggle');
    if (!btn) return;
    if (window._vkEnabled) {
     btn.classList.add('active');
     btn.title = 'Teclado virtual: ACTIVO (clic para desactivar)';
    } else {
     btn.classList.remove('active');
     btn.title = 'Teclado virtual: INACTIVO (clic para activar)';
    }
   }

   // Parchear vkbOpen: esperar a que virtualKeyboard.js lo defina y luego envolverlo
   function patchVkbOpen() {
    // Si ya está parchado, salir
    if (window._vkbOpenOriginal) return;
    if (typeof window.vkbClose !== 'function') return; // aún no cargó el módulo

    // En este punto el módulo ya cargó — buscamos vkbOpen dentro del closure
    // La forma más directa: sobreescribir attachVkbToInput para que los nuevos
    // listeners respeten la bandera, y además parchamos vkbOpen si está expuesto.
    // Como vkbOpen NO está expuesta globalmente, usamos otro truco:
    // guardamos el attachVkbToInput original y lo envolvemos.
    const origAttach = window.attachVkbToInput;
    window.attachVkbToInput = function (inputId) {
     if (!window._vkEnabled) return; // no conectar si está desactivado
     origAttach(inputId);
    };

    // Para los inputs YA conectados (pos-buscar, pos-direccion-cliente),
    // bloqueamos el teclado interceptando el focus/touchstart en la fase de captura
    ['pos-buscar', 'pos-direccion-cliente'].forEach(id => {
     const el = document.getElementById(id);
     if (!el) return;
     el.addEventListener('focus', (e) => {
      if (!window._vkEnabled) {
       // Cerrar el teclado si llegara a abrirse
       if (typeof window.vkbClose === 'function') window.vkbClose();
      }
     }, true); // captura = antes que el listener del módulo
     el.addEventListener('touchstart', (e) => {
      if (!window._vkEnabled) {
       if (typeof window.vkbClose === 'function') window.vkbClose();
      }
     }, { capture: true, passive: true });
    });

    window._vkbOpenOriginal = true; // marcado como parchado
   }

   window.toggleVirtualKeyboard = function () {
    window._vkEnabled = !window._vkEnabled;
    localStorage.setItem(STORAGE_KEY, window._vkEnabled);
    updateBtn();
    // Si se desactiva, cerrar el teclado si está abierto
    if (!window._vkEnabled && typeof window.vkbClose === 'function') {
     window.vkbClose();
    }
   };

   // Aplicar botón y parche cuando el DOM esté listo
   function init() {
    updateBtn();
    patchVkbOpen();
    // Reintentar el parche por si virtualKeyboard.js carga después
    if (!window._vkbOpenOriginal) {
     setTimeout(() => { patchVkbOpen(); updateBtn(); }, 200);
     setTimeout(() => { patchVkbOpen(); updateBtn(); }, 800);
     setTimeout(() => { patchVkbOpen(); updateBtn(); }, 2000);
    }
   }

   if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
   } else {
    init();
   }
   window.addEventListener('load', init);
  })();

  function updateDatetime() {
   const now = new Date();
   const opts = { timeZone: 'America/Santo_Domingo', hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' };
   const dateOpts = { timeZone: 'America/Santo_Domingo', weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
   const el = document.getElementById('nav-datetime');
   if (el) el.innerHTML = `${now.toLocaleDateString('es-DO', dateOpts)}<br>${now.toLocaleTimeString('es-DO', opts)}`;
  }
  setInterval(updateDatetime, 1000);
  updateDatetime();

  window.authTab = (tab) => {
   document.getElementById('auth-login').style.display = tab === 'login' ? 'block' : 'none';
   document.getElementById('auth-registro').style.display = tab === 'registro' ? 'block' : 'none';
   document.querySelectorAll('.auth-tab').forEach((b, i) => b.classList.toggle('active', (i === 0) === (tab === 'login')));
  };

  window.login = async () => {
   const email = document.getElementById('login-email').value.trim();
   const pass = document.getElementById('login-pass').value;
   if (!email || !pass) { showAuthMsg('Completa todos los campos', 'error'); return; }
   try {
    showAuthMsg('Iniciando sesión...', 'success');
    await signInWithEmailAndPassword(auth, email, pass);
   } catch (e) {
    showAuthMsg('Credenciales incorrectas. Verifica tu email y contraseña.', 'error');
   }
  };


  window.selTipoNegocio = (prefix, tipo) => {
   const container = document.getElementById(`${prefix}-reg-tipo-btns`);
   const hidden = document.getElementById(`${prefix}-reg-tipo`);
   if (!container || !hidden) return;
   hidden.value = tipo;
   const colores = {
    colmado:    { border: '#1971c2', bg: '#eff6ff', color: '#1971c2' },
    restaurante:{ border: '#e67700', bg: '#fff9db', color: '#e67700' },
    bebida:     { border: '#2f9e44', bg: '#ebfbee', color: '#2f9e44' },
   };
   container.querySelectorAll('.tipo-negocio-btn').forEach(btn => {
    const t = btn.dataset.tipo;
    const activo = t === tipo;
    const c = activo ? colores[t] : null;
    btn.style.border    = activo ? `2px solid ${c.border}` : '2px solid #e2e8f0';
    btn.style.background = activo ? c.bg : '#f8f9ff';
    btn.style.color      = activo ? c.color : '#4a5568';
   });
  };

  // Registrar primer negocio (desde pantalla de auth, usuario nuevo)
  window.registrar = async () => {
   const nombre = document.getElementById('reg-nombre').value.trim();
   const tipo = document.getElementById('reg-tipo').value || 'colmado';
   const rnc = document.getElementById('reg-rnc').value.trim();
   const direccion = document.getElementById('reg-direccion').value.trim();
   const telefono = document.getElementById('reg-telefono').value.trim();
   const email = document.getElementById('reg-email').value.trim();
   const pass = document.getElementById('reg-pass').value;
   if (!nombre || !email || !pass) { showAuthMsg('Nombre, email y contraseña son requeridos', 'error'); return; }
   if (pass.length < 6) { showAuthMsg('La contraseña debe tener mínimo 6 caracteres', 'error'); return; }
   try {
    showAuthMsg('Registrando negocio...', 'success');
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const uid = cred.user.uid;
    // Crear negocio con ID único (no el UID del usuario para soportar múltiples negocios)
    const negRef = await addDoc(collection(db, 'negocios'), {
     nombre, tipo, rnc, direccion, telefono,
     propietarioUid: uid,
     administradores: [uid],
     plan: 'basico',
     creadoEn: serverTimestamp()
    });
    const negId = negRef.id;
    await setDoc(doc(db, 'negocios', negId, 'configuraciones', 'general'), { itbisPct: 18, itbisCliente: true, ncfPrefijo: 'B01', ncfSeq: 1 });
    await setDoc(doc(db, 'negocios', negId, 'empleados', uid), { nombre: 'Administrador', email, rol: 'admin', uid, activo: true, creadoEn: serverTimestamp() });
    // Registrar este negocio en el perfil del usuario
    await setDoc(doc(db, 'usuarios', uid), { email, negociosAdmin: [negId], creadoEn: serverTimestamp() }, { merge: true });
    showAuthMsg('Registro exitoso. Inicia sesión.', 'success');
    authTab('login');
   } catch (e) {
    let msg = 'Error al registrar. ';
    if (e.code === 'auth/email-already-in-use') msg += 'Ese email ya está registrado.';
    else msg += e.message;
    showAuthMsg(msg, 'error');
   }
  };

  // Logout total: desconecta completamente de Firebase Auth
  window.logoutTotal = async () => {
   _limpiarSesionNegocio();
   await signOut(auth);
  };

  // Logout de negocio: vuelve al selector sin cerrar sesión Firebase
  window.cambiarNegocio = () => {
   _limpiarSesionNegocio();
   if (currentUser) mostrarSelectorNegocios(currentUser);
  };

  // Alias legacy por si algún lugar llama logout()
  window.logout = window.logoutTotal;

  function _limpiarSesionNegocio() {
   unsubscribers.forEach(u => u && u());
   unsubscribers = [];
   if (unsubCategorias) { unsubCategorias(); unsubCategorias = null; }
   // Cancelar todas las suscripciones de productos por categoría
   Object.values(_unsubProductos).forEach(u => u && u());
   _unsubProductos = {};
   // Cancelar suscripciones de config y empleados
   if (_unsubConfig) { _unsubConfig(); _unsubConfig = null; }
   if (_unsubEmpleados) { _unsubEmpleados(); _unsubEmpleados = null; }
   empleadosCache = [];
   // Limpiar caché de grids DOM
   Object.keys(_gridCache).forEach(k => delete _gridCache[k]);
   categoriaActual = null;
   negocioId = null;
   negocioData = null;
   // Limpiar el negocio activo en cache
   if (currentUser) localStorage.removeItem(`negocio_activo_${currentUser.uid}`);
  }

  function showAuthMsg(msg, type) {
   const el = document.getElementById('auth-msg');
   el.className = `auth-msg ${type}`;
   el.textContent = msg;
  }

  async function mostrarSelectorNegocios(user) {
   showScreen('selector');
   const lista = document.getElementById('ns-lista');
   lista.innerHTML = `<div style="text-align:center;padding:20px;color:#aab4c8;"><i class="fas fa-spinner fa-spin"></i> Cargando negocios...</div>`;
   document.getElementById('ns-bienvenida').textContent = `Bienvenido, ${user.email}`;
   try {
    // Buscar todos los negocios donde el usuario es admin/empleado
    const negociosIds = await _obtenerNegociosDelUsuario(user);
    if (!negociosIds.length) {
     // Si offline, buscar en caché local
     if (!navigator.onLine) {
      lista.innerHTML = `<div style="text-align:center;padding:20px;color:#e67700;"><i class="fas fa-wifi-slash" style="font-size:2rem;display:block;margin-bottom:8px;"></i><strong>Sin conexión</strong><br><span style="font-size:13px;">Inicia sesión con internet al menos una vez para usar el modo offline.</span></div>`;
     } else {
      lista.innerHTML = `<div style="text-align:center;padding:20px;color:#aab4c8;"><i class="fas fa-store-slash" style="font-size:2rem;display:block;margin-bottom:8px;"></i>No tienes ningún negocio registrado.<br>Agrega tu primer negocio.</div>`;
     }
     return;
    }
    // Obtener datos de cada negocio (Firestore los sirve desde caché offline)
    const negocios = await Promise.all(negociosIds.map(async id => {
     try {
      const snap = await getDoc(doc(db, 'negocios', id));
      if (snap.exists()) {
       // Actualizar caché local
       try { localStorage.setItem(`negocio_data_${id}`, JSON.stringify(snap.data())); } catch(e) {}
       return { id, ...snap.data() };
      }
      // Fallback a caché local
      const cached = localStorage.getItem(`negocio_data_${id}`);
      return cached ? { id, ...JSON.parse(cached) } : null;
     } catch(e) {
      const cached = localStorage.getItem(`negocio_data_${id}`);
      return cached ? { id, ...JSON.parse(cached) } : null;
     }
    }));
    const negociosValidos = negocios.filter(Boolean);
    const offlineBanner = !navigator.onLine ? `<div style="background:#fff3cd;border:1px solid #ffc107;border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:#664d03;"><i class="fas fa-wifi-slash"></i> <strong>Modo offline</strong> — Los cambios se sincronizarán al volver la conexión</div>` : '';
    lista.innerHTML = offlineBanner + negociosValidos.map(neg => `
     <div onclick="entrarAlNegocio('${neg.id}')" style="
      display:flex;align-items:center;gap:14px;
      background:#f8f9ff;border:2px solid #e2e8f0;border-radius:14px;
      padding:16px 18px;cursor:pointer;transition:all 0.18s;
     " onmouseover="this.style.borderColor='#1971c2';this.style.background='#eff6ff'"
      onmouseout="this.style.borderColor='#e2e8f0';this.style.background='#f8f9ff'">
      <div style="width:48px;height:48px;background:linear-gradient(135deg,#1971c2,#1864ab);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">🏪</div>
      <div style="flex:1;min-width:0;">
       <div style="font-weight:700;font-size:15px;color:#1a2135;">${neg.nombre || 'Sin nombre'}</div>
       <div style="font-size:12px;color:#718096;margin-top:2px;">${neg.direccion || ''}</div>
      </div>
      <i class="fas fa-chevron-right" style="color:#a0aec0;font-size:14px;"></i>
     </div>`).join('');
   } catch (e) {
    lista.innerHTML = `<div style="color:#e03131;text-align:center;padding:16px;">Error al cargar negocios: ${e.message}</div>`;
   }
  }

  async function _obtenerNegociosDelUsuario(user) {
   const ids = new Set();
   // 1. Buscar en colección "usuarios" (fuente principal)
   try {
    const userSnap = await getDoc(doc(db, 'usuarios', user.uid));
    if (userSnap.exists()) {
     (userSnap.data().negociosAdmin || []).forEach(id => ids.add(id));
    }
   } catch (e) { /* continuar */ }
   // 2. Buscar negocios donde sea propietario (legacy: ID = UID del propietario)
   try {
    const legacySnap = await getDoc(doc(db, 'negocios', user.uid));
    if (legacySnap.exists()) ids.add(user.uid);
   } catch (e) { /* continuar */ }
   // 3. Buscar usando collectionGroup: todos los docs "empleados" con este uid
   try {
    const empQuery = query(collectionGroup(db, 'empleados'), where('uid', '==', user.uid));
    const empSnap = await getDocs(empQuery);
    empSnap.forEach(d => {
     // El path es: negocios/{negocioId}/empleados/{uid}
     const negId = d.ref.parent.parent.id;
     if (negId) ids.add(negId);
    });
   } catch (e) { /* continuar — puede requerir índice en Firestore */ }
   // 4. Cache local como último recurso
   try {
    const cachedNeg = localStorage.getItem(`negocio_${user.uid}`);
    if (cachedNeg) ids.add(cachedNeg);
   } catch (e) { /* continuar */ }
   return [...ids];
  }

  window.entrarAlNegocio = async (negId) => {
   showScreen('loading');
   try {
    // Firestore con persistentLocalCache sirve datos desde caché offline automáticamente
    const negSnap = await getDoc(doc(db, 'negocios', negId));
    if (!negSnap.exists()) {
     // Intentar cargar desde caché local si estamos offline
     const cachedNeg = localStorage.getItem(`negocio_data_${negId}`);
     if (cachedNeg) {
      negocioId = negId;
      negocioData = JSON.parse(cachedNeg);
      userRole = localStorage.getItem(`negocio_role_${negId}_${currentUser.uid}`) || 'admin';
      localStorage.setItem(`negocio_activo_${currentUser.uid}`, negId);
      await initApp();
      if (!navigator.onLine) toast('📱 Modo offline — datos del caché local', 'warning', 3000);
      return;
     }
     toast('Negocio no encontrado', 'error'); showScreen('selector'); return;
    }
    negocioId = negId;
    negocioData = negSnap.data();
    // Guardar en caché local para modo offline
    try { localStorage.setItem(`negocio_data_${negId}`, JSON.stringify(negocioData)); } catch(e) {}
    const empSnap = await getDoc(doc(db, 'negocios', negocioId, 'empleados', currentUser.uid));
    if (empSnap.exists()) { userRole = empSnap.data().rol; }
    else { userRole = negocioData.propietarioUid === currentUser.uid ? 'admin' : 'empleado'; }
    try { localStorage.setItem(`negocio_role_${negId}_${currentUser.uid}`, userRole); } catch(e) {}
    // Recordar el negocio activo
    localStorage.setItem(`negocio_activo_${currentUser.uid}`, negId);
    localStorage.setItem(`negocio_${currentUser.uid}`, negId);
    await initApp();
    if (!navigator.onLine) toast('📱 Modo offline — los cambios se sincronizarán al volver la conexión', 'warning', 4000);
   } catch (e) {
    // Si falla por offline, intentar con caché local
    if (!navigator.onLine || e.code === 'unavailable') {
     const cachedNeg = localStorage.getItem(`negocio_data_${negId}`);
     if (cachedNeg) {
      negocioId = negId;
      negocioData = JSON.parse(cachedNeg);
      userRole = localStorage.getItem(`negocio_role_${negId}_${currentUser.uid}`) || 'admin';
      localStorage.setItem(`negocio_activo_${currentUser.uid}`, negId);
      try { await initApp(); } catch(e2) { console.error(e2); }
      toast('📱 Modo offline — funcionando con datos locales', 'warning', 4000);
      return;
     }
    }
    toast('Error al entrar al negocio: ' + e.message, 'error');
    showScreen('selector');
   }
  };

  // Abrir modal para agregar nuevo negocio desde el selector
  window.abrirAgregarNegocio = () => {
   ['ns-reg-nombre','ns-reg-rnc','ns-reg-direccion','ns-reg-telefono'].forEach(id => document.getElementById(id).value = '');
   selTipoNegocio('ns', 'colmado'); // resetear tipo al abrir
   document.getElementById('ns-reg-msg').textContent = '';
   document.getElementById('ns-modal-nuevo').style.display = 'flex';
   _modalStack.push('ns-modal-nuevo');
   history.pushState({ modalOpen: 'ns-modal-nuevo', stackLen: _modalStack.length }, '', window.location.href);
  };
  window.cerrarAgregarNegocio = () => {
   document.getElementById('ns-modal-nuevo').style.display = 'none';
   const idx = _modalStack.lastIndexOf('ns-modal-nuevo');
   if (idx !== -1) _modalStack.splice(idx, 1);
  };

  window.registrarNuevoNegocio = async () => {
   const nombre = document.getElementById('ns-reg-nombre').value.trim();
   const tipo = document.getElementById('ns-reg-tipo').value || 'colmado';
   const rnc = document.getElementById('ns-reg-rnc').value.trim();
   const direccion = document.getElementById('ns-reg-direccion').value.trim();
   const telefono = document.getElementById('ns-reg-telefono').value.trim();
   const msgEl = document.getElementById('ns-reg-msg');
   if (!nombre) { msgEl.style.color = '#e03131'; msgEl.textContent = 'El nombre del negocio es requerido'; return; }
   msgEl.style.color = '#1971c2'; msgEl.textContent = 'Creando negocio...';
   try {
    const uid = currentUser.uid;
    const negRef = await addDoc(collection(db, 'negocios'), {
     nombre, tipo, rnc, direccion, telefono,
     propietarioUid: uid,
     administradores: [uid],
     plan: 'basico',
     creadoEn: serverTimestamp()
    });
    const negId = negRef.id;
    await setDoc(doc(db, 'negocios', negId, 'configuraciones', 'general'), { itbisPct: 18, itbisCliente: true, ncfPrefijo: 'B01', ncfSeq: 1 });
    await setDoc(doc(db, 'negocios', negId, 'empleados', uid), { nombre: 'Administrador', email: currentUser.email, rol: 'admin', uid, activo: true, creadoEn: serverTimestamp() });
    // Agregar a la lista de negocios del usuario
    const userRef = doc(db, 'usuarios', uid);
    const userSnap = await getDoc(userRef);
    const listaActual = userSnap.exists() ? (userSnap.data().negociosAdmin || []) : [];
    if (!listaActual.includes(negId)) {
     await setDoc(userRef, { email: currentUser.email, negociosAdmin: [...listaActual, negId] }, { merge: true });
    }
    msgEl.style.color = '#00b341'; msgEl.textContent = '¡Negocio creado!';
    setTimeout(() => {
     cerrarAgregarNegocio();
     mostrarSelectorNegocios(currentUser);
    }, 800);
   } catch (e) {
    msgEl.style.color = '#e03131'; msgEl.textContent = 'Error: ' + e.message;
   }
  };

  onAuthStateChanged(auth, async (user) => {
   if (user) {
    currentUser = user;
    // Verificar si había un negocio activo en sesión anterior
    const negActivo = localStorage.getItem(`negocio_activo_${user.uid}`);
    if (negActivo) {
     // Intentar entrar directamente al negocio activo
     await entrarAlNegocio(negActivo);
    } else {
     await mostrarSelectorNegocios(user);
    }
   } else {
    currentUser = null;
    negocioId = null;
    negocioData = null;
    showScreen('auth');
   }
  });

  async function loadNegocio(user) {
   // Mantenido por compatibilidad — ya no se usa directamente
   await mostrarSelectorNegocios(user);
  }

  async function initApp() {
   showScreen('loading');

   // ── CONFIG: onSnapshot sirve desde caché offline, actualiza en vivo si hay red ──
   if (_unsubConfig) { _unsubConfig(); _unsubConfig = null; }
   _unsubConfig = onSnapshot(
    doc(db, 'negocios', negocioId, 'configuraciones', 'general'),
    (snap) => {
     if (snap.exists()) {
      config = { itbisPct: 18, itbisCliente: true, ncfPrefijo: 'B01', ncfSeq: 1, ...snap.data() };
      // Reflejar en UI de config si ya está montada
      const el = document.getElementById('cfg-itbis-pct');
      if (el) el.value = config.itbisPct ?? 18;
     }
    },
    () => {} // ignorar error — usar config default
   );

   // ── EMPLEADOS: onSnapshot mantiene empleadosCache siempre actualizado ─────
   if (_unsubEmpleados) { _unsubEmpleados(); _unsubEmpleados = null; }
   _unsubEmpleados = onSnapshot(
    collection(db, 'negocios', negocioId, 'empleados'),
    (snap) => {
     empleadosCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
     // Si la página de config ya está visible, re-renderizar lista de empleados
     if (document.getElementById('page-config')?.classList.contains('active')) {
      renderEmpleados();
     }
    },
    () => {} // ignorar error offline
   );

   document.getElementById('nav-negocio-nombre').textContent = negocioData.nombre || 'Mi Colmado';
   buildNavbar();
   // Restaurar modo prueba desde localStorage
   try {
    const savedModo = localStorage.getItem(`modo_prueba_${negocioId}`);
    if (savedModo !== null) modoPrueba = savedModo === '1';
   } catch(e) {}
   _aplicarModoPrueba();

   suscribirCaja();
   suscribirInventario();

   // Inicializar sistema multi-factura
   _cargarTabsDeStorage();
   if (!facturasTabs.length) { _crearNuevaTab('Factura 1'); facturaTabActiva = facturasTabs[0].id; }
   if (!facturaTabActiva) facturaTabActiva = facturasTabs[0].id;

   // Restaurar dibujo de la tab activa al cargar
   const tabInicial = _getTabActiva();
   if (tabInicial?.dibujoDataURL) { dibujoDataURL = tabInicial.dibujoDataURL; }

   inicializarSignaturePad();
   // Restaurar estado del panel de dibujo DESPUÉS de inicializar el pad y cargar el dibujo
   restaurarEstadoDibujo();
   // Actualizar color del botón limpiar según si hay dibujo guardado
   _actualizarBtnLimpiar();

   // Restaurar botones de grid según preferencia guardada
   const bg = document.getElementById('btn-grid-grande');
   const bp = document.getElementById('btn-grid-peq');
   if (bg) bg.classList.toggle('active', gridSize === 'grande');
   if (bp) bp.classList.toggle('active', gridSize === 'pequena');

   showScreen('app');
   showPage('pos');
   // Sincronizar imágenes pendientes si hay conexión
   if (navigator.onLine) {
    setTimeout(_sincronizarImagenesPendientes, 3000);
   }

   // Restaurar dirección del cliente de la tab activa al refrescar
   const dirInputInit = document.getElementById('pos-direccion-cliente');
   if (dirInputInit && tabInicial?.direccion) {
    dirInputInit.value = tabInicial.direccion;
    const dirClearBtn = document.getElementById('pos-dir-clear');
    if (dirClearBtn) dirClearBtn.style.display = tabInicial.direccion ? 'flex' : 'none';
   }
   _syncClearBtn('pos-direccion-cliente', 'pos-dir-clear');
   _syncClearBtn('pos-buscar', 'pos-buscar-clear');

   // Verificar si hay pedido entrante en la URL
   setTimeout(() => { manejarPedidoEntrante(); }, 800);
  }

  function showScreen(screen) {
   document.getElementById('loading-screen').style.display = screen === 'loading' ? 'flex' : 'none';
   document.getElementById('auth-screen').style.display = screen === 'auth' ? 'flex' : 'none';
   document.getElementById('negocio-selector-screen').style.display = screen === 'selector' ? 'flex' : 'none';
   document.getElementById('app').style.display = screen === 'app' ? 'flex' : 'none';
  }

  function buildNavbar() {
   // Mostrar email del usuario en el menú
   const emailEl = document.getElementById('nav-email-txt');
   if (emailEl && currentUser) emailEl.textContent = currentUser.email;
   const btns = document.getElementById('nav-buttons');
   const pages = [
    { id: 'pos', label: 'Facturación', icon: 'fa-cash-register', roles: ['admin', 'empleado'] },
    { id: 'caja', label: 'Caja', icon: 'fa-cash-register', roles: ['admin', 'empleado'] },
    { id: 'facturas', label: 'Facturas', icon: 'fa-file-invoice', roles: ['admin', 'empleado'] },
    { id: 'inventario', label: 'Inventario', icon: 'fa-boxes', roles: ['admin'] },
    { id: 'estadisticas', label: 'Contab.', icon: 'fa-chart-line', roles: ['admin'] },
    { id: 'config', label: 'Config.', icon: 'fa-cog', roles: ['admin'] },
   ];
   const visiblePages = pages.filter(p => p.roles.includes(userRole));
   const abierta = !!cajaActual;

   // Desktop nav buttons
   btns.innerHTML = visiblePages.map(p => {
    if (p.id === 'caja') {
     const dot = `<span class="caja-status-dot ${abierta ? 'abierta' : 'cerrada'}"></span>`;
     return `<div style="position:relative;display:inline-flex;align-items:center;"><button class="nav-btn" id="navbtn-${p.id}" onclick="showPage('${p.id}')"><i class="fas ${p.icon}"></i> ${p.label}</button>${dot}</div>`;
    }
    return `<button class="nav-btn" id="navbtn-${p.id}" onclick="showPage('${p.id}')"><i class="fas ${p.icon}"></i> ${p.label}</button>`;
   }).join('');

   // Mobile bottom nav
   const mobNav = document.getElementById('mobile-bottom-nav');
   if (mobNav) {
    const pagesHtml = visiblePages.map(p => {
     const dot = p.id === 'caja'
      ? `<span class="mob-caja-dot ${abierta ? 'abierta' : 'cerrada'}"></span>` : '';
     return `<button class="mob-nav-btn" id="mob-navbtn-${p.id}" onclick="showPage('${p.id}')">
      ${dot}<i class="fas ${p.icon}"></i><span>${p.label}</span>
     </button>`;
    }).join('');
    // Slot para el botón de menú (3 puntos) — el elemento real se mueve aquí con CSS
    mobNav.innerHTML = pagesHtml + '<div class="mob-nav-menu-slot" id="mob-nav-menu-slot"></div>';
    // Mover el nav-menu-wrap al slot del bottom nav en móvil
    const menuWrap = document.getElementById('nav-menu-wrap');
    const slot = document.getElementById('mob-nav-menu-slot');
    if (menuWrap && slot) slot.appendChild(menuWrap);
   }
  }

  window.showPage = (pageId) => {
   document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
   document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
   document.querySelectorAll('.mob-nav-btn').forEach(b => b.classList.remove('active'));
   const page = document.getElementById(`page-${pageId}`);
   if (page) page.classList.add('active');
   const btn = document.getElementById(`navbtn-${pageId}`);
   if (btn) btn.classList.add('active');
   const mobBtn = document.getElementById(`mob-navbtn-${pageId}`);
   if (mobBtn) mobBtn.classList.add('active');
   // FAB solo visible en la sección de facturación (POS)
   document.body.classList.toggle('en-pos', pageId === 'pos');
   if (window._actualizarVisibilidadFab) window._actualizarVisibilidadFab();
   if (pageId === 'estadisticas') { estadisticasHoy(); }
   if (pageId === 'inventario') { renderInventario(); populateCatSelects(); }
   if (pageId === 'config') { renderConfig(); renderEmpleados(); }
   if (pageId === 'facturas') { cargarFacturas(); }
   if (pageId === 'caja') { renderCaja(); }
   if (pageId === 'pos') {
    renderFacturasTabs();
    renderCarrito();
    // Asegurar que el grid de la categoría activa sea visible
    if (categoriaActual && !_gridNecesitaActualizar(categoriaActual)) {
     _mostrarGrid(categoriaActual);
    } else if (categoriaActual) {
     _llenarGrid(categoriaActual);
     _mostrarGrid(categoriaActual);
    }
   }
  };

  function suscribirInventario() {
   if (unsubCategorias) unsubCategorias();
   const catsRef = collection(db, 'negocios', negocioId, 'categorias');
   unsubCategorias = onSnapshot(catsRef, (snap) => {
    const nuevasCats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    nuevasCats.sort((a, b) => {
     const oa = a.orden ?? 9999;
     const ob = b.orden ?? 9999;
     if (oa !== ob) return oa - ob;
     return (a.nombre || '').localeCompare(b.nombre || '');
    });

    // Detectar si las categorías realmente cambiaron antes de re-renderizar
    const catsStr = JSON.stringify(nuevasCats);
    const catsAnteriorStr = JSON.stringify(categorias);
    const catsChanged = catsStr !== catsAnteriorStr;

    categorias = nuevasCats;

    if (catsChanged) {
     renderCategoriasPos();
     populateCatSelects();
    }

    // Suscribir productos de categorías nuevas, desuscribir las eliminadas
    _sincronizarSuscripcionesProductos();
   });
  }

  function _sincronizarSuscripcionesProductos() {
   const catIds = new Set(categorias.map(c => c.id));

   // Desuscribir categorías eliminadas
   Object.keys(_unsubProductos).forEach(catId => {
    if (!catIds.has(catId)) {
     _unsubProductos[catId]();
     delete _unsubProductos[catId];
     // Eliminar productos de esa categoría
     productos = productos.filter(p => p.categoriaId !== catId);
    }
   });

   // Suscribir categorías nuevas
   categorias.forEach(cat => {
    if (_unsubProductos[cat.id]) return; // ya suscrita
    const prodsRef = collection(db, 'negocios', negocioId, 'categorias', cat.id, 'productos');
    _unsubProductos[cat.id] = onSnapshot(prodsRef, (snap) => {
     _actualizarProductosDeCat(cat.id, snap);
    });
   });
  }

  function _actualizarProductosDeCat(catId, snap) {
   const cat = categorias.find(c => c.id === catId);
   const catNombre = cat ? cat.nombre : '';

   const nuevosDeEstaCat = snap.docs.map(d => ({
    id: d.id,
    categoriaId: catId,
    categoriaNombre: catNombre,
    ...d.data()
   }));

   // Detectar si algo realmente cambió para esta categoría
   const anterioresDeEstaCat = productos.filter(p => p.categoriaId === catId);
   const anteriorStr = JSON.stringify(anterioresDeEstaCat.map(p => ({ ...p })).sort((a,b) => a.id.localeCompare(b.id)));
   const nuevoStr = JSON.stringify(nuevosDeEstaCat.map(p => ({ ...p })).sort((a,b) => a.id.localeCompare(b.id)));

   if (anteriorStr === nuevoStr) return; // Sin cambios reales, no re-renderizar

   // Reemplazar productos de esta categoría
   productos = productos.filter(p => p.categoriaId !== catId).concat(nuevosDeEstaCat);
   productos.sort((a, b) => {
    if (a.categoriaId !== b.categoriaId) return 0;
    return (a.orden ?? 9999) - (b.orden ?? 9999);
   });

   _recalcularInvStats();
   actualizar

// Broadcast + Sync + POS Resizer
  // Un único canal compartido. Dos roles según si esta pestaña tiene ?c=&p= en la URL:
  //
  //  A) PESTAÑA PRINCIPAL (sin params): escucha y procesa pedidos entrantes de otras pestañas.
  //  B) PESTAÑA NUEVA (con params):     intenta ceder el pedido a la pestaña principal y cerrarse.
  //     Si en 800 ms nadie responde, carga el pedido ella misma (fallback normal).
  (function () {
   const params = new URLSearchParams(window.location.search);
   const cParam = params.get('c');
   const pParam = params.get('p');
   const esPestañaNueva = !!(cParam && pParam); // esta pestaña se abrió con el enlace

   const bc = new BroadcastChannel('micolmapp_pedido');
   window._bcColmApp = bc;

   if (!esPestañaNueva) {
    // ── ROL A: pestaña principal ──
    // Responde a sondeos y procesa pedidos delegados por otras pestañas.
    bc.onmessage = async (ev) => {
     const { tipo, c, p } = ev.data || {};
     if (tipo === 'hay_alguien') {
      bc.postMessage({ tipo: 'app_activa' });
     }
     if (tipo === 'pedido_entrante' && c && p) {
      bc.postMessage({ tipo: 'pedido_recibido', p });
      await window._manejarPedidoEntranteConParams(c, p);
     }
    };

   } else {
    // ── ROL B: pestaña nueva con ?c=&p= ──
    // Intenta ceder el pedido a la pestaña principal antes de cargarlo aquí.
    let cedido = false;

    bc.onmessage = (ev) => {
     if (ev.data?.tipo === 'app_activa' && !cedido) {
      // Hay una pestaña principal activa → delegarle el pedido
      bc.postMessage({ tipo: 'pedido_entrante', c: cParam, p: pParam });
     }
     if (ev.data?.tipo === 'pedido_recibido' && ev.data?.p === pParam && !cedido) {
      cedido = true;
      bc.close();
      history.replaceState({}, '', window.location.pathname);
      window.close();
      // Fallback si el browser bloquea window.close()
      setTimeout(() => {
       if (!window.closed) {
        document.body.innerHTML = `
         <div style="font-family:sans-serif;display:flex;flex-direction:column;align-items:center;
          justify-content:center;min-height:100vh;gap:16px;background:#f5f7fa;color:#1a2135;">
          <div style="font-size:3rem;">✅</div>
          <div style="font-weight:700;font-size:1.1rem;">Pedido cargado en miColmApp</div>
          <div style="color:#475569;font-size:.9rem;">Puedes cerrar esta pestaña.</div>
         </div>`;
       }
      }, 400);
     }
    };

    // Sondear si hay una pestaña principal activa
    bc.postMessage({ tipo: 'hay_alguien' });

    // Si en 800 ms nadie respondió → no hay pestaña principal, cargar aquí mismo
    setTimeout(() => {
     if (!cedido) {
      bc.close();
      // manejarPedidoEntrante() leerá los params de la URL normalmente
     }
    }, 800);
   }
  })();

  // Si la URL tiene ?c=colmadoId&p=pedidoId, cargar el pedido y crear una tab con los datos
  // Función interna reutilizable (llamada desde URL o desde BroadcastChannel)
  async function _cargarPedidoConParams(cParam, pParam) {
   toast('📦 Cargando pedido entrante...', 'info', 5000);
   try {
    const pedidoRef = doc(db, 'negocios', cParam, 'pedidos_cliente', pParam);
    const pedidoSnap = await getDoc(pedidoRef);
    if (!pedidoSnap.exists()) {
     toast('Pedido no encontrado en el enlace', 'error');
     return;
    }
    const data = { id: pedidoSnap.id, ...pedidoSnap.data() };

    // Enriquecer items con imágenes desde el inventario del negocio
    const itemsEnriquecidos = await Promise.all((data.items || []).map(async (item) => {
     try {
      if (item.imagen) return item; // ya tiene imagen
      // Buscar en la colección de productos de la categoría
      if (item.categoriaId && item.id) {
       const prodRef = doc(db, 'negocios', cParam, 'categorias', item.categoriaId, 'productos', item.id);
       const prodSnap = await getDoc(prodRef);
       if (prodSnap.exists()) {
        return { ...item, imagen: prodSnap.data().imagen || null };
       }
      }
     } catch (e) { /* silencioso */ }
     return item;
    }));

    // Crear nueva tab con los datos del pedido
    const tabNombre = data.clienteDireccion || `Pedido ${(pParam).toUpperCase()}`;
    const id = _crearNuevaTab(tabNombre);
    const tab = facturasTabs.find(t => t.id === id);
    if (tab) {
     tab.carrito = itemsEnriquecidos.map(it => ({
      id: it.id || '',
      nombre: it.nombre || 'Producto',
      precio: it.precio || 0,
      qty: it.qty || 1,
      imagen: it.imagen || null,
      categoriaId: it.categoriaId || '',
      stock: 9999 // pedidos entrantes no controlan stock
     }));
     tab.direccion = data.clienteDireccion || '';
     tab.nombre = tabNombre;
     if (data.clienteNombre) tab.clienteNombre = data.clienteNombre;
    }
    facturaTabActiva = id;
    _guardarTabsEnStorage();
    renderFacturasTabs();
    renderCarrito();

    // Rellenar campo dirección
    const dirInput = document.getElementById('pos-direccion-cliente');
    if (dirInput && tab) dirInput.value = tab.direccion || '';
    _syncClearBtn('pos-direccion-cliente', 'pos-dir-clear');

    // Ir al POS
    showPage('pos');
    toast(`✅ Pedido #${pParam.toUpperCase()} de ${data.clienteNombre || 'cliente'} cargado`, 'success', 5000);
   } catch (e) {
    toast('Error cargando pedido: ' + e.message, 'error');
   }
  }

  // Exponer para que el BroadcastChannel lo pueda llamar
  window._manejarPedidoEntranteConParams = _cargarPedidoConParams;

  async function manejarPedidoEntrante() {
   const params = new URLSearchParams(window.location.search);
   const cParam = params.get('c');
   const pParam = params.get('p');
   if (!cParam || !pParam) return false;

   // Limpiar la URL sin recargar
   history.replaceState({}, '', window.location.pathname);

   await _cargarPedidoConParams(cParam, pParam);
   return true;
  }
  // Mapa de input → botón claro para actualización centralizada
  const _clearBtnMap = {};

  window._syncClearBtn = function (inputId, btnId) {
   const inp = document.getElementById(inputId);
   const btn = document.getElementById(btnId);
   if (!inp || !btn) return;
   // Registrar listener una sola vez — es la única fuente de verdad
   if (!_clearBtnMap[inputId]) {
    _clearBtnMap[inputId] = btnId;
    inp.addEventListener('input', () => {
     const b = document.getElementById(_clearBtnMap[inputId]);
     if (b) b.style.display = inp.value.length > 0 ? 'flex' : 'none';
    }, true); // captura: se ejecuta antes que cualquier otro handler
   }
   // Sincronizar estado inmediato
   btn.style.display = inp.value.length > 0 ? 'flex' : 'none';
  };

  (function () {
   const MIN_W = 320;
   const MAX_W = 520;
   const STORAGE_KEY = 'pos_right_width';

   function setRightWidth(w) {
    w = Math.max(MIN_W, Math.min(MAX_W, w));
    document.documentElement.style.setProperty('--pos-right-w', w + 'px');
    localStorage.setItem(STORAGE_KEY, w);
   }

   // Recrear el canvas SOLO al terminar el drag, restaurando el dibujo
   function reajustarCanvas() {
    const container = document.getElementById('dibujo-container');
    if (!container?.classList.contains('visible')) return;
    if (typeof _redimensionarCanvas === 'function') _redimensionarCanvas();
   }

   // Restore saved width
   const saved = parseInt(localStorage.getItem(STORAGE_KEY));
   if (saved) setRightWidth(saved);

   const resizer = document.getElementById('pos-resizer');
   if (!resizer) return;

   // Mouse
   resizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    resizer.classList.add('dragging');
    const startX = e.clientX;
    const startW = parseInt(getComputedStyle(document.getElementById('pos-right')).width);

    function onMove(e) {
     const dx = startX - e.clientX; // drag left = wider
     setRightWidth(startW + dx);
     // NO tocar el canvas durante el drag — el canvas se estira visualmente con CSS width:100%
    }
    function onUp() {
     resizer.classList.remove('dragging');
     document.removeEventListener('mousemove', onMove);
     document.removeEventListener('mouseup', onUp);
     // Solo al soltar: recrear canvas con el nuevo ancho y restaurar el dibujo
     reajustarCanvas();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
   });

   // Touch
   resizer.addEventListener('touchstart', (e) => {
    e.preventDefault();
    resizer.classList.add('dragging');
    const startX = e.touches[0].clientX;
    const startW = parseInt(getComputedStyle(document.getElementById('pos-right')).width);

    function onMove(e) {
     const dx = startX - e.touches[0].clientX;
     setRightWidth(startW + dx);
    }
    function onEnd() {
     resizer.classList.remove('dragging');
     document.removeEventListener('touchmove', onMove);
     document.removeEventListener('touchend', onEnd);
     reajustarCanvas();
    }
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd);
   }, { passive: false });
  })();

  window._manejarPedidoEntrante = manejarPedidoEntrante;
