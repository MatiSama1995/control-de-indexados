/**
 * js/ui-manager.js
 * Maneja toda la interfaz, notificaciones y renderizado de tablas.
 */

import { db, firestoreAppId } from './firebase-config.js';
import { doc, deleteDoc, updateDoc, writeBatch, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- NOTIFICACIONES ---
export const showNotification = (msg, type) => {
    const el = document.getElementById('notification');
    if (!el) return;
    el.className = `fixed bottom-4 right-4 z-50 p-4 rounded-xl shadow-xl bg-white border-l-4 ${type === 'success' ? 'border-green-500' : 'border-red-500'} transition-all`;
    el.innerHTML = `<div class="font-medium text-slate-800">${msg}</div>`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
};

// --- NAVEGACIÓN DE PESTAÑAS ---
export const switchTab = (id) => {
    document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('tab-active', 'text-blue-600'));
    const view = document.getElementById(`view-${id}`);
    const btn = document.getElementById(`tab-${id}`);
    if (view) view.classList.remove('hidden');
    if (btn) btn.classList.add('tab-active', 'text-blue-600');
};

// --- RENDERIZADO PRINCIPAL (Aquí es donde estaba lo que no encontrabas) ---
export const refreshUI = (state) => {
    const masterBody = document.getElementById('master-table-body');
    const alertsBody = document.getElementById('dash-alerts-tbody');
    const peopleBody = document.getElementById('people-list-body');
    const missingBody = document.getElementById('missing-people-body');
    const search = document.getElementById('table-search')?.value.toLowerCase() || "";
    
    if(!masterBody) return;

    // Limpiamos las tablas antes de volver a dibujar
    masterBody.innerHTML = ''; 
    alertsBody.innerHTML = ''; 
    peopleBody.innerHTML = ''; 
    missingBody.innerHTML = '';

    const now = new Date();
    const warningLimit = new Date(); warningLimit.setDate(now.getDate() + 90);
    let huerfanos = new Map();

    // 1. RENDERIZAR MAESTRO DE PERSONAS (GESTIÓN)
    state.personas.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = "border-b hover:bg-slate-50";
        tr.innerHTML = `
            <td class="px-6 py-3 font-bold text-sm">${p.nombre}<br><span class="text-[10px] text-slate-400 font-mono">${p.email}</span></td>
            <td class="px-6 py-3 text-xs uppercase">${p.pais} / ${p.area}</td>
            <td class="px-6 py-3 text-right">
                <button onclick="window.toggleUserStatus('${p.email}', ${p.activo})" class="text-[10px] font-bold ${p.activo ? 'text-red-500' : 'text-green-500'}">
                    ${p.activo ? 'INHABILITAR' : 'REACTIVAR'}
                </button>
            </td>
        `;
        peopleBody.appendChild(tr);
    });

    // 2. RENDERIZAR CERTIFICACIONES (TABLA MAESTRA)
    state.certificaciones.forEach(c => {
        const p = state.personas.find(per => per.email === c.userEmail);
        const isMiss = !p;
        
        // Si no tiene dueño, lo guardamos para la tabla de excepciones
        if (isMiss) {
            huerfanos.set(c.userEmail, { 
                name: c.tempName || 'Detectado', 
                email: c.userEmail,
                country: c.detectedCountry || 'CHILE'
            });
        }

        const match = !search || c.nombre.toLowerCase().includes(search) || (p?.nombre || "").toLowerCase().includes(search);
        if (match) {
            const vDate = new Date(c.vencimiento);
            let status = "Vigente", col = "bg-green-100 text-green-700";
            if (isMiss) { status = "Huérfano"; col = "bg-red-600 text-white"; }
            else if (vDate < now) { status = "Vencida"; col = "bg-red-100 text-red-700"; }
            else if (vDate < warningLimit) { status = "Por Vencer"; col = "bg-amber-100 text-amber-700"; }

            const tr = document.createElement('tr');
            tr.className = "border-b hover:bg-slate-50";
            tr.innerHTML = `
                <td class="p-4 font-bold text-sm">${p ? p.nombre : (c.tempName || 'Huérfano')}</td>
                <td class="p-4 text-xs"><b>${c.marca}</b><br>${c.nombre}</td>
                <td class="p-4 text-xs">${c.vencimiento}</td>
                <td class="p-4 text-center"><span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${col}">${status}</span></td>
                <td class="p-4 text-right"><button onclick="window.deleteCert('${c.id}')" class="text-red-400 hover:text-red-600">Eliminar</button></td>
            `;
            masterBody.appendChild(tr);
            if (status !== "Vigente") alertsBody.appendChild(tr.cloneNode(true));
        }
    });

    // 3. RENDERIZAR EXCEPCIONES (HUÉRFANOS EDITABLES)
    huerfanos.forEach((v, k) => {
        const idSafe = k.replace(/\s+/g, '_'); 
        const tr = document.createElement('tr');
        tr.className = "border-b hover:bg-slate-50";
        tr.innerHTML = `
            <td class="px-6 py-3">
                <input type="text" id="m-n-${idSafe}" value="${v.name}" 
                    class="w-full text-xs p-2 border rounded font-bold bg-white outline-none focus:ring-1 focus:ring-blue-500">
            </td>
            <td class="px-6 py-3">
                <input type="email" id="m-e-${idSafe}" value="${v.email.includes('huerfano') ? '' : v.email}" 
                    class="w-full text-xs p-2 border rounded outline-none" placeholder="Email...">
            </td>
            <td class="px-6 py-3">
                <select id="m-p-${idSafe}" class="text-[10px] p-2 border rounded font-bold w-full uppercase">
                    <option value="CHILE" ${v.country === 'CHILE' ? 'selected' : ''}>CHILE</option>
                    <option value="PERÚ" ${v.country === 'PERÚ' ? 'selected' : ''}>PERÚ</option>
                    <option value="COLOMBIA" ${v.country === 'COLOMBIA' ? 'selected' : ''}>COLOMBIA</option>
                </select>
            </td>
            <td class="px-6 py-3 text-right">
                <button onclick="window.linkHuerfano('${idSafe}', '${k}', state.certificaciones)" 
                    class="bg-blue-600 text-white px-4 py-2 rounded-lg text-[10px] font-bold hover:bg-blue-700 shadow-md">
                    ASOCIAR
                </button>
            </td>
        `;
        missingBody.appendChild(tr);
    });

    lucide.createIcons();
};

// --- FUNCIONES QUE SE LLAMAN DESDE EL HTML (window.) ---

window.deleteCert = async (id) => {
    if (confirm("¿Estás seguro de eliminar este registro?")) {
        try {
            await deleteDoc(doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'certificaciones', id));
            showNotification("Registro eliminado", "success");
        } catch (e) { showNotification("Error al eliminar", "error"); }
    }
};

window.toggleUserStatus = async (email, estadoActual) => {
    try {
        await updateDoc(doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'personas', email), { 
            activo: !estadoActual 
        });
        showNotification("Estado actualizado", "success");
    } catch (e) { showNotification("Error", "error"); }
};

window.linkHuerfano = async (idSafe, originalKey, stateCertificaciones) => {
    const nombreEditado = document.getElementById(`m-n-${idSafe}`).value.trim();
    const emailDestino = document.getElementById(`m-e-${idSafe}`).value.toLowerCase().trim();
    const paisDestino = document.getElementById(`m-p-${idSafe}`).value;

    if (!nombreEditado || !emailDestino.includes('@')) return alert("Datos incompletos");

    try {
        const batch = writeBatch(db);
        const userRef = doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'personas', emailDestino);
        
        batch.set(userRef, {
            nombre: nombreEditado,
            email: emailDestino,
            pais: paisDestino,
            area: "Sin definir",
            activo: true
        }, { merge: true });

        const afectados = stateCertificaciones.filter(c => c.userEmail === originalKey || c.tempName === originalKey);
        afectados.forEach(c => {
            const certRef = doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'certificaciones', c.id);
            batch.update(certRef, { userEmail: emailDestino, tempName: null });
        });

        await batch.commit();
        showNotification("Vinculación exitosa", "success");
    } catch (e) { showNotification("Error", "error"); }
};
