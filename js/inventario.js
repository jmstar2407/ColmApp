// miColmApp — inventario.js
// CRUD inventario: window.productos, categorías, imágenes, drag-drop, estadísticas
// Requiere: window.db, window.negocioId, window.categorias, window.productos

// miColmApp — inventario.js
// Inventario CRUD: window.productos, categorías, imágenes, drag-drop, estadísticas, escáner HID
// Depende de window.db, window.negocioId, window.categorias, window.productos, etc.

function renderInventario() {
   const fmtUds = v => v % 1 === 0 ? String(v) : v.toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
   const elTotalProds = document.getElementById('inv-stat-total-prods');
   const elDinero = document.getElementById('inv-stat-dinero');
   if (elTotalProds) elTotalProds.innerHTML = `${_invStats.total} <span style="font-size:0.75rem;font-weight:600;color:#16a34a;background:#dcfce7;border-radius:20px;padding:2px 8px;vertical-align:middle;">${fmtUds(_invStats.unidades)} uds en stock</span>`;
   if (elDinero) elDinero.textContent = 'RD$ ' + _invStats.dinero.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

   if (window.inventarioCategoriaActual === '__mas_vendidos__') {
    renderMasVendidosInventario();
   } else if (window.inventarioCategoriaActual) {
    renderProductosInventario(window.inventarioCategoriaActual, window.inventarioBusquedaActual);
   } else {
    renderCategoriasInventario();
   }
  }

  window.toggleModoOrden = () => {
   modoOrdenActivo = !window.modoOrdenActivo;
   const btn = document.getElementById('btn-modo-ordenar');
   if (btn) {
    btn.classList.toggle('activo', window.modoOrdenActivo);
    btn.innerHTML = window.modoOrdenActivo
     ? '<i class="fas fa-check"></i> Listo'
     : '<i class="fas fa-arrows-alt"></i> Ordenar';
   }
   document.querySelectorAll('.categorias-grid-inv, .productos-grid-inv').forEach(g => {
    g.classList.toggle('modo-orden', window.modoOrdenActivo);
    g.querySelectorAll('[draggable]').forEach(c => c.draggable = window.modoOrdenActivo);
   });
  };

  // Soporte táctil para drag & drop
  let touchDragSrcEl = null;
  let touchDragSrcId = null;
  let touchDragType = null;
  let touchStartX = 0, touchStartY = 0;

  function attachTouchDrag(card, id, type, container) {
   card.addEventListener('touchstart', (e) => {
    if (!window.modoOrdenActivo) return;
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchDragSrcEl = card;
    touchDragSrcId = id;
    touchDragType = type;
    card.classList.add('dragging');
    e.preventDefault();
   });

   card.addEventListener('touchmove', (e) => {
    if (!window.modoOrdenActivo || !touchDragSrcEl) return;
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const dragOverCard = target?.closest(type === 'cat' ? '.cat-card-inv' : '.prod-card-inv');
    if (dragOverCard && dragOverCard !== touchDragSrcEl) {
     container.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
     dragOverCard.classList.add('drag-over');
    }
    e.preventDefault();
   });

   card.addEventListener('touchend', async (e) => {
    if (!window.modoOrdenActivo || !touchDragSrcEl) {
     card.classList.remove('dragging');
     touchDragSrcEl = null;
     return;
    }
    const touch = e.changedTouches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const dropCard = target?.closest(type === 'cat' ? '.cat-card-inv' : '.prod-card-inv');

    if (dropCard && dropCard !== touchDragSrcEl) {
     const allCards = [...container.children];
     const srcIdx = allCards.indexOf(touchDragSrcEl);
     const dstIdx = allCards.indexOf(dropCard);
     if (srcIdx < dstIdx) container.insertBefore(touchDragSrcEl, dropCard.nextSibling);
     else container.insertBefore(touchDragSrcEl, dropCard);

     const newOrder = [...container.children].map(c => c.dataset.id);
     if (type === 'cat') {
      window.categorias.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
      [...container.children].forEach((c, i) => {
       const badge = c.querySelector('.orden-badge');
       if (badge) badge.textContent = i + 1;
      });
      renderCategoriasPos();
      populateCatSelects();
      await guardarOrdenCategorias();
     } else {
      newOrder.forEach((id, i) => { const p = window.productos.find(x => x.id === id); if (p) p.orden = i + 1; });
      [...container.children].forEach((c, i) => {
       const badge = c.querySelector('.orden-badge');
       if (badge) badge.textContent = i + 1;
      });
      await guardarOrdenProductos(newOrder, window.inventarioCategoriaActual);
     }
    }
    container.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
    touchDragSrcEl.classList.remove('dragging');
    touchDragSrcEl = null;
    e.preventDefault();
   });
  }

  // ===== MÁS VENDIDOS INVENTARIO: imagen de fondo editable =====
  window.editarImagenMasVendidos = (e) => {
   e.stopPropagation();
   const input = document.createElement('input');
   input.type = 'file';
   input.accept = 'image/*';
   input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    try {
     const dataUrl = await comprimirImagen(file, 400, 0.92);
     const url = await subirImagenBase64(dataUrl, `negocios/${window.negocioId}/mas_vendidos_bg_${Date.now()}`);
     // Guardar en Firestore (campo en el negocio)
     await updateDoc(doc(window.db, 'negocios', window.negocioId), { masVendidosBg: url });
     window.negocioData.masVendidosBg = url;
     renderInventario();
     renderCategoriasPos(); // actualizar imagen en el POS también
     toast('Imagen de Más Vendidos actualizada', 'success');
    } catch (err) { toast('Error subiendo imagen: ' + err.message, 'error'); }
   };
   input.click();
  };

  function renderMasVendidosInventario() {
   _actualizarBtnCatAccion('masvendidos');
   const area = document.getElementById('inv-contenido');
   if (!area) return;
   const masVendidosProds = window.productos.filter(p => p.masVendidos);
   masVendidosProds.sort((a, b) => (a.ordenMV ?? a.orden ?? 9999) - (b.ordenMV ?? b.orden ?? 9999));

   const header = `<div class="productos-header-inv">
    <button class="back-btn" onclick="volverCategoriasInventario()"><i class="fas fa-arrow-left"></i> Categorías</button>
    <strong>⭐ Más Vendidos</strong>
    <span style="font-size:12px;color:#888;margin-left:8px;">${masVendidosProds.length} producto${masVendidosProds.length !== 1 ? 's' : ''}</span>
    <span style="font-size:11px;color:#aaa;margin-left:8px;">Activa "Ordenar" para reorganizar</span>
   </div>`;

   if (!masVendidosProds.length) {
    area.innerHTML = header + `<div class="empty-state"><i class="fas fa-star"></i><p>No hay window.productos marcados como Más Vendidos.<br>Edita un producto y activa el toggle "⭐ Más Vendidos".</p></div>`;
    return;
   }

   const grid = document.createElement('div');
   grid.className = 'productos-grid-inv' + (window.modoOrdenActivo ? ' modo-orden' : '');
   grid.id = 'prod-drag-grid';

   const attachMVDragEvents = (card, prod) => {
    card.addEventListener('dragstart', (e) => {
     if (!window.modoOrdenActivo) { e.preventDefault(); return; }
     card.classList.add('dragging');
     e.dataTransfer.effectAllowed = 'move';
     e.dataTransfer.setData('text/plain', prod.id);
     window._dragSrcEl = card;
     window._dragSrcId = prod.id;
     window._dragType = 'prod';
    });
    card.addEventListener('dragend', () => {
     card.classList.remove('dragging');
     grid.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
    });
    card.addEventListener('dragover', (e) => {
     if (!window.modoOrdenActivo || window._dragType !== 'prod') return;
     e.preventDefault();
     if (card !== window._dragSrcEl) {
      grid.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
      card.classList.add('drag-over');
     }
    });
    card.addEventListener('dragleave', (e) => {
     if (!card.contains(e.relatedTarget)) card.classList.remove('drag-over');
    });
    card.addEventListener('drop', async (e) => {
     e.preventDefault();
     card.classList.remove('drag-over');
     if (!window.modoOrdenActivo || window._dragType !== 'prod') return;
     const srcEl = window._dragSrcEl;
     const srcId = window._dragSrcId;
     if (!srcEl || srcId === prod.id) return;
     const allCards = [...grid.children];
     const srcIdx = allCards.indexOf(srcEl);
     const dstIdx = allCards.indexOf(card);
     if (srcIdx < dstIdx) grid.insertBefore(srcEl, card.nextSibling);
     else grid.insertBefore(srcEl, card);
     const newOrder = [...grid.children].map(c => c.dataset.id);
     newOrder.forEach((id, i) => { const p = window.productos.find(x => x.id === id); if (p) p.ordenMV = i + 1; });
     [...grid.children].forEach((c, i) => {
      const badge = c.querySelector('.orden-badge');
      if (badge) badge.textContent = i + 1;
     });
     await guardarOrdenMasVendidos(newOrder);
    });
    attachTouchDrag(card, prod.id, 'prod', grid);
   };

   masVendidosProds.forEach((p, index) => {
    const stockHab = p.stockHabilitado !== false;
    const sinStock = stockHab && p.stock <= 0;
    const bajoStock = stockHab && p.stock > 0 && p.stock <= (p.stockMin || 5);
    const stockValDisplay = stockHab ? fmtNum(p.stock || 0) : '∞';
    const card = document.createElement('div');
    card.className = `prod-card-inv${sinStock ? ' sin-stock' : ''}`;
    card.draggable = window.modoOrdenActivo;
    card.dataset.id = p.id;
    card.innerHTML = `
     <span class="orden-badge" style="background:#e67700;">${index + 1}</span>
     <div class="drag-grip-overlay"><i class="fas fa-grip-lines"></i></div>
     <div class="img-producto-inv" style="position:relative;">
      ${p.imagen ? `<img src="${p.imagen}" alt="${p.nombre}" loading="lazy" onerror="this.outerHTML='<div class=&quot;prod-emoji-inv&quot;><i class=&quot;fas fa-shopping-cart&quot;></i></div>'" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">` : `<div class="prod-emoji-inv"><i class="fas fa-shopping-cart"></i></div>`}
      ${p.pesoNeto ? `<span class="peso-neto-badge">${escapeHtml(p.pesoNeto)}</span>` : ''}
     </div>
     <div class="prod-info-inv">
      <div class="prod-nombre-inv">${escapeHtml(p.nombre || '')}</div>
      ${p.codigoBarras ? `<div class="prod-codigo-inv">${escapeHtml(p.codigoBarras)}</div>` : ''}
      <div class="prod-precios-inv"><span class="precio-venta">${fmt(p.precio)}</span>${p.costo ? `<span class="precio-costo">Costo: ${fmt(p.costo)}</span>` : ''}</div>
      <div class="prod-stock-inv ${bajoStock ? 'bajo' : ''} ${sinStock ? 'sin' : ''}">Stock: ${stockValDisplay} ${p.unidad || ''}</div>
     </div>`;
    card.style.cursor = 'pointer';
    card.addEventListener('click', (e) => {
     if (window.modoOrdenActivo) return;
     if (e.target.closest('.drag-grip-overlay')) return;
     editarProducto(p.id);
    });
    attachMVDragEvents(card, p);
    grid.appendChild(card);
   });

   area.innerHTML = header;
   area.appendChild(grid);
  }

  async function guardarOrdenMasVendidos(newOrder) {
   const indicator = document.getElementById('guardando-orden-indicator');
   if (indicator) indicator.classList.add('visible');
   try {
    const batch = writeBatch(window.db);
    newOrder.forEach((id, i) => {
     const p = window.productos.find(x => x.id === id);
     if (p && p.categoriaId) {
      batch.update(doc(window.db, 'negocios', window.negocioId, 'categorias', p.categoriaId, 'productos', id), { ordenMV: i + 1 });
     }
    });
    await batch.commit();
   } catch (e) {
    toast('Error guardando orden: ' + e.message, 'error');
   } finally {
    if (indicator) setTimeout(() => indicator.classList.remove('visible'), 1400);
   }
  }
  // ===== FIN MÁS VENDIDOS INVENTARIO =====

  function renderCategoriasInventario() {
   _actualizarBtnCatAccion('lista');
   const area = document.getElementById('inv-contenido');
   if (!area) return;
   if (!window.categorias.length) {
    area.innerHTML = `<div class="empty-state"><i class="fas fa-folder-open"></i><p>No hay categorías creadas.<br>Haz clic en "Categoría" para agregar.</p></div>`;
    return;
   }

   const grid = document.createElement('div');
   grid.className = 'categorias-grid-inv' + (window.modoOrdenActivo ? ' modo-orden' : '');

   const attachCatDragEvents = (card, catId) => {
    // Mouse events
    card.addEventListener('dragstart', (e) => {
     if (!window.modoOrdenActivo) { e.preventDefault(); return; }
     card.classList.add('dragging');
     e.dataTransfer.effectAllowed = 'move';
     e.dataTransfer.setData('text/plain', catId);
     window._dragSrcEl = card;
     window._dragSrcId = catId;
     window._dragType = 'cat';
    });
    card.addEventListener('dragend', () => {
     card.classList.remove('dragging');
     grid.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
    });
    card.addEventListener('dragover', (e) => {
     if (!window.modoOrdenActivo || window._dragType !== 'cat') return;
     e.preventDefault();
     if (card !== window._dragSrcEl) {
      grid.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
      card.classList.add('drag-over');
     }
    });
    card.addEventListener('dragleave', (e) => {
     if (!card.contains(e.relatedTarget)) card.classList.remove('drag-over');
    });
    card.addEventListener('drop', async (e) => {
     e.preventDefault();
     card.classList.remove('drag-over');
     if (!window.modoOrdenActivo || window._dragType !== 'cat') return;
     const srcEl = window._dragSrcEl;
     const srcId = window._dragSrcId;
     if (!srcEl || srcId === catId) return;
     const allCards = [...grid.children];
     const srcIdx = allCards.indexOf(srcEl);
     const dstIdx = allCards.indexOf(card);
     if (srcIdx < dstIdx) grid.insertBefore(srcEl, card.nextSibling);
     else grid.insertBefore(srcEl, card);
     const newOrder = [...grid.children].map(c => c.dataset.id);
     window.categorias.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
     [...grid.children].forEach((c, i) => {
      const badge = c.querySelector('.orden-badge');
      if (badge) badge.textContent = i + 1;
     });
     renderCategoriasPos();
     populateCatSelects();
     await guardarOrdenCategorias();
    });

    // Touch events
    attachTouchDrag(card, catId, 'cat', grid);
   };

   // Tarjeta especial "Más Vendidos" al inicio del grid
   const mvCard = document.createElement('div');
   mvCard.className = 'cat-card-inv mv-inv-card';
   mvCard.dataset.id = '__mas_vendidos__';
   const mvCount = window.productos.filter(p => p.masVendidos).length;
   const mvBg = window.negocioData?.masVendidosBg || './img/backgrounds/masvendidos_1.jpg';
   mvCard.innerHTML = `
    <div class="drag-grip-overlay" style="display:none;"></div>
    ${mvBg ? `<img src="${mvBg}" alt="Más Vendidos" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px 10px 0 0;display:block;" onerror="this.src='./img/backgrounds/masvendidos_1.jpg'">` : `<div style="width:100%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:52px;background:linear-gradient(135deg,#f59f00,#e67700);border-radius:10px 10px 0 0;">⭐</div>`}
    <div class="cat-info-inv">
     <div class="cat-nombre-inv" style="color:#e67700;">⭐ Más Vendidos</div>
     <div class="cat-stats-inv">${mvCount} producto${mvCount !== 1 ? 's' : ''} destacados</div>
    </div>`;
   mvCard.style.cursor = 'pointer';
   mvCard.style.border = '2px solid #f59f00';
   mvCard.style.boxShadow = '0 4px 16px rgba(245,159,0,0.25)';
   mvCard.addEventListener('click', (e) => {
    if (window.modoOrdenActivo) return;
    if (e.target.closest('.cat-actions-inv')) return;
    inventarioCategoriaActual = '__mas_vendidos__';
    renderInventario();
   });
   grid.appendChild(mvCard);

   window.categorias.forEach((cat, index) => {
    const card = document.createElement('div');
    card.className = 'cat-card-inv';
    card.draggable = window.modoOrdenActivo;
    card.dataset.id = cat.id;

    const imgHtml = cat.imagen
     ? `<img src="${cat.imagen}" alt="${cat.nombre}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px 10px 0 0;display:block;" onerror="this.style.display='none'">`
     : `<span class="cat-emoji-inv">${cat.emoji || '📦'}</span>`;

    card.innerHTML = `
     <span class="orden-badge">${index + 1}</span>
     <div class="drag-grip-overlay"><i class="fas fa-grip-lines"></i></div>
     ${imgHtml}
     <div class="cat-info-inv">
      <div class="cat-nombre-inv">${cat.nombre}</div>
      <div class="cat-stats-inv">${window.productos.filter(p => p.categoriaId === cat.id).length} window.productos</div>
     </div>`;

    card.style.cursor = 'pointer';
    card.addEventListener('click', (e) => {
     if (window.modoOrdenActivo) return;
     if (e.target.closest('.cat-actions-inv')) return;
     verProductosPorCategoriaInventario(cat.id);
    });

    attachCatDragEvents(card, cat.id);
    grid.appendChild(card);
   });

   area.innerHTML = '';
   area.appendChild(grid);
  }

  async function guardarOrdenCategorias() {
   const indicator = document.getElementById('guardando-orden-indicator');
   if (indicator) indicator.classList.add('visible');
   try {
    const batch = writeBatch(window.db);
    window.categorias.forEach((cat, i) => {
     batch.update(doc(window.db, 'negocios', window.negocioId, 'categorias', cat.id), { orden: i + 1 });
     cat.orden = i + 1;
    });
    await batch.commit();
   } catch (e) {
    toast('Error guardando orden: ' + e.message, 'error');
   } finally {
    if (indicator) setTimeout(() => indicator.classList.remove('visible'), 1400);
   }
  }

  function resaltarTextoInv(texto, busqueda) {
   if (!busqueda) return escapeHtml(texto);
   const regex = new RegExp(`(${busqueda.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
   return escapeHtml(texto).replace(regex, '<span class="search-highlight">$1</span>');
  }

  function renderProductosInventario(categoriaId, busqueda = '') {
   _actualizarBtnCatAccion('categoria', categoriaId);
   const area = document.getElementById('inv-contenido');
   const categoria = window.categorias.find(c => c.id === categoriaId);
   let prods = window.productos.filter(p => p.categoriaId === categoriaId);
   if (busqueda) prods = prods.filter(p => p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || (p.codigoBarras || '').includes(busqueda));
   if (!area) return;

   // Stats de la categoría — leer del caché, sin recalcular
   const cs = _invStats.porCategoria[categoriaId] || { total: 0, unidades: 0, dinero: 0 };
   const fmtUdsCat = v => v % 1 === 0 ? String(v) : v.toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
   const catTotalProds = cs.total;
   const catTotalUnidades = cs.unidades;
   const catDinero = cs.dinero;
   const catStatsHtml = `<div style="display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 14px 0;">
    <div style="display:flex;align-items:center;gap:8px;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;padding:8px 14px;flex:1;min-width:140px;">
     <span style="font-size:1.3rem;">📦</span>
     <div>
      <div style="font-size:10px;color:#166534;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;">Productos</div>
      <div style="font-size:1.15rem;font-weight:800;color:#15803d;">${catTotalProds} <span style="font-size:0.72rem;font-weight:600;background:#dcfce7;color:#16a34a;border-radius:20px;padding:1px 7px;">${fmtUdsCat(catTotalUnidades)} uds</span></div>
     </div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:10px;padding:8px 14px;flex:1;min-width:140px;">
     <span style="font-size:1.3rem;">💰</span>
     <div>
      <div style="font-size:10px;color:#1e40af;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;">Invertido</div>
      <div style="font-size:1.15rem;font-weight:800;color:#1d4ed8;">RD$ ${catDinero.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
     </div>
    </div>
   </div>`;

   const header = `<div class="productos-header-inv"><div><button class="back-btn" onclick="volverCategoriasInventario()"><i class="fas fa-arrow-left"></i> Categorías</button></div><div style="text-align: center; width: 140px;"><strong>${categoria?.nombre || 'Productos'}</strong></div><div><button class="btn-sm verde" onclick="abrirModalProductoDesdeCategoria('${categoriaId}')" style="margin-left:auto;"><i class="fas fa-plus"></i> Producto</button></div></div>` + catStatsHtml;

   if (!prods.length) {
    area.innerHTML = header + `<div class="empty-state"><i class="fas fa-box-open"></i><p>No hay window.productos en esta categoría</p></div>`;
    return;
   }

   prods.sort((a, b) => (a.orden ?? 9999) - (b.orden ?? 9999));

   const grid = document.createElement('div');
   grid.className = 'productos-grid-inv' + (window.modoOrdenActivo ? ' modo-orden' : '');
   grid.id = 'prod-drag-grid';

   const attachProdDragEvents = (card, prod) => {
    // Mouse events
    card.addEventListener('dragstart', (e) => {
     if (!window.modoOrdenActivo) { e.preventDefault(); return; }
     card.classList.add('dragging');
     e.dataTransfer.effectAllowed = 'move';
     e.dataTransfer.setData('text/plain', prod.id);
     window._dragSrcEl = card;
     window._dragSrcId = prod.id;
     window._dragType = 'prod';
    });
    card.addEventListener('dragend', () => {
     card.classList.remove('dragging');
     grid.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
    });
    card.addEventListener('dragover', (e) => {
     if (!window.modoOrdenActivo || window._dragType !== 'prod') return;
     e.preventDefault();
     if (card !== window._dragSrcEl) {
      grid.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
      card.classList.add('drag-over');
     }
    });
    card.addEventListener('dragleave', (e) => {
     if (!card.contains(e.relatedTarget)) card.classList.remove('drag-over');
    });
    card.addEventListener('drop', async (e) => {
     e.preventDefault();
     card.classList.remove('drag-over');
     if (!window.modoOrdenActivo || window._dragType !== 'prod') return;
     const srcEl = window._dragSrcEl;
     const srcId = window._dragSrcId;
     if (!srcEl || srcId === prod.id) return;
     const allCards = [...grid.children];
     const srcIdx = allCards.indexOf(srcEl);
     const dstIdx = allCards.indexOf(card);
     if (srcIdx < dstIdx) grid.insertBefore(srcEl, card.nextSibling);
     else grid.insertBefore(srcEl, card);
     const newOrder = [...grid.children].map(c => c.dataset.id);
     newOrder.forEach((id, i) => { const p = window.productos.find(x => x.id === id); if (p) p.orden = i + 1; });
     [...grid.children].forEach((c, i) => {
      const badge = c.querySelector('.orden-badge');
      if (badge) badge.textContent = i + 1;
     });
     await guardarOrdenProductos(newOrder, categoriaId);
    });

    // Touch events
    attachTouchDrag(card, prod.id, 'prod', grid);
   };

   prods.forEach((p, index) => {
    const stockHab = p.stockHabilitado !== false;
    const sinStock = stockHab && p.stock <= 0;
    const bajoStock = stockHab && p.stock > 0 && p.stock <= (p.stockMin || 5);
    const stockValDisplay = stockHab ? fmtNum(p.stock || 0) : '∞';
    const card = document.createElement('div');
    card.className = `prod-card-inv${sinStock ? ' sin-stock' : ''}`;
    card.draggable = window.modoOrdenActivo;
    card.dataset.id = p.id;

    const nombreResaltado = resaltarTextoInv(p.nombre || '', busqueda);
    const barcodeResaltado = p.codigoBarras ? resaltarTextoInv(p.codigoBarras, busqueda) : '';

    card.innerHTML = `
     <span class="orden-badge" style="background:#00b341;">${index + 1}</span>
     <div class="drag-grip-overlay"><i class="fas fa-grip-lines"></i></div>
     <div class="img-producto-inv" style="position:relative;">
      ${p.imagen ? `<img src="${p.imagen}" alt="${p.nombre}" loading="lazy" onerror="this.outerHTML='<div class=&quot;prod-emoji-inv&quot;><i class=&quot;fas fa-shopping-cart&quot;></i></div>'" style="">` : `<div class="prod-emoji-inv"><i class="fas fa-shopping-cart"></i></div>`}
      ${p.pesoNeto ? `<span class="peso-neto-badge">${escapeHtml(p.pesoNeto)}</span>` : ''}
     </div>
     <div class="prod-info-inv">
      <div class="prod-nombre-inv">${nombreResaltado}</div>
      ${p.codigoBarras ? `<div class="prod-codigo-inv">${barcodeResaltado}</div>` : ''}
      <div class="prod-precios-inv"><span class="precio-venta">${fmt(p.precio)}</span>${p.costo ? `<span class="precio-costo">Costo: ${fmt(p.costo)}</span>` : ''}</div>
      <div class="prod-stock-inv ${bajoStock ? 'bajo' : ''} ${sinStock ? 'sin' : ''}">Stock: ${stockValDisplay} ${p.unidad || ''}</div>
      ${p.masVendidos ? `<div class="prod-actions-inv"><span style="font-size:10px;background:#fff3bf;color:#e67700;border-radius:20px;padding:2px 8px;font-weight:700;">⭐ Más Vendidos</span></div>` : ''}
     </div>`;

    card.style.cursor = 'pointer';
    card.addEventListener('click', (e) => {
     if (window.modoOrdenActivo) return;
     if (e.target.closest('.drag-grip-overlay')) return;
     editarProducto(p.id);
    });

    attachProdDragEvents(card, p);
    grid.appendChild(card);
   });

   area.innerHTML = header;
   area.appendChild(grid);
  }

  async function guardarOrdenProductos(newOrder, categoriaId) {
   const indicator = document.getElementById('guardando-orden-indicator');
   if (indicator) indicator.classList.add('visible');
   try {
    const batch = writeBatch(window.db);
    newOrder.forEach((id, i) => {
     batch.update(doc(window.db, 'negocios', window.negocioId, 'categorias', categoriaId, 'productos', id), { orden: i + 1 });
    });
    await batch.commit();
   } catch (e) {
    toast('Error guardando orden: ' + e.message, 'error');
   } finally {
    if (indicator) setTimeout(() => indicator.classList.remove('visible'), 1400);
   }
  }

  window.verProductosPorCategoriaInventario = (catId) => { inventarioCategoriaActual = catId; inventarioBusquedaActual = ''; document.getElementById('inv-buscar').value = ''; renderInventario(); };

  window.volverCategoriasInventario = () => { inventarioCategoriaActual = null; inventarioBusquedaActual = ''; document.getElementById('inv-buscar').value = ''; renderInventario(); };

  window.filtrarInventarioBusqueda = (texto) => {
   inventarioBusquedaActual = texto;
   const dropdown = document.getElementById('inv-buscar-dropdown');

   if (!texto || texto.length < 1) {
    if (dropdown) dropdown.style.display = 'none';
    renderInventario();
    return;
   }

   // Buscar en todos los window.productos
   const q = texto.toLowerCase();
   const found = window.productos.filter(p => p.nombre?.toLowerCase().includes(q) || (p.codigoBarras || '').includes(q));

   if (dropdown) {
    if (!found.length) {
     dropdown.style.display = 'block';
     dropdown.innerHTML = `<div style="padding:14px 16px;color:var(--gris-suave);font-size:14px;text-align:center;">Sin resultados para "<strong>${escapeHtml(texto)}</strong>"</div>`;
    } else {
     dropdown.style.display = 'block';
     dropdown.innerHTML = found.slice(0, 12).map(p => {
      const cat = window.categorias.find(c => c.id === p.categoriaId);
      const nombreH = resaltarTextoInv(p.nombre || '', texto);
      const stockHab = p.stockHabilitado !== false;
      const sinStock = stockHab && p.stock <= 0;
      const stockTxt = !stockHab ? '∞' : (sinStock ? '<span style="color:#e03131">Sin stock</span>' : `Stock: ${fmtNum(p.stock)}`);
      return `<div class="inv-search-item" onclick="irAProductoInventario('${p.categoriaId}','${p.id}')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;border-bottom:1px solid #f0f0f0;transition:background 0.15s;" onmouseover="this.style.background='#f8f9ff'" onmouseout="this.style.background=''">
       ${p.imagen ? `<img src="${p.imagen}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;flex-shrink:0;" onerror="this.outerHTML='<span style=&quot;font-size:22px&quot;>📦</span>'">` : `<span style="font-size:22px">📦</span>`}
       <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${nombreH}</div>
        <div style="font-size:11px;color:var(--gris-suave);">${cat ? cat.nombre : ''} • ${stockTxt}</div>
       </div>
       <div style="font-weight:700;color:#00b341;font-size:13px;flex-shrink:0;">${fmt(p.precio)}</div>
      </div>`;
     }).join('') + (found.length > 12 ? `<div style="padding:10px 14px;font-size:12px;color:var(--gris-suave);text-align:center;">+${found.length - 12} más resultados</div>` : '');
    }
   }
  };

  window.irAProductoInventario = (catId, prodId) => {
   const dropdown = document.getElementById('inv-buscar-dropdown');
   if (dropdown) dropdown.style.display = 'none';
   document.getElementById('inv-buscar').value = '';
   inventarioBusquedaActual = '';
   inventarioCategoriaActual = catId;
   renderInventario();
   // Resaltar el producto después de un tick
   setTimeout(() => {
    const card = document.querySelector(`[data-id="${prodId}"]`);
    if (card) { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); card.style.transition = 'box-shadow 0.3s'; card.style.boxShadow = '0 0 0 3px #1971c2'; setTimeout(() => { card.style.boxShadow = ''; }, 1800); }
   }, 100);
  };

  // Cerrar dropdown al hacer click fuera
  document.addEventListener('click', (e) => {
   const dropdown = document.getElementById('inv-buscar-dropdown');
   const input = document.getElementById('inv-buscar');
   if (dropdown && !dropdown.contains(e.target) && e.target !== input) {
    dropdown.style.display = 'none';
   }
  });

  window.abrirModalProductoDesdeCategoria = (categoriaId) => {
   productoEnEdicion = null;
   document.getElementById('modal-prod-titulo').innerHTML = '<i class="fas fa-box"></i> Nuevo Producto';
   ['prod-nombre', 'prod-peso-neto', 'prod-barcode', 'prod-precio', 'prod-stock', 'prod-stock-min'].forEach(id => document.getElementById(id).value = '');
   document.getElementById('prod-costo').value = '';
   document.getElementById('prod-id').value = '';
   document.getElementById('prod-img-preview').src = '';
   document.getElementById('prod-img-preview').style.display = 'none';
   const icon = document.getElementById('prod-img-icon');
   const h1 = document.getElementById('prod-img-hint1');
   const h2 = document.getElementById('prod-img-hint2');
   const rh = document.getElementById('prod-img-replace-hint');
   if (icon) icon.style.display = 'block';
   if (h1) h1.style.display = 'block';
   if (h2) h2.style.display = 'block';
   if (rh) rh.style.display = 'none';
   document.getElementById('prod-detalle-enabled').checked = false; _syncDetalleToggleUI(false); const _selU = document.getElementById('prod-unidad'); _selU.innerHTML = '<option>Unidad</option><option>Galón</option><option>Caja</option><option>Paquete</option><option>Docena</option>'; _selU.value = 'Unidad';
   document.getElementById('prod-itbis').value = '1';
   // Reset stock toggle
   document.getElementById('prod-stock-enabled').checked = true;
   document.getElementById('stock-fields-wrap').style.display = 'block';
   setMasVendidosToggle(false);
   document.getElementById('prod-combo-enabled').checked = false; _syncComboToggleUI(false); document.getElementById('prod-combo-precio').value = ''; document.getElementById('prod-combo-unidades').value = ''; document.getElementById('combo-preview-txt').textContent = 'Configura el precio del combo y las unidades para ver el resumen.';
   populateCatSelects();
   document.getElementById('prod-categoria').value = categoriaId;
   const btnElimPD = document.getElementById('btn-eliminar-producto');
   if (btnElimPD) btnElimPD.style.display = 'none';
   abrirModal('modal-producto');
  };

  window.editarCategoria = async (catId) => { const cat = window.categorias.find(c => c.id === catId); if (!cat) return; document.getElementById('cat-nombre').value = cat.nombre || ''; document.getElementById('cat-emoji').value = cat.emoji || ''; const icon = document.getElementById('cat-img-icon'); const hint = document.getElementById('cat-img-hint'); if (cat.imagen) { document.getElementById('cat-img-preview').src = cat.imagen; document.getElementById('cat-img-preview').style.display = 'block'; if (icon) icon.style.display = 'none'; if (hint) hint.style.display = 'none'; } else { document.getElementById('cat-img-preview').src = ''; document.getElementById('cat-img-preview').style.display = 'none'; if (icon) icon.style.display = 'block'; if (hint) hint.style.display = 'block'; } window.categoriaEditandoId = catId; const titulo = document.getElementById('modal-cat-titulo'); if (titulo) titulo.innerHTML = '<i class="fas fa-edit"></i> Editar Categoría'; const btnElim = document.getElementById('btn-eliminar-categoria'); if (btnElim) btnElim.style.display = 'inline-flex'; abrirModal('modal-categoria'); };

  window.eliminarCategoria = async (catId) => {
   if (catId === '__mas_vendidos__') { toast('La categoría "Más Vendidos" no se puede eliminar', 'error'); return; }
   const productosEnCat = window.productos.filter(p => p.categoriaId === catId);
   if (productosEnCat.length > 0) { toast(`No se puede eliminar la categoría. Tiene ${productosEnCat.length} window.productos.`, 'error'); return; }
   if (!confirm('¿Eliminar esta categoría?')) return;
   const _offlineDelCat = !navigator.onLine;
   try {
    await _fsOp(() => deleteDoc(doc(window.db, 'negocios', window.negocioId, 'categorias', catId)));
    // Eliminar del array local inmediatamente
    const ci = window.categorias.findIndex(c => c.id === catId);
    if (ci >= 0) window.categorias.splice(ci, 1);
    renderInventario();
    renderCategoriasPos();
    populateCatSelects();
    toast(_offlineDelCat ? '📱 Categoría eliminada localmente — se sincronizará con Firebase' : 'Categoría eliminada ✅', _offlineDelCat ? 'warning' : 'success', _offlineDelCat ? 5000 : 3000);
   } catch (e) { toast('Error: ' + e.message, 'error'); }
  };

  window.eliminarCategoriaDesdeModal = async () => { const catId = window.categoriaEditandoId; if (!catId) return; cerrarModal('modal-categoria'); await eliminarCategoria(catId); };

  window.eliminarProductoDesdeModal = async () => { const prodId = document.getElementById('prod-id').value; if (!prodId) return; cerrarModal('modal-producto'); await eliminarProducto(prodId); };

  const guardarCategoriaOriginal = window.guardarCategoria;
  window.guardarCategoria = async () => {
   const nombre = document.getElementById('cat-nombre').value.trim();
   const emoji = document.getElementById('cat-emoji').value.trim() || '📦';
   if (!nombre) { toast('Ingresa el nombre de la categoría', 'error'); return; }

   // Anti-doble-click
   const btnGuardar = document.querySelector('#modal-categoria .modal-footer .btn-sm.verde');
   if (btnGuardar && btnGuardar.disabled) return;
   if (btnGuardar) { btnGuardar.disabled = true; btnGuardar.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Guardando...'; }

   let imagen = '';
   const preview = document.getElementById('cat-img-preview');
   const _catImgStoragePath = `cats/${window.negocioId}/${Date.now()}`;
   if (preview.src && preview.src !== window.location.href && preview.style.display !== 'none' && !preview.src.includes('firebasestorage')) {
    imagen = await subirImagenBase64(preview.src, _catImgStoragePath);
   } else if (window.categoriaEditandoId) {
    const catExistente = window.categorias.find(c => c.id === window.categoriaEditandoId);
    if (catExistente?.imagen && preview.src === catExistente.imagen) { imagen = catExistente.imagen; }
   }
   const _offlineCat = !navigator.onLine;
   try {
    if (window.categoriaEditandoId) {
     const catId = window.categoriaEditandoId;
     await _fsOp(() => updateDoc(doc(window.db, 'negocios', window.negocioId, 'categorias', catId), { nombre, emoji, imagen }));
     if (imagen && !imagen.startsWith('http')) {
      _actualizarFirestoreEnCola(imagen, `negocios/${window.negocioId}/window.categorias/${catId}`, 'imagen');
     }
     // Actualizar array local inmediatamente
     const ci = window.categorias.findIndex(c => c.id === catId);
     if (ci >= 0) window.categorias[ci] = { ...categorias[ci], nombre, emoji, imagen };
     toast(_offlineCat ? '📱 Categoría actualizada localmente — se sincronizará con Firebase' : 'Categoría actualizada ✅', _offlineCat ? 'warning' : 'success', _offlineCat ? 5000 : 3000);
     delete window.categoriaEditandoId;
    } else {
     const nextOrden = window.categorias.length + 1;
     const newCatRef = await _fsOp(() => addDoc(collection(window.db, 'negocios', window.negocioId, 'categorias'), { nombre, emoji, imagen, orden: nextOrden, creadoEn: serverTimestamp() }));
     if (imagen && !imagen.startsWith('http')) {
      _actualizarFirestoreEnCola(imagen, `negocios/${window.negocioId}/window.categorias/${newCatRef.id}`, 'imagen');
     }
     // Agregar al array local inmediatamente
     window.categorias.push({ id: newCatRef.id, nombre, emoji, imagen, orden: nextOrden });
     toast(_offlineCat ? '📱 Categoría creada localmente — se sincronizará con Firebase' : 'Categoría creada ✅', _offlineCat ? 'warning' : 'success', _offlineCat ? 5000 : 3000);
    }
    cerrarModal('modal-categoria');
    document.getElementById('cat-img-preview').src = '';
    document.getElementById('cat-img-preview').style.display = 'none';
    renderInventario();
    renderCategoriasPos();
    populateCatSelects();
   } catch (e) {
    toast('Error: ' + e.message, 'error');
   } finally {
    if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.innerHTML = '<i class="fas fa-save"></i> Guardar Categoría'; }
   }
  };

  window.abrirModalCategoria = () => { delete window.categoriaEditandoId; document.getElementById('cat-nombre').value = ''; document.getElementById('cat-emoji').value = ''; document.getElementById('cat-img-preview').src = ''; document.getElementById('cat-img-preview').style.display = 'none'; const icon = document.getElementById('cat-img-icon'); const hint = document.getElementById('cat-img-hint'); if (icon) icon.style.display = 'block'; if (hint) hint.style.display = 'block'; const titulo = document.getElementById('modal-cat-titulo'); if (titulo) titulo.innerHTML = '<i class="fas fa-folder-plus"></i> Nueva Categoría'; const btnElim = document.getElementById('btn-eliminar-categoria'); if (btnElim) btnElim.style.display = 'none'; abrirModal('modal-categoria'); };

  function populateCatSelects() {
   const selects = ['prod-categoria'];
   // Excluir la categoría virtual de Más Vendidos del selector
   const catsReales = window.categorias.filter(c => c.id !== '__mas_vendidos__');
   selects.forEach(id => { const sel = document.getElementById(id); if (!sel) return; const prev = sel.value; sel.innerHTML = '<option value="">Selecciona categoría...</option>' + catsReales.map(c => `<option value="${c.id}">${c.emoji || '📦'} ${c.nombre}</option>`).join(''); if (prev && catsReales.find(c => c.id === prev)) sel.value = prev; });
  }

  // Toggle Más Vendidos — solo setea el checked del checkbox nativo
  window.toggleMasVendidosSlider = () => { }; // ya no se usa, se deja vacío por retrocompatibilidad

  function setMasVendidosToggle(val) {
   const chk = document.getElementById('prod-mas-vendidos');
   if (chk) chk.checked = !!val;
  }

  window.abrirModalProducto = () => {
   productoEnEdicion = null;
   document.getElementById('modal-prod-titulo').innerHTML = '<i class="fas fa-box"></i> Nuevo Producto';
   ['prod-nombre', 'prod-peso-neto', 'prod-barcode', 'prod-precio', 'prod-stock', 'prod-stock-min'].forEach(id => document.getElementById(id).value = '');
   document.getElementById('prod-costo').value = '';
   document.getElementById('prod-id').value = '';
   document.getElementById('prod-img-preview').src = '';
   document.getElementById('prod-img-preview').style.display = 'none';
   const icon = document.getElementById('prod-img-icon');
   const h1 = document.getElementById('prod-img-hint1');
   const h2 = document.getElementById('prod-img-hint2');
   const rh = document.getElementById('prod-img-replace-hint');
   if (icon) icon.style.display = 'block';
   if (h1) h1.style.display = 'block';
   if (h2) h2.style.display = 'block';
   if (rh) rh.style.display = 'none';
   document.getElementById('prod-detalle-enabled').checked = false; _syncDetalleToggleUI(false); const _selU = document.getElementById('prod-unidad'); _selU.innerHTML = '<option>Unidad</option><option>Galón</option><option>Caja</option><option>Paquete</option><option>Docena</option>'; _selU.value = 'Unidad';
   document.getElementById('prod-itbis').value = '1';
   // Reset stock toggle
   document.getElementById('prod-stock-enabled').checked = true;
   document.getElementById('stock-fields-wrap').style.display = 'block';
   setMasVendidosToggle(false);
   document.getElementById('prod-combo-enabled').checked = false; _syncComboToggleUI(false); document.getElementById('prod-combo-precio').value = ''; document.getElementById('prod-combo-unidades').value = ''; document.getElementById('combo-preview-txt').textContent = 'Configura el precio del combo y las unidades para ver el resumen.';
   populateCatSelects();
   if (window.inventarioCategoriaActual) {
    document.getElementById('prod-categoria').value = window.inventarioCategoriaActual;
   }
   const btnElimP = document.getElementById('btn-eliminar-producto');
   if (btnElimP) btnElimP.style.display = 'none';
   abrirModal('modal-producto');
  };

  window.editarProducto = (id) => { const p = window.productos.find(pr => pr.id === id); if (!p) return; productoEnEdicion = p; document.getElementById('modal-prod-titulo').innerHTML = '<i class="fas fa-edit"></i> Editar Producto'; document.getElementById('prod-id').value = p.id; document.getElementById('prod-nombre').value = p.nombre || ''; document.getElementById('prod-peso-neto').value = p.pesoNeto || ''; document.getElementById('prod-barcode').value = p.codigoBarras || ''; document.getElementById('prod-precio').value = p.precio || ''; document.getElementById('prod-costo').value = p.costo || ''; const stockHab = p.stockHabilitado !== false; document.getElementById('prod-stock-enabled').checked = stockHab; document.getElementById('stock-fields-wrap').style.display = stockHab ? 'block' : 'none'; document.getElementById('prod-stock').value = stockHab ? (p.stock >= 0 ? p.stock : '') : ''; document.getElementById('prod-stock-min').value = p.stockMin || ''; const detalleActivo = !!p.productoDetalle; document.getElementById('prod-detalle-enabled').checked = detalleActivo; _syncDetalleToggleUI(detalleActivo); const selUnidad = document.getElementById('prod-unidad'); selUnidad.innerHTML = detalleActivo ? '<option>Libra</option><option>Kilogramo</option><option>Onza</option><option>Litro</option>' : '<option>Unidad</option><option>Galón</option><option>Caja</option><option>Paquete</option><option>Docena</option>'; selUnidad.value = p.unidad || (detalleActivo ? 'Libra' : 'Unidad'); document.getElementById('prod-itbis').value = p.itbis !== false ? '1' : '0'; setMasVendidosToggle(!!p.masVendidos); const comboActivo = !!p.comboActivo; document.getElementById('prod-combo-enabled').checked = comboActivo; _syncComboToggleUI(comboActivo); if (comboActivo) { document.getElementById('prod-combo-precio').value = p.comboPrecio || ''; document.getElementById('prod-combo-unidades').value = p.comboUnidades || ''; setTimeout(actualizarComboPreview, 50); } else { document.getElementById('prod-combo-precio').value = ''; document.getElementById('prod-combo-unidades').value = ''; } populateCatSelects(); document.getElementById('prod-categoria').value = p.categoriaId || ''; const icon = document.getElementById('prod-img-icon'); const h1 = document.getElementById('prod-img-hint1'); const h2 = document.getElementById('prod-img-hint2'); const rh = document.getElementById('prod-img-replace-hint'); if (p.imagen) { document.getElementById('prod-img-preview').src = p.imagen; document.getElementById('prod-img-preview').style.display = 'block'; if (icon) icon.style.display = 'none'; if (h1) h1.style.display = 'none'; if (h2) h2.style.display = 'none'; if (rh) rh.style.display = 'block'; } else { document.getElementById('prod-img-preview').src = ''; document.getElementById('prod-img-preview').style.display = 'none'; if (icon) icon.style.display = 'block'; if (h1) h1.style.display = 'block'; if (h2) h2.style.display = 'block'; if (rh) rh.style.display = 'none'; } const btnElimP = document.getElementById('btn-eliminar-producto'); if (btnElimP) btnElimP.style.display = 'inline-flex'; abrirModal('modal-producto'); };

  window.toggleStockFields = function() {
   const enabled = document.getElementById('prod-stock-enabled').checked;
   const wrap = document.getElementById('stock-fields-wrap');
   if (wrap) wrap.style.display = enabled ? 'block' : 'none';
  };

  window.toggleDetalleUnidad = function() {
   const activo = document.getElementById('prod-detalle-enabled').checked;
   _syncDetalleToggleUI(activo);
   const sel = document.getElementById('prod-unidad');
   const unidadActual = sel.value;
   sel.innerHTML = activo
    ? `<option>Libra</option><option>Kilogramo</option><option>Onza</option><option>Litro</option>`
    : `<option>Unidad</option><option>Galón</option><option>Caja</option><option>Paquete</option><option>Docena</option>`;
   const opts = Array.from(sel.options).map(o => o.value);
   if (opts.includes(unidadActual)) sel.value = unidadActual;
  };

  function _syncDetalleToggleUI(activo) {
   const track = document.getElementById('prod-detalle-track');
   const thumb = document.getElementById('prod-detalle-thumb');
   const lbl   = document.getElementById('prod-detalle-label');
   if (track) track.style.background = activo ? '#2f9e44' : '#cbd5e0';
   if (thumb) thumb.style.transform  = activo ? 'translateX(16px)' : 'translateX(0)';
   if (lbl)   lbl.style.background   = activo ? '#d3f9d8' : '#f1f3f9';
  }

  window.toggleComboFields = function() {
   const activo = document.getElementById('prod-combo-enabled').checked;
   const wrap = document.getElementById('combo-fields-wrap');
   const track = document.getElementById('combo-toggle-track');
   const thumb = document.getElementById('combo-toggle-thumb');
   const lbl = document.getElementById('combo-toggle-label');
   if (wrap) wrap.style.display = activo ? 'block' : 'none';
   if (track) track.style.background = activo ? '#f59f00' : '#cbd5e0';
   if (thumb) thumb.style.transform = activo ? 'translateX(16px)' : 'translateX(0)';
   if (lbl) lbl.style.background = activo ? '#fff3bf' : '#f1f3f9';
   if (activo) actualizarComboPreview();
  };

  window.actualizarComboPreview = function() {
   const precioUnit = parseFloat(document.getElementById('prod-precio').value) || 0;
   const comboPrecio = parseFloat(document.getElementById('prod-combo-precio').value) || 0;
   const comboUnidades = parseInt(document.getElementById('prod-combo-unidades').value) || 0;
   const preview = document.getElementById('combo-preview-txt');
   if (!preview) return;
   if (!comboPrecio || !comboUnidades || comboUnidades < 2) {
    preview.textContent = 'Configura el precio del combo y las unidades (mínimo 2) para ver el resumen.';
    return;
   }
   if (!precioUnit) {
    preview.textContent = 'Define el precio de venta unitario primero.';
    return;
   }
   // Ejemplo: con 40 pesos cuántas unidades?
   const ejemploMonto = 40;
   const udsEjemplo = calcularUnidadesCombo(ejemploMonto, precioUnit, comboPrecio, comboUnidades);
   const precioEfectivo = (comboPrecio / comboUnidades).toFixed(2);
   preview.innerHTML = `<strong>${fmt(comboPrecio)}</strong> = ${comboUnidades} unidades (${fmt(precioEfectivo)} c/u efectivo) · Ej: con <strong>${fmt(ejemploMonto)}</strong> → <strong>${udsEjemplo} unidades</strong>`;
  };


  function _syncComboToggleUI(activo) {
   const track = document.getElementById('combo-toggle-track');
   const thumb = document.getElementById('combo-toggle-thumb');
   const lbl = document.getElementById('combo-toggle-label');
   const wrap = document.getElementById('combo-fields-wrap');
   if (track) track.style.background = activo ? '#f59f00' : '#cbd5e0';
   if (thumb) thumb.style.transform = activo ? 'translateX(16px)' : 'translateX(0)';
   if (lbl) lbl.style.background = activo ? '#fff3bf' : '#f1f3f9';
   if (wrap) wrap.style.display = activo ? 'block' : 'none';
  }

  window.guardarProducto = async () => {
   const nombre = document.getElementById('prod-nombre').value.trim();
   const precio = parseFloat(document.getElementById('prod-precio').value);
   let catId = document.getElementById('prod-categoria').value;
   if (!nombre || isNaN(precio) || !catId) { toast('Nombre, precio y categoría son requeridos', 'error'); return; }

   // Anti-doble-click
   const btnGuardar = document.querySelector('#modal-producto .modal-footer .btn-sm.verde');
   if (btnGuardar && btnGuardar.disabled) return;
   if (btnGuardar) { btnGuardar.disabled = true; btnGuardar.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Guardando...'; }

   const data = {
    nombre,
    precio,
    costo: parseFloat(document.getElementById('prod-costo').value) || 0,
    stock: document.getElementById('prod-stock-enabled').checked ? (parseFloat(document.getElementById('prod-stock').value) || 0) : -1,
    stockMin: document.getElementById('prod-stock-enabled').checked ? (parseFloat(document.getElementById('prod-stock-min').value) || 5) : 0,
    stockHabilitado: document.getElementById('prod-stock-enabled').checked,
    codigoBarras: document.getElementById('prod-barcode').value.trim(),
    pesoNeto: document.getElementById('prod-peso-neto').value.trim(),
    productoDetalle: document.getElementById('prod-detalle-enabled').checked,
    unidad: document.getElementById('prod-unidad').value,
    itbis: document.getElementById('prod-itbis').value === '1',
    masVendidos: !!document.getElementById('prod-mas-vendidos').checked,
    comboActivo: !!document.getElementById('prod-combo-enabled').checked,
    comboPrecio: document.getElementById('prod-combo-enabled').checked ? (parseFloat(document.getElementById('prod-combo-precio').value) || 0) : 0,
    comboUnidades: document.getElementById('prod-combo-enabled').checked ? (parseInt(document.getElementById('prod-combo-unidades').value) || 0) : 0,
    categoriaId: catId,
    actualizadoEn: serverTimestamp()
   };

   const preview = document.getElementById('prod-img-preview');
   if (preview.src && !preview.src.startsWith('http') && preview.style.display !== 'none') {
    data.imagen = await subirImagenBase64(preview.src, `prods/${window.negocioId}/${Date.now()}`);
   } else if (window.productoEnEdicion?.imagen) {
    data.imagen = window.productoEnEdicion.imagen;
   }

   const _offlineProd = !navigator.onLine;
   try {
    const prodId = document.getElementById('prod-id').value;
    if (prodId) {
     if (window.productoEnEdicion && window.productoEnEdicion.categoriaId !== catId) {
      const newRef = await _fsOp(() => addDoc(collection(window.db, 'negocios', window.negocioId, 'categorias', catId, 'productos'), { ...data, creadoEn: serverTimestamp() }));
      if (data.imagen && !data.imagen.startsWith('http')) {
       _actualizarFirestoreEnCola(data.imagen, `negocios/${window.negocioId}/window.categorias/${catId}/window.productos/${newRef.id}`, 'imagen');
      }
      _fsOp(() => deleteDoc(doc(window.db, 'negocios', window.negocioId, 'categorias', window.productoEnEdicion.categoriaId, 'productos', prodId)));
      toast(_offlineProd ? '📱 Producto movido localmente — se sincronizará con Firebase' : 'Producto movido a nueva categoría', _offlineProd ? 'warning' : 'success', _offlineProd ? 5000 : 3000);
     } else {
      await _fsOp(() => updateDoc(doc(window.db, 'negocios', window.negocioId, 'categorias', catId, 'productos', prodId), data));
      if (data.imagen && !data.imagen.startsWith('http')) {
       _actualizarFirestoreEnCola(data.imagen, `negocios/${window.negocioId}/window.categorias/${catId}/window.productos/${prodId}`, 'imagen');
      }
      toast(_offlineProd ? '📱 Producto actualizado localmente — se sincronizará con Firebase' : 'Producto actualizado ✅', _offlineProd ? 'warning' : 'success', _offlineProd ? 5000 : 3000);
     }
     // Actualizar array local inmediatamente para reflejar cambio en UI
     const pi = window.productos.findIndex(p => p.id === prodId);
     if (pi >= 0) window.productos[pi] = { ...productos[pi], ...data, id: prodId };
    } else {
     data.creadoEn = serverTimestamp();
     const newProdRef = await _fsOp(() => addDoc(collection(window.db, 'negocios', window.negocioId, 'categorias', catId, 'productos'), data));
     if (data.imagen && !data.imagen.startsWith('http')) {
      _actualizarFirestoreEnCola(data.imagen, `negocios/${window.negocioId}/window.categorias/${catId}/window.productos/${newProdRef.id}`, 'imagen');
     }
     // Agregar al array local inmediatamente
     window.productos.push({ ...data, id: newProdRef.id, categoriaId: catId });
     toast(_offlineProd ? '📱 Producto creado localmente — se sincronizará con Firebase' : 'Producto creado ✅', _offlineProd ? 'warning' : 'success', _offlineProd ? 5000 : 3000);
    }
    cerrarModal('modal-producto');
    renderInventario();
    // Limpiar caché de grids para que refleje los cambios
    const catGrid = document.getElementById(`productos-grid-${catId}`);
    if (catGrid) catGrid.remove();
    delete _gridCache[catId];
    renderCategoriasPos();
   } catch (e) {
    toast('Error: ' + e.message, 'error');
   } finally {
    if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.innerHTML = '<i class="fas fa-save"></i> Guardar'; }
   }
  };

  window.eliminarProducto = async (id) => {
   if (!confirm('¿Eliminar este producto?')) return;
   const p = window.productos.find(pr => pr.id === id);
   if (!p) return;
   const _offlineDel = !navigator.onLine;
   try {
    await _fsOp(() => deleteDoc(doc(window.db, 'negocios', window.negocioId, 'categorias', p.categoriaId, 'productos', id)));
    // Eliminar del array local inmediatamente
    const pi = window.productos.findIndex(pr => pr.id === id);
    if (pi >= 0) window.productos.splice(pi, 1);
    // Limpiar caché del grid
    const catGrid = document.getElementById(`productos-grid-${p.categoriaId}`);
    if (catGrid) catGrid.remove();
    delete _gridCache[p.categoriaId];
    renderInventario();
    renderCategoriasPos();
    toast(_offlineDel ? '📱 Producto eliminado localmente — se sincronizará con Firebase' : 'Producto eliminado ✅', _offlineDel ? 'warning' : 'success', _offlineDel ? 5000 : 3000);
   } catch (e) { toast('Error: ' + e.message, 'error'); }
  };

  // subirImagenBase64 — versión con soporte offline completo:
  // Si hay internet sube directo. Offline: guarda en cola local IndexedDB y
  // devuelve base64 para que la app funcione sin interrupciones.
  async function subirImagenBase64(dataUrl, storagePath, firestorePath, field) {
   if (!dataUrl || dataUrl.startsWith('http')) return dataUrl;
   if (!navigator.onLine) {
    _addToImgQueue({ path: storagePath, dataUrl, firestorePath: firestorePath || null, field: field || 'imagen', savedAt: Date.now() });
    console.log('[Offline] Imagen encolada:', storagePath);
    return dataUrl;
   }
   try {
    const imgRef = ref(storage, storagePath);
    await uploadString(imgRef, dataUrl, 'data_url');
    return await getDownloadURL(imgRef);
   } catch (e) {
    console.warn('Error subiendo imagen, encolando offline:', e);
    _addToImgQueue({ path: storagePath, dataUrl, firestorePath: firestorePath || null, field: field || 'imagen', savedAt: Date.now() });
    return dataUrl;
   }
  }

  function comprimirImagen(file, maxHeight = 400, quality = 0.82) {
   return new Promise((resolve, reject) => {
    const objectURL = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
     URL.revokeObjectURL(objectURL);
     let { width, height } = img;
     if (height > maxHeight) { width = Math.round(width * (maxHeight / height)); height = maxHeight; }
     const canvas = document.createElement('canvas');
     canvas.width = width; canvas.height = height;
     const ctx = canvas.getContext('2d');
     ctx.drawImage(img, 0, 0, width, height);
     const isSVG = file.type === 'image/svg+xml';
     const hasPossibleAlpha = file.type === 'image/png' || file.type === 'image/gif' || file.type === 'image/webp' || file.type === 'image/avif';
     const outMime = (isSVG || !hasPossibleAlpha) ? 'image/jpeg' : 'image/png';
     const outQuality = outMime === 'image/jpeg' ? quality : undefined;
     resolve(canvas.toDataURL(outMime, outQuality));
    };
    img.onerror = () => { URL.revokeObjectURL(objectURL); reject(new Error('No se pudo cargar la imagen')); };
    img.src = objectURL;
   });
  }

  window.previewImagen = async (input) => {
   const file = input.files[0]; if (!file) return;
   try {
    const dataUrl = await comprimirImagen(file);
    const prev = document.getElementById('prod-img-preview');
    prev.src = dataUrl; prev.style.display = 'block';
    const icon = document.getElementById('prod-img-icon');
    const hint1 = document.getElementById('prod-img-hint1');
    const hint2 = document.getElementById('prod-img-hint2');
    const replaceHint = document.getElementById('prod-img-replace-hint');
    if (icon) icon.style.display = 'none';
    if (hint1) hint1.style.display = 'none';
    if (hint2) hint2.style.display = 'none';
    if (replaceHint) replaceHint.style.display = 'block';
   } catch (e) { toast('Error procesando imagen: ' + e.message, 'error'); }
  };

  window.previewCatImagen = async (input) => {
   const file = input.files[0]; if (!file) return;
   try {
    const dataUrl = await comprimirImagen(file);
    const prev = document.getElementById('cat-img-preview');
    prev.src = dataUrl; prev.style.display = 'block';
    const icon = document.getElementById('cat-img-icon');
    const hint = document.getElementById('cat-img-hint');
    if (icon) icon.style.display = 'none';
    if (hint) hint.style.display = 'none';
   } catch (e) { toast('Error procesando imagen: ' + e.message, 'error'); }
  };

  // Detecta escaneos desde cualquier lector HID (teclado externo) en toda la app.
  // Lógica: los lectores escriben el código muy rápido y terminan con Enter.
  // Estado del escáner
  const _bcScanner = {
   buffer: '',
   lastTime: 0,
   SPEED_MS: 60,      // ms máximos entre caracteres de un escaneo real
   MIN_LEN: 4,        // longitud mínima para considerarlo código de barras
   scanBtnActive: false  // true cuando el usuario pulsó el botón de escanear en modal-editar
  };

  // El botón de escanear en el modal de producto activa el modo "permitir reemplazo"
  window.escanearBarcodeProducto = () => {
   _bcScanner.scanBtnActive = true;
   // Si hay cámara disponible, abrir el modal de cámara
   if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    abrirCamaraScanner('prod-barcode');
   } else {
    toast('📷 Escanea el código de barras ahora...', 'info', 3000);
   }
   // Lo desactivamos después de 6 segundos por seguridad
   setTimeout(() => { _bcScanner.scanBtnActive = false; }, 6000);
  };

  document.addEventListener('keydown', (e) => {
   // Ignorar si el foco está en un textarea o input de texto libre
   // (excepto el caso del scanner-input y prod-barcode que manejamos explícitamente)
   const tag = (document.activeElement?.tagName || '').toLowerCase();
   const type = (document.activeElement?.type || '').toLowerCase();
   const isTextInput = (tag === 'textarea') ||
    (tag === 'input' && !['checkbox', 'radio', 'button', 'submit', 'reset'].includes(type));

   const now = Date.now();
   const timeDiff = now - _bcScanner.lastTime;
   _bcScanner.lastTime = now;

   // --- DETERMINAR CONTEXTO ACTIVO ---
   const modalProdVisible = document.getElementById('modal-producto')?.classList.contains('visible');

   // Si el modal de producto está abierto y el foco NO está en prod-barcode,
   // interceptamos el escáner de barras para redirigirlo siempre a prod-barcode
   if (modalProdVisible && isTextInput && document.activeElement?.id !== 'prod-barcode') {
    const activeId = document.activeElement?.id;
    // Solo interceptar si viene de un escáner (rápido) o si acumulamos buffer
    if (e.key.length === 1 && timeDiff < _bcScanner.SPEED_MS) {
     // Es un carácter rápido (escáner) → acumular en buffer y bloquear el input actual
     e.preventDefault();
     _bcScanner.buffer += e.key;
     return;
    }
    if (e.key === 'Enter' && _bcScanner.buffer.length >= _bcScanner.MIN_LEN) {
     // Enter del escáner → no procesar en el input activo
     e.preventDefault();
     const code = _bcScanner.buffer.trim();
     _bcScanner.buffer = '';
     // Redirigir a prod-barcode
     const barcodeInput = document.getElementById('prod-barcode');
     const esEdicion = !!window.productoEnEdicion;
     if (esEdicion) {
      if (_bcScanner.scanBtnActive || !barcodeInput.value.trim()) {
       barcodeInput.value = code;
       _bcScanner.scanBtnActive = false;
       toast('✅ Código de barras capturado', 'success', 2000);
      }
     } else {
      barcodeInput.value = code;
      toast('✅ Código de barras capturado', 'success', 2000);
     }
     return;
    }
    // Tecla lenta o no alfanumérica → dejar pasar normalmente
    if (e.key === 'Enter') {
     _bcScanner.buffer = '';
    }
    return;
   }

   if (e.key === 'Enter') {
    const code = _bcScanner.buffer.trim();
    _bcScanner.buffer = '';

    if (code.length < _bcScanner.MIN_LEN) return;

    const modalScannerVisible = document.getElementById('modal-scanner')?.classList.contains('visible');
    const pagePos = document.getElementById('page-pos')?.classList.contains('active');
    const pageInv = document.getElementById('page-inventario')?.classList.contains('active');

    // 1) Modal scanner ya abierto → comportamiento original
    if (modalScannerVisible) {
     document.getElementById('scanner-input').value = code;
     buscarPorBarcode();
     return;
    }

    // 2) Modal producto visible → llenar campo código de barras
    if (modalProdVisible) {
     const barcodeInput = document.getElementById('prod-barcode');
     const esEdicion = !!window.productoEnEdicion; // true si hay producto en edición
     if (esEdicion) {
      // Solo reemplazar si el botón de escanear fue presionado O si el campo está vacío
      if (_bcScanner.scanBtnActive || !barcodeInput.value.trim()) {
       barcodeInput.value = code;
       _bcScanner.scanBtnActive = false;
       toast('✅ Código de barras capturado', 'success', 2000);
      }
      // Si el campo tiene valor y no se presionó el botón, ignorar silenciosamente
     } else {
      // Modal nuevo producto → siempre llenar
      barcodeInput.value = code;
      toast('✅ Código de barras capturado', 'success', 2000);
     }
     return;
    }

    // 3) POS (facturación) → agregar al carrito si coincide
    if (pagePos && !modalProdVisible && !modalScannerVisible) {
     const prod = window.productos.find(p => p.codigoBarras === code);
     if (prod) {
      agregarAlCarritoObj(prod);
      toast(`🛒 ${prod.nombre} agregado`, 'success', 1800);
     } else {
      toast(`⚠️ Código "${code}" no encontrado`, 'error', 2500);
     }
     return;
    }

    // 4) Inventario → abrir modal de edición si coincide
    if (pageInv && !modalProdVisible) {
     const prod = window.productos.find(p => p.codigoBarras === code);
     if (prod) {
      editarProducto(prod.id);
      toast(`✏️ Editando: ${prod.nombre}`, 'info', 2000);
     } else {
      toast(`⚠️ Código "${code}" no encontrado`, 'error', 2500);
     }
     return;
    }

    return;
   }

   // Acumular caracteres del buffer solo si vienen rápido (lector de barras)
   // o si el foco NO está en un campo de texto (para no interferir con tipeo normal)
   if (e.key.length === 1) {
    if (timeDiff < _bcScanner.SPEED_MS || !isTextInput) {
     // Si el foco está en un input de texto y el tipeo es lento → no acumular
     if (isTextInput && timeDiff >= _bcScanner.SPEED_MS && _bcScanner.buffer.length === 0) {
      return;
     }
     _bcScanner.buffer += e.key;
    } else {
     // Tipeo lento → reiniciar buffer con este caracter
     _bcScanner.buffer = e.key;
    }
   }
  });

  // loadEmpleados reemplazado por onSnapshot en initApp — función vacía por compatibilidad
  async function loadEmpleados() { /* datos ya cargados via onSnapshot en initApp */ }

  function renderEmpleados() { const lista = document.getElementById('empleados-lista'); if (!lista) return; if (!window.empleadosCache.length) { lista.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><p>Sin empleados</p></div>'; return; } lista.innerHTML = window.empleadosCache.map(e => `<div class="empleado-row"><div class="empleado-avatar">${(e.nombre || 'E')[0].toUpperCase()}</div><div class="empleado-info"><div class="emp-nombre">${e.nombre}</div><div class="emp-email">${e.email}</div></div><span class="emp-rol ${e.rol}">${e.rol}</span>${e.uid !== window.currentUser.uid ? `<button class="btn-sm" onclick="eliminarEmpleado('${e.id}')" style="background:#ffe3e3;color:#e03131;padding:6px 10px;font-size:12px;"><i class="fas fa-trash"></i></button>` : ''}</div>`).join(''); }

  window.abrirModalEmpleado = () => { ['emp-nombre', 'emp-email', 'emp-pass'].forEach(id => document.getElementById(id).value = ''); document.getElementById('emp-rol').value = 'empleado'; abrirModal('modal-empleado'); };

  window.guardarEmpleado = async () => {
   const nombre = document.getElementById('emp-nombre').value.trim();
   const email = document.getElementById('emp-email').value.trim();
   const pass = document.getElementById('emp-pass').value;
   const rol = document.getElementById('emp-rol').value;
   if (!nombre || !email || !pass) { toast('Todos los campos son requeridos', 'error'); return; }
   if (pass.length < 6) { toast('La contraseña debe tener mínimo 6 caracteres', 'error'); return; }
   try {
    const cred = await createUserWithEmailAndPassword(window.auth, email, pass);
    const uid = cred.user.uid;
    localStorage.setItem(`negocio_${uid}`, window.negocioId);
    await setDoc(doc(window.db, 'negocios', window.negocioId, 'empleados', uid), { nombre, email, rol, uid, activo: true, creadoEn: serverTimestamp() });
    // Registrar el negocio en el perfil del empleado para que aparezca en su selector
    const userRef = doc(window.db, 'usuarios', uid);
    await setDoc(userRef, { email, negociosAdmin: [window.negocioId] }, { merge: true });
    window.empleadosCache.push({ id: uid, nombre, email, rol, uid });
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

  window.eliminarEmpleado = async (id) => { if (!confirm('¿Eliminar este empleado?')) return; try { await deleteDoc(doc(window.db, 'negocios', window.negocioId, 'empleados', id)); empleadosCache = window.empleadosCache.filter(e => e.id !== id); renderEmpleados(); toast('Empleado eliminado', 'success'); } catch (e) { toast('Error: ' + e.message, 'error'); } };

  // ==================== CONFIG ====================

