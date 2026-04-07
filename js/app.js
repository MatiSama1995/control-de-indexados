import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import * as UI from './ui-manager.js';
import * as Processor from './data-processor.js';

let state = { personas: [], certificaciones: [] };

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-content').classList.remove('hidden');
        
        onSnapshot(collection(db, 'artifacts', 'certitrack-v1', 'public', 'data', 'personas'), (snap) => {
            state.personas = snap.docs.map(d => ({ email: d.id, ...d.data() }));
            UI.refreshUI(state);
        });

        onSnapshot(collection(db, 'artifacts', 'certitrack-v1', 'public', 'data', 'certificaciones'), (snap) => {
            state.certificaciones = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            UI.refreshUI(state);
        });
    } else {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-content').classList.add('hidden');
    }
});

// Eventos de Navegación
document.getElementById('tab-dashboard').onclick = () => UI.switchTab('dashboard');
document.getElementById('tab-upload').onclick = () => UI.switchTab('upload');
document.getElementById('tab-manage').onclick = () => UI.switchTab('manage');
document.getElementById('tab-table').onclick = () => UI.switchTab('table');
document.getElementById('tab-support').onclick = () => UI.switchTab('support');
document.getElementById('btn-logout').onclick = () => signOut(auth);

// Manejo de Login
document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('username').value, document.getElementById('password').value);
    } catch (err) {
        UI.showNotification("Error de acceso", "error");
    }
};
