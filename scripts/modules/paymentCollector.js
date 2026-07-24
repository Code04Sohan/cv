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
        _container.innerHTML = buildPremiumCollectorHTML();

        // Re-Bind Click Trigger for Execution Settlement
        var submitBtn = document.getElementById('collectorSubmitBtn');
        if (submitBtn) {
            submitBtn.onclick = submitPayment;
        }

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
            await selectCandidate(_pendingCandidate);
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

    function buildPremiumCollectorHTML() {
        const standardDateIso = new Date().toISOString().split('T')[0];
        const standardYear = new Date().getFullYear();

        return `
        <div class="space-y-6 max-w-6xl mx-auto p-2">
            <!-- FIXED 1. PREMIUM BRANDED TOP HEADER (Matching design specifications in image_7957f.png) -->
            <div class="flex items-center gap-3.5 p-4 bg-slate-900/10 dark:bg-slate-800/10 border border-slate-200/60 dark:border-slate-800/50 rounded-2xl select-none mb-4 animate-fadeIn">
                <div class="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shadow-inner border border-indigo-500/10">
                    <!-- Premium Bank Card Vector Icon -->
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                </div>
                <div>
                    <h1 class="text-base font-black text-slate-800 dark:text-slate-100 tracking-wide uppercase">Fee Collector Workspace</h1>
                    <p class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Process monthly student tuition payments and issue dynamic digital statements</p>
                </div>
            </div>

            <!-- SEARCH CONTAINER ROW -->
            <div class="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm relative">
                <label class="block text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Search Active Candidate</label>
                <div class="relative">
                    <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    </span>
                    <input type="text" id="collector_search_input" class="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all shadow-inner" placeholder="Type student name, unique ID, or contact number...">
                </div>
                <div id="collector_search_dropdown" class="absolute left-5 right-5 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto hidden"></div>
            </div>

            <!-- CENTRAL MATRIX LAYOUT SHARDS -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                <!-- LEFT AREA: LOADED CANDIDATE CARD -->
                <div class="lg:col-span-5 bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm space-y-4">
                    <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-3 gap-2">
                        <h3 class="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Selected Candidate Profile</h3>
                        <button type="button" id="pc_due_checker_btn" disabled class="px-3 py-1.5 text-[11px] font-black tracking-wider uppercase bg-brand-50 hover:bg-brand-100 text-brand-600 rounded-lg transition-all border border-brand-200/40 disabled:opacity-40 disabled:cursor-not-allowed select-none whitespace-nowrap" onclick="triggerPremiumDueAnalysis()">
                            🔍 Check Dues
                        </button>
                    </div>

                    <div id="pc_student_card_empty" class="py-8 text-center text-xs font-medium text-slate-400">No student profile actively loaded into context.</div>
                    
                    <div id="pc_student_card_data" class="hidden space-y-3 animate-fadeIn">
                        <div class="flex items-center justify-between gap-3">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-800" id="lbl_pc_avatar">--</div>
                                <div>
                                    <div class="text-sm font-bold text-slate-800 dark:text-slate-100" id="lbl_pc_name">--</div>
                                    <div class="text-[10px] font-mono text-slate-400" id="lbl_pc_id">--</div>
                                </div>
                            </div>
                            
                            <!-- ADDED: 3. PREMIUM "SHOW MORE" HISTORY REDIRECT BUTTON -->
                            <button type="button" id="pc_ledger_redirect_btn" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-black tracking-wider uppercase transition-all shadow-sm active:scale-95 flex items-center gap-1 cursor-pointer select-none">
                                📋 Show More
                            </button>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-2 pt-2 text-xs">
                            <div class="bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-900"><span class="block text-[9px] font-bold text-slate-400 uppercase">Roll Number</span><span class="font-bold text-slate-700 dark:text-slate-300" id="lbl_pc_roll">--</span></div>
                            <div class="bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-900"><span class="block text-[9px] font-bold text-slate-400 uppercase">Contact Mobile</span><span class="font-bold text-slate-700 dark:text-slate-300" id="lbl_pc_phone">--</span></div>
                        </div>
                        <div class="p-2.5 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-xl border border-indigo-100/50 dark:border-indigo-950/50 text-center">
                            <span class="text-[11px] font-bold text-indigo-600 dark:text-indigo-400" id="lbl_pc_meta_banner">--</span>
                        </div>
                    </div>

                    <div id="pc_premium_due_viewer" class="hidden mt-3 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 transition-all animate-fadeIn"></div>
                </div>

                <!-- RIGHT AREA: CHECKOUT MATRIX (Target tracking window for image_878abf.png) -->
                <div class="lg:col-span-7 bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm space-y-5">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-900 pb-3">
                        <h3 class="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Monthly Billing Checkout Matrix</h3>
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold text-slate-400 select-none">Year:</span>
                            <select id="pc_calendar_year_select" class="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500">
                                <option value="${standardYear}" selected>${standardYear}</option>
                                <option value="${standardYear - 1}">${standardYear - 1}</option>
                                <option value="${standardYear + 1}">${standardYear + 1}</option>
                            </select>
                        </div>
                    </div>

                    <!-- Verified target rendering wrapper container grid matrix node -->
                    <div id="pc_months_grid_container" class="grid grid-cols-3 sm:grid-cols-4 gap-2.5 min-h-[120px]">
                        <!-- Checkbox matrix nodes must render cleanly here via JavaScript injection handlers -->
                    </div>
                </div>
            </div>

            <!-- LOWER TOTAL CODES ARRAY HOOK BLOCK -->
            <div class="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                <div class="md:col-span-4 bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800/60">
                    <label class="block text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">Collection Processing Date</label>
                    <input type="date" id="pc_pay_date" value="${standardDateIso}" class="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/10 focus:border-brand-500 transition-all shadow-sm">
                </div>
                <div class="md:col-span-8 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-5">
                    <div class="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/40 px-4 py-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 select-none">
                        <label class="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                            <input type="checkbox" id="pc_send_email_cb" class="w-4 h-4 rounded text-indigo-600 border-slate-300 accent-indigo-600 cursor-pointer">
                            <span>📧 Email Receipt</span>
                        </label>
                        <div class="h-4 w-[1px] bg-slate-200 dark:bg-slate-800"></div>
                        <label class="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                            <input type="checkbox" id="pc_send_whatsapp_cb" class="w-4 h-4 rounded text-emerald-600 border-slate-300 accent-emerald-600 cursor-pointer">
                            <span>💬 WhatsApp text</span>
                        </label>
                    </div>
                    <button type="button" id="collectorSubmitBtn" disabled class="px-6 py-3.5 bg-slate-900 hover:bg-slate-800 dark:bg-brand-600 dark:hover:bg-brand-500 text-white disabled:bg-slate-200 dark:disabled:bg-slate-900 disabled:text-slate-400 dark:disabled:text-slate-700 font-bold text-sm rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-between gap-6 disabled:cursor-not-allowed select-none min-w-[240px]">
                        <span class="uppercase tracking-wider text-[11px] font-black">Execute Settlement</span>
                        <span class="text-base font-black font-mono" id="lbl_pc_checkout_total">₹ 0.00</span>
                    </button>
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
        var input = document.getElementById('collector_search_input');
        var dropdown = document.getElementById('collector_search_dropdown');
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
    async function selectCandidateByIndex(index) {
        var cache = window.MasterCandidateCache || [];
        if (index >= 0 && index < cache.length) {
            await selectCandidate(cache[index]);
        }
    }

    /**
     * Binds a candidate's properties into the module's tracking variables and updates the UI.
     * @param {Object} candidate - Full candidate record object from MasterCandidateCache
     */
    async function selectCandidate(candidate) {
        if (!candidate) return;
        
        const fullData = await window.UIUtils.fetchSingleStudentData(candidate.STUDENT_ID);
        if (!fullData) return;
        candidate = fullData; // Upgrade from minimal to full record for hydration

        _selectedCandidate = candidate;
        _mergedLogs = [];
        _dueAnalysisComplete = false;

        // Update search input
        var input = document.getElementById('collector_search_input') || document.getElementById('collectorSearchInput');
        if (input) input.value = candidate.STUDENT_NAME || '';

        // Close dropdown
        var dropdown = document.getElementById('collector_search_dropdown') || document.getElementById('collectorAutocompleteDropdown');
        if (dropdown) dropdown.classList.add('hidden');

        // Populate premium profile card
        var cardEmpty = document.getElementById('pc_student_card_empty');
        var cardData = document.getElementById('pc_student_card_data');
        if (cardEmpty) cardEmpty.classList.add('hidden');
        if (cardData) cardData.classList.remove('hidden');

        var avatarContainer = document.getElementById('lbl_pc_avatar');
        if (avatarContainer) {
            if (candidate.STUDENT_PHOTO_URL && candidate.STUDENT_PHOTO_URL.trim() !== '') {
                avatarContainer.innerHTML = `<img src="${candidate.STUDENT_PHOTO_URL}" class="w-full h-full object-cover rounded-xl border border-slate-200/60 dark:border-slate-800" />`;
            } else {
                var initial = candidate.STUDENT_NAME ? candidate.STUDENT_NAME.charAt(0).toUpperCase() : '?';
                avatarContainer.textContent = initial;
            }
        }
        
        setTextById('lbl_pc_name', candidate.STUDENT_NAME || '—');
        setTextById('lbl_pc_id', candidate.STUDENT_ID || '—');
        setTextById('lbl_pc_roll', candidate.RL_NO || '—');
        setTextById('lbl_pc_phone', candidate.STUDENT_MOBILE || '—');

        var admDate = parseAdmissionDate(candidate.DATE_OF_ADMISSION);
        var banner = document.getElementById('lbl_pc_meta_banner');
        if (banner) {
            banner.textContent = 'Admission: ' + formatDateDisplay(admDate) + ' · Fee Rate: ₹' + feeConfig.monthlyFee + '/month';
        }

        // Enable Due Checker Button
        var dueBtn = document.getElementById('pc_due_checker_btn');
        if (dueBtn) dueBtn.disabled = false;

        // Bridge: Install Payment Ledger Redirect Action
        var ledgerBtn = document.getElementById('pc_ledger_redirect_btn');
        if (ledgerBtn) {
            ledgerBtn.onclick = async function() {
                if (window.AppCore && window.AppCore.navigateTo) {
                    await window.AppCore.navigateTo('paymentLedger');
                    var ledgerSearch = document.getElementById('ledgerSearchInput');
                    if (ledgerSearch) {
                        ledgerSearch.value = candidate.STUDENT_ID || candidate.STUDENT_NAME;
                        if (window.PaymentLedgerModule && window.PaymentLedgerModule.applyLedgerFilters) {
                            window.PaymentLedgerModule.applyLedgerFilters();
                        }
                    }
                }
            };
        }

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

        var input = document.getElementById('collector_search_input') || document.getElementById('collectorSearchInput');
        if (input) input.value = '';

        var cardEmpty = document.getElementById('pc_student_card_empty');
        var cardData = document.getElementById('pc_student_card_data');
        if (cardEmpty) cardEmpty.classList.remove('hidden');
        if (cardData) cardData.classList.add('hidden');

        var dueBtn = document.getElementById('pc_due_checker_btn');
        if (dueBtn) dueBtn.disabled = true;

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
        var grid = document.getElementById('pc_months_grid_container');
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
                var badge = card.querySelector('.advance-badge');
                if (badge) badge.remove();
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

        var totalEl = document.getElementById('lbl_pc_checkout_total') || document.getElementById('collectorCheckoutTotal');
        if (totalEl) totalEl.textContent = '₹ ' + total.toLocaleString('en-IN');

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
    window.triggerPremiumDueAnalysis = async function() {
        if (!_selectedCandidate) {
            if (window.UIUtils) window.UIUtils.showToast('Please select a student first.', 'error');
            return;
        }

        var yearInput = document.getElementById('pc_calendar_year_select');
        var yearVal = yearInput ? yearInput.value : '';
        if (!/^\d{4}$/.test(yearVal)) {
            if (window.UIUtils) window.UIUtils.showToast('Please select a valid year.', 'error');
            return;
        }
        _calendarYear = parseInt(yearVal, 10);

        var studentId = String(_selectedCandidate.STUDENT_ID);
        var checkBtn = document.getElementById('pc_due_checker_btn');

        if (checkBtn) {
            checkBtn.disabled = true;
            checkBtn.innerHTML = '⏳ Computing...';
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

            renderPremiumDueViewer(analysis);

            if (window.UIUtils) window.UIUtils.showToast('Payment history loaded for ' + _selectedCandidate.STUDENT_NAME + '.', 'success');

        } catch (err) {
            console.error('[PaymentCollector] Due check error:', err);
            if (window.UIUtils) window.UIUtils.showToast('Failed to load payment history: ' + err.message, 'error');
        } finally {
            if (checkBtn) {
                checkBtn.disabled = false;
                checkBtn.innerHTML = '🔍 Check Outstanding Dues';
            }
            updateCheckoutTotal();
        }
    }

    async function checkDueAndHistory() {
        return window.triggerPremiumDueAnalysis();
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
        var now = new Date();
        var currentYear = now.getFullYear();
        var currentMonth = now.getMonth();

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
                
                var isAdvance = (year > currentYear) || (year === currentYear && i > currentMonth);

                if (card) {
                    if (isAdvance) {
                        card.className = 'relative flex items-center gap-3 p-3.5 rounded-xl border-2 border-teal-400 dark:border-teal-500 bg-teal-50 dark:bg-teal-900/20 cursor-not-allowed transition-all duration-200 select-none group opacity-90';
                        if (!card.querySelector('.advance-badge')) {
                            card.insertAdjacentHTML('beforeend', '<span class="advance-badge absolute top-1 right-2 text-[8px] font-black uppercase tracking-wider text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/50 px-1.5 py-0.5 rounded-sm">Prepaid</span>');
                        }
                    } else {
                        card.className = 'relative flex items-center gap-3 p-3.5 rounded-xl border-2 border-emerald-400 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 cursor-not-allowed transition-all duration-200 select-none group opacity-90';
                    }
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
        var advancePaidMonths = 0;
        var unpaidPeriods = [];
        var paidPeriods = [];

        var now = new Date();
        var currentCalYear = now.getFullYear();
        var currentCalMonth = now.getMonth();

        // Dynamically evaluate Advance Payments from all fetched logs
        for (var key in paidMonthsMap) {
            if (paidMonthsMap.hasOwnProperty(key) && paidMonthsMap[key] === true) {
                var parts = key.split('-');
                if (parts.length === 2) {
                    var y = parseInt(parts[0], 10);
                    var m = parseInt(parts[1], 10) - 1;
                    if (y > currentCalYear || (y === currentCalYear && m > currentCalMonth)) {
                        advancePaidMonths++;
                    }
                }
            }
        }

        var startMonthThisYear = (admYear === calYear) ? admMonth : 0;
        for (var m = startMonthThisYear; m <= endMonth; m++) {
            var isAdvance = (calYear > currentCalYear) || (calYear === currentCalYear && m > currentCalMonth);
            
            // FIX: Separate the DB lookup key from the UI display text
            var paddedMonth = String(m + 1).padStart(2, '0');
            var lookupKey = calYear + '-' + paddedMonth;
            var displayKey = MONTH_NAMES[m] + ' ' + calYear;

            if (!isAdvance) {
                expectedMonths++;
                if (paidMonthsMap[lookupKey] === true) {
                    paidMonths++;
                    paidPeriods.push(displayKey);
                } else {
                    unpaidPeriods.push(displayKey);
                }
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
            advancePaidMonths: advancePaidMonths,
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
    function renderPremiumDueViewer(analysis) {
        var viewer = document.getElementById('pc_premium_due_viewer');
        if (!viewer) return;

        var isClean = analysis.dueMonths === 0;
        
        var headerClass = isClean ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-500';
        var bgClass = isClean ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50' : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50';
        var iconStr = isClean ? '✓ All Clear' : '⚠️ Due Detected';

        var unpaidList = '';
        if (analysis.unpaidPeriods.length > 0) {
            unpaidList = '<div class="mt-2.5 pt-2.5 border-t border-slate-200 dark:border-slate-700/50">' +
                '<span class="text-[9px] font-black uppercase text-slate-400 block mb-2 tracking-wider">Unpaid Line Listings</span>' +
                '<div class="flex flex-wrap gap-1.5">';
            for (var u = 0; u < analysis.unpaidPeriods.length; u++) {
                unpaidList += '<span class="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-[10px] font-bold text-slate-600 dark:text-slate-300 shadow-sm">' + analysis.unpaidPeriods[u] + '</span>';
            }
            unpaidList += '</div></div>';
        }

        viewer.innerHTML = `
            <div class="flex items-center justify-between">
                <span class="text-xs font-black uppercase tracking-wider ${headerClass}">${iconStr}</span>
                <span class="text-[10px] font-bold text-slate-400">Analysis Complete</span>
            </div>
            
            <div class="grid grid-cols-4 gap-2 mt-2">
                <div class="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-center shadow-sm">
                    <span class="block text-[9px] font-bold text-slate-400 uppercase">Paid Logs</span>
                    <span class="block text-sm font-black text-emerald-600 dark:text-emerald-400">${analysis.paidMonths}</span>
                </div>
                <div class="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-center shadow-sm">
                    <span class="block text-[9px] font-bold text-slate-400 uppercase">Advance Paid</span>
                    <span class="block text-sm font-black text-teal-500 dark:text-teal-400">${analysis.advancePaidMonths || 0}</span>
                </div>
                <div class="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-center shadow-sm">
                    <span class="block text-[9px] font-bold text-slate-400 uppercase">Pending</span>
                    <span class="block text-sm font-black text-amber-500 dark:text-amber-400">${analysis.dueMonths}</span>
                </div>
                <div class="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-center shadow-sm">
                    <span class="block text-[9px] font-bold text-slate-400 uppercase">Balance</span>
                    <span class="block text-sm font-black text-rose-500 dark:text-rose-400">₹${analysis.dueAmount.toLocaleString('en-IN')}</span>
                </div>
            </div>
            ${unpaidList}
        `;
        viewer.className = `mt-3 p-4 border rounded-xl space-y-3 transition-all animate-fadeIn ${bgClass}`;
        viewer.classList.remove('hidden');
    }

    function renderDueSummary(analysis) {
        renderPremiumDueViewer(analysis);
    }

    /**
     * Hides the due summary bar.
     */
    function hideDueSummary() {
        var viewer = document.getElementById('pc_premium_due_viewer');
        if (viewer) {
            viewer.classList.add('hidden');
            viewer.innerHTML = '';
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

        // ── BUTTON LOCK: Save original state, lock and update text ─────────
        var originalBtnHTML = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `
                <span class="uppercase tracking-wider text-[11px] font-black">Processing...</span>
                <svg class="animate-spin w-4 h-4 text-white opacity-70" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>`;
        }
        if (spinner) spinner.classList.remove('hidden');

        try {
            // Extract explicit processing date string from dashboard wrapper view
            var payDateInput = document.getElementById('pc_pay_date');
            var timestamp = (payDateInput && payDateInput.value) 
                ? new Date(payDateInput.value).toISOString() 
                : new Date().toISOString();
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

                // ── NOTIFICATION DISPATCH HOOK ──────────────────────────────
                // Read the admin's pre-selected gateway checkboxes and fire
                // the unified dispatcher. All PDF generation, email relay,
                // and WhatsApp redirect logic lives inside NotificationUtils.
                var emailTriggered    = document.getElementById('pc_send_email_cb')?.checked || false;
                var whatsappTriggered = document.getElementById('pc_send_whatsapp_cb')?.checked || false;

                if ((emailTriggered || whatsappTriggered) && window.NotificationUtils) {
                    var sortedPeriodLabels = newMonths.map(function(idx) {
                        return MONTH_NAMES[idx] + ' ' + _calendarYear;
                    }).join(', ');

                    await window.NotificationUtils.dispatchFeeNotification(
                        _selectedCandidate,
                        {
                            txnId:      payloadArray[0] ? payloadArray[0].TXN_ID : '',
                            amount:     newMonths.length * feeConfig.monthlyFee,
                            feePeriods: sortedPeriodLabels
                        },
                        emailTriggered,
                        whatsappTriggered
                    );
                }
                // ── END NOTIFICATION DISPATCH ───────────────────────────────

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
            // ── BUTTON UNLOCK: Always restore button state regardless of outcome ─
            _isProcessing = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHTML;
            }
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
            await selectCandidate(_pendingCandidate);
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
