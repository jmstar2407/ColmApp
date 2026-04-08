import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyB7cX3O8Nkhg5XYsuH1UIn0ZDyxoxLzTB4",
  authDomain: "colmapp-4aaa4.firebaseapp.com",
  projectId: "colmapp-4aaa4",
  storageBucket: "colmapp-4aaa4.firebasestorage.app",
  messagingSenderId: "767529335752",
  appId: "1:767529335752:web:5967b10a0e0da050f91efd"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;