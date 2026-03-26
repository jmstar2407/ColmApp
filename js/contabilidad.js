let balanceChart = null;
let movimientos = [];

async function loadContabilidad() {
    if (!currentNegocio) return;
    
    document.getElementById('negocioNombre').textContent = currentNegocio.nombre;
    
    // Configurar fechas por defecto
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    
    document.getElementById('fechaDesde').value = primerDiaMes.toISOString().split('T')[0];
    document.getElementById('fechaHasta').value = hoy.toISOString().split('T')[0];
    
    await cargarBalance();
}

async function cargarBalance(fechaDesde = null, fechaHasta = null) {
    // Obtener movimientos contables
    let query = getNegocioRef().collection('contabilidad');
    
    if (fechaDesde) {
        query = query.where('fecha', '>=', fechaDesde);
    }
    if (fechaHasta) {
        query = query.where('fecha', '<=', fechaHasta);
    }
    
    const snapshot = await query.orderBy('fecha', 'desc').get();
    movimientos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Calcular totales
    let totalIngresos = 0;
    let totalEgresos = 0;
    
    movimientos.forEach(mov => {
        if (mov.tipo === 'ingreso') {
            totalIngresos += mov.monto;
        } else {
            totalEgresos += mov.monto;
        }
    });
    
    const gananciaNeta = totalIngresos - totalEgresos;
    
    document.getElementById('totalIngresos').textContent = `RD$ ${totalIngresos.toFixed(2)}`;
    document.getElementById('totalEgresos').textContent = `RD$ ${totalEgresos.toFixed(2)}`;
    document.getElementById('gananciaNeta').textContent = `RD$ ${gananciaNeta.toFixed(2)}`;
    
    if (gananciaNeta >= 0) {
        document.getElementById('gananciaNeta').style.color = '#48bb78';
    } else {
        document.getElementById('gananciaNeta').style.color = '#e53e3e';
    }
    
    // Gráfico de balance
    if (balanceChart) balanceChart.destroy();
    balanceChart = new Chart(document.getElementById('balanceChart'), {
        type: 'doughnut',
        data: {
            labels: ['Ingresos', 'Egresos'],
            datasets: [{
                data: [totalIngresos, totalEgresos],
                backgroundColor: ['#48bb78', '#e53e3e']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true
        }
    });
    
    // Mostrar tabla
    mostrarTablaMovimientos(movimientos, totalIngresos, totalEgresos);
}

function mostrarTablaMovimientos(movimientos, totalIngresos, totalEgresos) {
    const tbody = document.querySelector('#movimientosTable tbody');
    tbody.innerHTML = '';
    
    movimientos.forEach(mov => {
        const row = tbody.insertRow();
        row.insertCell(0).textContent = mov.fecha?.toDate().toLocaleString() || '';
        row.insertCell(1).textContent = mov.tipo === 'ingreso' ? 'Ingreso' : 'Egreso';
        row.insertCell(2).textContent = `RD$ ${mov.monto.toFixed(2)}`;
        row.insertCell(3).textContent = mov.concepto;
        
        if (mov.tipo === 'ingreso') {
            row.style.color = '#48bb78';
        } else {
            row.style.color = '#e53e3e';
        }
    });
    
    document.getElementById('totalMovimientos').textContent = `RD$ ${(totalIngresos - totalEgresos).toFixed(2)}`;
}

async function filtrarMovimientos() {
    const desde = document.getElementById('fechaDesde').value;
    const hasta = document.getElementById('fechaHasta').value;
    
    const fechaDesdeObj = desde ? new Date(desde) : null;
    const fechaHastaObj = hasta ? new Date(hasta) : null;
    
    if (fechaHastaObj) {
        fechaHastaObj.setHours(23, 59, 59, 999);
    }
    
    await cargarBalance(fechaDesdeObj, fechaHastaObj);
}

function mostrarModalEgreso() {
    document.getElementById('egresoModal').style.display = 'flex';
}

document.getElementById('egresoForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const monto = parseFloat(document.getElementById('monto').value);
    const concepto = document.getElementById('concepto').value;
    const categoria = document.getElementById('categoria').value;
    
    if (!monto || monto <= 0) {
        alert('Ingrese un monto válido');
        return;
    }
    
    if (!concepto) {
        alert('Ingrese un concepto');
        return;
    }
    
    await registrarEgreso(monto, `${concepto} (${categoria})`);
    
    // También registrar en caja si está abierta
    try {
        await registrarMovimientoCaja('egreso', monto, concepto);
    } catch (error) {
        console.log('Caja no abierta, solo se registró en contabilidad');
    }
    
    closeModal();
    await cargarBalance();
    alert('Egreso registrado exitosamente');
});

function closeModal() {
    document.getElementById('egresoModal').style.display = 'none';
    document.getElementById('egresoForm').reset();
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