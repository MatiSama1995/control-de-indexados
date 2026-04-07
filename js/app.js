/**
 * js/app.js - Versión Ultra-Segura
 */
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import * as UI from './ui-manager.js';

let state = { personas: [], certificaciones: [] };
window.state = state;

// --- 1. LISTENERS DE FIREBASE ---
onAuthStateChanged(auth, (user) => {
    const loginScreen = document.getElementById('login-screen');
    const appContent = document.getElementById('app-content');

    if (user) {
        if(loginScreen) loginScreen.classList.add('hidden');
        if(appContent) appContent.classList.remove('hidden');
        
        onSnapshot(collection(db, 'artifacts', 'certitrack-v1', 'public', 'data', 'personas'), (snap) => {
            state.personas = snap.docs.map(d => ({ email: d.id, ...d.data() }));
            UI.refreshUI(state);
        });

        onSnapshot(collection(db, 'artifacts', 'certitrack-v1', 'public', 'data', 'certificaciones'), (snap) => {
            state.certificaciones = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            UI.refreshUI(state);
        });
    } else {
        if(loginScreen) loginScreen.classList.remove('hidden');
        if(appContent) appContent.classList.add('hidden');
    }
});

// --- 2. MANEJO DE LOGIN (PUESTO ARRIBA PARA PRIORIDAD) ---
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // <--- ESTO EVITA EL "?" EN LA URL
        const email = document.getElementById('username').value;
        const pass = document.getElementById('password').value;
        
        try {
            await signInWithEmailAndPassword(auth, email, pass);
            console.log("Login exitoso");
        } catch (err) {
            alert("Error: " + err.message);
        }
    });
}

// --- 3. NAVEGACIÓN (CON PROTECCIÓN CONTRA ERRORES) ---
const setupClick = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.onclick = fn;
};

// Pestañas principales
setupClick('btn-dashboard', () => UI.switchTab('dashboard'));
setupClick('btn-upload', () => UI.switchTab('upload'));
setupClick('btn-manage', () => UI.switchTab('manage'));
setupClick('btn-table', () => UI.switchTab('table'));
setupClick('btn-support', () => UI.switchTab('support'));
setupClick('btn-logout', () => signOut(auth));

// Sub-pestañas de Gestión (Las IDs de tu HTML real)
setupClick('btn-manage-forms', () => UI.switchSubTab('forms'));
setupClick('btn-manage-people', () => UI.switchSubTab('people'));
setupClick('btn-manage-missing', () => UI.switchSubTab('missing'));

// --- 4. BUSCADOR ---
document.getElementById('table-search')?.addEventListener('input', () => UI.refreshUI(state));
