/**
 * ==========================================
 * 🗂️ ADMIN DIRECTORY VIEWER (directoryViewer.js)
 * ==========================================
 * Premium Data Table Module with Async Drive Image Resolution,
 * Client-Side RAM Filtering, and Full CRUD Action Pipeline.
 *
 * UI Terminology: "Class" (user-facing)
 * Payload Keys:   ENROLLED_COURSE (backend-facing — DO NOT CHANGE)
 */
window.DirectoryViewerModule = (function () {
    'use strict';

    // =========================================
    // INTERNAL STATE
    // =========================================
    let _container = null;
    let _directoryData = [];
    let _filteredData = [];

    /** Schema mapping — matches Google Sheet column headers exactly */
    const SCHEMA = [
        'STUDENT_ID', 'RL_NO', 'SESSION', 'DATE_OF_ADMISSION', 'ENROLLED_COURSE', 'CLASS_BATCH_DAYS',
        'STUDENT_NAME', 'DOB', 'GENDER', 'BLOOD_GROUP', 'STUDENT_AADHAR', 'CATEGORY', 'STUDENT_MOBILE',
        'PHYSICAL_DISABILITY', 'FATHER_NAME', 'FATHER_MOBILE', 'MOTHER_NAME', 'MOTHER_MOBILE',
        'GUARDIAN_RELATION', 'GUARDIAN_NAME', 'GUARDIAN_MOBILE', 'DECLARATION_1', 'DECLARATION_2',
        'PAYABLE_AMOUNT', 'IS_FEE_PAID', 'PAYMENT_MODE', 'TXN_ID', 'STUDENT_PHOTO_URL',
        'STUDENT_SIGNATURE_URL', 'RELIGION', 'TIMESTAMP'
    ];

    // =========================================
    // 🔗 ASYNC DRIVE IMAGE RESOLVER
    // =========================================

    /**
     * Resolves a Google Drive share/view URL to a direct binary stream URL.
     * Handles: base64 data URIs (pass-through), /file/d/ID, open?id=ID patterns.
     * Returns the original URL unchanged if no Drive pattern is detected.
     */
    function resolveDriveUrl(url) {
        if (!url || typeof url !== 'string') return '';
        if (url.startsWith('data:')) return url;
        const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/) || url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
            return `https://docs.google.com/uc?export=download&id=${match[1]}`;
        }
        return url;
    }

    /**
     * Fetches any image URL (including resolved Drive stream links) as a Blob,
     * converts it to a Base64 data URI string, and returns it.
     * This bypasses CORS taint issues that break canvas.toDataURL().
     *
     * @param {string} url — The raw URL from the spreadsheet
     * @returns {Promise<string|null>} — Base64 data URI or null on failure
     */
    async function getBase64FromDriveUrl(url) {
        if (!url || typeof url !== 'string' || url.trim() === '') return null;
        if (url.startsWith('Rich Media Stripped')) return null;

        // Already a data URI — pass through immediately
        if (url.startsWith('data:')) return url;

        // Resolve Drive share URLs to streamable endpoints
        const streamUrl = resolveDriveUrl(url);

        try {
            const response = await fetch(streamUrl, { mode: 'cors' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            return await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(blob);
            });
        } catch (fetchErr) {
            // Fallback: try canvas-based loading (works for publicly accessible non-Drive URLs)
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'Anonymous';
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, img.width, img.height);
                        ctx.drawImage(img, 0, 0);
                        resolve(canvas.toDataURL('image/jpeg', 0.85));
                    } catch (e) {
                        resolve(null);
                    }
                };
                img.onerror = () => resolve(null);
                img.src = streamUrl;
            });
        }
    }

    // =========================================
    // SVG CONSTANTS
    // =========================================
    const SVG_FALLBACK_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='%23cbd5e1'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";

    // =========================================
    // 🚀 MODULE LIFECYCLE
    // =========================================

    /**
     * Mounts the viewer into the DOM container.
     * Called by AppCore.navigateTo().
     */
    async function mount(container) {
        _container = container;
        _container.innerHTML = buildShellHTML();
        attachSearchListener();
        await fetchDirectory();
    }

    // =========================================
    // 🏗️ SHELL HTML BUILDER
    // =========================================

    function buildShellHTML() {
        return `
            <div class="space-y-6">
                <!-- Header & Search -->
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <div>
                        <h1 class="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <svg class="w-6 h-6 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                            Admin Directory
                        </h1>
                        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage all active enrollments</p>
                    </div>
                    
                    <div class="flex flex-col md:flex-row items-center gap-2 w-full md:w-auto">
                        <button id="toggleFilterBtn" onclick="document.getElementById('filterPanel').classList.toggle('hidden')" class="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all font-bold text-sm">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg>
                            Filter Options
                        </button>
                        <button id="downloadCsvBtn" class="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all font-bold text-sm shadow-sm">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                            Download Filtered List
                        </button>
                        <div class="relative w-full md:w-80 ml-0 md:ml-2">
                            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg class="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            </div>
                            <input type="text" id="dir_search_input" placeholder="Search by Name, ID, or Phone..."
                                class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all shadow-inner">
                        </div>
                    </div>
                </div>

                <!-- Hidden Filter Panel -->
                <div id="filterPanel" class="hidden grid grid-cols-1 md:grid-cols-5 gap-3 bg-slate-900/80 p-4 rounded-xl border border-slate-800 mb-4">
                    <div class="space-y-1">
                        <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Enrolled Class</label>
                        <select id="filter_course" class="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-brand-500 outline-none text-sm">
                            <option value="">All Classes</option>
                            <option value="Teachers Training">Teachers Training</option>
                            <option value="Diploma">Diploma</option>
                            <option value="Yoga/Hula Hoopla/Karate/Meditation">Yoga/Hula Hoopla/Karate/Meditation</option>
                        </select>
                    </div>
                    <div class="space-y-1">
                        <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Batch Days</label>
                        <select id="filter_batch" class="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-brand-500 outline-none text-sm">
                            <option value="">All Batches</option>
                            <option value="Evening: Mon-Wed-Fri">Evening: Mon-Wed-Fri</option>
                            <option value="Evening: Sat-Sun-Wed">Evening: Sat-Sun-Wed</option>
                        </select>
                    </div>
                    <div class="space-y-1">
                        <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Academic Session</label>
                        <div class="flex items-center gap-1">
                            <input type="number" id="filter_sess_from" placeholder="From" min="2000" max="2099" class="w-full px-2 py-2 rounded-lg border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-brand-500 outline-none text-sm text-center">
                            <span class="text-slate-500 font-bold">-</span>
                            <input type="number" id="filter_sess_to" placeholder="To" min="2000" max="2099" class="w-full px-2 py-2 rounded-lg border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-brand-500 outline-none text-sm text-center">
                        </div>
                    </div>
                    <div class="space-y-1">
                        <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gender</label>
                        <select id="filter_gender" class="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-brand-500 outline-none text-sm">
                            <option value="">All Genders</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div class="space-y-1">
                        <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Admission Year</label>
                        <input type="number" id="filter_admission_year" placeholder="e.g. 2024" min="2000" max="2099" class="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-brand-500 outline-none text-sm">
                    </div>
                </div>

                <!-- Data Table Container -->
                <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse whitespace-nowrap min-w-[900px]">
                            <thead>
                                <tr class="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                    <th class="px-6 py-4">Student ID</th>
                                    <th class="px-6 py-4">Roll No</th>
                                    <th class="px-6 py-4">Candidate Name</th>
                                    <th class="px-6 py-4">Enrolled Class</th>
                                    <th class="px-6 py-4">Mobile</th>
                                    <th class="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="dir_table_body" class="divide-y divide-slate-100 dark:divide-slate-800">
                                <!-- Loading Skeleton -->
                                <tr>
                                    <td colspan="6" class="px-6 py-16 text-center text-slate-500">
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

    // =========================================
    // 🔍 SEARCH ENGINE (Client-Side RAM Filter)
    // =========================================

    function applyDirectoryFilters() {
        const searchInput = document.getElementById('dir_search_input');
        const query = (searchInput?.value || '').toLowerCase().trim();
        
        const fCourse = document.getElementById('filter_course')?.value || '';
        const fBatch = document.getElementById('filter_batch')?.value || '';
        const fSessFrom = document.getElementById('filter_sess_from')?.value || '';
        const fSessTo = document.getElementById('filter_sess_to')?.value || '';
        const fGender = document.getElementById('filter_gender')?.value || '';
        const fYear = document.getElementById('filter_admission_year')?.value || '';

        _filteredData = _directoryData.filter(item => {
            // 1. Text Matcher (Name, ID, Mobile, RL_NO)
            let textMatch = true;
            if (query !== '') {
                textMatch = 
                    (item.STUDENT_NAME && item.STUDENT_NAME.toLowerCase().includes(query)) ||
                    (item.STUDENT_ID && String(item.STUDENT_ID).toLowerCase().includes(query)) ||
                    (item.STUDENT_MOBILE && String(item.STUDENT_MOBILE).toLowerCase().includes(query)) ||
                    (item.RL_NO && String(item.RL_NO).toLowerCase().includes(query)); // Explicit String Casting Fix
            }
            if (!textMatch) return false;

            // 2. Multi-Drop Parameters
            if (fCourse && item.ENROLLED_COURSE !== fCourse) return false;
            if (fBatch && item.CLASS_BATCH_DAYS !== fBatch) return false;
            if (fGender && item.GENDER !== fGender) return false;

            // 3. Academic Session (Split parsing)
            if (fSessFrom || fSessTo) {
                let sFrom = '', sTo = '';
                if (item.SESSION && item.SESSION.includes('-')) {
                    const parts = item.SESSION.split('-');
                    sFrom = parts[0];
                    sTo = parts[1];
                }
                if (fSessFrom && sFrom !== fSessFrom) return false;
                if (fSessTo && sTo !== fSessTo) return false;
            }

            // 4. Strict Admission Year Evaluation
            if (fYear) {
                const doa = item.DATE_OF_ADMISSION || '';
                const rowYear = doa.length >= 4 ? doa.substring(0, 4) : '';
                if (rowYear !== fYear) return false;
            }

            return true;
        });

        window.currentFilteredDataset = [..._filteredData];
        renderTableBody();
    }

    function attachSearchListener() {
        const triggers = [
            'dir_search_input',
            'filter_course',
            'filter_batch',
            'filter_sess_from',
            'filter_sess_to',
            'filter_gender',
            'filter_admission_year'
        ];

        triggers.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', applyDirectoryFilters);
                el.addEventListener('change', applyDirectoryFilters);
            }
        });

        const dlBtn = document.getElementById('downloadCsvBtn');
        if (dlBtn) {
            dlBtn.addEventListener('click', exportToCsv);
        }
    }

    // =========================================
    // ☁️ DATA FETCHING (Async Cloud Stream)
    // =========================================

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
                window.currentFilteredDataset = [..._filteredData];
                renderTableBody();
                if (window.UIUtils) window.UIUtils.showToast(`Loaded ${_directoryData.length} records.`, "success");
            } else {
                throw new Error(res.message || "Invalid payload format from server.");
            }
        } catch (err) {
            console.error("Fetch Directory Error:", err);
            if (window.UIUtils) window.UIUtils.showToast("Failed to load directory. " + err.message, "error");
            document.getElementById('dir_table_body').innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-red-500 font-bold">Error loading directory.</td></tr>`;
        }
    }

    // =========================================
    // 📊 TABLE RENDERER (Single DOM Injection)
    // =========================================

    function renderTableBody() {
        const tbody = document.getElementById('dir_table_body');
        if (!tbody) return;

        if (_filteredData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-12 text-center text-slate-500 font-medium">No candidate records found.</td></tr>`;
            return;
        }

        let html = '';
        _filteredData.forEach((row) => {
            const absoluteIndex = _directoryData.indexOf(row);

            html += `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group">
                    <td class="px-6 py-4">
                        <span class="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                            ${row.STUDENT_ID || 'N/A'}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-300">
                        ${row.RL_NO || 'N/A'}
                    </td>
                    <td class="px-6 py-4">
                        <span class="font-bold text-slate-800 dark:text-white">${row.STUDENT_NAME || 'N/A'}</span>
                    </td>
                    <td class="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-300">${row.ENROLLED_COURSE || 'N/A'}</td>
                    <td class="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-300">${row.STUDENT_MOBILE || 'N/A'}</td>
                    <td class="px-6 py-4 text-right">
                        <div class="flex items-center justify-end gap-1.5 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                            <!-- View Profile -->
                            <button onclick="window.DirectoryViewerModule.viewRecord(${absoluteIndex})" class="p-2 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors" title="View Profile">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                            </button>
                            <!-- Edit Record -->
                            <button onclick="window.DirectoryViewerModule.editRecord(${absoluteIndex})" class="p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors" title="Edit Record">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            </button>
                            <!-- Reprint PDF -->
                            <button onclick="window.DirectoryViewerModule.printPDF(${absoluteIndex})" class="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors" title="Reprint PDF">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                            </button>
                            <!-- Send Admission Email -->
                            <button onclick="(function(idx){var rec=window.DirectoryViewerModule.getRecordByIndex(idx);if(!rec)return;if(window.NotificationUtils){window.NotificationUtils.sendAdmissionEmail(rec);}else{window.UIUtils&&window.UIUtils.showToast('Notification module not loaded.','error');}})(${absoluteIndex})" class="p-2 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded-lg transition-colors" title="Send Admission Email">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                            </button>
                            <!-- Send Admission WhatsApp -->
                            <button onclick="(function(idx){var rec=window.DirectoryViewerModule.getRecordByIndex(idx);if(!rec)return;if(window.NotificationUtils){window.NotificationUtils.sendAdmissionWhatsApp(rec);}else{window.UIUtils&&window.UIUtils.showToast('Notification module not loaded.','error');}})(${absoluteIndex})" class="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors" title="Send WhatsApp Message">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                            </button>
                            <!-- 💲 Pay Fees — Cross-Module Bridge to Fee Collector (Safety-Guarded) -->
                            <button onclick="(async function(idx){var rec=window.DirectoryViewerModule.getRecordByIndex(idx);if(!rec){return;}if(window.PaymentCollectorModule&&window.PaymentCollectorModule.openCartForCandidate){window.PaymentCollectorModule.openCartForCandidate(rec);}else{if(window.AppCore){await window.AppCore.navigateTo('paymentCollector');}if(window.PaymentCollectorModule&&window.PaymentCollectorModule.openCartForCandidate){window.PaymentCollectorModule.openCartForCandidate(rec);}else{window.UIUtils&&window.UIUtils.showToast('Fee Collector module failed to load.','error');}}})(${absoluteIndex})" class="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors" title="💲 Pay Fees">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                            </button>
                            <!-- Delete -->
                            <button onclick="window.DirectoryViewerModule.deleteRecord('${row.STUDENT_ID}')" class="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors" title="Delete Record">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    // =========================================
    // ⚡ ACTION HANDLERS
    // =========================================

    /**
     * Routes row data to the PDFGenerator utility for admission form reprint.
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
     * Destroys a record with optimistic local removal + async backend commit.
     * Reverts UI on server failure.
     */
    async function deleteRecord(studentId) {
        if (!studentId) return;

        // Visual Confirmation Gate
        const confirmDelete = confirm("Are you sure you want to permanently erase this student record? This action cannot be undone.");
        if (!confirmDelete) return;

        // Link local data pool to the requested global cache window variable if expected
        if (!window.MasterCandidateCache) {
            window.MasterCandidateCache = _directoryData;
        }

        const backupData = [...window.MasterCandidateCache];

        // Optimistic UI Engine Synchronization
        window.MasterCandidateCache = window.MasterCandidateCache.filter(item => item.STUDENT_ID !== studentId);
        _directoryData = window.MasterCandidateCache; // Sync local reference
        
        // Zero-lag localized layout rendering routine
        applyDirectoryFilters();

        try {
            const token = window.SystemConfig ? localStorage.getItem(window.SystemConfig.AUTH_KEY) : '';
            const targetUrl = window.SystemConfig ? window.SystemConfig.API_URL : '';

            // Asynchronous API Payload
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ 
                    action: 'DELETE_RECORD', 
                    STUDENT_ID: studentId,
                    token: token
                })
            });
            
            if (!response.ok) {
                throw new Error(`Server network failure. Status code: ${response.status}`);
            }

            const res = await response.json();

            if (res && res.success) {
                if (window.UIUtils) window.UIUtils.showToast("Record permanently deleted.", "success");
            } else {
                throw new Error(res.message || "Failed to delete from server.");
            }
        } catch (err) {
            console.error("Delete Error:", err);
            if (window.UIUtils) window.UIUtils.showToast("Failed to delete. Reverting UI.", "error");
            
            // Revert state on failure
            window.MasterCandidateCache = backupData;
            _directoryData = backupData;
            applyDirectoryFilters();
        }
    }

    // =========================================
    // 🖼️ MODALS — EDIT STATE BUFFER
    // =========================================

    let _editState = {
        photoBase64: null,
        signatureBase64: null
    };

    /**
     * Processes a file upload from the Edit Modal and stores its Base64
     * representation in the _editState buffer for later submission.
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
        reader.onload = function (e) {
            document.getElementById(previewId).src = e.target.result;
            _editState[stateKey] = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // =========================================
    // 👁️ FULL VIEW PROFILE MODAL (Read-Only)
    // =========================================

    /**
     * Mounts a premium, read-only candidate profile dashboard.
     * CORS-Safe: No Drive image streaming. Uses redirect buttons instead.
     */
    function viewRecord(index) {
        const data = _directoryData[index];
        if (!data) return;

        // --- Raw Drive URLs for redirect buttons (no CORS fetch) ---
        const photoUrl = data.STUDENT_PHOTO_URL || '';
        const signUrl = data.STUDENT_SIGNATURE_URL || '';

        // --- Apply Global Timestamp Formatter ---
        const safeDateOfAdmission = window.UIUtils.cleanDateTimeString(data.DATE_OF_ADMISSION);
        const safeTimestamp = window.UIUtils.cleanDateTimeString(data.TIMESTAMP);
        const safeDobView = window.UIUtils.cleanDateTimeString(data.DOB);

        // --- Helper: render a single field cell ---
        const field = (label, value) => `
            <div class="flex flex-col gap-0.5">
                <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">${label}</span>
                <span class="text-sm font-semibold text-slate-800 dark:text-slate-100 break-words">${value || '—'}</span>
            </div>`;

        // --- Fee Status Badge ---
        const feeBadge = data.IS_FEE_PAID === 'Yes'
            ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-full border border-emerald-200 dark:border-emerald-800">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>
                    Paid
               </span>`
            : `<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 text-xs font-bold rounded-full border border-rose-200 dark:border-rose-800">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
                    Unpaid
               </span>`;



        const aadharDisplay = data.STUDENT_AADHAR ? `XXXX XXXX ${String(data.STUDENT_AADHAR).slice(-4)}` : '—';

        // --- Section Card wrapper ---
        const section = (title, accentColor, icon, bodyHtml) => `
            <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div class="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                    <span class="w-6 h-6 flex items-center justify-center rounded-lg ${accentColor} shrink-0">${icon}</span>
                    <h3 class="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">${title}</h3>
                </div>
                <div class="p-5 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
                    ${bodyHtml}
                </div>
            </div>`;

        const modalHtml = `
            <div id="dir_view_modal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                <div class="bg-slate-50 dark:bg-slate-900 w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden">

                    <!-- TOP CLOSE BAR -->
                    <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                        <span class="text-xs font-bold text-slate-400 uppercase tracking-widest">Candidate Profile</span>
                        <button onclick="document.getElementById('dir_view_modal').remove()" class="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all" title="Close">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>

                    <!-- SCROLLABLE BODY -->
                    <div class="overflow-y-auto custom-scrollbar flex-1 p-6 space-y-5">

                        <!-- HERO HEADER -->
                        <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                            <div class="flex gap-6 items-start">
                                <div style="width:100px;height:120px;" class="rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 border-2 border-white dark:border-slate-700 shadow-lg">
                                    <svg class="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <h2 class="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">${data.STUDENT_NAME || 'Unknown Candidate'}</h2>
                                    <p class="text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">${data.ENROLLED_COURSE || 'Class Not Set'}</p>
                                    <div class="flex flex-wrap items-center gap-2 mt-3">
                                        <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 text-xs font-bold rounded-full border border-brand-200 dark:border-brand-800">
                                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm1 11H9V9h2v4zm0-6H9V5h2v2z"></path></svg>
                                            ID: ${data.STUDENT_ID || 'N/A'}
                                        </span>
                                        <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 text-xs font-bold rounded-full border border-violet-200 dark:border-violet-800">
                                            Roll No: ${data.RL_NO || 'N/A'}
                                        </span>
                                    </div>
                                    <div class="flex items-center gap-2 mt-3 text-slate-600 dark:text-slate-400">
                                        <svg class="w-4 h-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                                        <span class="text-sm font-semibold">${data.STUDENT_MOBILE || 'No mobile on file'}</span>
                                    </div>
                                    <!-- CORS-Safe Media View Buttons -->
                                    <div class="flex items-center gap-3 mt-4">
                                        ${photoUrl ? `<a href="${photoUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-4 py-2 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 text-xs font-bold rounded-xl border border-brand-200 dark:border-brand-800 hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-all shadow-sm">
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                            \uD83D\uDDBC\uFE0F View Picture
                                        </a>` : '<span class="text-xs text-slate-400 italic font-medium">No photo on file</span>'}
                                        ${signUrl ? `<a href="${signUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-xs font-bold rounded-xl border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-all shadow-sm">
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                            \u270D\uFE0F View Signature
                                        </a>` : '<span class="text-xs text-slate-400 italic font-medium">No signature on file</span>'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- SECTION A: Academic Profile -->
                        ${section('Academic Profile', 'bg-brand-100 dark:bg-brand-900/40 text-brand-600',
                            `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l9-5-9-5-9 5 9 5z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"></path></svg>`,
                            field('Enrolled Class', data.ENROLLED_COURSE) +
                            field('Class Batch / Days', data.CLASS_BATCH_DAYS) +
                            field('Academic Session', data.SESSION) +
                            field('Date of Admission', safeDateOfAdmission)
                        )}

                        <!-- SECTION B: Personal Information -->
                        ${section('Personal Information', 'bg-violet-100 dark:bg-violet-900/40 text-violet-600',
                            `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>`,
                            field('Date of Birth', safeDobView) +
                            field('Gender', data.GENDER) +
                            field('Religion', data.RELIGION) +
                            field('Blood Group', data.BLOOD_GROUP) +
                            field('Category', data.CATEGORY) +
                            field('Aadhaar No.', aadharDisplay) +
                            field('Contact Email', data.CONTACT_EMAIL) +
                            field('Home Address', data.HOME_ADDRESS) +
                            `<div class="col-span-2 flex flex-col gap-0.5">
                                <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Physical Disability Notes</span>
                                <span class="text-sm font-semibold text-slate-800 dark:text-slate-100">${data.PHYSICAL_DISABILITY || '—'}</span>
                            </div>`
                        )}

                        <!-- SECTION C: Family & Guardian -->
                        ${section('Family & Guardian', 'bg-amber-100 dark:bg-amber-900/40 text-amber-600',
                            `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>`,
                            field("Father's Name", data.FATHER_NAME) +
                            field("Father's Mobile", data.FATHER_MOBILE) +
                            field("Mother's Name", data.MOTHER_NAME) +
                            field("Mother's Mobile", data.MOTHER_MOBILE) +
                            field('Guardian Relation', data.GUARDIAN_RELATION) +
                            field('Guardian Name', data.GUARDIAN_NAME) +
                            field('Guardian Mobile', data.GUARDIAN_MOBILE) +
                            ''
                        )}

                        <!-- SECTION D: Administrative & Financial -->
                        ${section('Administrative & Financial', 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600',
                            `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>`,
                            field('Payable Amount', data.PAYABLE_AMOUNT ? '₹ ' + data.PAYABLE_AMOUNT : '—') +
                            `<div class="flex flex-col gap-0.5">
                                <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Fee Status</span>
                                <div class="mt-0.5">${feeBadge}</div>
                            </div>` +
                            field('Payment Mode', data.PAYMENT_MODE) +
                            field('Transaction ID', data.TXN_ID) +
                            `<div class="col-span-2 md:col-span-4 flex flex-col gap-0.5">
                                <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Admission Timestamp</span>
                                <span class="text-sm font-semibold text-slate-800 dark:text-slate-100">${safeTimestamp}</span>
                            </div>`
                        )}

                        <!-- DECLARATION BLOCK -->
                        <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                            <div class="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                                <span class="w-6 h-6 flex items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-600 shrink-0">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                </span>
                                <h3 class="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">Declaration &amp; Verification</h3>
                            </div>
                            <div class="p-5 flex items-center gap-8">
                                <div class="flex flex-col gap-1">
                                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Declaration Date</span>
                                    <span class="text-sm font-bold text-slate-700 dark:text-slate-200">${safeDateOfAdmission}</span>
                                    <span class="text-[10px] text-slate-400 mt-2">Candidate has agreed to all stated declarations and terms at the time of admission.</span>
                                    <span class="text-[10px] text-slate-400">Photo and signature documents are available via the view buttons above.</span>
                                </div>
                            </div>
                        </div>

                    </div>

                    <!-- FOOTER -->
                    <div class="shrink-0 flex justify-end items-center gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <button onclick="window.DirectoryViewerModule.editRecord(${index}); document.getElementById('dir_view_modal').remove();" class="px-5 py-2.5 rounded-xl font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800 transition-all text-sm flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            Edit Record
                        </button>
                        <button onclick="document.getElementById('dir_view_modal').remove()" class="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-sm">Close</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('dir_modals_container').innerHTML = modalHtml;
    }

    // =========================================
    // ✏️ EDIT RECORD MODAL (Full CRUD Form)
    // =========================================

    /**
     * Mounts the comprehensive Edit Record Modal with dropdown sync,
     * session split, Aadhaar masking, and Base64 media upload fields.
     * Excludes financial/fee and declaration fields from editing.
     */
    function editRecord(index) {
        const data = _directoryData[index];
        if (!data) return;

        // Reset temporary state
        _editState.photoBase64 = null;
        _editState.signatureBase64 = null;

        // Session Parsing — split "2024-2025" into two inputs
        let sessionFrom = '';
        let sessionTo = '';
        if (data.SESSION && data.SESSION.includes('-')) {
            const parts = data.SESSION.split('-');
            sessionFrom = parts[0];
            sessionTo = parts[1];
        }

        // Aadhaar Handling — mask stored value for placeholder
        const aadharStr = data.STUDENT_AADHAR ? String(data.STUDENT_AADHAR) : '';
        const hasAadhar = (aadharStr.trim() !== '');
        const aadharPlaceholder = hasAadhar ? 'XXXX XXXX ' + aadharStr.slice(-4) : '';

        // Raw Drive URLs for "View Current" redirect links (no CORS streaming)
        const photoViewUrl = data.STUDENT_PHOTO_URL || '';
        const signViewUrl = data.STUDENT_SIGNATURE_URL || '';

        // Safe ISO Date parsing for HTML5 <input type="date"> compatibility
        const safeDoa = data.DATE_OF_ADMISSION ? data.DATE_OF_ADMISSION.split('T')[0] : '';
        const safeDob = data.DOB ? data.DOB.split('T')[0] : '';

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
                                    <input type="date" id="edit_doa" value="${safeDoa}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Enrolled Class</label>
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
                                <div class="grid grid-cols-2 gap-3 items-end">
                                    <div class="space-y-1.5">
                                        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider">Session From</label>
                                        <input type="number" id="edit_sess_from" min="2000" max="2099" value="${sessionFrom}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                    </div>
                                    <div class="space-y-1.5">
                                        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider">Session To</label>
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
                                <div class="space-y-1">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Student Mobile</label>
                                    <input type="tel" id="edit_mobile" value="${data.STUDENT_MOBILE || ''}" maxlength="10" oninput="this.value=this.value.replace(/\\D/g,'')" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                    <span id="err_edit_mobile" class="hidden text-xs text-rose-500 font-semibold">Must be exactly 10 digits.</span>
                                </div>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Date of Birth</label>
                                    <input type="date" id="edit_dob" value="${safeDob}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
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
                                <div class="space-y-1">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Aadhaar (Update Only)</label>
                                    <input type="text" id="edit_aadhar" placeholder="${aadharPlaceholder || '12-digit number'}" maxlength="12" oninput="this.value=this.value.replace(/\\D/g,'')" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                    <span id="err_edit_aadhar" class="hidden text-xs text-rose-500 font-semibold">Aadhaar must be exactly 12 digits.</span>
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Category</label>
                                    <input type="text" id="edit_category" value="${data.CATEGORY || ''}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                </div>
                                <div class="space-y-1.5 md:col-span-2">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Physical Disability / Notes</label>
                                    <input type="text" id="edit_disability" value="${data.PHYSICAL_DISABILITY || ''}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                </div>
                                <div class="space-y-1.5 md:col-span-2">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Contact Email</label>
                                    <input type="email" id="edit_email" value="${data.CONTACT_EMAIL || ''}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                </div>
                                <div class="space-y-1.5 md:col-span-2">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Home Address</label>
                                    <input type="text" id="edit_address" value="${data.HOME_ADDRESS || ''}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                </div>
                            </div>
                        </div>

                        <!-- Family & Guardian -->
                        <div>
                            <h3 class="text-sm font-bold text-brand-500 uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Family & Guardian</h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Father's Name</label>
                                    <input type="text" id="edit_father_name" value="${data.FATHER_NAME || ''}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                </div>
                                <div class="space-y-1">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Father's Mobile</label>
                                    <input type="tel" id="edit_father_mobile" value="${data.FATHER_MOBILE || ''}" maxlength="10" oninput="this.value=this.value.replace(/\\D/g,'')" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                    <span id="err_edit_father_mobile" class="hidden text-xs text-rose-500 font-semibold">Must be exactly 10 digits.</span>
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Mother's Name</label>
                                    <input type="text" id="edit_mother_name" value="${data.MOTHER_NAME || ''}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                </div>
                                <div class="space-y-1">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Mother's Mobile</label>
                                    <input type="tel" id="edit_mother_mobile" value="${data.MOTHER_MOBILE || ''}" maxlength="10" oninput="this.value=this.value.replace(/\\D/g,'')" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all">
                                    <span id="err_edit_mother_mobile" class="hidden text-xs text-rose-500 font-semibold">Must be exactly 10 digits.</span>
                                </div>
                                <div class="space-y-1.5 md:col-span-2 mt-4">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Guardian Details</label>
                                    <div class="grid grid-cols-3 gap-3">
                                        <input type="text" id="edit_guardian_relation" placeholder="Relation (e.g. Father)" value="${data.GUARDIAN_RELATION || ''}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white outline-none">
                                        <input type="text" id="edit_guardian_name" placeholder="Name" value="${data.GUARDIAN_NAME || ''}" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white outline-none">
                                        <input type="tel" id="edit_guardian_mobile" placeholder="Mobile (10 digits)" value="${data.GUARDIAN_MOBILE || ''}" maxlength="10" oninput="this.value=this.value.replace(/\\D/g,'')" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white outline-none">
                                    </div>
                                    <span id="err_edit_guardian_mobile" class="hidden text-xs text-rose-500 font-semibold col-span-3 mt-1">Guardian mobile must be exactly 10 digits.</span>
                                </div>
                            </div>
                        </div>

                        <!-- Media Attachments (CORS-Safe: No Drive image streaming) -->
                        <div>
                            <h3 class="text-sm font-bold text-brand-500 uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Media Attachments</h3>
                            <div class="flex gap-8 items-start">
                                <div class="flex flex-col items-center gap-3">
                                    <span class="text-xs font-bold text-slate-500 uppercase">Photo</span>
                                    <div id="edit_preview_photo" class="w-24 h-28 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                        <svg class="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                    </div>
                                    ${photoViewUrl ? `<a href="${photoViewUrl}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 bg-brand-50 dark:bg-brand-900/30 hover:bg-brand-100 dark:hover:bg-brand-900/50 text-xs font-bold text-brand-600 dark:text-brand-400 rounded-lg transition-colors border border-brand-200 dark:border-brand-800">View Current</a>` : '<span class="text-[10px] text-slate-400 italic">No photo</span>'}
                                    <label class="cursor-pointer px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 rounded-lg transition-colors">
                                        Upload New
                                        <input type="file" class="hidden" accept="image/*" onchange="window.DirectoryViewerModule.processEditAttachment(this, 'edit_preview_photo', 'photoBase64')">
                                    </label>
                                </div>
                                <div class="flex flex-col items-center gap-3">
                                    <span class="text-xs font-bold text-slate-500 uppercase">Signature</span>
                                    <div id="edit_preview_sign" class="h-16 w-32 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                        <svg class="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                    </div>
                                    ${signViewUrl ? `<a href="${signViewUrl}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-xs font-bold text-rose-600 dark:text-rose-400 rounded-lg transition-colors border border-rose-200 dark:border-rose-800">View Current</a>` : '<span class="text-[10px] text-slate-400 italic">No signature</span>'}
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

    // =========================================
    // ✅ FORM VALIDATION ENGINE
    // =========================================

    /**
     * Validates all critical fields in the Edit Modal.
     * Highlights invalid inputs with rose borders and shows inline error messages.
     * Returns true if all pass, false if any fail.
     */
    function validateEditForm() {
        const MOBILE_RE = /^[0-9]{10}$/;
        const AADHAR_RE = /^[0-9]{12}$/;
        let isValid = true;

        // Helper: set or clear error state on a field
        function setError(inputId, errId, failed) {
            const input = document.getElementById(inputId);
            const errSpan = document.getElementById(errId);
            if (!input) return;
            if (failed) {
                input.classList.add('border-rose-500', 'focus:ring-rose-500');
                input.classList.remove('border-slate-200', 'dark:border-slate-700', 'focus:ring-brand-500');
                if (errSpan) errSpan.classList.remove('hidden');
                isValid = false;
            } else {
                input.classList.remove('border-rose-500', 'focus:ring-rose-500');
                input.classList.add('border-slate-200', 'dark:border-slate-700', 'focus:ring-brand-500');
                if (errSpan) errSpan.classList.add('hidden');
            }
        }

        // --- Student Mobile (required, 10 digits) ---
        const studentMobile = (document.getElementById('edit_mobile')?.value || '').trim();
        setError('edit_mobile', 'err_edit_mobile', !MOBILE_RE.test(studentMobile));

        // --- Father Mobile (optional but must be 10 digits if filled) ---
        const fatherMobile = (document.getElementById('edit_father_mobile')?.value || '').trim();
        setError('edit_father_mobile', 'err_edit_father_mobile', fatherMobile.length > 0 && !MOBILE_RE.test(fatherMobile));

        // --- Mother Mobile (optional but must be 10 digits if filled) ---
        const motherMobile = (document.getElementById('edit_mother_mobile')?.value || '').trim();
        setError('edit_mother_mobile', 'err_edit_mother_mobile', motherMobile.length > 0 && !MOBILE_RE.test(motherMobile));

        // --- Guardian Mobile (optional but must be 10 digits if filled) ---
        const guardianMobile = (document.getElementById('edit_guardian_mobile')?.value || '').trim();
        setError('edit_guardian_mobile', 'err_edit_guardian_mobile', guardianMobile.length > 0 && !MOBILE_RE.test(guardianMobile));

        // --- Aadhaar (optional but must be exactly 12 digits if filled) ---
        const aadharRaw = (document.getElementById('edit_aadhar')?.value || '').replace(/\D/g, '');
        setError('edit_aadhar', 'err_edit_aadhar', aadharRaw.length > 0 && !AADHAR_RE.test(aadharRaw));

        // --- Session years (must be 4-digit if filled) ---
        const sessFrom = document.getElementById('edit_sess_from')?.value || '';
        const sessTo = document.getElementById('edit_sess_to')?.value || '';
        const sessFromBad = sessFrom.length > 0 && (sessFrom.length !== 4 || isNaN(sessFrom));
        const sessToBad = sessTo.length > 0 && (sessTo.length !== 4 || isNaN(sessTo));
        setError('edit_sess_from', null, sessFromBad);
        setError('edit_sess_to', null, sessToBad);
        if (sessFromBad || sessToBad) isValid = false;

        return isValid;
    }

    // =========================================
    // 💾 SAVE EDIT (Validation-Gated Submit)
    // =========================================

    /**
     * Commits edits locally and ships the payload to the Code.gs backend.
     * Runs validateEditForm() as a gate before dispatching.
     */
    async function saveEdit(index) {
        // === VALIDATION GATE ===
        const isValid = validateEditForm();
        if (!isValid) {
            if (window.UIUtils) window.UIUtils.showToast("Please fix the highlighted errors before saving.", "error");
            return;
        }

        const btn = document.getElementById('btn_save_edit');
        const oldText = btn.innerHTML;
        btn.innerHTML = `<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Saving...`;
        btn.disabled = true;

        const data = _directoryData[index];

        // Session Recombination
        const sessFrom = document.getElementById('edit_sess_from').value;
        const sessTo = document.getElementById('edit_sess_to').value;
        const combinedSession = (sessFrom && sessTo) ? `${sessFrom}-${sessTo}` : data.SESSION;

        // Aadhar Handling — only overwrite if a new 12-digit value was entered
        const aadharInput = document.getElementById('edit_aadhar').value.replace(/\D/g, '');
        let newAadhar = data.STUDENT_AADHAR;
        if (aadharInput.length === 12) {
            newAadhar = aadharInput;
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
            CONTACT_EMAIL: document.getElementById('edit_email').value.trim(),
            HOME_ADDRESS: document.getElementById('edit_address').value.trim(),
            PHYSICAL_DISABILITY: document.getElementById('edit_disability').value.trim(),
            FATHER_NAME: document.getElementById('edit_father_name').value.trim(),
            FATHER_MOBILE: document.getElementById('edit_father_mobile').value.trim(),
            MOTHER_NAME: document.getElementById('edit_mother_name').value.trim(),
            MOTHER_MOBILE: document.getElementById('edit_mother_mobile').value.trim(),
            GUARDIAN_RELATION: document.getElementById('edit_guardian_relation').value.trim(),
            GUARDIAN_NAME: document.getElementById('edit_guardian_name').value.trim(),
            GUARDIAN_MOBILE: document.getElementById('edit_guardian_mobile').value.trim()
        };

        // Attach new Base64 chunks if user uploaded new media
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

    // =========================================
    // 📥 CSV EXPORT ENGINE
    // =========================================

    function exportToCsv() {
        const dataset = window.currentFilteredDataset || _directoryData;
        if (!dataset || dataset.length === 0) {
            if (window.UIUtils) window.UIUtils.showToast("No data available to export.", "error");
            return;
        }

        // CSV Headers
        const headers = [
            "ID", 
            "Roll No", 
            "Candidate Name", 
            "Enrolled Class", 
            "Class Batch / Days", 
            "Academic Session", 
            "Gender", 
            "Date of Admission"
        ];

        // CSV Rows mapping
        const csvRows = [];
        csvRows.push(headers.join(","));

        dataset.forEach(row => {
            // Clean Date Sanitization
            const cleanDate = window.UIUtils && window.UIUtils.cleanDateTimeString 
                ? window.UIUtils.cleanDateTimeString(row.DATE_OF_ADMISSION)
                : row.DATE_OF_ADMISSION;

            const values = [
                row.STUDENT_ID || '',
                row.RL_NO || '',
                row.STUDENT_NAME || '',
                row.ENROLLED_COURSE || '',
                row.CLASS_BATCH_DAYS || '',
                row.SESSION || '',
                row.GENDER || '',
                cleanDate || ''
            ];

            // Escape commas and quotes securely
            const escapedValues = values.map(v => {
                const str = String(v).replace(/"/g, '""');
                return `"${str}"`;
            });

            csvRows.push(escapedValues.join(","));
        });

        const csvString = csvRows.join("\n");
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement("a");
        a.href = url;
        a.setAttribute("download", `BYTC_Directory_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(a);
        a.click();
        
        // Instant Download Lifecycle cleanup
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // =========================================
    // 📦 PUBLIC API
    // =========================================

    /**
     * Returns the raw candidate record object at the given index
     * from the master directory data array.
     * Used by cross-module bridges (e.g., Pay Fees button → PaymentCollectorModule).
     *
     * @param {number} index — Absolute index into _directoryData
     * @returns {Object|null} The candidate record or null if out-of-bounds
     */
    function getRecordByIndex(index) {
        return _directoryData[index] || null;
    }

    return {
        mount,
        viewRecord,
        editRecord,
        saveEdit,
        deleteRecord,
        printPDF,
        processEditAttachment,
        getBase64FromDriveUrl,
        exportToCsv,
        getRecordByIndex
    };

})();
