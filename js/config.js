// miColmApp — config.js
// Configuración del negocio, empleados, países teléfono

function renderEmpleados() { const lista = document.getElementById('empleados-lista'); if (!lista) return; if (!empleadosCache.length) { lista.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Sin empleados</p></div>'; return; } lista.innerHTML = empleadosCache.map(e => `<div class="empleado-row"><div class="empleado-avatar">${(e.nombre || 'E')[0].toUpperCase()}</div><div class="empleado-info"><div class="emp-nombre">${e.nombre}</div><div class="emp-email">${e.email}</div></div><span class="emp-rol ${e.rol}">${e.rol}</span>${e.uid !== currentUser.uid ? `<button class="btn-sm" onclick="eliminarEmpleado('${e.id}')" style="background:#ffe3e3;color:#e03131;padding:6px 10px;font-size:12px;"><i class="fas fa-trash"></i></button>` : ''}</div>`).join(''); }

  window.abrirModalEmpleado = () => { ['emp-nombre', 'emp-email', 'emp-pass'].forEach(id => document.getElementById(id).value = ''); document.getElementById('emp-rol').value = 'empleado'; abrirModal('modal-empleado'); };

  window.guardarEmpleado = async () => {
   const nombre = document.getElementById('emp-nombre').value.trim();
   const email = document.getElementById('emp-email').value.trim();
   const pass = document.getElementById('emp-pass').value;
   const rol = document.getElementById('emp-rol').value;
   if (!nombre || !email || !pass) { toast('Todos los campos son requeridos', 'error'); return; }
   if (pass.length < 6) { toast('La contraseña debe tener mínimo 6 caracteres', 'error'); return; }
   try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const uid = cred.user.uid;
    localStorage.setItem(`negocio_${uid}`, negocioId);
    await setDoc(doc(db, 'negocios', negocioId, 'empleados', uid), { nombre, email, rol, uid, activo: true, creadoEn: serverTimestamp() });
    // Registrar el negocio en el perfil del empleado para que aparezca en su selector
    const userRef = doc(db, 'usuarios', uid);
    await setDoc(userRef, { email, negociosAdmin: [negocioId] }, { merge: true });
    empleadosCache.push({ id: uid, nombre, email, rol, uid });
    renderEmpleados();
    cerrarModal('modal-empleado');
    toast('Empleado agregado', 'success');
   } catch (e) {
    let msg = 'Error: ';
    if (e.code === 'auth/email-already-in-use') msg += 'Ese email ya existe';
    else msg += e.message;
    toast(msg, 'error');
   }
  };

  window.eliminarEmpleado = async (id) => { if (!confirm('¿Eliminar este empleado?')) return; try { await deleteDoc(doc(db, 'negocios', negocioId, 'empleados', id)); empleadosCache = empleadosCache.filter(e => e.id !== id); renderEmpleados(); toast('Empleado eliminado', 'success'); } catch (e) { toast('Error: ' + e.message, 'error'); } };

  function renderConfig() {
   if (!negocioData) return;
   // Cargar estado modo prueba desde localStorage
   try {
    const saved = localStorage.getItem(`modo_prueba_${negocioId}`);
    if (saved !== null) modoPrueba = saved === '1';
   } catch(e) {}
   _aplicarModoPrueba();
   document.getElementById('cfg-nombre').value = negocioData.nombre || '';
   document.getElementById('cfg-rnc').value = negocioData.rnc || '';
   document.getElementById('cfg-direccion').value = negocioData.direccion || '';
   document.getElementById('cfg-ncf-prefijo').value = config.ncfPrefijo || 'B01';
   document.getElementById('cfg-ncf-seq').value = config.ncfSeq || 1;
   document.getElementById('cfg-itbis-pct').value = config.itbisPct || 18;
   document.getElementById('cfg-itbis-cliente').checked = config.itbisCliente === true;
   // Inicializar selectores de países
   initPaisSelects();
   // Cargar teléfono y whatsapp con auto-detección
   const telVal = negocioData.telefono || '';
   const wsVal = negocioData.whatsapp || '';
   document.getElementById('cfg-telefono').value = telVal;
   document.getElementById('cfg-whatsapp').value = wsVal;
   if (telVal) autoDetectPaisTel(telVal, 'cfg-tel-pais', 'cfg-tel-preview');
   else updateTelPreview('cfg-tel-pais', '', 'cfg-tel-preview');
   if (wsVal) autoDetectPaisTel(wsVal, 'cfg-ws-pais', 'cfg-ws-preview');
   else updateTelPreview('cfg-ws-pais', '', 'cfg-ws-preview');
  }

  window.guardarConfig = async () => { try { const telPaisSel = document.getElementById('cfg-tel-pais'); const wsPaisSel = document.getElementById('cfg-ws-pais'); const telPais = PAISES_TEL.find(p => p.code === telPaisSel?.value); const wsPais = PAISES_TEL.find(p => p.code === wsPaisSel?.value); const telRaw = document.getElementById('cfg-telefono').value.trim(); const wsRaw = document.getElementById('cfg-whatsapp').value.trim(); const telFull = telPais && telRaw ? (telRaw.startsWith('+') ? telRaw : telPais.dial + telRaw.replace(/\D/g, '')) : telRaw; const wsFull = wsPais && wsRaw ? (wsRaw.startsWith('+') ? wsRaw : wsPais.dial + wsRaw.replace(/\D/g, '')) : wsRaw; const negUpdate = { nombre: document.getElementById('cfg-nombre').value.trim(), rnc: document.getElementById('cfg-rnc').value.trim(), direccion: document.getElementById('cfg-direccion').value.trim(), telefono: telFull, whatsapp: wsFull }; const cfgUpdate = { ncfPrefijo: document.getElementById('cfg-ncf-prefijo').value.trim() || 'B01', ncfSeq: parseInt(document.getElementById('cfg-ncf-seq').value) || 1, itbisPct: parseFloat(document.getElementById('cfg-itbis-pct').value) || 18, itbisCliente: document.getElementById('cfg-itbis-cliente').checked }; await updateDoc(doc(db, 'negocios', negocioId), negUpdate); await updateDoc(doc(db, 'negocios', negocioId, 'configuraciones', 'general'), cfgUpdate); negocioData = { ...negocioData, ...negUpdate }; config = { ...config, ...cfgUpdate }; document.getElementById('nav-negocio-nombre').textContent = negocioData.nombre || 'Mi Colmado'; toast('Configuración guardada', 'success'); } catch (e) { toast('Error: ' + e.message, 'error'); } };

  window.estadisticasHoy = () => { const hoy = new Date(); document.getElementById('stats-fecha-ini').value = hoy.toISOString().split('T')[0]; document.getElementById('stats-fecha-fin').value = hoy.toISOString().split('T')[0]; calcularEstadisticas(); };

  window.calcularEstadisticas = async () => { const fechaIni = document.getElementById('stats-fecha-ini').value; const fechaFin = document.getElementById('stats-fecha-fin').value; let q; if (fechaIni && fechaFin) { const ini = Timestamp.fromDate(new Date(fechaIni)); const fin = Timestamp.fromDate(new Date(fechaFin + 'T23:59:59')); q = query(collection(db, 'negocios', negocioId, 'facturas'), where('fecha', '>=', ini), where('fecha', '<=', fin), orderBy('fecha', 'asc')); } else { q = query(collection(db, 'negocios', negocioId, 'facturas'), orderBy('fecha', 'desc'), limit(100)); } const snap = await getDocs(q); const facturas = snap.docs.map(d => ({ id: d.id, ...d.data() })); const pagadas = facturas.filter(f => f.estado === 'pagada'); const totalVentas = pagadas.reduce((s, f) => s + (f.total || 0), 0); const numFacturas = pagadas.length; let prodsVendidos = 0; const prodConteo = {}; pagadas.forEach(f => { (f.items || []).forEach(i => { prodsVendidos += i.qty || 0; prodConteo[i.nombre] = (prodConteo[i.nombre] || 0) + (i.qty || 0); }); }); document.getElementById('stat-ventas-total').textContent = fmt(totalVentas); document.getElementById('stat-num-facturas').textContent = numFacturas; document.getElementById('stat-prods-vendidos').textContent = prodsVendidos; document.getElementById('stat-promedio').textContent = numFacturas ? fmt(totalVentas / numFacturas) : 'RD$ 0'; renderCharts(pagadas, prodConteo); await calcularContabilidad(fechaIni, fechaFin); };

  async function calcularContabilidad(fechaIni, fechaFin) { let q; if (fechaIni && fechaFin) { const ini = Timestamp.fromDate(new Date(fechaIni)); const fin = Timestamp.fromDate(new Date(fechaFin + 'T23:59:59')); q = query(collection(db, 'negocios', negocioId, 'movimientos'), where('fecha', '>=', ini), where('fecha', '<=', fin)); } else { q = query(collection(db, 'negocios', negocioId, 'movimientos'), limit(500)); } const snap = await getDocs(q); const movs = snap.docs.map(d => d.data()); const ingresos = movs.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + (m.monto || 0), 0); const egresos = movs.filter(m => m.tipo === 'gasto').reduce((s, m) => s + (m.monto || 0), 0); document.getElementById('contab-ingresos').textContent = fmt(ingresos); document.getElementById('contab-egresos').textContent = fmt(egresos); document.getElementById('contab-ganancia').textContent = fmt(ingresos - egresos); }

  function renderCharts(facturas, prodConteo) {
   const ventasPorDia = {}; facturas.forEach(f => { const fecha = f.fecha?.toDate ? f.fecha.toDate().toLocaleDateString('es-DO') : 'Sin fecha'; ventasPorDia[fecha] = (ventasPorDia[fecha] || 0) + (f.total || 0); });
   if (chartVentas) chartVentas.destroy(); const ctxV = document.getElementById('chart-ventas'); if (ctxV) { chartVentas = new Chart(ctxV, { type: 'bar', data: { labels: Object.keys(ventasPorDia), datasets: [{ label: 'Ventas', data: Object.values(ventasPorDia), backgroundColor: '#00b341', borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } }); }
   const topProds = Object.entries(prodConteo).sort((a, b) => b[1] - a[1]).slice(0, 8); if (chartProductos) chartProductos.destroy(); const ctxP = document.getElementById('chart-productos'); if (ctxP) { chartProductos = new Chart(ctxP, { type: 'bar', data: { labels: topProds.map(p => p[0]), datasets: [{ label: 'Cantidad', data: topProds.map(p => p[1]), backgroundColor: '#1971c2', borderRadius: 6 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } }); }
   const metodos = { efectivo: 0, transferencia: 0, tarjeta: 0 }; facturas.forEach(f => { if (metodos.hasOwnProperty(f.metodoPago)) metodos[f.metodoPago] += f.total || 0; }); if (chartMetodos) chartMetodos.destroy(); const ctxM = document.getElementById('chart-metodos'); if (ctxM) { chartMetodos = new Chart(ctxM, { type: 'doughnut', data: { labels: ['Efectivo', 'Transferencia', 'Tarjeta'], datasets: [{ data: [metodos.efectivo, metodos.transferencia, metodos.tarjeta], backgroundColor: ['#00b341', '#1971c2', '#ffd100'] }] }, options: { responsive: true, plugins: { legend: { position: 'bottom' } } } }); }
  }

  window.exportarMovimientos = () => { let csv = 'Hora,Tipo,Descripción,Empleado,Monto\n'; movimientosCache.forEach(m => { const fecha = m.fecha?.toDate ? m.fecha.toDate().toLocaleTimeString('es-DO') : '-'; csv += `"${fecha}","${m.tipo}","${m.descripcion}","${m.empleadoNombre || '-'}","${m.monto}"\n`; }); const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `movimientos_${new Date().toLocaleDateString('es-DO')}.csv`; a.click(); };

  function fmt(val) { return `RD$ ${(val || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
  function fmtNum(val) { const n = parseFloat(val) || 0; if (Number.isInteger(n)) return n; const r = parseFloat(n.toFixed(2)); return Number.isInteger(r) ? r : r.toFixed(2); }

  // ── MODAL HISTORY MANAGER ────────────────────────────────────────────
  // Mantiene un stack de modales abiertos. Cada vez que se abre un modal
  // se empuja una entrada al historial del navegador, y cuando el usuario
  // presiona "atrás" (popstate) se cierra el modal más reciente en lugar
  // de salir de la página.
  const _modalStack = [];
  window._modalStack = _modalStack;

  window.abrirModal = (id) => {
   const el = document.getElementById(id);
   if (!el) return;
   el.classList.add('visible');
   _modalStack.push(id);
   // Empujamos una entrada al historial para "capturar" el botón atrás
   history.pushState({ modalOpen: id, stackLen: _modalStack.length }, '', window.location.href);
  };

  window.cerrarModal = (id) => {
   const el = document.getElementById(id);
   if (!el) return;
   el.classList.remove('visible');
   // Quitar del stack (puede estar en cualquier posición si se cerró programáticamente)
   const idx = _modalStack.lastIndexOf(id);
   if (idx !== -1) _modalStack.splice(idx, 1);
  };

  // Interceptar el botón atrás del navegador / gesto en móvil
  window.addEventListener('popstate', (e) => {
   if (_modalStack.length > 0) {
    // Cerrar el modal más reciente
    const topId = _modalStack[_modalStack.length - 1];
    const el = document.getElementById(topId);
    if (el) el.classList.remove('visible');
    _modalStack.pop();
    // Si todavía quedan modales en el stack, re-empujamos una entrada
    // para que el próximo "atrás" también sea interceptado
    if (_modalStack.length > 0) {
     history.pushState({ modalOpen: _modalStack[_modalStack.length - 1], stackLen: _modalStack.length }, '', window.location.href);
    }
   }
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
   overlay.addEventListener('click', (e) => {
    // El modal-producto NO se cierra al hacer clic afuera
    if (overlay.id === 'modal-producto') return;
    if (e.target === overlay) {
     // Usar cerrarModal para que también limpie el stack y el historial
     if (_modalStack.length > 0) {
      history.back(); // dispara popstate → cierra el modal
     } else {
      overlay.classList.remove('visible');
     }
    }
   });
  });

  function toast(msg, type = 'info', duration = 3200) {
   // Eliminar toast previo si existe
   const prev = document.getElementById('_toast_global');
   if (prev) prev.remove();

   const colors = {
    success: { bg: '#00b341', icon: '✅' },
    error:   { bg: '#e03131', icon: '❌' },
    info:    { bg: '#1971c2', icon: 'ℹ️'  },
    warning: { bg: '#f59f00', icon: '⚠️'  },
   };
   const c = colors[type] || colors.info;

   const el = document.createElement('div');
   el.id = '_toast_global';
   el.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: ${c.bg};
    color: white;
    padding: 12px 22px;
    border-radius: 40px;
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 700;
    box-shadow: 0 6px 24px rgba(0,0,0,0.22);
    z-index: 99999;
    max-width: 90vw;
    text-align: center;
    opacity: 0;
    transition: all 0.25s ease;
    pointer-events: none;
    white-space: pre-line;
   `;
   el.textContent = `${c.icon}  ${msg}`;
   document.body.appendChild(el);

   requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
   });

   setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(20px)';
    setTimeout(() => el.remove(), 300);
   }, duration);
  }
  window.toast = toast;

  setTimeout(() => { if (document.getElementById('loading-screen').style.display !== 'none') { const authState = auth.currentUser; if (!authState) showScreen('auth'); } }, 2500);

  const PAISES_TEL = [
   { code: 'DO', flag: '🇩🇴', name: 'Rep. Dominicana', dial: '+1', areaCodes: ['809', '829', '849'] },
   { code: 'US', flag: '🇺🇸', name: 'Estados Unidos', dial: '+1', areaCodes: ['201', '202', '203', '212', '213', '305', '310', '312', '347', '404', '415', '424', '469', '512', '602', '646', '702', '713', '718', '786', '917'] },
   { code: 'MX', flag: '🇲🇽', name: 'México', dial: '+52', areaCodes: ['55', '33', '81'] },
   { code: 'CO', flag: '🇨🇴', name: 'Colombia', dial: '+57', areaCodes: ['1', '2', '4', '5', '6', '7', '8'] },
   { code: 'VE', flag: '🇻🇪', name: 'Venezuela', dial: '+58', areaCodes: ['212', '412', '414', '416', '424', '426'] },
   { code: 'PR', flag: '🇵🇷', name: 'Puerto Rico', dial: '+1', areaCodes: ['787', '939'] },
   { code: 'HT', flag: '🇭🇹', name: 'Haití', dial: '+509', areaCodes: [] },
   { code: 'CU', flag: '🇨🇺', name: 'Cuba', dial: '+53', areaCodes: [] },
   { code: 'PA', flag: '🇵🇦', name: 'Panamá', dial: '+507', areaCodes: [] },
   { code: 'GT', flag: '🇬🇹', name: 'Guatemala', dial: '+502', areaCodes: [] },
   { code: 'HN', flag: '🇭🇳', name: 'Honduras', dial: '+504', areaCodes: [] },
   { code: 'SV', flag: '🇸🇻', name: 'El Salvador', dial: '+503', areaCodes: [] },
   { code: 'NI', flag: '🇳🇮', name: 'Nicaragua', dial: '+505', areaCodes: [] },
   { code: 'CR', flag: '🇨🇷', name: 'Costa Rica', dial: '+506', areaCodes: [] },
   { code: 'EC', flag: '🇪🇨', name: 'Ecuador', dial: '+593', areaCodes: [] },
   { code: 'PE', flag: '🇵🇪', name: 'Perú', dial: '+51', areaCodes: [] },
   { code: 'CL', flag: '🇨🇱', name: 'Chile', dial: '+56', areaCodes: [] },
   { code: 'AR', flag: '🇦🇷', name: 'Argentina', dial: '+54', areaCodes: [] },
   { code: 'BO', flag: '🇧🇴', name: 'Bolivia', dial: '+591', areaCodes: [] },
   { code: 'PY', flag: '🇵🇾', name: 'Paraguay', dial: '+595', areaCodes: [] },
   { code: 'UY', flag: '🇺🇾', name: 'Uruguay', dial: '+598', areaCodes: [] },
   { code: 'BR', flag: '🇧🇷', name: 'Brasil', dial: '+55', areaCodes: [] },
   { code: 'ES', flag: '🇪🇸', name: 'España', dial: '+34', areaCodes: [] },
   { code: 'CA', flag: '🇨🇦', name: 'Canadá', dial: '+1', areaCodes: ['416', '604', '613', '647', '780', '905'] },
  ];

  function initPaisSelects() {
   ['cfg-tel-pais', 'cfg-ws-pais'].forEach(selId => {
    const sel = document.getElementById(selId);
    if (!sel || sel.options.length > 1) return;
    sel.innerHTML = PAISES_TEL.map(p =>
     `<option value="${p.code}">${p.flag} ${p.dial}</option>`
    ).join('');
    sel.value = 'DO'; // default RD
   });
  }

  function autoDetectPaisTel(numero, selId, previewId) {
   const sel = document.getElementById(selId);
   if (!sel) return;
   const digits = numero.replace(/\D/g, '');
   let detectado = null;
   // Detectar por código de área (primeros 3 dígitos sin +1)
   const area3 = digits.substring(0, 3);
   const area2 = digits.substring(0, 2);
   for (const p of PAISES_TEL) {
    if (p.areaCodes.includes(area3) || p.areaCodes.includes(area2)) {
     detectado = p;
     break;
    }
   }
   // Si el número empieza con + detectar por dial code
   if (!detectado && numero.startsWith('+')) {
    for (const p of PAISES_TEL) {
     const dialDigits = p.dial.replace('+', '');
     if (digits.startsWith(dialDigits) && dialDigits.length > 1) {
      detectado = p; break;
     }
    }
   }
   if (detectado) sel.value = detectado.code;
   updateTelPreview(selId, numero, previewId);
  }

  function updateTelPreview(selId, numero, previewId) {
   const sel = document.getElementById(selId);
   const prev = document.getElementById(previewId);
   if (!prev || !sel) return;
   const pais = PAISES_TEL.find(p => p.code === sel.value);
   if (!pais || !numero) { prev.textContent = ''; return; }
   const digits = numero.replace(/\D/g, '');
   const full = pais.dial + digits;
   prev.textContent = `${pais.flag} Número completo: ${full}`;
  }

  window.onChangeTelPais = (code, inputId, previewId) => {
   const input = document.getElementById(inputId);
   if (input) updateTelPreview(
    document.getElementById(previewId)?.id.includes('ws') ? 'cfg-ws-pais' : 'cfg-tel-pais',
    input.value, previewId
   );
  };

// Cámara escáner

  //  CÁMARA ESCÁNER — lógica
  (function() {
  let _camStream   = null;
  let _barDetector = null;
  let _scanLoop    = null;
  let _scanning    = false;
  let _destino     = null; // 'prod-barcode' | callback fn

  // Abrir cámara y dirigir resultado a un input
  window.abrirCamaraScanner = function(destinoInputId) {
   _destino = destinoInputId || 'prod-barcode';
   document.getElementById('modal-camara-scanner').classList.add('visible');
   document.getElementById('cam-result-banner').classList.remove('visible');
   document.getElementById('cam-error-banner').classList.remove('visible');
   document.getElementById('cam-manual-input').value = '';
   _setStatus('Iniciando cámara...');
   _iniciarCamara();
   if (window._modalStack) {
    window._modalStack.push('modal-camara-scanner');
    history.pushState({ modalOpen: 'modal-camara-scanner', stackLen: window._modalStack.length }, '', window.location.href);
   }
  };

  window.cerrarCamaraScanner = function() {
   _detenerCamara();
   document.getElementById('modal-camara-scanner').classList.remove('visible');
   if (window._modalStack) {
    const idx = window._modalStack.lastIndexOf('modal-camara-scanner');
    if (idx !== -1) window._modalStack.splice(idx, 1);
   }
  };

  window.confirmarCodigoCamara = function() {
   const val = document.getElementById('cam-manual-input').value.trim();
   if (!val) return;
   _entregarCodigo(val);
  };

  function _setStatus(msg) {
   const el = document.getElementById('cam-status-text');
   if (el) el.innerHTML = msg;
  }

  function _mostrarResultado(code) {
   const banner = document.getElementById('cam-result-banner');
   const txt    = document.getElementById('cam-result-text');
   if (txt) txt.textContent = '✅ Código: ' + code;
   if (banner) banner.classList.add('visible');
  }

  function _mostrarError(msg) {
   const banner = document.getElementById('cam-error-banner');
   const txt    = document.getElementById('cam-error-text');
   if (txt) txt.textContent = msg;
   if (banner) banner.classList.add('visible');
   _setStatus('Ingresa el código manualmente ↓');
  }

  async function _iniciarCamara() {
   try {
    _camStream = await navigator.mediaDevices.getUserMedia({
     video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    const vid = document.getElementById('cam-video');
    vid.srcObject = _camStream;
    await vid.play();
    _setStatus('<strong>Apunta al código de barras</strong>');

    // Usar BarcodeDetector si está disponible (Chrome Android / algunos iOS)
    if ('BarcodeDetector' in window) {
     _barDetector = new BarcodeDetector({ formats: [
      'code_128','code_39','ean_13','ean_8','upc_a','upc_e',
      'qr_code','data_matrix','codabar','itf'
     ]});
     _scanning = true;
     _loopDetect();
    } else {
     // Fallback: solo entrada manual
     _setStatus('Tu navegador no soporta escaneo automático.<br><strong>Usa el campo manual ↓</strong>');
    }
   } catch(err) {
    _mostrarError('No se pudo acceder a la cámara. Revisa los permisos.');
    console.warn('Cam error:', err);
   }
  }

  function _loopDetect() {
   if (!_scanning) return;
   const vid = document.getElementById('cam-video');
   if (!vid || vid.readyState < 2) { _scanLoop = requestAnimationFrame(_loopDetect); return; }
   _barDetector.detect(vid).then(codes => {
    if (codes.length > 0) {
     const code = codes[0].rawValue;
     _scanning = false;
     cancelAnimationFrame(_scanLoop);
     _entregarCodigo(code);
    } else {
     _scanLoop = requestAnimationFrame(_loopDetect);
    }
   }).catch(() => {
    _scanLoop = requestAnimationFrame(_loopDetect);
   });
  }

  function _entregarCodigo(code) {
   _mostrarResultado(code);

   // Si viene del scanner de POS móvil, buscar por código de barras y agregar al carrito
   if (window._scannerDestinoPos) {
    window._scannerDestinoPos = false;
    setTimeout(() => {
     cerrarCamaraScanner();
     if (window.productos) {
      const prod = window.productos.find(p => p.codigoBarras === code);
      if (prod) {
       if (window.agregarAlCarrito) window.agregarAlCarrito(prod.id);
       if (window.toast) toast('✅ ' + prod.nombre + ' agregado al carrito', 'success', 2500);
      } else {
       const inp = document.getElementById('pos-buscar');
       if (inp) {
        inp.value = code;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        if (window.buscarProductos) window.buscarProductos(code);
       }
       if (window.toast) toast('🔍 Buscando: ' + code, 'info', 2000);
      }
     }
    }, 600);
    return;
   }

   // Poner en el input destino (comportamiento normal)
   const inp = document.getElementById(_destino);
   if (inp) {
    inp.value = code;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
   }
   // Activar modo "scanBtnActive" del escáner global si aplica
   if (window._bcScanner) window._bcScanner.scanBtnActive = false;
   // Toast y cerrar después de un momento
   setTimeout(() => {
    if (window.toast) toast('✅ Código capturado: ' + code, 'success', 2500);
    cerrarCamaraScanner();
   }, 700);
  }

  function _detenerCamara() {
   _scanning = false;
   if (_scanLoop) { cancelAnimationFrame(_scanLoop); _scanLoop = null; }
   if (_camStream) {
    _camStream.getTracks().forEach(t => t.stop());
    _camStream = null;
   }
   const vid = document.getElementById('cam-video');
   if (vid) { vid.srcObject = null; }
  }

  // Cerrar al hacer clic en el fondo oscuro
  document.getElementById('modal-camara-scanner').addEventListener('click', function(e) {
   if (e.target === this) cerrarCamaraScanner();
  });
  })();
  

// Mobile FAB toggle

  //  MOBILE POS TOGGLE — productos ↔ carrito
  //  FAB solo visible en sección Facturación (POS)
  (function () {
  let _mobVistaCarrito = false;

  function _esMobile() { return window.innerWidth <= 768; }

  // Mostrar/ocultar FAB según la página activa
  window._actualizarVisibilidadFab = function () {
   const fab    = document.getElementById('mob-carrito-fab');
   const enPos  = document.body.classList.contains('en-pos');
   if (!fab) return;
   fab.style.display = (_esMobile() && enPos) ? 'flex' : 'none';
  };

  window.mobToggleCarrito = function (forzar) {
   if (typeof forzar === 'boolean') _mobVistaCarrito = forzar;
   else _mobVistaCarrito = !_mobVistaCarrito;
   _aplicarVista();
  };

  function _aplicarVista() {
   if (!_esMobile()) return;
   const posRight  = document.getElementById('pos-right');
   const posCenter = document.querySelector('.pos-center');
   const fab       = document.getElementById('mob-carrito-fab');
   const fabLabel  = document.getElementById('fab-label');
   const fabIcon   = document.getElementById('fab-icon-i');
   if (!posRight || !posCenter || !fab) return;

   if (_mobVistaCarrito) {
    posRight.classList.add('mob-visible');
    posCenter.classList.add('mob-hidden');
    fab.classList.add('modo-carrito');
    fabLabel.textContent = 'Ver Productos';
    fabIcon.className = 'fas fa-store';
   } else {
    posRight.classList.remove('mob-visible');
    posCenter.classList.remove('mob-hidden');
    fab.classList.remove('modo-carrito');
    fabLabel.textContent = 'Ver Carrito';
    fabIcon.className = 'fas fa-shopping-cart';
   }
  }

  window._actualizarFabBadge = function (n) {
   const badge = document.getElementById('fab-badge');
   if (!badge) return;
   badge.textContent = n;
   badge.classList.toggle('visible', n > 0);
  };

  window.addEventListener('resize', () => {
   if (!_esMobile()) {
    const posRight  = document.getElementById('pos-right');
    const posCenter = document.querySelector('.pos-center');
    if (posRight)  posRight.classList.remove('mob-visible');
    if (posCenter) posCenter.classList.remove('mob-hidden');
    _mobVistaCarrito = false;
   }
   window._actualizarVisibilidadFab();
  });
  })();
  
