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

    // =========================================
    // 🚀 MODULE LIFECYCLE
    // =========================================

    async function mount(container) {
        _container = container;
        _container.innerHTML = buildShellHTML();

        // Populate course and batch dropdowns from MasterCandidateCache if available
        populateDropdowns();

        // Default to current year range
        setDefaultDateRange();

        // Perform initial fetch
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
                            <input type="date" id="ledgerFromDate" onchange="window.PaymentLedgerModule.fetchAndApplyFilters()" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-medium text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">To Date</label>
                            <input type="date" id="ledgerToDate" onchange="window.PaymentLedgerModule.fetchAndApplyFilters()" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-medium text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
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
                                <tr class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Date</th>
                                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Transaction ID</th>
                                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Student Details</th>
                                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Course / Batch</th>
                                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Fee Period</th>
                                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Status</th>
                                    <th class="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right whitespace-nowrap">Amount</th>
                                </tr>
                            </thead>
                            <tbody id="ledgerGridBody" class="divide-y divide-slate-100 dark:divide-slate-700/50">
                                <!-- Rendered dynamically -->
                            </tbody>
                        </table>
                    </div>
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

    function setDefaultDateRange() {
        const fromInput = document.getElementById('ledgerFromDate');
        const toInput = document.getElementById('ledgerToDate');

        if (!fromInput || !toInput) return;

        const currentYear = new Date().getFullYear();

        // Fix: Standardized template string literal generation with zero escape errors
        fromInput.value = `${currentYear}-01-01`;

        const endOfDec = new Date(currentYear, 11, 31);
        toInput.value = endOfDec.toISOString().split('T')[0];
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
        const fromInput = document.getElementById('ledgerFromDate');
        const toInput = document.getElementById('ledgerToDate');

        if (!fromInput || !toInput) return;

        const dateFrom = new Date(fromInput.value);
        const dateTo = new Date(toInput.value);

        // Safety Check: Calculate total annual query span
        const yearDifference = dateTo.getFullYear() - dateFrom.getFullYear();

        if (yearDifference > 2) {
            if (window.UIUtils && typeof window.UIUtils.showToast === 'function') {
                window.UIUtils.showToast("To maintain high speed, please restrict your statement search window to a maximum duration of 2 consecutive years.", "warning");
            } else {
                alert("To maintain high speed, please restrict your statement search window to a maximum duration of 2 consecutive years.");
            }
            return; // Hard stop: Terminate network request execution to protect backend memory
        }

        const startDate = fromInput.value;
        const endDate = toInput.value;

        if (!startDate || !endDate) return;

        toggleSpinner(true);

        try {
            const res = await window.UIUtils.fetchFromEngine({
                action: 'FETCH_STATEMENT_RANGE',
                token: getAuthToken(),
                startDate: startDate,
                endDate: endDate
            });

            if (res && res.status === 'success' && Array.isArray(res.data)) {
                _rawLedgerDataset = res.data;
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
        const fromInput = document.getElementById('ledgerFromDate');
        const toInput = document.getElementById('ledgerToDate');

        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const courseQuery = courseSelect ? courseSelect.value : '';
        const batchQuery = batchSelect ? batchSelect.value : '';
        
        const startDate = fromInput && fromInput.value ? new Date(fromInput.value + 'T00:00:00') : null;
        const endDate = toInput && toInput.value ? new Date(toInput.value + 'T23:59:59') : null;

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
            const candidateInfo = candidateMap[logStudentId] || { course: '', batch: '' };

            log._course = candidateInfo.course;
            log._batch = candidateInfo.batch;

            if (courseQuery && candidateInfo.course !== courseQuery) return false;
            if (batchQuery && candidateInfo.batch !== batchQuery) return false;

            let matchesDate = true;
            if (log.TIMESTAMP) {
                let logDate = new Date(log.TIMESTAMP);
                // Resilient parser for DD/MM/YYYY or MM/DD/YYYY from Sheets
                if (isNaN(logDate.getTime()) && typeof log.TIMESTAMP === 'string') {
                    const parts = log.TIMESTAMP.split(/[\/\-]/);
                    if (parts.length === 3) {
                        logDate = new Date(parts[2], parts[1] - 1, parts[0]);
                    }
                }
                if (!isNaN(logDate.getTime())) {
                    if (startDate && logDate < startDate) matchesDate = false;
                    if (endDate && logDate > endDate) matchesDate = false;
                }
            }
            if (!matchesDate) return false;

            if (query) {
                const nameMatch = log.STUDENT_NAME && String(log.STUDENT_NAME).toLowerCase().includes(query);
                const idMatch = log.STUDENT_ID && String(log.STUDENT_ID).toLowerCase().includes(query);
                const rlMatch = log.RL_NO && String(log.RL_NO).toLowerCase().includes(query);
                const txnMatch = log.TXN_ID && String(log.TXN_ID).toLowerCase().includes(query);
                if (!nameMatch && !idMatch && !rlMatch && !txnMatch) return false;
            }

            return true;
        });

        window.currentFilteredLedgerDataset.sort((a, b) => {
            const d1 = new Date(a.TIMESTAMP).getTime();
            const d2 = new Date(b.TIMESTAMP).getTime();
            return d2 - d1;
        });

        // Update Aggregate UI Counters directly to existing DOM IDs
        let totalRevenue = 0;
        window.currentFilteredLedgerDataset.forEach(row => {
            totalRevenue += Number(row.AMOUNT_COLLECTED) || 0;
        });

        const rowsText = document.getElementById('ledgerSummaryRows');
        const volText = document.getElementById('ledgerSummaryVolume');
        
        if (rowsText) rowsText.innerText = `Showing ${window.currentFilteredLedgerDataset.length} audited transaction logs.`;
        if (volText) volText.innerText = `₹ ${totalRevenue}`;

        renderLedgerTable(window.currentFilteredLedgerDataset);
    }

    function renderLedgerTable(records) {
        const tbody = document.getElementById('ledgerGridBody');
        const emptyState = document.getElementById('ledgerEmptyState');
        
        if (!tbody) return;

        if (!records || records.length === 0) {
            tbody.innerHTML = '';
            if (emptyState) {
                emptyState.classList.remove('hidden');
                emptyState.classList.add('flex');
            }
            return;
        }

        if (emptyState) {
            emptyState.classList.remove('flex');
            emptyState.classList.add('hidden');
        }

        let html = '';
        records.forEach(item => {
            let displayDate = 'N/A';
            if (item.TIMESTAMP) {
                let d = new Date(item.TIMESTAMP);
                if (isNaN(d.getTime()) && typeof item.TIMESTAMP === 'string') {
                    const parts = item.TIMESTAMP.split(/[\/\-]/);
                    if (parts.length === 3) d = new Date(parts[2], parts[1] - 1, parts[0]);
                }
                if (!isNaN(d.getTime())) {
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = d.toLocaleString('en-IN', { month: 'short' });
                    const year = d.getFullYear();
                    displayDate = `${day} ${month} ${year}`;
                }
            }

            const statusClass = item.STATUS === 'PAID' 
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                : 'bg-rose-500/10 text-rose-500 border-rose-500/20';

            const courseBatchText = (item._course || item._batch) 
                ? `${item._course || 'N/A'} <br> <span class="text-[10px] text-slate-500 dark:text-slate-400">${item._batch || ''}</span>`
                : 'N/A';

            html += `
                <tr class="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td class="px-5 py-4 text-sm font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">${displayDate}</td>
                    <td class="px-5 py-4 text-sm font-mono text-slate-500 dark:text-slate-400">${item.TXN_ID || 'N/A'}</td>
                    <td class="px-5 py-4">
                        <div class="flex flex-col">
                            <span class="text-sm font-bold text-slate-800 dark:text-white">${item.STUDENT_NAME || 'N/A'}</span>
                            <span class="text-[10px] font-mono text-slate-500 dark:text-slate-400">${item.STUDENT_ID || 'N/A'}</span>
                        </div>
                    </td>
                    <td class="px-5 py-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        ${courseBatchText}
                    </td>
                    <td class="px-5 py-4 text-sm font-medium text-slate-600 dark:text-slate-300">${item.FEE_PERIOD || 'N/A'}</td>
                    <td class="px-5 py-4">
                        <span class="px-2.5 py-1 rounded-full border text-[10px] font-bold tracking-wide uppercase ${statusClass}">
                            ${item.STATUS || 'UNKNOWN'}
                        </span>
                    </td>
                    <td class="px-5 py-4 text-right text-sm font-black text-slate-800 dark:text-white">₹${item.AMOUNT_COLLECTED || 0}</td>
                </tr>`;
        });
        
        tbody.innerHTML = html;
    }

    // =========================================
    // 📥 STATEMENT CSV DATA EXPORTER
    // =========================================

    function exportToCSV() {
        if (!window.currentFilteredLedgerDataset || window.currentFilteredLedgerDataset.length === 0) {
            if (window.UIUtils) window.UIUtils.showToast("No data available to export.", "warning");
            return;
        }

        // Define CSV standard headers
        let csvContent = "Transaction ID,Timestamp,Student Name,Student ID,Billing Period,Amount,Status\n";

        // Build rows from local memory array cache
        window.currentFilteredLedgerDataset.forEach(item => {
            const dateObj = new Date(item.TIMESTAMP);
            const displayDate = isNaN(dateObj.getTime()) ? 'N/A' : dateObj.toLocaleDateString('en-IN');

            const row = [
                item.TXN_ID || 'N/A',
                displayDate,
                `"${item.STUDENT_NAME || 'N/A'}"`, // Encapsulate in quotes to prevent comma breaks
                item.STUDENT_ID || 'N/A',
                item.FEE_PERIOD || 'N/A',
                item.AMOUNT_COLLECTED || 0,
                item.STATUS || 'UNKNOWN'
            ];
            csvContent += row.join(",") + "\n";
        });

        // Generate data blob download asset container
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);

        const timestamp = new Date().toISOString().slice(0, 10);
        // Clean Variable Assignment: Zero escape errors
        const fileName = `Statement_Export_${timestamp}.csv`;

        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", fileName);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();

        // Immediate garbage collection
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);

        if (window.UIUtils) {
            window.UIUtils.showToast("Statement exported successfully.", "success");
        }
    }

    // Clean Global Scoping Export Return Wrapper
    return {
        init: init,
        mount: mount,
        toggleFilters: toggleFilters,
        applyLedgerFilters: applyLedgerFilters,
        fetchAndApplyFilters: fetchAndApplyFilters,
        exportToCSV: exportToCSV
    };

})(); // End IIFE Wrapper
