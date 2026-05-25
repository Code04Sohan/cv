/**
 * ==========================================
 * 🔐 AUTHENTICATION MODULE (login.js)
 * ==========================================
 * Manages secure entry, session flushing, and the OTP Override protocol.
 */

window.AuthModule = (function() {
    'use strict';

    // UI Bindings
    const UI = {
        loginView: 'loginView',
        appView: 'appView',
        form: 'authForm',
        passwordInput: 'passwordInput',
        btnText: 'loginBtnText',
        spinner: 'loginBtnSpinner',
        loginBtn: 'loginBtn'
    };

    /**
     * Initializes listeners on load
     */
    document.addEventListener('DOMContentLoaded', () => {
        const authForm = document.getElementById(UI.form);
        if (authForm) {
            authForm.addEventListener('submit', handleAuthentication);
        }
        checkExistingSession();
    });

    /**
     * Silent Check: Verifies if a valid session already exists in LocalStorage
     */
    async function checkExistingSession() {
        const token = localStorage.getItem(window.SystemConfig.AUTH_KEY);
        if (!token) return; // Stay on login screen

        try {
            const response = await window.UIUtils.fetchFromEngine({ 
                action: "VALIDATE_SESSION", 
                token: token 
            });

            if (response.status === "success") {
                grantAccess();
            } else {
                flushSession();
            }
        } catch (error) {
            console.debug("[Auth] Background validation failed. Forcing manual login.");
        }
    }

    /**
     * Primary Login Flow
     */
    async function handleAuthentication(e) {
        e.preventDefault();
        const pass = document.getElementById(UI.passwordInput).value;
        if (!pass) return;

        setLoadingState(true);

        try {
            const response = await window.UIUtils.fetchFromEngine({ 
                action: "LOGIN", 
                password: pass 
            });

            if (response.status === "success") {
                localStorage.setItem(window.SystemConfig.AUTH_KEY, response.token);
                document.getElementById(UI.passwordInput).value = '';
                grantAccess();
                window.UIUtils.showToast("Authentication Successful", "success");
            } else {
                window.UIUtils.showToast(response.message || "Invalid Security Key", "error");
            }
        } catch (error) {
            window.UIUtils.showToast("Connection to Core Engine failed.", "error");
        } finally {
            setLoadingState(false);
        }
    }

    /**
     * System Entry / Exit Transitions
     */
    function grantAccess() {
        document.getElementById(UI.loginView).classList.add('hidden');
        document.getElementById(UI.appView).classList.remove('hidden');
        window.AppCore.init(); // Bootstraps the application routing
    }

    function logout() {
        flushSession();
        window.UIUtils.showToast("Session Terminated Safely", "info");
    }

    function flushSession() {
        localStorage.removeItem(window.SystemConfig.AUTH_KEY);
        document.getElementById(UI.appView).classList.add('hidden');
        document.getElementById(UI.loginView).classList.remove('hidden');
    }

    function setLoadingState(isLoading) {
        const btn = document.getElementById(UI.loginBtn);
        const text = document.getElementById(UI.btnText);
        const spinner = document.getElementById(UI.spinner);

        btn.disabled = isLoading;
        if (isLoading) {
            text.classList.add('hidden');
            spinner.classList.remove('hidden');
        } else {
            text.classList.remove('hidden');
            spinner.classList.add('hidden');
        }
    }

    /**
     * Security Override (OTP Flow)
     */
    function initiatePasswordReset() {
        window.UIUtils.openModal('otpRequestModal');
    }

    async function dispatchOtp() {
        window.UIUtils.openModal('globalLoadingModal');
        try {
            const response = await window.UIUtils.fetchFromEngine({ action: "REQUEST_RESET" });
            window.UIUtils.closeModal('globalLoadingModal');
            
            if (response.status === "success") {
                window.UIUtils.closeModal('otpRequestModal');
                window.UIUtils.openModal('otpVerifyModal');
                window.UIUtils.showToast("Cryptographic token dispatched.", "success");
            } else {
                window.UIUtils.showToast(response.message, "error");
            }
        } catch (e) {
            window.UIUtils.closeModal('globalLoadingModal');
            window.UIUtils.showToast("Transmission failure.", "error");
        }
    }

    async function confirmReset() {
        const otpVal = document.getElementById('otpCodeInput').value;
        const newPassVal = document.getElementById('newPasswordInput').value;
        
        if (!otpVal || !newPassVal || otpVal.length !== 6) {
            return window.UIUtils.showToast("Invalid Key Format.", "error");
        }

        window.UIUtils.openModal('globalLoadingModal');
        try {
            const response = await window.UIUtils.fetchFromEngine({ 
                action: "COMPLETE_RESET", 
                otp: otpVal, 
                newPassword: newPassVal 
            });
            window.UIUtils.closeModal('globalLoadingModal');

            if (response.status === "success") {
                window.UIUtils.closeModal('otpVerifyModal');
                document.getElementById('otpCodeInput').value = '';
                document.getElementById('newPasswordInput').value = '';
                flushSession(); // Kick out to force relogin with new pass
                window.UIUtils.showToast("Security Key Overwritten. Please Re-Authenticate.", "success");
            } else {
                window.UIUtils.showToast(response.message, "error");
            }
        } catch (e) {
            window.UIUtils.closeModal('globalLoadingModal');
            window.UIUtils.showToast("Override failed.", "error");
        }
    }

    return {
        logout,
        initiatePasswordReset,
        dispatchOtp,
        confirmReset
    };

})();