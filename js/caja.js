let cajaActual = null;
let movimientos = [];

async function loadCajaData() {
    if (!currentNegocio) return;
    
    document.getElementById('negocioNombre').textContent = currentNegocio.nombre;
    
    // Obtener caja actual
    cajaActual = await getCajaAbierta();
    
    if (cajaActual) {
        document.getElementById('estadoActual').textContent = 'Abierta';
        document.getElementById('estadoActual').style.color = '#48bb78';
        document.getElementById('montoInicial').textContent = `RD$ ${cajaActual.montoInicial.toFixed(2)}`;
        document.getElementById('montoActual').textContent = `RD$ ${cajaActual.montoFinal.toFixed(2)}`;
        document.getElementById('ingresosHoy').textContent = `RD$ ${(cajaActual.ingresos || 0).toFixed(2)}`;
        document.getElementById('egresosHoy').textContent = `RD$ ${(cajaActual.egresos || 0).toFixed(2)}`;
        
        document.getElementById('btnAbrirCaja').style.display = 'none';
        document.getElementById('btnCerrarCaja').style.display = 'inline-block';
        document.getElementById('btnRegistrarGasto').style.display = 'inline-block';
        
        // Cargar movimientos
        await cargarMovimientos();
    } else {
        document.getElementById('estadoActual').textContent = 'Cerrada';
        document.getElementById('estadoActual').style.color = '#e53e3e';
        document.getElementById('btnAbrirCaja').style.display = 'inline-block';
        document.getElementById('btnCerrarCaja').style.display = 'none';
        document.getElementById('btnRegistrarGasto').style.display = 'none';
        
        document.getElementById('montoInicial').textContent = 'RD$ 0';
        document.getElementById('montoActual').textContent = 'RD$ 0';
        document.getElementById('ingresosHoy').textContent = 'RD$ 0';
        document.getElementById('egresosHoy').textContent = 'RD$ 0';
    }
    
    // Cargar historial de cierres
    await cargarHistorialCierres();
}

async function cargarMovimientos() {
    if (!cajaActual) return;
    
    const movimientosSnapshot = await getNegocioRef()
        .collection('caja')
        .doc(cajaActual.id)
        .collection('movimientos')
        .orderBy('fecha', 'desc')
        .get();
    
    movimientos = movimientosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
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
}

async function cargarHistorialCierres() {
    const cierresSnapshot = await getNegocioRef()
        .collection('caja')
        .where('estado', '==', 'cerrada')
        .orderBy('fechaCierre', 'desc')
        .get();
    
    const tbody = document.querySelector('#cierresTable tbody');
    tbody.innerHTML = '';
    
    cierresSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const row = tbody.insertRow();
        row.insertCell(0).textContent = data.fechaApertura?.toDate().toLocaleString() || '';
        row.insertCell(1).textContent = data.fechaCierre?.toDate().toLocaleString() || '';
        row.insertCell(2).textContent = `RD$ ${data.montoInicial.toFixed(2)}`;
        row.insertCell(3).textContent = `RD$ ${data.montoFinal.toFixed(2)}`;
        row.insertCell(4).textContent = `RD$ ${(data.ingresos || 0).toFixed(2)}`;
        row.insertCell(5).textContent = `RD$ ${(data.egresos || 0).toFixed(2)}`;
    });
}

function mostrarModalApertura() {
    document.getElementById('aperturaModal').style.display = 'flex';
}

document.getElementById('aperturaForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const monto = document.getElementById('montoInicialApertura').value;
    
    if (!monto || parseFloat(monto) < 0) {
        alert('Ingrese un monto válido');
        return;
    }
    
    await abrirCaja(parseFloat(monto));
    closeModal('aperturaModal');
    await loadCajaData();
    alert('Caja abierta exitosamente');
});

async function cerrarCajaActual() {
    if (!cajaActual) {
        alert('No hay caja abierta');
        return;
    }
    
    const montoFinal = prompt('Ingrese el monto final en caja:', cajaActual.montoFinal);
    
    if (montoFinal === null) return;
    
    const montoFinalNum = parseFloat(montoFinal);
    
    if (isNaN(montoFinalNum)) {
        alert('Ingrese un monto válido');
        return;
    }
    
    // Verificar que el monto final coincida con los cálculos
    const diferencia = Math.abs(montoFinalNum - cajaActual.montoFinal);
    if (diferencia > 1) { // Margen de 1 peso
        const confirmar = confirm(`El monto final calculado es RD$ ${cajaActual.montoFinal.toFixed(2)}. ¿Desea continuar con RD$ ${montoFinalNum}?`);
        if (!confirmar) return;
    }
    
    await cerrarCaja(cajaActual.id, montoFinalNum);
    await loadCajaData();
    alert('Caja cerrada exitosamente');
}

function mostrarModalGasto() {
    if (!cajaActual) {
        alert('No hay caja abierta');
        return;
    }
    
    document.getElementById('gastoModal').style.display = 'flex';
}

document.getElementById('gastoForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const monto = parseFloat(document.getElementById('gastoMonto').value);
    const concepto = document.getElementById('gastoConcepto').value;
    
    if (!monto || monto <= 0) {
        alert('Ingrese un monto válido');
        return;
    }
    
    if (!concepto) {
        alert('Ingrese un concepto');
        return;
    }
    
    await registrarMovimientoCaja('egreso', monto, concepto);
    await registrarEgreso(monto, concepto);
    
    closeModal('gastoModal');
    await loadCajaData();
    alert('Gasto registrado exitosamente');
});

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    if (modalId === 'gastoModal') {
        document.getElementById('gastoForm').reset();
    }
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