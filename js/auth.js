// ========================================
// miColmApp - Módulo de Autenticación
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // Elementos del DOM
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginError = document.getElementById('loginError');
    const registerError = document.getElementById('registerError');
    const loadingOverlay = document.getElementById('loadingOverlay');

    // Tabs de autenticación
    const authTabs = document.querySelectorAll('.auth-tab');
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchAuthTab(tabName);
        });
    });

    // Función para cambiar tabs
    function switchAuthTab(tabName) {
        authTabs.forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        if (tabName === 'login') {
            loginForm.classList.add('active');
            registerForm.classList.remove('active');
        } else {
            loginForm.classList.remove('active');
            registerForm.classList.add('active');
        }
    }

    // Toggle password visibility
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.parentElement.querySelector('input');
            const icon = btn.querySelector('i');

            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'ri-eye-line';
            } else {
                input.type = 'password';
                icon.className = 'ri-eye-off-line';
            }
        });
    });

    // Manejar formulario de login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading();

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        const result = await authService.login(email, password);

        hideLoading();

        if (result.success) {
            // Guardar en localStorage para persistencia
            localStorage.setItem('colmapp_user', result.user.uid);
            // Redirigir a la aplicación
            window.location.href = 'app.html';
        } else {
            showError(loginError, result.error);
        }
    });

    // Manejar formulario de registro
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading();

        const businessData = {
            nombre: document.getElementById('businessName').value,
            RNC: document.getElementById('businessRNC').value,
            telefono: document.getElementById('businessPhone').value,
            direccion: document.getElementById('businessAddress').value
        };

        const email = document.getElementById('ownerEmail').value;
        const password = document.getElementById('ownerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validaciones
        if (password !== confirmPassword) {
            hideLoading();
            showError(registerError, 'Las contraseñas no coinciden');
            return;
        }

        if (password.length < 6) {
            hideLoading();
            showError(registerError, 'La contraseña debe tener al menos 6 caracteres');
            return;
        }

        const result = await authService.registerBusiness(businessData, email, password);

        hideLoading();

        if (result.success) {
            showToast('success', '¡Éxito!', 'Tu colmado ha sido creado correctamente');
            localStorage.setItem('colmapp_user', result.user.uid);
            // Redirigir a la aplicación
            setTimeout(() => {
                window.location.href = 'app.html';
            }, 1500);
        } else {
            showError(registerError, result.error);
        }
    });

    // Verificar si ya hay sesión activa
    checkExistingSession();

    // Funciones de ayuda
    function showLoading() {
        loadingOverlay.classList.remove('hidden');
    }

    function hideLoading() {
        loadingOverlay.classList.add('hidden');
    }

    function showError(element, message) {
        element.textContent = message;
        element.style.display = 'flex';
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }

    async function checkExistingSession() {
        const userId = localStorage.getItem('colmapp_user');

        if (userId) {
            showLoading();
            // Verificar si el usuario sigue siendo válido
            auth.onAuthStateChanged((user) => {
                hideLoading();
                if (user) {
                    window.location.href = 'app.html';
                } else {
                    localStorage.removeItem('colmapp_user');
                }
            });
        }
    }
});

// Función global para mostrar toasts
function showToast(type, title, message) {
    const container = document.getElementById('toastContainer') || createToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="ri-${type === 'success' ? 'check-line' : type === 'error' ? 'close-line' : type === 'warning' ? 'alert-line' : 'information-line'}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="ri-close-line"></i>
        </button>
    `;

    container.appendChild(toast);

    // Auto-remover después de 5 segundos
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

// Agregar estilos de animación para toast
const toastStyles = document.createElement('style');
toastStyles.textContent = `
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(toastStyles);
