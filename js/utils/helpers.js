// Global state
export const AppState = {
  negocioId: null,
  negocioData: null,
  currentUser: null,
  userRole: null,
  carrito: [],
  categorias: [],
  productos: [],
  cajaActual: null,
  config: { itbisPct: 18, itbisCliente: true, ncfPrefijo: 'B01', ncfSeq: 1 },
  empleados: [],
  facturas: [],
  movimientos: []
};

// Formatear moneda
export function fmt(val) {
  return `RD$ ${(val || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Mostrar toast
export function toast(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-times-circle' : 'fa-info-circle'}"></i> ${msg}`;
  container.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

// Abrir/cerrar modal
export function openModal(title, bodyHtml, onConfirm = null, confirmText = 'Confirmar') {
  const overlay = document.getElementById('modal-overlay');
  const titleEl = document.getElementById('modal-title');
  const bodyEl = document.getElementById('modal-body');
  const footerEl = document.getElementById('modal-footer');
  
  titleEl.textContent = title;
  bodyEl.innerHTML = bodyHtml;
  
  footerEl.innerHTML = `
    <button class="btn-sm gris" id="modal-cancel">Cancelar</button>
    <button class="btn-sm verde" id="modal-confirm">${confirmText}</button>
  `;
  
  document.getElementById('modal-cancel').onclick = () => closeModal();
  if (onConfirm) {
    document.getElementById('modal-confirm').onclick = () => { onConfirm(); closeModal(); };
  }
  
  overlay.classList.add('visible');
}

export function closeModal() {
  document.getElementById('modal-overlay').classList.remove('visible');
}

// Event dispatcher
export function emit(eventName, detail) {
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

export function on(eventName, callback) {
  window.addEventListener(eventName, callback);
}

// Inicializar módulos
export async function initModule(moduleName, initFn) {
  try {
    await initFn();
    console.log(`✅ ${moduleName} inicializado`);
  } catch (e) {
    console.error(`❌ Error en ${moduleName}:`, e);
  }
}