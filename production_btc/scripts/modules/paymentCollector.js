/**
 * ==========================================
 * 💳 FEE COLLECTOR MODULE (paymentCollector.js)
 * ==========================================
 * Self-contained billing interface for monthly fee collection.
 * Encapsulated inside window.PaymentCollectorModule.
 *
 * Features:
 *  - Autocomplete candidate lookup against MasterCandidateCache
 *  - 12-month checkbox matrix with year selector
 *  - Safe-lock history sync (prevents double-payment)
 *  - Live delta calculation engine
 *  - Atomic bulk payment submission via BULK_LOG_PAYMENTS
 *
 * Exposed API:
 *  - mount(container)                    — AppCore lifecycle hook
 *  - init()                              — Standalone initialization
 *  - openCartForCandidate(candidateData) — Cross-module bridge
 */

window.PaymentCollectorModule = (function () {
    'use strict';

    // =========================================
    // ⚙️ CONFIGURATION & CONSTANTS
    // =========================================

    /** Base monthly fee rate in INR */
    const BASE_MONTHLY_RATE = 500;

    /** 12-month label array */
    const MONTH_LABELS = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    /** Strict 4-digit year regex */
    const YEAR_REGEX = /^\d{4}$/;

    // =========================================
    // 🧠 INTERNAL STATE
    // =========================================

    let _container = null;
    let _selectedCandidate = null;
    let _paymentLogs = [];
    let _isSubmitting = false;
    let _searchDebounceTimer = null;

    // =========================================
    // 🚀 MODULE LIFECYCLE
    // =========================================

    /**
     * Mounts the Fee Collector view into the DOM container.
     * Called by AppCore.navigateTo().
     * @param {HTMLElement} container - The DOM element to render into.
     */
    function mount(container) {
        _container = container;
        _container.innerHTML = buildShellHTML();
        attachEventListeners();
        prefetchPaymentLogs();
        ensureCandidateCacheReady();
    }

    /**
     * Standalone initialization (can be called outside of mount flow).
     */
    function init() {
        if (_container) {
            attachEventListeners();
            prefetchPaymentLogs();
            ensureCandidateCacheReady();
        }
    }

    /**
     * Cross-Module Bridge: Opens the Fee Collector for a specific candidate.
     * Called from directoryViewer.js action buttons or external module hooks.
     *
     * @param {Object} candidateData - Full candidate record from MasterCandidateCache.
     */
    function openCartForCandidate(candidateData) {
        // If not mounted yet, navigate to this module first
        if (window.AppCore && typeof window.AppCore.navigateTo === 'function') {
            // Force navigation to this module's view
            window.AppCore.navigateTo('paymentCollector');
        }

        // Wait a tick for DOM to settle after navigation
        setTimeout(function () {
            if (!_container) return;

            // Populate the candidate selection
            _selectedCandidate = candidateData;
            renderSelectedCandidate();

            // Clear search field and dropdown
            const searchInput = document.getElementById('pc_search_input');
            if (searchInput) {
                searchInput.value = '';
            }
            hideDropdown();

            // Set year to current and sync
            const yearInput = document.getElementById('pc_year_input');
            if (yearInput) {
                yearInput.value = new Date().getFullYear().toString();
            }

            syncCheckboxStates();
        }, 150);
    }

    // =========================================
    // 🏗️ SHELL HTML BUILDER
    // =========================================

    function buildShellHTML() {
        const currentYear = new Date().getFullYear();

        return `
            <div class="max-w-4xl mx-auto animate-fade-in pb-10 space-y-6">

                <!-- Module Header -->
                <div class="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                    <div class="flex items-center gap-3 mb-1">
                        <div class="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                        </div>
                        <div>
                            <h1 class="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">Fee Collector</h1>
                            <p class="text-sm text-slate-500 dark:text-slate-400 font-medium">Monthly fee billing & payment logging console</p>
                        </div>
                    </div>
                </div>

                <!-- Step 1: Candidate Search & Selection -->
                <div class="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                    <div class="flex items-center gap-2 mb-4">
                        <span class="flex items-center justify-center w-7 h-7 rounded-lg bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400 text-xs font-black">1</span>
                        <h2 class="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Select Candidate</h2>
                    </div>

                    <!-- Autocomplete Search Field -->
                    <div class="relative">
                        <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <svg class="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        </div>
                        <input type="text" id="pc_search_input"
                            placeholder="Search by Name, Student ID, or Phone..."
                            autocomplete="off"
                            class="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all shadow-inner text-sm">

                        <!-- Dropdown Results Container -->
                        <div id="pc_search_dropdown"
                            class="hidden absolute z-50 left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
                        </div>
                    </div>

                    <!-- Selected Candidate Card -->
                    <div id="pc_selected_card" class="hidden mt-4">
                    </div>
                </div>

                <!-- Step 2: Billing Period Matrix -->
                <div class="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
                        <div class="flex items-center gap-2">
                            <span class="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 text-xs font-black">2</span>
                            <h2 class="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Billing Period</h2>
                        </div>

                        <!-- Year Input -->
                        <div class="flex items-center gap-2">
                            <label class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Target Year:</label>
                            <input type="text" id="pc_year_input"
                                value="${currentYear}"
                                maxlength="4"
                                placeholder="YYYY"
                                class="w-24 text-center px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white font-bold text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
                            <span id="pc_year_error" class="hidden text-xs font-bold text-rose-500">⚠ Invalid year</span>
                        </div>
                    </div>

                    <!-- 12-Month Checkbox Matrix -->
                    <div id="pc_month_grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        ${MONTH_LABELS.map(function (month, idx) {
                            return `
                                <label id="pc_month_label_${idx}" class="relative flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 cursor-pointer hover:border-brand-400 dark:hover:border-brand-500 hover:bg-brand-50/50 dark:hover:bg-brand-900/20 transition-all group select-none">
                                    <input type="checkbox" id="pc_month_cb_${idx}" data-month-index="${idx}" data-month-name="${month}"
                                        class="pc-month-checkbox w-5 h-5 rounded-md border-2 border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500 focus:ring-offset-0 cursor-pointer transition-all accent-emerald-600">
                                    <div class="flex flex-col">
                                        <span class="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors">${month}</span>
                                        <span class="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">₹${BASE_MONTHLY_RATE}</span>
                                    </div>
                                    <div id="pc_month_badge_${idx}" class="hidden absolute top-1.5 right-1.5">
                                        <span class="inline-flex items-center gap-0.5 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-[9px] font-black rounded-full border border-emerald-200 dark:border-emerald-800 uppercase tracking-wider">
                                            <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>
                                            Paid
                                        </span>
                                    </div>
                                </label>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Phase 1: Micro-Ledger Display Card -->
                <div id="collectorAuditPanel" class="hidden border border-slate-800 bg-slate-900/60 rounded-xl p-4 mt-4 animate-fade-in">
                    <div class="flex items-center justify-between border-b border-slate-700 pb-3 mb-3">
                        <h3 class="text-sm font-bold text-slate-200">📊 Account Statement Summary</h3>
                        <button id="pc_download_statement_btn" class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold transition-all">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                            📥 Download Statement
                        </button>
                    </div>
                    <div id="collectorDueSummaryBar" class="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold p-3 rounded-lg flex items-center gap-2">
                        <!-- Dynamic notice bar tracking balance data -->
                    </div>
                    <div class="max-h-40 overflow-y-auto mt-2 text-xs">
                        <table class="w-full text-left border-collapse text-slate-300">
                            <tbody id="collectorAuditTableBody" class="divide-y divide-slate-700/50">
                                <!-- Past transactions -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Step 3: Payment Summary & Submission -->
                <div class="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                    <div class="flex items-center gap-2 mb-4">
                        <span class="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-black">3</span>
                        <h2 class="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Payment Summary</h2>
                    </div>

                    <!-- Live Delta Summary -->
                    <div id="pc_summary_bar" class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 mb-5">
                        <div>
                            <p id="pc_summary_text" class="text-sm font-bold text-slate-600 dark:text-slate-300">
                                0 New Months Selected. Total Due: ₹0
                            </p>
                            <p class="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5 uppercase tracking-wider">
                                Base Rate: ₹${BASE_MONTHLY_RATE} / month
                            </p>
                        </div>
                        <div id="pc_total_badge" class="px-5 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-extrabold text-lg tracking-tight transition-all">
                            ₹0
                        </div>
                    </div>

                    <!-- Submit Button -->
                    <button id="pc_submit_btn"
                        disabled
                        class="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white disabled:text-slate-500 rounded-xl font-bold text-base transition-all transform active:scale-[0.98] shadow-lg flex items-center justify-center gap-2.5">
                        <svg id="pc_submit_icon" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <svg id="pc_submit_spinner" class="animate-spin h-5 w-5 hidden" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <span id="pc_submit_text">Confirm & Log Payment</span>
                    </button>
                </div>

            </div>
        `;
    }

    // =========================================
    // 🔌 EVENT WIRING
    // =========================================

    function attachEventListeners() {
        // Search autocomplete
        const searchInput = document.getElementById('pc_search_input');
        if (searchInput) {
            searchInput.addEventListener('input', handleSearchInput);
            searchInput.addEventListener('focus', handleSearchInput);

            // Close dropdown on outside click
            document.addEventListener('click', function (e) {
                if (!e.target.closest('#pc_search_input') && !e.target.closest('#pc_search_dropdown')) {
                    hideDropdown();
                }
            });
        }

        // Phase 3: Single-Student Statement Dispatcher Binding
        const downloadBtn = document.getElementById('pc_download_statement_btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', downloadStudentStatement);
        }

        // Year input validator + sync trigger
        const yearInput = document.getElementById('pc_year_input');
        if (yearInput) {
            yearInput.addEventListener('input', handleYearChange);
        }

        // Month checkbox change listeners
        const checkboxes = document.querySelectorAll('.pc-month-checkbox');
        checkboxes.forEach(function (cb) {
            cb.addEventListener('change', recalculateDelta);
        });

        // Submit button
        const submitBtn = document.getElementById('pc_submit_btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', handleSubmitPayment);
        }
    }

    // =========================================
    // 🔍 AUTOCOMPLETE LOOKUP ENGINE
    // =========================================

    /**
     * Ensures the MasterCandidateCache is populated.
     * If it doesn't exist, attempts to fetch directory data.
     */
    async function ensureCandidateCacheReady() {
        if (window.MasterCandidateCache && window.MasterCandidateCache.length > 0) {
            return; // Cache already warm
        }

        try {
            const token = window.SystemConfig ? localStorage.getItem(window.SystemConfig.AUTH_KEY) : '';
            const res = await window.UIUtils.fetchFromEngine({
                action: "FETCH_DIRECTORY",
                sheetName: "Main Records",
                token: token
            });

            if (res && res.status === "success" && Array.isArray(res.data)) {
                window.MasterCandidateCache = res.data;
            }
        } catch (err) {
            console.debug('[PaymentCollector] Failed to warm candidate cache:', err);
        }
    }

    /**
     * Handles search input events with debounce.
     */
    function handleSearchInput() {
        clearTimeout(_searchDebounceTimer);
        _searchDebounceTimer = setTimeout(function () {
            const query = (document.getElementById('pc_search_input')?.value || '').trim().toLowerCase();

            if (query.length < 2) {
                hideDropdown();
                return;
            }

            const cache = window.MasterCandidateCache || [];
            const matches = cache.filter(function (candidate) {
                const name = (candidate.STUDENT_NAME || '').toLowerCase();
                const id = String(candidate.STUDENT_ID || '').toLowerCase();
                const phone = String(candidate.STUDENT_MOBILE || '').toLowerCase();
                const rlNo = String(candidate.RL_NO || '').toLowerCase();
                return name.includes(query) || id.includes(query) || phone.includes(query) || rlNo.includes(query);
            }).slice(0, 15); // Cap at 15 results for performance

            renderDropdown(matches);
        }, 180);
    }

    /**
     * Renders the autocomplete dropdown with matched candidates.
     */
    function renderDropdown(matches) {
        const dropdown = document.getElementById('pc_search_dropdown');
        if (!dropdown) return;

        if (matches.length === 0) {
            dropdown.innerHTML = `
                <div class="px-4 py-6 text-center">
                    <svg class="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <p class="text-sm font-semibold text-slate-400 dark:text-slate-500">No candidates found</p>
                </div>
            `;
            dropdown.classList.remove('hidden');
            return;
        }

        let html = '';
        matches.forEach(function (candidate, idx) {
            html += `
                <button type="button"
                    data-dropdown-index="${idx}"
                    class="pc-dropdown-item w-full text-left px-4 py-3 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors flex items-center gap-3 ${idx > 0 ? 'border-t border-slate-100 dark:border-slate-700/50' : ''}"
                    onclick="window.PaymentCollectorModule._selectCandidate(${idx})">
                    <div class="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                        <span class="text-xs font-black text-slate-500 dark:text-slate-300">${(candidate.STUDENT_NAME || 'N')[0].toUpperCase()}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold text-slate-800 dark:text-white truncate">${candidate.STUDENT_NAME || 'Unknown'}</p>
                        <p class="text-[11px] font-semibold text-slate-400 dark:text-slate-500 truncate">
                            ID: ${candidate.STUDENT_ID || 'N/A'} · RL: ${candidate.RL_NO || 'N/A'} · 📞 ${candidate.STUDENT_MOBILE || 'N/A'}
                        </p>
                    </div>
                    <svg class="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                </button>
            `;
        });

        dropdown.innerHTML = html;
        dropdown.classList.remove('hidden');

        // Store matches for click handler reference
        dropdown._currentMatches = matches;
    }

    /**
     * Hides the autocomplete dropdown.
     */
    function hideDropdown() {
        const dropdown = document.getElementById('pc_search_dropdown');
        if (dropdown) {
            dropdown.classList.add('hidden');
            dropdown.innerHTML = '';
        }
    }

    /**
     * Internal handler — called when a dropdown item is clicked.
     * @param {number} matchIndex - Index into the current matches array.
     */
    function _selectCandidate(matchIndex) {
        const dropdown = document.getElementById('pc_search_dropdown');
        if (!dropdown || !dropdown._currentMatches) return;

        const candidate = dropdown._currentMatches[matchIndex];
        if (!candidate) return;

        _selectedCandidate = candidate;

        // Update UI
        const searchInput = document.getElementById('pc_search_input');
        if (searchInput) {
            searchInput.value = '';
        }
        hideDropdown();
        renderSelectedCandidate();

        // Trigger history sync
        syncCheckboxStates();
    }

    /**
     * Renders the selected candidate card below the search field.
     */
    function renderSelectedCandidate() {
        const cardContainer = document.getElementById('pc_selected_card');
        if (!cardContainer || !_selectedCandidate) return;

        const c = _selectedCandidate;
        cardContainer.innerHTML = `
            <div class="flex items-center justify-between gap-4 p-4 rounded-xl bg-brand-50 dark:bg-brand-900/20 border-2 border-brand-200 dark:border-brand-800 animate-fade-in">
                <div class="flex items-center gap-3">
                    <div class="w-11 h-11 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center shrink-0">
                        <span class="text-sm font-black text-brand-700 dark:text-brand-400">${(c.STUDENT_NAME || 'N')[0].toUpperCase()}</span>
                    </div>
                    <div>
                        <p class="text-sm font-extrabold text-slate-800 dark:text-white">${c.STUDENT_NAME || 'Unknown Candidate'}</p>
                        <p class="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            ID: <span class="text-brand-600 dark:text-brand-400">${c.STUDENT_ID || 'N/A'}</span>
                            · Roll: ${c.RL_NO || 'N/A'}
                            · 📞 ${c.STUDENT_MOBILE || 'N/A'}
                            · ${c.ENROLLED_COURSE || 'No Class'}
                        </p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button type="button" id="pc_check_due_btn" onclick="window.PaymentCollectorModule.processDebtCheck()" class="border border-amber-500/30 text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 px-3 py-1.5 rounded-lg text-xs font-medium transition-all">
                        🔍 Check Due & History
                    </button>
                    <button type="button" onclick="window.PaymentCollectorModule._clearSelection()"
                        class="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-all shrink-0" title="Clear Selection">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
            </div>
        `;
        cardContainer.classList.remove('hidden');
    }

    /**
     * Phase 2: Automated Debt Calculator Engine
     * Triggered by the "Check Due & History" button.
     * Calculates expected months based on DATE_OF_ADMISSION, compares with PAID logs,
     * updates the summary readout, and populates the micro-ledger table.
     */
    function processDebtCheck() {
        if (!_selectedCandidate) return;

        const record = _selectedCandidate;
        if (!record.DATE_OF_ADMISSION) {
            if (window.UIUtils) window.UIUtils.showToast("Candidate missing Admission Date.", "error");
            return;
        }

        // 1. Parse Historical Timelines & Track Present Boundary
        const admissionDate = new Date(record.DATE_OF_ADMISSION);
        const currentDate = new Date();

        if (isNaN(admissionDate.getTime())) {
            if (window.UIUtils) window.UIUtils.showToast("Invalid Admission Date format.", "error");
            return;
        }

        // 2. Calculate Expected Accounting Months
        const totalExpectedMonths = (currentDate.getFullYear() - admissionDate.getFullYear()) * 12 + 
                                    (currentDate.getMonth() - admissionDate.getMonth()) + 1;

        // 3. Isolate Paid Months Context
        const studentId = String(record.STUDENT_ID || '');
        const studentLogs = _paymentLogs.filter(log => String(log.STUDENT_ID || '') === studentId);
        
        let paidCount = 0;
        studentLogs.forEach(log => {
            if (String(log.STATUS || '').toUpperCase() === 'PAID') {
                paidCount++;
            }
        });

        // 4. Display Debt Aggregates
        const monthsDue = Math.max(0, totalExpectedMonths - paidCount);
        const outstandingBalance = monthsDue * BASE_MONTHLY_RATE;

        const summaryBar = document.getElementById('collectorDueSummaryBar');
        if (summaryBar) {
            summaryBar.innerHTML = `Student has been active for ${totalExpectedMonths} months since admission. Logs verify ${paidCount} months paid. Estimated Outstanding Balance: ${monthsDue} Months Due (Approx. ₹${outstandingBalance.toLocaleString('en-IN')}).`;
        }

        // 5. Populate Mini-Table Grid
        const tbody = document.getElementById('collectorAuditTableBody');
        if (tbody) {
            studentLogs.sort((a, b) => new Date(b.TIMESTAMP) - new Date(a.TIMESTAMP)); // Newest first
            
            let html = '';
            if (studentLogs.length === 0) {
                html = `<tr><td colspan="4" class="px-3 py-4 text-center text-slate-500">No payment history found.</td></tr>`;
            } else {
                studentLogs.forEach(log => {
                    let formattedDate = 'N/A';
                    if (log.TIMESTAMP) {
                        const d = new Date(log.TIMESTAMP);
                        if (!isNaN(d)) {
                            formattedDate = String(d.getDate()).padStart(2, '0') + '-' + 
                                            String(d.getMonth() + 1).padStart(2, '0') + '-' + 
                                            d.getFullYear();
                        }
                    }
                    
                    const status = String(log.STATUS || 'UNKNOWN').toUpperCase();
                    let statusClass = 'text-slate-400';
                    if (status === 'PAID') statusClass = 'text-emerald-400';
                    else if (status === 'REFUNDED' || status === 'FAILED') statusClass = 'text-rose-400';

                    html += `
                        <tr class="hover:bg-slate-800/50 transition-colors border-b border-slate-800 last:border-0">
                            <td class="px-3 py-2 whitespace-nowrap">${formattedDate}</td>
                            <td class="px-3 py-2">${log.FEE_PERIOD || 'N/A'}</td>
                            <td class="px-3 py-2 text-right">₹${parseFloat(log.AMOUNT_COLLECTED || 0).toLocaleString('en-IN')}</td>
                            <td class="px-3 py-2 text-center font-bold ${statusClass}">${status}</td>
                        </tr>
                    `;
                });
            }
            tbody.innerHTML = html;
        }

        // Reveal the audit panel
        const panel = document.getElementById('collectorAuditPanel');
        if (panel) {
            panel.classList.remove('hidden');
        }
    }

    /**
     * Phase 3: Single-Student Statement Dispatcher
     * Triggers the direct client-side CSV download of the active student's payment history.
     */
    function downloadStudentStatement() {
        if (!_selectedCandidate) {
            if (window.UIUtils) window.UIUtils.showToast("No candidate selected.", "error");
            return;
        }

        const studentId = String(_selectedCandidate.STUDENT_ID || '');
        const studentName = String(_selectedCandidate.STUDENT_NAME || 'Unknown').replace(/[^a-zA-Z0-9]/g, '_');
        
        // 1. Target Single-Student Cache
        const studentLogs = _paymentLogs.filter(log => String(log.STUDENT_ID || '') === studentId);
        
        if (studentLogs.length === 0) {
            if (window.UIUtils) window.UIUtils.showToast("No payment history to export.", "error");
            return;
        }

        // Sort chronologically (newest first)
        studentLogs.sort((a, b) => new Date(b.TIMESTAMP) - new Date(a.TIMESTAMP));

        // 2. Map Columns Matrix
        const headers = ["Transaction ID", "Log Timestamp", "Student ID", "Candidate Name", "Billing Period", "Collection Amount", "Payment Status"];
        let csvContent = headers.join(",") + "\n";

        studentLogs.forEach(log => {
            // 3. Format Temporal Cells
            let formattedDate = '';
            if (log.TIMESTAMP) {
                const d = new Date(log.TIMESTAMP);
                if (!isNaN(d)) {
                    formattedDate = String(d.getDate()).padStart(2, '0') + '-' + 
                                    String(d.getMonth() + 1).padStart(2, '0') + '-' + 
                                    d.getFullYear();
                }
            }

            const rowData = [
                log.TXN_ID || "",
                formattedDate,
                log.STUDENT_ID || "",
                log.STUDENT_NAME || "",
                log.FEE_PERIOD || "",
                log.AMOUNT_COLLECTED || "",
                log.STATUS || ""
            ].map(cell => {
                let cellData = String(cell).replace(/"/g, '""');
                if (cellData.search(/("|,|\n)/g) >= 0) {
                    cellData = `"${cellData}"`;
                }
                return cellData;
            });

            csvContent += rowData.join(",") + "\n";
        });

        // 4. Execute Blob Cycle Trigger
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Statement_${studentName}.csv`);
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        
        // Clean garbage collection
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);

        if (window.UIUtils) window.UIUtils.showToast("Statement report generated.", "success");
    }

    /**
     * Clears the current candidate selection and resets the form.
     */
    function _clearSelection() {
        _selectedCandidate = null;

        const cardContainer = document.getElementById('pc_selected_card');
        if (cardContainer) {
            cardContainer.innerHTML = '';
            cardContainer.classList.add('hidden');
        }

        resetAllCheckboxes();
        recalculateDelta();
    }

    // =========================================
    // 📅 YEAR INPUT HANDLER
    // =========================================

    /**
     * Handles year input change — validates regex and triggers sync.
     */
    function handleYearChange() {
        const yearInput = document.getElementById('pc_year_input');
        const yearError = document.getElementById('pc_year_error');
        if (!yearInput) return;

        const value = yearInput.value.trim();

        if (YEAR_REGEX.test(value)) {
            // Valid
            yearInput.classList.remove('border-rose-500', 'ring-rose-500');
            yearInput.classList.add('border-slate-200', 'dark:border-slate-700');
            if (yearError) yearError.classList.add('hidden');

            // Trigger history re-sync for the new year
            if (_selectedCandidate) {
                syncCheckboxStates();
            }
        } else {
            // Invalid
            yearInput.classList.add('border-rose-500', 'ring-rose-500');
            yearInput.classList.remove('border-slate-200', 'dark:border-slate-700');
            if (yearError) yearError.classList.remove('hidden');
        }

        recalculateDelta();
    }

    /**
     * Returns true if the year input contains a valid 4-digit year.
     */
    function isYearValid() {
        const yearInput = document.getElementById('pc_year_input');
        if (!yearInput) return false;
        return YEAR_REGEX.test(yearInput.value.trim());
    }

    /**
     * Returns the current year value from the input field.
     */
    function getTargetYear() {
        const yearInput = document.getElementById('pc_year_input');
        return yearInput ? yearInput.value.trim() : '';
    }

    // =========================================
    // 🔒 SAFE-LOCK HISTORY SYNCHRONIZATION ENGINE
    // =========================================

    /**
     * Prefetch payment logs into local memory on module mount.
     */
    async function prefetchPaymentLogs() {
        try {
            const token = window.SystemConfig ? localStorage.getItem(window.SystemConfig.AUTH_KEY) : '';
            const res = await window.UIUtils.fetchFromEngine({
                action: "FETCH_PAYMENT_LOGS",
                token: token
            });

            if (res && res.status === "success" && Array.isArray(res.data)) {
                _paymentLogs = res.data;
            }
        } catch (err) {
            console.debug('[PaymentCollector] Payment log prefetch failed:', err);
        }
    }

    /**
     * syncCheckboxStates()
     * --------------------------------------------------
     * Triggered when a candidate is selected OR the billing year changes.
     *
     * 1. Fetches latest payment logs from FETCH_PAYMENT_LOGS.
     * 2. Scans for rows matching the current STUDENT_ID + target year
     *    where STATUS === 'PAID'.
     * 3. For every match: sets checkbox .checked = true, .disabled = true,
     *    and applies locked green badge styling.
     * 4. Non-matching months are unlocked for new selection.
     */
    async function syncCheckboxStates() {
        // Reset everything first
        resetAllCheckboxes();

        if (!_selectedCandidate || !isYearValid()) {
            recalculateDelta();
            return;
        }

        const targetYear = getTargetYear();
        const studentId = String(_selectedCandidate.STUDENT_ID || '');

        // Refresh payment logs for latest data
        try {
            const token = window.SystemConfig ? localStorage.getItem(window.SystemConfig.AUTH_KEY) : '';
            const res = await window.UIUtils.fetchFromEngine({
                action: "FETCH_PAYMENT_LOGS",
                token: token
            });

            if (res && res.status === "success" && Array.isArray(res.data)) {
                _paymentLogs = res.data;
            }
        } catch (err) {
            console.debug('[PaymentCollector] Sync fetch failed, using cached logs:', err);
        }

        // Scan for paid months matching this student + year
        const paidMonths = new Set();

        _paymentLogs.forEach(function (log) {
            const logStudentId = String(log.STUDENT_ID || '');
            const logStatus = String(log.STATUS || '').toUpperCase();
            const logPeriod = String(log.FEE_PERIOD || '');

            if (logStudentId === studentId && logStatus === 'PAID') {
                // FEE_PERIOD format: "MonthName-YYYY" (e.g., "January-2026")
                const parts = logPeriod.split('-');
                if (parts.length === 2 && parts[1] === targetYear) {
                    const monthName = parts[0].trim();
                    const monthIdx = MONTH_LABELS.indexOf(monthName);
                    if (monthIdx !== -1) {
                        paidMonths.add(monthIdx);
                    }
                }
            }
        });

        // Apply locked states to paid months
        paidMonths.forEach(function (monthIdx) {
            const checkbox = document.getElementById('pc_month_cb_' + monthIdx);
            const label = document.getElementById('pc_month_label_' + monthIdx);
            const badge = document.getElementById('pc_month_badge_' + monthIdx);

            if (checkbox) {
                checkbox.checked = true;
                checkbox.disabled = true;
            }

            // Apply locked green badge styling
            if (label) {
                label.classList.remove(
                    'border-slate-200', 'dark:border-slate-700',
                    'bg-slate-50', 'dark:bg-slate-900',
                    'cursor-pointer', 'hover:border-brand-400', 'dark:hover:border-brand-500',
                    'hover:bg-brand-50/50', 'dark:hover:bg-brand-900/20'
                );
                label.classList.add(
                    'border-emerald-300', 'dark:border-emerald-800',
                    'bg-emerald-50', 'dark:bg-emerald-900/20',
                    'cursor-not-allowed', 'opacity-75'
                );
            }

            if (badge) {
                badge.classList.remove('hidden');
            }
        });

        recalculateDelta();
    }

    /**
     * Resets all 12 checkboxes to unchecked/enabled state with default styling.
     */
    function resetAllCheckboxes() {
        MONTH_LABELS.forEach(function (month, idx) {
            const checkbox = document.getElementById('pc_month_cb_' + idx);
            const label = document.getElementById('pc_month_label_' + idx);
            const badge = document.getElementById('pc_month_badge_' + idx);

            if (checkbox) {
                checkbox.checked = false;
                checkbox.disabled = false;
            }

            if (label) {
                label.classList.remove(
                    'border-emerald-300', 'dark:border-emerald-800',
                    'bg-emerald-50', 'dark:bg-emerald-900/20',
                    'cursor-not-allowed', 'opacity-75'
                );
                label.classList.add(
                    'border-slate-200', 'dark:border-slate-700',
                    'bg-slate-50', 'dark:bg-slate-900',
                    'cursor-pointer', 'hover:border-brand-400', 'dark:hover:border-brand-500',
                    'hover:bg-brand-50/50', 'dark:hover:bg-brand-900/20'
                );
            }

            if (badge) {
                badge.classList.add('hidden');
            }
        });
    }

    // =========================================
    // 📊 LIVE DELTA CALCULATION ENGINE
    // =========================================

    /**
     * Reads only non-disabled (newly selected) checkboxes and computes:
     *   - Count of new months
     *   - Total amount due (count × BASE_MONTHLY_RATE)
     * Updates the summary label and total badge.
     */
    function recalculateDelta() {
        let newMonthCount = 0;

        MONTH_LABELS.forEach(function (month, idx) {
            const checkbox = document.getElementById('pc_month_cb_' + idx);
            if (checkbox && checkbox.checked && !checkbox.disabled) {
                newMonthCount++;
            }
        });

        const totalDue = newMonthCount * BASE_MONTHLY_RATE;

        // Update summary text
        const summaryText = document.getElementById('pc_summary_text');
        if (summaryText) {
            summaryText.textContent = newMonthCount + ' New Month' + (newMonthCount !== 1 ? 's' : '') + ' Selected. Total Due: ₹' + totalDue.toLocaleString('en-IN');
        }

        // Update total badge
        const totalBadge = document.getElementById('pc_total_badge');
        if (totalBadge) {
            totalBadge.textContent = '₹' + totalDue.toLocaleString('en-IN');

            if (totalDue > 0) {
                totalBadge.classList.remove('bg-slate-200', 'dark:bg-slate-700', 'text-slate-500', 'dark:text-slate-400');
                totalBadge.classList.add('bg-emerald-100', 'dark:bg-emerald-900/40', 'text-emerald-700', 'dark:text-emerald-400');
            } else {
                totalBadge.classList.add('bg-slate-200', 'dark:bg-slate-700', 'text-slate-500', 'dark:text-slate-400');
                totalBadge.classList.remove('bg-emerald-100', 'dark:bg-emerald-900/40', 'text-emerald-700', 'dark:text-emerald-400');
            }
        }

        // Enable/disable submit button
        const submitBtn = document.getElementById('pc_submit_btn');
        if (submitBtn) {
            const canSubmit = newMonthCount > 0 && _selectedCandidate !== null && isYearValid() && !_isSubmitting;
            submitBtn.disabled = !canSubmit;
        }
    }

    // =========================================
    // 📦 PAYLOAD PACKAGE DELIVERY ENGINE
    // =========================================

    /**
     * Generates a unique transaction trace token.
     * Format: TXN-YYYY-XXXXX (e.g., TXN-2026-A3F7B)
     */
    function generateTxnId() {
        const year = new Date().getFullYear();
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let token = '';
        for (let i = 0; i < 5; i++) {
            token += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return 'TXN-' + year + '-' + token;
    }

    /**
     * Handles the payment submission workflow:
     * 1. Collects all newly checked (non-disabled) months.
     * 2. Builds a payment payload array with TXN tokens.
     * 3. Dispatches via BULK_LOG_PAYMENTS.
     * 4. On success: clears cart, shows emerald toast.
     */
    async function handleSubmitPayment() {
        if (_isSubmitting) return;
        if (!_selectedCandidate) {
            if (window.UIUtils) window.UIUtils.showToast('Please select a candidate first.', 'error');
            return;
        }
        if (!isYearValid()) {
            if (window.UIUtils) window.UIUtils.showToast('Please enter a valid 4-digit billing year.', 'error');
            return;
        }

        const targetYear = getTargetYear();
        const timestamp = new Date().toISOString();

        // Collect newly checked months (non-disabled only)
        const newPayments = [];
        MONTH_LABELS.forEach(function (month, idx) {
            const checkbox = document.getElementById('pc_month_cb_' + idx);
            if (checkbox && checkbox.checked && !checkbox.disabled) {
                newPayments.push({
                    TXN_ID: generateTxnId(),
                    TIMESTAMP: timestamp,
                    STUDENT_ID: String(_selectedCandidate.STUDENT_ID || ''),
                    RL_NO: String(_selectedCandidate.RL_NO || ''),
                    STUDENT_NAME: String(_selectedCandidate.STUDENT_NAME || ''),
                    FEE_PERIOD: month + '-' + targetYear,
                    STATUS: 'PAID',
                    AMOUNT_COLLECTED: BASE_MONTHLY_RATE
                });
            }
        });

        if (newPayments.length === 0) {
            if (window.UIUtils) window.UIUtils.showToast('No new months selected for payment.', 'error');
            return;
        }

        // Lock UI
        _isSubmitting = true;
        setSubmitLoadingState(true);

        try {
            const token = window.SystemConfig ? localStorage.getItem(window.SystemConfig.AUTH_KEY) : '';
            const res = await window.UIUtils.fetchFromEngine({
                action: "BULK_LOG_PAYMENTS",
                payloadArray: newPayments,
                token: token
            });

            if (res && (res.success === true || res.status === "success")) {
                // Success! Show emerald toast
                const totalAmount = newPayments.length * BASE_MONTHLY_RATE;
                if (window.UIUtils) {
                    window.UIUtils.showToast(
                        '✅ Payment logged! ' + newPayments.length + ' month(s) — ₹' + totalAmount.toLocaleString('en-IN') + ' recorded for ' + _selectedCandidate.STUDENT_NAME + '.',
                        'success'
                    );
                }

                // Clear the cart
                clearCart();

                // Re-sync to lock the newly paid months
                if (_selectedCandidate) {
                    await syncCheckboxStates();
                }
            } else {
                throw new Error(res.message || 'Server returned an unexpected response.');
            }
        } catch (err) {
            console.error('[PaymentCollector] Submission Error:', err);
            if (window.UIUtils) window.UIUtils.showToast('Payment failed: ' + err.message, 'error');
        } finally {
            _isSubmitting = false;
            setSubmitLoadingState(false);
        }
    }

    /**
     * Toggles the submit button between loading and ready states.
     */
    function setSubmitLoadingState(isLoading) {
        const btnText = document.getElementById('pc_submit_text');
        const btnIcon = document.getElementById('pc_submit_icon');
        const btnSpinner = document.getElementById('pc_submit_spinner');
        const submitBtn = document.getElementById('pc_submit_btn');

        if (isLoading) {
            if (btnText) btnText.textContent = 'Processing Payment...';
            if (btnIcon) btnIcon.classList.add('hidden');
            if (btnSpinner) btnSpinner.classList.remove('hidden');
            if (submitBtn) submitBtn.disabled = true;
        } else {
            if (btnText) btnText.textContent = 'Confirm & Log Payment';
            if (btnIcon) btnIcon.classList.remove('hidden');
            if (btnSpinner) btnSpinner.classList.add('hidden');
            recalculateDelta(); // Re-evaluates button state
        }
    }

    /**
     * Clears the cart inputs but keeps the candidate selected.
     * After a successful payment, the user can continue billing
     * the same candidate for different months/years.
     */
    function clearCart() {
        // Uncheck all non-disabled checkboxes
        MONTH_LABELS.forEach(function (month, idx) {
            const checkbox = document.getElementById('pc_month_cb_' + idx);
            if (checkbox && !checkbox.disabled) {
                checkbox.checked = false;
            }
        });

        recalculateDelta();
    }

    // =========================================
    // 🔗 PUBLIC API
    // =========================================

    return {
        mount: mount,
        init: init,
        openCartForCandidate: openCartForCandidate,

        // Internal hooks exposed for inline onclick handlers
        _selectCandidate: _selectCandidate,
        _clearSelection: _clearSelection,
        processDebtCheck: processDebtCheck
    };

})();
