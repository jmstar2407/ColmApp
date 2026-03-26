// Referencias a colecciones del negocio actual
function getNegocioRef() {
    return db.collection('negocios').doc(currentNegocio.id);
}

// Productos
async function getProductos() {
    const snapshot = await getNegocioRef().collection('productos').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function crearProducto(producto) {
    return await getNegocioRef().collection('productos').add({
        ...producto,
        creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
        stock: producto.stock || 0
    });
}

async function actualizarProducto(id, data) {
    await getNegocioRef().collection('productos').doc(id).update(data);
}

async function eliminarProducto(id) {
    await getNegocioRef().collection('productos').doc(id).delete();
}

async function actualizarStock(productoId, cantidad, esVenta = true) {
    const productoRef = getNegocioRef().collection('productos').doc(productoId);
    
    if (esVenta) {
        await productoRef.update({
            stock: firebase.firestore.FieldValue.increment(-cantidad)
        });
    } else {
        await productoRef.update({
            stock: firebase.firestore.FieldValue.increment(cantidad)
        });
    }
}

// Clientes
async function getClientes() {
    const snapshot = await getNegocioRef().collection('clientes').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function crearCliente(cliente) {
    return await getNegocioRef().collection('clientes').add(cliente);
}

async function actualizarCliente(id, data) {
    await getNegocioRef().collection('clientes').doc(id).update(data);
}

async function eliminarCliente(id) {
    await getNegocioRef().collection('clientes').doc(id).delete();
}

// Ventas
async function registrarVenta(venta) {
    const ventaRef = await getNegocioRef().collection('ventas').add({
        ...venta,
        fecha: firebase.firestore.FieldValue.serverTimestamp(),
        ncf: venta.ncf || await generarNCF()
    });
    
    // Registrar en contabilidad
    await registrarIngreso(venta.total, ventaRef.id, 'venta');
    
    // Actualizar stock
    for (const item of venta.items) {
        await actualizarStock(item.productoId, item.cantidad, true);
    }
    
    return ventaRef;
}

async function getVentas(fechaInicio = null, fechaFin = null) {
    let query = getNegocioRef().collection('ventas');
    
    if (fechaInicio) {
        query = query.where('fecha', '>=', fechaInicio);
    }
    if (fechaFin) {
        query = query.where('fecha', '<=', fechaFin);
    }
    
    const snapshot = await query.orderBy('fecha', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Caja
async function abrirCaja(montoInicial) {
    const cajaData = {
        montoInicial: parseFloat(montoInicial),
        montoFinal: parseFloat(montoInicial),
        fechaApertura: firebase.firestore.FieldValue.serverTimestamp(),
        estado: 'abierta',
        ingresos: 0,
        egresos: 0
    };
    
    await getNegocioRef().collection('caja').add(cajaData);
}

async function cerrarCaja(cajaId, montoFinal) {
    await getNegocioRef().collection('caja').doc(cajaId).update({
        montoFinal: parseFloat(montoFinal),
        fechaCierre: firebase.firestore.FieldValue.serverTimestamp(),
        estado: 'cerrada'
    });
}

async function getCajaAbierta() {
    const snapshot = await getNegocioRef()
        .collection('caja')
        .where('estado', '==', 'abierta')
        .limit(1)
        .get();
    
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

async function registrarMovimientoCaja(tipo, monto, concepto, ventaId = null) {
    const cajaAbierta = await getCajaAbierta();
    if (!cajaAbierta) throw new Error('No hay caja abierta');
    
    const movimiento = {
        tipo, // 'ingreso' o 'egreso'
        monto: parseFloat(monto),
        concepto,
        fecha: firebase.firestore.FieldValue.serverTimestamp(),
        ventaId
    };
    
    await getNegocioRef()
        .collection('caja')
        .doc(cajaAbierta.id)
        .collection('movimientos')
        .add(movimiento);
    
    // Actualizar montos de la caja
    const updateData = {};
    if (tipo === 'ingreso') {
        updateData.montoFinal = firebase.firestore.FieldValue.increment(monto);
        updateData.ingresos = firebase.firestore.FieldValue.increment(monto);
    } else {
        updateData.montoFinal = firebase.firestore.FieldValue.increment(-monto);
        updateData.egresos = firebase.firestore.FieldValue.increment(monto);
    }
    
    await getNegocioRef().collection('caja').doc(cajaAbierta.id).update(updateData);
}

// Contabilidad
async function registrarIngreso(monto, ventaId, concepto) {
    await getNegocioRef().collection('contabilidad').add({
        tipo: 'ingreso',
        monto: parseFloat(monto),
        concepto,
        ventaId,
        fecha: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function registrarEgreso(monto, concepto) {
    await getNegocioRef().collection('contabilidad').add({
        tipo: 'egreso',
        monto: parseFloat(monto),
        concepto,
        fecha: firebase.firestore.FieldValue.serverTimestamp()
    });
}

async function getBalance() {
    const snapshot = await getNegocioRef()
        .collection('contabilidad')
        .orderBy('fecha', 'desc')
        .limit(100)
        .get();
    
    let totalIngresos = 0;
    let totalEgresos = 0;
    
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.tipo === 'ingreso') {
            totalIngresos += data.monto;
        } else {
            totalEgresos += data.monto;
        }
    });
    
    return {
        totalIngresos,
        totalEgresos,
        gananciaNeta: totalIngresos - totalEgresos
    };
}

// Configuración
async function getConfiguracion() {
    const doc = await getNegocioRef()
        .collection('configuraciones')
        .doc('general')
        .get();
    
    if (!doc.exists) {
        const defaultConfig = {
            itbis: 18,
            itbisAsumeCliente: true,
            ncfSerie: 'B01',
            ultimoNCF: 1
        };
        await getNegocioRef().collection('configuraciones').doc('general').set(defaultConfig);
        return defaultConfig;
    }
    
    return doc.data();
}

async function actualizarConfiguracion(data) {
    await getNegocioRef().collection('configuraciones').doc('general').update(data);
}

// Generar NCF
async function generarNCF() {
    const config = await getConfiguracion();
    const nuevoNumero = (config.ultimoNCF || 0) + 1;
    const ncf = `${config.ncfSerie}${nuevoNumero.toString().padStart(8, '0')}`;
    
    await actualizarConfiguracion({ ultimoNCF: nuevoNumero });
    return ncf;
}