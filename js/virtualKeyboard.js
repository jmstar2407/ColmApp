/**
 * virtualKeyboard.js
 * Teclado Touch Virtual para miColmApp
 * Módulo autónomo — se inicializa automáticamente al cargarse.
 *
 * Expone globalmente:
 *   vkbClose()          — cierra el teclado
 *   attachVkbToInput(id) — conecta el teclado a un <input> por su id
 *   initVkb()           — inicializa el teclado (se llama automáticamente)
 */

(function () {

  // ══════════════════════════════════════════════
  //  HTML del teclado — se inyecta en el <body>
  // ══════════════════════════════════════════════
  function injectHTML() {
    // Panel principal
    const panel = document.createElement('div');
    panel.id = 'vkb-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Teclado virtual');
    panel.innerHTML = `
      <div id="vkb-drag-handle" title="Arrastrar para mover">
        <div id="vkb-drag-dots"><span></span><span></span></div>
        <button id="vkb-x-close" title="Cerrar teclado"
          style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:1.2rem;line-height:1;padding:2px 6px;border-radius:6px;margin-left:auto;-webkit-tap-highlight-color:transparent;"
          onmouseover="this.style.color='#e03131'"
          onmouseout="this.style.color='#94a3b8'">✕</button>
      </div>
      <div id="vkb-field-label">Escribiendo en campo</div>
      <div class="vkb-rows" id="vkb-rows"></div>
      <div id="vkb-resize-handle" title="Redimensionar">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M11 1L1 11M11 6L6 11M11 11L11 11" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
    `;
    document.body.appendChild(panel);
  }

  // ══════════════════════════════════════════════
  //  State
  // ══════════════════════════════════════════════
  let vkbTarget      = null;
  let vkbShift       = false;
  let vkbCaps        = false;
  let vkbNumMode     = false;
  let vkbSymMode     = false;
  let vkbDarkTheme   = false;
  let vkbCursorPos   = 0;
  let vkbLastShiftTap = 0;
  let vkbPendingAccent = false;

  // ══════════════════════════════════════════════
  //  Layouts
  // ══════════════════════════════════════════════
  const LAYOUT_ES = [
    // Fila números — backspace al lado del 0
    [
      { l: '#', cls: 'vkb-hash', numRow: true },
      { l: '1', s: '!', numRow: true }, { l: '2', s: '"', numRow: true }, { l: '3', s: '#', numRow: true },
      { l: '4', s: '$', numRow: true }, { l: '5', s: '%', numRow: true }, { l: '6', s: '&', numRow: true },
      { l: '7', s: '/', numRow: true }, { l: '8', s: '(', numRow: true }, { l: '9', s: ')', numRow: true },
      { l: '0', s: '=', numRow: true },
      { action: 'backspace', label: '⌫', cls: 'vkb-backspace' }
    ],
    // Fila 1
    [{ l: 'q' }, { l: 'w' }, { l: 'e' }, { l: 'r' }, { l: 't' }, { l: 'y' }, { l: 'u' }, { l: 'i' }, { l: 'o' }, { l: 'p' },
      { l: '´', cls: 'vkb-accent', action: 'accent' }],
    // Fila 2
    [{ l: 'a' }, { l: 's' }, { l: 'd' }, { l: 'f' }, { l: 'g' }, { l: 'h' }, { l: 'j' }, { l: 'k' }, { l: 'l' },
      { l: 'ñ', cls: 'vkb-eñe' }],
    // Fila 3
    [{ action: 'shift', label: '⇧', cls: 'vkb-shift', id: 'vkb-shift-btn' },
      { l: 'z' }, { l: 'x' }, { l: 'c' }, { l: 'v' }, { l: 'b' }, { l: 'n' }, { l: 'm' },
      { l: ',', s: ';' }, { l: '.', s: ':' }],
    // Fila 4
    [{ action: 'symToggle', label: '#+=', cls: 'vkb-num-toggle' },
      { action: 'themeToggle', label: '🌙', cls: 'vkb-theme-toggle' },
      { action: 'space', label: 'Espacio', cls: 'vkb-space' },
      { l: '-' }, { l: '@' },
      { action: 'enter', label: '↵ OK', cls: 'vkb-enter' }]
  ];

  const LAYOUT_SYM = [
    // Fila 1 símbolos
    [{ l: '!' }, { l: '"' }, { l: '#' }, { l: '$' }, { l: '%' }, { l: '&' }, { l: '/' }, { l: '(' }, { l: ')' }, { l: '=' },
      { action: 'backspace', label: '⌫', cls: 'vkb-backspace' }],
    // Fila 2 símbolos
    [{ l: '@' }, { l: '_' }, { l: '-' }, { l: '+' }, { l: '*' }, { l: '/' }, { l: '\\' }, { l: '|' }, { l: '<' }, { l: '>' }],
    // Fila 3 símbolos
    [{ l: '[' }, { l: ']' }, { l: '{' }, { l: '}' }, { l: '^' }, { l: '~' }, { l: '`' }, { l: '\'' }, { l: '"' }, { l: ';' }],
    // Fila 4 símbolos
    [{ l: ',' }, { l: '.' }, { l: ':' }, { l: '?' }, { l: '¿' }, { l: '¡' }, { l: '°' }, { l: '©' }, { l: '®' }, { l: '€' }],
    // Fila 5 símbolos
    [{ action: 'symToggle', label: 'ABC', cls: 'vkb-num-toggle' },
      { action: 'themeToggle', label: '🌙', cls: 'vkb-theme-toggle' },
      { action: 'space', label: 'Espacio', cls: 'vkb-space' },
      { action: 'enter', label: '↵ OK', cls: 'vkb-enter' }]
  ];

  const LAYOUT_NUM = [
    [{ l: '1' }, { l: '2' }, { l: '3' }, { action: 'backspace', label: '⌫', cls: 'vkb-backspace' }],
    [{ l: '4' }, { l: '5' }, { l: '6' }, { l: '.', s: ',' }],
    [{ l: '7' }, { l: '8' }, { l: '9' }, { l: '-' }],
    [{ l: '0' }, { l: ',' }, { l: '@' }, { action: 'enter', label: '↵ OK', cls: 'vkb-enter' }],
    [{ action: 'numToggle', label: 'ABC', cls: 'vkb-num-toggle', id: 'vkb-num-toggle-btn' },
      { action: 'themeToggle', label: '🌙', cls: 'vkb-theme-toggle' },
      { action: 'space', label: 'Espacio', cls: 'vkb-space' }]
  ];

  // ══════════════════════════════════════════════
  //  Render teclado
  // ══════════════════════════════════════════════
  function renderKeyboard() {
    const rows = document.getElementById('vkb-rows');
    rows.innerHTML = '';
    let layout;
    if (vkbNumMode)       layout = LAYOUT_NUM;
    else if (vkbSymMode)  layout = LAYOUT_SYM;
    else                  layout = LAYOUT_ES;

    layout.forEach(rowKeys => {
      const row = document.createElement('div');
      row.className = 'vkb-row';

      rowKeys.forEach(k => {
        const btn = document.createElement('button');
        btn.className = 'vkb-key ' + (k.cls || '');
        if (k.id) btn.id = k.id;

        let label = k.label || k.l || '';

        // Ícono del tema según estado actual
        if (k.action === 'themeToggle') {
          label = vkbDarkTheme ? '☀️' : '🌙';
        }

        // Aplicar shift/caps solo a teclas que NO son de la fila numérica
        if (!k.action && !k.numRow && (vkbShift || vkbCaps) && k.l) {
          if (k.s && (vkbShift || vkbCaps)) label = k.s;
          else label = k.l.toUpperCase();
        }

        btn.textContent = label;
        if (k.action === 'shift' && (vkbShift || vkbCaps)) btn.classList.add('active');

        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          btn.classList.add('vkb-pressed');
          handleKey(k);
          setTimeout(() => btn.classList.remove('vkb-pressed'), 120);
        });

        row.appendChild(btn);
      });

      rows.appendChild(row);
    });
  }

  // ══════════════════════════════════════════════
  //  Manejar tecla
  // ══════════════════════════════════════════════
  function handleKey(k) {
    if (!vkbTarget) return;

    if (k.action === 'backspace') {
      if (vkbCursorPos > 0) {
        const val = vkbTarget.value;
        vkbTarget.value = val.slice(0, vkbCursorPos - 1) + val.slice(vkbCursorPos);
        vkbCursorPos--;
        triggerInput(vkbTarget);
        // Auto-mayúscula si el campo queda vacío
        if (vkbTarget.value.length === 0 && !vkbCaps) {
          vkbShift = true;
          renderKeyboard();
        }
      }
      updatePreview();
      return;
    }

    if (k.action === 'enter')  { vkbClose(); return; }

    if (k.action === 'space')  { insertChar(' '); return; }

    if (k.action === 'shift') {
      const now = Date.now();
      if (now - vkbLastShiftTap < 350) {
        vkbCaps  = !vkbCaps;
        vkbShift = false;
      } else {
        vkbShift = !vkbShift;
        vkbCaps  = false;
      }
      vkbLastShiftTap = now;
      renderKeyboard();
      return;
    }

    if (k.action === 'numToggle') {
      vkbNumMode = !vkbNumMode;
      vkbSymMode = false;
      renderKeyboard();
      return;
    }

    if (k.action === 'symToggle') {
      vkbSymMode = !vkbSymMode;
      vkbNumMode = false;
      renderKeyboard();
      return;
    }

    if (k.action === 'themeToggle') {
      vkbDarkTheme = !vkbDarkTheme;
      const panel = document.getElementById('vkb-panel');
      panel.classList.toggle('vkb-dark', vkbDarkTheme);
      renderKeyboard();
      return;
    }

    if (k.action === 'accent') {
      vkbPendingAccent = true;
      return;
    }

    // Teclas normales — fila numérica siempre inserta el carácter base
    let char;
    if (k.numRow) {
      char = k.l || '';
    } else {
      if ((vkbShift || vkbCaps) && k.s) char = k.s;
      else char = (vkbShift || vkbCaps) ? (k.l || '').toUpperCase() : (k.l || '');
    }

    // Acento pendiente
    if (vkbPendingAccent) {
      const acentos = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú' };
      char = acentos[char] || char;
      vkbPendingAccent = false;
    }

    insertChar(char);

    if (vkbShift && !vkbCaps) {
      vkbShift = false;
      renderKeyboard();
    }
  }

  // ══════════════════════════════════════════════
  //  Helpers de texto
  // ══════════════════════════════════════════════
  function insertChar(char) {
    if (!vkbTarget) return;
    const val = vkbTarget.value;
    vkbTarget.value = val.slice(0, vkbCursorPos) + char + val.slice(vkbCursorPos);
    vkbCursorPos++;
    triggerInput(vkbTarget);
  }

  function triggerInput(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function updatePreview() { /* preview bar removed — text updates directly in the input */ }

  // ══════════════════════════════════════════════
  //  DRAG & RESIZE + PERSISTENCIA
  // ══════════════════════════════════════════════
  const STORAGE_KEY = 'vkb_layout';

  function saveLayout() {
    const p    = document.getElementById('vkb-panel');
    const rect = p.getBoundingClientRect();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        left: rect.left, top: rect.top,
        width: rect.width, height: rect.height
      }));
    } catch (e) { /* silencioso */ }
  }

  function applyLayout(panel, layout) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const w  = Math.max(340, Math.min(layout.width  || 860, Math.min(vw - 10, 1100)));
    const h  = Math.max(240, Math.min(layout.height || 320, 650));
    const left = Math.max(0, Math.min(layout.left, vw - w));
    const top  = Math.max(0, Math.min(layout.top,  vh - 80));

    panel.style.left      = left + 'px';
    panel.style.top       = top  + 'px';
    panel.style.bottom    = 'auto';
    panel.style.width     = w    + 'px';
    if (layout.height) panel.style.height = h + 'px';
    panel.style.transform  = 'none';
    panel.style.transition = ''; // ← limpiar para que el CSS tome el control
  }

  function loadLayout(panel) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const layout = JSON.parse(raw);
      if (typeof layout.left === 'number') {
        applyLayout(panel, layout);
        return true;
      }
    } catch (e) { /* silencioso */ }
    return false;
  }

  function initDragAndResize() {
    const panel        = document.getElementById('vkb-panel');
    const dragHandle   = document.getElementById('vkb-drag-handle');
    const resizeHandle = document.getElementById('vkb-resize-handle');

    // ── Botón X cerrar — funciona en touch y mouse ──
    const xClose = document.getElementById('vkb-x-close');
    if (xClose) {
      xClose.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        vkbClose();
      });
    }

    // ── DRAG ──
    let dragging = false, dStartX, dStartY, dOrigLeft, dOrigTop;

    function onDragStart(e) {
      dragging = true;
      panel.classList.add('vkb-dragging');
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const rect = panel.getBoundingClientRect();
      panel.style.left       = rect.left + 'px';
      panel.style.top        = rect.top  + 'px';
      panel.style.bottom     = 'auto';
      panel.style.transform  = 'none';
      panel.style.transition = 'none';
      dStartX  = clientX;
      dStartY  = clientY;
      dOrigLeft = rect.left;
      dOrigTop  = rect.top;
      e.preventDefault();
    }

    function onDragMove(e) {
      if (!dragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = clientX - dStartX;
      const dy = clientY - dStartY;
      const vw = window.innerWidth, vh = window.innerHeight;
      const w  = panel.offsetWidth,  h  = panel.offsetHeight;
      panel.style.left = Math.max(0, Math.min(dOrigLeft + dx, vw - w)) + 'px';
      panel.style.top  = Math.max(0, Math.min(dOrigTop  + dy, vh - 60)) + 'px';
    }

    function onDragEnd() {
      if (!dragging) return;
      dragging = false;
      panel.classList.remove('vkb-dragging');
      panel.style.transition = ''; // restaurar transición CSS
      saveLayout();
    }

    dragHandle.addEventListener('mousedown',  onDragStart);
    document.addEventListener('mousemove',    (e) => { if (dragging)  onDragMove(e); });
    document.addEventListener('mouseup',      onDragEnd);
    dragHandle.addEventListener('touchstart', onDragStart, { passive: false });
    document.addEventListener('touchmove',    (e) => { if (dragging)  onDragMove(e); }, { passive: false });
    document.addEventListener('touchend',     onDragEnd);

    // ── RESIZE ──
    let resizing = false, rStartX, rStartY, rOrigW, rOrigH;

    function onResizeStart(e) {
      resizing = true;
      panel.classList.add('vkb-dragging');
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const rect = panel.getBoundingClientRect();
      panel.style.left       = rect.left + 'px';
      panel.style.top        = rect.top  + 'px';
      panel.style.bottom     = 'auto';
      panel.style.transform  = 'none';
      panel.style.transition = 'none';
      rStartX = clientX;
      rStartY = clientY;
      rOrigW  = rect.width;
      rOrigH  = rect.height;
      e.preventDefault();
      e.stopPropagation();
    }

    function onResizeMove(e) {
      if (!resizing) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = clientX - rStartX;
      const dy = clientY - rStartY;
      panel.style.width  = Math.max(340, Math.min(rOrigW + dx, Math.min(window.innerWidth  - 10, 1100))) + 'px';
      panel.style.height = Math.max(240, Math.min(rOrigH + dy, Math.min(window.innerHeight - 20, 650)))  + 'px';
    }

    function onResizeEnd() {
      if (!resizing) return;
      resizing = false;
      panel.classList.remove('vkb-dragging');
      panel.style.transition = ''; // restaurar transición CSS
      saveLayout();
    }

    resizeHandle.addEventListener('mousedown',  onResizeStart);
    document.addEventListener('mousemove',      (e) => { if (resizing) onResizeMove(e); });
    document.addEventListener('mouseup',        onResizeEnd);
    resizeHandle.addEventListener('touchstart', onResizeStart, { passive: false });
    document.addEventListener('touchmove',      (e) => { if (resizing) onResizeMove(e); }, { passive: false });
    document.addEventListener('touchend',       onResizeEnd);
  }

  // ══════════════════════════════════════════════
  //  Cerrar al tocar/hacer click fuera
  //  Estrategia: ocultar el panel momentáneamente,
  //  encontrar el elemento real debajo del toque
  //  con elementFromPoint, y dispararle un click.
  // ══════════════════════════════════════════════
  function initOutsideClick() {
    document.addEventListener('pointerdown', (e) => {
      const panel = document.getElementById('vkb-panel');
      if (!panel || !panel.classList.contains('vkb-open')) return;
      if (panel.contains(e.target)) return;
      if (vkbTarget && vkbTarget.contains(e.target)) return;

      // Obtener coordenadas del toque
      const x = e.clientX, y = e.clientY;

      // Cerrar el teclado primero
      vkbClose();

      // Ocultar el panel temporalmente para que elementFromPoint
      // pueda encontrar el elemento real debajo
      panel.style.display = 'none';
      const realTarget = document.elementFromPoint(x, y);
      panel.style.display = '';

      // Disparar click al elemento real si existe y no es el propio input
      if (realTarget && realTarget !== vkbTarget) {
        // Buscar el elemento clickeable más cercano (el card o su hijo)
        const clickable = realTarget.closest('[onclick], button, a, .prod-card, .pos-cat-card, label') || realTarget;
        try {
          clickable.click();
        } catch(err) { /* silencioso */ }
      }
    }, true);
  }

  // ══════════════════════════════════════════════
  //  Abrir / Cerrar
  // ══════════════════════════════════════════════
  function vkbOpen(inputEl) {
    // Respetar el toggle de teclado virtual
    if (window._vkEnabled === false) return;
    vkbTarget        = inputEl;
    vkbCursorPos     = inputEl.value.length;
    vkbShift         = inputEl.value.length === 0; // mayúscula automática si vacío
    vkbCaps          = false;
    vkbNumMode       = false;
    vkbSymMode       = false;
    vkbPendingAccent = false;

    const label = document.getElementById('vkb-field-label');
    if (inputEl.id === 'pos-buscar') {
      label.textContent  = '🔍 Buscar productos';
      label.style.display = 'block';
    } else if (inputEl.id === 'pos-direccion-cliente') {
      label.textContent  = '📍 Dirección del cliente';
      label.style.display = 'block';
    } else {
      label.style.display = 'none';
    }

    renderKeyboard();
    updatePreview();

    const panel = document.getElementById('vkb-panel');
    const hadLayout = loadLayout(panel);

    if (!hadLayout) {
      // Posición por defecto: centrado, cerca del borde inferior
      panel.style.transform  = '';
      panel.style.left       = '50%';
      panel.style.top        = '';
      panel.style.bottom     = '20px';
      panel.style.width      = '860px';
      panel.style.height     = '';
    }

    // Cancelar cualquier cierre en curso
    if (panel._closeTimer) {
      clearTimeout(panel._closeTimer);
      panel._closeTimer = null;
    }

    panel.classList.add('vkb-open');
  }
  window.vkbClose = function () {
    const panel   = document.getElementById('vkb-panel');
    panel.classList.remove('vkb-open');
    vkbTarget = null;
  };

  // Exponer cursor reset para uso externo (ej: botón limpiar input)
  Object.defineProperty(window, 'vkbCursorPos', {
    get: () => vkbCursorPos,
    set: (v) => { vkbCursorPos = v; },
    configurable: true
  });

  // ══════════════════════════════════════════════
  //  Conectar el teclado a un <input> por su id
  // ══════════════════════════════════════════════
  function attachVkbToInput(inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;

    el.addEventListener('focus', (e) => {
      e.preventDefault();
      el.setAttribute('readonly', 'readonly');
      requestAnimationFrame(() => {
        el.removeAttribute('readonly');
        vkbOpen(el);
      });
    });

    el.addEventListener('touchstart', (e) => {
      const panel = document.getElementById('vkb-panel');
      if (panel.classList.contains('vkb-open') && vkbTarget === el) return;
      e.preventDefault();
      el.setAttribute('readonly', 'readonly');
      requestAnimationFrame(() => {
        el.removeAttribute('readonly');
        vkbOpen(el);
      });
    }, { passive: false });
  }

  // Exponer para uso externo (agregar inputs adicionales desde el HTML)
  window.attachVkbToInput = attachVkbToInput;

  // ══════════════════════════════════════════════
  //  Init
  // ══════════════════════════════════════════════
  function initVkb() {
    // Inyectar HTML si no existe ya
    if (!document.getElementById('vkb-panel')) {
      injectHTML();
    }
    attachVkbToInput('pos-buscar');
    attachVkbToInput('pos-direccion-cliente');
    initDragAndResize();
    initOutsideClick();
  }

  window.initVkb = initVkb;

  // Auto-inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVkb);
  } else {
    initVkb();
  }
  // Segundo intento diferido por si el DOM aún no tuvo tiempo de renderizar
  setTimeout(initVkb, 1500);

})();
