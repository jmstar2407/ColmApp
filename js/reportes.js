let ventasChart = null;
let productosChart = null;

async function loadReportes() {
    if (!currentNegocio) return;
    
    document.getElementById('negocioNombre').textContent = currentNegocio.nombre;
    
    // Configurar fechas por defecto
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    
    document.getElementById('fechaDesde').value = primerDiaMes.toISOString().split('T')[0];
    document.getElementById('fechaHasta').value = hoy.toISOString().split('T')[0];
    
    await cargarEstadisticas();
}

async function cargarEstadisticas(fechaDesde = null, fechaHasta = null) {
    const ventas = await getVentas(fechaDesde, fechaHasta);
    
    // Calcular totales
    const totalVentas = ventas.reduce((sum, v) => sum + v.total, 0);
    const totalSubtotal = ventas.reduce((sum, v) => sum + v.subtotal, 0);
    const totalItbis = ventas.reduce((sum, v) => sum + (v.itbis || 0), 0);
    const ticketPromedio = ventas.length > 0 ? totalVentas / ventas.length : 0;
    
    document.getElementById('ventasHoy').textContent = `RD$ ${totalVentas.toFixed(2)}`;
    document.getElementById('ventasMes').textContent = `RD$ ${totalVentas.toFixed(2)}`;
    document.getElementById('ticketPromedio').textContent = `RD$ ${ticketPromedio.toFixed(2)}`;
    
    // Calcular ganancia neta (precio - costo)
    let gananciaTotal = 0;
    ventas.forEach(venta => {
        venta.items?.forEach(item => {
            // Nota: necesitaríamos el costo del producto en el momento de la venta
            // Por simplicidad, asumimos un margen del 30%
            gananciaTotal += item.subtotal * 0.3;
        });
    });
    document.getElementById('gananciaNeta').textContent = `RD$ ${gananciaTotal.toFixed(2)}`;
    
    // Mostrar tabla de ventas
    mostrarTablaVentas(ventas, totalSubtotal, totalItbis, totalVentas);
    
    // Gráfico de ventas por día
    const ventasPorDia = {};
    ventas.forEach(venta => {
        const fecha = venta.fecha?.toDate().toISOString().split('T')[0];
        if (fecha) {
            ventasPorDia[fecha] = (ventasPorDia[fecha] || 0) + venta.total;
        }
    });
    
    const labels = Object.keys(ventasPorDia).sort();
    const data = labels.map(fecha => ventasPorDia[fecha]);
    
    if (ventasChart) ventasChart.destroy();
    ventasChart = new Chart(document.getElementById('ventasChart'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Ventas (RD$)',
                data: data,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true
        }
    });
    
    // Productos más vendidos
    const productosVendidos = {};
    ventas.forEach(venta => {
        venta.items?.forEach(item => {
            if (!productosVendidos[item.nombre]) {
                productosVendidos[item.nombre] = 0;
            }
            productosVendidos[item.nombre] += item.cantidad;
        });
    });
    
    const topProductos = Object.entries(productosVendidos)
        .sort((a,b) => b[1] - a[1])
        .slice(0, 5);
    
    if (productosChart) productosChart.destroy();
    productosChart = new Chart(document.getElementById('productosChart'), {
        type: 'bar',
        data: {
            labels: topProductos.map(p => p[0]),
            datasets: [{
                label: 'Cantidad Vendida',
                data: topProductos.map(p => p[1]),
                backgroundColor: '#48bb78'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true
        }
    });
}

function mostrarTablaVentas(ventas, totalSubtotal, totalItbis, totalVentas) {
    const tbody = document.querySelector('#ventasTable tbody');
    tbody.innerHTML = '';
    
    ventas.forEach(venta => {
        const row = tbody.insertRow();
        row.insertCell(0).textContent = venta.ncf || 'N/A';
        row.insertCell(1).textContent = venta.fecha?.toDate().toLocaleString() || '';
        row.insertCell(2).textContent = venta.clienteNombre || 'Consumidor Final';
        row.insertCell(3).textContent = `RD$ ${venta.subtotal.toFixed(2)}`;
        row.insertCell(4).textContent = `RD$ ${(venta.itbis || 0).toFixed(2)}`;
        row.insertCell(5).textContent = `RD$ ${venta.total.toFixed(2)}`;
    });
    
    document.getElementById('totalSubtotal').textContent = `RD$ ${totalSubtotal.toFixed(2)}`;
    document.getElementById('totalItbis').textContent = `RD$ ${totalItbis.toFixed(2)}`;
    document.getElementById('totalGeneral').textContent = `RD$ ${totalVentas.toFixed(2)}`;
}

async function filtrarVentas() {
    const desde = document.getElementById('fechaDesde').value;
    const hasta = document.getElementById('fechaHasta').value;
    
    const fechaDesdeObj = desde ? new Date(desde) : null;
    const fechaHastaObj = hasta ? new Date(hasta) : null;
    
    if (fechaHastaObj) {
        fechaHastaObj.setHours(23, 59, 59, 999);
    }
    
    await cargarEstadisticas(fechaDesdeObj, fechaHastaObj);
}

// Esperar autenticación para cargar datos
onAuthReady(() => {
    // Llamar a la función principal de carga
    if (typeof loadPOSData === 'function') loadPOSData();
    if (typeof loadCajaData === 'function') loadCajaData();
    if (typeof loadClientes === 'function') loadClientes();
    if (typeof loadReportes === 'function') loadReportes();
    if (typeof loadContabilidad === 'function') loadContabilidad();
});