// auth.js - Versión corregida
// Variables globales
let currentUser = null;
let currentNegocio = null;
let authReady = false;
let authListeners = [];

// Función para esperar que la autenticación esté lista
function onAuthReady(callback) {
    if (authReady && currentNegocio) {
        callback(currentNegocio, currentUser);
    } else {
        authListeners.push(callback);
    }
}

// Verificar autenticación
auth.onAuthStateChanged(async (user) => {
    console.log('Auth state changed:', user ? 'User logged in' : 'No user');
    
    if (user) {
        currentUser = user;
        
        try {
            // PRIMERO: Intentar recuperar de sessionStorage
            const storedNegocioId = sessionStorage.getItem('currentNegocioId');
            const storedNegocio = sessionStorage.getItem('currentNegocio');
            
            if (storedNegocioId && storedNegocio) {
                currentNegocio = JSON.parse(storedNegocio);
                console.log('Negocio cargado desde sessionStorage:', currentNegocio.nombre);
                authReady = true;
                
                // Notificar listeners
                authListeners.forEach(listener => {
                    listener(currentNegocio, currentUser);
                });
                
                // Redirigir si es necesario
                if (shouldRedirectToDashboard()) {
                    window.location.href = 'dashboard.html';
                }
                return;
            }
            
            // SEGUNDO: Buscar negocio en Firestore
            console.log('Buscando negocio para usuario:', user.uid);
            
            // Intentar buscar por propietarioUid
            const negocioQuery = await db.collection('negocios')
                .where('propietarioUid', '==', user.uid)
                .limit(1)
                .get();
                
            if (!negocioQuery.empty) {
                currentNegocio = {
                    id: negocioQuery.docs[0].id,
                    ...negocioQuery.docs[0].data()
                };
                console.log('Negocio cargado desde Firestore por UID:', currentNegocio.nombre);
                
                // Guardar en sessionStorage para persistencia
                sessionStorage.setItem('currentNegocioId', currentNegocio.id);
                sessionStorage.setItem('currentNegocio', JSON.stringify(currentNegocio));
            } else {
                // Intentar buscar por email
                console.log('Buscando negocio por email:', user.email);
                const allNegociosQuery = await db.collection('negocios')
                    .where('email', '==', user.email)
                    .limit(1)
                    .get();
                
                if (!allNegociosQuery.empty) {
                    currentNegocio = {
                        id: allNegociosQuery.docs[0].id,
                        ...allNegociosQuery.docs[0].data()
                    };
                    console.log('Negocio encontrado por email:', currentNegocio.nombre);
                    
                    // Actualizar el propietarioUid si es necesario
                    if (!currentNegocio.propietarioUid || currentNegocio.propietarioUid !== user.uid) {
                        await db.collection('negocios').doc(currentNegocio.id).update({
                            propietarioUid: user.uid
                        });
                        console.log('PropietarioUid actualizado');
                    }
                    
                    sessionStorage.setItem('currentNegocioId', currentNegocio.id);
                    sessionStorage.setItem('currentNegocio', JSON.stringify(currentNegocio));
                } else {
                    // Último intento: buscar por cualquier documento que tenga este email en cualquier campo
                    console.log('Buscando negocio con email en cualquier campo...');
                    const negociosSnapshot = await db.collection('negocios').get();
                    let negocioEncontrado = null;
                    
                    negociosSnapshot.docs.forEach(doc => {
                        const data = doc.data();
                        if (data.email === user.email || data.correo === user.email) {
                            negocioEncontrado = { id: doc.id, ...data };
                        }
                    });
                    
                    if (negocioEncontrado) {
                        currentNegocio = negocioEncontrado;
                        console.log('Negocio encontrado en búsqueda general:', currentNegocio.nombre);
                        
                        // Actualizar campos
                        await db.collection('negocios').doc(currentNegocio.id).update({
                            propietarioUid: user.uid,
                            email: user.email
                        });
                        
                        sessionStorage.setItem('currentNegocioId', currentNegocio.id);
                        sessionStorage.setItem('currentNegocio', JSON.stringify(currentNegocio));
                    } else {
                        console.error('No se encontró negocio para el usuario. Creando negocio temporal...');
                        
                        // Crear negocio automáticamente si no existe
                        const nuevoNegocio = {
                            nombre: 'Mi Colmado',
                            RNC: '',
                            direccion: 'Dirección no especificada',
                            telefono: '',
                            propietarioUid: user.uid,
                            email: user.email,
                            plan: 'basico',
                            creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
                            config: {
                                itbis: 18,
                                itbisAsumeCliente: true,
                                ncfSerie: 'B01'
                            }
                        };
                        
                        const negocioRef = await db.collection('negocios').add(nuevoNegocio);
                        currentNegocio = { id: negocioRef.id, ...nuevoNegocio };
                        console.log('Negocio creado automáticamente:', currentNegocio.id);
                        
                        // Crear configuración inicial
                        await db.collection('negocios').doc(negocioRef.id).collection('configuraciones').doc('general').set({
                            itbis: 18,
                            itbisAsumeCliente: true,
                            ncfSerie: 'B01',
                            ultimoNCF: 1
                        });
                        
                        // Crear caja inicial cerrada
                        await db.collection('negocios').doc(negocioRef.id).collection('caja').add({
                            estado: 'cerrada',
                            fechaApertura: null,
                            fechaCierre: firebase.firestore.FieldValue.serverTimestamp(),
                            montoInicial: 0,
                            montoFinal: 0
                        });
                        
                        // Crear cliente por defecto
                        await db.collection('negocios').doc(negocioRef.id).collection('clientes').add({
                            nombre: 'Consumidor Final',
                            rnc: '',
                            tipo: 'consumidor',
                            creadoEn: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        
                        sessionStorage.setItem('currentNegocioId', currentNegocio.id);
                        sessionStorage.setItem('currentNegocio', JSON.stringify(currentNegocio));
                    }
                }
            }
        } catch (error) {
            console.error('Error al cargar negocio:', error);
            currentNegocio = null;
        }
        
        authReady = true;
        
        // Notificar a todos los listeners
        authListeners.forEach(listener => {
            if (currentNegocio) {
                listener(currentNegocio, currentUser);
            }
        });
        
        // Redirigir a dashboard si estamos en login
        if (shouldRedirectToDashboard() && currentNegocio) {
            window.location.href = 'dashboard.html';
        }
    } else {
        currentUser = null;
        currentNegocio = null;
        authReady = true;
        
        // Limpiar sessionStorage
        sessionStorage.removeItem('currentNegocioId');
        sessionStorage.removeItem('currentNegocio');
        
        // Redirigir a login si no estamos ya en login
        if (!window.location.pathname.includes('index.html') && 
            window.location.pathname !== '/' &&
            !window.location.pathname.includes('login')) {
            window.location.href = 'index.html';
        }
    }
});

// Función auxiliar para verificar si debe redirigir al dashboard
function shouldRedirectToDashboard() {
    return window.location.pathname.includes('index.html') || 
           window.location.pathname === '/' ||
           window.location.pathname === '/index.html' ||
           window.location.pathname === '/login.html';
}

// Función para obtener el negocio actual (con reintentos)
async function getCurrentNegocio() {
    if (currentNegocio) return currentNegocio;
    
    // Intentar recuperar de sessionStorage
    const storedNegocio = sessionStorage.getItem('currentNegocio');
    if (storedNegocio) {
        currentNegocio = JSON.parse(storedNegocio);
        return currentNegocio;
    }
    
    // Esperar a que la autenticación esté lista (máximo 10 segundos)
    for (let i = 0; i < 100; i++) {
        if (currentNegocio) return currentNegocio;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error('No se pudo obtener el negocio actual');
}