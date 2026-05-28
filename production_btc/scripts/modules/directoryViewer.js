/**
 * ==========================================
 * 🗂️ ADMIN DIRECTORY VIEWER (directoryViewer.js)
 * ==========================================
 * High-Speed Data Table Module for Backend Integration
 */
window.DirectoryViewerModule = (function () {
    'use strict';

    let _container = null;
    let _directoryData = [];
    let _filteredData = [];

    const SCHEMA = [
        'STUDENT_ID', 'RL_NO', 'SESSION', 'DATE_OF_ADMISSION', 'ENROLLED_COURSE', 'CLASS_BATCH_DAYS', 
        'STUDENT_NAME', 'DOB', 'GENDER', 'BLOOD_GROUP', 'STUDENT_AADHAR', 'CATEGORY', 'STUDENT_MOBILE', 
        'PHYSICAL_DISABILITY', 'FATHER_NAME', 'FATHER_MOBILE', 'MOTHER_NAME', 'MOTHER_MOBILE', 
        'GUARDIAN_RELATION', 'GUARDIAN_NAME', 'GUARDIAN_MOBILE', 'DECLARATION_1', 'DECLARATION_2', 
        'PAYABLE_AMOUNT', 'IS_FEE_PAID', 'PAYMENT_MODE', 'TXN_ID', 'STUDENT_PHOTO_URL', 
        'STUDENT_SIGNATURE_URL', 'RELIGION', 'TIMESTAMP'
    ];

    /**
     * Mounts the viewer into the DOM container
     */
    async function mount(container) {
        _container = container;
        _container.innerHTML = buildShellHTML();
        attachCoreListeners();
        await fetchDirectory();
    }

    /**
     * Builds the main structural UI
     */
    function buildShellHTML() {
        return `
            <div class="space-y-6">
                <!-- Header & Search -->
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <div>
                        <h1 class="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <svg class="w-6 h-6 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                            Directory Viewer
                        </h1>
                        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage all active enrollments</p>
                    </div>
                    
                    <div class="w-full md:w-96 relative">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg class="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        </div>
                        <input type="text" id="dir_search_input" placeholder="Search by Name, ID, or Phone..."
                            class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all shadow-inner">
                    </div>
                </div>

                <!-- Data Table Container -->
                <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse whitespace-nowrap min-w-[800px]">
                            <thead>
                                <tr class="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    <th class="px-6 py-4">Candidate</th>
                                    <th class="px-6 py-4">Student ID</th>
                                    <th class="px-6 py-4">Course</th>
                                    <th class="px-6 py-4">Mobile</th>
                                    <th class="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="dir_table_body" class="divide-y divide-slate-100 dark:divide-slate-800">
                                <!-- Populated dynamically -->
                                <tr>
                                    <td colspan="5" class="px-6 py-16 text-center text-slate-500">
                                        <svg class="animate-spin h-8 w-8 mx-auto text-brand-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        <p class="font-medium animate-pulse">Fetching records from cloud...</p>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Modals Container -->
            <div id="dir_modals_container"></div>
        `;
    }

    /**
     * Attaches core logic bindings without reloading the DOM
     */
    function attachCoreListeners() {
        const searchInput = document.getElementById('dir_search_input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                // Javascript RAM filtering
                _filteredData = _directoryData.filter(row => {
                    const name = (row.STUDENT_NAME || '').toLowerCase();
                    const id = (row.STUDENT_ID || '').toLowerCase();
                    const phone = (row.STUDENT_MOBILE || '').toLowerCase();
                    return name.includes(query) || id.includes(query) || phone.includes(query);
                });
                renderTableBody();
            });
        }
    }

    /**
     * Asynchronously streams the directory dataset from Code.gs
     */
    async function fetchDirectory() {
        try {
            const token = window.SystemConfig ? localStorage.getItem(window.SystemConfig.AUTH_KEY) : '';
            const res = await window.UIUtils.fetchFromEngine({
                action: "FETCH_DIRECTORY",
                sheetName: "Main Records",
                token: token
            });

            if (res && res.status === "success" && Array.isArray(res.data)) {
                _directoryData = res.data;
                _filteredData = [..._directoryData];
                renderTableBody();
                if (window.UIUtils) window.UIUtils.showToast(`Loaded ${_directoryData.length} records.`, "success");
            } else {
                throw new Error(res.message || "Invalid payload format from server.");
            }
        } catch (err) {
            console.error("Fetch Directory Error:", err);
            if (window.UIUtils) window.UIUtils.showToast("Failed to load directory. " + err.message, "error");
            document.getElementById('dir_table_body').innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-red-500 font-bold">Error loading directory.</td></tr>`;
        }
    }

    /**
     * DOM Optimization: Heavy String Builder Injection
     */
    function renderTableBody() {
        const tbody = document.getElementById('dir_table_body');
        if (!tbody) return;

        if (_filteredData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-12 text-center text-slate-500 font-medium">No candidate records found.</td></tr>`;
            return;
        }

        // Fast string builder
        let html = '';
        _filteredData.forEach((row) => {
            // Protect absolute index lookup mapping for actions
            const absoluteIndex = _directoryData.indexOf(row);
            
            const photo = (row.STUDENT_PHOTO_URL && row.STUDENT_PHOTO_URL.startsWith('data:image')) 
                ? row.STUDENT_PHOTO_URL 
                : "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='%23cbd5e1'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";

            html += `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group">
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-3">
                            <img src="${photo}" class="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 bg-slate-50" alt="Avatar">
                            <span class="font-bold text-slate-800 dark:text-white">${row.STUDENT_NAME || 'N/A'}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <span class="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                            ${row.STUDENT_ID || 'N/A'}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-300">${row.ENROLLED_COURSE || 'N/A'}</td>
                    <td class="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-300">${row.STUDENT_MOBILE || 'N/A'}</td>
                    <td class="px-6 py-4 text-right">
                        <div class="flex items-center justify-end gap-1.5 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onclick="window.DirectoryViewerModule.viewRecord(${absoluteIndex})" class="p-2 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors" title="View Profile">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                            </button>
                            <button onclick="window.DirectoryViewerModule.editRecord(${absoluteIndex})" class="p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors" title="Edit Record">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            </button>
                            <button onclick="window.DirectoryViewerModule.printPDF(${absoluteIndex})" class="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors" title="Reprint PDF">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                            </button>
                            <button onclick="window.DirectoryViewerModule.deleteRecord(${absoluteIndex})" class="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Delete">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        // Single DOM Inject
        tbody.innerHTML = html;
    }

    // =====================================
    // MODULE ACTIONS
    // =====================================

    /**
     * Routes existing payload to the window.PDFGenerator utility
     */
    function printPDF(index) {
        const rowData = _directoryData[index];
        if (!rowData) return;
        if (window.PDFGenerator && typeof window.PDFGenerator.createApplicationForm === 'function') {
            window.PDFGenerator.createApplicationForm(rowData);
        } else {
            if (window.UIUtils) window.UIUtils.showToast("PDF utility is not loaded.", "error");
        }
    }

    /**
     * Destroys record locally instantly, then commits destruction to Code.gs
     */
    async function deleteRecord(index) {
        const rowData = _directoryData[index];
        if (!rowData) return;
        
        const confirmDelete = confirm(`Are you sure you want to delete ${rowData.STUDENT_NAME || 'this candidate'}? This cannot be undone.`);
        if (!confirmDelete) return;

        // Instant local optimistic update
        const backupData = [..._directoryData];
        _directoryData.splice(index, 1);
        
        // Retrigger filter to update UI smoothly
        const searchInput = document.getElementById('dir_search_input');
        if (searchInput) {
            searchInput.dispatchEvent(new Event('input')); 
        } else {
            _filteredData = [..._directoryData]; 
            renderTableBody(); 
        }

        try {
            const token = window.SystemConfig ? localStorage.getItem(window.SystemConfig.AUTH_KEY) : '';
            const res = await window.UIUtils.fetchFromEngine({
                action: "DELETE_RECORD",
                sheetName: "Main Records",
                studentId: rowData.STUDENT_ID,
                token: token
            });

            if (res && res.status === "success") {
                if (window.UIUtils) window.UIUtils.showToast("Record permanently deleted.", "success");
            } else {
                throw new Error(res.message || "Failed to delete from server.");
            }
        } catch (err) {
            console.error("Delete Error:", err);
            if (window.UIUtils) window.UIUtils.showToast("Failed to delete. Reverting UI.", "error");
            // Revert state on failure
            _directoryData = backupData;
            if (searchInput) {
                searchInput.dispatchEvent(new Event('input')); 
            } else { 
                _filteredData = [..._directoryData]; 
                renderTableBody(); 
            }
        }
    }

    // =====================================
    // MODALS
    // =====================================

    /**
     * Mounts the Read-Only Full Profile Modal
     */
    function viewRecord(index) {
        const data = _directoryData[index];
        if (!data) return;

        let detailsHtml = '';
        const skipKeys = ['STUDENT_PHOTO_URL', 'STUDENT_SIGNATURE_URL', 'TIMESTAMP'];
        
        SCHEMA.forEach(key => {
            if (!skipKeys.includes(key)) {
                detailsHtml += `
                    <div class="flex flex-col bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">${key.replace(/_/g, ' ')}</span>
                        <span class="text-sm font-semibold text-slate-800 dark:text-slate-200">${data[key] || '-'}</span>
                    </div>
                `;
            }
        });

        const photoHtml = data.STUDENT_PHOTO_URL ? `<img src="${data.STUDENT_PHOTO_URL}" class="w-32 h-32 object-cover rounded-2xl border-4 border-white dark:border-slate-800 shadow-md">` : `<div class="w-32 h-32 bg-slate-100 dark:bg-slate-800 rounded-2xl border-4 border-white dark:border-slate-800 shadow-md flex items-center justify-center text-xs font-bold text-slate-400">No Photo</div>`;
        const signHtml = data.STUDENT_SIGNATURE_URL ? `<img src="${data.STUDENT_SIGNATURE_URL}" class="h-16 w-auto object-contain bg-white rounded-lg p-2 border border-slate-200 shadow-sm">` : `<div class="h-16 w-32 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-xs font-bold text-slate-400">No Signature</div>`;

        const modalHtml = `
            <div id="dir_view_modal" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                <div class="bg-white dark:bg-slate-900 w-full max-w-5xl h-[90vh] md:h-auto md:max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700">
                    <!-- Header -->
                    <div class="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-10">
                        <div>
                            <h2 class="text-2xl font-black text-slate-800 dark:text-white tracking-tight">${data.STUDENT_NAME || 'Unknown Candidate'}</h2>
                            <p class="text-sm font-bold text-brand-500 mt-1">${data.ENROLLED_COURSE || 'No Course'} • ${data.STUDENT_ID || 'No ID'}</p>
                        </div>
                        <button onclick="document.getElementById('dir_view_modal').remove()" class="p-2 bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition-colors">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                    
                    <!-- Scrollable Body -->
                    <div class="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white dark:bg-slate-900">
                        <div class="flex flex-col md:flex-row gap-8 mb-8">
                            ${photoHtml}
                            <div class="flex-1 flex flex-col justify-end">
                                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Captured Signature</h3>
                                ${signHtml}
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            ${detailsHtml}
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('dir_modals_container').innerHTML = modalHtml;
    }

    // We'll store temporary base64 buffers for the modal here
    let _editState = {
        photoBase64: null,
        signatureBase64: null
    };

    /**
     * Helper to process file attachments natively in the Edit Modal
     */
    function processEditAttachment(input, previewId, stateKey) {
        if (!input.files || !input.files[0]) return;
        const file = input.files[0];
        if (file.size > 2 * 1024 * 1024) {
            if (window.UIUtils) window.UIUtils.showToast("File too large. Limit is 2MB.", "error");
            input.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById(previewId).src = e.target.result;
            _editState[stateKey] = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    /**
     * Mounts the Edit Target Record Modal
     */
    function editRecord(index) {
        const data = _directoryData[index];
        if (!data) return;

        // Reset temporary state
        _editState.photoBase64 = null;
        _editState.signatureBase64 = null;

        // Session Parsing
        let sessionFrom = '';
        let sessionTo = '';
        if (data.SESSION && data.SESSION.includes('-')) {
            const parts = data.SESSION.split('-');
            sessionFrom = parts[0];
            sessionTo = parts[1];
        }

        // Aadhar Handling
        const aadharStr = data.STUDENT_AADHAR ? String(data.STUDENT_AADHAR) : '';
        const hasAadhar = (aadharStr.trim() !== '');
        const aadharPlaceholder = hasAadhar ? 'XXXX XXXX ' + aadharStr.slice(-4) : '';

        const photoSrc = data.STUDENT_PHOTO_URL || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23cbd5e1'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";
        const signSrc = data.STUDENT_SIGNATURE_URL || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23cbd5e1'><rect width='24' height='24' fill='none'/></svg>";

        const modalHtml = `
            <div id="dir_edit_modal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                <div class="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800">
                    <div class="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
                        <h2 class="text-xl font-bold text-slate-800 dark:text-white">Modify Candidate Record</h2>
                        <button onclick="document.getElementById('dir_edit_modal').remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                    
                    <div class="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                        
                        <!-- System Parameters -->
                        <div>
                            <h3 class="text-sm font-bold text-brand-500 uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">System Parameters</h3>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Student ID (Read-Only)</label>
                                    <input type="text" readonly value="${data.STUDENT_ID || ''}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 font-mono text-sm text-slate-500 outline-none">
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Roll No</label>
                                    <input type="text" id="edit_rl_no" value="${data.RL_NO || ''}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Date of Admission</label>
                                    <input type="date" id="edit_doa" value="${data.DATE_OF_ADMISSION || ''}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Enrolled Course</label>
                                    <select id="edit_course" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                        <option value="Teachers Training" ${data.ENROLLED_COURSE === 'Teachers Training' ? 'selected' : ''}>Teachers Training</option>
                                        <option value="Diploma" ${data.ENROLLED_COURSE === 'Diploma' ? 'selected' : ''}>Diploma</option>
                                        <option value="Yoga/Hula Hoopla/Karate/Meditation" ${data.ENROLLED_COURSE === 'Yoga/Hula Hoopla/Karate/Meditation' ? 'selected' : ''}>Yoga/Hula Hoopla/Karate/Meditation</option>
                                    </select>
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Class Batch / Days</label>
                                    <select id="edit_batch" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                        <option value="Evening: Mon-Wed-Fri" ${data.CLASS_BATCH_DAYS === 'Evening: Mon-Wed-Fri' ? 'selected' : ''}>Evening: Mon-Wed-Fri</option>
                                        <option value="Evening: Sat-Sun-Wed" ${data.CLASS_BATCH_DAYS === 'Evening: Sat-Sun-Wed' ? 'selected' : ''}>Evening: Sat-Sun-Wed</option>
                                    </select>
                                </div>
                                <div class="space-y-1.5 flex gap-2">
                                    <div class="flex-1">
                                        <label class="text-xs font-bold text-slate-500 uppercase">Session From</label>
                                        <input type="number" id="edit_sess_from" min="2000" max="2099" value="${sessionFrom}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                    </div>
                                    <div class="flex-1">
                                        <label class="text-xs font-bold text-slate-500 uppercase">Session To</label>
                                        <input type="number" id="edit_sess_to" min="2000" max="2099" value="${sessionTo}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Demographics -->
                        <div>
                            <h3 class="text-sm font-bold text-brand-500 uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Demographics</h3>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div class="space-y-1.5 md:col-span-2">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Student Name</label>
                                    <input type="text" id="edit_name" value="${data.STUDENT_NAME || ''}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Student Mobile</label>
                                    <input type="text" id="edit_mobile" value="${data.STUDENT_MOBILE || ''}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                </div>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Date of Birth</label>
                                    <input type="date" id="edit_dob" value="${data.DOB || ''}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Gender</label>
                                    <select id="edit_gender" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                        <option value="Male" ${data.GENDER === 'Male' ? 'selected' : ''}>Male</option>
                                        <option value="Female" ${data.GENDER === 'Female' ? 'selected' : ''}>Female</option>
                                        <option value="Other" ${data.GENDER === 'Other' ? 'selected' : ''}>Other</option>
                                    </select>
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Blood Group</label>
                                    <input type="text" id="edit_blood" value="${data.BLOOD_GROUP || ''}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Religion</label>
                                    <select id="edit_religion" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                        <option value="Hindu" ${data.RELIGION === 'Hindu' ? 'selected' : ''}>Hindu</option>
                                        <option value="Muslim" ${data.RELIGION === 'Muslim' ? 'selected' : ''}>Muslim</option>
                                        <option value="Others" ${data.RELIGION === 'Others' ? 'selected' : ''}>Others</option>
                                    </select>
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Aadhaar (Update Only)</label>
                                    <input type="text" id="edit_aadhar" placeholder="${aadharPlaceholder || '12-digit number'}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Category</label>
                                    <input type="text" id="edit_category" value="${data.CATEGORY || ''}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                </div>
                                <div class="space-y-1.5 md:col-span-2">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Physical Disability</label>
                                    <input type="text" id="edit_disability" value="${data.PHYSICAL_DISABILITY || ''}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                </div>
                            </div>
                        </div>

                        <!-- Parent / Guardian -->
                        <div>
                            <h3 class="text-sm font-bold text-brand-500 uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Parent / Guardian Details</h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Father's Name</label>
                                    <input type="text" id="edit_father_name" value="${data.FATHER_NAME || ''}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Father's Mobile</label>
                                    <input type="text" id="edit_father_mobile" value="${data.FATHER_MOBILE || ''}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Mother's Name</label>
                                    <input type="text" id="edit_mother_name" value="${data.MOTHER_NAME || ''}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Mother's Mobile</label>
                                    <input type="text" id="edit_mother_mobile" value="${data.MOTHER_MOBILE || ''}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                </div>
                                <div class="space-y-1.5 md:col-span-2 mt-4">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Guardian Details</label>
                                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <input type="text" id="edit_guardian_relation" placeholder="Relation (e.g. Father)" value="${data.GUARDIAN_RELATION || ''}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white outline-none">
                                        <input type="text" id="edit_guardian_name" placeholder="Name" value="${data.GUARDIAN_NAME || ''}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white outline-none">
                                        <input type="text" id="edit_guardian_mobile" placeholder="Mobile" value="${data.GUARDIAN_MOBILE || ''}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white outline-none">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Media Attachments -->
                        <div>
                            <h3 class="text-sm font-bold text-brand-500 uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Media & Attachments</h3>
                            <div class="flex gap-8">
                                <div class="flex flex-col items-center gap-3">
                                    <span class="text-xs font-bold text-slate-500 uppercase">Photograph</span>
                                    <img id="edit_preview_photo" src="${photoSrc}" class="w-24 h-24 object-cover rounded-xl border border-slate-200 bg-slate-50">
                                    <label class="cursor-pointer px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 rounded-lg transition-colors">
                                        Upload New
                                        <input type="file" class="hidden" accept="image/*" onchange="window.DirectoryViewerModule.processEditAttachment(this, 'edit_preview_photo', 'photoBase64')">
                                    </label>
                                </div>
                                <div class="flex flex-col items-center gap-3">
                                    <span class="text-xs font-bold text-slate-500 uppercase">Signature</span>
                                    <img id="edit_preview_sign" src="${signSrc}" class="h-16 w-32 object-contain rounded-xl border border-slate-200 bg-slate-50 px-2">
                                    <label class="cursor-pointer px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 rounded-lg transition-colors mt-auto">
                                        Upload New
                                        <input type="file" class="hidden" accept="image/*" onchange="window.DirectoryViewerModule.processEditAttachment(this, 'edit_preview_sign', 'signatureBase64')">
                                    </label>
                                </div>
                            </div>
                        </div>

                    </div>

                    <div class="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                        <button onclick="document.getElementById('dir_edit_modal').remove()" class="px-6 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Cancel</button>
                        <button id="btn_save_edit" onclick="window.DirectoryViewerModule.saveEdit(${index})" class="px-6 py-2.5 rounded-xl font-bold text-white bg-brand-500 hover:bg-brand-600 shadow-md shadow-brand-500/20 transition-all flex items-center gap-2">Save Record</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('dir_modals_container').innerHTML = modalHtml;
    }

    /**
     * Commits edits locally and ships to the Code.gs backend
     */
    async function saveEdit(index) {
        const btn = document.getElementById('btn_save_edit');
        const oldText = btn.innerHTML;
        btn.innerHTML = `<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Saving...`;
        btn.disabled = true;

        const data = _directoryData[index];

        // Session Recombination
        const sessFrom = document.getElementById('edit_sess_from').value;
        const sessTo = document.getElementById('edit_sess_to').value;
        const combinedSession = (sessFrom && sessTo) ? `${sessFrom}-${sessTo}` : data.SESSION;

        // Aadhar Handling
        const aadharInput = document.getElementById('edit_aadhar').value.replace(/\D/g, '');
        let newAadhar = data.STUDENT_AADHAR;
        if (aadharInput.length > 0) {
            newAadhar = aadharInput; // Overwrite only if typed
        }

        const payload = {
            ...data,
            RL_NO: document.getElementById('edit_rl_no').value.trim(),
            SESSION: combinedSession,
            DATE_OF_ADMISSION: document.getElementById('edit_doa').value,
            ENROLLED_COURSE: document.getElementById('edit_course').value,
            CLASS_BATCH_DAYS: document.getElementById('edit_batch').value,
            STUDENT_NAME: document.getElementById('edit_name').value.trim(),
            DOB: document.getElementById('edit_dob').value,
            GENDER: document.getElementById('edit_gender').value,
            BLOOD_GROUP: document.getElementById('edit_blood').value.trim(),
            RELIGION: document.getElementById('edit_religion').value,
            STUDENT_AADHAR: newAadhar,
            CATEGORY: document.getElementById('edit_category').value.trim(),
            STUDENT_MOBILE: document.getElementById('edit_mobile').value.trim(),
            PHYSICAL_DISABILITY: document.getElementById('edit_disability').value.trim(),
            FATHER_NAME: document.getElementById('edit_father_name').value.trim(),
            FATHER_MOBILE: document.getElementById('edit_father_mobile').value.trim(),
            MOTHER_NAME: document.getElementById('edit_mother_name').value.trim(),
            MOTHER_MOBILE: document.getElementById('edit_mother_mobile').value.trim(),
            GUARDIAN_RELATION: document.getElementById('edit_guardian_relation').value.trim(),
            GUARDIAN_NAME: document.getElementById('edit_guardian_name').value.trim(),
            GUARDIAN_MOBILE: document.getElementById('edit_guardian_mobile').value.trim()
        };

        // Attach new Base64 chunks if selected
        if (_editState.photoBase64) {
            payload.STUDENT_PHOTO_URL = _editState.photoBase64;
        }
        if (_editState.signatureBase64) {
            payload.STUDENT_SIGNATURE_URL = _editState.signatureBase64;
        }

        try {
            const token = window.SystemConfig ? localStorage.getItem(window.SystemConfig.AUTH_KEY) : '';
            const res = await window.UIUtils.fetchFromEngine({
                action: "EDIT_RECORD",
                sheetName: "Main Records",
                record: payload,
                token: token
            });

            if (res && res.status === "success") {
                // If the backend returns updated URLs (e.g. from Drive), use them, else fallback to payload
                if (res.updatedPhotoUrl) payload.STUDENT_PHOTO_URL = res.updatedPhotoUrl;
                if (res.updatedSignatureUrl) payload.STUDENT_SIGNATURE_URL = res.updatedSignatureUrl;

                _directoryData[index] = payload;
                
                const searchInput = document.getElementById('dir_search_input');
                if (searchInput) {
                    searchInput.dispatchEvent(new Event('input')); 
                } else { 
                    _filteredData = [..._directoryData]; 
                    renderTableBody(); 
                }
                
                document.getElementById('dir_edit_modal').remove();
                if (window.UIUtils) window.UIUtils.showToast("Record updated successfully.", "success");
            } else {
                throw new Error(res.message || "Failed to edit record on server.");
            }
        } catch (err) {
            console.error("Edit Error:", err);
            if (window.UIUtils) window.UIUtils.showToast("Failed to update record. " + err.message, "error");
            btn.innerHTML = oldText;
            btn.disabled = false;
        }
    }

    return {
        mount,
        viewRecord,
        editRecord,
        saveEdit,
        deleteRecord,
        printPDF,
        processEditAttachment
    };

})();
