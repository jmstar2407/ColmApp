// ============================================================
// estadisticas.js — Estadísticas, gráficos y contabilidad
// ============================================================
import { db, state, fmt } from "./app.js";
import {
  collection, getDocs, query, where, orderBy, limit, Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let chartVentas = null, chartProductos = null, chartMetodos = null;

export function estadisticasHoy() {
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('stats-fecha-ini').value = hoy;
  document.getElementById('stats-fecha-fin').value = hoy;
  calcularEstadisticas();
}

export async function calcularEstadisticas() {
  const fechaIni = document.getElementById('stats-fecha-ini').value;
  const fechaFin = document.getElementById('stats-fecha-fin').value;

  let q;
  if (fechaIni && fechaFin) {
    const ini = Timestamp.fromDate(new Date(fechaIni));
    const fin = Timestamp.fromDate(new Date(fechaFin + 'T23:59:59'));
    q = query(collection(db, 'negocios', state.negocioId, 'facturas'), where('fecha', '>=', ini), where('fecha', '<=', fin), orderBy('fecha', 'asc'));
  } else {
    q = query(collection(db, 'negocios', state.negocioId, 'facturas'), orderBy('fecha', 'desc'), limit(100));
  }

  const snap    = await getDocs(q);
  const facturas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const pagadas  = facturas.filter(f => f.estado === 'pagada');

  const totalVentas = pagadas.reduce((s, f) => s + (f.total || 0), 0);
  const numFacturas = pagadas.length;

  let prodsVendidos = 0;
  const prodConteo  = {};
  pagadas.forEach(f => {
    (f.items || []).forEach(i => {
      prodsVendidos += i.qty || 0;
      prodConteo[i.nombre] = (prodConteo[i.nombre] || 0) + (i.qty || 0);
    });
  });

  document.getElementById('stat-ventas-total').textContent  = fmt(totalVentas);
  document.getElementById('stat-num-facturas').textContent  = numFacturas;
  document.getElementById('stat-prods-vendidos').textContent = prodsVendidos;
  document.getElementById('stat-promedio').textContent = numFacturas ? fmt(totalVentas / numFacturas) : 'RD$ 0';

  renderCharts(pagadas, prodConteo);
  await calcularContabilidad(fechaIni, fechaFin);
}

async function calcularContabilidad(fechaIni, fechaFin) {
  let q;
  if (fechaIni && fechaFin) {
    const ini = Timestamp.fromDate(new Date(fechaIni));
    const fin = Timestamp.fromDate(new Date(fechaFin + 'T23:59:59'));
    q = query(collection(db, 'negocios', state.negocioId, 'movimientos'), where('fecha', '>=', ini), where('fecha', '<=', fin));
  } else {
    q = query(collection(db, 'negocios', state.negocioId, 'movimientos'), limit(500));
  }
  const snap = await getDocs(q);
  const movs = snap.docs.map(d => d.data());
  const ingresos = movs.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + (m.monto || 0), 0);
  const egresos  = movs.filter(m => m.tipo === 'gasto').reduce((s, m) => s + (m.monto || 0), 0);
  document.getElementById('contab-ingresos').textContent = fmt(ingresos);
  document.getElementById('contab-egresos').textContent  = fmt(egresos);
  document.getElementById('contab-ganancia').textContent = fmt(ingresos - egresos);
}

function renderCharts(facturas, prodConteo) {
  // Ventas por día
  const ventasPorDia = {};
  facturas.forEach(f => {
    const fecha = f.fecha?.toDate ? f.fecha.toDate().toLocaleDateString('es-DO') : 'Sin fecha';
    ventasPorDia[fecha] = (ventasPorDia[fecha] || 0) + (f.total || 0);
  });

  if (chartVentas) chartVentas.destroy();
  const ctxV = document.getElementById('chart-ventas');
  if (ctxV) {
    chartVentas = new Chart(ctxV, {
      type: 'bar',
      data: {
        labels:   Object.keys(ventasPorDia),
        datasets: [{ label: 'Ventas', data: Object.values(ventasPorDia), backgroundColor: '#00b341', borderRadius: 6 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  }

  // Top productos
  const topProds = Object.entries(prodConteo).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (chartProductos) chartProductos.destroy();
  const ctxP = document.getElementById('chart-productos');
  if (ctxP) {
    chartProductos = new Chart(ctxP, {
      type: 'bar',
      data: {
        labels:   topProds.map(p => p[0]),
        datasets: [{ label: 'Cantidad', data: topProds.map(p => p[1]), backgroundColor: '#1971c2', borderRadius: 6 }]
      },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
  }

  // Métodos de pago
  const metodos = { efectivo: 0, transferencia: 0, tarjeta: 0 };
  facturas.forEach(f => { if (f.metodoPago in metodos) metodos[f.metodoPago] += f.total || 0; });
  if (chartMetodos) chartMetodos.destroy();
  const ctxM = document.getElementById('chart-metodos');
  if (ctxM) {
    chartMetodos = new Chart(ctxM, {
      type: 'doughnut',
      data: {
        labels:   ['Efectivo', 'Transferencia', 'Tarjeta'],
        datasets: [{ data: [metodos.efectivo, metodos.transferencia, metodos.tarjeta], backgroundColor: ['#00b341', '#1971c2', '#ffd100'] }]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }
}

// Exponer para HTML
window.calcularEstadisticas = calcularEstadisticas;
window.estadisticasHoy      = estadisticasHoy;
