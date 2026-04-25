// miColmApp — facturas.js
// Historial de facturas, facturas pendientes, pago de pendientes

async function cargarFacturas() {
   // Cargar facturas pagadas
   const qPag = query(collection(db, 'negocios', negocioId, 'facturas'), orderBy('fecha', 'desc'), limit(100));
   const snapPag = await getDocs(qPag);
   facturasCache = snapPag.docs.map(d => ({ id: d.id, ...d.data() }));

   // Cargar facturas pendientes
   const qPend = query(collection(db, 'negocios', negocioId, 'facturas-pendientes'), orderBy('fecha', 'desc'), limit(100));
   const snapPend = await getDocs(qPend);
   facturasPendientesCache = snapPend.docs.map(d => ({ id: d.id, ...d.data() }));

   // Actualizar badge
   const badge = document.getElementById('badge-pendientes');
   if (badge) badge.textContent = facturasPendientesCache.length;

   // Render según tab activa
   if (facturasTabActual === 'pendientes') {
    renderTablaFacturas(filtrarCache(facturasPendientesCache));
   } else {
    renderTablaFacturas(filtrarCache(facturasCache));
   }
  }

  function renderTablaFacturas(facturas) {
   const tbody = document.getElementById('tbody-facturas');
   if (!tbody) return;
   const esPendientes = facturasTabActual === 'pendientes';
   if (!facturas.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fas fa-file-invoice"></i><p>${esPendientes ? 'Sin facturas pendientes' : 'Sin facturas pagadas'}</p></div></td></tr>`;
    return;
   }
   tbody.innerHTML = facturas.map(f => {
    const fechaObj = f.fecha?.toDate ? f.fecha.toDate() : null;
    const hora = fechaObj ? fechaObj.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-';
    const fecha = fechaObj ? fechaObj.toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
    const accionPagar = esPendientes
     ? `<button class="btn-sm verde" onclick="abrirModalPagarPendiente('${f.id}')" style="padding:6px 12px;font-size:12px;margin-left:4px;display:inline-flex;align-items:center;gap:5px;"><i class="fas fa-cash-register"></i> Pagar factura</button>`
     : '';
    return `<tr>
     <td style="font-family:var(--font-mono);font-weight:700;">${f.numero || '-'}</td>
     <td style="font-size:12px;font-weight:700;color:#1a2135;">${f.direccionCliente || '-'}</td>
     <td style="font-family:var(--font-mono);font-size:12px;"><strong>${hora}</strong><br><span style="font-weight:400;color:#718096;">${fecha}</span></td>
     <td style="font-family:var(--font-mono);font-weight:700;">${fmt(f.total)}</td>
     <td>${f.metodoPago || '-'}</td>
     <td>${f.empleadoNombre || '-'}</td>
     <td style="font-family:var(--font-mono);font-size:11px;">${f.ncf || '-'}</td>
     <td><span class="badge ${esPendientes ? 'pendiente' : 'pagada'}">${esPendientes ? '⏳ Pendiente' : '✅ Pagada'}</span></td>
     <td>
      <button class="btn-sm gris" onclick="verFactura('${f.id}','${esPendientes ? 'pend' : 'pag'}')" style="padding:6px 10px;font-size:12px;"><i class="fas fa-eye"></i></button>
      ${accionPagar}
     </td>
    </tr>`;
   }).join('');
  }

  window.filtrarFacturas = () => {
   if (facturasTabActual === 'pendientes') {
    renderTablaFacturas(filtrarCache(facturasPendientesCache));
   } else {
    renderTablaFacturas(filtrarCache(facturasCache));
   }
  };

  window.limpiarFiltrosFacturas = () => {
   document.getElementById('fact-buscar').value = '';
   document.getElementById('fact-fecha-ini').value = '';
   document.getElementById('fact-fecha-fin').value = '';
   document.getElementById('fact-metodo').value = '';
   window.filtrarFacturas();
  };

  window.verFactura = (id, tipo) => {
   const lista = tipo === 'pend' ? facturasPendientesCache : facturasCache;
   const f = lista.find(f => f.id === id);
   if (!f) return;
   document.getElementById('modal-ver-factura-body').innerHTML = generarHTMLTicket(f);
   abrirModal('modal-ver-factura');
  };

  // ===== MODAL PAGAR FACTURA PENDIENTE =====
  let pfpFacturaId = null;
  let pfpMetodo = 'efectivo';
  let pfpMontoStr = '';

  window.abrirModalPagarPendiente = (id) => {
   pfpFacturaId = id;
   pfpMetodo = 'efectivo';
   pfpMontoStr = '';
   const f = facturasPendientesCache.find(x => x.id === id);
   if (!f) return;
   const infoEl = document.getElementById('pfp-info');
   infoEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
     <div>
      <div style="font-weight:800;font-size:15px;color:#1a2135;">${f.numero || '-'}</div>
      <div style="color:#666;font-size:12px;">${f.fecha?.toDate ? f.fecha.toDate().toLocaleString('es-DO') : '-'} • ${f.empleadoNombre || '-'}</div>
     </div>
     <div style="font-family:var(--font-mono);font-weight:800;font-size:1.3rem;color:#00b341;">${fmt(f.total)}</div>
    </div>`;
   pfpActualizarDisplay();
   pfpSelMetodo('efectivo');
   pfpMixtoResetear();
   const cambioDis = document.getElementById('pfp-cambio-display');
   if (cambioDis) cambioDis.style.display = 'none';
   abrirModal('modal-pagar-factura-pendiente');
  };

  window.pfpSelMetodo = (metodo) => {
   pfpMetodo = metodo;
   const colores = { efectivo: '#28a745', transferencia: '#1971c2', tarjeta: '#6f42c1', mixto: '#e67700' };
   ['efectivo', 'transferencia', 'tarjeta', 'mixto'].forEach(m => {
    const btn = document.getElementById(`pfp-btn-${m}`);
    if (btn) {
     if (m === metodo) {
      btn.style.background = colores[m];
      btn.style.borderColor = colores[m];
      btn.style.color = 'white';
     } else {
      btn.style.background = '#e2e8f0';
      btn.style.borderColor = '#e2e8f0';
      btn.style.color = '#4a5568';
     }
    }
   });
   const sec = document.getElementById('pfp-efectivo-section');
   const mixtoSec = document.getElementById('pfp-mixto-section');
   if (sec) sec.style.display = metodo === 'efectivo' ? 'block' : 'none';
   if (mixtoSec) { mixtoSec.style.display = metodo === 'mixto' ? 'block' : 'none'; }
   if (metodo === 'mixto') { pfpMixtoActivar('efectivo'); pfpMixtoActualizarResumen(); }
  };

  let _pfpMixtoActivo = 'efectivo';
  let _pfpMixtoEfStr = '';
  let _pfpMixtoElecStr = '';
  let _pfpMixtoSub = 'transferencia';

  window.pfpMixtoSelSub = (sub) => {
   _pfpMixtoSub = sub;
   document.getElementById('pfp-sub-trans').classList.toggle('activo', sub === 'transferencia');
   document.getElementById('pfp-sub-tarj').classList.toggle('activo', sub === 'tarjeta');
   const lbl = document.getElementById('pfp-mixto-elec-lbl');
   const resLbl = document.getElementById('pfp-mx-res-el-lbl');
   if (sub === 'transferencia') { if (lbl) lbl.textContent = '🏦 TRANSFERENCIA'; if (resLbl) resLbl.textContent = '🏦 Transferencia'; }
   else { if (lbl) lbl.textContent = '💳 TARJETA'; if (resLbl) resLbl.textContent = '💳 Tarjeta'; }
  };

  window.pfpMixtoActivar = (campo) => {
   _pfpMixtoActivo = campo;
   document.getElementById('pfp-mixto-campo-ef').classList.toggle('mixto-campo-activo', campo === 'efectivo');
   document.getElementById('pfp-mixto-campo-elec').classList.toggle('mixto-campo-activo', campo === 'elec');
  };

  window.pfpMixtoResto = (campo) => {
   const f = facturasPendientesCache.find(x => x.id === pfpFacturaId);
   if (!f) return;
   const total = f.total;
   if (campo === 'efectivo') { const elec = parseFloat(_pfpMixtoElecStr) || 0; _pfpMixtoEfStr = Math.max(0, total - elec).toFixed(2); }
   else { const ef = parseFloat(_pfpMixtoEfStr) || 0; _pfpMixtoElecStr = Math.max(0, total - ef).toFixed(2); }
   pfpMixtoActivar(campo);
   _pfpMixtoRefrescar();
   pfpMixtoActualizarResumen();
  };

  window.pfpMixtoTecla = (val) => {
   let str = _pfpMixtoActivo === 'efectivo' ? _pfpMixtoEfStr : _pfpMixtoElecStr;
   if (val === '⌫') str = str.slice(0, -1);
   else if (val === '.') { if (!str.includes('.')) str += '.'; }
   else if (val === 'OK') { pfpMixtoActualizarResumen(); return; }
   else { if (str.length < 10) str += val; }
   if (_pfpMixtoActivo === 'efectivo') _pfpMixtoEfStr = str; else _pfpMixtoElecStr = str;
   _pfpMixtoRefrescar();
   pfpMixtoActualizarResumen();
  };

  function _pfpMixtoRefrescar() {
   const dE = document.getElementById('pfp-mixto-disp-ef');
   const dEl = document.getElementById('pfp-mixto-disp-el');
   if (dE) dE.innerHTML = _pfpMixtoEfStr ? `RD$ ${_pfpMixtoEfStr}` : '<span class="placeholder">Toca para ingresar</span>';
   if (dEl) dEl.innerHTML = _pfpMixtoElecStr ? `RD$ ${_pfpMixtoElecStr}` : '<span class="placeholder">Toca para ingresar</span>';
  }

  function pfpMixtoActualizarResumen() {
   const f = facturasPendientesCache.find(x => x.id === pfpFacturaId);
   if (!f) return;
   const ef = parseFloat(_pfpMixtoEfStr) || 0;
   const elec = parseFloat(_pfpMixtoElecStr) || 0;
   const tot = ef + elec;
   const cambio = tot - f.total;
   const rEf = document.getElementById('pfp-mx-res-ef');
   const rEl = document.getElementById('pfp-mx-res-el');
   const rTot = document.getElementById('pfp-mx-res-tot');
   const rCambio = document.getElementById('pfp-mx-cambio-row');
   if (rEf) rEf.textContent = fmt(ef);
   if (rEl) rEl.textContent = fmt(elec);
   if (rTot) rTot.textContent = fmt(tot);
   if (rCambio) {
    rCambio.style.display = 'flex';
    if (cambio >= 0) { rCambio.className = 'mixto-resumen-row cambio-ok'; rCambio.innerHTML = `<span class="lbl">✅ Cambio</span><span class="val">${fmt(cambio)}</span>`; }
    else { rCambio.className = 'mixto-resumen-row cambio-falta'; rCambio.innerHTML = `<span class="lbl">❌ Falta</span><span class="val">${fmt(Math.abs(cambio))}</span>`; }
   }
  }

  function pfpMixtoResetear() {
   _pfpMixtoEfStr = ''; _pfpMixtoElecStr = ''; _pfpMixtoActivo = 'efectivo'; _pfpMixtoSub = 'transferencia';
   _pfpMixtoRefrescar();
  }

  window.pfpTecla = (val) => {
   if (val === '⌫') {
    pfpMontoStr = pfpMontoStr.slice(0, -1);
   } else if (val === '.') {
    if (!pfpMontoStr.includes('.')) pfpMontoStr += '.';
   } else {
    if (pfpMontoStr.length < 10) pfpMontoStr += val;
   }
   pfpActualizarDisplay();
  };

  function pfpActualizarDisplay() {
   const val = parseFloat(pfpMontoStr) || 0;
   const disp = document.getElementById('pfp-monto-display');
   if (disp) disp.textContent = pfpMontoStr ? `RD$ ${pfpMontoStr}` : 'RD$ 0.00';
   // Calcular cambio
   const f = facturasPendientesCache.find(x => x.id === pfpFacturaId);
   if (f && val > 0) {
    const cambio = val - f.total;
    const cambioDis = document.getElementById('pfp-cambio-display');
    if (cambioDis) {
     cambioDis.style.display = 'block';
     if (cambio >= 0) {
      cambioDis.style.background = '#d4edda';
      cambioDis.style.color = '#155724';
      cambioDis.textContent = `✅ Cambio: ${fmt(cambio)}`;
     } else {
      cambioDis.style.background = '#f8d7da';
      cambioDis.style.color = '#721c24';
      cambioDis.textContent = `❌ Falta: ${fmt(Math.abs(cambio))}`;
     }
    }
   } else {
    const cambioDis = document.getElementById('pfp-cambio-display');
    if (cambioDis) cambioDis.style.display = 'none';
   }
  }

  window.confirmarPagarFacturaPendiente = async () => {
   if (!pfpFacturaId) return;
   const f = facturasPendientesCache.find(x => x.id === pfpFacturaId);
   if (!f) return;
   if (pfpMetodo === 'efectivo') {
    const montoRec = parseFloat(pfpMontoStr) || 0;
    if (montoRec <= 0) { toast('Ingresa el monto recibido en efectivo', 'error'); return; }
    if (montoRec < f.total) { toast('El monto recibido es menor al total', 'error'); return; }
   }
   if (pfpMetodo === 'mixto') {
    const ef = parseFloat(_pfpMixtoEfStr) || 0;
    const elec = parseFloat(_pfpMixtoElecStr) || 0;
    if (ef <= 0 && elec <= 0) { toast('Ingresa los montos del pago mixto', 'error'); return; }
    if ((ef + elec) < f.total) { toast('El total pagado no cubre el monto de la factura', 'error'); return; }
   }
   const btn = document.getElementById('btn-confirmar-pagar-pendiente');
   btn.innerHTML = '<span class="loader"></span> Procesando...';
   btn.disabled = true;
   const _offlinePfp = !navigator.onLine;
   try {
    const montoRec = pfpMetodo === 'efectivo' ? (parseFloat(pfpMontoStr) || f.total) : f.total;
    const cambio = pfpMetodo === 'efectivo' ? Math.max(0, montoRec - f.total) : 0;
    const empNombre = await getEmpNombre();
    const fechaPago = serverTimestamp();

    const facturaPageData = {
     ...f,
     id: undefined,
     estado: 'pagada',
     metodoPago: pfpMetodo,
     montoRecibido: montoRec,
     cambio,
     fechaPago,
     ...(pfpMetodo === 'mixto' ? {
      mixtoEfectivo: parseFloat(_pfpMixtoEfStr) || 0,
      mixtoElectronico: parseFloat(_pfpMixtoElecStr) || 0,
      mixtoSubMetodo: _pfpMixtoSub
     } : {})
    };
    delete facturaPageData.id;

    const newFactRef = await _fsOp(() => addDoc(collection(db, 'negocios', negocioId, 'facturas'), facturaPageData));
    _fsOp(() => deleteDoc(doc(db, 'negocios', negocioId, 'facturas-pendientes', pfpFacturaId)));

    if (cajaActual) {
     _fsOp(() => addDoc(collection(db, 'negocios', negocioId, 'movimientos'), {
      tipo: 'ingreso', descripcion: `Pago factura ${f.numero}`, monto: f.total,
      fecha: fechaPago, uid: currentUser.uid, empleadoNombre: empNombre,
      facturaId: newFactRef.id, cajaId: cajaActual.id
     }));
     let newIngresos = (cajaActual.ingresos || 0) + f.total;
     let newGastos = cajaActual.gastos || 0;
     if (pfpMetodo === 'efectivo' && cambio > 0) {
      _fsOp(() => addDoc(collection(db, 'negocios', negocioId, 'movimientos'), {
       tipo: 'gasto', descripcion: `Cambio devuelto factura ${f.numero}`, monto: cambio,
       fecha: fechaPago, uid: currentUser.uid, empleadoNombre: empNombre,
       facturaId: newFactRef.id, cajaId: cajaActual.id
      }));
      newGastos += cambio;
     }
     cajaActual.ingresos = newIngresos; cajaActual.gastos = newGastos;
     _fsOp(() => updateDoc(doc(db, 'negocios', negocioId, 'caja', cajaActual.id), { ingresos: newIngresos, gastos: newGastos }));
    }

    // Actualizar cache local de facturas pendientes
    const pfpIdx = facturasPendientesCache.findIndex(x => x.id === pfpFacturaId);
    if (pfpIdx >= 0) facturasPendientesCache.splice(pfpIdx, 1);

    cerrarModal('modal-pagar-factura-pendiente');
    toast(_offlinePfp ? '📱 Factura marcada como pagada localmente — se sincronizará con Firebase' : 'Factura pagada exitosamente ✅', _offlinePfp ? 'warning' : 'success', _offlinePfp ? 5000 : 4000);
    await cargarFacturas();
   } catch (e) {
    toast('Error: ' + e.message, 'error');
    console.error(e);
   }
   btn.innerHTML = '<i class="fas fa-check"></i> Confirmar Pago';
   btn.disabled = false;
  };

  // Mantener compatibilidad con marcarPagada (por si se llama desde algún lado)
  window.marcarPagada = (id) => window.abrirModalPagarPendiente(id);

  function _actualizarBtnCatAccion(modo, catId) {
   const btn = document.getElementById('btn-cat-accion');
   if (!btn) return;
   if (modo === 'lista') {
    btn.className = 'btn-sm verde';
    btn.onclick = abrirModalCategoria;
    btn.innerHTML = '<i class="fas fa-folder-plus"></i> Categoría';
   } else if (modo === 'categoria') {
    btn.className = 'btn-sm amarillo';
    btn.onclick = () => editarCategoria(catId);
    btn.innerHTML = '<i class="fas fa-edit"></i> Editar categoría';
   } else if (modo === 'masvendidos') {
    btn.className = 'btn-sm amarillo';
    btn.onclick = (e) => editarImagenMasVendidos(e);
    btn.innerHTML = '<i class="fas fa-image"></i> Editar imagen';
   }
  }

  function _recalcularInvStats() {
   let total = 0, unidades = 0, dinero = 0;
   const porCategoria = {};
   for (const p of productos) {
    total++;
    const catId = p.categoriaId;
    if (!porCategoria[catId]) porCategoria[catId] = { total: 0, unidades: 0, dinero: 0 };
    porCategoria[catId].total++;
    if (p.stockHabilitado !== false && p.stock > 0) {
     const stock = parseFloat(p.stock) || 0;
     const valor = parseFloat(p.costo) > 0 ? parseFloat(p.costo) : parseFloat(p.precio) || 0;
     unidades += stock;
     dinero += valor * stock;
     porCategoria[catId].unidades += stock;
     porCategoria[catId].dinero += valor * stock;
    }
   }
   _invStats = { total, unidades, dinero, porCategoria };
  }

