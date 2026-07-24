/**
 * ==========================================
 * 🏠 WELCOME / DASHBOARD MODULE
 * ==========================================
 * The landing page for the application. Completely schema-agnostic.
 */

window.WelcomeModule = (function () {
    'use strict';

    /**
     * Mounts the view into the main container
     * @param {HTMLElement} container - The DOM element to render into
     */
    function mount(container) {
        // Get current time for greeting
        const hour = new Date().getHours();
        let greeting = 'Good Evening';
        if (hour < 12) greeting = 'Good Morning';
        else if (hour < 18) greeting = 'Good Afternoon';

        container.innerHTML = `
            <div class="max-w-5xl mx-auto h-full flex flex-col animate-fade-in pb-10">
                
                <div class="mb-10">
                    <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-800 dark:text-white mb-2">
                        ${greeting}, Mr. Babla Tantra.
                    </h1>
                    <p class="text-slate-500 dark:text-slate-400 font-medium text-lg">
                        System operations are online. Please define your data schema architectures to begin.
                    </p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <div class="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-5">
                        <div class="w-14 h-14 bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-2xl flex items-center justify-center shrink-0">
                            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
                        </div>
                        <div>
                            <h3 class="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Database Status</h3>
                            <p class="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">Awaiting Schema</p>
                        </div>
                    </div>

                    <div class="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-5">
                        <div class="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shrink-0">
                            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                        </div>
                        <div>
                            <h3 class="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Active Partitions</h3>
                            <p class="text-xl font-extrabold text-slate-800 dark:text-white">0 Deployed</p>
                        </div>
                    </div>

                    <div class="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-5">
                        <div class="w-14 h-14 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center shrink-0">
                            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        </div>
                        <div>
                            <h3 class="text-slate-500 dark:text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">System Health</h3>
                            <p class="text-xl font-extrabold text-slate-800 dark:text-white">Optimal</p>
                        </div>
                    </div>
                </div>

                <div class="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-dashed border-slate-300 dark:border-slate-700 text-center flex-1 flex flex-col items-center justify-center min-h-[300px]">
                    <div class="w-20 h-20 bg-slate-50 dark:bg-slate-700/50 rounded-full flex items-center justify-center mb-6">
                        <svg class="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                    </div>
                    <h2 class="text-2xl font-bold mb-3 text-slate-800 dark:text-white">Awaiting Schema Directives</h2>
                    <p class="text-slate-500 max-w-lg mb-8">
                        The frontend UI is currently completely decoupled from any database structure. Please provide the final column relations, primary keys, and data types so the Explorer module can be built.
                    </p>
                </div>

            </div>
        `;
    }

    return {
        mount
    };

})();