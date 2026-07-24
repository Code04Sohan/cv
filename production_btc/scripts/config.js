/**
 * ==========================================
 * ⚙️ SYSTEM CONFIGURATION (config.js)
 * ==========================================
 * Centralized settings for the Babla Yoga Operations Hub.
 */

window.SystemConfig = {
    
    // 🌐 Cloud Engine Connection
    // REPLACE THIS with your actual Google Apps Script Web App URL
    API_URL: "https://script.google.com/macros/s/AKfycbxIUZKmw6nTjfD4V5EJFzspvl934uZCzZ4c2IHw3KOh3V9dm7yW27kkrGbIOZwePGq3Fw/exec",
    
    // 🔐 Security Definitions
    AUTH_KEY: "BAHA_SECURE_TOKEN",
    MASTER_PARTITION: "Main Recoreds",
    
    // 🖼️ Brand Assets (Leave blank to use CSS fallbacks)
    IMAGES: {
        LOGIN_LOGO: "resources/logo_babla.jpeg", 
        NAV_LOGO: "resources/logo_babla.jpeg",
        LOGIN_BACKGROUND: "resources/background.png"
    },

    // 📧 Contact Links
    SUPPORT_EMAIL: "sohanadhikari04@gmail.com"
};

/**
 * Bootstrapping script to automatically apply images if they exist in config.
 */
document.addEventListener('DOMContentLoaded', () => {
    const { IMAGES } = window.SystemConfig;
    
    // Apply Login Logo
    if (IMAGES.LOGIN_LOGO) {
        document.getElementById('loginBrandLogo').src = IMAGES.LOGIN_LOGO;
        document.getElementById('loginBrandLogo').classList.remove('hidden');
        document.getElementById('loginBrandFallback').classList.add('hidden');
    }
    
    // Apply Nav Logo
    if (IMAGES.NAV_LOGO) {
        document.getElementById('navBrandLogo').src = IMAGES.NAV_LOGO;
        document.getElementById('navBrandLogo').classList.remove('hidden');
        document.getElementById('navBrandFallback').classList.add('hidden');
    }
    
    // Apply Login Background
    if (IMAGES.LOGIN_BACKGROUND) {
        const bgImg = document.getElementById('loginBgImage');
        bgImg.src = IMAGES.LOGIN_BACKGROUND;
        // Fade in when loaded
        bgImg.onload = () => bgImg.classList.remove('opacity-0');
    }
});