// Referencias a colecciones del negocio actual con validación
async function getNegocioRef() {
    const negocio = await getCurrentNegocio();
    if (!negocio || !negocio.id) {
        throw new Error('No se ha cargado el negocio actual');
    }
    return db.collection('negocios').doc(negocio.id);
}

// Productos
async function getProductos() {
    try {
        const negocioRef = await getNegocioRef();
        const snapshot = await negocioRef.collection('productos').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error al obtener productos:', error);
        return [];
    }
}

async function crearProducto(producto) {
    try {
        const negocioRef = await getNegocioRef();
        return await negocioRef.collection('productos').add({
            ...producto,
            creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
            stock: producto.stock || 0
        });
    } catch (error) {
        console.error('Error al crear producto:', error);
        throw error;
    }
}

async function actualizarProducto(id, data) {
    try {
        const negocioRef = await getNegocioRef();
        await negocioRef.collection('productos').doc(id).update(data);
    } catch (error) {
        console.error('Error al actualizar producto:', error);
        throw error;
    }
}

async function eliminarProducto(id) {
    try {
        const negocioRef = await getNegocioRef();
        await negocioRef.collection('productos').doc(id).delete();
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        throw error;
    }
}

async function actualizarStock(productoId, cantidad, esVenta = true) {
    try {
        const negocioRef = await getNegocioRef();
        const productoRef = negocioRef.collection('productos').doc(productoId);
        
        if (esVenta) {
            await productoRef.update({
                stock: firebase.firestore.FieldValue.increment(-cantidad)
            });
        } else {
            await productoRef.update({
                stock: firebase.firestore.FieldValue.increment(cantidad)
            });
        }
    } catch (error) {
        console.error('Error al actualizar stock:', error);
        throw error;
    }
}

// Clientes
async function getClientes() {
    try {
        const negocioRef = await getNegocioRef();
        const snapshot = await negocioRef.collection('clientes').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error al obtener clientes:', error);
        return [];
    }
}

async function crearCliente(cliente) {
    try {
        const negocioRef = await getNegocioRef();
        return await negocioRef.collection('clientes').add(cliente);
    } catch (error) {
        console.error('Error al crear cliente:', error);
        throw error;
    }
}

async function actualizarCliente(id, data) {
    try {
        const negocioRef = await getNegocioRef();
        await negocioRef.collection('clientes').doc(id).update(data);
    } catch (error) {
        console.error('Error al actualizar cliente:', error);
        throw error;
    }
}

async function eliminarCliente(id) {
    try {
        const negocioRef = await getNegocioRef();
        await negocioRef.collection('clientes').doc(id).delete();
    } catch (error) {
        console.error('Error al eliminar cliente:', error);
        throw error;
    }
}

// Ventas
async function registrarVenta(venta) {
    try {
        const negocioRef = await getNegocioRef();
        const ncf = await generarNCF();
        
        const ventaData = {
            ...venta,
            fecha: firebase.firestore.FieldValue.serverTimestamp(),
            ncf: ncf
        };
        
        const ventaRef = await negocioRef.collection('ventas').add(ventaData);
        
        // Registrar en contabilidad
        await registrarIngreso(venta.total, ventaRef.id, 'venta');
        
        // Actualizar stock
        for (const item of venta.items) {
            await actualizarStock(item.productoId, item.cantidad, true);
        }
        
        return ventaRef;
    } catch (error) {
        console.error('Error al registrar venta:', error);
        throw error;
    }
}

async function getVentas(fechaInicio = null, fechaFin = null) {
    try {
        const negocioRef = await getNegocioRef();
        let query = negocioRef.collection('ventas');
        
        if (fechaInicio) {
            query = query.where('fecha', '>=', fechaInicio);
        }
        if (fechaFin) {
            query = query.where('fecha', '<=', fechaFin);
        }
        
        const snapshot = await query.orderBy('fecha', 'desc').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error al obtener ventas:', error);
        return [];
    }
}

// Caja
async function abrirCaja(montoInicial) {
    try {
        const negocioRef = await getNegocioRef();
        const cajaData = {
            montoInicial: parseFloat(montoInicial),
            montoFinal: parseFloat(montoInicial),
            fechaApertura: firebase.firestore.FieldValue.serverTimestamp(),
            estado: 'abierta',
            ingresos: 0,
            egresos: 0
        };
        
        return await negocioRef.collection('caja').add(cajaData);
    } catch (error) {
        console.error('Error al abrir caja:', error);
        throw error;
    }
}

async function cerrarCaja(cajaId, montoFinal) {
    try {
        const negocioRef = await getNegocioRef();
        await negocioRef.collection('caja').doc(cajaId).update({
            montoFinal: parseFloat(montoFinal),
            fechaCierre: firebase.firestore.FieldValue.serverTimestamp(),
            estado: 'cerrada'
        });
    } catch (error) {
        console.error('Error al cerrar caja:', error);
        throw error;
    }
}

async function getCajaAbierta() {
    try {
        const negocioRef = await getNegocioRef();
        const snapshot = await negocioRef
            .collection('caja')
            .where('estado', '==', 'abierta')
            .limit(1)
            .get();
        
        if (snapshot.empty) return null;
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    } catch (error) {
        console.error('Error al obtener caja abierta:', error);
        return null;
    }
}

async function registrarMovimientoCaja(tipo, monto, concepto, ventaId = null) {
    try {
        const cajaAbierta = await getCajaAbierta();
        if (!cajaAbierta) throw new Error('No hay caja abierta');
        
        const negocioRef = await getNegocioRef();
        const movimiento = {
            tipo, // 'ingreso' o 'egreso'
            monto: parseFloat(monto),
            concepto,
            fecha: firebase.firestore.FieldValue.serverTimestamp(),
            ventaId
        };
        
        await negocioRef
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
        
        await negocioRef.collection('caja').doc(cajaAbierta.id).update(updateData);
    } catch (error) {
        console.error('Error al registrar movimiento:', error);
        throw error;
    }
}

// Contabilidad
async function registrarIngreso(monto, ventaId, concepto) {
    try {
        const negocioRef = await getNegocioRef();
        await negocioRef.collection('contabilidad').add({
            tipo: 'ingreso',
            monto: parseFloat(monto),
            concepto,
            ventaId,
            fecha: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error al registrar ingreso:', error);
        throw error;
    }
}

async function registrarEgreso(monto, concepto) {
    try {
        const negocioRef = await getNegocioRef();
        await negocioRef.collection('contabilidad').add({
            tipo: 'egreso',
            monto: parseFloat(monto),
            concepto,
            fecha: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error al registrar egreso:', error);
        throw error;
    }
}

async function getBalance() {
    try {
        const negocioRef = await getNegocioRef();
        const snapshot = await negocioRef
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
    } catch (error) {
        console.error('Error al obtener balance:', error);
        return { totalIngresos: 0, totalEgresos: 0, gananciaNeta: 0 };
    }
}

// Configuración
async function getConfiguracion() {
    try {
        const negocioRef = await getNegocioRef();
        const doc = await negocioRef
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
            await negocioRef.collection('configuraciones').doc('general').set(defaultConfig);
            return defaultConfig;
        }
        
        return doc.data();
    } catch (error) {
        console.error('Error al obtener configuración:', error);
        return { itbis: 18, itbisAsumeCliente: true, ncfSerie: 'B01', ultimoNCF: 1 };
    }
}

async function actualizarConfiguracion(data) {
    try {
        const negocioRef = await getNegocioRef();
        await negocioRef.collection('configuraciones').doc('general').update(data);
    } catch (error) {
        console.error('Error al actualizar configuración:', error);
        throw error;
    }
}

// Generar NCF
async function generarNCF() {
    try {
        const config = await getConfiguracion();
        const nuevoNumero = (config.ultimoNCF || 0) + 1;
        const ncf = `${config.ncfSerie}${nuevoNumero.toString().padStart(8, '0')}`;
        
        await actualizarConfiguracion({ ultimoNCF: nuevoNumero });
        return ncf;
    } catch (error) {
        console.error('Error al generar NCF:', error);
        return 'B0100000001';
    }
}