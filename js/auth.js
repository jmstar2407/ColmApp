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
            // Obtener negocio del usuario
            const negocioQuery = await db.collection('negocios')
                .where('propietarioUid', '==', user.uid)
                .limit(1)
                .get();
                
            if (!negocioQuery.empty) {
                currentNegocio = {
                    id: negocioQuery.docs[0].id,
                    ...negocioQuery.docs[0].data()
                };
                console.log('Negocio cargado:', currentNegocio.nombre);
                
                // Guardar en sessionStorage para persistencia entre páginas
                sessionStorage.setItem('currentNegocioId', currentNegocio.id);
                sessionStorage.setItem('currentNegocio', JSON.stringify(currentNegocio));
            } else {
                console.error('No se encontró negocio para el usuario');
                currentNegocio = null;
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
        if (window.location.pathname.includes('index.html') || 
            window.location.pathname === '/' ||
            window.location.pathname === '/index.html') {
            if (currentNegocio) {
                window.location.href = 'dashboard.html';
            }
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
    
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        errorDiv.style.display = 'none';
    } catch (error) {
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
    
    try {
        // Crear usuario
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Crear negocio
        const negocioData = {
            nombre: negocioNombre,
            RNC: negocioRNC,
            direccion: negocioDireccion,
            telefono: negocioTelefono,
            propietarioUid: user.uid,
            plan: 'basico',
            creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
            config: {
                itbis: 18,
                itbisAsumeCliente: true,
                ncfSerie: 'B01'
            }
        };
        
        const negocioRef = await db.collection('negocios').add(negocioData);
        
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
        
        alert('Negocio registrado exitosamente');
        hideRegister();
        
        // Iniciar sesión automáticamente
        await auth.signInWithEmailAndPassword(email, password);
        
    } catch (error) {
        alert('Error al registrar: ' + error.message);
    }
});

// Logout
function logout() {
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