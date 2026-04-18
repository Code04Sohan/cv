// --- Dummy Data ---
const candidates = Array.from({ length: 20 }, (_, i) => ({
    id: `BAHA-2026-${(i + 1).toString().padStart(4, '0')}`,
    name: `Student Name ${i + 1}`,
    age: Math.floor(Math.random() * 20) + 18,
    dob: `200${Math.floor(Math.random() * 9)}-05-15`,
    contact: `+91 98765 432${(i % 10).toString().padStart(2, '0')}`,
    photoUrl: `https://i.pravatar.cc/150?u=${i}`
}));

// --- State Variables ---
let showIds = true;
let isDarkMode = false;
let menuOpen = false;

// --- DOM Elements ---
const DOM = {
    login: document.getElementById('loginScreen'),
    app: document.getElementById('mainApp'),
    welcome: document.getElementById('welcomeView'),
    viewer: document.getElementById('viewerView'),
    list: document.getElementById('studentList'),
    searchInput: document.getElementById('searchInput'),
    overlay: document.getElementById('modalOverlay'),
    menu: document.getElementById('dropdownMenu'),
    idToggleKnob: document.getElementById('idToggleKnob'),
    idToggleBtn: document.getElementById('idToggle')
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Check system preference for dark mode
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        toggleTheme(true);
    }
    
    // Attach search listener
    DOM.searchInput.addEventListener('input', (e) => renderList(e.target.value));
});

// --- Auth & Navigation ---
function handleLogin(e) {
    e.preventDefault();
    DOM.login.style.opacity = '0';
    setTimeout(() => {
        DOM.login.classList.add('hidden');
        DOM.app.classList.remove('hidden');
        DOM.app.style.opacity = '0';
        requestAnimationFrame(() => {
            DOM.app.style.transition = 'opacity 0.5s ease';
            DOM.app.style.opacity = '1';
        });
    }, 500);
}

function logout() {
    DOM.menu.classList.remove('opacity-100', 'pointer-events-auto');
    DOM.menu.classList.add('opacity-0', 'pointer-events-none');
    menuOpen = false;
    
    DOM.app.classList.add('hidden');
    DOM.login.classList.remove('hidden');
    DOM.login.style.opacity = '1';
    DOM.welcome.classList.remove('hidden');
    DOM.viewer.classList.add('hidden');
}

function showWelcome() {
    DOM.viewer.classList.add('hidden');
    DOM.welcome.classList.remove('hidden');
    DOM.welcome.style.animation = 'fadeIn 0.3s ease forwards';
}

function showViewer() {
    DOM.welcome.classList.add('hidden');
    DOM.viewer.classList.remove('hidden');
    DOM.viewer.classList.add('flex');
    renderList();
}

// --- Theme & Toggles ---
function toggleMenu() {
    menuOpen = !menuOpen;
    if (menuOpen) {
        DOM.menu.classList.remove('opacity-0', 'pointer-events-none');
        DOM.menu.classList.add('opacity-100', 'pointer-events-auto');
    } else {
        DOM.menu.classList.remove('opacity-100', 'pointer-events-auto');
        DOM.menu.classList.add('opacity-0', 'pointer-events-none');
    }
}

function toggleTheme(forceDark = null) {
    isDarkMode = forceDark !== null ? forceDark : !isDarkMode;
    document.documentElement.classList.toggle('dark', isDarkMode);
    document.getElementById('themeIcon').textContent = isDarkMode ? '☀️' : '🌙';
    document.getElementById('themeText').textContent = isDarkMode ? 'Light Mode' : 'Dark Mode';
    if(menuOpen) toggleMenu();
}

function toggleIds() {
    showIds = !showIds;
    
    if (showIds) {
        DOM.idToggleBtn.classList.replace('bg-slate-300', 'bg-indigo-600');
        DOM.idToggleKnob.classList.replace('translate-x-0', '-translate-x-6'); // Move left based on standard layout
        DOM.list.classList.remove('hide-ids');
    } else {
        DOM.idToggleBtn.classList.replace('bg-indigo-600', 'bg-slate-300');
        DOM.idToggleBtn.classList.add('dark:bg-slate-600');
        DOM.idToggleKnob.classList.replace('-translate-x-6', 'translate-x-0');
        DOM.list.classList.add('hide-ids');
    }
}

// Initialize Knob position correctly
DOM.idToggleKnob.classList.add('-translate-x-6'); 

// --- List & Data Rendering ---
function renderList(filterText = '') {
    DOM.list.innerHTML = '';
    const filtered = candidates.filter(c => c.name.toLowerCase().includes(filterText.toLowerCase()));
    
    filtered.forEach(c => {
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all flex items-center gap-4';
        card.onclick = () => openDetails(c.id);
        
        card.innerHTML = `
            <img src="${c.photoUrl}" class="w-12 h-12 rounded-full object-cover border-2 border-slate-100 dark:border-slate-700">
            <div class="flex-1 min-w-0">
                <h4 class="font-bold truncate">${c.name}</h4>
                <div class="flex items-center gap-2 mt-0.5">
                    <span class="text-xs text-slate-500">${c.age} yrs</span>
                    <span class="id-badge text-[10px] font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 truncate">${c.id}</span>
                </div>
            </div>
        `;
        DOM.list.appendChild(card);
    });
}

function openDetails(id) {
    const c = candidates.find(can => can.id === id);
    const modal = document.getElementById('detailsModal');
    
    modal.innerHTML = `
        <div class="bg-gradient-to-r from-indigo-600 to-blue-700 p-8 flex justify-between items-start text-white">
            <div class="flex items-center gap-5">
                <img src="${c.photoUrl}" class="w-20 h-20 rounded-full object-cover border-4 border-white/20 shadow-xl">
                <div>
                    <h2 class="text-3xl font-extrabold tracking-tight">${c.name}</h2>
                    <span class="inline-block mt-1 font-mono text-sm bg-black/20 px-2 py-0.5 rounded backdrop-blur-sm border border-white/10">${c.id}</span>
                </div>
            </div>
            <button onclick="closeModal('detailsModal')" class="p-2 bg-black/10 hover:bg-black/20 rounded-lg transition-colors"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
        </div>
        <div class="p-8 space-y-6">
            <div class="grid grid-cols-2 gap-4">
                <div class="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                    <p class="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Age</p>
                    <p class="font-semibold text-lg">${c.age} Years</p>
                </div>
                <div class="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                    <p class="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Date of Birth</p>
                    <p class="font-semibold text-lg">${c.dob}</p>
                </div>
                <div class="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-100 dark:border-slate-700 col-span-2">
                    <p class="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Primary Contact</p>
                    <p class="font-semibold text-lg">${c.contact}</p>
                </div>
            </div>
        </div>
    `;
    openModal('detailsModal');
}

// --- Modal Management ---
let activeModal = null;

function openModal(modalId) {
    if (activeModal) closeModal(activeModal);
    
    DOM.overlay.classList.replace('overlay-hidden', 'overlay-visible');
    const modal = document.getElementById(modalId);
    modal.classList.replace('modal-hidden', 'modal-visible');
    activeModal = modalId;
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.replace('modal-visible', 'modal-hidden');
    
    // Only hide overlay if we aren't immediately opening another modal (like success)
    setTimeout(() => {
        if (activeModal === modalId) {
            DOM.overlay.classList.replace('overlay-visible', 'overlay-hidden');
            activeModal = null;
        }
    }, 300);
}

// --- Form Submission Flow ---
function submitForm(e) {
    e.preventDefault();
    
    // 1. Hide Add Modal, Show Loading Modal
    closeModal('addModal');
    setTimeout(() => openModal('loadingModal'), 300);
    
    // 2. Simulate Network Request
    setTimeout(() => {
        closeModal('loadingModal');
        // 3. Show Success Modal
        setTimeout(() => {
            openModal('successModal');
            document.getElementById('addForm').reset();
        }, 300);
    }, 2000);
}
