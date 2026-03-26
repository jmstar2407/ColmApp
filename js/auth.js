// Variables globales
let currentUser = null;
let currentNegocio = null;

// Verificar autenticación
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        
        // Obtener negocio del usuario
        const negocioDoc = await db.collection('negocios')
            .where('propietarioUid', '==', user.uid)
            .limit(1)
            .get();
            
        if (!negocioDoc.empty) {
            currentNegocio = {
                id: negocioDoc.docs[0].id,
                ...negocioDoc.docs[0].data()
            };
            
            // Redirigir a dashboard si estamos en login
            if (window.location.pathname.includes('index.html') || 
                window.location.pathname === '/' ||
                window.location.pathname === '/index.html') {
                window.location.href = 'dashboard.html';
            }
        }
    } else {
        currentUser = null;
        currentNegocio = null;
        
        // Redirigir a login si no estamos ya en login
        if (!window.location.pathname.includes('index.html') && 
            window.location.pathname !== '/' &&
            !window.location.pathname.includes('login')) {
            window.location.href = 'index.html';
        }
    }
});

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
        await db.collection('negocios').doc(negocioRef.id).collection('caja').doc('estado').set({
            estado: 'cerrada',
            ultimoCierre: firebase.firestore.FieldValue.serverTimestamp()
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
    if (!currentNegocio) return false;
    
    const cajaDoc = await db.collection('negocios')
        .doc(currentNegocio.id)
        .collection('caja')
        .where('estado', '==', 'abierta')
        .limit(1)
        .get();
    
    return !cajaDoc.empty;
}