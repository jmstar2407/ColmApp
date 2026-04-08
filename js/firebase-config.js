// ========================================
// miColmApp - Configuración de Firebase
// ========================================

// Configuración de Firebase para miColmApp
const firebaseConfig = {
    apiKey: "AIzaSyB7cX3O8Nkhg5XYsuH1UIn0ZDyxoxLzTB4",
    authDomain: "colmapp-4aaa4.firebaseapp.com",
    projectId: "colmapp-4aaa4",
    storageBucket: "colmapp-4aaa4.firebasestorage.app",
    messagingSenderId: "767529335752",
    appId: "1:767529335752:web:5967b10a0e0da050f91efd",
    measurementId: "G-22YKHGWTMH"
};

// Inicializar Firebase
let app, auth, db, storage;

try {
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    storage = firebase.storage();

    // Habilitar persistencia offline
    db.enablePersistence({ synchronizeTabs: true })
        .catch((err) => {
            if (err.code === 'failed-precondition') {
                console.warn('Persistencia no disponible: múltiples tabs abiertos');
            } else if (err.code === 'unimplemented') {
                console.warn('Persistencia no soportada en este navegador');
            }
        });

    console.log('Firebase inicializado correctamente');
} catch (error) {
    console.error('Error al inicializar Firebase:', error);
}

// Funciones de utilidad para Firestore
const firestoreUtils = {
    // Generar ID único
    generateId: () => db.collection('dummy').doc().id,

    // Convertir timestamp a fecha
    timestampToDate: (timestamp) => {
        if (!timestamp) return null;
        return timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    },

    // Formatear fecha para display
    formatDate: (date) => {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleDateString('es-DO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    },

    // Formatear fecha y hora
    formatDateTime: (date) => {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleDateString('es-DO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Formatear moneda dominicana
    formatCurrency: (amount) => {
        return new Intl.NumberFormat('es-DO', {
            style: 'currency',
            currency: 'DOP'
        }).format(amount || 0);
    }
};

// Servicio de autenticación
const authService = {
    // Registrar nuevo usuario y negocio
    async registerBusiness(businessData, ownerEmail, ownerPassword) {
        try {
            // Crear usuario en Firebase Auth
            const userCredential = await auth.createUserWithEmailAndPassword(
                ownerEmail,
                ownerPassword
            );

            const user = userCredential.user;

            // Crear documento del negocio
            const negocioRef = db.collection('negocios').doc(user.uid);

            await negocioRef.set({
                nombre: businessData.nombre,
                RNC: businessData.RNC,
                direccion: businessData.direccion,
                telefono: businessData.telefono,
                propietarioUid: user.uid,
                email: ownerEmail,
                plan: 'gratuito',
                creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
                config: {
                    itbisPorcentaje: 18,
                    itbisAsumidoPor: 'empresa', // 'empresa' o 'cliente'
                    ncfPrefijo: 'E31',
                    ncfActual: 1
                }
            });

            // Crear categorías iniciales
            const categoriasRef = negocioRef.collection('categorias');
            await categoriasRef.add({
                nombre: 'General',
                imagen: '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Crear documento del empleado admin
            const empleadosRef = negocioRef.collection('empleados');
            await empleadosRef.doc(user.uid).set({
                nombre: 'Administrador',
                email: ownerEmail,
                rol: 'admin',
                activo: true,
                creadoEn: firebase.firestore.FieldValue.serverTimestamp()
            });

            return { success: true, user };
        } catch (error) {
            console.error('Error al registrar:', error);
            return { success: false, error: error.message };
        }
    },

    // Iniciar sesión
    async login(email, password) {
        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            return { success: true, user: userCredential.user };
        } catch (error) {
            console.error('Error al iniciar sesión:', error);
            return { success: false, error: error.message };
        }
    },

    // Cerrar sesión
    async logout() {
        try {
            await auth.signOut();
            return { success: true };
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
            return { success: false, error: error.message };
        }
    },

    // Obtener usuario actual
    getCurrentUser() {
        return auth.currentUser;
    },

    // Escuchar cambios de autenticación
    onAuthStateChange(callback) {
        return auth.onAuthStateChanged(callback);
    }
};

// Servicio de base de datos
const dbService = {
    // Obtener datos del negocio actual
    async getBusinessData(businessId) {
        try {
            const doc = await db.collection('negocios').doc(businessId).get();
            if (doc.exists) {
                return { success: true, data: { id: doc.id, ...doc.data() } };
            }
            return { success: false, error: 'Negocio no encontrado' };
        } catch (error) {
            console.error('Error al obtener datos del negocio:', error);
            return { success: false, error: error.message };
        }
    },

    // Actualizar datos del negocio
    async updateBusinessData(businessId, data) {
        try {
            await db.collection('negocios').doc(businessId).update({
                ...data,
                actualizadoEn: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { success: true };
        } catch (error) {
            console.error('Error al actualizar negocio:', error);
            return { success: false, error: error.message };
        }
    },

    // --- CAJA ---
    async abrirCaja(businessId, montoInicial, userId, userName) {
        try {
            // Verificar si ya hay caja abierta
            const cajaAbierta = await this.getCajaAbierta(businessId);
            if (cajaAbierta.success) {
                return { success: false, error: 'Ya hay una caja abierta' };
            }

            const cajaRef = db.collection('negocios').doc(businessId)
                .collection('caja').doc();

            await cajaRef.set({
                montoInicial,
                montoActual: montoInicial,
                estado: 'abierta',
                fechaApertura: firebase.firestore.FieldValue.serverTimestamp(),
                aperturadoPor: {
                    uid: userId,
                    nombre: userName
                }
            });

            // Registrar en historial
            await this.registrarHistorialCaja(businessId, 'apertura', montoInicial, userId, userName);

            return { success: true, id: cajaRef.id };
        } catch (error) {
            console.error('Error al abrir caja:', error);
            return { success: false, error: error.message };
        }
    },

    async cerrarCaja(businessId, montoFinal, userId, userName) {
        try {
            const caja = await this.getCajaAbierta(businessId);
            if (!caja.success) {
                return { success: false, error: 'No hay caja abierta' };
            }

            await db.collection('negocios').doc(businessId)
                .collection('caja').doc(caja.data.id).update({
                    montoFinal,
                    montoActual: montoFinal,
                    estado: 'cerrada',
                    fechaCierre: firebase.firestore.FieldValue.serverTimestamp(),
                    cerradoPor: {
                        uid: userId,
                        nombre: userName
                    }
                });

            // Registrar en historial
            await this.registrarHistorialCaja(businessId, 'cierre', montoFinal, userId, userName);

            return { success: true };
        } catch (error) {
            console.error('Error al cerrar caja:', error);
            return { success: false, error: error.message };
        }
    },

    async getCajaAbierta(businessId) {
        try {
            const snapshot = await db.collection('negocios').doc(businessId)
                .collection('caja')
                .where('estado', '==', 'abierta')
                .limit(1)
                .get();

            if (snapshot.empty) {
                return { success: false, error: 'No hay caja abierta' };
            }

            const doc = snapshot.docs[0];
            return { success: true, data: { id: doc.id, ...doc.data() } };
        } catch (error) {
            console.error('Error al obtener caja abierta:', error);
            return { success: false, error: error.message };
        }
    },

    async registrarIngresoCaja(businessId, monto, descripcion, userId, userName) {
        try {
            const caja = await this.getCajaAbierta(businessId);
            if (!caja.success) {
                return { success: false, error: 'No hay caja abierta' };
            }

            // Actualizar monto actual
            await db.collection('negocios').doc(businessId)
                .collection('caja').doc(caja.data.id).update({
                    montoActual: firebase.firestore.FieldValue.increment(monto)
                });

            // Registrar en historial
            await this.registrarHistorialCaja(businessId, 'ingreso', monto, userId, userName, descripcion);

            return { success: true };
        } catch (error) {
            console.error('Error al registrar ingreso:', error);
            return { success: false, error: error.message };
        }
    },

    async registrarGastoCaja(businessId, monto, descripcion, userId, userName) {
        try {
            const caja = await this.getCajaAbierta(businessId);
            if (!caja.success) {
                return { success: false, error: 'No hay caja abierta' };
            }

            // Actualizar monto actual
            await db.collection('negocios').doc(businessId)
                .collection('caja').doc(caja.data.id).update({
                    montoActual: firebase.firestore.FieldValue.increment(-monto)
                });

            // Registrar en historial
            await this.registrarHistorialCaja(businessId, 'gasto', monto, userId, userName, descripcion);

            return { success: true };
        } catch (error) {
            console.error('Error al registrar gasto:', error);
            return { success: false, error: error.message };
        }
    },

    async registrarHistorialCaja(businessId, tipo, monto, userId, userName, descripcion = '') {
        try {
            await db.collection('negocios').doc(businessId)
                .collection('historialCaja').add({
                    tipo,
                    monto,
                    descripcion,
                    userId,
                    userName,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            return { success: true };
        } catch (error) {
            console.error('Error al registrar historial:', error);
            return { success: false, error: error.message };
        }
    },

    async getHistorialCaja(businessId, limitNum = 50) {
        try {
            const snapshot = await db.collection('negocios').doc(businessId)
                .collection('historialCaja')
                .orderBy('timestamp', 'desc')
                .limit(limitNum)
                .get();

            const items = [];
            snapshot.forEach(doc => {
                items.push({ id: doc.id, ...doc.data() });
            });

            return { success: true, data: items };
        } catch (error) {
            console.error('Error al obtener historial:', error);
            return { success: false, error: error.message };
        }
    },

    // --- CATEGORÍAS ---
    async getCategorias(businessId) {
        try {
            const snapshot = await db.collection('negocios').doc(businessId)
                .collection('categorias')
                .orderBy('nombre')
                .get();

            const categorias = [];
            snapshot.forEach(doc => {
                categorias.push({ id: doc.id, ...doc.data() });
            });

            return { success: true, data: categorias };
        } catch (error) {
            console.error('Error al obtener categorías:', error);
            return { success: false, error: error.message };
        }
    },

    async crearCategoria(businessId, nombre, imagenUrl = '') {
        try {
            const ref = await db.collection('negocios').doc(businessId)
                .collection('categorias').add({
                    nombre,
                    imagen: imagenUrl,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            return { success: true, id: ref.id };
        } catch (error) {
            console.error('Error al crear categoría:', error);
            return { success: false, error: error.message };
        }
    },

    async eliminarCategoria(businessId, categoriaId) {
        try {
            await db.collection('negocios').doc(businessId)
                .collection('categorias').doc(categoriaId).delete();
            return { success: true };
        } catch (error) {
            console.error('Error al eliminar categoría:', error);
            return { success: false, error: error.message };
        }
    },

    // --- PRODUCTOS (INVENTARIO) ---
    async getProductos(businessId, categoriaId = null) {
        try {
            let query = db.collection('negocios').doc(businessId)
                .collection('productos');

            if (categoriaId) {
                query = query.where('categoriaId', '==', categoriaId);
            }

            const snapshot = await query.orderBy('nombre').get();

            const productos = [];
            snapshot.forEach(doc => {
                productos.push({ id: doc.id, ...doc.data() });
            });

            return { success: true, data: productos };
        } catch (error) {
            console.error('Error al obtener productos:', error);
            return { success: false, error: error.message };
        }
    },

    async getProducto(businessId, productoId) {
        try {
            const doc = await db.collection('negocios').doc(businessId)
                .collection('productos').doc(productoId).get();

            if (doc.exists) {
                return { success: true, data: { id: doc.id, ...doc.data() } };
            }
            return { success: false, error: 'Producto no encontrado' };
        } catch (error) {
            console.error('Error al obtener producto:', error);
            return { success: false, error: error.message };
        }
    },

    async crearProducto(businessId, productoData) {
        try {
            const ref = await db.collection('negocios').doc(businessId)
                .collection('productos').add({
                    ...productoData,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            return { success: true, id: ref.id };
        } catch (error) {
            console.error('Error al crear producto:', error);
            return { success: false, error: error.message };
        }
    },

    async actualizarProducto(businessId, productoId, productoData) {
        try {
            await db.collection('negocios').doc(businessId)
                .collection('productos').doc(productoId).update({
                    ...productoData,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            return { success: true };
        } catch (error) {
            console.error('Error al actualizar producto:', error);
            return { success: false, error: error.message };
        }
    },

    async eliminarProducto(businessId, productoId) {
        try {
            await db.collection('negocios').doc(businessId)
                .collection('productos').doc(productoId).delete();
            return { success: true };
        } catch (error) {
            console.error('Error al eliminar producto:', error);
            return { success: false, error: error.message };
        }
    },

    async actualizarStock(businessId, productoId, cantidad) {
        try {
            await db.collection('negocios').doc(businessId)
                .collection('productos').doc(productoId).update({
                    stock: firebase.firestore.FieldValue.increment(cantidad),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            return { success: true };
        } catch (error) {
            console.error('Error al actualizar stock:', error);
            return { success: false, error: error.message };
        }
    },

    // --- FACTURAS ---
    async crearFactura(businessId, facturaData) {
        try {
            const ref = await db.collection('negocios').doc(businessId)
                .collection('facturas').add({
                    ...facturaData,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            return { success: true, id: ref.id };
        } catch (error) {
            console.error('Error al crear factura:', error);
            return { success: false, error: error.message };
        }
    },

    async getFacturas(businessId, estado = null, limitNum = 100) {
        try {
            let query = db.collection('negocios').doc(businessId)
                .collection('facturas')
                .orderBy('createdAt', 'desc')
                .limit(limitNum);

            if (estado) {
                query = query.where('estado', '==', estado);
            }

            const snapshot = await query.get();

            const facturas = [];
            snapshot.forEach(doc => {
                facturas.push({ id: doc.id, ...doc.data() });
            });

            return { success: true, data: facturas };
        } catch (error) {
            console.error('Error al obtener facturas:', error);
            return { success: false, error: error.message };
        }
    },

    async getFactura(businessId, facturaId) {
        try {
            const doc = await db.collection('negocios').doc(businessId)
                .collection('facturas').doc(facturaId).get();

            if (doc.exists) {
                return { success: true, data: { id: doc.id, ...doc.data() } };
            }
            return { success: false, error: 'Factura no encontrada' };
        } catch (error) {
            console.error('Error al obtener factura:', error);
            return { success: false, error: error.message };
        }
    },

    async actualizarFactura(businessId, facturaId, data) {
        try {
            await db.collection('negocios').doc(businessId)
                .collection('facturas').doc(facturaId).update({
                    ...data,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            return { success: true };
        } catch (error) {
            console.error('Error al actualizar factura:', error);
            return { success: false, error: error.message };
        }
    },

    async marcarFacturaPagada(businessId, facturaId) {
        try {
            await db.collection('negocios').doc(businessId)
                .collection('facturas').doc(facturaId).update({
                    estado: 'pagada',
                    fechaPago: firebase.firestore.FieldValue.serverTimestamp()
                });
            return { success: true };
        } catch (error) {
            console.error('Error al marcar factura:', error);
            return { success: false, error: error.message };
        }
    },

    // --- EMPLEADOS ---
    async getEmpleados(businessId) {
        try {
            const snapshot = await db.collection('negocios').doc(businessId)
                .collection('empleados').get();

            const empleados = [];
            snapshot.forEach(doc => {
                empleados.push({ id: doc.id, ...doc.data() });
            });

            return { success: true, data: empleados };
        } catch (error) {
            console.error('Error al obtener empleados:', error);
            return { success: false, error: error.message };
        }
    },

    async crearEmpleado(businessId, empleadoData) {
        try {
            // Crear usuario en Auth
            const userCredential = await auth.createUserWithEmailAndPassword(
                empleadoData.email,
                empleadoData.passwordTemporal || 'Colmado123'
            );

            const ref = await db.collection('negocios').doc(businessId)
                .collection('empleados').doc(userCredential.user.uid).set({
                    nombre: empleadoData.nombre,
                    email: empleadoData.email,
                    rol: empleadoData.rol || 'empleado',
                    activo: true,
                    creadoEn: firebase.firestore.FieldValue.serverTimestamp()
                });

            return { success: true, id: userCredential.user.uid };
        } catch (error) {
            console.error('Error al crear empleado:', error);
            return { success: false, error: error.message };
        }
    },

    async actualizarEmpleado(businessId, empleadoId, data) {
        try {
            await db.collection('negocios').doc(businessId)
                .collection('empleados').doc(empleadoId).update(data);
            return { success: true };
        } catch (error) {
            console.error('Error al actualizar empleado:', error);
            return { success: false, error: error.message };
        }
    },

    async eliminarEmpleado(businessId, empleadoId) {
        try {
            await db.collection('negocios').doc(businessId)
                .collection('empleados').doc(empleadoId).delete();
            return { success: true };
        } catch (error) {
            console.error('Error al eliminar empleado:', error);
            return { success: false, error: error.message };
        }
    },

    // --- CONFIGURACIÓN ---
    async getConfig(businessId) {
        try {
            const doc = await db.collection('negocios').doc(businessId).get();
            if (doc.exists && doc.data().config) {
                return { success: true, data: doc.data().config };
            }
            return { success: true, data: null };
        } catch (error) {
            console.error('Error al obtener configuración:', error);
            return { success: false, error: error.message };
        }
    },

    async updateConfig(businessId, configData) {
        try {
            await db.collection('negocios').doc(businessId).update({
                config: configData
            });
            return { success: true };
        } catch (error) {
            console.error('Error al actualizar configuración:', error);
            return { success: false, error: error.message };
        }
    },

    // --- ESTADÍSTICAS ---
    async getVentasDelDia(businessId) {
        try {
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);

            const snapshot = await db.collection('negocios').doc(businessId)
                .collection('facturas')
                .where('createdAt', '>=', hoy)
                .where('estado', '==', 'pagada')
                .get();

            let total = 0;
            let cantidad = 0;

            snapshot.forEach(doc => {
                total += doc.data().total || 0;
                cantidad++;
            });

            return { success: true, data: { total, cantidad } };
        } catch (error) {
            console.error('Error al obtener ventas del día:', error);
            return { success: false, error: error.message };
        }
    },

    async getVentasPorRango(businessId, fechaInicio, fechaFin) {
        try {
            const snapshot = await db.collection('negocios').doc(businessId)
                .collection('facturas')
                .where('createdAt', '>=', fechaInicio)
                .where('createdAt', '<=', fechaFin)
                .where('estado', '==', 'pagada')
                .get();

            let total = 0;
            let cantidad = 0;
            const productosVendidos = {};

            snapshot.forEach(doc => {
                const data = doc.data();
                total += data.total || 0;
                cantidad++;

                // Contar productos
                if (data.items) {
                    data.items.forEach(item => {
                        if (productosVendidos[item.productoId]) {
                            productosVendidos[item.productoId].cantidad += item.cantidad;
                            productosVendidos[item.productoId].total += item.subtotal;
                        } else {
                            productosVendidos[item.productoId] = {
                                nombre: item.nombre,
                                cantidad: item.cantidad,
                                total: item.subtotal
                            };
                        }
                    });
                }
            });

            return { success: true, data: { total, cantidad, productosVendidos } };
        } catch (error) {
            console.error('Error al obtener ventas por rango:', error);
            return { success: false, error: error.message };
        }
    },

    // --- SUSCRIPCIONES EN TIEMPO REAL ---
    subscribeToCategorias(businessId, callback) {
        return db.collection('negocios').doc(businessId)
            .collection('categorias')
            .orderBy('nombre')
            .onSnapshot(snapshot => {
                const categorias = [];
                snapshot.forEach(doc => {
                    categorias.push({ id: doc.id, ...doc.data() });
                });
                callback(categorias);
            });
    },

    subscribeToProductos(businessId, callback) {
        return db.collection('negocios').doc(businessId)
            .collection('productos')
            .orderBy('nombre')
            .onSnapshot(snapshot => {
                const productos = [];
                snapshot.forEach(doc => {
                    productos.push({ id: doc.id, ...doc.data() });
                });
                callback(productos);
            });
    },

    subscribeToFacturas(businessId, callback) {
        return db.collection('negocios').doc(businessId)
            .collection('facturas')
            .orderBy('createdAt', 'desc')
            .limit(100)
            .onSnapshot(snapshot => {
                const facturas = [];
                snapshot.forEach(doc => {
                    facturas.push({ id: doc.id, ...doc.data() });
                });
                callback(facturas);
            });
    },

    subscribeToCaja(businessId, callback) {
        return db.collection('negocios').doc(businessId)
            .collection('caja')
            .where('estado', '==', 'abierta')
            .limit(1)
            .onSnapshot(snapshot => {
                if (snapshot.empty) {
                    callback(null);
                } else {
                    const doc = snapshot.docs[0];
                    callback({ id: doc.id, ...doc.data() });
                }
            });
    }
};

// Exportar para uso global
window.firebase = firebase;
window.auth = auth;
window.db = db;
window.storage = storage;
window.authService = authService;
window.dbService = dbService;
window.firestoreUtils = firestoreUtils;
