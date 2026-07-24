/**
 * ==========================================
 * 📊 PAYMENT LEDGER MODULE (paymentLedger.js)
 * ==========================================
 * Auditing Ledger Engine Development
 * 
 * Features:
 * - Tailwind CSS dark-themed layout interface container
 * - Global search input box and Advanced Filters Drawer
 * - Multi-Criteria Processing Loop with temporal window slicing
 * - Live Financial Aggregates Strip
 * - High-Fidelity Grid UI Template with dd-mm-yyyy and Tailwind badges
 * - Instantaneous Statement CSV Data Exporter
 * 
 * Namespace: window.PaymentLedgerModule
 */
window.PaymentLedgerModule = (function () {
    'use strict';

    // =========================================
    // 🔒 INTERNAL STATE
    // =========================================
    let _container = null;
    let _rawLedgerDataset = [];
    window.currentFilteredLedgerDataset = [];
    let _currentViewMode = 'PAID';

    let _ledgerCurrentPage = 1;
    const _ledgerRowsPerPage = 10; // Optimized view count window for financial log views
    let _ledgerFilteredPool = [];  // Dynamic storage cache array for filtered data structures

    // =========================================
    // 🔧 UTILITY HELPERS
    // =========================================

    function getAuthToken() {
        return window.SystemConfig ? localStorage.getItem(window.SystemConfig.AUTH_KEY) : '';
    }

    /**
     * Formats an ISO string or Date into dd-mm-yyyy
     */
    function formatDateDisplay(dateStr) {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'N/A';
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    }

    /**
     * Escapes a value for safe use inside an HTML attribute string.
     * Prevents onclick/data-* injection from apostrophes, quotes, or
     * angle brackets inside student names, period strings, etc.
     */
    function escAttr(val) {
        return String(val || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // =========================================
    // 🚀 MODULE LIFECYCLE (Upgraded with Auto-Hydration)
    // =========================================

    async function mount(container) {
        _container = container;
        _container.innerHTML = buildShellHTML();

        // 1. Auto-Hydration Check
        // If the user navigates here directly, the global cache will be empty.
        if (!window.MasterCandidateCache || window.MasterCandidateCache.length === 0) {
            console.info('[PaymentLedger] Master cache empty. Initiating auto-hydration...');
            toggleSpinner(true);

            try {
                // 2. The Fetch Fallback
                const res = await window.UIUtils.fetchFromEngine({
                    action: 'FETCH_DIRECTORY',
                    token: getAuthToken()
                });

                if (res && res.status === 'success' && Array.isArray(res.data)) {
                    window.MasterCandidateCache = res.data;
                    console.info('[PaymentLedger] Auto-hydration complete. Cache populated.');
                } else {
                    console.warn('[PaymentLedger] Auto-hydration returned invalid data.');
                }
            } catch (error) {
                console.error('[PaymentLedger] Auto-hydration network failure:', error);
                if (window.UIUtils) window.UIUtils.showToast('Failed to load student directory.', 'error');
            }

            toggleSpinner(false);
        }

        // 3. Safe Rendering
        // The dropdowns and filters will now map correctly to the fully populated cache.
        populateDropdowns();

        // Implement Default Dates
        const startInput = document.getElementById('ledgerStartDate');
        const endInput = document.getElementById('ledgerEndDate');
        if (startInput && endInput && !startInput.value && !endInput.value) {
            const today = new Date();
            const thirtyDaysAgo = new Date(today);
            thirtyDaysAgo.setDate(today.getDate() - 30);

            const formatDate = (date) => {
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            };

            startInput.value = formatDate(thirtyDaysAgo);
            endInput.value = formatDate(today);
        }

        // Perform initial fetch for the Ledger Logs
        await fetchAndApplyFilters();
    }

    function init() {
        // Entry hook executed by navigation link
        _rawLedgerDataset = [];
        window.currentFilteredLedgerDataset = [];

        if (window.AppCore && window.AppCore.navigateTo) {
            window.AppCore.navigateTo('paymentLedger');
        }
    }

    // =========================================
    // 🏗️ SHELL HTML BUILDER
    // =========================================
    function buildShellHTML() {
        return `
            <div id="ledgerShell" class="max-w-7xl mx-auto space-y-6 animate-fade-in pb-16">
                
                <!-- ═══════════════════════════════════════ -->
                <!-- HEADER & COMMAND ROW                    -->
                <!-- ═══════════════════════════════════════ -->
                <div class="relative bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700/80 overflow-hidden">
                    <div class="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 blur-3xl pointer-events-none"></div>
                    <div class="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-brand-500/5 dark:bg-brand-500/10 blur-3xl pointer-events-none"></div>
                    
                    <div class="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                            </div>
                            <div>
                                <h1 class="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">📊 Payment Ledger</h1>
                                <p class="text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">Auditing Engine & Financial Statements</p>
                            </div>
                        </div>

                        <div class="w-full md:w-auto flex flex-col sm:flex-row items-center gap-3">
                            <!-- Global Search -->
                            <div class="relative w-full sm:w-64">
                                <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <svg class="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                </div>
                                <input type="text" id="ledgerSearchInput" placeholder="Search Name, ID, TXN..."
                                    oninput="window.PaymentLedgerModule.applyLedgerFilters()"
                                    class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-medium text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner">
                            </div>
                            <!-- Export Button -->
                            <button onclick="window.PaymentLedgerModule.exportToCSV()" class="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-sm active:scale-[0.97] shrink-0">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                📥 Download Statement Report
                            </button>
                        </div>
                    </div>

                    <!-- Toggle Drawer Button -->
                    <div class="relative z-10 mt-6 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                        <button onclick="window.PaymentLedgerModule.toggleFilters()" class="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                            <svg id="ledgerFilterChevron" class="w-4 h-4 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                            Toggle Advanced Filters
                        </button>
                    </div>
                </div>

                <!-- ═══════════════════════════════════════ -->
                <!-- ADVANCED FILTER CONTROLS DRAWER         -->
                <!-- ═══════════════════════════════════════ -->
                <div id="ledgerFilterPanel" class="hidden bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700/80 shadow-sm transition-all duration-300">
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enrolled Course</label>
                            <select id="ledgerCourseFilter" onchange="window.PaymentLedgerModule.applyLedgerFilters()" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-medium text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
                                <option value="">All Courses</option>
                            </select>
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Class Batch / Days</label>
                            <select id="ledgerBatchFilter" onchange="window.PaymentLedgerModule.applyLedgerFilters()" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-medium text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
                                <option value="">All Batches</option>
                            </select>
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">From Date</label>
                            <input type="date" id="ledgerStartDate" onchange="window.PaymentLedgerModule.fetchAndApplyFilters()" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-medium text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">To Date</label>
                            <input type="date" id="ledgerEndDate" onchange="window.PaymentLedgerModule.fetchAndApplyFilters()" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-medium text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
                        </div>
                    </div>
                    
                    <!-- NEW: PAID / DUE TOGGLE -->
                    <div class="mt-6 flex justify-center w-full">
                         <div class="inline-flex bg-slate-100 dark:bg-slate-900 rounded-xl p-1.5 shadow-inner">
                            <label class="relative cursor-pointer">
                                <input type="radio" name="ledgerViewMode" value="PAID" checked onchange="window.PaymentLedgerModule.fetchAndApplyFilters()" class="peer sr-only">
                                <div class="px-8 py-2.5 rounded-lg text-sm font-black tracking-wider uppercase text-slate-500 dark:text-slate-400 peer-checked:bg-white peer-checked:dark:bg-slate-800 peer-checked:text-indigo-600 peer-checked:dark:text-indigo-400 peer-checked:shadow-sm transition-all">
                                    PAID TRANSACTIONS
                                </div>
                            </label>
                            <label class="relative cursor-pointer">
                                <input type="radio" name="ledgerViewMode" value="DUE" onchange="window.PaymentLedgerModule.fetchAndApplyFilters()" class="peer sr-only">
                                <div class="px-8 py-2.5 rounded-lg text-sm font-black tracking-wider uppercase text-slate-500 dark:text-slate-400 peer-checked:bg-white peer-checked:dark:bg-slate-800 peer-checked:text-rose-600 peer-checked:dark:text-rose-400 peer-checked:shadow-sm transition-all">
                                    DUE / DEFAULTERS
                                </div>
                            </label>
                         </div>
                    </div>
                </div>

                <!-- ═══════════════════════════════════════ -->
                <!-- LIVE FINANCIAL AGGREGATES STRIP         -->
                <!-- ═══════════════════════════════════════ -->
                <div class="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div class="flex items-center gap-3">
                        <div id="ledgerSpinner" class="hidden w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-800/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        </div>
                        <div id="ledgerReadyIcon" class="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-800/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                        <p id="ledgerSummaryRows" class="text-sm font-bold text-slate-700 dark:text-slate-300">Showing 0 audited transaction logs.</p>
                    </div>
                    <div class="flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
                        <span class="text-xs font-black text-slate-400 uppercase tracking-wider">Liquid Statement Volume:</span>
                        <span id="ledgerSummaryVolume" class="text-lg font-black text-emerald-600 dark:text-emerald-400">₹ 0</span>
                    </div>
                </div>

                <!-- ═══════════════════════════════════════ -->
                <!-- HIGH-FIDELITY GRID UI TEMPLATE          -->
                <!-- ═══════════════════════════════════════ -->
                <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700/80 overflow-hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr id="ledgerTableHeadRow" class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Date</th>
                                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Transaction ID</th>
                                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Student Details</th>
                                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Course / Batch</th>
                                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Fee Period</th>
                                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Status</th>
                                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">Amount</th>
                                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="ledgerGridBody" class="divide-y divide-slate-100 dark:divide-slate-700/50">
                                <!-- Rendered dynamically -->
                            </tbody>
                        </table>
                    </div>
                    <div id="ledger_pagination_controls"></div>
                    <!-- Empty State -->
                    <div id="ledgerEmptyState" class="hidden flex-col items-center justify-center p-12 text-slate-400">
                        <svg class="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                        <p class="text-sm font-bold">No transactions match your filters.</p>
                    </div>
                </div>
            </div>
        `;
    }

    // =========================================
    // 🎛️ UI INTERACTIONS
    // =========================================

    function toggleFilters() {
        const panel = document.getElementById('ledgerFilterPanel');
        const chevron = document.getElementById('ledgerFilterChevron');
        if (!panel || !chevron) return;

        if (panel.classList.contains('hidden')) {
            panel.classList.remove('hidden');
            chevron.classList.add('rotate-180');
        } else {
            panel.classList.add('hidden');
            chevron.classList.remove('rotate-180');
        }
    }

    function populateDropdowns() {
        const courseSelect = document.getElementById('ledgerCourseFilter');
        const batchSelect = document.getElementById('ledgerBatchFilter');
        if (!courseSelect || !batchSelect || !window.MasterCandidateCache) return;

        const courses = new Set();
        const batches = new Set();

        window.MasterCandidateCache.forEach(c => {
            if (c.ENROLLED_COURSE) courses.add(String(c.ENROLLED_COURSE).trim());
            if (c.CLASS_BATCH_DAYS) batches.add(String(c.CLASS_BATCH_DAYS).trim());
        });

        // Generate options dynamically
        courses.forEach(course => {
            if (!course) return;
            const opt = document.createElement('option');
            opt.value = course;
            opt.textContent = course;
            courseSelect.appendChild(opt);
        });

        batches.forEach(batch => {
            if (!batch) return;
            const opt = document.createElement('option');
            opt.value = batch;
            opt.textContent = batch;
            batchSelect.appendChild(opt);
        });
    }



    function toggleSpinner(show) {
        const spinner = document.getElementById('ledgerSpinner');
        const readyIcon = document.getElementById('ledgerReadyIcon');
        if (spinner && readyIcon) {
            if (show) {
                spinner.classList.remove('hidden');
                readyIcon.classList.add('hidden');
            } else {
                spinner.classList.add('hidden');
                readyIcon.classList.remove('hidden');
            }
        }
    }

    // =========================================
    // 📡 DATA FETCHING (Range Aggregator)
    // =========================================

    async function fetchAndApplyFilters() {
        const startInput = document.getElementById('ledgerStartDate');
        const endInput = document.getElementById('ledgerEndDate');
        const viewModeEl = document.querySelector('input[name="ledgerViewMode"]:checked');

        const startDate = startInput ? startInput.value : '';
        const endDate = endInput ? endInput.value : '';
        const viewMode = viewModeEl ? viewModeEl.value : 'PAID';

        if (!startDate || !endDate) return;

        _currentViewMode = viewMode;

        // UI/UX Enhancement: Disable Course/Batch dropdowns in PAID mode
        const courseSelect = document.getElementById('ledgerCourseFilter');
        const batchSelect = document.getElementById('ledgerBatchFilter');
        if (courseSelect) courseSelect.disabled = (_currentViewMode === 'PAID');
        if (batchSelect) batchSelect.disabled = (_currentViewMode === 'PAID');

        toggleSpinner(true);
        renderLedgerTableSkeleton(); // ⚡ Phase 1: Fire visual placeholders immediately

        try {
            const res = await window.UIUtils.fetchFromEngine({
                action: 'FETCH_AUDIT_REPORT',
                token: getAuthToken(),
                startDate: startDate,
                endDate: endDate,
                viewMode: viewMode
            });

            if (res && res.status === 'success' && Array.isArray(res.data)) {
                _rawLedgerDataset = res.data;
                initializeLedgerPool(_rawLedgerDataset);
            } else {
                _rawLedgerDataset = [];
                if (res && res.message) {
                    console.debug('[PaymentLedger] Fetch warning:', res.message);
                }
            }
        } catch (err) {
            console.error('[PaymentLedger] Failed to fetch statement range:', err);
            _rawLedgerDataset = [];
            if (window.UIUtils) window.UIUtils.showToast('Failed to fetch ledger logs.', 'error');
        } finally {
            toggleSpinner(false);
            applyLedgerFilters();
        }
    }

    // =========================================
    // 🔄 MULTI-CRITERIA PROCESSING LOOP
    // =========================================

    /**
     * In-memory compiler that filters the downloaded log dataset locally 
     * based on active input and dropdown parameters.
     */
    function applyLedgerFilters() {
        const searchInput = document.getElementById('ledgerSearchInput');
        const courseSelect = document.getElementById('ledgerCourseFilter');
        const batchSelect = document.getElementById('ledgerBatchFilter');

        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const courseQuery = courseSelect ? courseSelect.value : '';
        const batchQuery = batchSelect ? batchSelect.value : '';

        const candidateMap = {};
        if (window.MasterCandidateCache) {
            for (let i = 0; i < window.MasterCandidateCache.length; i++) {
                const c = window.MasterCandidateCache[i];
                if (c.STUDENT_ID) {
                    candidateMap[c.STUDENT_ID] = {
                        course: c.ENROLLED_COURSE || '',
                        batch: c.CLASS_BATCH_DAYS || ''
                    };
                }
            }
        }

        window.currentFilteredLedgerDataset = _rawLedgerDataset.filter(log => {
            const logStudentId = String(log.STUDENT_ID || '').trim();

            let course = '';
            let batch = '';

            if (_currentViewMode === 'PAID') {
                const candidateInfo = candidateMap[logStudentId] || { course: '', batch: '' };
                log._course = candidateInfo.course;
                log._batch = candidateInfo.batch;
                // Skip course and batch filter checking for PAID mode
            } else {
                course = log.ENROLLED_COURSE || '';
                batch = log.CLASS_BATCH_DAYS || '';
                log._course = course;
                log._batch = batch;

                if (courseQuery && course !== courseQuery) return false;
                if (batchQuery && batch !== batchQuery) return false;
            }

            if (query) {
                const nameMatch = log.STUDENT_NAME && String(log.STUDENT_NAME).toLowerCase().includes(query);
                const idMatch = log.STUDENT_ID && String(log.STUDENT_ID).toLowerCase().includes(query);
                const rlMatch = log.RL_NO && String(log.RL_NO).toLowerCase().includes(query);
                const txnMatch = _currentViewMode === 'PAID' && log.TXN_ID && String(log.TXN_ID).toLowerCase().includes(query);
                if (!nameMatch && !idMatch && !rlMatch && !txnMatch) return false;
            }

            return true;
        });

        if (_currentViewMode === 'PAID') {
            window.currentFilteredLedgerDataset.sort((a, b) => {
                const d1 = new Date(a.TIMESTAMP).getTime();
                const d2 = new Date(b.TIMESTAMP).getTime();
                return d2 - d1;
            });
        }

        // Update Aggregate UI Counters directly to existing DOM IDs
        let totalRevenue = 0;
        window.currentFilteredLedgerDataset.forEach(row => {
            totalRevenue += _currentViewMode === 'PAID' ? (Number(row.AMOUNT_COLLECTED) || 0) : 0;
        });

        const rowsText = document.getElementById('ledgerSummaryRows');
        const volText = document.getElementById('ledgerSummaryVolume');

        if (rowsText) rowsText.innerText = `Showing ${window.currentFilteredLedgerDataset.length} audited transaction logs.`;
        if (volText) volText.innerText = `₹ ${totalRevenue}`;

        _ledgerFilteredPool = [...window.currentFilteredLedgerDataset];
        _ledgerCurrentPage = 1;
        renderPaginatedLedger();
    }

    function renderLedgerTableSkeleton() {
        const targetBody = document.getElementById('ledgerGridBody');
        if (!targetBody) return;

        let skeletonHtml = '';
        for (let i = 0; i < 8; i++) {
            skeletonHtml += `
            <tr class="animate-pulse border-b border-slate-100 dark:border-slate-800/50">
                <td class="p-3"><div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20 font-mono"></div></td>
                <td class="p-3">
                    <div class="space-y-1.5">
                        <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32"></div>
                        <div class="h-3 bg-slate-100 dark:bg-slate-800 rounded w-24"></div>
                    </div>
                </td>
                <td class="p-3"><div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16"></div></td>
                <td class="p-3"><div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-36 text-brand-600"></div></td>
                <td class="p-3"><div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16 font-mono"></div></td>
                <td class="p-3 text-center"><div class="h-5 bg-slate-200 dark:bg-slate-700 rounded w-14 inline-block"></div></td>
            </tr>`;
        }
        targetBody.innerHTML = skeletonHtml;
    }

    function initializeLedgerPool(rawLogsArray) {
        // Reverse chronological sort: Pulls newest logs to the top via Txn string patterns or implicit row indices
        _ledgerFilteredPool = [...rawLogsArray].sort((a, b) => {
            return String(b.TXN_ID || '').localeCompare(String(a.TXN_ID || ''));
        });

        _ledgerCurrentPage = 1;
        renderPaginatedLedger();
    }

    function renderPaginatedLedger() {
        const tableBody = document.getElementById('ledgerGridBody');
        const controlsContainer = document.getElementById('ledger_pagination_controls');
        const theadRow = document.getElementById('ledgerTableHeadRow');

        if (!tableBody) return;

        if (theadRow) {
            if (_currentViewMode === 'DUE') {
                theadRow.innerHTML = `
                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Student Name</th>
                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Roll No</th>
                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Course</th>
                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Batch / Days</th>
                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Contact Mobile</th>
                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Admission Date</th>
                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">Actions</th>
                `;
            } else {
                theadRow.innerHTML = `
                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Date</th>
                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Transaction ID</th>
                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Student Details</th>
                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Course / Batch</th>
                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Fee Period</th>
                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Status</th>
                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">Amount</th>
                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">Actions</th>
                `;
            }
        }

        const totalItems = _ledgerFilteredPool.length;
        const totalPages = Math.ceil(totalItems / _ledgerRowsPerPage) || 1;

        // Boundary corrections
        if (_ledgerCurrentPage > totalPages) _ledgerCurrentPage = totalPages;
        if (_ledgerCurrentPage < 1) _ledgerCurrentPage = 1;

        const startIdx = (_ledgerCurrentPage - 1) * _ledgerRowsPerPage;
        const endIdx = Math.min(startIdx + _ledgerRowsPerPage, totalItems);
        const displayedItems = _ledgerFilteredPool.slice(startIdx, endIdx);

        if (displayedItems.length === 0) {
            const colspan = _currentViewMode === 'DUE' ? 7 : 8;
            tableBody.innerHTML = `<tr><td colspan="${colspan}" class="p-8 text-center text-xs font-bold text-slate-400 tracking-wide uppercase">No entries match your lookup preferences.</td></tr>`;
            if (controlsContainer) controlsContainer.innerHTML = '';
            return;
        }

        // Map rows - Preserving our custom notification resend links inside the Name column cell frame
        tableBody.innerHTML = displayedItems.map(item => {
            const safeStudentId = escAttr(item.STUDENT_ID);

            if (_currentViewMode === 'DUE') {
                return `
                <tr class="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                    <td class="p-3">
                        <div class="text-xs font-bold text-slate-800 dark:text-slate-200">${item.STUDENT_NAME || 'N/A'}</div>
                        <div class="text-[10px] text-slate-400 font-medium mt-0.5">${item.STUDENT_ID || ''}</div>
                    </td>
                    <td class="p-3 font-mono text-xs font-bold text-slate-600 dark:text-slate-300">${item.RL_NO || 'N/A'}</td>
                    <td class="p-3 text-xs font-semibold text-slate-600 dark:text-slate-300">${item.ENROLLED_COURSE || 'N/A'}</td>
                    <td class="p-3 text-xs text-slate-500 dark:text-slate-400">${item.CLASS_BATCH_DAYS || 'N/A'}</td>
                    <td class="p-3 font-mono text-xs font-bold tracking-wide text-indigo-500">${item.STUDENT_MOBILE || 'N/A'}</td>
                    <td class="p-3 text-xs text-slate-500 dark:text-slate-400">${window.UIUtils ? window.UIUtils.cleanDateTimeString(item.DATE_OF_ADMISSION) : (item.DATE_OF_ADMISSION || 'N/A')}</td>
                    <td class="p-3 text-center align-middle">
                        <button onclick="(async function(){
                            if(window.AppCore && window.AppCore.navigateTo) { await window.AppCore.navigateTo('paymentCollector'); }
                            if(window.PaymentCollectorModule && window.PaymentCollectorModule.openCartForCandidate) {
                                window.PaymentCollectorModule.openCartForCandidate({STUDENT_ID: '${safeStudentId}'});
                            }
                        })()" class="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors" title="Pay Fees">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                        </button>
                    </td>
                </tr>`;
            }

            // Re-apply display date formatting just as before, targeting backend variables
            let displayDate = 'N/A';
            const rawDate = item.TRANSACTION_DATE || item.DATE || item.TIMESTAMP;
            if (rawDate) {
                let d = new Date(rawDate);
                if (isNaN(d.getTime()) && typeof rawDate === 'string') {
                    const parts = rawDate.split(/[\/\-]/);
                    if (parts.length === 3) d = new Date(parts[2], parts[1] - 1, parts[0]);
                }
                if (!isNaN(d.getTime())) {
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = d.toLocaleString('en-IN', { month: 'short' });
                    const year = d.getFullYear();
                    displayDate = `${day} ${month} ${year}`;
                } else if (typeof rawDate === 'string') {
                    displayDate = rawDate;
                }
            }

            const courseBatchText = (item._course || item._batch)
                ? `${item._course || 'N/A'} <br> <span class="text-[10px] text-slate-500 dark:text-slate-400">${item._batch || ''}</span>`
                : 'N/A';

            // Premium Status Badge Resolution Rule
            const activeStatus = item.STATUS || 'PAID';
            const statusClass = activeStatus === 'PAID'
                ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                : 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400';

            // Safely escape all data values that will appear in inline onclick attributes
            const safeTxnId     = escAttr(item.TXN_ID);
            const safeAmount    = escAttr(item.AMOUNT_COLLECTED);
            const safeFeePeriod = escAttr(item.FEE_PERIOD);

            return `
            <tr class="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                <td class="p-3 font-mono text-xs text-indigo-500 font-bold tracking-wide">${displayDate}</td>
                <td class="p-3 font-mono text-xs text-indigo-500 font-bold tracking-wide">${item.TXN_ID || 'N/A'}</td>
                <td class="p-3">
                    <div class="text-xs font-bold text-slate-800 dark:text-slate-200">${item.STUDENT_NAME || 'N/A'}</div>
                    <div class="text-[10px] text-slate-400 font-medium mt-0.5">${item.STUDENT_ID || ''}</div>
                </td>
                <td class="p-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    ${courseBatchText}
                </td>
                <td class="p-3 text-xs font-bold text-slate-600 dark:text-slate-300">${item.FEE_PERIOD || 'N/A'}</td>
                <td class="p-3 text-center align-middle">
                    <span class="px-2 py-0.5 text-[10px] font-bold uppercase rounded ${statusClass} tracking-wider">${activeStatus}</span>
                </td>
                <td class="p-3 text-right text-xs font-black font-mono text-slate-800 dark:text-slate-100">&#x20B9; ${Number(item.AMOUNT_COLLECTED || 0).toLocaleString('en-IN')}.00</td>

                <!-- ═══════════════════════════════════════════════════════ -->
                <!-- ACTIONS COLUMN: Download · Email · WhatsApp             -->
                <!-- escAttr() guarantees all row data is injection-safe     -->
                <!-- ═══════════════════════════════════════════════════════ -->
                <td class="p-3 text-center align-middle">
                    <div class="flex items-center justify-center gap-1.5">

                        <!-- 📥 LOCAL PDF DOWNLOAD -->
                        <button
                            type="button"
                            title="Download PDF Receipt"
                            class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-sky-100 dark:hover:bg-sky-900/30 text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 border border-slate-200 dark:border-slate-700 hover:border-sky-300 dark:hover:border-sky-700 transition-all duration-150 active:scale-90 shadow-sm"
                            onclick="(function(){
                                const s = (window.MasterCandidateCache || []).find(function(x){ return x.STUDENT_ID === '${safeStudentId}'; });
                                const candidate = s || { STUDENT_ID: '${safeStudentId}', STUDENT_NAME: '${escAttr(item.STUDENT_NAME)}', RL_NO: '${escAttr(item.RL_NO)}', ENROLLED_COURSE: '${escAttr(item._course)}' };
                                if (window.FeePDFGeneratorModule && window.FeePDFGeneratorModule.downloadFeePDF) {
                                    window.FeePDFGeneratorModule.downloadFeePDF(candidate, { txnId: '${safeTxnId}', amount: '${safeAmount}', feePeriods: '${safeFeePeriod}' });
                                } else if (window.UIUtils) {
                                    window.UIUtils.showToast('PDF module not loaded.', 'error');
                                }
                            })()">
                            <!-- Download cloud-arrow-down SVG icon -->
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                            </svg>
                        </button>

                        <!-- 📧 EMAIL RESEND -->
                        <button
                            type="button"
                            title="Resend Receipt by Email"
                            class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-150 active:scale-90 shadow-sm"
                            onclick="(function(){
                                const s = (window.MasterCandidateCache || []).find(function(x){ return x.STUDENT_ID === '${safeStudentId}'; });
                                if (!s) { if(window.UIUtils) window.UIUtils.showToast('Student record not in cache.', 'error'); return; }
                                if (window.NotificationUtils) {
                                    window.NotificationUtils.dispatchFeeNotification(s, { txnId: '${safeTxnId}', amount: '${safeAmount}', feePeriods: '${safeFeePeriod}' }, true, false);
                                }
                            })()">
                            <!-- Envelope SVG icon -->
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                            </svg>
                        </button>

                        <!-- 💬 WHATSAPP REDIRECT -->
                        <button
                            type="button"
                            title="Send Receipt via WhatsApp"
                            class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all duration-150 active:scale-90 shadow-sm"
                            onclick="(function(){
                                const s = (window.MasterCandidateCache || []).find(function(x){ return x.STUDENT_ID === '${safeStudentId}'; });
                                if (!s) { if(window.UIUtils) window.UIUtils.showToast('Student record not in cache.', 'error'); return; }
                                if (window.NotificationUtils) {
                                    window.NotificationUtils.dispatchFeeNotification(s, { txnId: '${safeTxnId}', amount: '${safeAmount}', feePeriods: '${safeFeePeriod}' }, false, true);
                                }
                            })()">
                            <!-- Chat-bubble SVG icon (WhatsApp style) -->
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                            </svg>
                        </button>

                    </div>
                </td>
            </tr>
        `}).join('');

        // Render modern control action row elements toolbar panel
        if (controlsContainer) {
            controlsContainer.innerHTML = `
            <div class="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900/20 border-t border-slate-100 dark:border-slate-800/80 rounded-b-xl select-none text-xs">
                <div class="font-semibold text-slate-500">
                    Displaying Ledger Rows <span class="text-slate-800 dark:text-slate-200">${startIdx + 1}</span> to <span class="text-slate-800 dark:text-slate-200">${endIdx}</span> of <span class="text-slate-800 dark:text-slate-200">${totalItems}</span> statements
                </div>
                <div class="flex items-center gap-1">
                    <button type="button" ${_ledgerCurrentPage === 1 ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 font-bold bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all" onclick="window.PaymentLedgerModule.goToPage(${_ledgerCurrentPage - 1});">
                        Previous
                    </button>
                    <div class="px-3 font-bold text-slate-700 dark:text-slate-300">
                        Page ${_ledgerCurrentPage} of ${totalPages}
                    </div>
                    <button type="button" ${_ledgerCurrentPage === totalPages ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 font-bold bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all" onclick="window.PaymentLedgerModule.goToPage(${_ledgerCurrentPage + 1});">
                        Next
                    </button>
                </div>
            </div>`;
        }
    }

    // =========================================
    // 📥 STATEMENT CSV DATA EXPORTER
    // =========================================

    function exportToCSV() {
        if (!window.currentFilteredLedgerDataset || window.currentFilteredLedgerDataset.length === 0) {
            if (window.UIUtils) window.UIUtils.showToast("No data available to export.", "error");
            return;
        }

        let csvContent = "";
        let fileName = "";
        const timestamp = new Date().toISOString().slice(0, 10);

        if (_currentViewMode === 'DUE') {
            csvContent = "Student Name,Student ID,Roll No,Course,Batch,Contact,Admission Date\n";
            window.currentFilteredLedgerDataset.forEach(item => {
                const row = [
                    `"${item.STUDENT_NAME || 'N/A'}"`,
                    item.STUDENT_ID || 'N/A',
                    item.RL_NO || 'N/A',
                    `"${item.ENROLLED_COURSE || 'N/A'}"`,
                    `"${item.CLASS_BATCH_DAYS || 'N/A'}"`,
                    item.STUDENT_MOBILE || 'N/A',
                    item.DATE_OF_ADMISSION || 'N/A'
                ];
                csvContent += row.join(",") + "\n";
            });
            fileName = `Defaulters_Export_${timestamp}.csv`;
        } else {
            csvContent = "Transaction ID,Timestamp,Student Name,Student ID,Billing Period,Amount,Status\n";
            window.currentFilteredLedgerDataset.forEach(item => {
                const dateObj = new Date(item.TIMESTAMP);
                const displayDate = isNaN(dateObj.getTime()) ? 'N/A' : dateObj.toLocaleDateString('en-IN');
                const row = [
                    item.TXN_ID || 'N/A',
                    displayDate,
                    `"${item.STUDENT_NAME || 'N/A'}"`,
                    item.STUDENT_ID || 'N/A',
                    item.FEE_PERIOD || 'N/A',
                    item.AMOUNT_COLLECTED || 0,
                    item.STATUS || 'UNKNOWN'
                ];
                csvContent += row.join(",") + "\n";
            });
            fileName = `Statement_Export_${timestamp}.csv`;
        }

        // Trigger the download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function goToPage(page) {
        const totalPages = Math.ceil(_ledgerFilteredPool.length / _ledgerRowsPerPage) || 1;
        const safePage = Math.max(1, Math.min(page, totalPages));
        if (safePage === _ledgerCurrentPage) return;
        _ledgerCurrentPage = safePage;
        renderPaginatedLedger();

        const tableEl = document.getElementById('ledgerGridBody');
        if (tableEl) tableEl.closest('.overflow-x-auto')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Clean Global Scoping Export Return Wrapper
    return {
        init: init,
        mount: mount,
        toggleFilters: toggleFilters,
        applyLedgerFilters: applyLedgerFilters,
        fetchAndApplyFilters: fetchAndApplyFilters,
        exportToCSV: exportToCSV,
        goToPage: goToPage,
        renderPaginatedLedger: renderPaginatedLedger
    };

})(); // End IIFE Wrapper
