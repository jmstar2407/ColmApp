let productosLista = [];

async function loadProductos() {
    try {
        const negocio = await getCurrentNegocio();
        if (!negocio) {
            console.log('Esperando autenticación...');
            return;
        }
        
        document.getElementById('negocioNombre').textContent = negocio.nombre;
        
        productosLista = await getProductos();
        mostrarProductos(productosLista);
        
        // Cargar categorías únicas para el filtro
        const categorias = [...new Set(productosLista.map(p => p.categoria).filter(c => c))];
        const filterSelect = document.getElementById('filterCategoria');
        if (filterSelect) {
            filterSelect.innerHTML = '<option value="">Todas las categorías</option>';
            categorias.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat;
                filterSelect.appendChild(option);
            });
        }
        
        // Configurar búsqueda y filtros
        const searchInput = document.getElementById('searchProduct');
        if (searchInput) {
            searchInput.addEventListener('input', filtrarProductos);
        }
        
        const filterSelectElem = document.getElementById('filterCategoria');
        if (filterSelectElem) {
            filterSelectElem.addEventListener('change', filtrarProductos);
        }
    } catch (error) {
        console.error('Error al cargar productos:', error);
    }
}

function mostrarProductos(productos) {
    const tbody = document.querySelector('#productosTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    productos.forEach(producto => {
        const row = tbody.insertRow();
        
        // Imagen
        const imgCell = row.insertCell(0);
        if (producto.imagen) {
            imgCell.innerHTML = `<img src="${producto.imagen}" style="width: 50px; height: 50px; object-fit: cover;">`;
        } else {
            imgCell.innerHTML = '<span class="material-icons">inventory</span>';
        }
        
        row.insertCell(1).textContent = producto.codigoBarras || '-';
        row.insertCell(2).textContent = producto.nombre;
        row.insertCell(3).textContent = producto.categoria || '-';
        row.insertCell(4).textContent = `RD$ ${producto.precio.toFixed(2)}`;
        row.insertCell(5).textContent = producto.costo ? `RD$ ${producto.costo.toFixed(2)}` : '-';
        
        const stockCell = row.insertCell(6);
        stockCell.textContent = producto.stock;
        if (producto.stock <= 5) {
            stockCell.style.color = '#e53e3e';
            stockCell.style.fontWeight = 'bold';
        }
        
        const accionesCell = row.insertCell(7);
        accionesCell.innerHTML = `
            <button onclick="editarProducto('${producto.id}')" class="btn-secondary" style="width: auto; margin-right: 5px;">Editar</button>
            <button onclick="eliminarProducto('${producto.id}')" class="btn-primary" style="width: auto; background: #e53e3e;">Eliminar</button>
        `;
    });
}

function filtrarProductos() {
    const searchTerm = document.getElementById('searchProduct')?.value.toLowerCase() || '';
    const categoria = document.getElementById('filterCategoria')?.value || '';
    
    let filtrados = productosLista;
    
    if (searchTerm) {
        filtrados = filtrados.filter(p => 
            p.nombre.toLowerCase().includes(searchTerm) || 
            (p.codigoBarras && p.codigoBarras.includes(searchTerm))
        );
    }
    
    if (categoria) {
        filtrados = filtrados.filter(p => p.categoria === categoria);
    }
    
    mostrarProductos(filtrados);
}

function mostrarModalProducto(id = null) {
    const modal = document.getElementById('productoModal');
    const form = document.getElementById('productoForm');
    
    if (!modal || !form) return;
    
    if (id) {
        const producto = productosLista.find(p => p.id === id);
        if (producto) {
            document.getElementById('modalTitle').textContent = 'Editar Producto';
            document.getElementById('productoId').value = producto.id;
            document.getElementById('nombre').value = producto.nombre;
            document.getElementById('codigoBarras').value = producto.codigoBarras || '';
            document.getElementById('categoria').value = producto.categoria || '';
            document.getElementById('precio').value = producto.precio;
            document.getElementById('costo').value = producto.costo || '';
            document.getElementById('stock').value = producto.stock;
            document.getElementById('imagen').value = producto.imagen || '';
        }
    } else {
        document.getElementById('modalTitle').textContent = 'Nuevo Producto';
        form.reset();
        document.getElementById('productoId').value = '';
    }
    
    modal.style.display = 'flex';
}

async function editarProducto(id) {
    mostrarModalProducto(id);
}

async function eliminarProducto(id) {
    if (confirm('¿Está seguro de eliminar este producto?')) {
        try {
            await eliminarProducto(id);
            await loadProductos();
            alert('Producto eliminado');
        } catch (error) {
            alert('Error al eliminar producto: ' + error.message);
        }
    }
}

// Configurar el formulario cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    const productoForm = document.getElementById('productoForm');
    if (productoForm) {
        productoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const id = document.getElementById('productoId').value;
            const producto = {
                nombre: document.getElementById('nombre').value,
                codigoBarras: document.getElementById('codigoBarras').value,
                categoria: document.getElementById('categoria').value,
                precio: parseFloat(document.getElementById('precio').value),
                costo: parseFloat(document.getElementById('costo').value) || 0,
                stock: parseInt(document.getElementById('stock').value) || 0,
                imagen: document.getElementById('imagen').value
            };
            
            try {
                if (id) {
                    await actualizarProducto(id, producto);
                    alert('Producto actualizado');
                } else {
                    await crearProducto(producto);
                    alert('Producto creado');
                }
                
                closeModal();
                await loadProductos();
            } catch (error) {
                alert('Error al guardar producto: ' + error.message);
            }
        });
    }
});

function closeModal() {
    const modal = document.getElementById('productoModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Esperar autenticación para cargar productos
onAuthReady(() => {
    loadProductos();
});