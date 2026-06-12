/**
 * ==========================================
 * 💳 FEE COLLECTOR MODULE (paymentCollector.js)
 * ==========================================
 * Compact billing workspace for the Babla Yoga Training Center ERP.
 *
 * Features:
 * - Inline autocomplete student lookup engine (Name / ID / Contact)
 * - 12-month checkout checkbox grid with 4-digit year guard
 * - Backward-chaining waterfall due calculator with lazy year traversal
 * - Safe-lock green badge freeze for previously paid months
 * - Live dynamic checkout pricing from runtime fee config cache
 * - Collapsible ⚙️ Global Fee Rate Settings admin card
 * - Cross-module bridge: openCartForCandidate(candidateData)
 *
 * Namespace: window.PaymentCollectorModule
 */
window.PaymentCollectorModule = (function () {
    'use strict';

    // =========================================
    // 📅 CONSTANTS
    // =========================================
    const MONTH_NAMES = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const MONTH_ICONS = ['❄️', '💧', '🌸', '🌷', '☀️', '🌞', '🌧️', '🍃', '🍂', '🎃', '🍁', '🎄'];

    // =========================================
    // 🔒 INTERNAL STATE
    // =========================================
    let _container = null;
    let _selectedCandidate = null;
    let _calendarYear = new Date().getFullYear();
    let _mergedLogs = [];
    let _pendingCandidate = null;
    let _feeSettingsOpen = false;
    let _isProcessing = false;
    let _dueAnalysisComplete = false;

    /**
     * Shared mutable fee config object.
     * Exposed as window.PaymentCollectorModule.feeConfig for external reads.
     * Properties are updated in-place so the reference stays stable.
     */
    const feeConfig = { monthlyFee: 500, admissionFee: 1000 };

    // =========================================
    // 🔧 UTILITY HELPERS
    // =========================================

    /**
     * Gets the auth token from local storage.
     */
    function getAuthToken() {
        return window.SystemConfig ? localStorage.getItem(window.SystemConfig.AUTH_KEY) : '';
    }

    /**
     * Generates a unique transaction ID with year prefix and 6-char alphanumeric suffix.
     * Format: TXN-YYYY-XXXXXX
     */
    function generateTxnId() {
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        var suffix = '';
        for (var i = 0; i < 6; i++) {
            suffix += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return 'TXN-' + new Date().getFullYear() + '-' + suffix;
    }

    /**
     * Robustly parses a date from various formats returned by Google Sheets.
     * Handles: ISO strings, Date objects, DD-MM-YYYY, YYYY-MM-DD, epoch numbers.
     * @param {*} dateVal - Raw date value from candidate record
     * @returns {Date|null} Parsed Date object or null on failure
     */
    function parseAdmissionDate(dateVal) {
        if (!dateVal) return null;
        if (dateVal instanceof Date && !isNaN(dateVal.getTime())) return dateVal;

        var str = String(dateVal).trim();
        if (!str || str === '—' || str === 'N/A') return null;

        // Attempt standard JS Date parsing (handles ISO 8601 and most standard formats)
        var d = new Date(str);
        if (!isNaN(d.getTime())) return d;

        // Attempt DD-MM-YYYY or DD/MM/YYYY
        var parts = str.split(/[-\/\.]/);
        if (parts.length === 3) {
            var p0 = parseInt(parts[0], 10);
            var p1 = parseInt(parts[1], 10);
            var p2 = parseInt(parts[2], 10);

            // DD-MM-YYYY (day first if first number <= 31 and second <= 12)
            if (p0 <= 31 && p1 <= 12 && p2 >= 1900) {
                d = new Date(p2, p1 - 1, p0);
                if (!isNaN(d.getTime())) return d;
            }
            // YYYY-MM-DD
            if (p0 >= 1900 && p1 <= 12 && p2 <= 31) {
                d = new Date(p0, p1 - 1, p2);
                if (!isNaN(d.getTime())) return d;
            }
        }

        return null;
    }

    /**
     * Formats a date to readable DD MMM YYYY string.
     */
    function formatDateDisplay(dateObj) {
        if (!dateObj || isNaN(dateObj.getTime())) return 'N/A';
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return dateObj.getDate() + ' ' + months[dateObj.getMonth()] + ' ' + dateObj.getFullYear();
    }

    // =========================================
    // ☁️ BOOTSTRAP: CANDIDATE CACHE & FEE CONFIG
    // =========================================

    /**
     * Ensures window.MasterCandidateCache is populated.
     * If empty, performs a FETCH_DIRECTORY call to hydrate the cache.
     */
    async function ensureCandidateCache() {
        if (window.MasterCandidateCache && Array.isArray(window.MasterCandidateCache) && window.MasterCandidateCache.length > 0) {
            return;
        }

        try {
            var res = await window.UIUtils.fetchFromEngine({
                action: 'FETCH_DIRECTORY',
                token: getAuthToken()
            });

            if (res && res.status === 'success' && Array.isArray(res.data)) {
                window.MasterCandidateCache = res.data;
            } else {
                window.MasterCandidateCache = [];
            }
        } catch (err) {
            console.debug('[PaymentCollector] Cache bootstrap failed:', err);
            window.MasterCandidateCache = [];
        }
    }

    /**
     * Loads fee configuration from the backend GET_FEE_CONFIG endpoint.
     * Updates the shared feeConfig object properties in-place.
     */
    async function bootstrapFeeConfig() {
        try {
            var res = await window.UIUtils.fetchFromEngine({
                action: 'GET_FEE_CONFIG',
                token: getAuthToken()
            });

            if (res && res.status === 'success') {
                feeConfig.monthlyFee = Number(res.monthlyFee) || 500;
                feeConfig.admissionFee = Number(res.admissionFee) || 1000;
            }
        } catch (err) {
            console.debug('[PaymentCollector] Fee config bootstrap failed:', err);
        }

        // Update fee settings inputs if they exist
        var monthlyInput = document.getElementById('feeSettingsMonthly');
        var admissionInput = document.getElementById('feeSettingsAdmission');
        if (monthlyInput) monthlyInput.value = feeConfig.monthlyFee;
        if (admissionInput) admissionInput.value = feeConfig.admissionFee;
    }

    // =========================================
    // 🚀 MODULE LIFECYCLE
    // =========================================

    /**
     * Mounts the Fee Collector interface into the DOM container.
     * Called by AppCore.navigateTo('paymentCollector').
     */
    async function mount(container) {
        _container = container;
        _container.innerHTML = buildShellHTML();

        // Parallel bootstrap: load cache + fee config simultaneously
        await Promise.all([
            ensureCandidateCache(),
            bootstrapFeeConfig()
        ]);

        setupAutocomplete();
        buildMonthGrid();
        updateCheckoutTotal();

        // Handle pending cross-module navigation (from directory viewer "Pay Fees" button)
        if (_pendingCandidate) {
            selectCandidate(_pendingCandidate);
            _pendingCandidate = null;
        }
    }

    /**
     * Init alias — triggers navigation to this module.
     * Used by external nav buttons: window.PaymentCollectorModule.init()
     */
    function init() {
        if (window.AppCore && window.AppCore.navigateTo) {
            window.AppCore.navigateTo('paymentCollector');
        }
    }

    // =========================================
    // 🏗️ SHELL HTML BUILDER
    // =========================================

    function buildShellHTML() {
        return `
            <div id="collectorShell" class="max-w-7xl mx-auto space-y-6 animate-fade-in pb-16">

                <!-- ═══════════════════════════════════════ -->
                <!-- HEADER BAR                              -->
                <!-- ═══════════════════════════════════════ -->
                <div class="relative bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700/80 overflow-hidden">
                    <div class="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-emerald-500/5 dark:bg-emerald-500/10 blur-3xl pointer-events-none"></div>
                    <div class="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-brand-500/5 dark:bg-brand-500/10 blur-3xl pointer-events-none"></div>
                    <div class="relative z-10 flex items-center gap-4">
                        <div class="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path>
                            </svg>
                        </div>
                        <div>
                            <h1 class="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white">💳 Fee Collector</h1>
                            <p class="text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">Manage monthly fee payments & track outstanding dues</p>
                        </div>
                    </div>
                </div>

                <!-- ═══════════════════════════════════════ -->
                <!-- MAIN LAYOUT: 2-COLUMN GRID              -->
                <!-- ═══════════════════════════════════════ -->
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    <!-- ─────────────────────────────────── -->
                    <!-- LEFT COLUMN: SEARCH + PROFILE CARD  -->
                    <!-- ─────────────────────────────────── -->
                    <div class="space-y-4">

                        <!-- Student Search with Autocomplete -->
                        <div class="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700/80 shadow-sm">
                            <label class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">🔍 Search Student</label>
                            <div class="relative">
                                <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <svg class="h-4.5 w-4.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                </div>
                                <input type="text" id="collectorSearchInput" placeholder="Name, Student ID, or Mobile..."
                                    autocomplete="off"
                                    class="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-medium text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all shadow-inner">

                                <!-- Autocomplete Dropdown -->
                                <div id="collectorAutocompleteDropdown" class="hidden absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 max-h-72 overflow-y-auto">
                                </div>
                            </div>
                            <button onclick="window.PaymentCollectorModule.clearSelection()" class="mt-3 w-full py-2 text-xs font-bold text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all">
                                ✕ Clear Selection
                            </button>
                        </div>

                        <!-- Selected Student Profile Card -->
                        <div id="collectorSelectedCard" class="hidden bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm overflow-hidden transition-all duration-300">
                            <div class="bg-gradient-to-r from-brand-500 to-emerald-500 px-5 py-3">
                                <span class="text-[10px] font-black text-white/80 uppercase tracking-widest">Selected Student</span>
                            </div>
                            <div class="p-5 space-y-3">
                                <div class="flex items-center gap-3">
                                    <div class="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400 font-black text-lg shrink-0">
                                        <span id="collectorAvatarInitial">?</span>
                                    </div>
                                    <div class="min-w-0">
                                        <h3 id="collectorStudentName" class="font-extrabold text-slate-800 dark:text-white truncate text-base">—</h3>
                                        <p id="collectorStudentCourse" class="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">—</p>
                                    </div>
                                </div>
                                <div class="grid grid-cols-2 gap-2 text-[11px]">
                                    <div class="bg-slate-50 dark:bg-slate-900/50 rounded-lg px-3 py-2">
                                        <span class="text-slate-400 font-bold block mb-0.5">STUDENT ID</span>
                                        <span id="collectorStudentId" class="font-bold text-slate-700 dark:text-slate-200 break-all">—</span>
                                    </div>
                                    <div class="bg-slate-50 dark:bg-slate-900/50 rounded-lg px-3 py-2">
                                        <span class="text-slate-400 font-bold block mb-0.5">ROLL NO</span>
                                        <span id="collectorRollNo" class="font-bold text-slate-700 dark:text-slate-200">—</span>
                                    </div>
                                    <div class="bg-slate-50 dark:bg-slate-900/50 rounded-lg px-3 py-2">
                                        <span class="text-slate-400 font-bold block mb-0.5">MOBILE</span>
                                        <span id="collectorStudentMobile" class="font-bold text-slate-700 dark:text-slate-200">—</span>
                                    </div>
                                    <div class="bg-slate-50 dark:bg-slate-900/50 rounded-lg px-3 py-2">
                                        <span class="text-slate-400 font-bold block mb-0.5">ADMISSION</span>
                                        <span id="collectorAdmissionDate" class="font-bold text-slate-700 dark:text-slate-200">—</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- ─────────────────────────────────── -->
                    <!-- RIGHT COLUMN: MONTH GRID + ACTIONS  -->
                    <!-- ─────────────────────────────────── -->
                    <div class="lg:col-span-2 space-y-4">

                        <!-- Year Picker + Action Row -->
                        <div class="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700/80 shadow-sm">
                            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div class="flex items-center gap-3">
                                    <label class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest shrink-0">📅 Calendar Year</label>
                                    <input type="text" id="collectorYearInput" value="${_calendarYear}" maxlength="4"
                                        oninput="window.PaymentCollectorModule.handleYearChange(this)"
                                        class="w-24 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-bold text-center text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all text-sm">
                                    <span id="collectorYearStatus" class="text-xs font-bold text-emerald-500 hidden">✓ Valid</span>
                                    <span id="collectorYearError" class="text-xs font-bold text-rose-500 hidden">✕ Invalid Year</span>
                                </div>
                                <div class="flex items-center gap-2 w-full sm:w-auto">
                                    <button onclick="window.PaymentCollectorModule.checkDueAndHistory()" id="collectorCheckDueBtn"
                                        class="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-sm active:scale-[0.97]">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                                        Check Due & History
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- 12-Month Checkbox Grid -->
                        <div class="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700/80 shadow-sm">
                            <div class="flex items-center justify-between mb-4">
                                <label class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Monthly Fee Checkout Grid</label>
                                <span id="collectorMonthCounter" class="text-[11px] font-bold text-slate-400">0 selected</span>
                            </div>
                            <div id="collectorMonthGrid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                <!-- Month checkboxes injected by buildMonthGrid() -->
                            </div>
                        </div>

                        <!-- ═══════════════════════════════ -->
                        <!-- DUE SUMMARY WARNING BAR         -->
                        <!-- ═══════════════════════════════ -->
                        <div id="collectorDueSummaryBar" class="hidden rounded-2xl border-2 overflow-hidden shadow-sm transition-all duration-300">
                            <!-- Dynamic content injected by backward-chaining algorithm -->
                        </div>

                        <!-- ═══════════════════════════════ -->
                        <!-- CHECKOUT SECTION                -->
                        <!-- ═══════════════════════════════ -->
                        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm overflow-hidden">
                            <div class="px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div>
                                    <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Checkout Total</span>
                                    <div class="flex items-baseline gap-2">
                                        <span id="collectorCheckoutTotal" class="text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">₹ 0</span>
                                        <span id="collectorCheckoutBreakdown" class="text-xs font-bold text-slate-400">(0 months × ₹${feeConfig.monthlyFee})</span>
                                    </div>
                                </div>
                                <button onclick="window.PaymentCollectorModule.submitPayment()" id="collectorSubmitBtn"
                                    class="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-sm transition-all shadow-lg active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled>
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    Submit Payment
                                    <svg id="collectorSubmitSpinner" class="animate-spin h-4 w-4 hidden" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ═══════════════════════════════════════ -->
                <!-- FEE SETTINGS ADMIN CARD (Collapsible)   -->
                <!-- ═══════════════════════════════════════ -->
                <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm overflow-hidden">
                    <button onclick="window.PaymentCollectorModule.toggleFeeSettings()" type="button"
                        class="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer">
                        <div class="flex items-center gap-3">
                            <span class="text-xl">⚙️</span>
                            <span class="font-extrabold text-sm text-slate-700 dark:text-slate-200">Global Fee Rate Settings</span>
                        </div>
                        <svg id="feeSettingsChevron" class="w-5 h-5 text-slate-400 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                        </svg>
                    </button>
                    <div id="collectorFeeSettingsBody" class="hidden border-t border-slate-100 dark:border-slate-700">
                        <div class="p-5 space-y-4">
                            <div class="bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl px-4 py-3">
                                <p class="text-xs font-bold text-amber-700 dark:text-amber-400">
                                    ⚠️ Changing these rates affects all future payment calculations globally. Existing records remain unmodified.
                                </p>
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div class="space-y-1.5">
                                    <label class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Monthly Fee (₹)</label>
                                    <input type="number" id="feeSettingsMonthly" min="0" step="1" value="${feeConfig.monthlyFee}"
                                        class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all text-lg">
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Admission Fee (₹)</label>
                                    <input type="number" id="feeSettingsAdmission" min="0" step="1" value="${feeConfig.admissionFee}"
                                        class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all text-lg">
                                </div>
                            </div>
                            <button onclick="window.PaymentCollectorModule.saveFeeConfig()" id="feeSettingsSaveBtn"
                                class="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold text-sm transition-all shadow-sm active:scale-[0.97]">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                                Save Fee Configuration
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // =========================================
    // 🔍 AUTOCOMPLETE LOOKUP ENGINE
    // =========================================

    /**
     * Sets up the real-time autocomplete input listener.
     * Searches window.MasterCandidateCache by STUDENT_NAME, STUDENT_ID, and STUDENT_MOBILE.
     */
    function setupAutocomplete() {
        var input = document.getElementById('collectorSearchInput');
        var dropdown = document.getElementById('collectorAutocompleteDropdown');
        if (!input || !dropdown) return;

        var debounceTimer = null;

        input.addEventListener('input', function () {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(function () {
                var query = (input.value || '').toLowerCase().trim();

                if (query.length < 2) {
                    dropdown.classList.add('hidden');
                    dropdown.innerHTML = '';
                    return;
                }

                var cache = window.MasterCandidateCache || [];
                var matches = [];

                for (var i = 0; i < cache.length; i++) {
                    var c = cache[i];
                    var nameMatch = c.STUDENT_NAME && String(c.STUDENT_NAME).toLowerCase().indexOf(query) !== -1;
                    var idMatch = c.STUDENT_ID && String(c.STUDENT_ID).toLowerCase().indexOf(query) !== -1;
                    var mobileMatch = c.STUDENT_MOBILE && String(c.STUDENT_MOBILE).toLowerCase().indexOf(query) !== -1;

                    // Safe type-casting guard for numeric roll numbers
                    var rollStr = c.RL_NO !== undefined && c.RL_NO !== null ? String(c.RL_NO).toLowerCase() : '';
                    var rollMatch = rollStr.indexOf(query) !== -1;

                    if (nameMatch || idMatch || mobileMatch || rollMatch) {
                        matches.push({ candidate: c, index: i });
                    }

                    if (matches.length >= 15) break; // Cap results to prevent DOM overload
                }

                if (matches.length === 0) {
                    dropdown.innerHTML = '<div class="px-4 py-3 text-sm text-slate-400 font-medium text-center">No students found</div>';
                    dropdown.classList.remove('hidden');
                    return;
                }

                var html = '';
                for (var j = 0; j < matches.length; j++) {
                    var m = matches[j].candidate;
                    var initial = m.STUDENT_NAME ? m.STUDENT_NAME.charAt(0).toUpperCase() : '?';
                    html += '<button type="button" onclick="window.PaymentCollectorModule.selectCandidateByIndex(' + matches[j].index + ')"' +
                        ' class="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left border-b border-slate-100 dark:border-slate-700/50 last:border-0">' +
                        '<div class="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400 font-black text-sm shrink-0">' + initial + '</div>' +
                        '<div class="min-w-0 flex-1">' +
                        '<p class="text-sm font-bold text-slate-800 dark:text-white truncate">' + (m.STUDENT_NAME || 'Unknown') + '</p>' +
                        '<p class="text-[11px] text-slate-400 font-medium truncate">' + (m.STUDENT_ID || '') + ' · ' + (m.ENROLLED_COURSE || '') + ' · ' + (m.STUDENT_MOBILE || '') + '</p>' +
                        '</div>' +
                        '<svg class="w-4 h-4 text-slate-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>' +
                        '</button>';
                }

                dropdown.innerHTML = html;
                dropdown.classList.remove('hidden');
            }, 150);
        });

        // Close dropdown on outside click
        document.addEventListener('click', function (e) {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });

        // Close dropdown on Escape
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                dropdown.classList.add('hidden');
                input.blur();
            }
        });
    }

    /**
     * Selects a candidate from the autocomplete dropdown by cache index.
     */
    function selectCandidateByIndex(index) {
        var cache = window.MasterCandidateCache || [];
        if (index >= 0 && index < cache.length) {
            selectCandidate(cache[index]);
        }
    }

    /**
     * Binds a candidate's properties into the module's tracking variables and updates the UI.
     * @param {Object} candidate - Full candidate record object from MasterCandidateCache
     */
    function selectCandidate(candidate) {
        if (!candidate) return;

        _selectedCandidate = candidate;
        _mergedLogs = [];
        _dueAnalysisComplete = false;

        // Update search input
        var input = document.getElementById('collectorSearchInput');
        if (input) input.value = candidate.STUDENT_NAME || '';

        // Close dropdown
        var dropdown = document.getElementById('collectorAutocompleteDropdown');
        if (dropdown) dropdown.classList.add('hidden');

        // Populate profile card
        var card = document.getElementById('collectorSelectedCard');
        if (card) card.classList.remove('hidden');

        var initial = candidate.STUDENT_NAME ? candidate.STUDENT_NAME.charAt(0).toUpperCase() : '?';
        setTextById('collectorAvatarInitial', initial);
        setTextById('collectorStudentName', candidate.STUDENT_NAME || '—');
        setTextById('collectorStudentCourse', candidate.ENROLLED_COURSE || '—');
        setTextById('collectorStudentId', candidate.STUDENT_ID || '—');
        setTextById('collectorRollNo', candidate.RL_NO || '—');
        setTextById('collectorStudentMobile', candidate.STUDENT_MOBILE || '—');

        var admDate = parseAdmissionDate(candidate.DATE_OF_ADMISSION);
        setTextById('collectorAdmissionDate', formatDateDisplay(admDate));

        // Reset the month grid (unlock all, uncheck all)
        resetMonthGrid();
        hideDueSummary();
        updateCheckoutTotal();
    }

    /**
     * Helper: safely sets text content of an element by ID.
     */
    function setTextById(id, text) {
        var el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    /**
     * Clears the current selection and resets the form.
     */
    function clearSelection() {
        _selectedCandidate = null;
        _mergedLogs = [];
        _dueAnalysisComplete = false;

        var input = document.getElementById('collectorSearchInput');
        if (input) input.value = '';

        var card = document.getElementById('collectorSelectedCard');
        if (card) card.classList.add('hidden');

        resetMonthGrid();
        hideDueSummary();
        updateCheckoutTotal();
    }

    // =========================================
    // 📅 MONTH CHECKBOX GRID
    // =========================================

    /**
     * Builds the 12-month checkbox grid inside #collectorMonthGrid.
     * Each month is a styled card with a checkbox, icon, and label.
     */
    function buildMonthGrid() {
        var grid = document.getElementById('collectorMonthGrid');
        if (!grid) return;

        var html = '';
        for (var i = 0; i < 12; i++) {
            html += '<label id="monthCard_' + i + '" class="relative flex items-center gap-3 p-3.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 cursor-pointer hover:border-brand-400 dark:hover:border-brand-500 transition-all duration-200 select-none group">' +
                '<input type="checkbox" id="monthCb_' + i + '" data-month-index="' + i + '"' +
                ' onchange="window.PaymentCollectorModule.handleMonthCheck(' + i + ')"' +
                ' class="w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500 focus:ring-2 transition-all shrink-0 cursor-pointer accent-emerald-600">' +
                '<span class="text-lg shrink-0">' + MONTH_ICONS[i] + '</span>' +
                '<span class="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">' + MONTH_NAMES[i] + '</span>' +
                '</label>';
        }

        grid.innerHTML = html;
    }

    /**
     * Resets all month checkboxes to unchecked and unlocked state.
     */
    function resetMonthGrid() {
        for (var i = 0; i < 12; i++) {
            var cb = document.getElementById('monthCb_' + i);
            var card = document.getElementById('monthCard_' + i);
            if (cb) {
                cb.checked = false;
                cb.disabled = false;
            }
            if (card) {
                card.className = 'relative flex items-center gap-3 p-3.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 cursor-pointer hover:border-brand-400 dark:hover:border-brand-500 transition-all duration-200 select-none group';
            }
        }
    }

    /**
     * Handles individual month checkbox change events.
     * Updates checkout total and submit button state.
     */
    function handleMonthCheck(monthIndex) {
        var cb = document.getElementById('monthCb_' + monthIndex);
        var card = document.getElementById('monthCard_' + monthIndex);

        if (cb && card && !cb.disabled) {
            if (cb.checked) {
                card.className = 'relative flex items-center gap-3 p-3.5 rounded-xl border-2 border-brand-500 dark:border-brand-400 bg-brand-50 dark:bg-brand-900/20 cursor-pointer transition-all duration-200 select-none group ring-2 ring-brand-500/20';
            } else {
                card.className = 'relative flex items-center gap-3 p-3.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 cursor-pointer hover:border-brand-400 dark:hover:border-brand-500 transition-all duration-200 select-none group';
            }
        }

        updateCheckoutTotal();
    }

    /**
     * Year input change handler with /^\d{4}$/ regex guard.
     */
    function handleYearChange(input) {
        var val = input.value.replace(/\D/g, '').slice(0, 4);
        input.value = val;

        var statusEl = document.getElementById('collectorYearStatus');
        var errorEl = document.getElementById('collectorYearError');

        if (/^\d{4}$/.test(val)) {
            _calendarYear = parseInt(val, 10);
            if (statusEl) { statusEl.classList.remove('hidden'); }
            if (errorEl) { errorEl.classList.add('hidden'); }
        } else {
            if (statusEl) { statusEl.classList.add('hidden'); }
            if (errorEl) { errorEl.classList.remove('hidden'); }
        }
    }

    // =========================================
    // 📊 CHECKOUT TOTAL CALCULATOR
    // =========================================

    /**
     * Scans all month checkboxes, counts newly checked (non-disabled) months,
     * and updates the live checkout pricing label.
     * Formula: Newly Checked Months × window.PaymentCollectorModule.feeConfig.monthlyFee
     */
    function updateCheckoutTotal() {
        var newCount = 0;
        for (var i = 0; i < 12; i++) {
            var cb = document.getElementById('monthCb_' + i);
            if (cb && cb.checked && !cb.disabled) {
                newCount++;
            }
        }

        var total = newCount * feeConfig.monthlyFee;

        var totalEl = document.getElementById('collectorCheckoutTotal');
        if (totalEl) totalEl.textContent = '₹ ' + total.toLocaleString('en-IN');

        var breakdownEl = document.getElementById('collectorCheckoutBreakdown');
        if (breakdownEl) breakdownEl.textContent = '(' + newCount + ' month' + (newCount !== 1 ? 's' : '') + ' × ₹' + feeConfig.monthlyFee + ')';

        var counterEl = document.getElementById('collectorMonthCounter');
        if (counterEl) counterEl.textContent = newCount + ' selected';

        // Enable/disable submit button
        var submitBtn = document.getElementById('collectorSubmitBtn');
        if (submitBtn) {
            submitBtn.disabled = (newCount === 0 || !_selectedCandidate);
        }
    }

    // =========================================
    // 🔄 BACKWARD-CHAINING WATERFALL ALGORITHM
    // =========================================

    /**
     * Master "Check Due & History" handler.
     * Fetches payment logs for the selected student, executes the backward-chaining
     * waterfall to detect outstanding dues across year boundaries, locks paid months,
     * and renders the due summary panel.
     */
    async function checkDueAndHistory() {
        if (!_selectedCandidate) {
            if (window.UIUtils) window.UIUtils.showToast('Please select a student first.', 'error');
            return;
        }

        var yearInput = document.getElementById('collectorYearInput');
        var yearVal = yearInput ? yearInput.value : '';
        if (!/^\d{4}$/.test(yearVal)) {
            if (window.UIUtils) window.UIUtils.showToast('Please enter a valid 4-digit year.', 'error');
            return;
        }
        _calendarYear = parseInt(yearVal, 10);

        var studentId = String(_selectedCandidate.STUDENT_ID);
        var checkBtn = document.getElementById('collectorCheckDueBtn');

        if (checkBtn) {
            checkBtn.disabled = true;
            checkBtn.innerHTML = '<svg class="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Analyzing...';
        }

        try {
            _mergedLogs = [];
            resetMonthGrid();

            var currentYearLogs = await fetchStudentLogs(studentId, _calendarYear);
            _mergedLogs = currentYearLogs.slice();

            var admDate = parseAdmissionDate(_selectedCandidate.DATE_OF_ADMISSION);
            var admMonth = admDate ? admDate.getMonth() : 0;
            var admYear = admDate ? admDate.getFullYear() : _calendarYear;

            var now = new Date();
            var endMonth;
            if (_calendarYear === now.getFullYear()) {
                endMonth = now.getMonth();
            } else if (_calendarYear < now.getFullYear()) {
                endMonth = 11;
            } else {
                endMonth = 0;
            }

            var paidMonthsMap = buildPaidMonthsMap(_mergedLogs, _calendarYear);

            // FIX: Check against standard 'YYYY-01' format instead of 'January-YYYY'
            var januaryKey = _calendarYear + '-01';
            var januaryPaid = paidMonthsMap[januaryKey] === true;
            var prevYearLogs = [];

            if (!januaryPaid && admYear < _calendarYear) {
                prevYearLogs = await fetchStudentLogs(studentId, _calendarYear - 1);
                _mergedLogs = _mergedLogs.concat(prevYearLogs);

                var prevPaidMap = buildPaidMonthsMap(prevYearLogs, _calendarYear - 1);
                for (var key in prevPaidMap) {
                    if (prevPaidMap.hasOwnProperty(key)) {
                        paidMonthsMap[key] = prevPaidMap[key];
                    }
                }
            }

            lockPaidMonths(paidMonthsMap, _calendarYear);

            var analysis = computeDueAnalysis(paidMonthsMap, admMonth, admYear, _calendarYear, endMonth, prevYearLogs.length > 0 ? _calendarYear - 1 : null);
            _dueAnalysisComplete = true;

            renderDueSummary(analysis);

            if (window.UIUtils) window.UIUtils.showToast('Payment history loaded for ' + _selectedCandidate.STUDENT_NAME + '.', 'success');

        } catch (err) {
            console.error('[PaymentCollector] Due check error:', err);
            if (window.UIUtils) window.UIUtils.showToast('Failed to load payment history: ' + err.message, 'error');
        } finally {
            if (checkBtn) {
                checkBtn.disabled = false;
                checkBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg> Check Due & History';
            }
            updateCheckoutTotal();
        }
    }

    /**
     * Fetches a student's payment logs for a specific year via LAZY_FETCH_STUDENT_LOGS.
     * @param {string} studentId
     * @param {number} targetYear
     * @returns {Promise<Array>} Array of payment log objects
     */
    async function fetchStudentLogs(studentId, targetYear) {
        try {
            var res = await window.UIUtils.fetchFromEngine({
                action: 'LAZY_FETCH_STUDENT_LOGS',
                studentId: String(studentId),
                targetYear: targetYear,
                token: getAuthToken()
            });

            if (res && res.status === 'success' && Array.isArray(res.data)) {
                return res.data;
            }
            return [];
        } catch (err) {
            console.debug('[PaymentCollector] Log fetch failed for year ' + targetYear + ':', err);
            return [];
        }
    }

    /**
     * Builds a lookup map of paid months from payment log records.
     * Keys: "MonthName-YYYY" (e.g., "January-2026"), Values: true if PAID.
     * @param {Array} logs - Payment log records
     * @param {number} year - The year these logs belong to
     * @returns {Object} Map of { "MonthName-YYYY": true/false }
     */
    function buildPaidMonthsMap(logs, year) {
        var map = {};
        for (var i = 0; i < logs.length; i++) {
            var entry = logs[i];
            if (entry.STATUS === 'PAID' && entry.FEE_PERIOD) {
                map[entry.FEE_PERIOD] = true;
            }
        }
        return map;
    }

    /**
     * Applies safe-lock styling to paid months in the current year grid.
     * For any month marked as "PAID" in the merged logs:
     *   - Sets checkbox .checked = true and .disabled = true
     *   - Styles the card as a locked green badge
     * @param {Object} paidMonthsMap - Map from buildPaidMonthsMap()
     * @param {number} year - The calendar year for the current grid
     */
    function lockPaidMonths(paidMonthsMap, year) {
        for (var i = 0; i < 12; i++) {
            // FIX: Use padded month lookup to align with database standard
            var paddedMonth = String(i + 1).padStart(2, '0');
            var lookupKey = year + '-' + paddedMonth;
            
            var cb = document.getElementById('monthCb_' + i);
            var card = document.getElementById('monthCard_' + i);

            if (paidMonthsMap[lookupKey] === true) {
                if (cb) {
                    cb.checked = true;
                    cb.disabled = true;
                }
                if (card) {
                    card.className = 'relative flex items-center gap-3 p-3.5 rounded-xl border-2 border-emerald-400 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 cursor-not-allowed transition-all duration-200 select-none group opacity-90';
                }
            }
        }
    }

    /**
     * Computes the true delta discrepancy between expected months and verified paid rows.
     *
     * Walks backward from the current operational month through the timeline:
     *   - Starts at endMonth of the current calendar year
     *   - Goes back to admission month of admission year
     *   - Counts expected months and verified paid months
     *   - Reports the gap
     *
     * @param {Object} paidMonthsMap - Combined paid months map (current + previous year)
     * @param {number} admMonth - 0-indexed admission month
     * @param {number} admYear - Year of admission
     * @param {number} calYear - Current calendar year being analyzed
     * @param {number} endMonth - Last month to consider (0-indexed, inclusive)
     * @param {number|null} prevYear - Previous year if cascaded, null otherwise
     * @returns {Object} Analysis result
     */
    function computeDueAnalysis(paidMonthsMap, admMonth, admYear, calYear, endMonth, prevYear) {
        var expectedMonths = 0;
        var paidMonths = 0;
        var unpaidPeriods = [];
        var paidPeriods = [];

        var startMonthThisYear = (admYear === calYear) ? admMonth : 0;
        for (var m = startMonthThisYear; m <= endMonth; m++) {
            expectedMonths++;
            
            // FIX: Separate the DB lookup key from the UI display text
            var paddedMonth = String(m + 1).padStart(2, '0');
            var lookupKey = calYear + '-' + paddedMonth;
            var displayKey = MONTH_NAMES[m] + ' ' + calYear;

            if (paidMonthsMap[lookupKey] === true) {
                paidMonths++;
                paidPeriods.push(displayKey);
            } else {
                unpaidPeriods.push(displayKey);
            }
        }

        if (prevYear !== null && admYear <= prevYear) {
            var prevStartMonth = (admYear === prevYear) ? admMonth : 0;
            for (var p = prevStartMonth; p <= 11; p++) {
                expectedMonths++;
                
                var paddedP = String(p + 1).padStart(2, '0');
                var prevLookupKey = prevYear + '-' + paddedP;
                var prevDisplayKey = MONTH_NAMES[p] + ' ' + prevYear;

                if (paidMonthsMap[prevLookupKey] === true) {
                    paidMonths++;
                    paidPeriods.push(prevDisplayKey);
                } else {
                    unpaidPeriods.push(prevDisplayKey);
                }
            }
        }

        var dueMonths = expectedMonths - paidMonths;
        var dueAmount = dueMonths * feeConfig.monthlyFee;

        return {
            expectedMonths: expectedMonths,
            paidMonths: paidMonths,
            dueMonths: dueMonths,
            dueAmount: dueAmount,
            unpaidPeriods: unpaidPeriods,
            paidPeriods: paidPeriods,
            admMonth: admMonth,
            admYear: admYear,
            cascaded: prevYear !== null
        };
    }

    // =========================================
    // 🚨 DUE SUMMARY BAR RENDERER
    // =========================================

    /**
     * Renders the high-visibility due summary warning panel.
     * @param {Object} analysis - Output from computeDueAnalysis()
     */
    function renderDueSummary(analysis) {
        var bar = document.getElementById('collectorDueSummaryBar');
        if (!bar) return;

        var isClean = analysis.dueMonths === 0;
        var borderColor = isClean ? 'border-emerald-400 dark:border-emerald-500' : 'border-amber-400 dark:border-amber-500';
        var bgColor = isClean ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-amber-50 dark:bg-amber-900/20';
        var headerBg = isClean ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-rose-500';
        var headerIcon = isClean
            ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
            : '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>';
        var headerTitle = isClean ? 'All Dues Cleared ✓' : '⚠️ Outstanding Dues Detected';

        bar.className = 'rounded-2xl border-2 overflow-hidden shadow-sm transition-all duration-300 ' + borderColor;

        var unpaidListHtml = '';
        if (analysis.unpaidPeriods.length > 0) {
            unpaidListHtml = '<div class="mt-3"><p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Unpaid Periods</p><div class="flex flex-wrap gap-1.5">';
            for (var u = 0; u < analysis.unpaidPeriods.length; u++) {
                unpaidListHtml += '<span class="px-2.5 py-1 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-[11px] font-bold rounded-lg border border-rose-200 dark:border-rose-800">' + analysis.unpaidPeriods[u] + '</span>';
            }
            unpaidListHtml += '</div></div>';
        }

        var cascadeNote = '';
        if (analysis.cascaded) {
            cascadeNote = '<div class="mt-3 flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">' +
                '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>' +
                'Backward cascade: Previous year\'s log sheet was also scanned for continuity.' +
                '</div>';
        }

        bar.innerHTML =
            '<div class="' + headerBg + ' px-5 py-3 flex items-center gap-2 text-white font-extrabold text-sm">' +
                headerIcon +
                '<span>' + headerTitle + '</span>' +
            '</div>' +
            '<div class="' + bgColor + ' p-5">' +
                '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">' +
                    '<div class="bg-white dark:bg-slate-800 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700 text-center">' +
                        '<span class="text-[10px] font-black text-slate-400 uppercase block">Expected</span>' +
                        '<span class="text-2xl font-black text-slate-800 dark:text-white tabular-nums">' + analysis.expectedMonths + '</span>' +
                        '<span class="text-[10px] text-slate-400 block">months</span>' +
                    '</div>' +
                    '<div class="bg-white dark:bg-slate-800 rounded-xl px-4 py-3 border border-emerald-200 dark:border-emerald-800 text-center">' +
                        '<span class="text-[10px] font-black text-emerald-500 uppercase block">Paid</span>' +
                        '<span class="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">' + analysis.paidMonths + '</span>' +
                        '<span class="text-[10px] text-emerald-400 block">verified</span>' +
                    '</div>' +
                    '<div class="bg-white dark:bg-slate-800 rounded-xl px-4 py-3 border border-rose-200 dark:border-rose-800 text-center">' +
                        '<span class="text-[10px] font-black text-rose-500 uppercase block">Due</span>' +
                        '<span class="text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums">' + analysis.dueMonths + '</span>' +
                        '<span class="text-[10px] text-rose-400 block">months</span>' +
                    '</div>' +
                    '<div class="bg-white dark:bg-slate-800 rounded-xl px-4 py-3 border border-amber-200 dark:border-amber-800 text-center">' +
                        '<span class="text-[10px] font-black text-amber-500 uppercase block">Amount Due</span>' +
                        '<span class="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">₹' + analysis.dueAmount.toLocaleString('en-IN') + '</span>' +
                        '<span class="text-[10px] text-amber-400 block">total</span>' +
                    '</div>' +
                '</div>' +
                unpaidListHtml +
                cascadeNote +
                '<div class="mt-3 text-[11px] text-slate-400 font-medium">' +
                    'Admission: ' + MONTH_NAMES[analysis.admMonth] + ' ' + analysis.admYear +
                    ' · Fee Rate: ₹' + feeConfig.monthlyFee + '/month' +
                '</div>' +
            '</div>';

        bar.classList.remove('hidden');
    }

    /**
     * Hides the due summary bar.
     */
    function hideDueSummary() {
        var bar = document.getElementById('collectorDueSummaryBar');
        if (bar) {
            bar.classList.add('hidden');
            bar.innerHTML = '';
        }
    }

    // =========================================
    // 💰 PAYMENT SUBMISSION ENGINE
    // =========================================

    /**
     * Collects all newly checked (non-disabled) months, builds payment records,
     * and submits them via BULK_LOG_PAYMENTS to the sharded backend.
     */
    async function submitPayment() {
        if (_isProcessing) return;
        if (!_selectedCandidate) {
            if (window.UIUtils) window.UIUtils.showToast('No student selected.', 'error');
            return;
        }

        // Collect newly checked months
        var newMonths = [];
        for (var i = 0; i < 12; i++) {
            var cb = document.getElementById('monthCb_' + i);
            if (cb && cb.checked && !cb.disabled) {
                newMonths.push(i);
            }
        }

        if (newMonths.length === 0) {
            if (window.UIUtils) window.UIUtils.showToast('Please select at least one new month to pay for.', 'error');
            return;
        }

        // Confirmation gate
        var totalAmount = newMonths.length * feeConfig.monthlyFee;
        var confirmMsg = 'Confirm payment of ₹' + totalAmount.toLocaleString('en-IN') + ' for ' + newMonths.length + ' month(s) for ' + _selectedCandidate.STUDENT_NAME + '?';
        if (!confirm(confirmMsg)) return;

        _isProcessing = true;
        var submitBtn = document.getElementById('collectorSubmitBtn');
        var spinner = document.getElementById('collectorSubmitSpinner');

        if (submitBtn) submitBtn.disabled = true;
        if (spinner) spinner.classList.remove('hidden');

        try {
            var timestamp = new Date().toISOString();
            var payloadArray = [];

            for (var j = 0; j < newMonths.length; j++) {
                var monthIdx = newMonths[j];
                // Ensure months map as "01", "02" ... "12"
                var paddedMonth = String(monthIdx + 1).padStart(2, '0');
                var feePeriodStr = _calendarYear + '-' + paddedMonth; // e.g., "2026-06"

                payloadArray.push({
                    TXN_ID: generateTxnId(),
                    TIMESTAMP: timestamp,
                    STUDENT_ID: String(_selectedCandidate.STUDENT_ID),
                    RL_NO: String(_selectedCandidate.RL_NO || ''),
                    STUDENT_NAME: String(_selectedCandidate.STUDENT_NAME || ''),
                    FEE_PERIOD: feePeriodStr,
                    STATUS: 'PAID',
                    AMOUNT_COLLECTED: feeConfig.monthlyFee
                });
            }

            var res = await window.UIUtils.fetchFromEngine({
                action: 'BULK_LOG_PAYMENTS',
                payloadArray: payloadArray,
                token: getAuthToken()
            });

            if (res && (res.status === 'success' || res.success === true)) {
                if (window.UIUtils) window.UIUtils.showToast('✅ ' + newMonths.length + ' payment(s) logged successfully!', 'success');

                // Lock the newly paid months as green badges (optimistic UI)
                for (var k = 0; k < newMonths.length; k++) {
                    var mIdx = newMonths[k];
                    var lockCb = document.getElementById('monthCb_' + mIdx);
                    var lockCard = document.getElementById('monthCard_' + mIdx);

                    if (lockCb) {
                        lockCb.checked = true;
                        lockCb.disabled = true;
                    }
                    if (lockCard) {
                        lockCard.className = 'relative flex items-center gap-3 p-3.5 rounded-xl border-2 border-emerald-400 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 cursor-not-allowed transition-all duration-200 select-none group opacity-90';
                    }
                }

                // Re-run due analysis to reflect changes
                if (_dueAnalysisComplete) {
                    await checkDueAndHistory();
                }

                updateCheckoutTotal();
            } else {
                throw new Error((res && res.message) || 'Server returned an error response.');
            }

        } catch (err) {
            console.error('[PaymentCollector] Submit error:', err);
            if (window.UIUtils) window.UIUtils.showToast('Payment submission failed: ' + err.message, 'error');
        } finally {
            _isProcessing = false;
            if (spinner) spinner.classList.add('hidden');
            updateCheckoutTotal();
        }
    }

    // =========================================
    // ⚙️ FEE SETTINGS ADMIN CARD
    // =========================================

    /**
     * Toggles the collapsible fee settings panel.
     */
    function toggleFeeSettings() {
        var body = document.getElementById('collectorFeeSettingsBody');
        var chevron = document.getElementById('feeSettingsChevron');
        _feeSettingsOpen = !_feeSettingsOpen;

        if (body) {
            if (_feeSettingsOpen) {
                body.classList.remove('hidden');
            } else {
                body.classList.add('hidden');
            }
        }
        if (chevron) {
            chevron.style.transform = _feeSettingsOpen ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    }

    /**
     * Reads the fee settings inputs and dispatches SET_FEE_CONFIG to the backend.
     * Updates the shared feeConfig object on success.
     */
    async function saveFeeConfig() {
        var monthlyInput = document.getElementById('feeSettingsMonthly');
        var admissionInput = document.getElementById('feeSettingsAdmission');
        var saveBtn = document.getElementById('feeSettingsSaveBtn');

        if (!monthlyInput || !admissionInput) return;

        var newMonthly = Number(monthlyInput.value);
        var newAdmission = Number(admissionInput.value);

        if (isNaN(newMonthly) || newMonthly < 0) {
            if (window.UIUtils) window.UIUtils.showToast('Monthly fee must be a non-negative number.', 'error');
            return;
        }
        if (isNaN(newAdmission) || newAdmission < 0) {
            if (window.UIUtils) window.UIUtils.showToast('Admission fee must be a non-negative number.', 'error');
            return;
        }

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
        }

        try {
            var res = await window.UIUtils.fetchFromEngine({
                action: 'SET_FEE_CONFIG',
                monthlyFee: newMonthly,
                admissionFee: newAdmission,
                token: getAuthToken()
            });

            if (res && res.status === 'success') {
                // Update the shared mutable feeConfig object properties in-place
                feeConfig.monthlyFee = newMonthly;
                feeConfig.admissionFee = newAdmission;

                updateCheckoutTotal();

                if (window.UIUtils) window.UIUtils.showToast('Fee configuration saved successfully.', 'success');
            } else {
                throw new Error((res && res.message) || 'Server returned an error.');
            }
        } catch (err) {
            console.error('[PaymentCollector] Fee config save error:', err);
            if (window.UIUtils) window.UIUtils.showToast('Failed to save fee config: ' + err.message, 'error');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Save Fee Configuration';
            }
        }
    }

    // =========================================
    // 🔀 CROSS-MODULE BRIDGE
    // =========================================

    /**
     * Global callback entry gate for cross-module navigation.
     * Called from directoryViewer.js "Pay Fees" button:
     *   window.PaymentCollectorModule.openCartForCandidate(candidateRecordObject)
     *
     * Forces the screen to activate the Fee Collector workspace and pre-populates
     * the student profile parameters into form variables instantly.
     *
     * @param {Object} candidateData - Full candidate record from MasterCandidateCache
     */
    async function openCartForCandidate(candidateData) {
        if (!candidateData) return;

        _pendingCandidate = candidateData;

        // Navigate to this module — mount() will pick up _pendingCandidate
        if (window.AppCore && window.AppCore.navigateTo) {
            await window.AppCore.navigateTo('paymentCollector');
        }

        // If already mounted (navigateTo was a no-op because module was active),
        // apply the selection immediately since mount() won't run again
        if (_pendingCandidate && document.getElementById('collectorSearchInput')) {
            selectCandidate(_pendingCandidate);
            _pendingCandidate = null;
        }
    }

    // =========================================
    // 📦 PUBLIC API
    // =========================================
    return {
        mount: mount,
        init: init,
        openCartForCandidate: openCartForCandidate,
        selectCandidateByIndex: selectCandidateByIndex,
        clearSelection: clearSelection,
        handleMonthCheck: handleMonthCheck,
        handleYearChange: handleYearChange,
        checkDueAndHistory: checkDueAndHistory,
        submitPayment: submitPayment,
        toggleFeeSettings: toggleFeeSettings,
        saveFeeConfig: saveFeeConfig,
        feeConfig: feeConfig
    };

})();
