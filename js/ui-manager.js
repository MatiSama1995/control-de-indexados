import { db, firestoreAppId } from './firebase-config.js';
import { doc, deleteDoc, updateDoc, writeBatch, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- 1. NAVEGACIÓN ---
export const switchTab = (id) => {
    document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('tab-active', 'text-blue-600'));
    const view = document.getElementById(`view-${id}`);
    const btn = document.getElementById(`btn-${id}`);
    if (view) view.classList.remove('hidden');
    if (btn) btn.classList.add('tab-active', 'text-blue-600');
};

export const switchSubTab = (subId) => {
    document.querySelectorAll('.manage-section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.manage-subtab').forEach(t => {
        t.classList.remove('subtab-active');
        t.classList.add('text-slate-500');
    });
    const targetView = document.getElementById(`manage-${subId}`);
    const targetBtn = document.getElementById(`btn-manage-${subId}`);
    if (targetView) targetView.classList.remove('hidden');
    if (targetBtn) {
        targetBtn.classList.add('subtab-active');
        targetBtn.classList.remove('text-slate-500');
    }
};

// --- 2. NOTIFICACIONES ---
export const showNotification = (msg, type) => {
    const el = document.getElementById('notification');
    if (!el) return;
    el.className = `fixed bottom-4 right-4 z-50 p-4 rounded-xl shadow-xl bg-white border-l-4 ${type === 'success' ? 'border-green-500' : 'border-red-500'} transition-all`;
    el.innerHTML = `<div class="font-medium text-slate-800">${msg}</div>`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4000);
};

// --- 3. RENDERIZADO PRINCIPAL ---
export const refreshUI = (state) => {
    const masterBody = document.getElementById('master-table-body');
    const alertsBody = document.getElementById('dash-alerts-tbody');
    const peopleBody = document.getElementById('people-list-body');
    const missingBody = document.getElementById('missing-people-body');
    const search = document.getElementById('table-search')?.value.toLowerCase() || "";
    
    if(!masterBody) return;

    masterBody.innerHTML = ''; alertsBody.innerHTML = ''; 
    peopleBody.innerHTML = ''; missingBody.innerHTML = '';

    const now = new Date();
    const warningLimit = new Date(); warningLimit.setDate(now.getDate() + 90);
    
    let stats = { total: 0, active: 0, warning: 0, expired: 0 };
    let huerfanos = new Map();

    // Personas
    state.personas.forEach(p => {
        peopleBody.innerHTML += `
            <tr class="border-b hover:bg-slate-50 ${!p.activo ? 'opacity-50' : ''}">
                <td class="p-4"><b>${p.nombre}</b><br><span class="text-[10px] text-slate-400">${p.email}</span></td>
                <td class="p-4 text-xs font-bold uppercase">${p.pais} / ${p.area}</td>
                <td class="p-4 text-right">
                    <button onclick="window.toggleUserStatus('${p.email}', ${p.activo})" class="px-3 py-1 rounded-lg text-[10px] font-black border ${p.activo ? 'text-red-500 border-red-100 bg-red-50' : 'text-green-500 border-green-100 bg-green-50'}">
                        ${p.activo ? 'INHABILITAR' : 'ACTIVAR'}
                    </button>
                </td>
            </tr>`;
    });

    // Certificaciones
    state.certificaciones.forEach(c => {
        const p = state.personas.find(per => per.email === c.userEmail);
        const isMiss = !p;
        const isInactive = p && !p.activo;

        if (isMiss) {
            huerfanos.set(c.userEmail, { name: c.tempName || 'Detectado', email: c.userEmail, country: c.detectedCountry || 'CHILE' });
        }

        const match = !search || c.nombre.toLowerCase().includes(search) || (p?.nombre || "").toLowerCase().includes(search);
        
        if (match) {
            const vDate = new Date(c.vencimiento);
            let status = "Vigente", col = "bg-green-100 text-green-700";
            
            if (isMiss) { status = "Huérfano"; col = "bg-red-600 text-white"; stats.expired++; }
            else if (isInactive) { status = "Inactivo"; col = "bg-slate-400 text-white"; }
            else if (vDate < now) { status = "Vencida"; col = "bg-red-100 text-red-700"; stats.expired++; }
            else if (vDate < warningLimit) { status = "Por Vencer"; col = "bg-amber-100 text-amber-700"; stats.warning++; }
            else { stats.active++; }
            
            if (p && p.activo) stats.total++;

            const trHTML = `<tr class="border-b hover:bg-slate-50 ${isInactive ? 'opacity-40' : ''}"><td class="p-4 font-bold text-sm">${p ? p.nombre : (c.tempName || 'Huérfano')}</td><td class="p-4 text-xs"><b>${c.marca}</b><br>${c.nombre}</td><td class="p-4 text-xs text-center">${c.vencimiento}</td><td class="p-4 text-center"><span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${col}">${status}</span></td><td class="p-4 text-right"><button onclick="window.deleteCert('${c.id}')" class="text-slate-300 hover:text-red-500 transition-colors">Eliminar</button></td></tr>`;
            masterBody.innerHTML += trHTML;
            if (status !== "Vigente" && status !== "Inactivo") alertsBody.innerHTML += trHTML;
        }
    });

    // Actualizar Dashboard
    if(document.getElementById('stat-total')) document.getElementById('stat-total').innerText = stats.total;
    if(document.getElementById('stat-active')) document.getElementById('stat-active').innerText = stats.active;
    if(document.getElementById('stat-warning')) document.getElementById('stat-warning').innerText = stats.warning;
    if(document.getElementById('stat-expired')) document.getElementById('stat-expired').innerText = stats.expired;
    if(document.getElementById('alerts-count')) document.getElementById('alerts-count').innerText = stats.expired + stats.warning;

    // Excepciones
    huerfanos.forEach((v, k) => {
        const idSafe = k.replace(/[.@\s]/g, '_'); 
        missingBody.innerHTML += `
            <tr class="border-b hover:bg-slate-50">
                <td class="px-4 py-3"><input type="text" id="m-n-${idSafe}" value="${v.name}" class="w-full text-xs p-2 border rounded-xl font-bold outline-none"></td>
                <td class="px-4 py-3"><input type="email" id="m-e-${idSafe}" value="${v.email.includes('huerfano') ? '' : v.email}" class="w-full text-xs p-2 border rounded-xl outline-none" placeholder="Email..."></td>
                <td class="px-4 py-3 text-center">
                    <select id="m-p-${idSafe}" class="text-[10px] p-2 border rounded-xl font-bold uppercase">
                        <option value="CHILE" ${v.country.includes('CH') ? 'selected' : ''}>CH</option>
                        <option value="PERÚ" ${v.country.includes('PE') ? 'selected' : ''}>PE</option>
                        <option value="COLOMBIA" ${v.country.includes('CO') ? 'selected' : ''}>CO</option>
                    </select>
                </td>
                <td class="px-4 py-3 text-center">
                    <select id="m-a-${idSafe}" class="text-[10px] p-2 border rounded-xl font-bold uppercase">
                        <option value="INGENIERIA">INGENIERÍA</option>
                        <option value="COMERCIAL">COMERCIAL</option>
                        <option value="PRE-VENTA">PRE-VENTA</option>
                    </select>
                </td>
                <td class="px-4 py-3"><input type="text" id="m-r-${idSafe}" placeholder="Resp." class="w-full text-xs p-2 border rounded-xl outline-none"></td>
                <td class="px-4 py-3 text-right"><button onclick="window.linkHuerfano('${idSafe}', '${k}')" class="bg-blue-600 text-white px-5 py-2 rounded-xl text-[10px] font-black hover:bg-blue-700">ASOCIAR</button></td>
            </tr>`;
    });

    lucide.createIcons();
};

// --- 4. OPERACIONES ---
window.deleteCert = async (id) => {
    if (confirm("¿Eliminar registro?")) {
        try {
            await deleteDoc(doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'certificaciones', id));
            showNotification("Eliminado", "success");
        } catch (e) { showNotification("Error", "error"); }
    }
};

window.toggleUserStatus = async (email, estadoActual) => {
    try {
        await updateDoc(doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'personas', email), { activo: !estadoActual });
        showNotification("Usuario actualizado", "success");
    } catch (e) { showNotification("Error", "error"); }
};

window.linkHuerfano = async (idSafe, originalKey) => {
    const nombre = document.getElementById(`m-n-${idSafe}`).value.trim();
    const email = document.getElementById(`m-e-${idSafe}`).value.toLowerCase().trim();
    const pais = document.getElementById(`m-p-${idSafe}`).value;
    const area = document.getElementById(`m-a-${idSafe}`).value;
    const resp = document.getElementById(`m-r-${idSafe}`).value;

    if (!nombre || !email.includes('@')) return alert("Datos inválidos");

    try {
        const batch = writeBatch(db);
        const userRef = doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'personas', email);
        batch.set(userRef, { nombre, email, pais, area, responsable: resp || "N/A", activo: true }, { merge: true });

        const afectados = window.state.certificaciones.filter(c => c.userEmail === originalKey || c.tempName === originalKey);
        afectados.forEach(c => {
            const certRef = doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'certificaciones', c.id);
            batch.update(certRef, { userEmail: email, tempName: null });
        });

        await batch.commit();
        showNotification("Vinculado con éxito", "success");
    } catch (e) { showNotification("Error", "error"); }
};
