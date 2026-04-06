// header-component.js
class HeaderComponent extends HTMLElement {
    constructor() {
        super();
        this.initialized = false;
        this.isMobileMenuOpen = false;
    }

    connectedCallback() {
        this.render();
        this.waitForFirebase();
        this.setupMobileMenu();
    }

    render() {
        this.innerHTML = `
            <div class="header">
                <div class="header-left">
                    <h1>🛒 <span style="color: #1a2135">Colm</span><span style="color: #2e9e44;">app</span> - Sistema de Colmado</h1>
                </div>

                <div class="header-right">
                    <nav class="desktop-nav">
                        <a href="index.html" class="button-link">Facturación</a>
                        <a href="caja.html" class="button-link">Caja</a>
                        <a href="facturas_generadas.html" class="button-link">Facturas Generadas</a>
                        <a href="inventario.html" class="button-link">Inventario</a>
                        <a href="admin.html" class="button-link" id="adminLink" style="display:none;">Admin</a>
                        
                        <div class="user-info" id="userInfo" style="display: none;">
                            <div class="user-name" id="userName"></div>
                            <div class="user-role" id="userRole"></div>
                        </div>
                        
                        <button class="button-link" id="logoutBtn" style="display:none;"><img src="./img/icons/logout_1.png" style="height: 34px;"></button>
                    </nav>
                    
                    <button class="mobile-menu-toggle" id="mobileMenuToggle">
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>
                </div>
                
                <div class="mobile-nav" id="mobileNav">
                    <a href="index.html" class="button-link">Facturación</a>
                    <a href="caja.html" class="button-link">Caja</a>
                    <a href="facturas_generadas.html" class="button-link">Facturas Generadas</a>
                    <a href="inventario.html" class="button-link">Inventario</a>
                    <a href="admin.html" class="button-link" id="mobileAdminLink" style="display:none;">Admin</a>
                    
                    <div class="mobile-user-info" id="mobileUserInfo" style="display: none;">
                        <div class="user-name" id="mobileUserName"></div>
                        <div class="user-role" id="mobileUserRole"></div>
                    </div>
                    
                    <button class="button-link mobile-logout-btn" id="mobileLogoutBtn" style="display:none;">
                        <img src="./img/icons/logout_1.png" style="height: 24px; margin-right: 8px;">
                        Cerrar Sesión
                    </button>
                </div>
            </div>
        `;

        // Marcar botón activo según la página actual
        const currentPage = window.location.pathname.split('/').pop();
        this.querySelectorAll('.button-link').forEach(button => {
            const buttonPage = button.getAttribute('href');
            if (buttonPage && currentPage === buttonPage) {
                button.classList.add('active');
            }
        });

        // Evento logout
        const logoutBtn = this.querySelector('#logoutBtn');
        const mobileLogoutBtn = this.querySelector('#mobileLogoutBtn');
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
        if (mobileLogoutBtn) {
            mobileLogoutBtn.addEventListener('click', () => this.logout());
        }
    }

    setupMobileMenu() {
        const toggleBtn = this.querySelector('#mobileMenuToggle');
        const mobileNav = this.querySelector('#mobileNav');
        
        if (toggleBtn && mobileNav) {
            toggleBtn.addEventListener('click', () => {
                this.isMobileMenuOpen = !this.isMobileMenuOpen;
                this.updateMobileMenu();
            });
            
            // Cerrar menú al hacer clic en un enlace
            mobileNav.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', () => {
                    this.isMobileMenuOpen = false;
                    this.updateMobileMenu();
                });
            });
        }
        
        // Cerrar menú al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (this.isMobileMenuOpen && 
                !e.target.closest('.mobile-nav') && 
                !e.target.closest('.mobile-menu-toggle')) {
                this.isMobileMenuOpen = false;
                this.updateMobileMenu();
            }
        });
    }
    
    updateMobileMenu() {
        const toggleBtn = this.querySelector('#mobileMenuToggle');
        const mobileNav = this.querySelector('#mobileNav');
        
        if (this.isMobileMenuOpen) {
            mobileNav.classList.add('active');
            toggleBtn.classList.add('active');
        } else {
            mobileNav.classList.remove('active');
            toggleBtn.classList.remove('active');
        }
    }

    waitForFirebase() {
        // Verificar si Firebase ya está cargado
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            this.checkAuth();
            return;
        }

        // Si no está cargado, esperar a que se cargue
        const checkInterval = setInterval(() => {
            if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
                clearInterval(checkInterval);
                this.checkAuth();
            }
        }, 100);

        // Timeout por si Firebase nunca se carga
        setTimeout(() => {
            clearInterval(checkInterval);
            if (typeof firebase === 'undefined') {
                console.error('Firebase no se cargó después de 5 segundos');
            }
        }, 5000);
    }

   async checkAuth() {
        if (this.initialized) return;
        
        try {
            const auth = firebase.auth();
            const db = firebase.firestore();

            auth.onAuthStateChanged(async (user) => {
                const adminLink = this.querySelector('#adminLink');
                const mobileAdminLink = this.querySelector('#mobileAdminLink');
                const logoutBtn = this.querySelector('#logoutBtn');
                const mobileLogoutBtn = this.querySelector('#mobileLogoutBtn');
                const userInfo = this.querySelector('#userInfo');
                const mobileUserInfo = this.querySelector('#mobileUserInfo');
                const userName = this.querySelector('#userName');
                const mobileUserName = this.querySelector('#mobileUserName');
                const userRole = this.querySelector('#userRole');
                const mobileUserRole = this.querySelector('#mobileUserRole');

                if (user) {
                    // ✅ Mostrar botones de cerrar sesión
                    if (logoutBtn) logoutBtn.style.removeProperty("display");
                    if (mobileLogoutBtn) mobileLogoutBtn.style.removeProperty("display");
                    
                    // ✅ Obtener información del usuario desde Firestore
                    try {
                        const doc = await db.collection('users').doc(user.uid).get();
                        if (doc.exists) {
                            const userData = doc.data();
                            
                            // Mostrar información del usuario
                            if (userInfo) userInfo.style.removeProperty("display");
                            if (mobileUserInfo) mobileUserInfo.style.removeProperty("display");
                            
                            // Obtener solo el primer nombre
                            const firstName = userData.name ? userData.name.split(' ')[0] : 'Usuario';
                            if (userName) userName.textContent = firstName;
                            if (mobileUserName) mobileUserName.textContent = firstName;
                            
                            // Mostrar el rol con la primera letra en mayúscula
                            const role = userData.role || 'usuario';
                            if (userRole) userRole.textContent = role.charAt(0).toUpperCase() + role.slice(1);
                            if (mobileUserRole) mobileUserRole.textContent = role.charAt(0).toUpperCase() + role.slice(1);
                            
                            // Verificar si es administrador
                            if (userData.role === 'administrador') {
                                if (adminLink) adminLink.style.removeProperty("display");
                                if (mobileAdminLink) mobileAdminLink.style.removeProperty("display");
                            } else {
                                if (adminLink) adminLink.style.display = "none";
                                if (mobileAdminLink) mobileAdminLink.style.display = "none";
                            }
                        }
                    } catch (error) {
                        console.error('Error al obtener datos del usuario:', error);
                    }
                } else {
                    // ❌ No hay usuario: ocultar botones
                    if (adminLink) adminLink.style.display = "none";
                    if (mobileAdminLink) mobileAdminLink.style.display = "none";
                    if (logoutBtn) logoutBtn.style.display = "none";
                    if (mobileLogoutBtn) mobileLogoutBtn.style.display = "none";
                    if (userInfo) userInfo.style.display = "none";
                    if (mobileUserInfo) mobileUserInfo.style.display = "none";

                    // Redirigir al login si no estamos ya en login.html
                    if (!window.location.pathname.endsWith('login.html')) {
                        window.location.href = 'login.html';
                    }
                }
            });
            
            this.initialized = true;
        } catch (error) {
            console.error('Error inicializando Firebase en header:', error);
        }
    }

    logout() {
        if (typeof firebase !== 'undefined') {
            firebase.auth().signOut()
                .then(() => window.location.href = 'login.html')
                .catch((error) => console.error('Error al cerrar sesión:', error));
        } else {
            window.location.href = 'login.html';
        }
    }
}

customElements.define('header-component', HeaderComponent);