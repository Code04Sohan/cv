/**
 * ==========================================
 * 🧠 SYSTEM CORE: ROUTER & UI MANAGER (app.js)
 * ==========================================
 * Handles dynamic module injection, sidebar routing, and global UI states.
 */

window.AppCore = (function () {
    'use strict';

    // Core Configuration
    const CONFIG = {
        MODULE_DIR: 'scripts/modules/',
        THEME_KEY: 'baha_theme_preference',
        CONTAINER_ID: 'moduleContainer',
        SIDEBAR_ID: 'sidebarNav'
    };

    // 📦 Module Registry
    // Add new modules here as your application grows.
    const MODULES = [
        {
            id: 'welcome',
            title: 'Operations Hub',
            icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>`,
            scriptFile: 'welcomePage.js',
            namespace: 'WelcomeModule', // The global object the module will expose
            isLoaded: false
        },
        {
            id: 'newCandidate',
            title: 'Admission Registry',
            icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>`,
            scriptFile: 'newCandidate.js',
            namespace: 'NewCandidateModule',
            isLoaded: false
        },
        {
            id: 'directoryViewer',
            title: 'Admin Directory',
            icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>`,
            scriptFile: 'directoryViewer.js',
            namespace: 'DirectoryViewerModule',
            isLoaded: false
        },
        {
            id: 'paymentCollector',
            title: '💳 Fee Collector',
            icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>`,
            scriptFile: 'paymentCollector.js',
            namespace: 'PaymentCollectorModule',
            isLoaded: false
        },
        {
            id: 'paymentLedger',
            title: '📊 Payment Ledger',
            icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>`,
            scriptFile: 'paymentLedger.js',
            namespace: 'PaymentLedgerModule',
            isLoaded: false
        }
    ];


    let currentModuleId = null;

    /**
     * Bootstraps the application after successful login
     */
    async function initializeApp() {
        try {
            applySavedTheme();
            buildSidebarNavigation();

            // Eagerly load newCandidate.js so the background queue starts running immediately
            const candidateMod = MODULES.find(m => m.id === 'newCandidate');
            if (candidateMod && !candidateMod.isLoaded) {
                try {
                    await loadScript(`${CONFIG.MODULE_DIR}${candidateMod.scriptFile}`);
                    candidateMod.isLoaded = true;
                } catch (e) {
                    console.debug('[AppCore] Suppressed eager load failure of candidate module:', e);
                }
            }

            // Default route
            if (MODULES.length > 0) {
                navigateTo(MODULES[0].id);
            }
        } catch (error) {
            console.debug('[AppCore] Initialization suppressed error:', error);
        }
    }

    /**
     * Builds the sidebar UI dynamically from the MODULES registry
     */
    function buildSidebarNavigation() {
        const sidebar = document.getElementById(CONFIG.SIDEBAR_ID);
        if (!sidebar) return;

        sidebar.innerHTML = ''; // Clear existing

        MODULES.forEach(mod => {
            const li = document.createElement('li');
            li.innerHTML = `
                <button id="nav-btn-${mod.id}" onclick="window.AppCore.navigateTo('${mod.id}')" class="w-full flex items-center justify-center sm:justify-start gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-brand-600 dark:hover:text-brand-400 transition-all text-sm text-left">
                    <span class="shrink-0">${mod.icon}</span>
                    <span class="truncate hidden sm:block">${mod.title}</span>
                </button>
            `;
            sidebar.appendChild(li);
        });
    }

    /**
     * Handles visual active states in the sidebar
     */
    function updateSidebarActiveState(activeId) {
        MODULES.forEach(mod => {
            const btn = document.getElementById(`nav-btn-${mod.id}`);
            if (btn) {
                if (mod.id === activeId) {
                    btn.classList.add('bg-brand-50', 'dark:bg-brand-900/20', 'text-brand-600', 'dark:text-brand-400');
                    btn.classList.remove('text-slate-600', 'dark:text-slate-400', 'hover:bg-slate-100', 'dark:hover:bg-slate-700/50');
                } else {
                    btn.classList.remove('bg-brand-50', 'dark:bg-brand-900/20', 'text-brand-600', 'dark:text-brand-400');
                    btn.classList.add('text-slate-600', 'dark:text-slate-400', 'hover:bg-slate-100', 'dark:hover:bg-slate-700/50');
                }
            }
        });
    }

    /**
     * The dynamic router. Injects scripts and mounts views.
     */
    async function navigateTo(moduleId) {
        if (currentModuleId === moduleId) return; // Prevent reloading same view

        const moduleDef = MODULES.find(m => m.id === moduleId);
        if (!moduleDef) return;

        const container = document.getElementById(CONFIG.CONTAINER_ID);

        // Show loading state in container
        container.innerHTML = `
            <div class="h-full w-full flex flex-col items-center justify-center animate-fade-in text-slate-400">
                <svg class="animate-spin h-8 w-8 mb-4 text-brand-500" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <span class="text-sm font-bold tracking-wider uppercase">Loading ${moduleDef.title}...</span>
            </div>
        `;

        updateSidebarActiveState(moduleId);

        try {
            // Lazy load the script if it hasn't been injected yet
            if (!moduleDef.isLoaded) {
                await loadScript(`${CONFIG.MODULE_DIR}${moduleDef.scriptFile}`);
                moduleDef.isLoaded = true;
            }

            // Mount the module to the DOM
            if (window[moduleDef.namespace] && typeof window[moduleDef.namespace].mount === 'function') {
                container.innerHTML = ''; // Clear loader
                window[moduleDef.namespace].mount(container);
                currentModuleId = moduleId;
            } else {
                throw new Error(`Namespace ${moduleDef.namespace} or mount() missing.`);
            }

        } catch (error) {
            console.debug(`[AppCore] Failed to load module ${moduleId}:`, error);
            container.innerHTML = `
                <div class="h-full w-full flex flex-col items-center justify-center text-rose-500">
                    <svg class="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    <h3 class="font-bold text-lg">Module Loading Failure</h3>
                    <p class="text-sm opacity-80 mt-1">Please check your network connection or contact the developer.</p>
                </div>
            `;
        }
    }

    /**
     * Utility to inject <script> tags dynamically as Promises
     */
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.type = 'text/javascript';
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.body.appendChild(script);
        });
    }

    /**
     * Theme Management
     */
    const SUN_SVG = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.364 17.636l-.707.707M6.364 6.364l.707-.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"></path>`;
    const MOON_SVG = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>`;

    function updateThemeUI(isDark) {
        const icon = document.getElementById('themeToggleIcon');
        if (icon) {
            icon.innerHTML = isDark ? SUN_SVG : MOON_SVG;
        }
    }

    function toggleTheme() {
        const html = document.documentElement;
        if (html.classList.contains('dark')) {
            html.classList.remove('dark');
            html.classList.add('light');
            localStorage.setItem(CONFIG.THEME_KEY, 'light');
            updateThemeUI(false);
        } else {
            html.classList.remove('light');
            html.classList.add('dark');
            localStorage.setItem(CONFIG.THEME_KEY, 'dark');
            updateThemeUI(true);
        }
    }

    function applySavedTheme() {
        const savedTheme = localStorage.getItem(CONFIG.THEME_KEY) || 'dark';
        const html = document.documentElement;
        html.classList.remove('light', 'dark');
        html.classList.add(savedTheme);
        updateThemeUI(savedTheme === 'dark');
    }

    // Expose Public Methods
    return {
        init: initializeApp,
        navigateTo: navigateTo,
        toggleTheme: toggleTheme
    };

})();