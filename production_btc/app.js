// ⚙️ UI CONFIGURATION AREA
const UI_CONFIG = {
    logoUrl: "logo_babla.jpeg",
    coverUrl: "background.jpeg"
};

// 🚀 GOOGLE APPS SCRIPT URL HERE
const APP_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzzDmV_dfSvOR0ushUNDSoPE0FvY77zKozxskbwtQdVqFQ2-VWmEZckVAalFyujm_An0w/exec";

// Apply UI Config
document.getElementById('brandLogo').src = UI_CONFIG.logoUrl;
document.getElementById('navLogo').src = UI_CONFIG.logoUrl;
document.getElementById('brandCover').src = UI_CONFIG.coverUrl;

// Global State
let candidates = [];
let isDarkMode = false;
let currentViewMode = 'grid'; // Default view state

const DOM = {
    login: document.getElementById('loginScreen'),
    app: document.getElementById('mainApp'),
    welcome: document.getElementById('welcomeView'),
    viewer: document.getElementById('viewerView'),
    list: document.getElementById('studentList'),
    apiLoader: document.getElementById('apiLoadingIndicator'),
    searchInput: document.getElementById('searchInput'),
    searchType: document.getElementById('searchType'),
    overlay: document.getElementById('modalOverlay'),
    toastContainer: document.getElementById('toastContainer'),
    loginBtnText: document.getElementById('loginBtnText'),
    loginBtnSpinner: document.getElementById('loginBtnSpinner')
};

// --- Theme & Toggles ---
document.addEventListener('DOMContentLoaded', () => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) toggleTheme(true);
});

function toggleTheme(forceDark = null) {
    isDarkMode = forceDark !== null ? forceDark : !isDarkMode;
    document.documentElement.classList.toggle('dark', isDarkMode);

    const iconHTML = isDarkMode
        ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>' 
        : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>'; 

    document.getElementById('themeIconNav').innerHTML = iconHTML;
}

// --- View Mode Toggle (Grid/List) ---
function setViewMode(mode) {
    currentViewMode = mode;
    const btnGrid = document.getElementById('btnGrid');
    const btnList = document.getElementById('btnList');
    
    // Reset classes
    btnGrid.className = "p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300";
    btnList.className = "p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300";
    
    // Apply active styling
    if(mode === 'grid') {
        btnGrid.className = "p-1.5 rounded-md bg-white dark:bg-slate-700 shadow-sm text-brand-600 dark:text-brand-400";
        DOM.list.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pb-8";
    } else {
        btnList.className = "p-1.5 rounded-md bg-white dark:bg-slate-700 shadow-sm text-brand-600 dark:text-brand-400";
        DOM.list.className = "flex flex-col gap-3 overflow-y-auto pb-8 max-w-4xl mx-auto w-full";
    }
    
    // Re-render to ensure layout fits perfectly
    renderList(DOM.searchInput.value);
}

// --- Core Interactions ---
DOM.searchInput.addEventListener('input', (e) => renderList(e.target.value));

document.getElementById('formDob').addEventListener('change', function () {
    const dob = new Date(this.value);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--;
    document.getElementById('formAge').value = age > 0 ? age : 0;
});

function togglePassword() {
    const input = document.getElementById('passwordInput');
    const eye = document.getElementById('eyeIcon');
    if (input.type === 'password') {
        input.type = 'text';
        eye.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path>';
    } else {
        input.type = 'password';
        eye.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>';
    }
}

function handleLogin(e) {
    e.preventDefault();
    
    // Show Loading Spinner on Button
    DOM.loginBtnText.classList.add('hidden');
    DOM.loginBtnSpinner.classList.remove('hidden');

    setTimeout(() => {
        // Remove spinner
        DOM.loginBtnText.classList.remove('hidden');
        DOM.loginBtnSpinner.classList.add('hidden');
        
        // Show Success Toast
        showToast("Login Successful! Welcome back.", "success");

        // Transition UI
        DOM.login.style.opacity = '0';
        setTimeout(() => {
            DOM.login.classList.add('hidden');
            DOM.app.classList.remove('hidden');
            fetchDatabaseData();
        }, 300);
    }, 800); // 800ms fake loading delay
}

function logout() {
    DOM.app.classList.add('hidden');
    DOM.login.classList.remove('hidden');
    setTimeout(() => DOM.login.style.opacity = '1', 50);
    showWelcome();
}

function showWelcome() { DOM.viewer.classList.add('hidden'); DOM.welcome.classList.remove('hidden'); }
function showViewer() { DOM.welcome.classList.add('hidden'); DOM.viewer.classList.remove('hidden'); DOM.viewer.classList.add('flex'); }

let activeModal = null;
function openModal(modalId) {
    if (activeModal) closeModal(activeModal);
    DOM.overlay.classList.replace('overlay-hidden', 'overlay-visible');
    document.getElementById(modalId).classList.replace('modal-hidden', 'modal-visible');
    activeModal = modalId;
}
function closeModal(modalId) {
    document.getElementById(modalId).classList.replace('modal-visible', 'modal-hidden');
    setTimeout(() => { if (activeModal === modalId) { DOM.overlay.classList.replace('overlay-visible', 'overlay-hidden'); activeModal = null; } }, 300);
}

// --- Custom Toast Notification ---
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const bgClass = type === 'error' ? 'bg-red-600' : (type === 'success' ? 'bg-green-600' : 'bg-slate-800 dark:bg-brand-600');
    toast.className = `toast-enter ${bgClass} text-white px-6 py-3 rounded-lg shadow-xl font-medium text-sm flex items-center gap-3`;
    toast.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> <span>${message}</span>`;

    DOM.toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- API & Data Handling ---
async function fetchDatabaseData(selectedSheet = "Main Recoreds") {
    if (APP_SCRIPT_URL === "YOUR_WEB_APP_URL_HERE") return;
    DOM.list.innerHTML = '';
    DOM.apiLoader.classList.remove('hidden'); DOM.apiLoader.classList.add('flex');
    try {
        const response = await fetch(`${APP_SCRIPT_URL}?sheet=${encodeURIComponent(selectedSheet)}`);
        const result = await response.json();
        if (result.status === "success") {
            candidates = result.data.reverse(); 
            renderList(DOM.searchInput.value);
        } else {
            showToast(result.message, 'error');
        }
    } catch (error) {
        console.error(error);
        showToast("Failed to connect to Google Cloud.", 'error');
    } finally {
        DOM.apiLoader.classList.add('hidden'); DOM.apiLoader.classList.remove('flex');
    }
}

// FEATURE FLAG IMPLEMENTATION
async function handleCreateSheet() {
    const name = document.getElementById('newSheetName').value.trim();
    if (!name) return;

    closeModal('createSheetModal');
    openModal('loadingModal');

    try {
        const response = await fetch(APP_SCRIPT_URL, {
            method: "POST", body: JSON.stringify({ action: "CREATE_SHEET", sheetName: name }), headers: { "Content-Type": "text/plain" }
        });
        const result = await response.json();

        closeModal('loadingModal');
        setTimeout(() => {
            if (result.status === "error") {
                showToast(result.message, 'info'); // "Upcoming Feature"
            } else {
                showToast("Batch created successfully!", 'success');
            }
        }, 300);

    } catch (e) {
        closeModal('loadingModal');
        showToast("Connection failed.", 'error');
    }
}

function renderList(filterText = '') {
    DOM.list.innerHTML = '';
    
    const searchType = DOM.searchType.value;
    const cleanFilter = filterText.toLowerCase().trim();

    // Safely cast to string to prevent ".toLowerCase() is not a function" crash on numeric IDs/Names
    const filtered = candidates.filter(c => {
        if (!cleanFilter) return true;
        
        const idStr = String(c[0] || '').toLowerCase();
        const nameStr = String(c[1] || '').toLowerCase();
        
        if (searchType === 'name') return nameStr.includes(cleanFilter);
        if (searchType === 'id') return idStr.includes(cleanFilter);
        
        return nameStr.includes(cleanFilter) || idStr.includes(cleanFilter);
    });

    if (filtered.length === 0) {
        DOM.list.innerHTML = `<div class="col-span-full text-center text-slate-500 py-8">No records found matching your search.</div>`;
        return;
    }

    filtered.forEach(c => {
        const dpUrl = c[7] && c[7].startsWith('http') ? c[7] : `https://ui-avatars.com/api/?name=${encodeURIComponent(c[1])}&background=0D8ABC&color=fff`;

        const card = document.createElement('div');
        // Slightly modify card styling based on view mode
        card.className = currentViewMode === 'grid' 
            ? 'bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-brand-500 dark:hover:border-brand-500 transition-all flex items-center gap-4 group'
            : 'bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-brand-500 dark:hover:border-brand-500 transition-all flex items-center gap-4 group w-full';
        
        card.onclick = () => openDetails(c[0]);

        card.innerHTML = `
            <img src="${dpUrl}" class="w-12 h-12 rounded-full object-cover border-2 border-slate-100 dark:border-slate-700 group-hover:border-brand-300 transition-colors shrink-0">
            <div class="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
                <div class="min-w-0">
                    <h4 class="font-bold text-slate-800 dark:text-white text-base truncate">${c[1]}</h4>
                    <div class="flex items-center gap-2 mt-0.5 sm:hidden">
                        <span class="text-[10px] font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 truncate">${c[0]}</span>
                    </div>
                </div>
                <div class="flex items-center gap-3 shrink-0">
                    <span class="text-xs text-slate-500 hidden sm:inline-block">${c[2]} yrs</span>
                    <span class="hidden sm:inline-block text-[10px] font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md text-slate-600 dark:text-slate-300 truncate">${c[0]}</span>
                    <div class="text-slate-300 group-hover:text-brand-500 transition-colors hidden md:block">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                    </div>
                </div>
            </div>
        `;
        DOM.list.appendChild(card);
    });
}

// --- Modern Profile Detailed View ---
function openDetails(id) {
    const c = candidates.find(can => can[0] === id);
    if (!c) return;

    const modal = document.getElementById('detailsModal');
    const dpUrl = c[7] && c[7].startsWith('http') ? c[7] : `https://ui-avatars.com/api/?name=${encodeURIComponent(c[1])}&background=0D8ABC&color=fff`;

    let docButtonHtml = '';
    if (c[8] && c[8].startsWith('http')) {
        docButtonHtml = `<a href="${c[8]}" target="_blank" class="w-full mt-6 flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 font-bold hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors border border-brand-200 dark:border-brand-800">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    View Verification Document
                </a>`;
    }

    modal.innerHTML = `
        <div class="relative h-32 bg-gradient-to-r from-brand-600 to-teal-800 shrink-0">
            <button onclick="closeModal('detailsModal')" class="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 rounded-full text-white transition-colors backdrop-blur-sm"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
        </div>
        
        <div class="px-8 pb-8 relative">
            <div class="flex flex-col sm:flex-row gap-4 sm:items-end -mt-12 mb-6">
                <img src="${dpUrl}" class="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-slate-800 shadow-lg bg-white shrink-0">
                <div class="pb-1 overflow-hidden">
                    <h2 class="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white leading-tight truncate">${c[1]}</h2>
                    <span class="inline-block mt-1 font-mono text-xs font-semibold bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400 px-2.5 py-0.5 rounded-full border border-brand-200 dark:border-brand-800">${c[0]}</span>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
                <div class="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Age & DOB</p>
                    <p class="font-semibold text-slate-800 dark:text-white">${c[2]} Years <span class="text-slate-400 font-normal text-sm ml-1">(${c[3]})</span></p>
                </div>
                <div class="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Contact No.</p>
                    <p class="font-semibold text-slate-800 dark:text-white">${c[4]}</p>
                </div>
                <div class="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-100 dark:border-slate-700 col-span-2">
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Guardian Name</p>
                    <p class="font-semibold text-slate-800 dark:text-white">${c[6]}</p>
                </div>
                <div class="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-100 dark:border-slate-700 col-span-2">
                    <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Full Address</p>
                    <p class="font-semibold text-slate-800 dark:text-white text-sm leading-relaxed">${c[5]}</p>
                </div>
            </div>
            
            ${docButtonHtml}
            
            <div class="text-center mt-6 text-[10px] text-slate-400 uppercase tracking-widest">
                Registered: ${c[9]}
            </div>
        </div>
    `;
    openModal('detailsModal');
}

// --- File Upload Logic ---
const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

async function submitForm(e) {
    e.preventDefault();

    const payload = {
        targetSheet: "Main Recoreds",
        id: document.getElementById('formId').value,
        name: document.getElementById('formName').value,
        dob: document.getElementById('formDob').value,
        age: document.getElementById('formAge').value,
        contact: document.getElementById('formContact').value,
        guardian: document.getElementById('formGuardian').value,
        address: document.getElementById('formAddress').value,
        photoBase64: null, photoMimeType: null,
        docBase64: null, docMimeType: null
    };

    closeModal('addModal');
    openModal('loadingModal');

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
            method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "text/plain" }
        });

        const result = await response.json();
        if (result.status === "error") throw new Error(result.message);

        closeModal('loadingModal');
        setTimeout(() => openModal('successModal'), 300);
        document.getElementById('addForm').reset();
        fetchDatabaseData();

    } catch (error) {
        closeModal('loadingModal');
        showToast("Upload Error: " + error.message, 'error');
    }
}