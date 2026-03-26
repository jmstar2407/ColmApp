// Configuración de Firebase
const firebaseConfig = {
    // REEMPLAZAR CON TU CONFIGURACIÓN DE FIREBASE
  apiKey: "AIzaSyB7cX3O8Nkhg5XYsuH1UIn0ZDyxoxLzTB4",
  authDomain: "colmapp-4aaa4.firebaseapp.com",
  projectId: "colmapp-4aaa4",
  storageBucket: "colmapp-4aaa4.firebasestorage.app",
  messagingSenderId: "767529335752",
  appId: "1:767529335752:web:5967b10a0e0da050f91efd",
  measurementId: "G-22YKHGWTMH"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Configuración de persistencia
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);