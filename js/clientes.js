let clientesLista = [];

async function loadClientes() {
    if (!currentNegocio) return;
    
    document.getElementById('negocioNombre').textContent = currentNegocio.nombre;
    
    clientesLista = await getClientes();
    mostrarClientes(clientesLista);
    
    // Configurar búsqueda
    document.getElementById('searchCliente').addEventListener('input', filtrarClientes);
}

function mostrarClientes(clientes) {
    const tbody = document.querySelector('#clientesTable tbody');
    tbody.innerHTML = '';
    
    clientes.forEach(cliente => {
        const row = tbody.insertRow();
        row.insertCell(0).textContent = cliente.nombre;
        row.insertCell(1).textContent = cliente.rnc || '-';
        row.insertCell(2).textContent = cliente.telefono || '-';
        row.insertCell(3).textContent = cliente.email || '-';
        row.insertCell(4).textContent = cliente.tipo === 'fiscal' ? 'Fiscal' : 'Consumidor Final';
        
        const accionesCell = row.insertCell(5);
        accionesCell.innerHTML = `
            <button onclick="editarCliente('${cliente.id}')" class="btn-secondary" style="width: auto; margin-right: 5px;">Editar</button>
            <button onclick="eliminarCliente('${cliente.id}')" class="btn-primary" style="width: auto; background: #e53e3e;">Eliminar</button>
        `;
    });
}

function filtrarClientes() {
    const searchTerm = document.getElementById('searchCliente').value.toLowerCase();
    
    const filtrados = clientesLista.filter(c => 
        c.nombre.toLowerCase().includes(searchTerm) || 
        (c.rnc && c.rnc.includes(searchTerm)) ||
        (c.telefono && c.telefono.includes(searchTerm))
    );
    
    mostrarClientes(filtrados);
}

function mostrarModalCliente(id = null) {
    const modal = document.getElementById('clienteModal');
    const form = document.getElementById('clienteForm');
    
    if (id) {
        const cliente = clientesLista.find(c => c.id === id);
        if (cliente) {
            document.getElementById('modalTitle').textContent = 'Editar Cliente';
            document.getElementById('clienteId').value = cliente.id;
            document.getElementById('nombre').value = cliente.nombre;
            document.getElementById('rnc').value = cliente.rnc || '';
            document.getElementById('telefono').value = cliente.telefono || '';
            document.getElementById('email').value = cliente.email || '';
            document.getElementById('direccion').value = cliente.direccion || '';
        }
    } else {
        document.getElementById('modalTitle').textContent = 'Nuevo Cliente';
        form.reset();
        document.getElementById('clienteId').value = '';
    }
    
    modal.style.display = 'flex';
}

async function editarCliente(id) {
    mostrarModalCliente(id);
}

async function eliminarCliente(id) {
    if (confirm('¿Está seguro de eliminar este cliente?')) {
        await eliminarCliente(id);
        await loadClientes();
        alert('Cliente eliminado');
    }
}

document.getElementById('clienteForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('clienteId').value;
    const cliente = {
        nombre: document.getElementById('nombre').value,
        rnc: document.getElementById('rnc').value,
        telefono: document.getElementById('telefono').value,
        email: document.getElementById('email').value,
        direccion: document.getElementById('direccion').value,
        tipo: document.getElementById('rnc').value ? 'fiscal' : 'consumidor'
    };
    
    if (id) {
        await actualizarCliente(id, cliente);
        alert('Cliente actualizado');
    } else {
        await crearCliente(cliente);
        alert('Cliente creado');
    }
    
    closeModal();
    await loadClientes();
});

function closeModal() {
    document.getElementById('clienteModal').style.display = 'none';
}

// Esperar autenticación
const checkAuth = setInterval(() => {
    if (currentNegocio) {
        clearInterval(checkAuth);
        loadClientes();
    }
}, 500);