// Variables del carrito
let carrito = [];
let productos = [];
let configuracion = null;

// Cargar datos iniciales
async function loadPOSData() {
    if (!currentNegocio) return;
    
    document.getElementById('negocioNombre').textContent = currentNegocio.nombre;
    
    // Verificar caja abierta
    const cajaAbierta = await getCajaAbierta();
    const cajaStatus = document.getElementById('cajaStatus');
    
    if (!cajaAbierta) {
        cajaStatus.innerHTML = '<span class="material-icons" style="color: #e53e3e;">lock</span> Caja Cerrada';
        document.getElementById('btnVender').disabled = true;
        document.getElementById('btnVender').style.opacity = '0.5';
    } else {
        cajaStatus.innerHTML = '<span class="material-icons" style="color: #48bb78;">lock_open</span> Caja Abierta';
        document.getElementById('btnVender').disabled = false;
        document.getElementById('btnVender').style.opacity = '1';
    }
    
    // Cargar configuración
    configuracion = await getConfiguracion();
    
    // Cargar productos
    await cargarProductos();
    
    // Cargar clientes
    await cargarClientes();
    
    // Configurar búsqueda
    document.getElementById('searchProduct').addEventListener('input', filtrarProductos);
}

async function cargarProductos() {
    productos = await getProductos();
    mostrarProductos(productos);
}

function mostrarProductos(productosLista) {
    const grid = document.getElementById('productsGrid');
    grid.innerHTML = '';
    
    productosLista.forEach(producto => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.onclick = () => agregarAlCarrito(producto);
        
        card.innerHTML = `
            ${producto.imagen ? `<img src="${producto.imagen}" class="product-image" alt="${producto.nombre}">` : '<div class="product-image" style="background: #f0f0f0; display: flex; align-items: center; justify-content: center;"><span class="material-icons">inventory</span></div>'}
            <div class="product-name">${producto.nombre}</div>
            <div class="product-price">RD$ ${producto.precio.toFixed(2)}</div>
            <div class="product-stock">Stock: ${producto.stock}</div>
        `;
        
        grid.appendChild(card);
    });
}

function filtrarProductos() {
    const searchTerm = document.getElementById('searchProduct').value.toLowerCase();
    const filtrados = productos.filter(p => 
        p.nombre.toLowerCase().includes(searchTerm) || 
        (p.codigoBarras && p.codigoBarras.includes(searchTerm))
    );
    mostrarProductos(filtrados);
}

function agregarAlCarrito(producto) {
    // Verificar stock
    if (producto.stock <= 0) {
        alert('Producto sin stock');
        return;
    }
    
    const itemExistente = carrito.find(item => item.id === producto.id);
    
    if (itemExistente) {
        if (itemExistente.cantidad + 1 > producto.stock) {
            alert('Stock insuficiente');
            return;
        }
        itemExistente.cantidad++;
    } else {
        carrito.push({
            id: producto.id,
            nombre: producto.nombre,
            precio: producto.precio,
            cantidad: 1,
            stock: producto.stock
        });
    }
    
    actualizarCarrito();
}

function actualizarCarrito() {
    const cartContainer = document.getElementById('cartItems');
    const subtotalSpan = document.getElementById('subtotal');
    const itbisSpan = document.getElementById('itbis');
    const totalSpan = document.getElementById('total');
    
    let subtotal = 0;
    
    cartContainer.innerHTML = '';
    
    carrito.forEach((item, index) => {
        const itemTotal = item.precio * item.cantidad;
        subtotal += itemTotal;
        
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div>
                <strong>${item.nombre}</strong><br>
                RD$ ${item.precio.toFixed(2)} x ${item.cantidad}
            </div>
            <div>
                <div>RD$ ${itemTotal.toFixed(2)}</div>
                <div style="margin-top: 5px;">
                    <button onclick="modificarCantidad(${index}, -1)" class="btn-secondary" style="width: 30px; padding: 2px;">-</button>
                    <button onclick="modificarCantidad(${index}, 1)" class="btn-secondary" style="width: 30px; padding: 2px;">+</button>
                    <button onclick="eliminarDelCarrito(${index})" class="btn-primary" style="width: 30px; padding: 2px; background: #e53e3e;">×</button>
                </div>
            </div>
        `;
        
        cartContainer.appendChild(div);
    });
    
    const itbis = configuracion ? subtotal * (configuracion.itbis / 100) : 0;
    const total = configuracion?.itbisAsumeCliente ? subtotal + itbis : subtotal;
    
    subtotalSpan.textContent = `RD$ ${subtotal.toFixed(2)}`;
    itbisSpan.textContent = `RD$ ${itbis.toFixed(2)}`;
    totalSpan.textContent = `RD$ ${total.toFixed(2)}`;
}

function modificarCantidad(index, cambio) {
    const item = carrito[index];
    const nuevaCantidad = item.cantidad + cambio;
    
    if (nuevaCantidad < 1) {
        eliminarDelCarrito(index);
    } else if (nuevaCantidad <= item.stock) {
        item.cantidad = nuevaCantidad;
        actualizarCarrito();
    } else {
        alert('Stock insuficiente');
    }
}

function eliminarDelCarrito(index) {
    carrito.splice(index, 1);
    actualizarCarrito();
}

async function cargarClientes() {
    const clientes = await getClientes();
    const select = document.getElementById('clienteSelect');
    
    select.innerHTML = '<option value="">Consumidor Final</option>';
    
    clientes.forEach(cliente => {
        const option = document.createElement('option');
        option.value = cliente.id;
        option.textContent = `${cliente.nombre} - ${cliente.rnc || 'Sin RNC'}`;
        select.appendChild(option);
    });
}

async function procesarVenta() {
    if (carrito.length === 0) {
        alert('Agregue productos al carrito');
        return;
    }
    
    // Verificar caja abierta
    const cajaAbierta = await getCajaAbierta();
    if (!cajaAbierta) {
        alert('No se puede realizar la venta. La caja está cerrada.');
        return;
    }
    
    const clienteId = document.getElementById('clienteSelect').value;
    const subtotal = carrito.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    const itbis = subtotal * (configuracion.itbis / 100);
    const total = configuracion.itbisAsumeCliente ? subtotal + itbis : subtotal;
    
    const venta = {
        items: carrito.map(item => ({
            productoId: item.id,
            nombre: item.nombre,
            cantidad: item.cantidad,
            precio: item.precio,
            subtotal: item.precio * item.cantidad
        })),
        subtotal,
        itbis: configuracion.itbisAsumeCliente ? itbis : 0,
        total,
        clienteId: clienteId || null,
        metodoPago: 'efectivo',
        estado: 'completada'
    };
    
    try {
        const ventaRef = await registrarVenta(venta);
        
        // Registrar movimiento en caja
        await registrarMovimientoCaja('ingreso', total, `Venta #${ventaRef.id}`, ventaRef.id);
        
        // Generar ticket
        generarTicket(venta, ventaRef.id);
        
        // Limpiar carrito
        carrito = [];
        actualizarCarrito();
        
        // Recargar productos para actualizar stock
        await cargarProductos();
        
        alert('Venta realizada exitosamente');
    } catch (error) {
        alert('Error al procesar venta: ' + error.message);
    }
}

function generarTicket(venta, ventaId) {
    const now = new Date();
    const ticketContent = `
        <div style="text-align: center; font-family: monospace;">
            <strong>${currentNegocio.nombre}</strong><br>
            ${currentNegocio.direccion}<br>
            ${currentNegocio.telefono ? `Tel: ${currentNegocio.telefono}` : ''}<br>
            RNC: ${currentNegocio.RNC || 'N/A'}<br>
            ---------------------------------<br>
            Factura: ${ventaId}<br>
            Fecha: ${now.toLocaleString()}<br>
            NCF: ${venta.ncf || 'N/A'}<br>
            ---------------------------------<br>
            ${venta.items.map(item => `
                ${item.nombre}<br>
                ${item.cantidad} x RD$ ${item.precio.toFixed(2)} = RD$ ${item.subtotal.toFixed(2)}<br>
            `).join('')}
            ---------------------------------<br>
            Subtotal: RD$ ${venta.subtotal.toFixed(2)}<br>
            ITBIS (${configuracion.itbis}%): RD$ ${venta.itbis.toFixed(2)}<br>
            <strong>TOTAL: RD$ ${venta.total.toFixed(2)}</strong><br>
            ---------------------------------<br>
            ¡Gracias por su compra!
        </div>
    `;
    
    document.getElementById('ticketContent').innerHTML = ticketContent;
    document.getElementById('ticketModal').style.display = 'flex';
}

function imprimirTicket() {
    const ticketContent = document.getElementById('ticketContent').innerHTML;
    const ventana = window.open('', '_blank');
    ventana.document.write(`
        <html>
            <head><title>Ticket de Venta</title></head>
            <body style="font-family: monospace; padding: 20px;">${ticketContent}</body>
        </html>
    `);
    ventana.print();
    ventana.close();
}

function showAddProductModal() {
    document.getElementById('productoModal').style.display = 'flex';
}

document.getElementById('productoForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const producto = {
        nombre: document.getElementById('productoNombre').value,
        precio: parseFloat(document.getElementById('productoPrecio').value),
        costo: parseFloat(document.getElementById('productoCosto').value) || 0,
        stock: parseInt(document.getElementById('productoStock').value) || 0,
        codigoBarras: document.getElementById('productoCodigo').value,
        categoria: document.getElementById('productoCategoria').value
    };
    
    await crearProducto(producto);
    await cargarProductos();
    closeModal('productoModal');
    document.getElementById('productoForm').reset();
    alert('Producto agregado exitosamente');
});

function showAddClienteModal() {
    document.getElementById('clienteModal').style.display = 'flex';
}

document.getElementById('clienteForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const cliente = {
        nombre: document.getElementById('clienteNombre').value,
        rnc: document.getElementById('clienteRNC').value,
        telefono: document.getElementById('clienteTelefono').value,
        email: document.getElementById('clienteEmail').value,
        tipo: document.getElementById('clienteRNC').value ? 'fiscal' : 'consumidor'
    };
    
    await crearCliente(cliente);
    await cargarClientes();
    closeModal('clienteModal');
    document.getElementById('clienteForm').reset();
    alert('Cliente agregado exitosamente');
});

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Esperar autenticación
const checkAuth = setInterval(() => {
    if (currentNegocio) {
        clearInterval(checkAuth);
        loadPOSData();
    }
}, 500);