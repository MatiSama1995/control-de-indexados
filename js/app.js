/**
 * js/app.js
 * Orquestador principal: Maneja Auth, Listeners de Firebase y Carga de Archivos.
 */

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import * as UI from './ui-manager.js';
import * as Processor from './data-processor.js';


// Estado global de la aplicación
let state = { personas: [], certificaciones: [] };
window.state = state;

// --- 1. LISTENERS DE FIREBASE (TIEMPO REAL) ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-content').classList.remove('hidden');
        
        // Escuchar cambios en Personas
        onSnapshot(collection(db, 'artifacts', 'certitrack-v1', 'public', 'data', 'personas'), (snap) => {
            state.personas = snap.docs.map(d => ({ email: d.id, ...d.data() }));
            UI.refreshUI(state);
        });

        // Escuchar cambios en Certificaciones
        onSnapshot(collection(db, 'artifacts', 'certitrack-v1', 'public', 'data', 'certificaciones'), (snap) => {
            state.certificaciones = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            UI.refreshUI(state);
        });
    } else {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-content').classList.add('hidden');
    }
});

// --- 2. EVENTOS DE NAVEGACIÓN ---
document.getElementById('tab-dashboard').onclick = () => UI.switchTab('dashboard');
document.getElementById('tab-upload').onclick = () => UI.switchTab('upload');
document.getElementById('tab-manage').onclick = () => UI.switchTab('manage');
document.getElementById('tab-table').onclick = () => UI.switchTab('table');
document.getElementById('tab-support').onclick = () => UI.switchTab('support');
document.getElementById('btn-logout').onclick = () => signOut(auth);
// --- 2.1 EVENTOS DE SUB-NAVEGACIÓN (GESTIÓN MANUAL) ---
document.getElementById('subtab-new').onclick = () => UI.switchSubTab('new');
document.getElementById('subtab-people').onclick = () => UI.switchSubTab('people');
document.getElementById('subtab-exceptions').onclick = () => UI.switchSubTab('exceptions');

// --- 3. MANEJO DE LOGIN ---
document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('username').value, document.getElementById('password').value);
    } catch (err) {
        UI.showNotification("Error de acceso", "error");
    }
};

// --- 4. MANEJO DE CARGA DE ARCHIVOS (LAS 4 TARJETAS) ---
const setupFile = (id, type) => {
    const el = document.getElementById(id);
    if (!el) return;
    
    el.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (ev) => {
            const data = new Uint8Array(ev.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet);
            
            // Abrir modal de progreso
            document.getElementById('upload-progress-modal').classList.remove('hidden');
            const logContainer = document.getElementById('upload-progress-log');
            logContainer.innerHTML = ''; // Limpiar log anterior

            const updateLog = (curr, tot, msg) => {
                const progress = Math.round((curr / tot) * 100);
                document.getElementById('upload-progress-bar').style.width = `${progress}%`;
                document.getElementById('upload-progress-count').innerText = `${curr} / ${tot}`;
                logContainer.innerHTML += `<li class="text-[10px] opacity-80 border-b border-slate-800 py-1">✓ ${msg}</li>`;
                logContainer.scrollTop = logContainer.scrollHeight;
            };

            const onFinish = (finalMsg) => {
                document.getElementById('btn-close-upload').classList.remove('hidden');
                UI.showNotification(finalMsg, "success");
            };

            // Ejecutar el procesador correspondiente
            try {
                if (type === 'personas') await Processor.processPeople(json, updateLog, onFinish);
                if (type === 'cisco')    await Processor.processCisco(json, updateLog, onFinish);
                if (type === 'fortinet') await Processor.processFortinet(json, updateLog, onFinish, state.personas);
                if (type === 'general')  await Processor.processGeneralCerts(json, updateLog, onFinish);
            } catch (err) {
                UI.showNotification("Error al procesar el archivo", "error");
                console.error(err);
            }
        };
        reader.readAsArrayBuffer(file);
    };
};

// Activar los 4 inputs de archivos
setupFile('file-personas', 'personas');
setupFile('file-fortinet', 'fortinet');
setupFile('file-cisco', 'cisco');
setupFile('file-general', 'general');

// Botón para cerrar el modal de carga
document.getElementById('btn-close-upload').onclick = () => {
    document.getElementById('upload-progress-modal').classList.add('hidden');
    document.getElementById('btn-close-upload').classList.add('hidden');
};

// --- 5. BUSCADOR EN TIEMPO REAL ---
document.getElementById('table-search')?.addEventListener('input', () => {
    UI.refreshUI(state);
});
