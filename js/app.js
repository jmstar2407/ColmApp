import { initAuth } from './auth.js';
import { initPOS } from './modules/pos.js';
import { initCaja } from './modules/caja.js';
import { initFacturas } from './modules/facturas.js';
import { initInventario } from './modules/inventario.js';
import { initEstadisticas } from './modules/estadisticas.js';
import { initConfiguracion } from './modules/configuracion.js';
import { AppState, on, initModule } from './utils/helpers.js';

// Inicializar todos los módulos cuando auth esté listo
on('auth:ready', async (e) => {
  const state = e.detail;
  console.log('Auth ready, inicializando módulos...');
  
  // Construir el menú de navegación
  buildNavbar();
  
  await initModule('POS', () => initPOS(state));
  await initModule('Caja', () => initCaja(state));
  await initModule('Facturas', () => initFacturas(state));
  await initModule('Inventario', () => initInventario(state));
  await initModule('Estadísticas', () => initEstadisticas(state));
  await initModule('Configuración', () => initConfiguracion(state));
  
  // Mostrar página por defecto
  showPage('pos');
  updateDateTime();
  setInterval(updateDateTime, 1000);
});

// ==================== MENÚ DE NAVEGACIÓN ====================
function buildNavbar() {
  const navButtons = document.getElementById('nav-buttons');
  if (!navButtons) return;
  
  // Definir las páginas y qué rol puede verlas
  const pages = [
    { id: 'pos', label: 'Facturación', icon: 'fa-cash-register', roles: ['admin', 'empleado'] },
    { id: 'caja', label: 'Caja', icon: 'fa-box-open', roles: ['admin', 'empleado'] },
    { id: 'facturas', label: 'Facturas', icon: 'fa-file-invoice', roles: ['admin', 'empleado'] },
    { id: 'inventario', label: 'Inventario', icon: 'fa-boxes', roles: ['admin'] },
    { id: 'estadisticas', label: 'Estadísticas', icon: 'fa-chart-line', roles: ['admin'] },
    { id: 'config', label: 'Configuración', icon: 'fa-cog', roles: ['admin'] }
  ];
  
  // Filtrar según el rol del usuario y generar botones
  const userRole = AppState.userRole || 'empleado';
  const buttonsHtml = pages
    .filter(page => page.roles.includes(userRole))
    .map(page => `
      <button class="nav-btn" data-page="${page.id}">
        <i class="fas ${page.icon}"></i> ${page.label}
      </button>
    `).join('');
  
  navButtons.innerHTML = buttonsHtml;
  
  // Agregar event listeners a los botones
  document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const pageId = btn.dataset.page;
      showPage(pageId);
    });
  });
}

// ==================== CAMBIAR DE PÁGINA ====================
function showPage(pageId) {
  // Ocultar todas las páginas
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  
  // Desactivar todos los botones del menú
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Mostrar la página seleccionada
  const activePage = document.getElementById(`page-${pageId}`);
  if (activePage) {
    activePage.classList.add('active');
  }
  
  // Activar el botón correspondiente
  const activeBtn = document.querySelector(`.nav-btn[data-page="${pageId}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }
  
  // Disparar evento de cambio de página para que los módulos puedan reaccionar
  window.dispatchEvent(new CustomEvent('page:changed', { detail: { page: pageId } }));
}

// Exponer globalmente para uso en otros módulos
window.showPage = showPage;

// ==================== RELOJ EN VIVO ====================
function updateDateTime() {
  const now = new Date();
  const dateOpts = { 
    timeZone: 'America/Santo_Domingo', 
    weekday: 'short', 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  };
  const timeOpts = { 
    timeZone: 'America/Santo_Domingo', 
    hour12: true, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  };
  const el = document.getElementById('nav-datetime');
  if (el) {
    el.innerHTML = `${now.toLocaleDateString('es-DO', dateOpts)}<br>${now.toLocaleTimeString('es-DO', timeOpts)}`;
  }
}

// Iniciar autenticación
initAuth();