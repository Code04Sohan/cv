// --- Dummy Data ---
const candidates = Array.from({ length: 25 }, (_, i) => ({
    id: `BAHA-2026-${(i + 1).toString().padStart(4, '0')}`,
    name: `Student Name ${i + 1}`,
    age: Math.floor(Math.random() * (45 - 18 + 1)) + 18,
    dob: `19${Math.floor(Math.random() * (99 - 80) + 80)}-05-15`,
    contact: `+91 98765 432${(i % 10).toString().padStart(2, '0')}`,
    address: `${Math.floor(Math.random() * 100) + 1} Main Street, Tech Park Area, City Center`,
    photoUrl: `https://i.pravatar.cc/150?u=${i}`,
    docStatus: 'Uploaded Verified'
}));

// --- DOM Elements ---
const listContainer = document.getElementById('candidateList');
const emptyState = document.getElementById('emptyState');
const detailsView = document.getElementById('detailsView');
const addFormView = document.getElementById('addFormView');
const loadingOverlay = document.getElementById('loadingOverlay');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    renderList();
});

// --- Core Functions ---
function renderList() {
    listContainer.innerHTML = '';
    candidates.forEach(candidate => {
        const card = document.createElement('div');
        card.className = 'p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all duration-200 flex flex-col group';
        card.onclick = () => loadCandidateDetails(candidate.id);
        
        card.innerHTML = `
            <div class="flex justify-between items-start mb-1">
                <span class="font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors truncate pr-2">${candidate.name}</span>
                <span class="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">${candidate.id}</span>
            </div>
            <div class="text-sm text-slate-500">
                Age: <span class="font-medium text-slate-700">${candidate.age}</span> yrs
            </div>
        `;
        listContainer.appendChild(card);
    });
}

function loadCandidateDetails(id) {
    showLoading();
    
    // Simulate network delay for UX
    setTimeout(() => {
        const candidate = candidates.find(c => c.id === id);
        if (!candidate) return;

        detailsView.innerHTML = `
            <div class="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
                <h2 class="text-2xl font-bold text-slate-800">Candidate Profile</h2>
                <span class="px-3 py-1 bg-green-100 text-green-800 text-sm font-semibold rounded-full">Active</span>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div class="md:col-span-1 flex flex-col items-center">
                    <img src="${candidate.photoUrl}" alt="Profile" class="w-40 h-40 rounded-xl object-cover shadow-md border-4 border-white">
                    <h3 class="mt-4 font-bold text-xl text-center text-slate-800">${candidate.name}</h3>
                    <p class="text-slate-500 font-mono text-sm">${candidate.id}</p>
                </div>

                <div class="md:col-span-2 space-y-4">
                    <div class="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <div>
                            <p class="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Age</p>
                            <p class="text-slate-800 font-medium">${candidate.age} Years</p>
                        </div>
                        <div>
                            <p class="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Date of Birth</p>
                            <p class="text-slate-800 font-medium">${candidate.dob}</p>
                        </div>
                        <div>
                            <p class="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Contact</p>
                            <p class="text-slate-800 font-medium">${candidate.contact}</p>
                        </div>
                        <div>
                            <p class="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Document Status</p>
                            <p class="text-indigo-600 font-medium flex items-center gap-1">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                ${candidate.docStatus}
                            </p>
                        </div>
                    </div>
                    
                    <div class="bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <p class="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Full Address</p>
                        <p class="text-slate-800">${candidate.address}</p>
                    </div>
                </div>
            </div>
        `;
        
        switchView('details');
        hideLoading();
    }, 400); // 400ms fake loading
}

// --- View Management ---
function showAddForm() {
    switchView('form');
}

function showEmptyState() {
    switchView('empty');
}

function switchView(view) {
    emptyState.classList.add('hidden');
    detailsView.classList.add('hidden');
    addFormView.classList.add('hidden');

    if (view === 'empty') emptyState.classList.remove('hidden');
    if (view === 'details') detailsView.classList.remove('hidden');
    if (view === 'form') {
        addFormView.classList.remove('hidden');
        document.getElementById('candidateForm').reset();
    }
}

// --- UI Helpers ---
function showLoading() {
    loadingOverlay.classList.remove('hidden');
    loadingOverlay.classList.add('flex');
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
    loadingOverlay.classList.remove('flex');
}

function handleFormSubmit(e) {
    e.preventDefault();
    showLoading();
    
    // Simulate GAS submission delay
    setTimeout(() => {
        hideLoading();
        alert('Candidate Saved Successfully to Database!');
        showEmptyState();
    }, 1200);
}