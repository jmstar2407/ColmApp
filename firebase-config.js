// ============================================================
// FIREBASE CONFIGURATION
// Reemplaza estos valores con los de tu proyecto Firebase
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCa3ntHg9DqV3JefcvFP9cg8xCmwm0wlLo",
  authDomain: "facturacion-drink.firebaseapp.com",
  projectId: "facturacion-drink",
  storageBucket: "facturacion-drink.firebasestorage.app",
  messagingSenderId: "1093109447685",
  appId: "1:1093109447685:web:a3015f3494f757a625b06c"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Exportar servicios globales
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// Habilitar persistencia offline
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
  console.warn("Persistencia offline no disponible:", err.code);
});
