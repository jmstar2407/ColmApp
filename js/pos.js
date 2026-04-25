// miColmApp — pos.js
// POS: window.productos/categorías, carrito, dibujo, facturación, pago mixto, historial, pendientes
// Requiere: window.db, window.negocioId, window.categorias, window.productos, window.config, etc.

function renderCategoriasPos() {
   const lista = document.getElementById('pos-window.categorias-lista');
   const area = document.getElementById('pos-window.productos-area');
   if (!lista) return;

   // Construir categorías: Más Vendidos primero (virtual), luego las reales
   const masVendidosProds = window.productos.filter(p => p.masVendidos);
   const mvBgImg = window.negocioData?.masVendidosBg || './img/backgrounds/masvendidos_1.jpg';
   const catsMostrar = [
    { id: '__mas_vendidos__', nombre: 'Más Vendidos', emoji: '⭐', imagen: mvBgImg, _virtual: true, _count: masVendidosProds.length }
   ].concat(window.categorias.filter(c => c.id !== '__mas_vendidos__').map(c => ({ ...c, _virtual: false, _count: window.productos.filter(p => p.categoriaId === c.id).length })));

   if (!catsMostrar.length || (catsMostrar.length === 1 && window.categorias.length === 0)) {
    lista.innerHTML = `<div style="color:rgba(0,0,0,0.4);font-size:12px;text-align:center;padding:20px 8px;">Sin categorías</div>`;
    if (area) area.innerHTML = `<div class="empty-state"><i class="fas fa-folder-open"></i><p>No hay categorías creadas.<br>Ve a Inventario para crear categorías y window.productos.</p></div>`;
    return;
   }

   lista.innerHTML = catsMostrar.map(c => {
    const numProds = c._count;
    const esMasVendidos = c._virtual;
    const bgContent = c.imagen
     ? `<img class="cat-bg-img" src="${c.imagen}" alt="${c.nombre}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
     : '';
    const emojiFallback = `<div class="cat-bg-emoji" ${c.imagen ? 'style="display:none"' : ''}>${c.emoji || '📦'}</div>`;
    return `<div class="pos-cat-card${esMasVendidos ? ' mas-vendidos-cat' : ''}" id="pos-cat-${c.id}" onclick="verProductosCategoria('${c.id}')">${bgContent}${emojiFallback}<span class="cat-label">${c.nombre}</span><span class="cat-count">${numProds} producto${numProds !== 1 ? 's' : ''}</span></div>`;
   }).join('');

   // Si no hay categoría activa, seleccionar Más Vendidos (primera)
   if (!window.categoriaActual) {
    categoriaActual = '__mas_vendidos__';
   }
   if (window.categoriaActual) {
    renderProductosCategoria(window.categoriaActual);
    const activeCard = document.getElementById(`pos-cat-${window.categoriaActual}`);
    if (activeCard) activeCard.classList.add('activa');
   }
  }

  // ── CACHÉ DE GRIDS POR CATEGORÍA ─────────────────────────────────────────
  // Cada categoría tiene su propio div.productos-grid en el DOM.
  // Al cambiar de categoría solo se muestra/oculta — sin destruir ni recrear.
  // _gridOrdenCache guarda con qué orden fue renderizado cada grid para invalidarlo si cambia.
  const _gridCache = {};
  const _gridOrdenCache = {}; // catId -> orden con que fue renderizado

  function _getOrCreateGrid(catId) {
   const area = document.getElementById('pos-window.productos-area');
   if (!area) return null;
   if (_gridCache[catId] && area.contains(_gridCache[catId])) {
    return _gridCache[catId];
   }
   const grid = document.createElement('div');
   grid.className = `productos-grid ${gridSize}`;
   grid.id = `productos-grid-${catId}`;
   grid.style.display = 'none';
   area.appendChild(grid);
   _gridCache[catId] = grid;
   return grid;
  }

  function _gridNecesitaActualizar(catId) {
   // El grid necesita re-renderizarse si no existe o si fue renderizado con otro orden
   return !_gridCache[catId] || _gridOrdenCache[catId] !== ordenProductos;
  }

  function _llenarGrid(catId, busqueda = '') {
   const grid = _getOrCreateGrid(catId);
   if (!grid) return;
   let prods;
   if (catId === '__mas_vendidos__') {
    prods = window.productos.filter(p => p.masVendidos);
   } else {
    prods = window.productos.filter(p => p.categoriaId === catId);
   }
   if (busqueda) prods = prods.filter(p =>
    p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.codigoBarras || '').includes(busqueda)
   );
   prods = _aplicarOrden(prods);
   grid.className = `productos-grid ${gridSize}`;
   grid.innerHTML = prods.length
    ? prods.map(p => renderProdCard(p, busqueda)).join('')
    : '<div class="empty-state"><i class="fas fa-box-open"></i><p>Sin window.productos en esta categoría</p></div>';
   // Registrar con qué orden fue renderizado este grid
   if (!busqueda) _gridOrdenCache[catId] = ordenProductos;
  }

  function _mostrarGrid(catId) {
   const area = document.getElementById('pos-window.productos-area');
   if (!area) return;
   // Ocultar todos los grids cacheados y el de búsqueda
   Array.from(area.children).forEach(el => { el.style.display = 'none'; });
   // Mostrar el de esta categoría (crearlo si no existe)
   const grid = _getOrCreateGrid(catId);
   if (grid) grid.style.display = '';
  }

  window.verProductosCategoria = (catId) => {
   categoriaActual = catId;
   document.querySelectorAll('.pos-cat-card').forEach(el => el.classList.remove('activa'));
   const activeCard = document.getElementById(`pos-cat-${catId}`);
   if (activeCard) activeCard.classList.add('activa');
   // Re-renderizar si es primera visita O si cambió el orden desde la última vez
   if (_gridNecesitaActualizar(catId)) {
    _llenarGrid(catId);
   }
   _mostrarGrid(catId);
  };

  function renderProductosCategoria(catId, busqueda = '') {
   if (busqueda) {
    // Con búsqueda: grid temporal, no entra en caché
    const area = document.getElementById('pos-window.productos-area');
    if (!area) return;
    Array.from(area.children).forEach(el => { el.style.display = 'none'; });
    let searchGrid = document.getElementById('productos-grid-busqueda');
    if (!searchGrid) {
     searchGrid = document.createElement('div');
     searchGrid.id = 'productos-grid-busqueda';
     area.appendChild(searchGrid);
    }
    let prods = catId === '__mas_vendidos__'
     ? window.productos.filter(p => p.masVendidos)
     : window.productos.filter(p => p.categoriaId === catId);
    prods = prods.filter(p =>
     normalizarTexto(p.nombre).includes(normalizarTexto(busqueda)) ||
     normalizarTexto(p.codigoBarras || '').includes(normalizarTexto(busqueda))
    );
    prods = _aplicarOrden(prods);
    searchGrid.className = `productos-grid ${gridSize}`;
    searchGrid.style.display = '';
    searchGrid.innerHTML = prods.length
     ? prods.map(p => renderProdCard(p, busqueda)).join('')
     : '<div class="empty-state"><i class="fas fa-box-open"></i><p>Sin window.productos en esta categoría</p></div>';
    return;
   }
   // Sin búsqueda: reconstruir el grid cacheado de esta categoría
   // (llamado por Firebase cuando hay un cambio real)
   _llenarGrid(catId);
   _mostrarGrid(catId);
  }

  function escapeHtml(str) { return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
  function normalizarTexto(str) { return (str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  function resaltarTexto(texto, busqueda) {
   if (!busqueda) return escapeHtml(texto);
   const regex = new RegExp(`(${busqueda.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
   return escapeHtml(texto).replace(regex, '<span class="search-highlight">$1</span>');
  }

  function renderProdCard(p, busqueda = '') {
   const stockHab = p.stockHabilitado !== false;
   const sinStock = stockHab && p.stock <= 0;
   const bajoStock = stockHab && p.stock > 0 && p.stock <= (p.stockMin || 5);
   const nombreHtml = resaltarTexto(p.nombre || '', busqueda);
   const stockClass = bajoStock ? ' stock-bajo' : (sinStock ? ' sin-stock-txt' : '');
   const esDetallable = esUnidadDetallable(p.unidad);
   const unidadLabel = esDetallable ? labelUnidad(p.unidad) : '';
   const precioHtml = esDetallable
    ? `${fmt(p.precio)}/${unidadLabel}`
    : fmt(p.precio);
   const unidadBadge = esDetallable ? ` <span style="background:#1971c2;color:white;border-radius:4px;padding:1px 5px;font-size:10px;font-weight:700;">${unidadLabel}</span>` : '';
   const stockValDisplay = stockHab ? fmtNum(p.stock) : '∞';
   const stockHtml = `Stock: ${stockValDisplay}${unidadBadge}`;
   const comboBadge = p.comboActivo && p.comboPrecio && p.comboUnidades
    ? `<span style="position:absolute;top:4px;left:4px;background:linear-gradient(135deg,#f59f00,#e67700);color:#fff;border-radius:5px;padding:2px 6px;font-size:9px;font-weight:800;letter-spacing:0.3px;box-shadow:0 1px 4px rgba(0,0,0,0.18);z-index:2;">${p.comboUnidades}x${p.comboPrecio}</span>`
    : '';
   const imagenHtml = p.imagen
    ? `<img src="${p.imagen}" alt="${escapeHtml(p.nombre || '')}" onerror="this.outerHTML='<div class=&quot;prod-emoji&quot;><i class=&quot;fas fa-shopping-cart&quot;></i></div>'">`
    : `<div class="prod-emoji"><i class="fas fa-shopping-cart"></i></div>`;
   const pesoNetoHtml = p.pesoNeto ? `<span class="peso-neto-badge">${escapeHtml(p.pesoNeto)}</span>` : '';
   return `<div class="prod-card ${sinStock ? 'sin-stock' : ''}" onclick="agregarAlCarrito('${p.id}')" oncontextmenu="mostrarMenuContextoProducto(event,'${p.id}');return false;"><div class="product-image" style="position:relative;">${imagenHtml}${pesoNetoHtml}${comboBadge}</div><div class="prod-info"><div class="prod-nombre">${nombreHtml}</div><div class="prod-precio">${precioHtml}</div><div class="prod-stock${stockClass}">${stockHtml}</div></div></div>`;
  }

  window.buscarProductos = (q) => {
   if (!q) {
    // Limpiar grids de búsqueda y volver a mostrar la categoría cacheada
    const sg = document.getElementById('productos-grid-busqueda');
    if (sg) sg.style.display = 'none';
    const gs = document.getElementById('productos-grid-global-search');
    if (gs) gs.style.display = 'none';
    if (window.categoriaActual) {
     if (_gridNecesitaActualizar(window.categoriaActual)) _llenarGrid(window.categoriaActual);
     _mostrarGrid(window.categoriaActual);
    } else {
     renderCategoriasPos();
    }
    return;
   }
   // Deduplicar por id para evitar mostrar el mismo producto dos veces
   const seenIds = new Set();
   const found = window.productos.filter(p => {
    if (seenIds.has(p.id)) return false;
    const match = normalizarTexto(p.nombre).includes(normalizarTexto(q)) || normalizarTexto(p.codigoBarras || '').includes(normalizarTexto(q));
    if (match) seenIds.add(p.id);
    return match;
   });
   const area = document.getElementById('pos-window.productos-area');
   if (!area) return;
   document.querySelectorAll('.pos-cat-card').forEach(el => el.classList.remove('activa'));
   // Ocultar todos los grids cacheados (no destruirlos)
   Object.values(_gridCache).forEach(el => { el.style.display = 'none'; });
   // Usar un div persistente para resultados globales
   let globalSearch = document.getElementById('productos-grid-global-search');
   if (!globalSearch) {
    globalSearch = document.createElement('div');
    globalSearch.id = 'productos-grid-global-search';
    area.appendChild(globalSearch);
   }
   globalSearch.style.display = '';
   const foundOrdenado = _aplicarOrden(found);
   globalSearch.innerHTML = `<div style="padding:0 0 12px;font-size:13px;color:var(--gris-suave);font-weight:600;">${found.length} resultado(s) para "<strong>${escapeHtml(q)}</strong>"</div><div class="productos-grid ${gridSize}">${found.length ? foundOrdenado.map(p => renderProdCard(p, q)).join('') : '<div class="empty-state"><p>Sin resultados</p></div>'}</div>`;
  };

  // ── Menú contextual producto en POS ─────────────────
  window.mostrarMenuContextoProducto = function(e, prodId) {
   e.preventDefault();
   // Eliminar menú previo si existe
   const prev = document.getElementById('_pos_ctx_menu');
   if (prev) prev.remove();

   const menu = document.createElement('div');
   menu.id = '_pos_ctx_menu';
   menu.style.cssText = `position:fixed;z-index:99999;background:#fff;border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,0.18);min-width:160px;overflow:hidden;animation:ctxFadeIn 0.13s ease;`;
   menu.innerHTML = `
    <div style="padding:6px 0;">
     <button onclick="window.editarProducto('${prodId}');document.getElementById('_pos_ctx_menu')?.remove();" style="display:flex;align-items:center;gap:10px;width:100%;padding:10px 18px;border:none;background:none;cursor:pointer;font-size:14px;font-weight:600;color:#1a2135;font-family:inherit;transition:background 0.15s;" onmouseover="this.style.background='#f0f4ff'" onmouseout="this.style.background='none'">
      <i class="fas fa-edit" style="color:#1971c2;width:16px;"></i> Editar producto
     </button>
    </div>`;

   // Posicionar cerca del cursor sin salirse de la pantalla
   let x = e.clientX, y = e.clientY;
   document.body.appendChild(menu);
   const mw = menu.offsetWidth, mh = menu.offsetHeight;
   if (x + mw > window.innerWidth - 8) x = window.innerWidth - mw - 8;
   if (y + mh > window.innerHeight - 8) y = window.innerHeight - mh - 8;
   menu.style.left = x + 'px';
   menu.style.top = y + 'px';

   // Cerrar al hacer click fuera
   setTimeout(() => {
    const cerrar = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('mousedown', cerrar); } };
    document.addEventListener('mousedown', cerrar);
   }, 50);
  };

  window.setGridSize = (size) => {
   gridSize = size;
   localStorage.setItem('pos_grid_size', size);
   document.getElementById('btn-grid-grande').classList.toggle('active', size === 'grande');
   document.getElementById('btn-grid-peq').classList.toggle('active', size === 'pequena');
   // Actualizar clase en todos los grids cacheados
   Object.values(_gridCache).forEach(el => { el.className = `productos-grid ${size}`; });
   const sg = document.getElementById('productos-grid-busqueda');
   if (sg) sg.className = `productos-grid ${size}`;
  };
  // ── Orden de window.productos ───────────────────────────────
  function _aplicarOrden(prods) {
   if (ordenProductos === 'az') {
    return [...prods].sort((a, b) => normalizarTexto(a.nombre).localeCompare(normalizarTexto(b.nombre)));
   }
   return prods; // orden original de Firebase
  }

  window.setOrdenProductos = (orden) => {
   if (ordenProductos === orden) return;
   ordenProductos = orden;
   localStorage.setItem('pos_orden_productos', orden);
   const btnAZ = document.getElementById('btn-orden-az');
   if (btnAZ) btnAZ.classList.toggle('active', orden === 'az');
   Object.keys(_gridOrdenCache).forEach(k => delete _gridOrdenCache[k]);
   if (window.categoriaActual) {
    _llenarGrid(window.categoriaActual);
    _mostrarGrid(window.categoriaActual);
   }
   const busqEl = document.getElementById('pos-buscar');
   if (busqEl && busqEl.value.trim()) window.buscarProductos(busqEl.value.trim());
  };

  window.toggleOrdenProductos = () => {
   setOrdenProductos(ordenProductos === 'az' ? 'original' : 'az');
  };

  // Restaurar tamaño de grid guardado
  (function () { const saved = localStorage.getItem('pos_grid_size'); if (saved === 'pequena' || saved === 'grande') { gridSize = saved; document.addEventListener('DOMContentLoaded', () => { const bg = document.getElementById('btn-grid-grande'); const bp = document.getElementById('btn-grid-peq'); if (bg) bg.classList.toggle('active', saved === 'grande'); if (bp) bp.classList.toggle('active', saved === 'pequena'); }); } })();
  (function () { const savedOrden = localStorage.getItem('pos_orden_productos') || 'original'; ordenProductos = savedOrden; document.addEventListener('DOMContentLoaded', () => { const ba = document.getElementById('btn-orden-az'); if (ba) ba.classList.toggle('active', savedOrden === 'az'); }); })();

  window.abrirScaner = () => {
   if (window.innerWidth <= 768) {
    // En móvil: abrir cámara scanner y dirigir resultado al buscador de window.productos
    if (window.abrirCamaraScanner) {
     // Usar un destino especial que agrega el producto al carrito por código de barras
     window._scannerDestinoPos = true;
     abrirCamaraScanner('pos-buscar');
    }
   } else {
    document.getElementById('scanner-input').value = '';
    abrirModal('modal-scanner');
    setTimeout(() => document.getElementById('scanner-input').focus(), 300);
   }
  };

  window.buscarPorBarcode = () => { const codigo = document.getElementById('scanner-input').value.trim(); if (!codigo) return; const prod = window.productos.find(p => p.codigoBarras === codigo); if (prod) { agregarAlCarritoObj(prod); cerrarModal('modal-scanner'); } else { toast('Producto no encontrado con ese código', 'error'); } };

  // Unidades que permiten cantidades decimales (detallables)
  const UNIDADES_DETALLABLES = ['libra', 'libras', 'lb', 'kilogramo', 'kilogramos', 'kg', 'kilo', 'kilos', 'onza', 'onzas', 'oz', 'litro', 'litros', 'lt', 'l', 'galon', 'galones', 'gal', 'galón', 'galones'];

  function esUnidadDetallable(unidad) {
   if (!unidad) return false;
   return UNIDADES_DETALLABLES.includes((unidad || '').toLowerCase().trim());
  }

  function labelUnidad(unidad) {
   const u = (unidad || '').toLowerCase().trim();
   const map = { libra: 'lb', libras: 'lb', lb: 'lb', kilogramo: 'kg', kilogramos: 'kg', kg: 'kg', kilo: 'kg', kilos: 'kg', onza: 'oz', onzas: 'oz', oz: 'oz', litro: 'L', litros: 'L', lt: 'L', l: 'L', galon: 'gal', galones: 'gal', gal: 'gal', 'galón': 'gal' };
   return map[u] || unidad;
  }

  // Estado del modal de detalle
  let _duProd = null;
  let _duTab = 'cantidad'; // 'cantidad' | 'precio'
  let _duValor = '';

  window.duCambiarTab = (tab) => {
   _duTab = tab;
   _duValor = '';
   document.getElementById('du-valor').value = '';
   document.getElementById('du-tab-cant').classList.toggle('activo', tab === 'cantidad');
   document.getElementById('du-tab-precio').classList.toggle('activo', tab === 'precio');
   const lbl = document.getElementById('du-label-unidad');
   if (tab === 'cantidad') {
    lbl.textContent = labelUnidad(_duProd?.unidad || '');
   } else {
    lbl.textContent = 'RD$';
   }
   duActualizarResultado();
  };

  window.duTecla = (key) => {
   if (key === '⌫') {
    _duValor = _duValor.slice(0, -1);
   } else if (key === '.') {
    if (!_duValor.includes('.')) _duValor += '.';
   } else {
    if (_duValor === '0') _duValor = key;
    else _duValor += key;
   }
   document.getElementById('du-valor').value = _duValor;
   duActualizarResultado();
  };

  function duActualizarResultado() {
   const res = document.getElementById('du-resultado-texto');
   const btn = document.getElementById('du-btn-confirmar');
   if (!_duProd || !_duValor) { res.textContent = 'Ingresa la cantidad'; if (btn) btn.disabled = true; return; }
   const val = parseFloat(_duValor);
   if (isNaN(val) || val <= 0) { res.textContent = 'Valor inválido'; if (btn) btn.disabled = true; return; }
   if (btn) btn.disabled = false;
   const unidadLabel = labelUnidad(_duProd.unidad || '');
   if (_duTab === 'cantidad') {
    const subtotal = val * _duProd.precio;
    res.innerHTML = `${val} ${unidadLabel} × ${fmt(_duProd.precio)} = <span class="du-resultado-valor">${fmt(subtotal)}</span>`;
   } else {
    // Por precio: calcular cuántas unidades
    const cantEquiv = val / _duProd.precio;
    res.innerHTML = `${fmt(val)} ÷ ${fmt(_duProd.precio)}/${unidadLabel} = <span class="du-resultado-valor">${cantEquiv.toFixed(2)} ${unidadLabel}</span>`;
   }
  }

  window.duConfirmar = () => {
   if (!_duProd || !_duValor) { toast('Ingresa una cantidad', 'error'); return; }
   const val = parseFloat(_duValor);
   if (isNaN(val) || val <= 0) { toast('Cantidad inválida', 'error'); return; }

   let qty;
   const precioBase = _duProd._precioBase || _duProd.precio;
   if (_duTab === 'cantidad') {
    qty = val;
   } else {
    qty = val / precioBase;
   }

   const carrito = getCarrito();
   const idx = carrito.findIndex(i => i.id === _duProd.id);
   if (_duModoEdicion) {
    // Modo edición: reemplazar qty existente
    if (idx >= 0) {
     if (qty <= 0) {
      carrito.splice(idx, 1);
     } else {
      carrito[idx].qty = qty;
     }
    }
   } else {
    // Modo agregar: sumar o crear
    if (idx >= 0) {
     carrito[idx].qty += qty;
    } else {
     carrito.push({ ..._duProd, qty, _precioBase: precioBase });
    }
   }
   setCarrito(carrito);
   renderCarrito();
   cerrarModal('modal-detalle-unidad');
   const accion = _duModoEdicion ? 'actualizado' : 'agregado';
   toast(`✅ ${qty.toFixed(2)} ${labelUnidad(_duProd.unidad)} de ${_duProd.nombre} ${accion}`, 'success');
  };

  // ===== TECLADO FÍSICO + INPUT NATIVO para modal-detalle-unidad =====
  (function () {

   // Sincronizar cuando el usuario escribe directo en el input (teclado físico nativo)
   document.addEventListener('DOMContentLoaded', () => {
    const inp = document.getElementById('du-valor');
    if (!inp) return;

    // Escuchar escritura directa en el input
    inp.addEventListener('input', () => {
     // Filtrar solo caracteres válidos: dígitos y punto decimal
     let val = inp.value.replace(/[^0-9.]/g, '');
     // Evitar más de un punto
     const parts = val.split('.');
     if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
     if (inp.value !== val) inp.value = val;
     _duValor = val;
     duActualizarResultado();
    });

    // Interceptar keydown en el input para Enter y Escape
    inp.addEventListener('keydown', (e) => {
     if (e.key === 'Enter') { duConfirmar(); e.preventDefault(); }
     else if (e.key === 'Escape') { cerrarModal('modal-detalle-unidad'); e.preventDefault(); }
    });

    // Observar apertura del modal para enfocar el input
    const modal = document.getElementById('modal-detalle-unidad');
    if (!modal) return;
    const observer = new MutationObserver(() => {
     if (modal.classList.contains('active')) {
      setTimeout(() => inp.focus(), 120);
     }
    });
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
   });

  })();
  // ===== FIN TECLADO FÍSICO =====

  let _duModoEdicion = false; // false = agregar nuevo, true = editar existente en carrito

  function abrirModalDetalle(prod) {
   _duProd = prod;
   _duModoEdicion = false;
   _duTab = 'cantidad';
   _duValor = '';
   document.getElementById('du-nombre').textContent = prod.nombre;
   document.getElementById('du-precio-ref').innerHTML = `Precio: <span class="du-precio-valor">${fmt(prod.precio)}</span> por ${labelUnidad(prod.unidad)}`;
   document.getElementById('du-valor').value = '';
   document.getElementById('du-label-unidad').textContent = labelUnidad(prod.unidad || '');
   document.getElementById('du-tab-cant').classList.add('activo');
   document.getElementById('du-tab-precio').classList.remove('activo');
   const h3 = document.querySelector('#modal-detalle-unidad .modal-header h3');
   if (h3) h3.innerHTML = '<i class="fas fa-balance-scale"></i> Cantidad a detallar';
   const btnOk = document.getElementById('du-btn-confirmar');
   if (btnOk) { btnOk.innerHTML = '<i class="fas fa-check"></i> Agregar al Carrito'; btnOk.disabled = true; }
   duActualizarResultado();
   abrirModal('modal-detalle-unidad');
  }

  window.abrirModalEditarDetalle = (prodId) => {
   const carrito = getCarrito();
   const item = carrito.find(i => i.id === prodId);
   if (!item) return;
   _duProd = item;
   _duModoEdicion = true;
   _duTab = 'cantidad';
   const qtyActual = item.qty;
   _duValor = Number.isInteger(qtyActual) ? String(qtyActual) : qtyActual.toFixed(2);
   document.getElementById('du-nombre').textContent = item.nombre;
   document.getElementById('du-precio-ref').innerHTML = `Precio: <span class="du-precio-valor">${fmt(item._precioBase || item.precio)}</span> por ${labelUnidad(item.unidad)}`;
   document.getElementById('du-valor').value = _duValor;
   document.getElementById('du-label-unidad').textContent = labelUnidad(item.unidad || '');
   document.getElementById('du-tab-cant').classList.add('activo');
   document.getElementById('du-tab-precio').classList.remove('activo');
   // Cambiar título y botón confirmar
   const h3 = document.querySelector('#modal-detalle-unidad .modal-header h3');
   if (h3) h3.innerHTML = '<i class="fas fa-pen"></i> Editar cantidad';
   const btnOk = document.getElementById('du-btn-confirmar');
   if (btnOk) { btnOk.innerHTML = 'Actualizar Carrito'; btnOk.disabled = true; }
   duActualizarResultado();
   abrirModal('modal-detalle-unidad');
  };

  // Edición inline de cantidad/precio en carrito (para window.productos detallables)
  window.editarCantidadDetalle = (prodId, inputEl) => {
   const carrito = getCarrito();
   const idx = carrito.findIndex(i => i.id === prodId);
   if (idx < 0) return;
   const val = parseFloat(inputEl.value);
   if (isNaN(val) || val <= 0) { inputEl.value = carrito[idx].qty.toFixed(2); return; }
   carrito[idx].qty = val;
   setCarrito(carrito);
   // Solo actualizar totales sin re-renderizar todo el carrito (para no perder el foco)
   _actualizarTotalesCarrito();
  };

  window.editarPrecioDetalle = (prodId, inputEl) => {
   const carrito = getCarrito();
   const idx = carrito.findIndex(i => i.id === prodId);
   if (idx < 0) return;
   const precioUnitario = carrito[idx]._precioBase || carrito[idx].precio;
   const totalIngresado = parseFloat(inputEl.value);
   if (isNaN(totalIngresado) || totalIngresado <= 0) { inputEl.value = (carrito[idx].qty * precioUnitario).toFixed(2); return; }
   // Calcular nueva qty a partir del precio total ingresado
   const nuevaQty = totalIngresado / precioUnitario;
   carrito[idx].qty = nuevaQty;
   setCarrito(carrito);
   // Actualizar campo de cantidad también
   const qtyInput = document.getElementById(`du-qty-${prodId}`);
   if (qtyInput) qtyInput.value = nuevaQty.toFixed(2);
   _actualizarTotalesCarrito();
  };

  window.confirmarEdicionDetalle = (prodId) => {
   const carrito = getCarrito();
   const idx = carrito.findIndex(i => i.id === prodId);
   if (idx < 0) return;
   if (carrito[idx].qty <= 0) {
    carrito.splice(idx, 1);
    setCarrito(carrito);
    renderCarrito();
   } else {
    setCarrito(carrito);
    renderCarrito();
   }
  };

  // ── Funciones de combo (definidas aquí para estar disponibles globalmente) ──
  // Calcula el precio total a cobrar por qty unidades aplicando lógica combo
  // Ej: combo 2x15, precio unit 10 → 3 uds=25, 4 uds=30, 5 uds=40
  window.calcularPrecioConCombo = function calcularPrecioConCombo(qty, precioUnit, comboPrecio, comboUnidades) {
   if (!comboPrecio || !comboUnidades || comboUnidades < 2 || !precioUnit) {
    return qty * precioUnit;
   }
   const combosCompletos = Math.floor(qty / comboUnidades);
   const sueltas = qty % comboUnidades;
   return (combosCompletos * comboPrecio) + (sueltas * precioUnit);
  };

  // Calcula cuántas unidades se dan por un monto (para preview en inventario)
  window.calcularUnidadesCombo = function calcularUnidadesCombo(monto, precioUnit, comboPrecio, comboUnidades) {
   if (!comboPrecio || !comboUnidades || comboUnidades < 2 || !precioUnit) return Math.floor(monto / precioUnit);
   let restante = monto;
   let unidades = 0;
   const combosCompletos = Math.floor(restante / comboPrecio);
   unidades += combosCompletos * comboUnidades;
   restante -= combosCompletos * comboPrecio;
   unidades += Math.floor(restante / precioUnit);
   return unidades;
  };

  function _actualizarTotalesCarrito() {
   const carrito = getCarrito();
   const subtotal = carrito.reduce((s, i) => {
    if (i.comboActivo && i.comboPrecio && i.comboUnidades >= 2) {
     return s + window.calcularPrecioConCombo(i.qty, i.precio, i.comboPrecio, i.comboUnidades);
    }
    if (i._precioBase !== undefined) return s + i._precioBase * i.qty; // detallable
    return s + i.precio * i.qty;
   }, 0);
   const itbisPct = window.config.itbisPct || 18;
   const itbisCliente = window.config.itbisCliente === true;
   const itbis = itbisCliente ? subtotal * (itbisPct / 100) : 0;
   const total = subtotal + itbis;
   document.getElementById('cart-subtotal').textContent = fmt(subtotal);
   document.getElementById('cart-itbis').textContent = fmt(itbis);
   document.getElementById('cart-total').textContent = fmt(total);
   // Mostrar/ocultar fila ITBIS
   const itbisRow = document.getElementById('cart-itbis-row');
   if (itbisRow) itbisRow.style.display = itbisCliente ? '' : 'none';
   // Actualizar subtotal de cada item detallable
   carrito.forEach(item => {
    if (esUnidadDetallable(item.unidad)) {
     const st = document.getElementById(`du-subtotal-${item.id}`);
     if (st) st.textContent = fmt((item._precioBase || item.precio) * item.qty);
    }
   });
  }
  let _carritoQueue = [];
  let _carritoProcessing = false;

  function _procesarColaCarrito() {
   if (_carritoProcessing || !_carritoQueue.length) return;
   _carritoProcessing = true;
   const prodId = _carritoQueue.shift();
   const prod = window.productos.find(p => p.id === prodId);
   if (prod) agregarAlCarritoObj(prod);
   _carritoProcessing = false;
   if (_carritoQueue.length) requestAnimationFrame(_procesarColaCarrito);
  }

  // Guarda el ID del último producto agregado para aplicar el efecto de glow
  let _ultimoItemAgregado = null;

  window.agregarAlCarrito = (prodId) => {
   if (!window.cajaActual) { toast('⚠️ La caja no está abierta', 'error'); return; }
   const prod = window.productos.find(p => p.id === prodId);
   if (!prod) return;
   if (prod.stockHabilitado !== false && prod.stock <= 0) { toast('Sin stock disponible', 'error'); return; }
   if (esUnidadDetallable(prod.unidad)) {
    // Agregar directo con qty=1, sin modal
    const carrito = getCarrito();
    const idx = carrito.findIndex(i => i.id === prod.id);
    if (idx >= 0) {
     carrito[idx].qty += 1;
    } else {
     // No asignar _precioBase si tiene combo activo
     const tieneComboD = prod.comboActivo && prod.comboPrecio && prod.comboUnidades >= 2;
     carrito.push(tieneComboD ? { ...prod, qty: 1 } : { ...prod, qty: 1, _precioBase: prod.precio });
    }
    setCarrito(carrito);
    _ultimoItemAgregado = prod.id;
    renderCarrito();
    return;
   }
   _ultimoItemAgregado = prodId;
   _carritoQueue.push(prodId);
   requestAnimationFrame(_procesarColaCarrito);
  };

  function agregarAlCarritoObj(prod) {
   const carrito = getCarrito();
   const idx = carrito.findIndex(i => i.id === prod.id);
   if (idx >= 0) {
    if (prod.stockHabilitado !== false && carrito[idx].qty >= prod.stock) { toast('No hay más stock disponible', 'error'); return; }
    carrito[idx].qty++;
   } else {
    // No asignar _precioBase si tiene combo activo; la condición i._precioBase === undefined activa la lógica combo en facturas
    const tieneCombo = prod.comboActivo && prod.comboPrecio && prod.comboUnidades >= 2;
    const nuevoItem = tieneCombo
     ? { ...prod, qty: 1, _precioInventario: prod.precio }
     : { ...prod, qty: 1, _precioBase: prod.precio, _precioInventario: prod.precio };
    carrito.push(nuevoItem);
   }
   setCarrito(carrito);
   _ultimoItemAgregado = prod.id;
   renderCarrito();
  }

  window.cambiarQty = (prodId, delta) => {
   const carrito = getCarrito();
   const idx = carrito.findIndex(i => i.id === prodId);
   if (idx < 0) return;
   carrito[idx].qty += delta;
   if (carrito[idx].qty <= 0) carrito.splice(idx, 1);
   setCarrito(carrito);
   renderCarrito();
  };

  function _renderItemNormal(item) {
   const pesoNeto = item.pesoNeto ? `<span class="peso-neto-badge">${item.pesoNeto}</span>` : '';
   // Lógica de combo: calcular precio real según cantidad de unidades
   if (item.comboActivo && item.comboPrecio && item.comboUnidades >= 2) {
    const subtotalReal = window.calcularPrecioConCombo(item.qty, item.precio, item.comboPrecio, item.comboUnidades);
    const combosCompletos = Math.floor(item.qty / item.comboUnidades);
    const sueltas = item.qty % item.comboUnidades;
    return `<div class="carrito-item"><div class="img-producto" style="position:relative;">${item.imagen ? `<img src="${item.imagen}" alt="${item.nombre}" onerror="this.outerHTML='<div class=&quot;item-emoji&quot;>📦</div>'">` : `<div class="item-emoji">📦</div>`}${pesoNeto}</div><div class="item-info"><div class="item-nombre">${item.nombre}</div><div class="item-precio">${fmt(item.precio)} c/u · ${item.comboUnidades}x${fmt(item.comboPrecio)}</div><div><span class="item-subtotal">${fmt(subtotalReal)}</span></div></div><div class="item-ctrl"><button class="qty-btn minus" onclick="cambiarQty('${item.id}', -1)">−</button><span class="qty-num">${item.qty}</span><button class="qty-btn plus" onclick="cambiarQty('${item.id}', 1)">+</button></div></div>`;
   }
   return `<div class="carrito-item"><div class="img-producto" style="position:relative;">${item.imagen ? `<img src="${item.imagen}" alt="${item.nombre}" onerror="this.outerHTML='<div class=&quot;item-emoji&quot;>📦</div>'">` : `<div class="item-emoji">📦</div>`}${pesoNeto}</div><div class="item-info"><div class="item-nombre">${item.nombre}</div><div class="item-precio">${fmt(item.precio)} c/u</div><div><span class="item-subtotal">${fmt(item.precio * item.qty)}</span></div></div><div class="item-ctrl"><button class="qty-btn minus" onclick="cambiarQty('${item.id}', -1)">−</button><span class="qty-num">${item.qty}</span><button class="qty-btn plus" onclick="cambiarQty('${item.id}', 1)">+</button></div></div>`;
  }

  function _renderItemDetallable(item) {
   const precioBase = item._precioBase || item.precio;
   const unidadLabel = labelUnidad(item.unidad || '');
   const subtotal = precioBase * item.qty;
   const qtyDisplay = Number.isInteger(item.qty) ? item.qty : item.qty.toFixed(2);
   const pesoNeto = item.pesoNeto ? `<span class="peso-neto-badge">${item.pesoNeto}</span>` : '';
   return `<div class="carrito-item">
    <div class="img-producto" style="position:relative;">${item.imagen ? `<img src="${item.imagen}" alt="${item.nombre}" onerror="this.outerHTML='<div class=&quot;item-emoji&quot;>📦</div>'" style="">` : `<div class="item-emoji" style="width:44px;height:44px;font-size:20px;">📦</div>`}${pesoNeto}</div>
    <div class="item-info" style="flex:1;min-width:0;">
     <div class="item-nombre">${item.nombre}</div>
     <div class="item-precio">${fmt(precioBase)}/${unidadLabel}</div>
     <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
      <span class="item-subtotal" id="du-subtotal-${item.id}">${fmt(subtotal)}</span>
     </div>
    </div>
    <div class="btns-editar-lib">
     <div style="display:flex;gap:4px;">
      <button class="qty-btn minus" onclick="eliminarItemDetalle('${item.id}')" style="background:#fff0f0;color:#e03131;width:36px;height:36px;font-size:16px;" title="Eliminar"><i class="fas fa-trash"></i></button>
      <button onclick="abrirModalEditarDetalle('${item.id}')" style="background:#1971c2;color:white;border:none;border-radius:6px;padding:10px 10px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;"><i class="fas fa-pen" style="font-size:10px;"></i> Editar</button>
     </div>
     <span class="item-unidad-cantidad">${qtyDisplay} ${unidadLabel}</span>
    </div>
   </div>`;
  }

  window.eliminarItemDetalle = (prodId) => {
   const carrito = getCarrito();
   const idx = carrito.findIndex(i => i.id === prodId);
   if (idx >= 0) { carrito.splice(idx, 1); setCarrito(carrito); renderCarrito(); }
  };

  function renderCarrito() {
   renderFacturasTabs();
   const items = document.getElementById('carrito-items');
   const count = document.getElementById('carrito-count');
   const carrito = getCarrito();
   // Contar window.productos distintos (no suma de unidades/libras/onzas)
   count.textContent = carrito.length;

   // Actualizar nombre de la factura en el header
   const headerNombre = document.getElementById('carrito-header-nombre');
   if (headerNombre) {
    const tabActiva = _getTabActiva();
    headerNombre.textContent = tabActiva ? tabActiva.nombre : 'Carrito';
   }

   if (!carrito.length) {
    items.innerHTML = `<div class="carrito-empty"><i class="fas fa-shopping-cart"></i><p>Agrega window.productos al carrito</p></div>`;
   } else {
    // ── Render diferencial: preserva imágenes ya cargadas ──
    // Eliminar nodos que NO son carrito-item (ej: carrito-empty)
    Array.from(items.children).forEach(el => {
     if (!el.classList.contains('carrito-item')) el.remove();
    });

    // Recopilar nodos existentes por data-item-id
    const existingNodes = {};
    items.querySelectorAll('.carrito-item[data-item-id]').forEach(el => {
     existingNodes[el.dataset.itemId] = el;
    });

    const newIds = new Set(carrito.map(i => i.id));

    // Eliminar nodos que ya no están en el carrito
    Object.keys(existingNodes).forEach(id => {
     if (!newIds.has(id)) existingNodes[id].remove();
    });

    // Recorrer el carrito en orden y actualizar/crear cada nodo
    carrito.forEach((item, idx) => {
     const esDetallable = esUnidadDetallable(item.unidad);
     const existing = existingNodes[item.id];

     if (existing) {
      // ── Actualizar solo los valores dinámicos, SIN tocar la imagen ──
      if (esDetallable) {
       const precioBase = item._precioBase || item.precio;
       const unidadLabel = labelUnidad(item.unidad || '');
       const subtotal = precioBase * item.qty;
       const qtyDisplay = Number.isInteger(item.qty) ? item.qty : item.qty.toFixed(2);
       const subEl = existing.querySelector('.item-subtotal');
       if (subEl) subEl.textContent = fmt(subtotal);
       const cantEl = existing.querySelector('.item-unidad-cantidad');
       if (cantEl) cantEl.textContent = `${qtyDisplay} ${unidadLabel}`;
      } else {
       const qtyEl = existing.querySelector('.qty-num');
       if (qtyEl) qtyEl.textContent = item.qty;
       const subEl = existing.querySelector('.item-subtotal');
       if (subEl) {
        if (item.comboActivo && item.comboPrecio && item.comboUnidades >= 2) {
         const subtotalReal = window.calcularPrecioConCombo(item.qty, item.precio, item.comboPrecio, item.comboUnidades);
         subEl.textContent = fmt(subtotalReal);

        } else {
         subEl.textContent = fmt(item.precio * item.qty);
        }
       }
      }

      // Asegurar posición correcta en el DOM
      const currentChildren = Array.from(items.children).filter(el => el.classList.contains('carrito-item'));
      if (currentChildren[idx] !== existing) {
       items.insertBefore(existing, currentChildren[idx] || null);
      }
     } else {
      // ── Crear nodo nuevo con atributo data-item-id ──
      const html = esDetallable ? _renderItemDetallable(item) : _renderItemNormal(item);
      const tpl = document.createElement('div');
      tpl.innerHTML = html.trim();
      const newEl = tpl.firstElementChild;
      newEl.dataset.itemId = item.id;

      // Insertar en la posición correcta
      const currentChildren = Array.from(items.children).filter(el => el.classList.contains('carrito-item'));
      items.insertBefore(newEl, currentChildren[idx] || null);
     }
    });
   }

   const subtotal = carrito.reduce((s, i) => { if (i.comboActivo && i.comboPrecio && i.comboUnidades >= 2) return s + window.calcularPrecioConCombo(i.qty, i.precio, i.comboPrecio, i.comboUnidades); if (i._precioBase !== undefined) return s + i._precioBase * i.qty; return s + i.precio * i.qty; }, 0);
   const itbisPct = window.config.itbisPct || 18;
   const itbisCliente = window.config.itbisCliente === true;
   const itbis = itbisCliente ? subtotal * (itbisPct / 100) : 0;
   const total = subtotal + itbis;
   document.getElementById('cart-subtotal').textContent = fmt(subtotal);
   document.getElementById('cart-itbis-label').textContent = `ITBIS (${itbisPct}%)`;
   document.getElementById('cart-itbis').textContent = fmt(itbis);
   document.getElementById('cart-total').textContent = fmt(total);
   // Mostrar/ocultar fila ITBIS según configuración
   const itbisRow = document.getElementById('cart-itbis-row');
   if (itbisRow) itbisRow.style.display = itbisCliente ? '' : 'none';
   const btnVaciar = document.getElementById('btn-vaciar-carrito');
   if (btnVaciar) btnVaciar.style.background = carrito.length ? 'var(--rojo)' : '#aab4c8';
   if (typeof window._actualizarFabBadge === 'function') window._actualizarFabBadge(carrito.length);

   // ── Efecto de iluminación al agregar producto ──
   if (_ultimoItemAgregado) {
    const idAgregado = _ultimoItemAgregado;
    _ultimoItemAgregado = null;
    requestAnimationFrame(() => {
     const el = items.querySelector(`.carrito-item[data-item-id="${idAgregado}"]`);
     if (el) {
      el.classList.remove('item-added');
      void el.offsetWidth;
      el.classList.add('item-added');
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setTimeout(() => el.classList.remove('item-added'), 2100);
     }
    });
   }
  }

  // MODO EDICIÓN CARRITO + MODAL EDITAR ITEM
  let _modoEdicionCarrito = false;
  let _meicItemId = null;

  window.toggleModoEdicionCarrito = function () {
   _modoEdicionCarrito = !_modoEdicionCarrito;
   const icon = document.getElementById('icon-editar-carrito');
   if (icon) {
    icon.className = _modoEdicionCarrito ? 'fas fa-times' : 'fas fa-pen';
   }
   const btn = document.getElementById('btn-editar-carrito');
   if (btn) btn.style.background = _modoEdicionCarrito ? 'rgba(252,79,98,0.25)' : 'none';
   _aplicarOverlaysEdicion();
  };

  function _aplicarOverlaysEdicion() {
   const carritoItemsEl = document.getElementById('carrito-items');
   if (!carritoItemsEl) return;
   carritoItemsEl.querySelectorAll('.carrito-item').forEach(el => {
    let ov = el.querySelector('.carrito-edit-overlay');
    if (_modoEdicionCarrito) {
     el.style.position = 'relative';
     if (!ov) {
      ov = document.createElement('div');
      ov.className = 'carrito-edit-overlay';
      ov.innerHTML = '<i class="fas fa-pen"></i>';
      ov.addEventListener('click', function (e) {
       e.stopPropagation();
       const itemId = el.dataset.itemId;
       if (itemId) abrirModalEditarItem(itemId);
      });
      el.appendChild(ov);
     }
    } else {
     if (ov) ov.remove();
    }
   });
  }

  // ── Función interna: calcula el total real de un item respetando combo/detalle ──
  function _meicTotalReal(item, qty) {
   if (item._precioBase !== undefined && !item.comboActivo) {
    // Detallable (libra, kg, etc) o precio ya sobreescrito manualmente
    return (item._precioBase || item.precio) * qty;
   }
   if (item.comboActivo && item.comboPrecio && item.comboUnidades >= 2) {
    return window.calcularPrecioConCombo(qty, item.precio, item.comboPrecio, item.comboUnidades);
   }
   return item.precio * qty;
  }

  window.abrirModalEditarItem = function (itemId) {
   const carrito = getCarrito();
   const item = carrito.find(i => i.id === itemId);
   if (!item) return;
   _meicItemId = itemId;

   document.getElementById('meic-nombre').textContent = item.nombre;
   const qty = parseFloat(Number.isInteger(item.qty) ? item.qty : item.qty.toFixed(2));

   // Total original del inventario (sin descuento manual)
   const precioUnitOriginal = item._precioInventario || item.precio;
   const totalOriginal = (item.comboActivo && item.comboPrecio && item.comboUnidades >= 2)
    ? window.calcularPrecioConCombo(qty, precioUnitOriginal, item.comboPrecio, item.comboUnidades)
    : precioUnitOriginal * qty;
   document.getElementById('meic-precio-original').textContent = 'RD$ ' + totalOriginal.toFixed(2);

   // Total actual real (con combo aplicado)
   const totalActual = _meicTotalReal(item, qty);
   document.getElementById('meic-precio').value = totalActual.toFixed(2);
   document.getElementById('meic-qty').value = Number.isInteger(item.qty) ? item.qty : item.qty.toFixed(2);
   const desc = item._descuento || 0;
   document.getElementById('meic-descuento').value = desc > 0 ? desc : '';

   meicActualizarPreview();

   const modal = document.getElementById('modal-editar-item-carrito');
   const panel = document.getElementById('modal-editar-item-panel');
   modal.style.display = 'block';
   requestAnimationFrame(() => {
    requestAnimationFrame(() => {
     panel.style.transform = 'translateX(0)';
     panel.querySelectorAll('input[type="number"]').forEach(inp => {
      inp.addEventListener('wheel', function(e) { e.preventDefault(); }, { passive: false });
     });
    });
   });
  };

  window.cerrarModalEditarItem = function () {
   const panel = document.getElementById('modal-editar-item-panel');
   const modal = document.getElementById('modal-editar-item-carrito');
   panel.style.transform = 'translateX(100%)';
   setTimeout(() => { modal.style.display = 'none'; }, 330);
   _meicItemId = null;
  };

  window.meicActualizarPreview = function () {
   const precioTotal = parseFloat(document.getElementById('meic-precio').value) || 0;
   const qty = parseFloat(document.getElementById('meic-qty').value) || 0;
   const desc = parseFloat(document.getElementById('meic-descuento').value) || 0;
   const precioTotalConDesc = desc > 0 ? precioTotal * (1 - desc / 100) : precioTotal;
   const precioUnitConDesc = qty > 0 ? precioTotalConDesc / qty : 0;

   document.getElementById('meic-preview-precio').textContent = 'RD$ ' + precioUnitConDesc.toFixed(2) + (desc > 0 ? ' (−' + desc + '%)' : '');
   document.getElementById('meic-preview-qty').textContent = qty;
   document.getElementById('meic-preview-total').textContent = 'RD$ ' + precioTotalConDesc.toFixed(2);

   const infoEl = document.getElementById('meic-descuento-info');
   if (desc > 0 && precioTotal > 0) {
    infoEl.style.display = 'block';
    infoEl.textContent = 'Ahorro: RD$ ' + (precioTotal * desc / 100).toFixed(2);
   } else {
    infoEl.style.display = 'none';
   }

   // Actualizar carrito en tiempo real (visual)
   if (_meicItemId && precioTotal > 0 && qty > 0) {
    const carrito = getCarrito();
    const idx = carrito.findIndex(i => i.id === _meicItemId);
    if (idx >= 0) {
     const carritoEl = document.getElementById('carrito-items');
     const itemEl = carritoEl ? carritoEl.querySelector(`.carrito-item[data-item-id="${_meicItemId}"]`) : null;
     if (itemEl) {
      const subEl = itemEl.querySelector('.item-subtotal');
      if (subEl) subEl.textContent = fmt(precioTotalConDesc);
      const qtyEl = itemEl.querySelector('.qty-num');
      if (qtyEl) qtyEl.textContent = qty;
      const precioEl = itemEl.querySelector('.item-precio');
      if (precioEl) precioEl.textContent = fmt(precioUnitConDesc) + ' c/u';
     }
     // Recalcular totales del footer — el item editado usa el total directo del input
     _meicRecalcularTotales(carrito, idx, precioTotalConDesc);
    }
   }
  };

  // precioTotalEditado = monto total ya con descuento para el item que se está editando
  function _meicRecalcularTotales(carrito, idxEditado, precioTotalEditado) {
   const itbisPct = (window.config && window.config.itbisPct) || 18;
   const itbisCliente = window.config.itbisCliente === true;
   let subtotal = 0;
   let itbis = 0;
   carrito.forEach((item, i) => {
    let lineTotal;
    if (i === idxEditado) {
     lineTotal = precioTotalEditado; // ya es el total real con combo+descuento
    } else {
     lineTotal = _meicTotalReal(item, item.qty);
    }
    subtotal += lineTotal;
    if (itbisCliente && item.itbis !== false) itbis += lineTotal * (itbisPct / 100);
   });
   const total = subtotal + itbis;
   const fmtN = n => 'RD$ ' + n.toFixed(2);
   const subEl = document.getElementById('cart-subtotal');
   const itbisEl = document.getElementById('cart-itbis');
   const totalEl = document.getElementById('cart-total');
   if (subEl) subEl.textContent = fmtN(subtotal);
   if (itbisEl) itbisEl.textContent = fmtN(itbis);
   if (totalEl) totalEl.textContent = fmtN(total);
  }

  // Al cambiar qty, recalcula el total respetando combo
  window.meicSyncTotalDesdeQty = function () {
   if (!_meicItemId) return;
   const carrito = getCarrito();
   const item = carrito.find(i => i.id === _meicItemId);
   if (!item) return;
   const nuevaQty = parseFloat(document.getElementById('meic-qty').value) || 0;
   if (nuevaQty > 0) {
    const nuevoTotal = _meicTotalReal(item, nuevaQty);
    document.getElementById('meic-precio').value = nuevoTotal.toFixed(2);
   }
  };

  window.meicCambiarQty = function (delta) {
   if (!_meicItemId) return;
   const carrito = getCarrito();
   const item = carrito.find(i => i.id === _meicItemId);
   const inpQty = document.getElementById('meic-qty');
   const qtyVieja = parseFloat(inpQty.value) || 1;
   const nuevaQty = Math.max(1, Math.floor(qtyVieja) + delta);
   inpQty.value = nuevaQty;
   // Recalcular total respetando combo
   if (item) {
    const nuevoTotal = _meicTotalReal(item, nuevaQty);
    document.getElementById('meic-precio').value = nuevoTotal.toFixed(2);
   }
   meicActualizarPreview();
  };

  window.meicGuardarCambios = function () {
   if (!_meicItemId) return;
   const carrito = getCarrito();
   const idx = carrito.findIndex(i => i.id === _meicItemId);
   if (idx < 0) return;

   const precioTotal = parseFloat(document.getElementById('meic-precio').value) || 0;
   const nuevaQty   = parseFloat(document.getElementById('meic-qty').value) || 1;
   const desc       = parseFloat(document.getElementById('meic-descuento').value) || 0;
   const item       = carrito[idx];

   // Preservar precio original del inventario la primera vez
   if (!item._precioInventario) item._precioInventario = item.precio;

   const precioTotalConDesc = desc > 0 ? precioTotal * (1 - desc / 100) : precioTotal;

   item._descuento = desc;
   item.qty = nuevaQty;

   // Si el usuario modificó el total manualmente (distinto del total combo esperado),
   // desactivamos el combo y guardamos como precio unitario fijo.
   const totalEsperadoConCombo = (item.comboActivo && item.comboPrecio && item.comboUnidades >= 2)
    ? window.calcularPrecioConCombo(nuevaQty, item.precio, item.comboPrecio, item.comboUnidades)
    : null;
   const totalEsperadoSinCombo = item.precio * nuevaQty;

   const fueEditadoManualmente = Math.abs(precioTotal - (totalEsperadoConCombo ?? totalEsperadoSinCombo)) > 0.005;

   if (fueEditadoManualmente) {
    // El cajero sobreescribió el precio: guardar como precio unitario fijo, sin combo
    const precioUnitFinal = nuevaQty > 0 ? precioTotalConDesc / nuevaQty : precioTotalConDesc;
    item._precioBase = precioUnitFinal;
    item.precio = precioUnitFinal;
    item.comboActivo = false; // precio fijo manual: ignorar combo
   } else {
    // El total coincide con lo esperado: mantener precio original y combo intacto
    item._precioBase = undefined; // dejar que renderCarrito use combo
    item.precio = item._precioInventario;
   }

   setCarrito(carrito);
   cerrarModalEditarItem();
   renderCarrito();
   if (_modoEdicionCarrito) setTimeout(_aplicarOverlaysEdicion, 80);
   if (window.toast) toast('Producto actualizado', 'ok', 2000);
  };

  // Patch renderCarrito to re-apply overlays when in edit mode
  const _origRenderCarrito = renderCarrito;
  renderCarrito = function() {
   _origRenderCarrito();
   if (_modoEdicionCarrito) {
    requestAnimationFrame(_aplicarOverlaysEdicion);
   }
  };

  function _actualizarBtnLimpiar() {
   const btn = document.querySelector('.btn-dibujo-sm.rojo');
   if (!btn) return;
   const tieneContenido = window.dibujoDataURL !== null;
   btn.classList.toggle('con-dibujo', tieneContenido);
  }

  // Función central que (re)crea el SignaturePad ajustando el canvas al tamaño físico real
  function _crearSignaturePad(canvas, dataURL) {
   if (window.signaturePad) {
    try { window.signaturePad.off(); } catch (e) { }
   }

   // Ancho real en píxeles CSS del wrapper (lo que ocupa en pantalla)
   const wrapper = canvas.parentElement;
   const posRight = document.getElementById('pos-right');
   const realW = wrapper.offsetWidth
    || (posRight ? posRight.clientWidth - 32 : 0)
    || 320;
   const dpr = window.devicePixelRatio || 1;

   // Fijar el canvas al tamaño físico real × DPR para que SignaturePad calcule el offset bien
   canvas.width = Math.round(realW * dpr);
   canvas.height = Math.round(256 * dpr);
   canvas.style.width = realW + 'px';
   canvas.style.height = '256px';

   signaturePad = new SignaturePad(canvas, {
    backgroundColor: 'white',
    penColor: 'black',
    minWidth: 1,
    maxWidth: 1,
    velocityFilterWeight: 0
   });

   // Escalar el contexto del canvas por DPR para nitidez en pantallas HiDPI
   const ctx = canvas.getContext('2d');
   ctx.scale(dpr, dpr);

   // Cargar datos si existen
   const datos = dataURL !== undefined ? dataURL : window.dibujoDataURL;
   if (datos) {
    const img = new Image();
    img.onload = () => {
     // Dibujar manualmente la imagen respetando la escala DPR
     ctx.drawImage(img, 0, 0, realW, 256);
    };
    img.src = datos;
    dibujoDataURL = datos;
   }

   // Listener único: guarda el trazo en la clave propia de la tab activa
   window.signaturePad.addEventListener('endStroke', () => {
    dibujoDataURL = window.signaturePad.isEmpty() ? null : window.signaturePad.toDataURL();
    const tab = _getTabActiva();
    if (tab) {
     tab.dibujoDataURL = window.dibujoDataURL;
     _guardarDibujoTab(tab.id, window.dibujoDataURL);
    }
    _actualizarBtnLimpiar();
   });
  }

  // Recrea el pad adaptando el canvas al ancho real actual
  function _redimensionarCanvas() {
   const canvas = document.getElementById('firmaCanvas');
   if (!canvas) return;
   const dataActual = window.dibujoDataURL
    || (window.signaturePad && !window.signaturePad.isEmpty() ? window.signaturePad.toDataURL() : null);
   _crearSignaturePad(canvas, dataActual);
  }

  function inicializarSignaturePad() {
   const canvas = document.getElementById('firmaCanvas');
   if (!canvas) return;

   // Crear pad con el dibujo de la tab activa al iniciar
   _crearSignaturePad(canvas, window.dibujoDataURL);

   // ResizeObserver: recrea el pad si el wrapper cambia de ancho (resize, resizer drag, etc.)
   if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => {
     if (!document.getElementById('dibujo-container')?.classList.contains('visible')) return;
     const wrapper = canvas.parentElement;
     const newW = Math.round(wrapper.offsetWidth * (window.devicePixelRatio || 1));
     if (Math.abs(canvas.width - newW) > 2) {
      _redimensionarCanvas();
     }
    });
    ro.observe(canvas.parentElement);
   } else {
    // Fallback para navegadores sin ResizeObserver
    window.addEventListener('resize', () => {
     if (document.getElementById('dibujo-container')?.classList.contains('visible')) {
      _redimensionarCanvas();
     }
    });
   }

   // Cuando el panel se abre: recrear el pad con el ancho real post-animación
   const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
     if (mutation.attributeName === 'class') {
      const container = document.getElementById('dibujo-container');
      if (container && container.classList.contains('visible')) {
       if (window._restaurandoDibujo) return;
       // Esperar a que la animación CSS termine (~290ms) para medir el ancho real
       setTimeout(_redimensionarCanvas, 300);
      }
     }
    });
   });
   observer.observe(document.getElementById('dibujo-container'), { attributes: true });
  }

  function actualizarEstadoDibujo(abierto) {
   const icon = document.getElementById('icon-toggle-dibujo');
   if (icon) {
    icon.className = abierto ? 'fas fa-arrow-down' : 'fas fa-arrow-up';
   }
   localStorage.setItem('dibujo_abierto', abierto ? '1' : '0');
  }

  window.toggleDibujo = () => {
   const container = document.getElementById('dibujo-container');
   if (!container) return;
   if (container.classList.contains('visible')) {
    container.classList.remove('visible');
    actualizarEstadoDibujo(false);
   } else {
    container.classList.add('visible');
    actualizarEstadoDibujo(true);
    // Esperar a que termine la transición CSS (~300ms) para medir el ancho real
    setTimeout(_redimensionarCanvas, 300);
   }
  };

  function restaurarEstadoDibujo() {
   const abierto = localStorage.getItem('dibujo_abierto') === '1';
   if (abierto) {
    const container = document.getElementById('dibujo-container');
    if (container) {
     // Bandera para que el MutationObserver no interfiera durante la restauración
     window._restaurandoDibujo = true;
     container.classList.add('visible');
     actualizarEstadoDibujo(true);
     setTimeout(() => { window._restaurandoDibujo = false; }, 300);
    }
   } else {
    actualizarEstadoDibujo(false);
   }
  }

  window.limpiarDibujo = () => {
   if (window.signaturePad) {
    window.signaturePad.clear();
    dibujoDataURL = null;
    const tab = _getTabActiva();
    if (tab) {
     tab.dibujoDataURL = null;
     _guardarDibujoTab(tab.id, null);
    }
    _actualizarBtnLimpiar();
    toast('Dibujo eliminado', 'info');
   }
  };

  window.abrirModalFacturar = () => {
   const carrito = getCarrito();
   if (!carrito.length) { toast('El carrito está vacío', 'error'); return; }
   if (!window.cajaActual) { toast('La caja no está abierta', 'error'); return; }
   const subtotal = carrito.reduce((s, i) => { if (i.comboActivo && i.comboPrecio && i.comboUnidades >= 2) return s + window.calcularPrecioConCombo(i.qty, i.precio, i.comboPrecio, i.comboUnidades); if (i._precioBase !== undefined) return s + i._precioBase * i.qty; return s + i.precio * i.qty; }, 0);
   const itbisPct = window.config.itbisPct || 18;
   const itbisCliente = window.config.itbisCliente === true;
   const itbis = itbisCliente ? subtotal * (itbisPct / 100) : 0;
   const total = subtotal + itbis;
   document.getElementById('factura-items-lista').innerHTML = carrito.map(item => {
    const precioBase = item._precioBase || item.precio;
    const subtItem = (item.comboActivo && item.comboPrecio && item.comboUnidades >= 2 && item._precioBase === undefined)
     ? window.calcularPrecioConCombo(item.qty, item.precio, item.comboPrecio, item.comboUnidades)
     : precioBase * item.qty;
    const qtyLabel = esUnidadDetallable(item.unidad) ? `${item.qty.toFixed(2)} ${labelUnidad(item.unidad)}` : `x${item.qty}`;
    let qtyLabelCombo;
    const tieneComboModal = item.comboActivo && item.comboPrecio && item.comboUnidades >= 2 && item._precioBase === undefined;
    if (tieneComboModal) {
     const combos = Math.floor(item.qty / item.comboUnidades);
     const sueltas = item.qty % item.comboUnidades;
     const precioComboUd = item.comboPrecio / item.comboUnidades;
     if (combos > 0 && sueltas > 0) {
      qtyLabelCombo = `${combos * item.comboUnidades} uds x ${fmt(precioComboUd)} + ${sueltas} ud${sueltas > 1 ? 's' : ''} x ${fmt(item.precio)}`;
     } else if (combos > 0) {
      qtyLabelCombo = `${item.qty} uds x ${fmt(precioComboUd)}`;
     } else {
      qtyLabelCombo = `${item.qty} ud${item.qty !== 1 ? 's' : ''} x ${fmt(item.precio)}`;
     }
    } else {
     qtyLabelCombo = qtyLabel;
    }
    const precioEfectivo = tieneComboModal && item.qty > 0 ? subtItem / item.qty : precioBase;
    return `<div class="factura-item-row"><span class="fi-nombre">${item.nombre}</span><span class="fi-precio">${fmt(precioEfectivo)}</span><span class="fi-qty">${qtyLabelCombo}</span><span class="fi-precio">${fmt(subtItem)}</span></div>`;
   }).join('');
   document.getElementById('mfact-subtotal').textContent = fmt(subtotal);
   document.getElementById('mfact-itbis-lbl').textContent = `ITBIS (${itbisPct}%)`;
   document.getElementById('mfact-itbis').textContent = fmt(itbis);
   document.getElementById('mfact-total').textContent = fmt(total);
   const itbisRow = document.getElementById('mfact-itbis-row');
   if (itbisRow) itbisRow.style.display = itbisCliente ? '' : 'none';
   document.getElementById('monto-recibido').value = '';
   const _cd = document.getElementById('cambio-display'); _cd.style.display = 'flex'; _cd.style.background = 'rgb(248, 215, 218)'; document.getElementById('cambio-valor').textContent = 'RD$ 0.00';
   mixtoResetear();
   const sel = document.getElementById('fact-empleado');
   sel.innerHTML = window.empleadosCache.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
   const myEmp = window.empleadosCache.find(e => e.uid === window.currentUser.uid);
   if (myEmp) sel.value = myEmp.id;
   seleccionarMetodo('efectivo');
   estadoFacturaSeleccionado = 'pagada'; // default: confirmar pago
   actualizarBtnConfirmar();
   abrirModal('modal-facturar');
  };

  window.seleccionarMetodo = (metodo) => {
   metodoPagoSeleccionado = metodo;
   const metodos = ['efectivo', 'transferencia', 'tarjeta', 'mixto'];
   document.querySelectorAll('.mpago-btn').forEach((b, i) => {
    b.classList.toggle('selected', metodos[i] === metodo);
   });
   const efectivoSec = document.getElementById('efectivo-section');
   const mixtoSec = document.getElementById('mixto-section');
   if (metodo === 'efectivo') {
    efectivoSec.classList.add('visible');
    if (mixtoSec) mixtoSec.style.display = 'none';
   } else if (metodo === 'mixto') {
    efectivoSec.classList.remove('visible');
    if (mixtoSec) { mixtoSec.style.display = 'block'; mixtoActivarCampo('efectivo'); mixtoActualizarResumen(); }
   } else {
    efectivoSec.classList.remove('visible');
    if (mixtoSec) mixtoSec.style.display = 'none';
   }
   actualizarBtnConfirmar();
  };

  let _mixtoActivo = 'efectivo'; // campo activo en teclado
  let _mixtoEfStr = '';
  let _mixtoElecStr = '';
  let _mixtoSubMetodo = 'transferencia'; // 'transferencia' | 'tarjeta'

  window.mixtoSelSubMetodo = (sub) => {
   _mixtoSubMetodo = sub;
   document.getElementById('mixto-sub-trans').classList.toggle('activo', sub === 'transferencia');
   document.getElementById('mixto-sub-tarj').classList.toggle('activo', sub === 'tarjeta');
   const lbl = document.getElementById('mixto-elec-label');
   const resLbl = document.getElementById('mixto-res-elec-lbl');
   if (sub === 'transferencia') {
    if (lbl) lbl.textContent = '🏦 TRANSFERENCIA';
    if (resLbl) resLbl.textContent = '🏦 Transferencia';
   } else {
    if (lbl) lbl.textContent = '💳 TARJETA';
    if (resLbl) resLbl.textContent = '💳 Tarjeta';
   }
  };

  window.mixtoActivarCampo = (campo) => {
   _mixtoActivo = campo;
   const ef = document.getElementById('mixto-campo-efectivo');
   const elec = document.getElementById('mixto-campo-elec');
   if (ef) ef.classList.toggle('mixto-campo-activo', campo === 'efectivo');
   if (elec) elec.classList.toggle('mixto-campo-activo', campo === 'elec');
  };

  window.mixtoPonerResto = (campo) => {
   const carrito = getCarrito();
   const subtotal = carrito.reduce((s, i) => { if (i.comboActivo && i.comboPrecio && i.comboUnidades >= 2) return s + window.calcularPrecioConCombo(i.qty, i.precio, i.comboPrecio, i.comboUnidades); if (i._precioBase !== undefined) return s + i._precioBase * i.qty; return s + i.precio * i.qty; }, 0);
   const itbisPct = window.config.itbisPct || 18;
   const itbisCliente = window.config.itbisCliente === true;
   const total = subtotal * (1 + (itbisCliente ? itbisPct / 100 : 0));
   if (campo === 'efectivo') {
    const elec = parseFloat(_mixtoElecStr) || 0;
    const resto = Math.max(0, total - elec);
    _mixtoEfStr = resto.toFixed(2);
   } else {
    const ef = parseFloat(_mixtoEfStr) || 0;
    const resto = Math.max(0, total - ef);
    _mixtoElecStr = resto.toFixed(2);
   }
   mixtoActivarCampo(campo);
   _mixtoRefrescarDisplays();
   mixtoActualizarResumen();
  };

  window.mixtoTecla = (val) => {
   let str = _mixtoActivo === 'efectivo' ? _mixtoEfStr : _mixtoElecStr;
   if (val === '⌫') { str = str.slice(0, -1); }
   else if (val === '.') { if (!str.includes('.')) str += '.'; }
   else if (val === 'OK') { mixtoActualizarResumen(); return; }
   else { if (str.length < 10) str += val; }
   if (_mixtoActivo === 'efectivo') _mixtoEfStr = str;
   else _mixtoElecStr = str;
   _mixtoRefrescarDisplays();
   mixtoActualizarResumen();
  };

  function _mixtoRefrescarDisplays() {
   const dispEf = document.getElementById('mixto-display-efectivo');
   const dispEl = document.getElementById('mixto-display-elec');
   if (dispEf) dispEf.innerHTML = _mixtoEfStr ? `RD$ ${_mixtoEfStr}` : '<span class="placeholder">Toca para ingresar</span>';
   if (dispEl) dispEl.innerHTML = _mixtoElecStr ? `RD$ ${_mixtoElecStr}` : '<span class="placeholder">Toca para ingresar</span>';
  }

  function mixtoActualizarResumen() {
   const carrito = getCarrito();
   const subtotal = carrito.reduce((s, i) => { if (i.comboActivo && i.comboPrecio && i.comboUnidades >= 2) return s + window.calcularPrecioConCombo(i.qty, i.precio, i.comboPrecio, i.comboUnidades); if (i._precioBase !== undefined) return s + i._precioBase * i.qty; return s + i.precio * i.qty; }, 0);
   const itbisPct = window.config.itbisPct || 18;
   const itbisCliente = window.config.itbisCliente === true;
   const total = subtotal * (1 + (itbisCliente ? itbisPct / 100 : 0));
   const ef = parseFloat(_mixtoEfStr) || 0;
   const elec = parseFloat(_mixtoElecStr) || 0;
   const totalPagado = ef + elec;
   const cambio = totalPagado - total;
   document.getElementById('mixto-res-ef').textContent = fmt(ef);
   document.getElementById('mixto-res-elec').textContent = fmt(elec);
   document.getElementById('mixto-res-total').textContent = fmt(totalPagado);
   const cambioRow = document.getElementById('mixto-res-cambio-row');
   if (cambioRow) {
    cambioRow.style.display = 'flex';
    if (cambio >= 0) {
     cambioRow.className = 'mixto-resumen-row cambio-ok';
     cambioRow.innerHTML = `<span class="lbl">✅ Cambio</span><span class="val">${fmt(cambio)}</span>`;
    } else {
     cambioRow.className = 'mixto-resumen-row cambio-falta';
     cambioRow.innerHTML = `<span class="lbl">❌ Falta</span><span class="val">${fmt(Math.abs(cambio))}</span>`;
    }
   }
   // Botones resto
   const btnRE = document.getElementById('mixto-btn-resto-ef');
   const btnREl = document.getElementById('mixto-btn-resto-elec');
   const restoEf = Math.max(0, total - (parseFloat(_mixtoElecStr) || 0));
   const restoEl = Math.max(0, total - ef);
   if (btnRE) btnRE.textContent = `↑ ${fmt(restoEf)}`;
   if (btnREl) btnREl.textContent = `↑ ${fmt(restoEl)}`;
   actualizarBtnConfirmar();
  }

  function mixtoResetear() {
   _mixtoEfStr = '';
   _mixtoElecStr = '';
   _mixtoActivo = 'efectivo';
   _mixtoSubMetodo = 'transferencia';
   _mixtoRefrescarDisplays();
  }

  window.setEstadoFactura = (estado) => { estadoFacturaSeleccionado = estado; document.getElementById('btn-estado-pagada').classList.toggle('selected', estado === 'pagada'); document.getElementById('btn-estado-pendiente').classList.toggle('selected', estado === 'pendiente'); };

  function _facturaListaParaPagar() {
   const carrito = getCarrito();
   const subtotal = carrito.reduce((s, i) => { if (i.comboActivo && i.comboPrecio && i.comboUnidades >= 2) return s + window.calcularPrecioConCombo(i.qty, i.precio, i.comboPrecio, i.comboUnidades); if (i._precioBase !== undefined) return s + i._precioBase * i.qty; return s + i.precio * i.qty; }, 0);
   const itbisPct = window.config.itbisPct || 18;
   const itbisCliente = window.config.itbisCliente === true;
   const total = subtotal * (1 + (itbisCliente ? itbisPct / 100 : 0));
   if (window.metodoPagoSeleccionado === 'efectivo') {
    const recibido = parseFloat(document.getElementById('monto-recibido')?.value) || 0;
    return recibido >= total;
   }
   if (window.metodoPagoSeleccionado === 'mixto') {
    const ef = parseFloat(_mixtoEfStr) || 0;
    const elec = parseFloat(_mixtoElecStr) || 0;
    return (ef > 0 || elec > 0) && (ef + elec) >= total;
   }
   // transferencia / tarjeta — siempre listo
   return (window.metodoPagoSeleccionado === 'transferencia' || window.metodoPagoSeleccionado === 'tarjeta');
  }

  window.actualizarBtnConfirmar = () => {
   const btn = document.getElementById('btn-confirmar-factura');
   if (!btn) return;
   if (_facturaListaParaPagar()) {
    btn.classList.add('listo');
   } else {
    btn.classList.remove('listo');
   }
  };

  window.procesarComoPendiente = async () => {
   estadoFacturaSeleccionado = 'pendiente';
   await confirmarFactura();
   // window.estadoFacturaSeleccionado se resetea a 'pagada' dentro de confirmarFactura()
  };

  window.calcularCambio = () => { const total = getCarrito().reduce((s, i) => s + (i._precioBase || i.precio) * i.qty, 0) * (1 + (window.config.itbisCliente === true ? (window.config.itbisPct || 18) / 100 : 0)); const recibido = parseFloat(document.getElementById('monto-recibido').value) || 0; const cambio = recibido - total; const disp = document.getElementById('cambio-display'); disp.style.display = 'flex'; if (recibido > 0) { document.getElementById('cambio-valor').textContent = fmt(Math.max(0, cambio)); disp.style.background = cambio >= 0 ? '#d4edda' : '#f8d7da'; } else { document.getElementById('cambio-valor').textContent = 'RD$ 0.00'; disp.style.background = 'rgb(248, 215, 218)'; } actualizarBtnConfirmar(); };

  window.tecNumero = (val) => { const inp = document.getElementById('monto-recibido'); if (val === 'C') { inp.value = ''; } else if (val === '⌫') { inp.value = inp.value.slice(0, -1); } else if (val === 'OK') { calcularCambio(); return; } else { inp.value += val; } calcularCambio(); };

  window.confirmarFactura = async () => {
   // ── 1. Determinar estado ──────────────────────────────────────
   if (!window.estadoFacturaSeleccionado) estadoFacturaSeleccionado = 'pagada';
   const esPendiente = window.estadoFacturaSeleccionado === 'pendiente';

   // ── 2. Validaciones de carrito ────────────────────────────────
   const carrito = getCarrito();
   if (!carrito.length) {
    toast('El carrito está vacío', 'error');
    return;
   }

   // ── 3. Validaciones de pago (solo para facturas pagadas) ──────
   if (!esPendiente) {
    if (window.metodoPagoSeleccionado === 'efectivo') {
     const montoRec = parseFloat(document.getElementById('monto-recibido').value) || 0;
     if (montoRec <= 0) {
      toast('Ingresa el monto recibido en efectivo', 'error');
      return;
     }
     const subtotal = carrito.reduce((s, i) => { if (i.comboActivo && i.comboPrecio && i.comboUnidades >= 2) return s + window.calcularPrecioConCombo(i.qty, i.precio, i.comboPrecio, i.comboUnidades); if (i._precioBase !== undefined) return s + i._precioBase * i.qty; return s + i.precio * i.qty; }, 0);
     const itbisCliente = window.config.itbisCliente === true;
     const total = subtotal * (1 + (itbisCliente ? (window.config.itbisPct || 18) / 100 : 0));
     if (montoRec < total) {
      toast(`Monto insuficiente. El total es ${fmt(total)}`, 'error');
      return;
     }
    }
    if (window.metodoPagoSeleccionado === 'mixto') {
     const ef   = parseFloat(_mixtoEfStr)   || 0;
     const elec = parseFloat(_mixtoElecStr)  || 0;
     const subtotal = carrito.reduce((s, i) => { if (i.comboActivo && i.comboPrecio && i.comboUnidades >= 2) return s + window.calcularPrecioConCombo(i.qty, i.precio, i.comboPrecio, i.comboUnidades); if (i._precioBase !== undefined) return s + i._precioBase * i.qty; return s + i.precio * i.qty; }, 0);
     const itbisCliente = window.config.itbisCliente === true;
     const total = subtotal * (1 + (itbisCliente ? (window.config.itbisPct || 18) / 100 : 0));
     if (ef <= 0 && elec <= 0) {
      toast('Ingresa los montos del pago mixto', 'error');
      return;
     }
     if ((ef + elec) < total - 0.01) {
      toast(`El total pagado (${fmt(ef + elec)}) no cubre el monto de la factura (${fmt(total)})`, 'error');
      return;
     }
    }
   }

   // ── 4. Bloquear botones mientras se procesa ───────────────────
   const btnConfirmar = document.getElementById('btn-confirmar-factura');
   const btnPendiente = document.getElementById('btn-pago-pendiente');
   const btnCancelar  = document.getElementById('modal-facturar')?.querySelector('.btn-sm.gris');
   [btnConfirmar, btnPendiente].forEach(b => { if (b) { b.disabled = true; } });
   if (btnConfirmar) btnConfirmar.innerHTML = '<span class="loader"></span> Procesando...';
   if (btnPendiente) btnPendiente.innerHTML = '<span class="loader"></span> Guardando...';

   // ── MODO DE PRUEBA: simular factura sin guardar ni descontar stock ──
   if (modoPrueba) {
    const subtotal = carrito.reduce((s, i) => { if (i.comboActivo && i.comboPrecio && i.comboUnidades >= 2) return s + window.calcularPrecioConCombo(i.qty, i.precio, i.comboPrecio, i.comboUnidades); if (i._precioBase !== undefined) return s + i._precioBase * i.qty; return s + i.precio * i.qty; }, 0);
    const itbisPct = window.config.itbisPct || 18;
    const itbisCliente = window.config.itbisCliente === true;
    const itbis = itbisCliente ? subtotal * (itbisPct / 100) : 0;
    const total = subtotal + itbis;
    const numFactura = `PRUEBA-${Date.now()}`;
    const ncf = `${window.config.ncfPrefijo || 'B01'}${String(window.config.ncfSeq || 1).padStart(8, '0')}`;
    const notaDibujo = (window.signaturePad && !window.signaturePad.isEmpty()) ? window.signaturePad.toDataURL() : null;
    const direccionCliente = document.getElementById('pos-direccion-cliente')?.value.trim() || '';
    const empId = document.getElementById('fact-empleado')?.value || '';
    const empNombre = window.empleadosCache.find(e => e.id === empId)?.nombre || 'Sistema';
    const montoRecibido = window.metodoPagoSeleccionado === 'efectivo'
     ? (parseFloat(document.getElementById('monto-recibido').value) || total)
     : total;

    const facturaSimulada = {
     numero: numFactura, ncf,
     fecha: { toDate: () => new Date() },
     items: carrito.map(i => {
      const pb = i._precioBase || i.precio;
      const itemSubtotal = (i.comboActivo && i.comboPrecio && i.comboUnidades >= 2 && i._precioBase === undefined)
        ? window.calcularPrecioConCombo(i.qty, i.precio, i.comboPrecio, i.comboUnidades)
        : pb * i.qty;
      return { id: i.id, nombre: i.nombre, precio: pb, qty: i.qty, unidad: i.unidad || null,
       comboActivo: i.comboActivo || false, comboPrecio: i.comboPrecio || 0, comboUnidades: i.comboUnidades || 0,
       subtotal: itemSubtotal };
     }),
     subtotal, itbis, itbisPct, total,
     metodoPago: window.metodoPagoSeleccionado,
     montoRecibido,
     estado: window.estadoFacturaSeleccionado,
     empleadoId: empId, empleadoNombre: empNombre,
     cajaId: window.cajaActual?.id || '',
     uid: window.currentUser?.uid || '',
     dibujoNota: notaDibujo,
     ...(direccionCliente ? { direccionCliente } : {}),
     ...(window.metodoPagoSeleccionado === 'mixto' ? {
      mixtoEfectivo: parseFloat(_mixtoEfStr) || 0,
      mixtoElectronico: parseFloat(_mixtoElecStr) || 0,
      mixtoSubMetodo: _mixtoSubMetodo
     } : {})
    };

    // Cerrar modal y limpiar sin tocar Firebase ni stock
    cerrarModal('modal-facturar');
    const tabActual = _getTabActiva();
    if (tabActual) { tabActual.carrito = []; tabActual.direccion = ''; tabActual.dibujoDataURL = null; _guardarDibujoTab(tabActual.id, null); }
    _guardarTabsEnStorage();
    const dirInput = document.getElementById('pos-direccion-cliente');
    if (dirInput) dirInput.value = '';
    if (window.signaturePad) window.signaturePad.clear();
    dibujoDataURL = null;
    const montoInput = document.getElementById('monto-recibido');
    if (montoInput) montoInput.value = '';
    const cambioDisp = document.getElementById('cambio-display');
    if (cambioDisp) cambioDisp.style.display = 'none';
    estadoFacturaSeleccionado = 'pagada';
    metodoPagoSeleccionado = 'efectivo';
    _mixtoEfStr = ''; _mixtoElecStr = '';
    renderCarrito(); renderFacturasTabs();

    facturaActualParaImprimir = { ...facturaSimulada, id: 'prueba' };
    mostrarTicket(window.facturaActualParaImprimir);
    toast('🧪 Factura de prueba generada (no guardada, stock sin cambios)', 'warning', 5000);

    if (btnConfirmar) { btnConfirmar.innerHTML = '<i class="fas fa-check"></i> Confirmar Factura'; btnConfirmar.disabled = false; }
    if (btnPendiente) { btnPendiente.innerHTML = '<i class="fas fa-clock"></i> Pago Pendiente'; btnPendiente.disabled = false; }
    return;
   }

   // ── Detección offline ANTES de operar ──────────────────────────
   const _offline = !navigator.onLine;

   try {
    // ── 5. Calcular totales ───────────────────────────────────────
    const subtotal = carrito.reduce((s, i) => { if (i.comboActivo && i.comboPrecio && i.comboUnidades >= 2) return s + window.calcularPrecioConCombo(i.qty, i.precio, i.comboPrecio, i.comboUnidades); if (i._precioBase !== undefined) return s + i._precioBase * i.qty; return s + i.precio * i.qty; }, 0);
    const itbisPct = window.config.itbisPct || 18;
    const itbisCliente = window.config.itbisCliente === true;
    const itbis = itbisCliente ? subtotal * (itbisPct / 100) : 0;
    const total = subtotal + itbis;

    // ── 6. Datos de empleado y NCF ────────────────────────────────
    const empId = document.getElementById('fact-empleado')?.value || '';
    const empNombre = window.empleadosCache.find(e => e.id === empId)?.nombre || 'Sistema';
    const ncfSeq = window.config.ncfSeq || 1;
    const ncf = `${window.config.ncfPrefijo || 'B01'}${String(ncfSeq).padStart(8, '0')}`;
    const numFactura = `F-${Date.now()}`;
    const notaDibujo = (window.signaturePad && !window.signaturePad.isEmpty()) ? window.signaturePad.toDataURL() : null;
    const direccionCliente = document.getElementById('pos-direccion-cliente')?.value.trim() || '';
    const montoRecibido = window.metodoPagoSeleccionado === 'efectivo'
     ? (parseFloat(document.getElementById('monto-recibido').value) || total)
     : total;

    // ── 7. Construir objeto factura ───────────────────────────────
    const facturaData = {
     numero: numFactura,
     ncf,
     fecha: serverTimestamp(),
     items: carrito.map(i => {
      const pb = i._precioBase || i.precio;
      const itemSubtotal = (i.comboActivo && i.comboPrecio && i.comboUnidades >= 2 && i._precioBase === undefined)
        ? window.calcularPrecioConCombo(i.qty, i.precio, i.comboPrecio, i.comboUnidades)
        : pb * i.qty;
      return { id: i.id, nombre: i.nombre, precio: pb, qty: i.qty, unidad: i.unidad || null,
       comboActivo: i.comboActivo || false, comboPrecio: i.comboPrecio || 0, comboUnidades: i.comboUnidades || 0,
       subtotal: itemSubtotal };
     }),
     subtotal,
     itbis,
     itbisPct,
     total,
     metodoPago: window.metodoPagoSeleccionado,
     montoRecibido,
     estado: window.estadoFacturaSeleccionado,
     empleadoId: empId,
     empleadoNombre: empNombre,
     cajaId: window.cajaActual?.id || '',
     uid: window.currentUser?.uid || '',
     dibujoNota: notaDibujo,
     ...(direccionCliente ? { direccionCliente } : {}),
     ...(window.metodoPagoSeleccionado === 'mixto' ? {
      mixtoEfectivo: parseFloat(_mixtoEfStr) || 0,
      mixtoElectronico: parseFloat(_mixtoElecStr) || 0,
      mixtoSubMetodo: _mixtoSubMetodo
     } : {})
    };

    // ── 8. Guardar en Firestore (offline-safe con _fsOp) ──────────
    let factRef;
    if (esPendiente) {
     factRef = await _fsOp(() => addDoc(collection(window.db, 'negocios', window.negocioId, 'facturas-pendientes'), facturaData));
    } else {
     factRef = await _fsOp(() => addDoc(collection(window.db, 'negocios', window.negocioId, 'facturas'), facturaData));
     // Movimiento de caja y actualización de saldo (encolados offline automáticamente)
     _fsOp(() => addDoc(collection(window.db, 'negocios', window.negocioId, 'movimientos'), {
      tipo: 'ingreso',
      descripcion: `Venta ${numFactura}`,
      monto: total,
      fecha: serverTimestamp(),
      uid: window.currentUser?.uid || '',
      empleadoNombre: empNombre,
      facturaId: factRef.id,
      cajaId: window.cajaActual?.id || ''
     }));
     if (window.cajaActual?.id) {
      window.cajaActual.ingresos = (window.cajaActual.ingresos || 0) + total;
      _fsOp(() => updateDoc(doc(window.db, 'negocios', window.negocioId, 'caja', window.cajaActual.id), {
       ingresos: window.cajaActual.ingresos
      }));
     }
    }

    // ── 9. Actualizar NCF (local inmediato + Firestore en cola) ───
    window.config.ncfSeq = ncfSeq + 1;
    _fsOp(() => updateDoc(doc(window.db, 'negocios', window.negocioId, 'configuraciones', 'general'), { ncfSeq: window.config.ncfSeq }));

    // ── 10. Descontar stock localmente y encolar en Firestore ──────
    const batch = writeBatch(window.db);
    for (const item of carrito) {
     if (!item.categoriaId || !item.id) continue;
     const prodRef = doc(window.db, 'negocios', window.negocioId, 'categorias', item.categoriaId, 'productos', item.id);
     const nuevoStock = Math.max(0, (item.stock || 0) - item.qty);
     batch.update(prodRef, { stock: nuevoStock });
     // Actualizar array local inmediatamente para que la UI refleje el cambio
     const pi = window.productos.findIndex(p => p.id === item.id);
     if (pi >= 0) window.productos[pi].stock = nuevoStock;
    }
    _fsOp(() => batch.commit()); // No await — encolar sin bloquear

    // ── 11. Cerrar modal y limpiar carrito ────────────────────────
    cerrarModal('modal-facturar');

    const tabActual = _getTabActiva();
    if (tabActual) {
     tabActual.carrito = [];
     tabActual.direccion = '';
     tabActual.dibujoDataURL = null;
     _guardarDibujoTab(tabActual.id, null);
    }
    _guardarTabsEnStorage();

    const dirInput = document.getElementById('pos-direccion-cliente');
    if (dirInput) dirInput.value = '';
    if (window.signaturePad) window.signaturePad.clear();
    dibujoDataURL = null;
    const montoInput = document.getElementById('monto-recibido');
    if (montoInput) montoInput.value = '';
    const cambioDisp = document.getElementById('cambio-display');
    if (cambioDisp) cambioDisp.style.display = 'none';

    estadoFacturaSeleccionado = 'pagada';
    metodoPagoSeleccionado = 'efectivo';
    _mixtoEfStr = '';
    _mixtoElecStr = '';

    renderCarrito();
    renderFacturasTabs();

    // ── 12. Mostrar ticket y notificación ─────────────────────────
    facturaActualParaImprimir = { ...facturaData, id: factRef.id, fecha: { toDate: () => new Date() } };
    mostrarTicket(window.facturaActualParaImprimir);

    if (_offline) {
     const tipoMsgOffline = esPendiente
      ? '📱 Factura pendiente guardada localmente — se sincronizará con Firebase al volver la conexión'
      : '📱 Factura guardada localmente con éxito — se sincronizará con Firebase al volver la conexión';
     toast(tipoMsgOffline, 'warning', 6000);
    } else {
     const tipoMsg = esPendiente ? '⏳ Factura guardada como pago pendiente' : '✅ Factura procesada exitosamente';
     toast(tipoMsg, 'success', 4000);
    }

   } catch (e) {
    console.error('Error al procesar factura:', e);
    toast('Error al procesar la factura: ' + (e.message || 'Error desconocido'), 'error', 5000);
   } finally {
    // ── 13. Siempre restaurar botones de inmediato ────────────────
    if (btnConfirmar) {
     btnConfirmar.innerHTML = '<i class="fas fa-check"></i> Confirmar Factura';
     btnConfirmar.disabled = false;
    }
    if (btnPendiente) {
     btnPendiente.innerHTML = '<i class="fas fa-clock"></i> Pago Pendiente';
     btnPendiente.disabled = false;
    }
   }
  };

  function mostrarTicket(factura) { const body = document.getElementById('modal-ticket-body'); body.innerHTML = generarHTMLTicket(factura); abrirModal('modal-ticket'); }

  function generarHTMLTicket(factura) {
   const fecha = factura.fecha?.toDate ? factura.fecha.toDate() : new Date();
   let dibujoHtml = '';
   if (factura.dibujoNota) {
    dibujoHtml = `<div style="margin-top:12px; border-top:1px dashed #ccc; padding-top:8px;"><strong>Nota:</strong><br><img src="${factura.dibujoNota}" style="max-width:100%; height:auto; border:1px solid #ddd; border-radius:8px; margin-top:6px;"></div>`;
   }
   // Método de pago — texto legible
   const metodoLabel = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', mixto: 'Mixto' }[factura.metodoPago] || factura.metodoPago;
   // Bloque de pago según método
   let pagoHtml = '';
   if (factura.estado === 'pendiente') {
    // Pago pendiente: solo mostrar "Pago pendiente" como método, sin recibido ni cambio
    pagoHtml = `<div class="ticket-row" style="padding:0px 8px 0px 0px;"><span>Método</span><span>Pago pendiente</span></div>`;
   } else {
    pagoHtml = `<div class="ticket-row" style="padding:0px 8px 0px 0px;"><span>Método</span><span>${metodoLabel}</span></div>`;
    if (factura.metodoPago === 'efectivo') {
     pagoHtml += `<div class="ticket-row"  style="padding:0px 8px 0px 0px;"><span>Recibido</span><span>${fmt(factura.montoRecibido)}</span></div><div class="ticket-row"  style="padding:0px 8px 0px 0px;"><span>Cambio</span><span>${fmt(Math.max(0, (factura.montoRecibido || 0) - factura.total))}</span></div>`;
    } else if (factura.metodoPago === 'mixto') {
     const subLbl = { transferencia: 'Transferencia', tarjeta: 'Tarjeta' }[factura.mixtoSubMetodo] || factura.mixtoSubMetodo || 'Electrónico';
     const cambioMixto = ((factura.mixtoEfectivo || 0) + (factura.mixtoElectronico || 0)) - factura.total;
     pagoHtml += `<div class="ticket-row"><span> Efectivo</span><span>${fmt(factura.mixtoEfectivo || 0)}</span></div><div class="ticket-row"><span>${subLbl}</span><span>${fmt(factura.mixtoElectronico || 0)}</span></div>`;
     if (cambioMixto > 0) pagoHtml += `<div class="ticket-row" style="padding:0px 8px 0px 0px;"><span>Cambio</span><span>${fmt(cambioMixto)}</span></div>`;
    }
   }
   const itemsHtml = (factura.items || []).map(i => {
    const precioBase = i._precioBase || i.precio;
    const qty = i.qty;
    const subtotal = i.subtotal ?? (precioBase * qty);
    let qtyStr;
    if (i.unidad && esUnidadDetallable(i.unidad)) {
     qtyStr = `${parseFloat(qty).toFixed(2)} ${labelUnidad(i.unidad)} x ${fmt(precioBase)}`;
    } else if (i.comboActivo && i.comboPrecio && i.comboUnidades >= 2) {
     const combos = Math.floor(qty / i.comboUnidades);
     const sueltas = qty % i.comboUnidades;
     const precioComboUd = i.comboPrecio / i.comboUnidades;
     if (combos > 0 && sueltas > 0) {
      qtyStr = `Cant.: ${combos * i.comboUnidades} uds x ${precioComboUd.toFixed(2)} + ${sueltas} ud${sueltas > 1 ? 's' : ''} x ${i.precio.toFixed(2)}`;
     } else if (combos > 0) {
      qtyStr = `Cant.: ${qty} uds x ${precioComboUd.toFixed(2)}`;
     } else {
      qtyStr = `Cant.: ${qty} ud${qty !== 1 ? 's' : ''} x ${i.precio.toFixed(2)}`;
     }
    } else {
     qtyStr = `Cant.: ${qty} ud${qty !== 1 ? 's' : ''} x ${precioBase.toFixed(2)}`;
    }
    return `<div style="padding:2px 8px 2px 4px;border-bottom:1px dashed #e0e0e0;">
     <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <span style="font-weight:700;font-size:12px;">${i.nombre}</span>
      <span style="font-family:monospace;font-size:12px;font-weight:700;white-space:nowrap;margin-left:8px;">${fmt(subtotal)}</span>
     </div>
     <div style="font-size:12px;color:#000;margin-top:1px;font-weight:400;">${qtyStr}</div>
    </div>`;
   }).join('');
   return `<div class="ticket">
    <div class="ticket-header">
     <div style="font-size:16px;font-weight:800;">${window.negocioData?.nombre || 'Colmado'}</div>
     <div>${window.negocioData?.direccion || ''}</div>
     <div>${window.negocioData?.telefono || ''}</div>
     ${window.negocioData?.rnc ? `<div>RNC: ${window.negocioData.rnc}</div>` : ''}
     <div style="margin-top:6px;">━━━━━━━━━━━━━━━━━━━━━━</div>
     <div>Factura: ${factura.numero}</div>
     ${factura.ncf ? `<div>NCF: ${factura.ncf}</div>` : ''}
     <div>${fecha.toLocaleString('es-DO')}</div>
     ${factura.direccionCliente ? `<div style="margin-top:4px;"><span style="font-weight:800;font-size:13px;">Dirección:</span><br><span style="font-size:16px;">${factura.direccionCliente}</span></div>` : ''}
    </div>
    <div style="margin:6px 4px 0;">
     <div style="font-size:11px;color:#999;letter-spacing:0.5px;">--------------------------------------</div>
     <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;padding:2px 8px 2px 0px;">
      <span>PRODUCTO</span><span>PRECIO</span>
     </div>
     <div style="font-size:11px;color:#999;letter-spacing:0.5px;">--------------------------------------</div>
     ${itemsHtml}
    </div>
    <div class="ticket-total">
     <div class="ticket-row" style="padding:0px 8px 0px 0px;"><span>Subtotal</span><span>${fmt(factura.subtotal)}</span></div>
     ${factura.itbis > 0 ? `<div class="ticket-row"style="padding:0px 8px 0px 0px;"><span>ITBIS (${factura.itbisPct}%)</span><span>${fmt(factura.itbis)}</span></div>` : ''}
     <div class="ticket-row" style="padding:0px 8px 0px 0px; font-size:16px;"><span>TOTAL</span><span>${fmt(factura.total)}</span></div>
     ${pagoHtml}
    </div>
    ${dibujoHtml}
    <div style="text-align:center;margin-top:12px;font-size:11px;">¡Gracias por su compra!</div>
   </div>`;
  }

  // ── Función interna de impresión via iframe (compatible con HTTP y HTTPS) ──
  function _imprimirContenido(content) {
   const estilos = `body{font-family:monospace;font-size:12px;max-width:300px;margin:0 auto;}.ticket-row{display:flex;justify-content:space-between;margin-bottom:4px;}.ticket-header{text-align:center;border-bottom:1px dashed #ccc;padding-bottom:8px;margin-bottom:8px;}.ticket-total{border-top:1px dashed #ccc;padding-top:6px;margin-top:6px;font-weight:700;}`;
   let iframe = document.getElementById('_print_iframe_hidden');
   if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = '_print_iframe_hidden';
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
    document.body.appendChild(iframe);
   }
   const doc = iframe.contentWindow.document;
   doc.open();
   doc.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${estilos}</style></head><body>${content}</body></html>`);
   doc.close();
   setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); }, 300);
  }

  window.imprimirTicket = () => {
   _imprimirContenido(document.getElementById('modal-ticket-body').innerHTML);
  };

  window.imprimirFacturaActual = () => {
   _imprimirContenido(document.getElementById('modal-ver-factura-body').innerHTML);
  };

  window.nuevaVenta = () => {
   cerrarModal('modal-ticket');
   const tabActual = _getTabActiva();
   if (tabActual) { tabActual.carrito = []; tabActual.direccion = ''; tabActual.dibujoDataURL = null; _guardarTabsEnStorage(); }
   renderFacturasTabs(); renderCarrito(); categoriaActual = null; renderCategoriasPos();
   const dirInput = document.getElementById('pos-direccion-cliente');
   if (dirInput) dirInput.value = '';
  };

  window.abrirModalVaciarCarrito = () => { if (!getCarrito().length) { toast('El carrito ya está vacío', 'info'); return; } abrirModal('modal-vaciar-carrito'); };
  window.confirmarVaciarCarrito = () => {
   setCarrito([]);
   // Si solo queda una tab, renombrarla a "Factura 1"
   if (facturasTabs.length === 1) {
    facturasTabs[0].nombre = 'Factura 1';
    _guardarTabsEnStorage();
   }
   renderCarrito();
   cerrarModal('modal-vaciar-carrito');
   toast('Carrito vaciado', 'info');
  };

  let facturasTabActual = 'pendientes'; // 'pendientes' | 'pagadas'
  let facturasPendientesCache = [];

  // Cambiar tab visible
  window.switchFacturasTab = (tab) => {
   facturasTabActual = tab;
   const btnPend = document.getElementById('btn-tab-pendientes');
   const btnPag = document.getElementById('btn-tab-pagadas');
   if (tab === 'pendientes') {
    btnPend.style.background = '#f59f00';
    btnPend.style.borderColor = '#f59f00';
    btnPend.style.color = '#fff';
    btnPend.style.boxShadow = '0 2px 10px rgba(245,159,0,0.3)';
    btnPag.style.background = 'white';
    btnPag.style.borderColor = '#aab4c8';
    btnPag.style.color = '#4a5568';
    btnPag.style.boxShadow = 'none';
    renderTablaFacturas(filtrarCache(window.facturasPendientesCache));
   } else {
    btnPag.style.background = '#28a745';
    btnPag.style.borderColor = '#28a745';
    btnPag.style.color = '#fff';
    btnPag.style.boxShadow = '0 2px 10px rgba(40,167,69,0.3)';
    btnPend.style.background = 'white';
    btnPend.style.borderColor = '#aab4c8';
    btnPend.style.color = '#4a5568';
    btnPend.style.boxShadow = 'none';
    renderTablaFacturas(filtrarCache(facturasCache));
   }
  };

  function filtrarCache(lista) {
   const buscar = (document.getElementById('fact-buscar')?.value || '').toLowerCase();
   const metodo = document.getElementById('fact-metodo')?.value || '';
   const fechaIni = document.getElementById('fact-fecha-ini')?.value || '';
   const fechaFin = document.getElementById('fact-fecha-fin')?.value || '';
   return lista.filter(f => {
    if (buscar && !f.numero?.toLowerCase().includes(buscar)) return false;
    if (metodo && f.metodoPago !== metodo) return false;
    if (fechaIni || fechaFin) {
     const fecha = f.fecha?.toDate ? f.fecha.toDate() : null;
     if (!fecha) return false;
     if (fechaIni && fecha < new Date(fechaIni)) return false;
     if (fechaFin && fecha > new Date(fechaFin + 'T23:59:59')) return false;
    }
    return true;
   });
  }

// ── Historial de facturas y cobro de pendientes ──
// miColmApp — pos.js
// Historial de facturas y cobro de facturas pendientes
// Depende de window.db, window.negocioId, window.auth, window.cajaActual, etc. (expuestos por core.js)

async function cargarFacturas() {
   // Cargar facturas pagadas
   const qPag = query(collection(window.db, 'negocios', window.negocioId, 'facturas'), orderBy('fecha', 'desc'), limit(100));
   const snapPag = await getDocs(qPag);
   facturasCache = snapPag.docs.map(d => ({ id: d.id, ...d.data() }));

   // Cargar facturas pendientes
   const qPend = query(collection(window.db, 'negocios', window.negocioId, 'facturas-pendientes'), orderBy('fecha', 'desc'), limit(100));
   const snapPend = await getDocs(qPend);
   facturasPendientesCache = snapPend.docs.map(d => ({ id: d.id, ...d.data() }));

   // Actualizar badge
   const badge = document.getElementById('badge-pendientes');
   if (badge) badge.textContent = window.facturasPendientesCache.length;

   // Render según tab activa
   if (facturasTabActual === 'pendientes') {
    renderTablaFacturas(filtrarCache(window.facturasPendientesCache));
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
    renderTablaFacturas(filtrarCache(window.facturasPendientesCache));
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
   const f = window.facturasPendientesCache.find(x => x.id === id);
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
   const f = window.facturasPendientesCache.find(x => x.id === window.pfpFacturaId);
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
   const f = window.facturasPendientesCache.find(x => x.id === window.pfpFacturaId);
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
    pfpMontoStr = window.pfpMontoStr.slice(0, -1);
   } else if (val === '.') {
    if (!window.pfpMontoStr.includes('.')) window.pfpMontoStr += '.';
   } else {
    if (window.pfpMontoStr.length < 10) window.pfpMontoStr += val;
   }
   pfpActualizarDisplay();
  };

  function pfpActualizarDisplay() {
   const val = parseFloat(window.pfpMontoStr) || 0;
   const disp = document.getElementById('pfp-monto-display');
   if (disp) disp.textContent = window.pfpMontoStr ? `RD$ ${window.pfpMontoStr}` : 'RD$ 0.00';
   // Calcular cambio
   const f = window.facturasPendientesCache.find(x => x.id === window.pfpFacturaId);
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
   if (!window.pfpFacturaId) return;
   const f = window.facturasPendientesCache.find(x => x.id === window.pfpFacturaId);
   if (!f) return;
   if (window.pfpMetodo === 'efectivo') {
    const montoRec = parseFloat(window.pfpMontoStr) || 0;
    if (montoRec <= 0) { toast('Ingresa el monto recibido en efectivo', 'error'); return; }
    if (montoRec < f.total) { toast('El monto recibido es menor al total', 'error'); return; }
   }
   if (window.pfpMetodo === 'mixto') {
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
    const montoRec = window.pfpMetodo === 'efectivo' ? (parseFloat(window.pfpMontoStr) || f.total) : f.total;
    const cambio = window.pfpMetodo === 'efectivo' ? Math.max(0, montoRec - f.total) : 0;
    const empNombre = await getEmpNombre();
    const fechaPago = serverTimestamp();

    const facturaPageData = {
     ...f,
     id: undefined,
     estado: 'pagada',
     metodoPago: window.pfpMetodo,
     montoRecibido: montoRec,
     cambio,
     fechaPago,
     ...(window.pfpMetodo === 'mixto' ? {
      mixtoEfectivo: parseFloat(_pfpMixtoEfStr) || 0,
      mixtoElectronico: parseFloat(_pfpMixtoElecStr) || 0,
      mixtoSubMetodo: _pfpMixtoSub
     } : {})
    };
    delete facturaPageData.id;

    const newFactRef = await _fsOp(() => addDoc(collection(window.db, 'negocios', window.negocioId, 'facturas'), facturaPageData));
    _fsOp(() => deleteDoc(doc(window.db, 'negocios', window.negocioId, 'facturas-pendientes', window.pfpFacturaId)));

    if (window.cajaActual) {
     _fsOp(() => addDoc(collection(window.db, 'negocios', window.negocioId, 'movimientos'), {
      tipo: 'ingreso', descripcion: `Pago factura ${f.numero}`, monto: f.total,
      fecha: fechaPago, uid: window.currentUser.uid, empleadoNombre: empNombre,
      facturaId: newFactRef.id, cajaId: window.cajaActual.id
     }));
     let newIngresos = (window.cajaActual.ingresos || 0) + f.total;
     let newGastos = window.cajaActual.gastos || 0;
     if (window.pfpMetodo === 'efectivo' && cambio > 0) {
      _fsOp(() => addDoc(collection(window.db, 'negocios', window.negocioId, 'movimientos'), {
       tipo: 'gasto', descripcion: `Cambio devuelto factura ${f.numero}`, monto: cambio,
       fecha: fechaPago, uid: window.currentUser.uid, empleadoNombre: empNombre,
       facturaId: newFactRef.id, cajaId: window.cajaActual.id
      }));
      newGastos += cambio;
     }
     window.cajaActual.ingresos = newIngresos; window.cajaActual.gastos = newGastos;
     _fsOp(() => updateDoc(doc(window.db, 'negocios', window.negocioId, 'caja', window.cajaActual.id), { ingresos: newIngresos, gastos: newGastos }));
    }

    // Actualizar cache local de facturas pendientes
    const pfpIdx = window.facturasPendientesCache.findIndex(x => x.id === window.pfpFacturaId);
    if (pfpIdx >= 0) window.facturasPendientesCache.splice(pfpIdx, 1);

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
   for (const p of window.productos) {
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

