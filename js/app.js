/**
 * js/app.js
 * Orquestador principal corregido
 */

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import * as UI from './ui-manager.js';
import * as Processor from './data-processor.js';

let state = { personas: [], certificaciones: [] };
window.state = state;

// --- 1. LISTENERS DE FIREBASE (TIEMPO REAL) ---
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

// --- 2. EVENTOS DE NAVEGACIÓN PRINCIPAL ---
// Usando las IDs de tu HTML real (btn-dashboard, etc.)
const navButtons = {
    'btn-dashboard': 'dashboard',
    'btn-upload': 'upload',
    'btn-manage': 'manage',
    'btn-table': 'table',
    'btn-support': 'support'
};

Object.entries(navButtons).forEach(([id, view]) => {
    const btn = document.getElementById(id);
    if(btn) btn.onclick = () => UI.switchTab(view);
});

document.getElementById('btn-logout').onclick = () => signOut(auth);

// --- 2.1 EVENTOS DE SUB-NAVEGACIÓN DE GESTIÓN ---
// Aquí usamos las IDs correctas y con protección para que no rompa el código
const btnForms = document.getElementById('btn-manage-forms');
const btnPeople = document.getElementById('btn-manage-people');
const btnMiss = document.getElementById('btn-manage-missing');

if(btnForms) btnForms.onclick = () => UI.switchSubTab('forms');
if(btnPeople) btnPeople.onclick = () => UI.switchSubTab('people');
if(btnMiss) btnMiss.onclick = () => UI.switchSubTab('missing');

// --- 3. MANEJO DE LOGIN (AHORA SÍ FUNCIONARÁ) ---
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const btn = loginForm.querySelector('button');
        const originalText = btn.innerText;
        
        try {
            btn.innerText = "Cargando...";
            btn.disabled = true;
            await signInWithEmailAndPassword(auth, document.getElementById('username').value, document.getElementById('password').value);
        } catch (err) {
            UI.showNotification("Credenciales incorrectas", "error");
            console.error("Error login:", err.message);
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    };
}

// --- 4. MANEJO DE CARGA DE ARCHIVOS Y BUSCADOR ---
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
            
            document.getElementById('upload-progress-modal').classList.remove('hidden');
            
            const updateLog = (curr, tot, msg) => {
                document.getElementById('upload-progress-bar').style.width = `${Math.round((curr / tot) * 100)}%`;
                document.getElementById('upload-progress-count').innerText = `${curr} / ${tot}`;
                const log = document.getElementById('upload-progress-log');
                if(log) log.innerHTML += `<li class="py-1">✓ ${msg}</li>`;
            };

            try {
                if (type === 'personas') await Processor.processPeople(json, updateLog, () => UI.showNotification("Éxito", "success"));
                // ... los demás procesadores ...
            } catch (err) { UI.showNotification("Error", "error"); }
        };
        reader.readAsArrayBuffer(file);
    };
};

setupFile('file-personas', 'personas');
setupFile('file-fortinet', 'fortinet');
setupFile('file-cisco', 'cisco');
setupFile('file-general', 'general');

document.getElementById('table-search')?.addEventListener('input', () => UI.refreshUI(state));
