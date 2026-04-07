export const showNotification = (msg, type) => {
    const el = document.getElementById('notification');
    if(!el) return;
    el.classList.remove('hidden'); el.classList.replace('translate-y-20', 'translate-y-0');
    el.className = `fixed bottom-4 right-4 z-50 p-4 rounded-xl shadow-2xl transition-all border-l-4 ${type === 'success' ? 'border-green-500' : 'border-red-500'} bg-white`;
    document.getElementById('notification-message').innerText = msg;
    document.getElementById('notification-icon').innerHTML = `<i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}" class="w-5 h-5 ${type === 'success' ? 'text-green-500' : 'text-red-500'}"></i>`;
    lucide.createIcons();
    setTimeout(() => { el.classList.replace('translate-y-0', 'translate-y-20'); setTimeout(() => el.classList.add('hidden'), 300); }, 4000);
};

export const showLoader = (t) => { 
    const el = document.getElementById('loader');
    if(!el) return;
    document.getElementById('loader-text').innerText = t; 
    el.classList.remove('hidden'); 
};

export const hideLoader = () => document.getElementById('loader')?.classList.add('hidden');

export const switchTab = (id) => {
    document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('tab-active', 'text-blue-600'));
    document.getElementById(`view-${id}`).classList.remove('hidden');
    document.getElementById(`btn-${id}`).classList.add('tab-active', 'text-blue-600');
};

export const switchManageTab = (id) => {
    document.querySelectorAll('.manage-section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.manage-subtab').forEach(t => t.classList.remove('subtab-active', 'text-slate-500'));
    document.getElementById(`manage-${id}`).classList.remove('hidden');
    document.getElementById(`btn-manage-${id}`).classList.add('subtab-active');
    document.getElementById(`btn-manage-${id}`).classList.remove('text-slate-500');
};

export const updateTopIndicator = (isAuthenticated) => {
    const dot = document.getElementById('main-db-dot');
    const text = document.getElementById('main-db-text');
    const loginDot = document.getElementById('db-indicator');
    const loginText = document.getElementById('db-status');

    if (isAuthenticated && navigator.onLine) {
        if(dot) { dot.className = 'w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]'; text.innerText = 'Online'; }
        if(loginDot) { loginDot.classList.replace('bg-slate-300', 'bg-green-500'); loginText.innerText = "Conectado a Firebase"; loginText.classList.replace('text-slate-400', 'text-green-600'); }
    } else {
        if(dot) { dot.className = 'w-2 h-2 rounded-full bg-red-500 shadow-[0_0_5px_#ef4444]'; text.innerText = 'Offline'; }
        if(loginDot) { loginDot.classList.replace('bg-green-500', 'bg-slate-300'); loginText.innerText = "En espera"; loginText.classList.replace('text-green-600', 'text-slate-400'); }
    }
};
