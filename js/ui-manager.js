alert("¡EL CÓDIGO NUEVO ESTÁ CARGANDO!");
console.log("UI Manager cargado correctamente");

import { db, firestoreAppId } from './firebase-config.js';
import { doc, deleteDoc, updateDoc, writeBatch, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export const showNotification = (msg, type) => {
    const el = document.getElementById('notification');
    if (!el) return;
    el.className = `fixed bottom-4 right-4 z-50 p-4 rounded-xl shadow-xl bg-white border-l-4 ${type === 'success' ? 'border-green-500' : 'border-red-500'}`;
    el.innerHTML = `<div class="font-medium text-slate-800">${msg}</div>`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
};

export const switchTab = (id) => {
    document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('tab-active', 'text-blue-600'));
    const view = document.getElementById(`view-${id}`);
    const btn = document.getElementById(`tab-${id}`);
    if (view) view.classList.remove('hidden');
    if (btn) btn.classList.add('tab-active', 'text-blue-600');
};

export const refreshUI = (state) => {
    const masterBody = document.getElementById('master-table-body');
    const alertsBody = document.getElementById('dash-alerts-tbody');
    const peopleBody = document.getElementById('people-list-body');
    const missingBody = document.getElementById('missing-people-body');
    const search = document.getElementById('table-search')?.value.toLowerCase() || "";
    
    if(!masterBody) return;

    masterBody.innerHTML = ''; alertsBody.innerHTML = ''; peopleBody.innerHTML = ''; missingBody.innerHTML = '';

    const now = new Date();
    const warningLimit = new Date(); warningLimit.setDate(now.getDate() + 90);
    let huerfanos = new Map();

    // 1. Personas
    state.personas.forEach(p => {
        peopleBody.innerHTML += `<tr class="border-b"><td class="p-4"><b>${p.nombre}</b><br>${p.email}</td><td class="p-4 text-xs">${p.pais}</td><td class="p-4 text-right"><button onclick="window.toggleUserStatus('${p.email}', ${p.activo})" class="text-[10px] font-bold ${p.activo ? 'text-red-500' : 'text-green-500'}">${p.activo ? 'INHABILITAR' : 'ACTIVAR'}</button></td></tr>`;
    });

    // 2. Certificaciones
    state.certificaciones.forEach(c => {
        const p = state.personas.find(per => per.email === c.userEmail);
        const isMiss = !p;
        if (isMiss) huerfanos.set(c.userEmail, { name: c.tempName || 'Detectado', email: c.userEmail, country: c.detectedCountry || 'CH' });

        const match = !search || c.nombre.toLowerCase().includes(search) || (p?.nombre || "").toLowerCase().includes(search);
        if (match) {
            const vDate = new Date(c.vencimiento);
            let status = "Vigente", col = "bg-green-100 text-green-700";
            if (isMiss) { status = "Huérfano"; col = "bg-red-600 text-white"; }
            else if (vDate < now) { status = "Vencida"; col = "bg-red-100 text-red-700"; }
            else if (vDate < warningLimit) { status = "Por Vencer"; col = "bg-amber-100 text-amber-700"; }

            const tr = `<tr class="border-b"><td class="p-4 font-bold text-sm">${p ? p.nombre : (c.tempName || 'Huérfano')}</td><td class="p-4 text-xs"><b>${c.marca}</b><br>${c.nombre}</td><td class="p-4 text-xs text-center">${c.vencimiento}</td><td class="p-4 text-center"><span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${col}">${status}</span></td><td class="p-4 text-right"><button onclick="window.deleteCert('${c.id}')" class="text-red-300 hover:text-red-500">Eliminar</button></td></tr>`;
            masterBody.innerHTML += tr;
            if (status !== "Vigente") alertsBody.innerHTML += tr;
        }
    });

    // 3. Excepciones (AQUÍ ESTÁ EL INPUT DEL NOMBRE)
    huerfanos.forEach((v, k) => {
        const idSafe = k.replace(/[.@\s]/g, '_'); // Limpiamos puntos y arrobas para que no den error en IDs
        missingBody.innerHTML += `
            <tr class="border-b hover:bg-slate-50">
                <td class="p-4">
                    <input type="text" id="m-n-${idSafe}" value="${v.name}" class="w-full text-xs p-2 border rounded font-bold bg-white outline-none focus:ring-1 focus:ring-blue-500">
                </td>
                <td class="p-4">
                    <input type="email" id="m-e-${idSafe}" value="${v.email.includes('huerfano') ? '' : v.email}" class="w-full text-xs p-2 border rounded outline-none">
                </td>
                <td class="p-4">
                    <select id="m-p-${idSafe}" class="text-[10px] p-2 border rounded font-bold uppercase">
                        <option value="CHILE" ${v.country.includes('CH') ? 'selected' : ''}>CHILE</option>
                        <option value="PERÚ" ${v.country.includes('PE') ? 'selected' : ''}>PERÚ</option>
                        <option value="COLOMBIA" ${v.country.includes('CO') ? 'selected' : ''}>COLOMBIA</option>
                    </select>
                </td>
                <td class="p-4 text-right">
                    <button onclick="window.linkHuerfano('${idSafe}', '${k}')" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-[10px] font-bold">ASOCIAR</button>
                </td>
            </tr>`;
    });
    lucide.createIcons();
};

window.deleteCert = async (id) => {
    if (confirm("¿Borrar registro?")) await deleteDoc(doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'certificaciones', id));
};

window.toggleUserStatus = async (email, estadoActual) => {
    await updateDoc(doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'personas', email), { activo: !estadoActual });
};

window.linkHuerfano = async (idSafe, originalKey) => {
    const nombreEditado = document.getElementById(`m-n-${idSafe}`).value.trim();
    const emailDestino = document.getElementById(`m-e-${idSafe}`).value.toLowerCase().trim();
    const paisDestino = document.getElementById(`m-p-${idSafe}`).value;

    if (!nombreEditado || !emailDestino.includes('@')) return alert("Completa los datos correctamente.");

    try {
        const batch = writeBatch(db);
        const userRef = doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'personas', emailDestino);
        
        batch.set(userRef, { nombre: nombreEditado, email: emailDestino, pais: paisDestino, area: "Sin definir", activo: true }, { merge: true });

        // Usamos window.state porque lo hicimos global en app.js
        const afectados = window.state.certificaciones.filter(c => c.userEmail === originalKey || c.tempName === originalKey);
        afectados.forEach(c => {
            batch.update(doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'certificaciones', c.id), { userEmail: emailDestino, tempName: null });
        });

        await batch.commit();
        alert("¡Vinculado correctamente!");
    } catch (e) { console.error(e); alert("Error al vincular."); }
};
