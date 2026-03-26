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
            
            const negocioQuery = await db.collection('negocios')
                .where('propietarioUid', '==', user.uid)
                .limit(1)
                .get();
                
            if (!negocioQuery.empty) {
                currentNegocio = {
                    id: negocioQuery.docs[0].id,
                    ...negocioQuery.docs[0].data()
                };
                console.log('Negocio cargado desde Firestore:', currentNegocio.nombre);
                
                // Guardar en sessionStorage para persistencia
                sessionStorage.setItem('currentNegocioId', currentNegocio.id);
                sessionStorage.setItem('currentNegocio', JSON.stringify(currentNegocio));
            } else {
                console.error('No se encontró negocio para el usuario. Verificando si es un usuario nuevo...');
                
                // Verificar si el usuario tiene algún negocio (podría haber error en el campo)
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
                    if (!currentNegocio.propietarioUid) {
                        await db.collection('negocios').doc(currentNegocio.id).update({
                            propietarioUid: user.uid
                        });
                        console.log('PropietarioUid actualizado');
                    }
                    
                    sessionStorage.setItem('currentNegocioId', currentNegocio.id);
                    sessionStorage.setItem('currentNegocio', JSON.stringify(currentNegocio));
                } else {
                    console.error('No hay negocio asociado a este usuario. Redirigiendo a registro...');
                    currentNegocio = null;
                    
                    // Si no hay negocio, mostrar mensaje y redirigir al registro
                    alert('No se encontró un negocio asociado a tu cuenta. Por favor, registra tu negocio.');
                    auth.signOut();
                    window.location.href = 'index.html';
                    return;
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
    
    // Esperar a que la autenticación esté lista (máximo 5 segundos)
    for (let i = 0; i < 50; i++) {
        if (currentNegocio) return currentNegocio;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error('No se pudo obtener el negocio actual');
}

// Login
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('errorMessage');
    
    // Limpiar sessionStorage antes de login
    sessionStorage.removeItem('currentNegocioId');
    sessionStorage.removeItem('currentNegocio');
    
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        console.log('Login exitoso, esperando carga de negocio...');
        errorDiv.style.display = 'none';
    } catch (error) {
        console.error('Error de login:', error);
        errorDiv.textContent = 'Error: ' + error.message;
        errorDiv.style.display = 'block';
    }
});

// Registrar nuevo negocio
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const negocioNombre = document.getElementById('negocioNombre').value;
    const negocioRNC = document.getElementById('negocioRNC').value;
    const negocioDireccion = document.getElementById('negocioDireccion').value;
    const negocioTelefono = document.getElementById('negocioTelefono').value;
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Registrando...';
    submitBtn.disabled = true;
    
    try {
        // Crear usuario
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        console.log('Usuario creado:', user.uid);
        
        // Crear negocio con todos los campos necesarios
        const negocioData = {
            nombre: negocioNombre,
            RNC: negocioRNC || '',
            direccion: negocioDireccion,
            telefono: negocioTelefono || '',
            propietarioUid: user.uid,
            email: email, // Guardar email para búsqueda alternativa
            plan: 'basico',
            creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
            config: {
                itbis: 18,
                itbisAsumeCliente: true,
                ncfSerie: 'B01'
            }
        };
        
        const negocioRef = await db.collection('negocios').add(negocioData);
        console.log('Negocio creado con ID:', negocioRef.id);
        
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
        
        // Crear cliente por defecto "Consumidor Final"
        await db.collection('negocios').doc(negocioRef.id).collection('clientes').add({
            nombre: 'Consumidor Final',
            rnc: '',
            tipo: 'consumidor',
            creadoEn: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert('Negocio registrado exitosamente');
        hideRegister();
        
        // Guardar negocio en sessionStorage antes de iniciar sesión
        const negocioObj = { id: negocioRef.id, ...negocioData };
        sessionStorage.setItem('currentNegocioId', negocioRef.id);
        sessionStorage.setItem('currentNegocio', JSON.stringify(negocioObj));
        
        // Iniciar sesión automáticamente
        await auth.signInWithEmailAndPassword(email, password);
        
    } catch (error) {
        console.error('Error al registrar:', error);
        alert('Error al registrar: ' + error.message);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});

// Logout
function logout() {
    sessionStorage.removeItem('currentNegocioId');
    sessionStorage.removeItem('currentNegocio');
    auth.signOut();
}

// Mostrar/ocultar registro
function showRegister() {
    document.getElementById('registerModal').style.display = 'flex';
}

function hideRegister() {
    document.getElementById('registerModal').style.display = 'none';
}

// Verificar caja abierta
async function verificarCajaAbierta() {
    try {
        const negocio = await getCurrentNegocio();
        if (!negocio) return false;
        
        const cajaSnapshot = await db.collection('negocios')
            .doc(negocio.id)
            .collection('caja')
            .where('estado', '==', 'abierta')
            .limit(1)
            .get();
        
        return !cajaSnapshot.empty;
    } catch (error) {
        console.error('Error al verificar caja:', error);
        return false;
    }
}