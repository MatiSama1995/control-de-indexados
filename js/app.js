import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { collection, doc, setDoc, updateDoc, deleteDoc, getDoc, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { auth, db, firestoreAppId } from './firebase-config.js';
import { showNotification, showLoader, hideLoader, switchTab, switchManageTab, updateTopIndicator } from './ui-manager.js';
import { processPeople, processCisco, processFortinet, processGeneralCerts } from './data-processor.js';

// ESTADO GLOBAL
let state = {
    personas: [],
    certificaciones: [],
    charts: { status: null, colabs: null, countries: null }
};

let activeDashFilters = { pais: null, area: null, marca: null, certificacion: null, colaborador: null };
let unsubscribePersonas = null;
let unsubscribeCerts = null;
let confirmActionCallback = null;

const filterConfigs = [
    { id: 'pais', label: 'Ubicación', search: false },
    { id: 'area', label: 'Área', search: false },
    { id: 'marca', label: 'Fabricante', search: false },
    { id: 'certificacion', label: 'Certificación', search: true },
    { id: 'colaborador', label: 'Colaborador', search: true }
];

// INICIALIZACIÓN DE ICONOS
window.onload = () => lucide.createIcons();

// EXPONER FUNCIONES DE UI AL WINDOW (Para el HTML)
window.switchTab = switchTab;
window.switchManageTab = switchManageTab;

// MODAL DE CONFIRMACIÓN
window.showConfirm = (title, message, onConfirm, okText = "Confirmar", isDanger = true) => {
    document.getElementById('confirm-title').innerText = title;
    document.getElementById('confirm-message').innerText = message;
    
    const btnOk = document.getElementById('btn-confirm-ok');
    const iconBg = document.getElementById('confirm-icon-bg');
    
    btnOk.innerText = okText;
    if (isDanger) {
        btnOk.className = "px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-md";
        iconBg.className = "bg-red-100 p-2 rounded-full text-red-600";
    } else {
        btnOk.className = "px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-md";
        iconBg.className = "bg-blue-100 p-2 rounded-full text-blue-600";
    }

    confirmActionCallback = onConfirm;
    document.getElementById('custom-confirm-modal').classList.remove('hidden');
};

window.closeConfirm = () => {
    document.getElementById('custom-confirm-modal').classList.add('hidden');
    confirmActionCallback = null;
};

document.getElementById('btn-confirm-ok')?.addEventListener('click', () => {
    if (confirmActionCallback) confirmActionCallback();
    window.closeConfirm();
});

// AUTENTICACIÓN
window.addEventListener('online', () => updateTopIndicator(auth.currentUser !== null));
window.addEventListener('offline', () => updateTopIndicator(false));

onAuthStateChanged(auth, async (user) => {
    if (user) {
        updateTopIndicator(true);
        const adminRef = doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'admins', user.email);
        let adminSnap = await getDoc(adminRef);

        if (!adminSnap.exists() && user.email === 'cristian.morales@coasinlogicalis.com') {
            await setDoc(adminRef, { email: user.email, rol: 'SuperAdmin', activo: true, creadoEn: new Date().toISOString() });
            adminSnap = await getDoc(adminRef);
        }

        if (adminSnap.exists() && adminSnap.data().activo) {
            document.getElementById('login-screen').classList.add('hidden');
            document.getElementById('app-content').classList.remove('hidden');
            startDatabaseListeners();
        } else {
            await signOut(auth);
            showNotification("Tu cuenta no tiene privilegios de administrador.", "error");
        }
    } else {
        document.getElementById('app-content').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
        updateTopIndicator(false);
        if (unsubscribePersonas) unsubscribePersonas();
        if (unsubscribeCerts) unsubscribeCerts();
    }
});

const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('username').value;
        const pass = document.getElementById('password').value;
        const btn = loginForm.querySelector('button[type="submit"]');

        const originalText = btn.innerText;
        btn.innerText = "Verificando Permisos...";
        btn.disabled = true;

        try {
            await signInWithEmailAndPassword(auth, email, pass);
            showNotification("Sesión iniciada correctamente", "success");
        } catch (error) {
            const errorMsg = document.getElementById('login-error');
            if (error.code === 'auth/invalid-credential') errorMsg.innerText = "Correo o contraseña incorrectos.";
            else errorMsg.innerText = "Error: " + error.message;
            errorMsg.classList.remove('hidden');
            setTimeout(() => errorMsg.classList.add('hidden'), 4000);
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    });
}

window.logout = () => {
    window.showConfirm("Cerrar Sesión", "¿Deseas cerrar la sesión segura de CertiTrack?", async () => {
        await signOut(auth);
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        showNotification("Sesión cerrada", "success");
    }, "Cerrar Sesión", false);
};

// LISTENERS BD
const startDatabaseListeners = () => {
    unsubscribePersonas = onSnapshot(collection(db, 'artifacts', firestoreAppId, 'public', 'data', 'personas'), (snap) => {
        state.personas = snap.docs.map(d => ({ email: d.id, ...d.data() }));
        updateUI();
    });

    unsubscribeCerts = onSnapshot(collection(db, 'artifacts', firestoreAppId, 'public', 'data', 'certificaciones'), (snap) => {
        state.certificaciones = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateUI();
    });
};

// SUBIDA DE ARCHIVOS
const handleFileUpload = (id, type) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        showLoader(`Sincronizando ${type} con Firestore...`);
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const workbook = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet);
            
            try {
                if (type === 'personas') await processPeople(json);
                if (type === 'fortinet') await processFortinet(json, state.personas);
                if (type === 'cisco') await processCisco(json);
                if (type === 'general') await processGeneralCerts(json);
                showNotification(`Base de datos actualizada`, "success");
            } catch (err) {
                console.error(err);
                showNotification("Error procesando el archivo", "error");
            } finally { hideLoader(); e.target.value = ''; }
        };
        reader.readAsArrayBuffer(file);
    });
};

handleFileUpload('file-personas', 'personas');
handleFileUpload('file-fortinet', 'fortinet');
handleFileUpload('file-cisco', 'cisco');
handleFileUpload('file-general', 'general');

// FILTROS DASHBOARD
window.toggleFilterMenu = (key) => {
    document.querySelectorAll('.filter-dropdown-menu').forEach(menu => {
        if (menu.id !== `menu-${key}`) menu.classList.add('hidden');
    });
    document.getElementById(`menu-${key}`).classList.toggle('hidden');
};

window.filterDropdownSearch = (inputEl, listId) => {
    const query = inputEl.value.toLowerCase();
    const items = document.querySelectorAll(`#${listId} li`);
    items.forEach(item => {
        if(item.classList.contains('italic')) return; 
        if (item.innerText.toLowerCase().includes(query)) item.classList.remove('hidden');
        else item.classList.add('hidden');
    });
};

window.setDashFilter = (key, value) => {
    activeDashFilters[key] = value;
    renderDashboard();
    document.getElementById(`menu-${key}`)?.classList.add('hidden');
};

window.clearAllDashFilters = () => {
    Object.keys(activeDashFilters).forEach(k => activeDashFilters[k] = null);
    renderDashboard();
};

window.addEventListener('click', (e) => {
    if (!e.target.closest('.filter-dropdown-container')) {
        document.querySelectorAll('.filter-dropdown-menu').forEach(menu => menu.classList.add('hidden'));
    }
});

// LOGICA DE RENDERIZADO UI COMPLETA
const updateUI = () => {
    const table = document.getElementById('master-table-body');
    const missTable = document.getElementById('missing-people-body');
    const peopleTable = document.getElementById('people-list-body');
    const inactiveTable = document.getElementById('inactive-people-body');
    if(!table) return;
    const search = document.getElementById('table-search')?.value.toLowerCase() || "";
    const pSearch = document.getElementById('people-search')?.value.toLowerCase() || "";
    table.innerHTML = ''; missTable.innerHTML = ''; peopleTable.innerHTML = '';
    if(inactiveTable) inactiveTable.innerHTML = '';
    const now = new Date();
    const warningLimit = new Date(); warningLimit.setDate(now.getDate() + 90);
    let missingMap = new Map();
    
    state.personas.filter(p => !pSearch || p.nombre.toLowerCase().includes(pSearch)).forEach(p => {
        if (p.activo) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="px-6 py-3">
                    <div class="font-bold text-slate-800 text-sm">${p.nombre}</div>
                    <div class="text-[10px] text-slate-400 font-mono">${p.email}</div>
                </td>
                <td class="px-6 py-3 text-xs text-slate-500 uppercase">${p.pais} / ${p.area}</td>
                <td class="px-6 py-3">
                    <span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-green-100 text-green-700">Activo</span>
                </td>
                <td class="px-6 py-3 text-right">
                    <button onclick="toggleUser('${p.email}', true)" class="text-xs font-bold text-red-500 hover:text-red-700">Inhabilitar</button>
                </td>`;
            peopleTable.appendChild(tr);
        } else {
            if (inactiveTable) {
                const trInact = document.createElement('tr');
                trInact.className = "hover:bg-slate-50 transition-colors";
                trInact.innerHTML = `
                    <td class="px-6 py-4 font-bold text-xs text-slate-700">${p.nombre}</td>
                    <td class="px-6 py-4 text-xs text-slate-500 font-mono">${p.email}</td>
                    <td class="px-6 py-4 text-xs text-slate-500 text-center uppercase">${p.pais}</td>
                    <td class="px-6 py-4 text-right">
                        <button onclick="toggleUser('${p.email}', false)" class="bg-green-100 text-green-700 px-4 py-2 rounded-lg text-[10px] font-bold hover:bg-green-200 transition-colors shadow-sm"><i data-lucide="refresh-cw" class="w-3 h-3 inline-block mr-1"></i> Reactivar</button>
                    </td>`;
                inactiveTable.appendChild(trInact);
            }
        }
    });

    state.certificaciones.forEach(c => {
        const p = state.personas.find(per => per.email === c.userEmail);
        const isMiss = !p;
        const isInactive = p && !p.activo;
        if (isMiss) {
            const key = c.userEmail.startsWith('huerfano_') ? c.tempName : c.userEmail;
            if (!missingMap.has(key)) {
                missingMap.set(key, { name: c.tempName || key.split('@')[0], email: c.userEmail.startsWith('huerfano_') ? '' : c.userEmail, detectedCountry: c.detectedCountry || 'N/A' });
            }
        }
        const match = !search || c.userEmail.includes(search) || c.nombre.toLowerCase().includes(search) || (p?.nombre || "").toLowerCase().includes(search) || (c.tempName || "").toLowerCase().includes(search);
        if (!match) return;
        const venc = new Date(c.vencimiento);
        let stTxt = "Vigente", stCol = "bg-green-100 text-green-700";
        if (isMiss) { stTxt = "Huérfano"; stCol = "bg-red-600 text-white"; }
        else if (isInactive) { stTxt = "Inactivo"; stCol = "bg-slate-400 text-white"; }
        else if (venc < now) { stTxt = "Vencido"; stCol = "bg-red-100 text-red-700"; }
        else if (venc < warningLimit) { stTxt = "Por Vencer"; stCol = "bg-amber-100 text-amber-700"; }
        
        const tr = document.createElement('tr');
        tr.className = isInactive ? "user-inactive" : (isMiss ? "bg-red-50" : "hover:bg-slate-50 transition-colors");
        tr.innerHTML = `<td class="px-6 py-4"><div class="font-bold text-sm text-slate-800">${p ? p.nombre : (c.tempName || 'Detectado')}</div><div class="text-[10px] text-slate-400 font-mono">${isMiss ? 'SIN ASOCIAR' : c.userEmail}</div></td>
        <td class="px-6 py-4"><div class="font-bold text-blue-600 text-xs">${c.marca}</div><div class="text-xs text-slate-500">${c.nombre}</div></td>
        <td class="px-6 py-4 text-[10px] uppercase"><div>${p ? p.pais : (c.detectedCountry || '-')}</div><div class="text-slate-400">${p ? p.area : '-'}</div></td>
        <td class="px-6 py-4 text-xs font-medium text-center">${c.vencimiento}</td>
        <td class="px-6 py-4 text-center"><span class="px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${stCol}">${stTxt}</span></td>
        <td class="px-6 py-4 text-right"><button onclick="removeCert('${c.id}')" class="text-slate-300 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button></td>`;
        table.appendChild(tr);
    });

    missingMap.forEach((val, key) => {
        const idSafe = key.replace(/\s+/g, '_');
        const tr = document.createElement('tr');
        const validCountries = ["CHILE", "PERÚ", "COLOMBIA"];
        const detected = val.detectedCountry ? val.detectedCountry.toUpperCase() : "";
        const isDetectedValid = validCountries.includes(detected);
        let optionsHTML = `<option value="" ${!isDetectedValid ? 'selected' : ''} disabled>Seleccione País...</option>`;
        validCountries.forEach(c => optionsHTML += `<option value="${c}" ${detected === c ? 'selected' : ''}>${c}</option>`);
        
        const validAreas = ["Comercial", "Pre-venta", "Ingenieria", "COE"];
        let areaOptionsHTML = `<option value="" selected disabled>Seleccione Área...</option>`;
        validAreas.forEach(a => areaOptionsHTML += `<option value="${a}">${a}</option>`);
        
        tr.innerHTML = `<td class="px-6 py-3 font-bold text-xs text-slate-700">${val.name}</td>
        <td class="px-6 py-3"><input type="email" value="${val.email}" placeholder="Email real" class="w-full text-xs p-2 border rounded outline-none focus:ring-1 focus:ring-blue-500" id="m-e-${idSafe}"></td>
        <td class="px-6 py-3 text-center"><select id="m-p-${idSafe}" class="w-full text-xs p-2 border rounded outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50 uppercase font-bold text-slate-600 cursor-pointer">${optionsHTML}</select></td>
        <td class="px-6 py-3"><select id="m-a-${idSafe}" class="w-full text-xs p-2 border rounded outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50 uppercase font-bold text-slate-600 cursor-pointer">${areaOptionsHTML}</select></td>
        <td class="px-6 py-3"><input type="text" placeholder="Nombre Responsable" class="w-full text-xs p-2 border rounded outline-none focus:ring-1 focus:ring-blue-500" id="m-r-${idSafe}"></td>
        <td class="px-6 py-3 text-right"><div class="flex justify-end space-x-2"><button onclick="disableHuerfano('${idSafe}', '${val.name.replace(/'/g, "\\'")}', '${val.email}')" class="bg-slate-100 text-slate-500 px-3 py-2 rounded-lg text-[10px] font-bold hover:bg-red-100 hover:text-red-600 transition-colors">Inhabilitar</button><button onclick="linkHuerfano('${idSafe}', '${val.name.replace(/'/g, "\\'")}')" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-colors shadow-sm">Asociar</button></div></td>`;
        missTable.appendChild(tr);
    });

    if (missTable && missTable.children.length === 0) missTable.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-slate-400 text-sm italic">No hay registros huérfanos pendientes.</td></tr>`;
    if (inactiveTable && inactiveTable.children.length === 0) inactiveTable.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-slate-400 text-sm italic">No hay colaboradores inhabilitados.</td></tr>`;

    const badge = document.getElementById('missing-badge');
    if (badge) {
        if (missingMap.size > 0) { badge.innerText = missingMap.size; badge.classList.remove('hidden'); }
        else badge.classList.add('hidden');
    }

    const brandSelect = document.getElementById('support-brand-select');
    if (brandSelect) {
        const currentVal = brandSelect.value;
        brandSelect.innerHTML = '<option value="">Selecciona una marca...</option>';
        const allBrands = [...new Set(state.certificaciones.map(c => c.marca))].sort();
        allBrands.forEach(b => {
            const count = state.certificaciones.filter(c => c.marca === b).length;
            const opt = document.createElement('option');
            opt.value = b;
            opt.textContent = `${b} (${count} registros totales)`;
            brandSelect.appendChild(opt);
        });
        brandSelect.value = currentVal;
    }

    const s = document.getElementById('c-persona');
    if (s) {
        const current = s.value;
        s.innerHTML = '<option value="">Seleccionar Colaborador...</option>';
        state.personas.filter(p => p.activo).sort((a,b) => a.nombre.localeCompare(b.nombre)).forEach(p => {
            const o = document.createElement('option');
            o.value = p.email; o.textContent = `${p.nombre} (${p.email})`;
            s.appendChild(o);
        });
        s.value = current;
    }

    lucide.createIcons();
    renderDashboard();
};

const renderDashboard = () => {
    const now = new Date();
    const warningLimit = new Date(); warningLimit.setDate(now.getDate() + 90);

    let dashData = state.certificaciones.map(c => {
        const p = state.personas.find(per => per.email === c.userEmail);
        return {
            ...c,
            colaborador: p ? p.nombre : (c.tempName || 'Detectado'),
            pais: p ? p.pais : (c.detectedCountry || 'N/A'),
            area: p ? p.area : 'Sin Definir',
            certificacion: c.nombre,
            activo: p ? p.activo : false,
            isMiss: !p
        };
    }).filter(item => item.activo || item.isMiss);

    const filteredData = dashData.filter(item => {
        for (const [key, val] of Object.entries(activeDashFilters)) {
            if (val && item[key] !== val) return false;
        }
        return true;
    });

    let stats = { total: 0, active: 0, warning: 0, expired: 0 };
    let chartDataStatus = { 'Vigente': 0, 'Por Vencer': 0, 'Vencida': 0 };
    let chartDataColabs = {};
    let chartDataCountries = {};

    let alertsHTML = '';
    let generalHTML = '';
    let alertsCount = 0;

    filteredData.forEach(item => {
        let stTxt = "Vigente", stCol = "bg-green-100 text-green-700 border border-green-200";
        const vDate = new Date(item.vencimiento);
        
        if (item.isMiss) { stTxt = "Huérfano"; stCol = "bg-red-600 text-white border border-red-700"; } 
        else if (vDate < now) { stTxt = "Vencida"; stCol = "bg-red-100 text-red-700 border border-red-200"; } 
        else if (vDate < warningLimit) { stTxt = "Por Vencer"; stCol = "bg-amber-100 text-amber-700 border border-amber-200"; }

        if (!item.isMiss && item.activo) {
            stats.total++;
            if (stTxt === 'Vigente') stats.active++;
            else if (stTxt === 'Por Vencer') stats.warning++;
            else stats.expired++;
        } else if (item.isMiss) stats.expired++;

        if (item.activo && !item.isMiss) {
            if (stTxt === 'Vigente') chartDataStatus['Vigente']++;
            else if (stTxt === 'Por Vencer') chartDataStatus['Por Vencer']++;
            else chartDataStatus['Vencida']++;
            if (item.colaborador) chartDataColabs[item.colaborador] = (chartDataColabs[item.colaborador] || 0) + 1;
            if (item.pais && item.pais !== 'N/A') chartDataCountries[item.pais] = (chartDataCountries[item.pais] || 0) + 1;
        }

        generalHTML += `<tr class="hover:bg-slate-50 transition-colors">
            <td class="px-6 py-4 text-center"><span class="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg uppercase tracking-widest">${item.pais}</span></td>
            <td class="px-6 py-4"><div class="font-bold text-slate-800">${item.colaborador}</div><div class="text-[11px] text-slate-500 mt-0.5 flex items-center"><i data-lucide="mail" class="w-3 h-3 mr-1"></i> ${item.isMiss ? 'N/A' : item.userEmail} <span class="mx-2 text-slate-300">|</span> <i data-lucide="briefcase" class="w-3 h-3 mr-1"></i> ${item.area}</div></td>
            <td class="px-6 py-4"><span class="font-bold text-slate-700 text-xs">${item.marca}</span></td>
            <td class="px-6 py-4"><div class="text-sm font-medium text-slate-700">${item.certificacion}</div><div class="text-[11px] mt-1 flex items-center ${stTxt === 'Vigente' ? 'text-green-600' : (stTxt === 'Por Vencer' ? 'text-amber-600' : 'text-red-600')}"><i data-lucide="calendar" class="w-3 h-3 mr-1"></i> Expira: ${item.vencimiento}</div></td>
        </tr>`;

        if (stTxt === 'Vencida' || stTxt === 'Por Vencer' || stTxt === 'Huérfano') {
            alertsCount++;
            alertsHTML += `<tr class="${stTxt === 'Huérfano' ? 'bg-red-50/50' : 'hover:bg-slate-50'} transition-colors">
                <td class="px-6 py-3 text-xs font-bold text-slate-500">${item.pais}</td>
                <td class="px-6 py-3 font-semibold text-slate-800">${item.colaborador}</td>
                <td class="px-6 py-3 text-sm text-slate-600"><span class="font-bold text-xs mr-1 text-slate-400">[${item.marca}]</span> ${item.certificacion}</td>
                <td class="px-6 py-3 text-center text-xs font-mono text-slate-500">${item.vencimiento}</td>
                <td class="px-6 py-3 text-right"><span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm ${stCol}">${stTxt}</span></td>
            </tr>`;
        }
    });

    document.getElementById('stat-total').innerText = stats.total;
    document.getElementById('stat-active').innerText = stats.active;
    document.getElementById('stat-warning').innerText = stats.warning;
    document.getElementById('stat-expired').innerText = stats.expired;
    document.getElementById('alerts-count').innerText = alertsCount;
    document.getElementById('dash-alerts-tbody').innerHTML = alertsHTML || `<tr><td colspan="5" class="px-6 py-8 text-center text-slate-400 text-sm italic">No hay alertas de vencimiento.</td></tr>`;
    document.getElementById('dash-general-tbody').innerHTML = generalHTML || `<tr><td colspan="4" class="px-6 py-8 text-center text-slate-400 text-sm italic">No se encontraron registros.</td></tr>`;

    renderCharts(chartDataStatus, chartDataColabs, chartDataCountries);

    const filterContainer = document.getElementById('dash-filters-container');
    if(filterContainer) {
        let filtersHTML = '';
        filterConfigs.forEach(config => {
            const validForThis = dashData.filter(item => {
                for (const [key, val] of Object.entries(activeDashFilters)) {
                    if (key !== config.id && val && item[key] !== val) return false;
                }
                return true;
            });
            const options = [...new Set(validForThis.map(item => item[config.id]))].filter(Boolean).sort();
            const isActive = activeDashFilters[config.id] !== null;
            const currentVal = activeDashFilters[config.id];
            const pillClass = isActive ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50';

            filtersHTML += `<div class="relative filter-dropdown-container">
                <div class="flex items-center border rounded-full text-[11px] font-medium transition-all ${pillClass}">
                    <div class="px-3 py-1.5 flex items-center gap-1.5 cursor-pointer" onclick="toggleFilterMenu('${config.id}')">
                        <span class="${isActive ? 'opacity-80' : 'text-slate-400 font-bold'}">${config.label}:</span>
                        <span class="font-bold truncate max-w-[120px]">${isActive ? currentVal : 'Todos'}</span>
                        <i data-lucide="chevron-down" class="w-3 h-3 ${isActive ? 'text-white' : 'text-slate-400'} ml-1"></i>
                    </div>
                    ${isActive ? `<div class="pr-3 pl-1.5 py-1.5 border-l border-blue-500 hover:text-red-200 cursor-pointer transition-colors" onclick="setDashFilter('${config.id}', null)" title="Borrar filtro"><i data-lucide="x" class="w-3 h-3"></i></div>` : ''}
                </div>
                <div id="menu-${config.id}" class="filter-dropdown-menu hidden absolute top-full left-0 mt-2 w-56 bg-white border border-slate-100 rounded-xl shadow-xl z-50 overflow-hidden">
                    ${config.search ? `<div class="p-2 border-b border-slate-100 bg-slate-50 sticky top-0 z-10"><div class="relative"><i data-lucide="search" class="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"></i><input type="text" placeholder="Buscar..." class="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 bg-white" oninput="filterDropdownSearch(this, 'list-${config.id}')"></div></div>` : ''}
                    <ul id="list-${config.id}" class="max-h-48 overflow-y-auto py-1 custom-scrollbar">
                        ${options.length === 0 ? `<li class="px-4 py-3 text-xs text-slate-400 italic text-center">Sin opciones bajo este filtro</li>` : ''}
                        ${options.map(opt => `<li class="px-4 py-2 text-[11px] text-slate-600 hover:bg-blue-50 hover:text-blue-700 cursor-pointer transition-colors ${currentVal === opt ? 'bg-blue-50 font-bold text-blue-700 border-l-2 border-blue-600' : 'border-l-2 border-transparent'}" onclick="setDashFilter('${config.id}', \`${opt.replace(/`/g, "\\`")}\`)">${opt}</li>`).join('')}
                    </ul>
                </div>
            </div>`;
        });
        filterContainer.innerHTML = filtersHTML;
        lucide.createIcons();
    }
};

const renderCharts = (statusData, colabsData, countriesData) => {
    const chartStatusEl = document.getElementById('chartStatus');
    const chartColabsEl = document.getElementById('chartColabs');
    const chartCountriesEl = document.getElementById('chartCountries');
    if (!chartStatusEl || !chartColabsEl || !chartCountriesEl) return;

    if (state.charts.status) state.charts.status.destroy();
    if (state.charts.colabs) state.charts.colabs.destroy();
    if (state.charts.countries) state.charts.countries.destroy();

    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.color = '#64748b';

    state.charts.status = new Chart(chartStatusEl, {
        type: 'doughnut',
        data: { labels: ['Vigente', 'Por Vencer', 'Vencida'], datasets: [{ data: [statusData['Vigente'], statusData['Por Vencer'], statusData['Vencida']], backgroundColor: ['#10b981', '#f59e0b', '#ef4444'], borderWidth: 2, hoverOffset: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 15, font: { size: 10 } } } } }
    });

    const sortedColabs = Object.entries(colabsData).sort((a, b) => b[1] - a[1]).slice(0, 8); 
    state.charts.colabs = new Chart(chartColabsEl, {
        type: 'bar',
        data: { labels: sortedColabs.map(c => c[0]), datasets: [{ label: 'Certificaciones', data: sortedColabs.map(c => c[1]), backgroundColor: '#3b82f6', borderRadius: 4, barPercentage: 0.6 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: true, color: '#f1f5f9' }, beginAtZero: true, ticks: { stepSize: 1 } }, y: { grid: { display: false }, ticks: { font: { size: 10 } } } } }
    });

    state.charts.countries = new Chart(chartCountriesEl, {
        type: 'doughnut',
        data: { labels: Object.keys(countriesData), datasets: [{ data: Object.values(countriesData), backgroundColor: ['#6366f1', '#14b8a6', '#8b5cf6', '#ec4899', '#f97316'], borderWidth: 2, hoverOffset: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 15, font: { size: 10 } } } } }
    });
};

// CRUD MANUAL Y HERRAMIENTAS MANTENIMIENTO
window.toggleUser = async (email, estadoActual) => {
    showLoader("Actualizando...");
    try { await updateDoc(doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'personas', email), { activo: !estadoActual }); showNotification("Usuario actualizado", "success"); } 
    catch (e) { showNotification("Error", "error"); } finally { hideLoader(); }
};

window.removeCert = (id) => {
    window.showConfirm("Eliminar", "¿Eliminar certificación permanentemente?", async () => {
        showLoader("Eliminando...");
        try { await deleteDoc(doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'certificaciones', id)); showNotification("Eliminado", "success"); } 
        catch (e) { showNotification("Error", "error"); } finally { hideLoader(); }
    });
};

window.deleteCertificationsByBrand = async () => {
    const brand = document.getElementById('support-brand-select').value;
    if (!brand) return showNotification("Selecciona una marca primero", "error");
    const certsToDelete = state.certificaciones.filter(c => c.marca === brand);
    const total = certsToDelete.length;
    if (total === 0) return showNotification("No hay registros", "error");
    window.showConfirm("Eliminación Masiva", `Se eliminarán ${total} registros de "${brand}".`, async () => {
        const btnDelete = document.getElementById('btn-delete-brand');
        btnDelete.disabled = true; btnDelete.classList.add('opacity-50');
        const chunkSize = 20; let deletedCount = 0;
        for (let i = 0; i < total; i += chunkSize) {
            const chunk = certsToDelete.slice(i, i + chunkSize);
            const batch = writeBatch(db);
            chunk.forEach(cert => batch.delete(doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'certificaciones', cert.id)));
            try { await batch.commit(); deletedCount += chunk.length; } 
            catch (error) { showNotification("Error al eliminar", "error"); break; }
        }
        showNotification(`Se eliminaron ${deletedCount} registros.`, "success");
        btnDelete.disabled = false; btnDelete.classList.remove('opacity-50');
    });
};

window.disableHuerfano = async (id, nombre, originalEmail) => {
    const emailToUse = originalEmail && originalEmail.trim() !== "" ? originalEmail : `huerfano_${nombre.replace(/\s+/g, '_').toLowerCase()}@inactivo.local`;
    window.showConfirm("Inhabilitar", `¿Deseas inhabilitar a "${nombre}"?`, async () => {
        showLoader("Inhabilitando...");
        try {
            await setDoc(doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'personas', emailToUse), { nombre, email: emailToUse, pais: "N/A", area: "Sin definir", activo: false, responsable: "N/A" });
            const certs = state.certificaciones.filter(c => c.tempName === nombre || c.userEmail === originalEmail || c.userEmail === `huerfano_${nombre.replace(/\s+/g, '_')}`);
            const batch = writeBatch(db);
            certs.forEach(cert => batch.update(doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'certificaciones', cert.id), { userEmail: emailToUse, tempName: null }));
            await batch.commit(); showNotification("Inhabilitado", "success");
        } catch (e) { showNotification("Error", "error"); } finally { hideLoader(); }
    });
};

window.linkHuerfano = async (id, nombre) => {
    const email = document.getElementById(`m-e-${id}`)?.value.toLowerCase().trim();
    const area = document.getElementById(`m-a-${id}`)?.value;
    const responsable = document.getElementById(`m-r-${id}`)?.value.trim() || "N/A";
    const pais = document.getElementById(`m-p-${id}`)?.value.toUpperCase();
    if (!email.includes('@') || !pais || !area) return showNotification("Faltan datos válidos", "error");
    showLoader("Vinculando...");
    try {
        await setDoc(doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'personas', email), { nombre, email, pais, area, activo: true, responsable });
        const certs = state.certificaciones.filter(c => c.tempName === nombre || c.userEmail === `huerfano_${nombre.replace(/\s+/g, '_')}`);
        for(let cert of certs) await updateDoc(doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'certificaciones', cert.id), { userEmail: email, tempName: null });
        showNotification("Asociado con éxito", "success");
    } catch (e) { showNotification("Error", "error"); } finally { hideLoader(); }
};

document.getElementById('form-persona')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('p-email').value.toLowerCase().trim();
    const pais = document.getElementById('p-pais').value;
    if (!pais) return showNotification("Selecciona el País", "error");
    showLoader("Guardando...");
    try {
        await setDoc(doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'personas', email), { nombre: document.getElementById('p-nombre').value, email, area: document.getElementById('p-area').value || "N/A", pais, responsable: document.getElementById('p-responsable').value || "N/A", activo: true });
        showNotification("Colaborador añadido", "success"); e.target.reset();
    } catch (e) { showNotification("Error", "error"); } finally { hideLoader(); }
});

document.getElementById('form-cert')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = Math.random().toString(36).substr(2, 9);
    showLoader("Guardando...");
    try {
        await setDoc(doc(db, 'artifacts', firestoreAppId, 'public', 'data', 'certificaciones', id), { userEmail: document.getElementById('c-persona').value, marca: document.getElementById('c-marca').value, nombre: document.getElementById('c-nombre').value, vencimiento: document.getElementById('c-vence').value });
        showNotification("Certificación vinculada", "success"); e.target.reset();
    } catch (e) { showNotification("Error", "error"); } finally { hideLoader(); }
});

window.exportToExcel = () => {
    const now = new Date(); now.setHours(0, 0, 0, 0); 
    const warningLimit = new Date(); warningLimit.setDate(new Date().getDate() + 90);
    const dataToExport = state.certificaciones.reduce((acc, c) => {
        const p = state.personas.find(per => per.email === c.userEmail);
        if (!p || !p.activo || new Date(c.vencimiento) < now) return acc;
        acc.push({ "Colaborador": p.nombre, "Email": p.email, "País": p.pais, "Área": p.area, "Marca": c.marca, "Certificación": c.nombre, "Vencimiento": c.vencimiento, "Responsable": p.responsable, "Estado": (new Date(c.vencimiento) < warningLimit) ? "Por Vencer" : "Vigente" });
        return acc;
    }, []);
    if (dataToExport.length === 0) return showNotification("No hay datos para exportar", "error");
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Certificaciones_Vigentes");
    XLSX.writeFile(wb, "Reporte_CertiTrack_Vigentes.xlsx");
};

// LISTENERS DE BUSCADORES
document.getElementById('table-search')?.addEventListener('input', () => updateUI());
document.getElementById('people-search')?.addEventListener('input', () => updateUI());
