import { db, firestoreAppId } from './firebase-config.js';
import { doc, deleteDoc, updateDoc, writeBatch, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export const showNotification = (msg, type) => {
    const el = document.getElementById('notification');
    el.className = `fixed bottom-4 right-4 z-50 p-4 rounded-xl shadow-xl bg-white border-l-4 ${type === 'success' ? 'border-green-500' : 'border-red-500'}`;
    el.innerText = msg;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
};

export const refreshUI = (state) => {
    // 1. Lógica de Tabla Maestra y Alertas
    const masterBody = document.getElementById('master-table-body');
    const alertsBody = document.getElementById('dash-alerts-tbody');
    masterBody.innerHTML = ''; alertsBody.innerHTML = '';

    state.certificaciones.forEach(c => {
        const p = state.personas.find(per => per.email === c.userEmail);
        const row = `<tr><td class="p-4">${p ? p.nombre : (c.tempName || 'Huérfano')}</td><td class="p-4">${c.marca}</td><td class="p-4">${c.vencimiento}</td></tr>`;
        masterBody.innerHTML += row;
        // Lógica de alertas... (similar a tu código original)
    });

    // 2. Lógica de Huérfanos
    const missBody = document.getElementById('missing-people-body');
    missBody.innerHTML = '';
    // Filtrar huerfanos y renderizar...
    
    lucide.createIcons();
};

export const switchTab = (id) => {
    document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('tab-active'));
    document.getElementById(`view-${id}`).classList.remove('hidden');
    document.getElementById(`tab-${id}`).classList.add('tab-active');
};
