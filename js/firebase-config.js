// Importaciones
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Credenciales Reales
const firebaseConfig = {
    apiKey: "AIzaSyA9jvefDipf0JrNNm6Pm6EPe5EuuM3Mqdo",
    authDomain: "gestion-certificaciones.firebaseapp.com",
    projectId: "gestion-certificaciones",
    storageBucket: "gestion-certificaciones.firebasestorage.app",
    messagingSenderId: "182274949963",
    appId: "1:182274949963:web:20486d47687f6a62729ece"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const firestoreAppId = "certitrack-v1";
