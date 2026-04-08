import { initAuth } from './auth.js';
import { initPOS } from './modules/pos.js';
import { initCaja } from './modules/caja.js';
import { initFacturas } from './modules/facturas.js';
import { initInventario } from './modules/inventario.js';
import { initEstadisticas } from './modules/estadisticas.js';
import { initConfiguracion } from './modules/configuracion.js';
import { on, initModule } from './utils/helpers.js';

// Inicializar todos los módulos cuando auth esté listo
on('auth:ready', async (e) => {
  const state = e.detail;
  console.log('Auth ready, inicializando módulos...');
  
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

// Navbar dinámico
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const page = document.getElementById(`page-${pageId}`);
  if (page) page.classList.add('active');
  const btn = document.getElementById(`navbtn-${pageId}`);
  if (btn) btn.classList.add('active');
}

window.showPage = showPage;

function updateDateTime() {
  const now = new Date();
  const dateOpts = { timeZone: 'America/Santo_Domingo', weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
  const timeOpts = { timeZone: 'America/Santo_Domingo', hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' };
  const el = document.getElementById('nav-datetime');
  if (el) el.innerHTML = `${now.toLocaleDateString('es-DO', dateOpts)}<br>${now.toLocaleTimeString('es-DO', timeOpts)}`;
}

// Iniciar auth
initAuth();