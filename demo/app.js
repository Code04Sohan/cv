// 🚀 PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE:
const APP_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzzDmV_dfSvOR0ushUNDSoPE0FvY77zKozxskbwtQdVqFQ2-VWmEZckVAalFyujm_An0w/exec";

// Global State
let candidates = [];
let showIds = true;
let isDarkMode = false;
let menuOpen = false;

const DOM = {
    login: document.getElementById('loginScreen'),
    app: document.getElementById('mainApp'),
    welcome: document.getElementById('welcomeView'),
    viewer: document.getElementById('viewerView'),
    list: document.getElementById('studentList'),
    apiLoader: document.getElementById('apiLoadingIndicator'),
    searchInput: document.getElementById('searchInput'),
    overlay: document.getElementById('modalOverlay'),
    menu: document.getElementById('dropdownMenu'),
    idToggleKnob: document.getElementById('idToggleKnob'),
    idToggleBtn: document.getElementById('idToggle')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) toggleTheme(true);
    DOM.searchInput.addEventListener('input', (e) => renderList(e.target.value));

    // Age Auto-Calculator
    document.getElementById('formDob').addEventListener('change', function () {
        const dob = new Date(this.value);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) {
            age--;
        }
        document.getElementById('formAge').value = age > 0 ? age : 0;
    });

    if (window.innerWidth < 768) DOM.idToggleKnob.classList.add('-translate-x-[16px]');
    else DOM.idToggleKnob.classList.add('-translate-x-[20px]');
});

// --- Core API Logic (GET & POST) ---

async function fetchDatabaseData() {
    if (APP_SCRIPT_URL === "YOUR_WEB_APP_URL_HERE") {
        alert("Developer Notice: Please insert your Google Apps Script URL in the code to fetch live data.");
        return;
    }

    DOM.list.innerHTML = '';
    DOM.apiLoader.classList.remove('hidden');
    DOM.apiLoader.classList.add('flex');

    try {
        const response = await fetch(APP_SCRIPT_URL);
        const result = await response.json();

        if (result.status === "success") {
            // Reverse to show newest entries first
            candidates = result.data.reverse();
            renderList();
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        DOM.list.innerHTML = `<div class="col-span-full text-center text-red-500 p-8 bg-red-50 dark:bg-red-900/20 rounded-xl">Error connecting to cloud database: ${error.message}</div>`;
    } finally {
        DOM.apiLoader.classList.add('hidden');
        DOM.apiLoader.classList.remove('flex');
    }
}

const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

async function submitForm(e) {
    e.preventDefault();

    if (APP_SCRIPT_URL === "YOUR_WEB_APP_URL_HERE") {
        alert("Developer Notice: Web App URL is missing. Cannot upload to Google Drive.");
        return;
    }

    const payload = {
        id: document.getElementById('formId').value,
        name: document.getElementById('formName').value,
        dob: document.getElementById('formDob').value,
        age: document.getElementById('formAge').value,
        contact: document.getElementById('formContact').value,
        address: document.getElementById('formAddress').value,
        guardian: document.getElementById('formGuardian').value,
        photoBase64: null,
        photoMimeType: null,
        docBase64: null,
        docMimeType: null
    };

    closeModal('addModal');
    setTimeout(() => openModal('loadingModal'), 300);

    try {
        const photoFile = document.getElementById('formPhoto').files[0];
        if (photoFile) {
            payload.photoBase64 = await toBase64(photoFile);
            payload.photoMimeType = photoFile.type;
        }

        const docFile = document.getElementById('formDoc').files[0];
        if (docFile) {
            payload.docBase64 = await toBase64(docFile);
            payload.docMimeType = docFile.type;
        }

        const response = await fetch(APP_SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify(payload),
            headers: { "Content-Type": "text/plain;charset=utf-8" }
        });

        const result = await response.json();

        if (result.status === "error") throw new Error(result.message);

        closeModal('loadingModal');
        setTimeout(() => {
            openModal('successModal');
            document.getElementById('addForm').reset();
            // Optional: Fetch data again to reflect the new entry in the list
            // fetchDatabaseData(); 
        }, 300);

    } catch (error) {
        alert("Database Upload Error: " + error.message);
        closeModal('loadingModal');
    }
}

// --- UI & Rendering Logic ---

function renderList(filterText = '') {
    DOM.list.innerHTML = '';

    if (candidates.length === 0) {
        DOM.list.innerHTML = `<div class="col-span-full text-center text-slate-500 p-8">No records found in the database.</div>`;
        return;
    }

    const filtered = candidates.filter(c => c.name.toLowerCase().includes(filterText.toLowerCase()) || c.id.toLowerCase().includes(filterText.toLowerCase()));

    filtered.forEach(c => {
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-slate-800 p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all flex items-center gap-3 md:gap-4';
        card.onclick = () => openDetails(c.id);

        // Fallback avatar if no photo exists
        const avatar = c.photoUrl && c.photoUrl.startsWith('http') ? c.photoUrl : `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=random`;

        card.innerHTML = `
                    <img src="${avatar}" class="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover border-2 border-slate-100 dark:border-slate-700 shrink-0">
                    <div class="flex-1 min-w-0">
                        <h4 class="font-bold text-sm md:text-base truncate">${c.name}</h4>
                        <div class="flex items-center gap-2 mt-0.5">
                            <span class="text-[10px] md:text-xs text-slate-500">${c.age} yrs</span>
                            <span class="id-badge text-[9px] md:text-[10px] font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 truncate">${c.id}</span>
                        </div>
                    </div>
                `;
        DOM.list.appendChild(card);
    });
}

function openDetails(id) {
    const c = candidates.find(can => can.id === id);
    const modal = document.getElementById('detailsModal');
    const avatar = c.photoUrl && c.photoUrl.startsWith('http') ? c.photoUrl : `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=random`;

    let docButtonHtml = '';
    if (c.docUrl && c.docUrl.startsWith('http')) {
        docButtonHtml = `<a href="${c.docUrl}" target="_blank" class="col-span-2 block mt-2 text-center py-2.5 rounded-lg bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-200 dark:border-indigo-800 text-sm">View Linked Verification Document</a>`;
    }

    modal.innerHTML = `
                <div class="bg-gradient-to-r from-indigo-600 to-blue-700 p-5 md:p-8 flex justify-between items-start text-white shrink-0">
                    <div class="flex items-center gap-4 md:gap-5">
                        <img src="${avatar}" class="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-4 border-white/20 shadow-xl shrink-0">
                        <div class="min-w-0">
                            <h2 class="text-xl md:text-3xl font-extrabold tracking-tight truncate">${c.name}</h2>
                            <span class="inline-block mt-1 md:mt-1.5 font-mono text-xs md:text-sm bg-black/20 px-2 py-0.5 rounded backdrop-blur-sm border border-white/10">${c.id}</span>
                        </div>
                    </div>
                    <button onclick="closeModal('detailsModal')" class="p-1.5 md:p-2 bg-black/10 hover:bg-black/20 rounded-lg transition-colors shrink-0"><svg class="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                </div>
                <div class="p-5 md:p-8 space-y-4 md:space-y-6 overflow-y-auto custom-scrollbar">
                    <div class="grid grid-cols-2 gap-3 md:gap-4">
                        <div class="bg-slate-50 dark:bg-slate-900/60 p-3 md:p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                            <p class="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5 md:mb-1">Age</p>
                            <p class="font-semibold text-sm md:text-lg">${c.age} Years</p>
                        </div>
                        <div class="bg-slate-50 dark:bg-slate-900/60 p-3 md:p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                            <p class="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5 md:mb-1">Date of Birth</p>
                            <p class="font-semibold text-sm md:text-lg">${c.dob}</p>
                        </div>
                        <div class="bg-slate-50 dark:bg-slate-900/60 p-3 md:p-4 rounded-xl border border-slate-100 dark:border-slate-700 col-span-2">
                            <p class="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5 md:mb-1">Contact No.</p>
                            <p class="font-semibold text-sm md:text-lg">${c.contact}</p>
                        </div>
                        <div class="bg-slate-50 dark:bg-slate-900/60 p-3 md:p-4 rounded-xl border border-slate-100 dark:border-slate-700 col-span-2">
                            <p class="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5 md:mb-1">Full Address</p>
                            <p class="font-semibold text-sm md:text-base">${c.address}</p>
                        </div>
                        <div class="bg-slate-50 dark:bg-slate-900/60 p-3 md:p-4 rounded-xl border border-slate-100 dark:border-slate-700 col-span-2">
                            <p class="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5 md:mb-1">Guardian Name</p>
                            <p class="font-semibold text-sm md:text-base">${c.guardian}</p>
                        </div>
                        ${docButtonHtml}
                        <div class="col-span-2 text-center text-[10px] text-slate-400 mt-2">Database Entry: ${c.timestamp}</div>
                    </div>
                </div>
            `;
    openModal('detailsModal');
}

// --- Navigation & Overlays ---

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
    if (menuOpen) toggleMenu();
    DOM.app.classList.add('hidden');
    DOM.login.classList.remove('hidden');
    DOM.login.style.opacity = '1';
    showWelcome();
}

function showWelcome() {
    DOM.viewer.classList.add('hidden');
    DOM.welcome.classList.remove('hidden');
}

function showViewer() {
    DOM.welcome.classList.add('hidden');
    DOM.viewer.classList.remove('hidden');
    DOM.viewer.classList.add('flex');
    fetchDatabaseData();
}

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
    document.getElementById('themeIconHeader').textContent = isDarkMode ? '☀️' : '🌙';
    document.getElementById('themeText').textContent = isDarkMode ? 'Light Mode' : 'Dark Mode';
    if (menuOpen) toggleMenu();
}

function toggleIds() {
    showIds = !showIds;
    if (showIds) {
        DOM.idToggleBtn.classList.replace('bg-slate-300', 'bg-indigo-600');
        DOM.idToggleBtn.classList.remove('dark:bg-slate-600');
        DOM.idToggleKnob.classList.replace('translate-x-0', window.innerWidth < 768 ? '-translate-x-[16px]' : '-translate-x-[20px]');
        DOM.list.classList.remove('hide-ids');
    } else {
        DOM.idToggleBtn.classList.replace('bg-indigo-600', 'bg-slate-300');
        DOM.idToggleBtn.classList.add('dark:bg-slate-600');
        DOM.idToggleKnob.classList.replace('-translate-x-[20px]', 'translate-x-0');
        DOM.idToggleKnob.classList.replace('-translate-x-[16px]', 'translate-x-0');
        DOM.list.classList.add('hide-ids');
    }
}

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
    setTimeout(() => {
        if (activeModal === modalId) {
            DOM.overlay.classList.replace('overlay-visible', 'overlay-hidden');
            activeModal = null;
        }
    }, 300);
}