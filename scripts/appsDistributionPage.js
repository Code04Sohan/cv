// --- DATA CONFIGURATION ---
// Add your apps here. Copy/Paste an object to add a new app.
const appsData = [
    {
        id: "admin_panel",
        name: "Admin Panel App",
        shortDesc: "Exel Based Database Explorer",
        fullDesc: "This app helps to explore, get filtered data, & other managerment tasks on any exel based databases. It linked with online Google spreadsheet and Save them as well for use. Also can export filtered and non-filtered data as xlsx and xls format",
        icon: "assets/admin_panel/admin_panel_icon.jpg",    
        color: "bg-blue-500",
        versions: [
            {
                version: "1.4.1",
                date: "23 Dec 2025",
                size: "41 MB",
                type: "stable",
                downloadUrl: "https://www.dropbox.com/scl/fi/t46gowpsadi8m6h3e8e59/Admin-Panel-Setup.exe?rlkey=n7mlti7xal2qzsx9l6dermjaz&st=4fvk9ah5&dl=1",
                changelog: [
                    "wrap-up the as setup for windows pc",
                    "Add online authorization and verification",
                    "Added saved links and switching feature.",
                    "Other small adjustments",
                    "app settings(settings.json) save location fix"
                ]
            },
            {
                version: "1.2.1",
                date: "20 Dec 2025",
                size: "40 MB",
                type: "stable",
                downloadUrl: "https://www.dropbox.com/scl/fi/yj1dp8w9jxpwotr3jacfe/admin_panel.exe?rlkey=60w2jadj1pvzoo74cad71olfw&st=upt8qu5d&dl=1",
                changelog: [
                    "Add online authorization and verification",
                    "Added saved links and switching feature.",
                    "Other small adjustments"
                ]
            },
            {
                version: "1.1.0",
                date: "15 Nov 2025",
                size: "40 MB",
                type: "stable",
                downloadUrl: "https://www.dropbox.com/scl/fi/yj1dp8w9jxpwotr3jacfe/admin_panel.exe?rlkey=60w2jadj1pvzoo74cad71olfw&st=upt8qu5d&dl=1", //Must include &dl=1
                changelog: [
                    "All Basic Features",
                    "Explore Database",
                    "Student Profile System"
                ]
            }
        ],
        screenshots: [
            "assets/admin_panel/Screenshot 2025-1.png",
            "assets/admin_panel/Screenshot 2025-2.png",
            "assets/admin_panel/Screenshot 2025-3.png",
            "assets/admin_panel/Screenshot 2025-4.png"
        ]
    }
];

// --- APP LOGIC ---

const router = {
    currentId: null,

    init() {
        this.renderList();
        // Check URL params for direct linking (optional)
        const params = new URLSearchParams(window.location.search);
        const appId = params.get('app');
        if (appId) this.openApp(appId);
    },

    renderList() {
        const container = document.getElementById('app-list-container');
        container.innerHTML = appsData.map(app => {
            // LOGIC: Check if 'icon' is an image URL or a FontAwesome class
            const isImage = app.icon.includes('/') || app.icon.includes('.') || app.icon.includes('http');
            
            const iconHtml = isImage 
                ? `<img src="${app.icon}" class="w-16 h-16 rounded-2xl shadow-sm group-hover:scale-105 transition-transform object-cover bg-white" alt="${app.name} Icon">` 
                : `<div class="w-16 h-16 ${app.color} rounded-2xl flex items-center justify-center text-white text-2xl shadow-sm group-hover:scale-105 transition-transform"><i class="${app.icon}"></i></div>`;

            return `
                <div onclick="router.openApp('${app.id}')" 
                     class="bg-white rounded-xl p-5 shadow-sm border border-slate-100 hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer flex items-center gap-4 group">
                    ${iconHtml}
                    <div class="flex-1">
                        <h3 class="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">${app.name}</h3>
                        <p class="text-sm text-slate-500 line-clamp-2">${app.shortDesc}</p>
                        <div class="mt-2 flex items-center gap-2">
                            <span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                                v${app.versions[0].version}
                            </span>
                            <span class="text-xs text-slate-400">${app.versions[0].date}</span>
                        </div>
                    </div>
                    <div class="text-slate-300 group-hover:text-indigo-500">
                        <i class="fa-solid fa-chevron-right"></i>
                    </div>
                </div>
            `;
        }).join('');
    },

    openApp(id) {
        const app = appsData.find(a => a.id === id);
        if (!app) return;

        const viewHome = document.getElementById('view-home');
        const viewDetail = document.getElementById('view-detail');
        const detailContent = document.getElementById('detail-content');

        // Render Detail View
        const latestVersion = app.versions[0];
        const olderVersions = app.versions.slice(1);

        // LOGIC: Check if 'icon' is an image URL or a FontAwesome class (For Detail Page)
        const isImage = app.icon.includes('/') || app.icon.includes('.') || app.icon.includes('http');
        
        const headerIconHtml = isImage
            ? `<img src="${app.icon}" class="w-24 h-24 rounded-2xl shadow-md flex-shrink-0 object-cover bg-white" alt="${app.name} Icon">`
            : `<div class="w-24 h-24 ${app.color} rounded-2xl flex-shrink-0 flex items-center justify-center text-white text-4xl shadow-md"><i class="${app.icon}"></i></div>`;


        // Generate Screenshots HTML
        const screenshotsHtml = app.screenshots.map(src => `
                    <div class="flex-none w-48 md:w-64 aspect-[9/16] md:aspect-video rounded-lg overflow-hidden border border-slate-200 shadow-sm cursor-zoom-in" onclick="gallery.open('${src}')">
                        <img src="${src}" class="w-full h-full object-cover hover:scale-105 transition-transform duration-500" alt="Screenshot" onerror="this.src='https://placehold.co/400x300/e2e8f0/64748b?text=No+Image'">
                    </div>
                `).join('');

        // Generate Older History HTML
        let historyHtml = '';
        if (olderVersions.length > 0) {
            historyHtml = `
                        <div class="border-t border-slate-100 mt-4 pt-4">
                            <button onclick="toggleHistory(this)" class="w-full flex items-center justify-between text-sm font-medium text-slate-500 hover:text-slate-800 p-2 rounded hover:bg-slate-50 transition-colors">
                                <span>Previous Versions (${olderVersions.length})</span>
                                <i class="fa-solid fa-chevron-down transition-transform duration-300"></i>
                            </button>
                            <div class="release-history-content">
                                <div class="space-y-4 pt-3 pl-2">
                                    ${olderVersions.map(ver => `
                                        <div class="relative pl-4 border-l-2 border-slate-200">
                                            <div class="flex justify-between items-baseline mb-1">
                                                <span class="font-medium text-slate-700">v${ver.version}</span>
                                                <span class="text-xs text-slate-400">${ver.date}</span>
                                            </div>
                                            <ul class="list-disc list-inside text-sm text-slate-600 space-y-1">
                                                ${ver.changelog.map(log => `<li>${log}</li>`).join('')}
                                            </ul>
                                            <a href="${ver.downloadUrl}" class="text-xs text-indigo-600 hover:underline mt-2 inline-block">Download v${ver.version}</a>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    `;
        }

        detailContent.innerHTML = `
                    <!-- Header Info -->
                    <div class="flex items-start gap-5 mb-6">
                        ${headerIconHtml}
                        <div class="pt-1">
                            <h1 class="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">${app.name}</h1>
                            <p class="text-slate-500 mt-1 text-sm md:text-base">${app.shortDesc}</p>
                            <div class="flex gap-2 mt-3">
                                <span class="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded uppercase tracking-wide">Official</span>
                                <span class="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded">Windows PC</span>
                            </div>
                        </div>
                    </div>

                    <!-- Sticky Download Area -->
                    <div class="sticky-wrapper sticky top-16 md:top-4 z-30 -mx-4 px-4 md:mx-0 md:px-0 mb-8 transition-all duration-300" id="sticky-header">
                        <div class="download-card bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                            <div class="flex items-center justify-between">
                                <div>
                                    <div class="flex items-baseline gap-2">
                                        <span class="text-green-600 font-bold">v${latestVersion.version}</span>
                                        <span class="text-xs text-slate-400 uppercase tracking-wider">Latest</span>
                                    </div>
                                    <div class="text-xs text-slate-500 mt-0.5">
                                        ${latestVersion.date} • ${latestVersion.size}
                                    </div>
                                </div>
                                <a href="${latestVersion.downloadUrl}" class="bg-slate-900 hover:bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-2">
                                    <i class="fa-solid fa-download"></i>
                                    <span>Download</span>
                                </a>
                            </div>
                        </div>
                    </div>

                    <!-- Description -->
                    <div class="mb-8">
                        <h3 class="text-lg font-bold text-slate-900 mb-2">About this app</h3>
                        <p class="text-slate-600 leading-relaxed text-sm md:text-base">${app.fullDesc}</p>
                    </div>

                    <!-- Screenshots Gallery -->
                    <div class="mb-8">
                        <h3 class="text-lg font-bold text-slate-900 mb-3">Preview</h3>
                        <div class="flex overflow-x-auto gap-4 pb-4 gallery-scroll -mx-4 px-4 md:mx-0 md:px-0">
                            ${screenshotsHtml}
                        </div>
                    </div>

                    <!-- Release Notes -->
                    <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                        <h3 class="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <i class="fa-solid fa-code-branch text-slate-400"></i> Release Notes
                        </h3>
                        
                        <!-- Latest Release -->
                        <div class="mb-2">
                            <div class="flex justify-between items-center mb-2">
                                <span class="font-semibold text-slate-800">Version ${latestVersion.version}</span>
                                <span class="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Current</span>
                            </div>
                            <ul class="list-disc list-inside text-slate-600 text-sm space-y-1 mb-4">
                                ${latestVersion.changelog.map(log => `<li>${log}</li>`).join('')}
                            </ul>
                        </div>

                        <!-- Older Releases Accordion -->
                        ${historyHtml}
                    </div>
                `;

        // Observe sticky behavior
        const stickyEl = document.getElementById('sticky-header');
        window.addEventListener('scroll', () => {
            const rect = stickyEl.getBoundingClientRect();
            if (rect.top <= 80) {
                stickyEl.classList.add('is-stuck');
            } else {
                stickyEl.classList.remove('is-stuck');
            }
        });

        // Toggle Views
        viewHome.classList.add('hidden');
        viewDetail.classList.remove('hidden');
        window.scrollTo(0, 0);
        this.currentId = id;
    },

    goHome() {
        const viewHome = document.getElementById('view-home');
        const viewDetail = document.getElementById('view-detail');

        viewDetail.classList.add('hidden');
        viewHome.classList.remove('hidden');
        this.currentId = null;
    }
};

// --- GALLERY LOGIC ---
const gallery = {
    el: document.getElementById('lightbox'),
    img: document.getElementById('lightbox-img'),

    open(src) {
        if (!src) return;
        this.img.src = src;
        this.el.classList.remove('hidden');
        setTimeout(() => {
            this.el.classList.remove('opacity-0', 'pointer-events-none');
        }, 10);
        document.body.style.overflow = 'hidden';
    },

    close() {
        this.el.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => {
            this.el.classList.add('hidden');
            this.img.src = '';
        }, 300);
        document.body.style.overflow = '';
    }
};

// --- UTILS ---
function toggleHistory(btn) {
    const content = btn.nextElementSibling;
    const icon = btn.querySelector('.fa-chevron-down');

    content.classList.toggle('open');
    if (content.classList.contains('open')) {
        icon.style.transform = 'rotate(180deg)';
    } else {
        icon.style.transform = 'rotate(0deg)';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    router.init();
});