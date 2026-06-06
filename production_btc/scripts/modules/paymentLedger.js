/**
 * ==========================================
 * 📊 PAYMENT LEDGER MODULE (paymentLedger.js)
 * ==========================================
 * Auditing Ledger & Statement Generator interface.
 * Encapsulated inside window.PaymentLedgerModule.
 *
 * Features:
 *  - Premium dark-themed workspace
 *  - Multi-Criteria Processing Engine (applyLedgerFilters)
 *  - Temporal Boundary Slicer
 *  - Cross-referencing with MasterCandidateCache for Course/Batch filtering
 *  - Live Financial Aggregates Strip
 *  - Statement CSV Data Exporter
 */

window.PaymentLedgerModule = (function () {
    'use strict';

    // =========================================
    // 🧠 INTERNAL STATE
    // =========================================

    let _container = null;
    let _rawLedgerData = [];
    window.currentFilteredLedgerDataset = [];

    // Constants for dynamic dropdowns
    let _availableCourses = new Set();
    let _availableBatches = new Set();

    // =========================================
    // 🚀 MODULE LIFECYCLE
    // =========================================

    /**
     * Mounts the view into the DOM container.
     */
    function mount(container) {
        _container = container;
        _container.innerHTML = buildShellHTML();
        attachEventListeners();
        init(); // Trigger initialization lifecycle hook on mount
    }

    /**
     * Entry method hook: Initializes the module, fetches fresh data,
     * pre-populates table and summary widgets.
     */
    async function init() {
        if (!_container) return;
        
        // Show loading state
        renderLoadingState();
        
        try {
            // 1. Ensure candidate cache is ready for advanced Course/Batch joins
            await ensureCandidateCacheReady();
            
            // 2. Fetch fresh ledger data
            const token = window.SystemConfig ? localStorage.getItem(window.SystemConfig.AUTH_KEY) : '';
            const res = await window.UIUtils.fetchFromEngine({
                action: "FETCH_PAYMENT_LOGS",
                token: token
            });

            if (res && res.success === true && Array.isArray(res.data)) {
                _rawLedgerData = res.data;
                window.currentFilteredLedgerDataset = [..._rawLedgerData];
                
                populateFilterDropdowns();
                applyLedgerFilters(); // Triggers renderTable and updateAggregates
            } else {
                throw new Error("Failed to load ledger data.");
            }
        } catch (error) {
            console.error('[PaymentLedger] Init error:', error);
            renderErrorState(error.message);
        }
    }

    // =========================================
    // 🏗️ SHELL HTML BUILDER
    // =========================================

    function buildShellHTML() {
        return `
            <div class="h-full flex flex-col max-w-7xl mx-auto animate-fade-in pb-10 space-y-6">
                
                <!-- Top Command Action Line -->
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div class="flex-1 max-w-xl relative">
                        <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <svg class="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        </div>
                        <input type="text" id="pl_search_input"
                            placeholder="Search Name, Student ID, Roll No, or TXN ID..."
                            class="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all shadow-inner text-sm">
                    </div>
                    
                    <div class="flex items-center gap-3">
                        <button id="pl_toggle_filters_btn" class="px-5 py-3 rounded-xl font-bold text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 transition-colors flex items-center gap-2">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
                            <span>Toggle Advanced Filters</span>
                        </button>
                        
                        <button id="pl_download_csv_btn" class="px-5 py-3 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg transition-colors flex items-center gap-2">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                            <span>📥 Download Statement Report</span>
                        </button>
                    </div>
                </div>

                <!-- Advanced Parameters Selector Panel (Drawer) -->
                <div id="ledgerFilterPanel" class="hidden bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-all">
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <!-- Enrolled Course -->
                        <div>
                            <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Enrolled Course</label>
                            <select id="pl_course_select" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium">
                                <option value="">All Courses</option>
                            </select>
                        </div>
                        
                        <!-- Class Batch / Days -->
                        <div>
                            <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Class Batch / Days</label>
                            <select id="pl_batch_select" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium">
                                <option value="">All Batches</option>
                            </select>
                        </div>

                        <!-- From Date -->
                        <div>
                            <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">From Date</label>
                            <input type="date" id="pl_from_date" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium [color-scheme:light] dark:[color-scheme:dark]">
                        </div>

                        <!-- To Date -->
                        <div>
                            <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">To Date</label>
                            <input type="date" id="pl_to_date" class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none text-sm font-medium [color-scheme:light] dark:[color-scheme:dark]">
                        </div>
                    </div>
                </div>

                <!-- Live Financial Aggregates Strip -->
                <div class="bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-900 dark:to-black p-4 rounded-xl shadow-md border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                            <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                        </div>
                        <p id="pl_aggregate_text" class="text-slate-300 font-medium text-sm">
                            Showing 0 audited transaction logs.
                        </p>
                    </div>
                    <div class="text-right">
                        <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Liquid Statement Volume</p>
                        <p id="pl_aggregate_sum" class="text-2xl font-black text-emerald-400 tracking-tight">
                            ₹0
                        </p>
                    </div>
                </div>

                <!-- High-Fidelity Ledger Grid UI -->
                <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex-1 overflow-hidden flex flex-col min-h-[400px]">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                                    <th class="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Transaction ID</th>
                                    <th class="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Date</th>
                                    <th class="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Candidate</th>
                                    <th class="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">Fee Period</th>
                                    <th class="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap text-right">Amount</th>
                                    <th class="px-6 py-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody id="pl_table_body" class="divide-y divide-slate-100 dark:divide-slate-700/50">
                                <!-- Dynamic Rows -->
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        `;
    }

    // =========================================
    // 🔌 EVENT WIRING & LOGIC
    // =========================================

    function attachEventListeners() {
        // Toggle Filters
        const toggleBtn = document.getElementById('pl_toggle_filters_btn');
        const filterPanel = document.getElementById('ledgerFilterPanel');
        if (toggleBtn && filterPanel) {
            toggleBtn.addEventListener('click', () => {
                filterPanel.classList.toggle('hidden');
            });
        }

        // Search & Filter Inputs
        const searchInput = document.getElementById('pl_search_input');
        const courseSelect = document.getElementById('pl_course_select');
        const batchSelect = document.getElementById('pl_batch_select');
        const fromDate = document.getElementById('pl_from_date');
        const toDate = document.getElementById('pl_to_date');

        [searchInput, courseSelect, batchSelect, fromDate, toDate].forEach(el => {
            if (el) el.addEventListener('input', applyLedgerFilters);
        });

        // Download CSV
        const downloadBtn = document.getElementById('pl_download_csv_btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', exportToCSV);
        }
    }

    /**
     * Ensure MasterCandidateCache exists to pull Course/Batch info.
     */
    async function ensureCandidateCacheReady() {
        if (!window.MasterCandidateCache || window.MasterCandidateCache.length === 0) {
            const token = window.SystemConfig ? localStorage.getItem(window.SystemConfig.AUTH_KEY) : '';
            const res = await window.UIUtils.fetchFromEngine({
                action: "FETCH_DIRECTORY",
                sheetName: "Main Records",
                token: token
            });
            if (res && res.status === "success" && Array.isArray(res.data)) {
                window.MasterCandidateCache = res.data;
            } else {
                window.MasterCandidateCache = [];
            }
        }
    }

    /**
     * Extracts unique courses and batches from the cache to populate dropdowns.
     */
    function populateFilterDropdowns() {
        // Clear existing set values
        _availableCourses.clear();
        _availableBatches.clear();

        const cache = window.MasterCandidateCache || [];
        cache.forEach(candidate => {
            if (candidate.ENROLLED_COURSE) _availableCourses.add(candidate.ENROLLED_COURSE);
            if (candidate.CLASS_BATCH_DAYS) _availableBatches.add(candidate.CLASS_BATCH_DAYS);
        });

        // Populate Course Dropdown
        const courseSelect = document.getElementById('pl_course_select');
        if (courseSelect) {
            let html = '<option value="">All Courses</option>';
            Array.from(_availableCourses).sort().forEach(c => {
                html += `<option value="${c}">${c}</option>`;
            });
            courseSelect.innerHTML = html;
        }

        // Populate Batch Dropdown
        const batchSelect = document.getElementById('pl_batch_select');
        if (batchSelect) {
            let html = '<option value="">All Batches</option>';
            Array.from(_availableBatches).sort().forEach(b => {
                html += `<option value="${b}">${b}</option>`;
            });
            batchSelect.innerHTML = html;
        }
    }

    // =========================================
    // ⚙️ THE MULTI-CRITERIA PROCESSING ENGINE
    // =========================================

    /**
     * In-memory compilation method that reads the entire raw database log
     * and filters rows dynamically whenever an input changes.
     */
    function applyLedgerFilters() {
        const query = (document.getElementById('pl_search_input')?.value || '').trim().toLowerCase();
        const courseFilter = document.getElementById('pl_course_select')?.value || '';
        const batchFilter = document.getElementById('pl_batch_select')?.value || '';
        const fromDateStr = document.getElementById('pl_from_date')?.value || '';
        const toDateStr = document.getElementById('pl_to_date')?.value || '';

        // Temporal Boundaries Setup
        let fromDate = null;
        let toDate = null;
        if (fromDateStr) {
            fromDate = new Date(fromDateStr);
            fromDate.setHours(0, 0, 0, 0);
        }
        if (toDateStr) {
            toDate = new Date(toDateStr);
            toDate.setHours(23, 59, 59, 999);
        }

        // Cache map for fast Course/Batch lookup
        const studentCacheMap = new Map();
        if (window.MasterCandidateCache) {
            window.MasterCandidateCache.forEach(c => {
                if (c.STUDENT_ID) studentCacheMap.set(c.STUDENT_ID, c);
            });
        }

        window.currentFilteredLedgerDataset = _rawLedgerData.filter(log => {
            // 1. Unified Text Matcher
            let textMatch = true;
            if (query) {
                const searchStr = `${log.STUDENT_NAME || ''} ${log.RL_NO || ''} ${log.STUDENT_ID || ''} ${log.TXN_ID || ''}`.toLowerCase();
                textMatch = searchStr.includes(query);
            }

            // 2. Temporal Boundary Slicer
            let dateMatch = true;
            if (fromDate || toDate) {
                const logDate = new Date(log.TIMESTAMP);
                if (fromDate && logDate < fromDate) dateMatch = false;
                if (toDate && logDate > toDate) dateMatch = false;
            }

            // 3. Course & Batch Linkage Slicer
            let courseMatch = true;
            let batchMatch = true;
            if (courseFilter || batchFilter) {
                const linkedCandidate = studentCacheMap.get(log.STUDENT_ID) || {};
                if (courseFilter && linkedCandidate.ENROLLED_COURSE !== courseFilter) courseMatch = false;
                if (batchFilter && linkedCandidate.CLASS_BATCH_DAYS !== batchFilter) batchMatch = false;
            }

            return textMatch && dateMatch && courseMatch && batchMatch;
        });

        // Sort by newest first
        window.currentFilteredLedgerDataset.sort((a, b) => new Date(b.TIMESTAMP) - new Date(a.TIMESTAMP));

        updateAggregates();
        renderTable();
    }

    // =========================================
    // 🎨 UI RENDERING ENGINES
    // =========================================

    function updateAggregates() {
        const dataset = window.currentFilteredLedgerDataset;
        let totalSum = 0;

        dataset.forEach(log => {
            // Ensure AMOUNT_COLLECTED is numeric, default 0
            const amount = parseFloat(log.AMOUNT_COLLECTED) || 0;
            // Only sum if PAID (ignore FAILED or REFUNDED)
            if (String(log.STATUS).toUpperCase() === 'PAID') {
                totalSum += amount;
            }
        });

        const textEl = document.getElementById('pl_aggregate_text');
        if (textEl) {
            textEl.textContent = `Showing ${dataset.length} audited transaction log${dataset.length === 1 ? '' : 's'}.`;
        }

        const sumEl = document.getElementById('pl_aggregate_sum');
        if (sumEl) {
            sumEl.textContent = '₹' + totalSum.toLocaleString('en-IN');
        }
    }

    function renderTable() {
        const tbody = document.getElementById('pl_table_body');
        if (!tbody) return;

        const dataset = window.currentFilteredLedgerDataset;

        if (dataset.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-12 text-center text-slate-500 dark:text-slate-400">
                        <div class="flex flex-col items-center justify-center">
                            <svg class="w-12 h-12 mb-3 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            <p class="text-base font-bold">No transactions found</p>
                            <p class="text-sm">Adjust your filters to see more results.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        let html = '';
        dataset.forEach(row => {
            // Format ISO Date to dd-mm-yyyy
            let formattedDate = 'N/A';
            if (row.TIMESTAMP) {
                const d = new Date(row.TIMESTAMP);
                if (!isNaN(d)) {
                    formattedDate = String(d.getDate()).padStart(2, '0') + '-' + 
                                    String(d.getMonth() + 1).padStart(2, '0') + '-' + 
                                    d.getFullYear();
                }
            }

            // High-contrast Status Badge formatting
            const status = String(row.STATUS || 'UNKNOWN').toUpperCase();
            let statusBadgeClass = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700';
            if (status === 'PAID') {
                statusBadgeClass = 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50';
            } else if (status === 'REFUNDED' || status === 'FAILED') {
                statusBadgeClass = 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50';
            }

            html += `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                    <td class="px-6 py-4">
                        <span class="font-mono text-xs font-bold text-slate-600 dark:text-slate-300">${row.TXN_ID || 'N/A'}</span>
                    </td>
                    <td class="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                        ${formattedDate}
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex flex-col">
                            <span class="text-sm font-bold text-slate-800 dark:text-white">${row.STUDENT_NAME || 'Unknown'}</span>
                            <span class="text-[11px] font-semibold text-slate-500 dark:text-slate-400">ID: ${row.STUDENT_ID || 'N/A'} · RL: ${row.RL_NO || 'N/A'}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                        ${row.FEE_PERIOD || 'N/A'}
                    </td>
                    <td class="px-6 py-4 text-right">
                        <span class="font-extrabold text-slate-800 dark:text-white">₹${parseFloat(row.AMOUNT_COLLECTED || 0).toLocaleString('en-IN')}</span>
                    </td>
                    <td class="px-6 py-4 text-center">
                        <span class="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${statusBadgeClass}">
                            ${status}
                        </span>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    function renderLoadingState() {
        const tbody = document.getElementById('pl_table_body');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-12 text-center">
                        <div class="flex justify-center items-center gap-3">
                            <svg class="animate-spin h-6 w-6 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            <span class="text-sm font-bold text-slate-600 dark:text-slate-400">Fetching Secure Ledger...</span>
                        </div>
                    </td>
                </tr>
            `;
        }
    }

    function renderErrorState(msg) {
        const tbody = document.getElementById('pl_table_body');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-12 text-center">
                        <div class="flex flex-col justify-center items-center gap-2">
                            <svg class="w-10 h-10 text-rose-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            <span class="text-base font-bold text-slate-800 dark:text-white">Ledger Retrieval Failed</span>
                            <span class="text-sm text-slate-500">${msg}</span>
                        </div>
                    </td>
                </tr>
            `;
        }
    }

    // =========================================
    // 📥 STATEMENT CSV DATA EXPORTER
    // =========================================

    /**
     * Scrapes the current filtered data collection cache, transforms to CSV,
     * packages as a Blob, forces a download, and auto-revokes the URL.
     */
    function exportToCSV() {
        const dataset = window.currentFilteredLedgerDataset;
        if (!dataset || dataset.length === 0) {
            if (window.UIUtils) window.UIUtils.showToast("No data to export.", "error");
            return;
        }

        // CSV Headers
        const headers = ["TXN_ID", "TIMESTAMP", "DATE_FORMATTED", "STUDENT_ID", "RL_NO", "STUDENT_NAME", "FEE_PERIOD", "STATUS", "AMOUNT_COLLECTED"];
        
        let csvContent = headers.join(",") + "\n";

        dataset.forEach(row => {
            // Pre-calculate clean date
            let formattedDate = '';
            if (row.TIMESTAMP) {
                const d = new Date(row.TIMESTAMP);
                if (!isNaN(d)) {
                    formattedDate = String(d.getDate()).padStart(2, '0') + '-' + 
                                    String(d.getMonth() + 1).padStart(2, '0') + '-' + 
                                    d.getFullYear();
                }
            }

            const rowData = headers.map(header => {
                let cellData = row[header] === undefined || row[header] === null ? "" : String(row[header]);
                
                // Special insertion for our custom date column
                if (header === "DATE_FORMATTED") cellData = formattedDate;

                // Escape double quotes and wrap in quotes if contains commas/quotes
                cellData = cellData.replace(/"/g, '""');
                if (cellData.search(/("|,|\n)/g) >= 0) {
                    cellData = `"${cellData}"`;
                }
                return cellData;
            });

            csvContent += rowData.join(",") + "\n";
        });

        // Create instantaneous client-side Blob download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Payment_Ledger_Statement_${new Date().toISOString().split('T')[0]}.csv`);
        
        document.body.appendChild(link);
        link.click();
        
        // Auto-revoke memory
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
        
        if (window.UIUtils) window.UIUtils.showToast("Statement report generated.", "success");
    }

    // =========================================
    // 🔗 PUBLIC API
    // =========================================

    return {
        mount: mount,
        init: init
    };

})();
