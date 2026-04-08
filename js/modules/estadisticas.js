import { db } from '../firebase-config.js';
import { collection, getDocs, query, where, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { AppState, fmt } from '../utils/helpers.js';

let chartVentas = null, chartProductos = null, chartMetodos = null;

export async function initEstadisticas(state) {
  document.getElementById('btn-calcular-stats')?.addEventListener('click', calcularEstadisticas);
  document.getElementById('btn-stats-hoy')?.addEventListener('click', statsHoy);
  
  statsHoy();
}

function statsHoy() {
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('stats-fecha-ini').value = hoy;
  document.getElementById('stats-fecha-fin').value = hoy;
  calcularEstadisticas();
}

async function calcularEstadisticas() {
  const fechaIni = document.getElementById('stats-fecha-ini').value;
  const fechaFin = document.getElementById('stats-fecha-fin').value;
  
  let q;
  if (fechaIni && fechaFin) {
    const ini = Timestamp.fromDate(new Date(fechaIni));
    const fin = Timestamp.fromDate(new Date(fechaFin + 'T23:59:59'));
    q = query(collection(db, 'negocios', AppState.negocioId, 'facturas'), where('fecha', '>=', ini), where('fecha', '<=', fin), where('estado', '==', 'pagada'), orderBy('fecha', 'asc'));
  } else {
    q = query(collection(db, 'negocios', AppState.negocioId, 'facturas'), where('estado', '==', 'pagada'), orderBy('fecha', 'desc'), limit(100));
  }
  
  const snap = await getDocs(q);
  const facturas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  const totalVentas = facturas.reduce((s, f) => s + (f.total || 0), 0);
  const numFacturas = facturas.length;
  let prodsVendidos = 0;
  const prodConteo = {};
  const ventasPorDia = {};
  const metodos = { efectivo: 0, transferencia: 0, tarjeta: 0 };
  
  facturas.forEach(f => {
    prodsVendidos += (f.items || []).reduce((s, i) => s + (i.qty || 0), 0);
    (f.items || []).forEach(i => {
      prodConteo[i.nombre] = (prodConteo[i.nombre] || 0) + (i.qty || 0);
    });
    const fecha = f.fecha?.toDate?.()?.toLocaleDateString('es-DO') || 'Sin fecha';
    ventasPorDia[fecha] = (ventasPorDia[fecha] || 0) + (f.total || 0);
    if (metodos.hasOwnProperty(f.metodoPago)) metodos[f.metodoPago] += f.total || 0;
  });
  
  // Actualizar cards
  const statsHtml = `
    <div class="stat-card verde"><div class="stat-valor">${fmt(totalVentas)}</div><div class="stat-label">Ventas Totales</div></div>
    <div class="stat-card azul"><div class="stat-valor">${numFacturas}</div><div class="stat-label">Facturas</div></div>
    <div class="stat-card amarillo"><div class="stat-valor">${prodsVendidos}</div><div class="stat-label">Productos Vendidos</div></div>
    <div class="stat-card rojo"><div class="stat-valor">${numFacturas ? fmt(totalVentas / numFacturas) : 'RD$ 0'}</div><div class="stat-label">Ticket Promedio</div></div>
  `;
  document.getElementById('stats-cards').innerHTML = statsHtml;
  
  // Contabilidad
  const movQ = query(collection(db, 'negocios', AppState.negocioId, 'movimientos'), orderBy('fecha', 'desc'), limit(500));
  const movSnap = await getDocs(movQ);
  const movs = movSnap.docs.map(d => d.data());
  const ingresos = movs.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + (m.monto || 0), 0);
  const egresos = movs.filter(m => m.tipo === 'gasto').reduce((s, m) => s + (m.monto || 0), 0);
  document.getElementById('contab-grid').innerHTML = `
    <div class="contab-card ingreso"><h4>Ingresos</h4><div class="contab-val">${fmt(ingresos)}</div></div>
    <div class="contab-card egreso"><h4>Egresos</h4><div class="contab-val">${fmt(egresos)}</div></div>
    <div class="contab-card ganancia"><h4>Ganancia Neta</h4><div class="contab-val">${fmt(ingresos - egresos)}</div></div>
  `;
  
  // Gráficos
  renderCharts(ventasPorDia, prodConteo, metodos);
}

function renderCharts(ventasPorDia, prodConteo, metodos) {
  const ctxV = document.getElementById('chart-ventas');
  if (ctxV && chartVentas) chartVentas.destroy();
  if (ctxV) {
    chartVentas = new Chart(ctxV, {
      type: 'bar',
      data: { labels: Object.keys(ventasPorDia), datasets: [{ label: 'Ventas', data: Object.values(ventasPorDia), backgroundColor: '#00b341' }] },
      options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } }
    });
  }
  
  const topProds = Object.entries(prodConteo).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const ctxP = document.getElementById('chart-productos');
  if (ctxP && chartProductos) chartProductos.destroy();
  if (ctxP) {
    chartProductos = new Chart(ctxP, {
      type: 'bar',
      data: { labels: topProds.map(p => p[0]), datasets: [{ label: 'Cantidad', data: topProds.map(p => p[1]), backgroundColor: '#1971c2' }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } }
    });
  }
  
  const ctxM = document.getElementById('chart-metodos');
  if (ctxM && chartMetodos) chartMetodos.destroy();
  if (ctxM) {
    chartMetodos = new Chart(ctxM, {
      type: 'doughnut',
      data: { labels: ['Efectivo', 'Transferencia', 'Tarjeta'], datasets: [{ data: [metodos.efectivo, metodos.transferencia, metodos.tarjeta], backgroundColor: ['#00b341', '#1971c2', '#ffd100'] }] },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }
}