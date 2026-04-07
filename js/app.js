alert("¡El archivo app.js cargó correctamente!");
/**
 * js/app.js - Versión Ultra-Segura
 */
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import * as UI from './ui-manager.js';

// 1. VERIFICACIÓN DE CARGA
console.log("CertiTrack: app.js cargado");

// 2. MANEJO DE LOGIN (Prioridad máxima)
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.onsubmit = async (e) => {
        e.preventDefault(); 
        e.stopPropagation();
        
        const email = document.getElementById('username').value;
        const pass = document.getElementById('password').value;
        
        console.log("Intentando login para:", email);
        
        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (err) {
            console.error("Error de Firebase:", err.code);
            alert("Acceso denegado: " + err.message);
        }
        return false;
    };
}

// 3. DETECTAR USUARIO
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-screen')?.classList.add('hidden');
        document.getElementById('app-content')?.classList.remove('hidden');
        
        // Listeners de datos
        onSnapshot(collection(db, 'artifacts', 'certitrack-v1', 'public', 'data', 'personas'), (snap) => {
            window.state = { ...window.state, personas: snap.docs.map(d => ({ email: d.id, ...d.data() })) };
            UI.refreshUI(window.state);
        });

        onSnapshot(collection(db, 'artifacts', 'certitrack-v1', 'public', 'data', 'certificaciones'), (snap) => {
            window.state = { ...window.state, certificaciones: snap.docs.map(d => ({ id: d.id, ...d.data() })) };
            UI.refreshUI(window.state);
        });
    } else {
        document.getElementById('login-screen')?.classList.remove('hidden');
        document.getElementById('app-content')?.classList.add('hidden');
    }
});

// 4. NAVEGACIÓN (Solo si los elementos existen)
const bindClick = (id, view) => {
    const btn = document.getElementById(id);
    if(btn) btn.onclick = () => UI.switchTab(view);
};

bindClick('btn-dashboard', 'dashboard');
bindClick('btn-upload', 'upload');
bindClick('btn-manage', 'manage');
bindClick('btn-table', 'table');
bindClick('btn-support', 'support');

const btnLogout = document.getElementById('btn-logout');
if(btnLogout) btnLogout.onclick = () => signOut(auth);

// Sub-pestañas
const subClick = (id, sub) => {
    const btn = document.getElementById(id);
    if(btn) btn.onclick = () => UI.switchSubTab(sub);
};
subClick('btn-manage-forms', 'forms');
subClick('btn-manage-people', 'people');
subClick('btn-manage-missing', 'missing');
