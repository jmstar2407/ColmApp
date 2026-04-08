// ========================================
// miColmApp - Aplicación Principal
// ========================================

// Estado Global de la Aplicación
let currentUser = null;
let currentBusiness = null;
let businessId = null;
let currentRole = 'empleado';
let isAdmin = false;

// Datos
let productos = [];
let categorias = [];
let facturas = [];
let empleados = [];
let cajaData = null;
let configData = null;

// Carrito
let carrito = [];
let paymentMethod = 'efectivo';

// Suscripciones en tiempo real
let unsubscribeCategorias = null;
let unsubscribeProductos = null;
let unsubscribeFacturas = null;
let unsubscribeCaja = null;

// Fecha y Hora
let currentDateTime = new Date();

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    // Verificar autenticación
    const userId = localStorage.getItem('colmapp_user');

    if (!userId) {
        window.location.href = 'index.html';
        return;
    }

    showLoading();

    // Escuchar cambios de autenticación
    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            localStorage.removeItem('colmapp_user');
            window.location.href = 'index.html';
            return;
        }

        currentUser = user;
        businessId = user.uid;

        // Cargar datos del negocio
        await loadBusinessData();

        // Cargar configuración
        await loadConfig();

        // Suscribirse a datos en tiempo real
        subscribeToRealtimeData();

        // Inicializar UI
        initializeUI();

        hideLoading();
    });

    // Actualizar fecha y hora cada segundo
    updateDateTime();
    setInterval(updateDateTime, 1000);
});

// Cargar datos del negocio
async function loadBusinessData() {
    const result = await dbService.getBusinessData(businessId);

    if (result.success) {
        currentBusiness = result.data;
        document.getElementById('businessName').textContent = currentBusiness.nombre || 'Mi Colmado';

        // Obtener rol del usuario
        const empleadosResult = await dbService.getEmpleados(businessId);
        if (empleadosResult.success) {
            const employee = empleadosResult.data.find(e => e.id === currentUser.uid);
            if (employee) {
                currentRole = employee.rol;
                isAdmin = currentRole === 'admin';
                updateUserInfo(employee);
                updateNavForRole();
            }
        }
    } else {
        showToast('error', 'Error', 'No se pudieron cargar los datos del negocio');
    }
}

// Cargar configuración
async function loadConfig() {
    const result = await dbService.getConfig(businessId);
    if (result.success && result.data) {
        configData = result.data;
    } else {
        configData = {
            itbisPorcentaje: 18,
            itbisAsumidoPor: 'empresa',
            ncfPrefijo: 'E31',
            ncfActual: 1
        };
    }
}

// Suscribirse a datos en tiempo real
function subscribeToRealtimeData() {
    // Categorías
    unsubscribeCategorias = dbService.subscribeToCategorias(businessId, (cats) => {
        categorias = cats;
        renderCategorias();
        updateCategorySelects();
    });

    // Productos
    unsubscribeProductos = dbService.subscribeToProductos(businessId, (prods) => {
        productos = prods;
        renderProductos();
    });

    // Facturas
    unsubscribeFacturas = dbService.subscribeToFacturas(businessId, (facts) => {
        facturas = facts;
        renderFacturas();
    });

    // Caja
    unsubscribeCaja = dbService.subscribeToCaja(businessId, (caja) => {
        cajaData = caja;
        updateCajaStatus();
    });
}

// Actualizar información del usuario
function updateUserInfo(employee) {
    const initials = employee.nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('userAvatar').textContent = initials;
    document.getElementById('userName').textContent = employee.nombre;
    document.getElementById('userRole').textContent = currentRole === 'admin' ? 'Administrador' : 'Empleado';
}

// Actualizar navegación según rol
function updateNavForRole() {
    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(el => {
        el.style.display = isAdmin ? 'flex' : 'none';
    });
}

// Inicializar UI
function initializeUI() {
    // Configurar fechas de reportes
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    document.getElementById('reportDateStart').value = firstDay.toISOString().split('T')[0];
    document.getElementById('reportDateEnd').value = today.toISOString().split('T')[0];

    // Cargar empleados para selects
    loadEmployeesForSelect();

    // Event listeners
    setupEventListeners();
}

// Configurar event listeners
function setupEventListeners() {
    // Búsqueda de productos
    document.getElementById('searchProducts').addEventListener('input', (e) => {
        filterProductos(e.target.value);
    });

    // Filtro de categoría
    document.getElementById('categoryFilter').addEventListener('change', (e) => {
        filterByCategory(e.target.value);
    });

    // Búsqueda en inventario
    document.getElementById('searchInventory').addEventListener('input', (e) => {
        filterInventory(e.target.value);
    });

    // Filtro categoría inventario
    document.getElementById('inventoryCategoryFilter').addEventListener('change', (e) => {
        filterInventoryByCategory(e.target.value);
    });

    // Formulario de caja
    document.getElementById('cajaForm').addEventListener('submit', handleCajaSubmit);

    // Formularios de configuración
    document.getElementById('businessForm').addEventListener('submit', handleBusinessSubmit);
    document.getElementById('taxForm').addEventListener('submit', handleTaxSubmit);
    document.getElementById('ncfForm').addEventListener('submit', handleNcfSubmit);

    // Formulario de empleado
    document.getElementById('employeeForm').addEventListener('submit', (e) => {
        e.preventDefault();
        saveEmployee();
    });

    // Barcode input
    document.getElementById('barcodeInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchByBarcode();
        }
    });
}

// Actualizar fecha y hora
function updateDateTime() {
    currentDateTime = new Date();

    // Ajustar a hora de República Dominicana (UTC-4)
    const rdDate = new Date(currentDateTime.toLocaleString('en-US', { timeZone: 'America/Santo_Domingo' }));

    const dateStr = rdDate.toLocaleDateString('es-DO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    const timeStr = rdDate.toLocaleTimeString('es-DO', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    document.getElementById('currentDate').textContent = dateStr;
    document.getElementById('currentTime').textContent = timeStr;
}

// Navegación entre páginas
function showPage(pageName) {
    // Ocultar todas las páginas
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // Mostrar página seleccionada
    const page = document.getElementById(`page-${pageName}`);
    if (page) {
        page.classList.add('active');
    }

    // Actualizar navegación
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.page === pageName) {
            btn.classList.add('active');
        }
    });

    // Acciones específicas por página
    if (pageName === 'caja') {
        loadCajaHistorial();
    } else if (pageName === 'invoices') {
        // Ya se actualiza en tiempo real
    } else if (pageName === 'reports') {
        loadReportData();
    } else if (pageName === 'config') {
        loadConfigData();
    }
}

// Renderizar categorías
function renderCategorias() {
    const navContainer = document.getElementById('categoriesNav');
    const gridContainer = document.getElementById('categoriesGrid');

    if (categorias.length === 0) {
        navContainer.innerHTML = '';
        gridContainer.innerHTML = '<p class="text-center text-muted">No hay categorías. Agrega una en Configuración.</p>';
        return;
    }

    // Renderizar en navegación
    navContainer.innerHTML = categorias.map(cat => `
        <button class="category-chip" onclick="showCategoryProducts('${cat.id}')">
            ${cat.imagen ? `<img src="${cat.imagen}" alt="${cat.nombre}">` : ''}
            <span>${cat.nombre}</span>
        </button>
    `).join('');

    // Renderizar grid de categorías
    gridContainer.innerHTML = categorias.map(cat => `
        <div class="category-card" onclick="showCategoryProducts('${cat.id}')">
            <div class="category-image">
                ${cat.imagen ? `<img src="${cat.imagen}" alt="${cat.nombre}">` : '<i class="ri-folder-3-line"></i>'}
            </div>
            <div class="category-info">
                <h3 class="category-name">${cat.nombre}</h3>
            </div>
        </div>
    `).join('');
}

// Actualizar selects de categorías
function updateCategorySelects() {
    const options = '<option value="">Todas las categorías</option>' +
        categorias.map(cat => `<option value="${cat.id}">${cat.nombre}</option>`).join('');

    document.getElementById('categoryFilter').innerHTML = options;
    document.getElementById('inventoryCategoryFilter').innerHTML = options;
    document.getElementById('productCategory').innerHTML = '<option value="">Seleccionar categoría</option>' +
        categorias.map(cat => `<option value="${cat.id}">${cat.nombre}</option>`).join('');
}

// Mostrar productos de una categoría
let currentCategory = null;

function showCategoryProducts(categoriaId) {
    currentCategory = categoriaId;
    const categoria = categorias.find(c => c.id === categoriaId);

    // Mostrar botón de retroceso
    const backBtn = document.createElement('button');
    backBtn.className = 'back-btn';
    backBtn.innerHTML = '<i class="ri-arrow-left-line"></i> Volver';
    backBtn.onclick = () => {
        currentCategory = null;
        document.getElementById('categoriesNav').innerHTML = '';
        renderCategorias();
        renderProductos();
    };

    document.getElementById('categoriesNav').innerHTML = '';
    document.getElementById('categoriesNav').appendChild(backBtn);

    // Ocultar grid de categorías
    document.getElementById('categoriesGrid').style.display = 'none';

    // Renderizar productos de la categoría
    renderProductos();
}

// Renderizar productos
function renderProductos() {
    const container = document.getElementById('productsGrid');
    let filtered = productos;

    // Filtrar por categoría si está seleccionada
    if (currentCategory) {
        filtered = productos.filter(p => p.categoriaId === currentCategory);
    }

    // Filtrar por búsqueda
    const searchTerm = document.getElementById('searchProducts')?.value?.toLowerCase() || '';
    if (searchTerm) {
        filtered = filtered.filter(p =>
            p.nombre?.toLowerCase().includes(searchTerm) ||
            p.codigoBarras?.toLowerCase().includes(searchTerm)
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-center text-muted">No hay productos disponibles</p>';
        return;
    }

    container.innerHTML = filtered.map(prod => {
        const stockClass = prod.stock <= 0 ? 'out' : prod.stock <= (prod.stockMin || 5) ? 'low' : '';
        const stockText = prod.stock <= 0 ? 'Agotado' : `Stock: ${prod.stock}`;

        return `
            <div class="product-card" onclick="addToCart('${prod.id}')">
                <div class="product-image">
                    ${prod.imagen ? `<img src="${prod.imagen}" alt="${prod.nombre}">` : '<i class="ri-box-3-line"></i>'}
                </div>
                <div class="product-info">
                    <div class="product-name">${prod.nombre}</div>
                    <div class="product-price">${firestoreUtils.formatCurrency(prod.precioVenta)}</div>
                    <div class="product-stock ${stockClass}">${stockText}</div>
                </div>
            </div>
        `;
    }).join('');
}

// Filtrar productos
function filterProductos(searchTerm) {
    renderProductos();
}

// Filtrar por categoría
function filterByCategory(categoriaId) {
    if (categoriaId) {
        showCategoryProducts(categoriaId);
    } else {
        currentCategory = null;
        document.getElementById('categoriesGrid').style.display = 'grid';
        renderCategorias();
        renderProductos();
    }
}

// Agregar al carrito
function addToCart(productId) {
    const producto = productos.find(p => p.id === productId);

    if (!producto) {
        showToast('error', 'Error', 'Producto no encontrado');
        return;
    }

    if (producto.stock <= 0) {
        showToast('warning', 'Sin Stock', 'Este producto está agotado');
        return;
    }

    // Verificar si ya está en el carrito
    const existingItem = carrito.find(item => item.productoId === productId);

    if (existingItem) {
        if (existingItem.cantidad >= producto.stock) {
            showToast('warning', 'Stock Limitado', 'No hay más unidades disponibles');
            return;
        }
        existingItem.cantidad++;
        existingItem.subtotal = existingItem.cantidad * existingItem.precioUnitario;
    } else {
        carrito.push({
            productoId: producto.id,
            nombre: producto.nombre,
            precioUnitario: producto.precioVenta,
            cantidad: 1,
            subtotal: producto.precioVenta,
            imagen: producto.imagen || null,
            stock: producto.stock
        });
    }

    renderCarrito();
    showToast('success', 'Agregado', `${producto.nombre} agregado al carrito`);
}

// Renderizar carrito
function renderCarrito() {
    const itemsContainer = document.getElementById('cartItems');
    const countEl = document.getElementById('cartCount');
    const facturarBtn = document.getElementById('facturarBtn');

    countEl.textContent = carrito.length;

    if (carrito.length === 0) {
        itemsContainer.innerHTML = `
            <div class="cart-empty">
                <i class="ri-shopping-cart-line"></i>
                <p>El carrito está vacío</p>
                <small>Agrega productos para comenzar</small>
            </div>
        `;
        facturarBtn.disabled = true;
        updateCartTotals();
        return;
    }

    facturarBtn.disabled = false;

    itemsContainer.innerHTML = carrito.map((item, index) => `
        <div class="cart-item">
            <div class="cart-item-image">
                ${item.imagen ? `<img src="${item.imagen}" alt="${item.nombre}">` : '<i class="ri-box-3-line"></i>'}
            </div>
            <div class="cart-item-details">
                <div class="cart-item-name">${item.nombre}</div>
                <div class="cart-item-price">${firestoreUtils.formatCurrency(item.precioUnitario)}</div>
            </div>
            <div class="cart-item-quantity">
                <button onclick="decreaseQuantity(${index})">
                    <i class="ri-subtract-line"></i>
                </button>
                <span>${item.cantidad}</span>
                <button onclick="increaseQuantity(${index})" ${item.cantidad >= item.stock ? 'disabled style="opacity:0.5"' : ''}>
                    <i class="ri-add-line"></i>
                </button>
            </div>
            <div class="cart-item-subtotal">${firestoreUtils.formatCurrency(item.subtotal)}</div>
            <button class="cart-item-remove" onclick="removeFromCart(${index})">
                <i class="ri-delete-bin-line"></i>
            </button>
        </div>
    `).join('');

    updateCartTotals();
}

// Actualizar totales del carrito
function updateCartTotals() {
    const subtotal = carrito.reduce((sum, item) => sum + item.subtotal, 0);

    // Calcular ITBIS
    let itbisPorcentaje = configData?.itbisPorcentaje || 18;
    let itbisAsumidoPor = configData?.itbisAsumidoPor || 'empresa';

    let itbis;
    let total;

    if (itbisAsumidoPor === 'cliente') {
        // El ITBIS se agrega al subtotal
        itbis = subtotal * (itbisPorcentaje / 100);
        total = subtotal + itbis;
    } else {
        // El ITBIS está incluido en el precio
        itbis = subtotal - (subtotal / (1 + itbisPorcentaje / 100));
        total = subtotal;
    }

    document.getElementById('cartSubtotal').textContent = firestoreUtils.formatCurrency(subtotal);
    document.getElementById('cartItbis').textContent = firestoreUtils.formatCurrency(itbis);
    document.getElementById('cartTotal').textContent = firestoreUtils.formatCurrency(total);

    return { subtotal, itbis, total };
}

// Modificar cantidad en carrito
function increaseQuantity(index) {
    const item = carrito[index];
    if (item.cantidad < item.stock) {
        item.cantidad++;
        item.subtotal = item.cantidad * item.precioUnitario;
        renderCarrito();
    }
}

function decreaseQuantity(index) {
    const item = carrito[index];
    if (item.cantidad > 1) {
        item.cantidad--;
        item.subtotal = item.cantidad * item.precioUnitario;
        renderCarrito();
    } else {
        removeFromCart(index);
    }
}

function removeFromCart(index) {
    carrito.splice(index, 1);
    renderCarrito();
}

function clearCart() {
    if (carrito.length === 0) return;

    if (confirm('¿Estás seguro de que deseas vaciar el carrito?')) {
        carrito = [];
        renderCarrito();
        showToast('info', 'Limpiado', 'El carrito ha sido vaciado');
    }
}

// Toggle carrito (móvil)
function toggleCart() {
    const panel = document.getElementById('cartPanel');
    const icon = document.getElementById('cartToggleIcon');

    panel.classList.toggle('expanded');
    icon.className = panel.classList.contains('expanded') ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line';
}

// Abrir scanner de código de barras
function openBarcodeScanner() {
    document.getElementById('barcodeInput').value = '';
    document.getElementById('barcodeModal').classList.add('active');
    setTimeout(() => document.getElementById('barcodeInput').focus(), 100);
}

function searchByBarcode() {
    const barcode = document.getElementById('barcodeInput').value.trim();

    if (!barcode) return;

    const producto = productos.find(p => p.codigoBarras === barcode);

    if (producto) {
        closeModal('barcodeModal');
        addToCart(producto.id);
    } else {
        showToast('warning', 'No Encontrado', 'No hay producto con ese código de barras');
    }
}

// Cambiar vista de productos
function setProductView(view) {
    const container = document.getElementById('productsGrid');
    container.className = `products-grid grid-${view}`;

    document.querySelectorAll('.view-toggle button').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === view) {
            btn.classList.add('active');
        }
    });
}

// ======================
// MÓDULO DE CAJA
// ======================

function updateCajaStatus() {
    const statusCard = document.getElementById('cajaStatusCard');
    const statusTitle = document.getElementById('cajaStatusTitle');
    const statusSubtitle = document.getElementById('cajaStatusSubtitle');
    const statusText = document.getElementById('cajaStatusText');
    const statusDot = document.querySelector('.status-dot').parentElement;

    const mainBtn = document.getElementById('cajaMainBtn');
    const btnText = document.getElementById('cajaMainBtnText');
    const ingresoBtn = document.getElementById('ingresoBtn');
    const gastoBtn = document.getElementById('gastoBtn');
    const cierreBtn = document.getElementById('cierreBtn');
    const montoGroup = document.getElementById('montoGroup');

    if (cajaData) {
        // Caja abierta
        statusCard.classList.remove('caja-cerrada');
        statusTitle.textContent = 'Caja Abierta';
        statusSubtitle.textContent = `Monto actual: ${firestoreUtils.formatCurrency(cajaData.montoActual)}`;
        statusText.textContent = 'Caja Abierta';
        statusDot.className = 'business-status caja-abierta';

        btnText.textContent = 'Caja Abierta';
        mainBtn.disabled = true;
        mainBtn.classList.remove('btn-success');
        mainBtn.classList.add('btn-secondary');

        ingresoBtn.disabled = false;
        gastoBtn.disabled = false;
        cierreBtn.style.display = 'inline-flex';

        montoGroup.style.display = 'none';
    } else {
        // Caja cerrada
        statusCard.classList.add('caja-cerrada');
        statusTitle.textContent = 'Caja Cerrada';
        statusSubtitle.textContent = 'Abre la caja para comenzar a vender';
        statusText.textContent = 'Caja Cerrada';
        statusDot.className = 'business-status caja-cerrada';

        btnText.textContent = 'Abrir Caja';
        mainBtn.disabled = false;
        mainBtn.classList.add('btn-success');
        mainBtn.classList.remove('btn-secondary');

        ingresoBtn.disabled = true;
        gastoBtn.disabled = true;
        cierreBtn.style.display = 'none';

        montoGroup.style.display = 'block';
    }
}

async function handleCajaSubmit(e) {
    e.preventDefault();

    if (cajaData) {
        showToast('warning', 'Caja Abierta', 'La caja ya está abierta');
        return;
    }

    const monto = parseFloat(document.getElementById('cajaMonto').value) || 0;

    if (monto < 0) {
        showToast('error', 'Error', 'El monto no puede ser negativo');
        return;
    }

    showLoading();

    const result = await dbService.abrirCaja(
        businessId,
        monto,
        currentUser.uid,
        currentUser.email
    );

    hideLoading();

    if (result.success) {
        showToast('success', 'Caja Abierta', `Caja abierta con ${firestoreUtils.formatCurrency(monto)}`);
        document.getElementById('cajaMonto').value = '';
    } else {
        showToast('error', 'Error', result.error);
    }
}

async function loadCajaHistorial() {
    const container = document.getElementById('cajaHistorial');

    const result = await dbService.getHistorialCaja(businessId, 50);

    if (!result.success || result.data.length === 0) {
        container.innerHTML = '<p class="text-center text-muted">No hay historial de caja</p>';
        return;
    }

    container.innerHTML = result.data.map(item => {
        const tipoIcon = {
            apertura: 'apertura',
            cierre: 'cierre',
            ingreso: 'ingreso',
            gasto: 'gasto'
        }[item.tipo] || 'ingreso';

        const tipoLabel = {
            apertura: 'Apertura de Caja',
            cierre: 'Cierre de Caja',
            ingreso: 'Ingreso',
            gasto: 'Gasto'
        }[item.tipo] || item.tipo;

        const fecha = firestoreUtils.formatDateTime(item.timestamp);

        return `
            <div class="historial-item">
                <div class="historial-icon ${tipoIcon}">
                    <i class="ri-${tipoIcon === 'apertura' ? 'lock-unlock' : tipoIcon === 'cierre' ? 'lock' : tipoIcon === 'ingreso' ? 'add' : 'subtract'}-circle-line"></i>
                </div>
                <div class="historial-details">
                    <div class="historial-title">${tipoLabel} ${item.descripcion ? `- ${item.descripcion}` : ''}</div>
                    <div class="historial-meta">${item.userName} • ${fecha}</div>
                </div>
                <div class="historial-amount ${item.tipo === 'gasto' ? 'text-danger' : ''}">
                    ${item.tipo === 'gasto' ? '-' : '+'}${firestoreUtils.formatCurrency(item.monto)}
                </div>
            </div>
        `;
    }).join('');
}

// Modales de movimiento
let movimientoTipo = 'ingreso';

function openIngresoModal() {
    movimientoTipo = 'ingreso';
    document.getElementById('movimientoTitle').innerHTML = '<i class="ri-add-circle-line"></i> Registrar Ingreso';
    document.getElementById('movimientoMonto').value = '';
    document.getElementById('movimientoDescripcion').value = '';
    document.getElementById('movimientoModal').classList.add('active');
}

function openGastoModal() {
    movimientoTipo = 'gasto';
    document.getElementById('movimientoTitle').innerHTML = '<i class="ri-subtract-circle-line"></i> Registrar Gasto';
    document.getElementById('movimientoMonto').value = '';
    document.getElementById('movimientoDescripcion').value = '';
    document.getElementById('movimientoModal').classList.add('active');
}

async function submitMovimiento() {
    const monto = parseFloat(document.getElementById('movimientoMonto').value);
    const descripcion = document.getElementById('movimientoDescripcion').value;

    if (!monto || monto <= 0) {
        showToast('error', 'Error', 'Ingresa un monto válido');
        return;
    }

    showLoading();

    let result;
    if (movimientoTipo === 'ingreso') {
        result = await dbService.registrarIngresoCaja(businessId, monto, descripcion, currentUser.uid, currentUser.email);
    } else {
        result = await dbService.registrarGastoCaja(businessId, monto, descripcion, currentUser.uid, currentUser.email);
    }

    hideLoading();

    if (result.success) {
        showToast('success', 'Registrado', `${movimientoTipo === 'ingreso' ? 'Ingreso' : 'Gasto'} registrado correctamente`);
        closeModal('movimientoModal');
        loadCajaHistorial();
    } else {
        showToast('error', 'Error', result.error);
    }
}

function openCierreModal() {
    if (!cajaData) return;

    document.getElementById('cierreMontoInicial').textContent = firestoreUtils.formatCurrency(cajaData.montoInicial);
    document.getElementById('cierreVentas').textContent = firestoreUtils.formatCurrency(
        cajaData.montoActual - cajaData.montoInicial
    );
    document.getElementById('cierreMontoFinal').textContent = firestoreUtils.formatCurrency(cajaData.montoActual);
    document.getElementById('cierreMontoInput').value = cajaData.montoActual.toFixed(2);

    document.getElementById('cierreModal').classList.add('active');
}

async function confirmCierreCaja() {
    const montoFinal = parseFloat(document.getElementById('cierreMontoInput').value);

    if (isNaN(montoFinal) || montoFinal < 0) {
        showToast('error', 'Error', 'Ingresa un monto válido');
        return;
    }

    showLoading();

    const result = await dbService.cerrarCaja(businessId, montoFinal, currentUser.uid, currentUser.email);

    hideLoading();

    if (result.success) {
        showToast('success', 'Caja Cerrada', 'El cuadre de caja ha sido registrado');
        closeModal('cierreModal');
        loadCajaHistorial();
    } else {
        showToast('error', 'Error', result.error);
    }
}

// ======================
// MÓDULO DE FACTURAS
// ======================

function renderFacturas() {
    const container = document.getElementById('invoicesGrid');

    if (facturas.length === 0) {
        container.innerHTML = '<p class="text-center text-muted">No hay facturas generadas</p>';
        return;
    }

    container.innerHTML = facturas.map(fact => {
        const estadoClass = fact.estado === 'pagada' ? 'paid' : 'pending';
        const estadoLabel = fact.estado === 'pagada' ? 'Pagada' : 'Pendiente';
        const fecha = firestoreUtils.formatDateTime(fact.createdAt);
        const cantidadItems = fact.items?.length || 0;

        return `
            <div class="invoice-card" onclick="showInvoiceDetail('${fact.id}')">
                <div class="invoice-header">
                    <div class="invoice-number">${fact.ncf || fact.numeroFactura || 'Sin NCF'}</div>
                    <span class="invoice-status ${estadoClass}">${estadoLabel}</span>
                </div>
                <div class="invoice-customer">${fact.metodoPago || 'Método no especificado'}</div>
                <div class="invoice-items-count">${cantidadItems} ${cantidadItems === 1 ? 'producto' : 'productos'}</div>
                <div class="invoice-footer">
                    <span class="invoice-date">${fecha}</span>
                    <span class="invoice-total">${firestoreUtils.formatCurrency(fact.total)}</span>
                </div>
            </div>
        `;
    }).join('');
}

function filterInvoices(status) {
    // Actualizar tabs
    document.querySelectorAll('.invoice-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.status === status) {
            tab.classList.add('active');
        }
    });

    const container = document.getElementById('invoicesGrid');
    let filtered = facturas;

    if (status !== 'all') {
        filtered = facturas.filter(f => f.estado === status);
    }

    if (filtered.length === 0) {
        container.innerHTML = `<p class="text-center text-muted">No hay facturas ${status === 'all' ? '' : status === 'pagada' ? 'pagadas' : 'pendientes'}</p>`;
        return;
    }

    container.innerHTML = filtered.map(fact => {
        const estadoClass = fact.estado === 'pagada' ? 'paid' : 'pending';
        const estadoLabel = fact.estado === 'pagada' ? 'Pagada' : 'Pendiente';
        const fecha = firestoreUtils.formatDateTime(fact.createdAt);
        const cantidadItems = fact.items?.length || 0;

        return `
            <div class="invoice-card" onclick="showInvoiceDetail('${fact.id}')">
                <div class="invoice-header">
                    <div class="invoice-number">${fact.ncf || fact.numeroFactura || 'Sin NCF'}</div>
                    <span class="invoice-status ${estadoClass}">${estadoLabel}</span>
                </div>
                <div class="invoice-customer">${fact.metodoPago || 'Método no especificado'}</div>
                <div class="invoice-items-count">${cantidadItems} ${cantidadItems === 1 ? 'producto' : 'productos'}</div>
                <div class="invoice-footer">
                    <span class="invoice-date">${fecha}</span>
                    <span class="invoice-total">${firestoreUtils.formatCurrency(fact.total)}</span>
                </div>
            </div>
        `;
    }).join('');
}

function showInvoiceDetail(facturaId) {
    const factura = facturas.find(f => f.id === facturaId);

    if (!factura) {
        showToast('error', 'Error', 'Factura no encontrada');
        return;
    }

    // Crear modal de detalle
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop active';
    modal.id = 'invoiceDetailModal';
    modal.innerHTML = `
        <div class="modal" style="max-width: 600px;">
            <div class="modal-header">
                <h3 class="modal-title">
                    <i class="ri-file-text-line"></i>
                    Detalle de Factura
                </h3>
                <button class="modal-close" onclick="closeModal('invoiceDetailModal')">
                    <i class="ri-close-line"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="mb-md">
                    <strong>NCF:</strong> ${factura.ncf || 'N/A'}<br>
                    <strong>Fecha:</strong> ${firestoreUtils.formatDateTime(factura.createdAt)}<br>
                    <strong>Método de Pago:</strong> ${factura.metodoPago || 'N/A'}<br>
                    <strong>Estado:</strong>
                    <span class="invoice-status ${factura.estado === 'pagada' ? 'paid' : 'pending'}">
                        ${factura.estado === 'pagada' ? 'Pagada' : 'Pendiente'}
                    </span>
                </div>

                <table class="inventory-table">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Cantidad</th>
                            <th>Precio</th>
                            <th>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(factura.items || []).map(item => `
                            <tr>
                                <td>${item.nombre}</td>
                                <td>${item.cantidad}</td>
                                <td>${firestoreUtils.formatCurrency(item.precioUnitario)}</td>
                                <td>${firestoreUtils.formatCurrency(item.subtotal)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="invoice-totals mt-md">
                    <div class="cart-row">
                        <span>Subtotal</span>
                        <span>${firestoreUtils.formatCurrency(factura.subtotal)}</span>
                    </div>
                    <div class="cart-row">
                        <span>ITBIS</span>
                        <span>${firestoreUtils.formatCurrency(factura.itbis)}</span>
                    </div>
                    <div class="cart-row total">
                        <span>Total</span>
                        <span>${firestoreUtils.formatCurrency(factura.total)}</span>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                ${factura.estado === 'pendiente' ? `
                    <button class="btn btn-success" onclick="markInvoicePaid('${facturaId}')">
                        <i class="ri-checkbox-circle-line"></i>
                        Marcar como Pagada
                    </button>
                ` : ''}
                <button class="btn btn-secondary" onclick="closeModal('invoiceDetailModal')">
                    Cerrar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

async function markInvoicePaid(facturaId) {
    showLoading();

    const result = await dbService.marcarFacturaPagada(businessId, facturaId);

    hideLoading();

    if (result.success) {
        showToast('success', 'Actualizado', 'Factura marcada como pagada');
        closeModal('invoiceDetailModal');
    } else {
        showToast('error', 'Error', result.error);
    }
}

// ======================
// PROCESAMIENTO DE FACTURA
// ======================

function openInvoiceModal() {
    if (carrito.length === 0) {
        showToast('warning', 'Carrito Vacío', 'Agrega productos antes de facturar');
        return;
    }

    if (!cajaData) {
        showToast('error', 'Caja Cerrada', 'Abre la caja antes de realizar ventas');
        showPage('caja');
        return;
    }

    // Renderizar productos en el modal
    const productsList = document.getElementById('invoiceProductsList');
    productsList.innerHTML = carrito.map(item => `
        <div class="invoice-product-item">
            <div>
                <div class="invoice-product-name">${item.nombre}</div>
                <div class="invoice-product-qty">${item.cantidad} x ${firestoreUtils.formatCurrency(item.precioUnitario)}</div>
            </div>
            <div class="invoice-product-subtotal">${firestoreUtils.formatCurrency(item.subtotal)}</div>
        </div>
    `).join('');

    // Calcular totales
    const totals = updateCartTotals();

    document.getElementById('invoiceSubtotal').textContent = firestoreUtils.formatCurrency(totals.subtotal);
    document.getElementById('invoiceItbis').textContent = firestoreUtils.formatCurrency(totals.itbis);
    document.getElementById('invoiceTotal').textContent = firestoreUtils.formatCurrency(totals.total);

    // Resetear formulario
    document.getElementById('montoRecibido').value = '';
    document.getElementById('changeDisplay').style.display = 'none';
    document.getElementById('invoiceEmpleado').value = currentUser.uid;
    document.getElementById('invoiceStatus').value = 'pagada';

    // Mostrar modal
    document.getElementById('invoiceModal').classList.add('active');
}

function selectPaymentMethod(method) {
    paymentMethod = method;

    document.querySelectorAll('.payment-method-btn').forEach(btn => {
        btn.classList.remove('selected');
        if (btn.dataset.method === method) {
            btn.classList.add('selected');
        }
    });

    // Mostrar/ocultar campos según método
    const montoGroup = document.getElementById('montoRecibidoGroup');
    montoGroup.style.display = method === 'efectivo' ? 'block' : 'none';
}

function appendNumber(num) {
    const input = document.getElementById('montoRecibido');
    input.value += num;
    calculateChange();
}

function clearNumber() {
    document.getElementById('montoRecibido').value = '';
    document.getElementById('changeDisplay').style.display = 'none';
}

function backspaceNumber() {
    const input = document.getElementById('montoRecibido');
    input.value = input.value.slice(0, -1);
    calculateChange();
}

function calculateChange() {
    const totals = updateCartTotals();
    const montoRecibido = parseFloat(document.getElementById('montoRecibido').value) || 0;

    if (montoRecibido >= totals.total) {
        const cambio = montoRecibido - totals.total;
        document.getElementById('changeAmount').textContent = firestoreUtils.formatCurrency(cambio);
        document.getElementById('changeDisplay').style.display = 'block';
    } else {
        document.getElementById('changeDisplay').style.display = 'none';
    }
}

async function processInvoice() {
    const totals = updateCartTotals();
    const montoRecibido = parseFloat(document.getElementById('montoRecibido').value) || 0;
    const empleadoId = document.getElementById('invoiceEmpleado').value;
    const estado = document.getElementById('invoiceStatus').value;

    // Validaciones
    if (!empleadoId) {
        showToast('warning', 'Campo Requerido', 'Selecciona el empleado que procesa');
        return;
    }

    if (paymentMethod === 'efectivo' && montoRecibido < totals.total) {
        showToast('warning', 'Monto Insuficiente', 'El monto recibido es menor al total');
        return;
    }

    // Generar NCF
    const ncf = generarNCF();

    // Crear datos de la factura
    const facturaData = {
        ncf,
        tipoNCF: 'E-CF',
        estado,
        metodoPago: paymentMethod,
        montoRecibido: paymentMethod === 'efectivo' ? montoRecibido : totals.total,
        cambio: paymentMethod === 'efectivo' ? Math.max(0, montoRecibido - totals.total) : 0,
        subtotal: totals.subtotal,
        itbis: totals.itbis,
        total: totals.total,
        items: carrito.map(item => ({
            productoId: item.productoId,
            nombre: item.nombre,
            precioUnitario: item.precioUnitario,
            cantidad: item.cantidad,
            subtotal: item.subtotal
        })),
        empleadoId,
        empleadoNombre: empleados.find(e => e.id === empleadoId)?.nombre || 'N/A',
        clienteNombre: 'Consumidor Final',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    showLoading();

    // Guardar factura
    const result = await dbService.crearFactura(businessId, facturaData);

    if (!result.success) {
        hideLoading();
        showToast('error', 'Error', 'No se pudo guardar la factura');
        return;
    }

    // Si la factura es pagada, actualizar inventario y caja
    if (estado === 'pagada') {
        // Actualizar stock de productos
        for (const item of carrito) {
            await dbService.actualizarStock(businessId, item.productoId, -item.cantidad);
        }

        // Registrar ingreso en caja
        await dbService.registrarIngresoCaja(
            businessId,
            totals.total,
            `Venta ${ncf}`,
            currentUser.uid,
            currentUser.email
        );

        // Incrementar NCF
        configData.ncfActual++;
        await dbService.updateConfig(businessId, configData);
    }

    hideLoading();

    showToast('success', 'Factura Generada', `NCF: ${ncf}`);

    // Limpiar carrito y cerrar modal
    carrito = [];
    renderCarrito();
    closeModal('invoiceModal');

    // Mostrar opción de imprimir
    if (confirm('¿Deseas imprimir la factura?')) {
        printInvoice(result.id);
    }
}

function generarNCF() {
    const prefijo = configData?.ncfPrefijo || 'E31';
    const numero = String(configData?.ncfActual || 1).padStart(8, '0');
    return `${prefijo}${numero}`;
}

function printInvoice(facturaId) {
    const factura = facturas.find(f => f.id === facturaId);

    if (!factura) {
        showToast('error', 'Error', 'Factura no encontrada');
        return;
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Factura ${factura.ncf}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; max-width: 300px; margin: auto; }
                h1 { font-size: 18px; text-align: center; }
                p { margin: 5px 0; font-size: 12px; }
                table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px; }
                th, td { padding: 5px; text-align: left; border-bottom: 1px solid #ddd; }
                .total { font-weight: bold; font-size: 14px; }
                .footer { text-align: center; margin-top: 20px; font-size: 10px; }
            </style>
        </head>
        <body>
            <h1>${currentBusiness?.nombre || 'Mi Colmado'}</h1>
            <p>RNC: ${currentBusiness?.RNC || 'N/A'}</p>
            <p>${currentBusiness?.direccion || ''}</p>
            <p>Tel: ${currentBusiness?.telefono || ''}</p>
            <hr>
            <p><strong>NCF:</strong> ${factura.ncf}</p>
            <p><strong>Fecha:</strong> ${firestoreUtils.formatDateTime(factura.createdAt)}</p>
            <p><strong>Cliente:</strong> ${factura.clienteNombre}</p>
            <hr>
            <table>
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Cant</th>
                        <th>Precio</th>
                    </tr>
                </thead>
                <tbody>
                    ${(factura.items || []).map(item => `
                        <tr>
                            <td>${item.nombre}</td>
                            <td>${item.cantidad}</td>
                            <td>${firestoreUtils.formatCurrency(item.subtotal)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <hr>
            <p>Subtotal: ${firestoreUtils.formatCurrency(factura.subtotal)}</p>
            <p>ITBIS: ${firestoreUtils.formatCurrency(factura.itbis)}</p>
            <p class="total">TOTAL: ${firestoreUtils.formatCurrency(factura.total)}</p>
            <p>Método de Pago: ${factura.metodoPago}</p>
            ${factura.metodoPago === 'efectivo' ? `
                <p>Recibido: ${firestoreUtils.formatCurrency(factura.montoRecibido)}</p>
                <p>Cambio: ${firestoreUtils.formatCurrency(factura.cambio)}</p>
            ` : ''}
            <div class="footer">
                <p>¡Gracias por su compra!</p>
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

// ======================
// MÓDULO DE INVENTARIO
// ======================

function renderInventory() {
    const tbody = document.getElementById('inventoryTableBody');

    if (productos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay productos en el inventario</td></tr>';
        return;
    }

    tbody.innerHTML = productos.map(prod => {
        const categoria = categorias.find(c => c.id === prod.categoriaId);
        const stockClass = prod.stock <= 0 ? 'out-stock' : prod.stock <= (prod.stockMin || 5) ? 'low-stock' : 'in-stock';
        const stockText = prod.stock <= 0 ? 'Agotado' : prod.stock <= (prod.stockMin || 5) ? 'Bajo' : 'Disponible';

        return `
            <tr>
                <td>
                    <div class="product-cell">
                        <div class="product-cell-image">
                            ${prod.imagen ? `<img src="${prod.imagen}" alt="${prod.nombre}">` : '<i class="ri-box-3-line"></i>'}
                        </div>
                        <div class="product-cell-info">
                            <div class="product-cell-name">${prod.nombre}</div>
                        </div>
                    </div>
                </td>
                <td>${categoria?.nombre || 'Sin categoría'}</td>
                <td>${firestoreUtils.formatCurrency(prod.precioVenta)}</td>
                <td>${firestoreUtils.formatCurrency(prod.precioCosto || 0)}</td>
                <td><span class="stock-badge ${stockClass}">${stockText} (${prod.stock})</span></td>
                <td>${prod.codigoBarras || '-'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-ghost btn-icon" onclick="editProduct('${prod.id}')" title="Editar">
                            <i class="ri-edit-line"></i>
                        </button>
                        <button class="btn btn-ghost btn-icon" onclick="deleteProduct('${prod.id}')" title="Eliminar">
                            <i class="ri-delete-bin-line"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function filterInventory(searchTerm) {
    renderInventory();
}

function filterInventoryByCategory(categoriaId) {
    renderInventory();
}

function openProductModal(productId = null) {
    const modal = document.getElementById('productModal');
    const title = document.getElementById('productModalTitle');
    const form = document.getElementById('productForm');

    form.reset();
    document.getElementById('productId').value = '';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('imageUpload').querySelector('i').style.display = 'block';
    document.getElementById('imageUpload').querySelector('span').style.display = 'block';

    if (productId) {
        title.innerHTML = '<i class="ri-edit-line"></i> Editar Producto';
        const producto = productos.find(p => p.id === productId);
        if (producto) {
            document.getElementById('productId').value = producto.id;
            document.getElementById('productName').value = producto.nombre;
            document.getElementById('productPrice').value = producto.precioVenta;
            document.getElementById('productCost').value = producto.precioCosto || '';
            document.getElementById('productStock').value = producto.stock;
            document.getElementById('productStockMin').value = producto.stockMin || 5;
            document.getElementById('productCategory').value = producto.categoriaId || '';
            document.getElementById('productBarcode').value = producto.codigoBarras || '';

            if (producto.imagen) {
                document.getElementById('imagePreviewImg').src = producto.imagen;
                document.getElementById('imagePreview').style.display = 'block';
                document.getElementById('imageUpload').querySelector('i').style.display = 'none';
                document.getElementById('imageUpload').querySelector('span').style.display = 'none';
            }
        }
    } else {
        title.innerHTML = '<i class="ri-add-line"></i> Nuevo Producto';
    }

    modal.classList.add('active');
}

function editProduct(productId) {
    openProductModal(productId);
}

async function saveProduct() {
    const productId = document.getElementById('productId').value;
    const nombre = document.getElementById('productName').value.trim();
    const precioVenta = parseFloat(document.getElementById('productPrice').value);
    const precioCosto = parseFloat(document.getElementById('productCost').value) || 0;
    const stock = parseInt(document.getElementById('productStock').value) || 0;
    const stockMin = parseInt(document.getElementById('productStockMin').value) || 5;
    const categoriaId = document.getElementById('productCategory').value || null;
    const codigoBarras = document.getElementById('productBarcode').value.trim();
    const imagenUrl = document.getElementById('productImageUrl').value;

    if (!nombre) {
        showToast('warning', 'Campo Requerido', 'El nombre del producto es obligatorio');
        return;
    }

    if (!precioVenta || precioVenta <= 0) {
        showToast('warning', 'Campo Requerido', 'El precio de venta debe ser mayor a 0');
        return;
    }

    const productData = {
        nombre,
        precioVenta,
        precioCosto,
        stock,
        stockMin,
        categoriaId,
        codigoBarras,
        imagen: imagenUrl
    };

    showLoading();

    let result;
    if (productId) {
        // Mantener el stock actual si es una edición
        delete productData.stock;
        result = await dbService.actualizarProducto(businessId, productId, productData);
    } else {
        result = await dbService.crearProducto(businessId, productData);
    }

    hideLoading();

    if (result.success) {
        showToast('success', 'Guardado', `Producto ${productId ? 'actualizado' : 'creado'} correctamente`);
        closeModal('productModal');
        renderInventory();
    } else {
        showToast('error', 'Error', result.error);
    }
}

async function deleteProduct(productId) {
    if (!confirm('¿Estás seguro de que deseas eliminar este producto?')) {
        return;
    }

    showLoading();

    const result = await dbService.eliminarProducto(businessId, productId);

    hideLoading();

    if (result.success) {
        showToast('success', 'Eliminado', 'Producto eliminado correctamente');
        renderInventory();
    } else {
        showToast('error', 'Error', result.error);
    }
}

function previewImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();

        reader.onload = function(e) {
            document.getElementById('imagePreviewImg').src = e.target.result;
            document.getElementById('imagePreview').style.display = 'block';
            document.getElementById('imageUpload').querySelector('i').style.display = 'none';
            document.getElementById('imageUpload').querySelector('span').style.display = 'none';

            // Guardar como URL de datos (en producción usar Firebase Storage)
            document.getElementById('productImageUrl').value = e.target.result;
        };

        reader.readAsDataURL(input.files[0]);
    }
}

// ======================
// MÓDULO DE CATEGORÍAS
// ======================

function openCategoryModal() {
    renderCategoriesList();
    document.getElementById('categoryModal').classList.add('active');
}

function renderCategoriesList() {
    const container = document.getElementById('categoriesList');

    if (categorias.length === 0) {
        container.innerHTML = '<p class="text-center text-muted">No hay categorías</p>';
        return;
    }

    container.innerHTML = categorias.map(cat => `
        <div class="employee-item">
            <div class="product-cell-image" style="width: 44px; height: 44px; border-radius: 50%;">
                ${cat.imagen ? `<img src="${cat.imagen}" alt="${cat.nombre}">` : '<i class="ri-folder-3-line"></i>'}
            </div>
            <div class="employee-info">
                <div class="employee-name">${cat.nombre}</div>
            </div>
            <button class="btn btn-ghost btn-icon" onclick="deleteCategory('${cat.id}')" title="Eliminar">
                <i class="ri-delete-bin-line"></i>
            </button>
        </div>
    `).join('');
}

async function addCategory() {
    const nombre = document.getElementById('newCategoryName').value.trim();

    if (!nombre) {
        showToast('warning', 'Campo Requerido', 'Ingresa el nombre de la categoría');
        return;
    }

    showLoading();

    const result = await dbService.crearCategoria(businessId, nombre);

    hideLoading();

    if (result.success) {
        showToast('success', 'Creada', 'Categoría creada correctamente');
        document.getElementById('newCategoryName').value = '';
        renderCategoriesList();
        renderCategorias();
        updateCategorySelects();
    } else {
        showToast('error', 'Error', result.error);
    }
}

async function deleteCategory(categoriaId) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta categoría?')) {
        return;
    }

    showLoading();

    const result = await dbService.eliminarCategoria(businessId, categoriaId);

    hideLoading();

    if (result.success) {
        showToast('success', 'Eliminada', 'Categoría eliminada correctamente');
        renderCategoriesList();
        renderCategorias();
        updateCategorySelects();
    } else {
        showToast('error', 'Error', result.error);
    }
}

// ======================
// MÓDULO DE EMPLEADOS
// ======================

async function loadEmployeesForSelect() {
    const result = await dbService.getEmpleados(businessId);

    if (result.success) {
        empleados = result.data;

        const options = empleados.map(emp =>
            `<option value="${emp.id}">${emp.nombre}</option>`
        ).join('');

        document.getElementById('invoiceEmpleado').innerHTML =
            '<option value="">Seleccionar empleado</option>' + options;
    }
}

function openEmployeeModal() {
    document.getElementById('employeeForm').reset();
    document.getElementById('employeeModal').classList.add('active');
}

async function saveEmployee() {
    const nombre = document.getElementById('employeeName').value.trim();
    const email = document.getElementById('employeeEmail').value.trim();
    const rol = document.getElementById('employeeRole').value;
    const password = document.getElementById('employeePassword').value;

    if (!nombre || !email) {
        showToast('warning', 'Campos Requeridos', 'Nombre y email son obligatorios');
        return;
    }

    showLoading();

    const result = await dbService.crearEmpleado(businessId, {
        nombre,
        email,
        rol,
        passwordTemporal: password || 'Colmado123'
    });

    hideLoading();

    if (result.success) {
        showToast('success', 'Creado', 'Empleado agregado correctamente');
        closeModal('employeeModal');
        loadEmployeesForSelect();
        loadEmployeesList();
    } else {
        showToast('error', 'Error', result.error);
    }
}

async function loadEmployeesList() {
    const container = document.getElementById('employeesList');

    const result = await dbService.getEmpleados(businessId);

    if (!result.success || result.data.length === 0) {
        container.innerHTML = '<p class="text-center text-muted">No hay empleados registrados</p>';
        return;
    }

    container.innerHTML = result.data.map(emp => {
        const initials = emp.nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        const rolClass = emp.rol === 'admin' ? 'admin' : 'empleado';
        const rolLabel = emp.rol === 'admin' ? 'Administrador' : 'Empleado';

        return `
            <div class="employee-item">
                <div class="employee-avatar">${initials}</div>
                <div class="employee-info">
                    <div class="employee-name">${emp.nombre}</div>
                    <div class="employee-email">${emp.email}</div>
                </div>
                <span class="employee-role ${rolClass}">${rolLabel}</span>
                ${emp.id !== currentUser.uid ? `
                    <button class="btn btn-ghost btn-icon" onclick="deleteEmployee('${emp.id}')" title="Eliminar">
                        <i class="ri-delete-bin-line"></i>
                    </button>
                ` : ''}
            </div>
        `;
    }).join('');
}

async function deleteEmployee(empleadoId) {
    if (!confirm('¿Estás seguro de que deseas eliminar este empleado?')) {
        return;
    }

    showLoading();

    const result = await dbService.eliminarEmpleado(businessId, empleadoId);

    hideLoading();

    if (result.success) {
        showToast('success', 'Eliminado', 'Empleado eliminado correctamente');
        loadEmployeesForSelect();
        loadEmployeesList();
    } else {
        showToast('error', 'Error', result.error);
    }
}

// ======================
// MÓDULO DE CONFIGURACIÓN
// ======================

async function loadConfigData() {
    // Datos del negocio
    document.getElementById('configBusinessName').value = currentBusiness?.nombre || '';
    document.getElementById('configBusinessRNC').value = currentBusiness?.RNC || '';
    document.getElementById('configBusinessPhone').value = currentBusiness?.telefono || '';
    document.getElementById('configBusinessAddress').value = currentBusiness?.direccion || '';
    document.getElementById('configBusinessEmail').value = currentUser?.email || '';

    // Configuración de impuestos
    document.getElementById('configItbisPorcentaje').value = configData?.itbisPorcentaje || 18;
    document.getElementById('configItbisCliente').checked = configData?.itbisAsumidoPor === 'cliente';

    // Configuración de NCF
    document.getElementById('configNcfPrefijo').value = configData?.ncfPrefijo || 'E31';
    document.getElementById('configNcfActual').value = configData?.ncfActual || 1;

    // Lista de empleados
    loadEmployeesList();
}

function showConfigSection(section) {
    document.querySelectorAll('.config-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.config-nav-item').forEach(n => n.classList.remove('active'));

    document.getElementById(`config-${section}`).classList.add('active');
    document.querySelector(`[data-section="${section}"]`).classList.add('active');
}

async function handleBusinessSubmit(e) {
    e.preventDefault();

    const businessData = {
        nombre: document.getElementById('configBusinessName').value.trim(),
        RNC: document.getElementById('configBusinessRNC').value.trim(),
        telefono: document.getElementById('configBusinessPhone').value.trim(),
        direccion: document.getElementById('configBusinessAddress').value.trim()
    };

    showLoading();

    const result = await dbService.updateBusinessData(businessId, businessData);

    hideLoading();

    if (result.success) {
        showToast('success', 'Guardado', 'Datos del negocio actualizados');
        document.getElementById('businessName').textContent = businessData.nombre;
        currentBusiness = { ...currentBusiness, ...businessData };
    } else {
        showToast('error', 'Error', result.error);
    }
}

async function handleTaxSubmit(e) {
    e.preventDefault();

    const taxData = {
        itbisPorcentaje: parseFloat(document.getElementById('configItbisPorcentaje').value) || 18,
        itbisAsumidoPor: document.getElementById('configItbisCliente').checked ? 'cliente' : 'empresa'
    };

    showLoading();

    const result = await dbService.updateConfig(businessId, { ...configData, ...taxData });

    hideLoading();

    if (result.success) {
        showToast('success', 'Guardado', 'Configuración de impuestos actualizada');
        configData = { ...configData, ...taxData };
        updateCartTotals();
    } else {
        showToast('error', 'Error', result.error);
    }
}

async function handleNcfSubmit(e) {
    e.preventDefault();

    const ncfData = {
        ncfPrefijo: document.getElementById('configNcfPrefijo').value.trim() || 'E31',
        ncfActual: parseInt(document.getElementById('configNcfActual').value) || 1
    };

    showLoading();

    const result = await dbService.updateConfig(businessId, { ...configData, ...ncfData });

    hideLoading();

    if (result.success) {
        showToast('success', 'Guardado', 'Configuración de NCF actualizada');
        configData = { ...configData, ...ncfData };
    } else {
        showToast('error', 'Error', result.error);
    }
}

// ======================
// MÓDULO DE ESTADÍSTICAS
// ======================

async function loadReportData() {
    const fechaInicio = new Date(document.getElementById('reportDateStart').value);
    const fechaFin = new Date(document.getElementById('reportDateEnd').value);
    fechaFin.setHours(23, 59, 59, 999);

    showLoading();

    const result = await dbService.getVentasPorRango(businessId, fechaInicio, fechaFin);

    hideLoading();

    if (!result.success) {
        showToast('error', 'Error', 'No se pudieron cargar los datos');
        return;
    }

    const { total, cantidad, productosVendidos } = result.data;

    // Actualizar cards
    document.getElementById('statVentas').textContent = firestoreUtils.formatCurrency(total);
    document.getElementById('statVentasCount').innerHTML = `<span>${cantidad} transacciones</span>`;

    // Calcular egresos desde historial de caja
    const historialResult = await dbService.getHistorialCaja(businessId, 500);
    let egresos = 0;
    let ingresos = total;

    if (historialResult.success) {
        historialResult.data.forEach(item => {
            if (item.timestamp >= fechaInicio && item.timestamp <= fechaFin) {
                if (item.tipo === 'gasto') {
                    egresos += item.monto;
                }
            }
        });
    }

    document.getElementById('statIngresos').textContent = firestoreUtils.formatCurrency(ingresos);
    document.getElementById('statEgresos').textContent = firestoreUtils.formatCurrency(egresos);
    document.getElementById('statGanancia').textContent = firestoreUtils.formatCurrency(ingresos - egresos);

    // Renderizar top productos
    renderTopProducts(productosVendidos);
}

function renderTopProducts(productosVendidos) {
    const container = document.getElementById('topProductsList');
    const tableBody = document.getElementById('topProductsTable');

    if (!productosVendidos || Object.keys(productosVendidos).length === 0) {
        container.innerHTML = '<p class="text-center text-muted">No hay datos disponibles</p>';
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay datos disponibles</td></tr>';
        return;
    }

    // Convertir a array y ordenar
    const topProducts = Object.entries(productosVendidos)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 10);

    container.innerHTML = topProducts.map((prod, index) => {
        const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
        return `
            <div class="top-product-item">
                <div class="top-product-rank ${rankClass}">${index + 1}</div>
                <div class="top-product-info">
                    <div class="top-product-name">${prod.nombre}</div>
                    <div class="top-product-sales">${prod.cantidad} unidades vendidas</div>
                </div>
                <div class="top-product-revenue">${firestoreUtils.formatCurrency(prod.total)}</div>
            </div>
        `;
    }).join('');

    tableBody.innerHTML = topProducts.map((prod, index) => `
        <tr>
            <td><strong>${index + 1}</strong></td>
            <td>${prod.nombre}</td>
            <td>${prod.cantidad}</td>
            <td>${firestoreUtils.formatCurrency(prod.total)}</td>
        </tr>
    `).join('');
}

// ======================
// FUNCIONES GLOBALES
// ======================

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

async function logout() {
    if (!confirm('¿Estás seguro de que deseas cerrar sesión?')) {
        return;
    }

    showLoading();

    // Limpiar suscripciones
    if (unsubscribeCategorias) unsubscribeCategorias();
    if (unsubscribeProductos) unsubscribeProductos();
    if (unsubscribeFacturas) unsubscribeFacturas();
    if (unsubscribeCaja) unsubscribeCaja();

    await authService.logout();

    localStorage.removeItem('colmapp_user');

    hideLoading();
    window.location.href = 'index.html';
}

function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

function showToast(type, title, message) {
    const container = document.getElementById('toastContainer');

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

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// Agregar estilos de animación
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

    .btn-warning {
        background: var(--warning-color) !important;
        color: white !important;
    }
`;
document.head.appendChild(toastStyles);
