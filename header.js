// ============================================================
// HEADER.JS - Componente de menú reutilizable con caché
// ============================================================

(function () {
  const PAGES = [
    { href: 'facturacion.html', label: 'Facturación', icon: '🧾' },
    { href: 'caja.html',        label: 'Caja',        icon: '💰' },
    { href: 'facturas-generadas.html', label: 'Facturas', icon: '📋' },
    { href: 'inventario.html',  label: 'Inventario',  icon: '📦' },
  ];
  const ADMIN_PAGES = [
    { href: 'configuracion.html', label: 'Configuración', icon: '⚙️' },
  ];

  const HEADER_CACHE_KEY = 'header_cache_v1';

  function currentPage() {
    return window.location.pathname.split('/').pop() || 'index.html';
  }

  function buildNavLinks(allPages) {
    const current = currentPage();
    return allPages.map(p => `
      <a href="${p.href}" class="nav-link ${current === p.href ? 'active' : ''}">
        <span class="nav-icon">${p.icon}</span>
        <span class="nav-label">${p.label}</span>
      </a>
    `).join('');
  }

  function buildHeaderHTML(nombre, isAdmin, userInitial) {
    const allPages = isAdmin ? [...PAGES, ...ADMIN_PAGES] : PAGES;
    const navLinks = buildNavLinks(allPages);
    return `
      <header class="app-header">
        <div class="header-left">
          <div class="brand">
            <span class="brand-icon">🏪</span>
            <div class="brand-info">
              <span class="brand-name">${nombre}</span>
              ${isAdmin ? '<span class="brand-badge">Admin</span>' : '<span class="brand-badge badge-emp">Empleado</span>'}
            </div>
          </div>
        </div>

        <nav class="header-nav" id="header-nav">
          ${navLinks}
        </nav>

        <div class="header-right">
          <div class="clock-widget">
            <span class="clock-time" id="header-clock">--:--:--</span>
            <span class="clock-date" id="header-date">--/--/----</span>
          </div>
          <div class="user-chip">
            <span class="user-avatar">${userInitial}</span>
            <button class="btn-logout" onclick="cerrarSesion()" title="Cerrar sesión">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
          <button class="hamburger" id="hamburger" onclick="toggleMobileNav()">☰</button>
        </div>
      </header>
    `;
  }

  function guardarHeaderCache(nombre, isAdmin, userInitial) {
    try {
      sessionStorage.setItem(HEADER_CACHE_KEY, JSON.stringify({ nombre, isAdmin, userInitial }));
    } catch(e) {}
  }

  function leerHeaderCache() {
    try {
      const raw = sessionStorage.getItem(HEADER_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  }

  function renderHeader() {
    const container = document.getElementById('app-header');
    if (!container) return;

    const negocio = AppState.negocioData;
    const nombre = negocio ? (negocio.nombre || 'Mi Negocio') : '...';
    const isAdmin = AppState.isAdmin;
    const userInitial = (AppState.user?.email || 'U')[0].toUpperCase();

    // Guardar en caché para la próxima página
    guardarHeaderCache(nombre, isAdmin, userInitial);

    container.innerHTML = buildHeaderHTML(nombre, isAdmin, userInitial);
    iniciarReloj();
  }

  // Mostrar header inmediatamente desde caché (antes de que Firebase cargue)
  function renderHeaderDesdeCache() {
    const container = document.getElementById('app-header');
    if (!container) return;
    const cache = leerHeaderCache();
    if (!cache) return;
    container.innerHTML = buildHeaderHTML(cache.nombre, cache.isAdmin, cache.userInitial);
    iniciarReloj();
  }

  function iniciarReloj() {
    // Evitar múltiples intervalos si se llama varias veces
    if (window._headerRelojInterval) clearInterval(window._headerRelojInterval);
    function tick() {
      const now = new Date();
      const opts = { timeZone: 'America/Santo_Domingo' };
      const time = now.toLocaleTimeString('es-DO', { ...opts, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const date = now.toLocaleDateString('es-DO', { ...opts, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
      const cl = document.getElementById('header-clock');
      const cd = document.getElementById('header-date');
      if (cl) cl.textContent = time;
      if (cd) cd.textContent = date;
    }
    tick();
    window._headerRelojInterval = setInterval(tick, 1000);
  }

  // Mostrar menú desde caché INMEDIATAMENTE al cargar el script
  renderHeaderDesdeCache();

  // Exponer función para llamar después de cargar datos de Firebase
  window.initHeader = renderHeader;
  window.toggleMobileNav = function () {
    document.getElementById('header-nav')?.classList.toggle('nav-open');
  };
})();
