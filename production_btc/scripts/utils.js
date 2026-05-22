/**
 * ==========================================
 * 🛠️ UI UTILITIES (utils.js)
 * ==========================================
 * Reusable interface controllers (Toasts, Modals, Loading States)
 */

window.UIUtils = (function() {
    'use strict';

    /**
     * Toast Notification Engine
     * @param {string} message - The message to display
     * @param {string} type - 'success', 'error', or 'info'
     */
    function showToast(message, type = "success") {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        
        let colors = 'bg-slate-800 text-white border-slate-700'; // default info
        let icon = `<svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;

        if (type === 'success') {
            colors = 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800';
            icon = `<svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        } else if (type === 'error') {
            colors = 'bg-rose-50 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800';
            icon = `<svg class="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
        }

        toast.className = `px-4 py-3 rounded-xl border shadow-lg text-sm font-bold flex items-center gap-3 animate-fade-in ${colors}`;
        toast.innerHTML = `${icon} <span>${message}</span>`;
        
        container.appendChild(toast);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    /**
     * Modal Management
     */
    function openModal(modalId) {
        const overlay = document.getElementById('globalOverlay');
        const modal = document.getElementById(modalId);
        
        if (overlay && modal) {
            overlay.classList.replace('overlay-hidden', 'overlay-visible');
            modal.classList.replace('modal-hidden', 'modal-visible');
        }
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.replace('modal-visible', 'modal-hidden');
        }
        
        // Check if any other modals are still open
        const openModals = document.querySelectorAll('.modal-visible');
        if (openModals.length === 0) {
            document.getElementById('globalOverlay').classList.replace('overlay-visible', 'overlay-hidden');
        }
    }

    /**
     * API Fetch Wrapper with timeout and standardized error handling
     */
    async function fetchFromEngine(payload) {
        try {
            const response = await fetch(window.SystemConfig.API_URL, {
                method: "POST",
                body: JSON.stringify(payload)
            });
            return await response.json();
        } catch (error) {
            console.error("[Network Error]:", error);
            throw new Error("Cloud communication failure.");
        }
    }

    return {
        showToast,
        openModal,
        closeModal,
        fetchFromEngine
    };
})();