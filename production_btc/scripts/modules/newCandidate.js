/**
 * ====================================================================
 * 🧘 CANADIAN DATA INGESTION MODULE (newCandidate.js)
 * ====================================================================
 * A production-grade, highly responsive, asynchronous enrollment engine
 * for the 'Babla Yoga Training Center' portal.
 * 
 * Features:
 * - Lazy-loading compliant architecture (window.NewCandidateModule).
 * - Multi-section premium styling optimized with Tailwind CSS (Dark Mode native).
 * - Drag-and-drop styled Base64 file streaming adapters with instant visual previews.
 * - Non-blocking UI transmission via an in-memory sequential task queue engine.
 * - Tri-state Operations Monitor (Green/Amber/Red) displaying network state & queue size.
 * - Expanded audit log & queue inspector shelf for administrative transparency.
 * 
 * ====================================================================
 * ☁️ HIGH-PERFORMANCE GOOGLE APPS SCRIPT BACKEND CODE (.gs)
 * ====================================================================
 * Paste this code into your Google Apps Script editor. Ensure your active
 * sheet is named "Main Records" or configure it inside the method.
 * Make sure Google Drive API is enabled under "Services" in your project.
 * 
 * ```javascript
 * function doPost(e) {
 *   var lock = LockService.getScriptLock();
 *   try {
 *     // Prevent concurrent write collisions (wait up to 30s)
 *     lock.waitLock(30000);
 *     
 *     var requestData = JSON.parse(e.postData.contents);
 *     var action = requestData.action;
 *     
 *     if (action === "ADD_CANDIDATE") {
 *       return handleAddCandidate(requestData.candidate);
 *     }
 *     
 *     return ContentService.createTextOutput(JSON.stringify({
 *       status: "error",
 *       message: "Unsupported action: " + action
 *     })).setMimeType(ContentService.MimeType.JSON);
 *     
 *   } catch (error) {
 *     return ContentService.createTextOutput(JSON.stringify({
 *       status: "error",
 *       message: error.toString()
 *     })).setMimeType(ContentService.MimeType.JSON);
 *   } finally {
 *     lock.releaseLock();
 *   }
 * }
 * 
 * function handleAddCandidate(candidate) {
 *   var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
 *   var sheet = spreadsheet.getSheetByName("Main Records");
 *   if (!sheet) {
 *     sheet = spreadsheet.insertSheet("Main Records");
 *     var headers = [
 *       'STUDENT_ID', 'RL_NO', 'SESSION', 'DATE_OF_ADMISSION', 'ENROLLED_COURSE', 'CLASS_BATCH_DAYS',
 *       'STUDENT_NAME', 'DOB', 'GENDER', 'BLOOD_GROUP', 'RELIGION', 'STUDENT_AADHAR', 'CATEGORY', 'STUDENT_MOBILE', 'PHYSICAL_DISABILITY',
 *       'FATHER_NAME', 'FATHER_OCCUPATION', 'FATHER_MOBILE', 'FATHER_AADHAR',
 *       'MOTHER_NAME', 'MOTHER_OCCUPATION', 'MOTHER_MOBILE', 'MOTHER_AADHAR',
 *       'HOME_ADDRESS', 'CONTACT_EMAIL', 'ADMISSION_FEE_PAID', 'PAYMENT_MODE', 'TXN_ID',
 *       'STUDENT_PHOTO_URL', 'FATHER_PHOTO_URL', 'MOTHER_PHOTO_URL', 'SCANNED_FORM_URL', 'TIMESTAMP'
 *     ];
 *     sheet.appendRow(headers);
 *     sheet.setFrozenRows(1);
 *   }
 *   
 *   // ⚡ OPTIMIZED MEMORY READS: Single data range read per partition directly into RAM
 *   var dataRange = sheet.getDataRange();
 *   var allValues = dataRange.getValues();
 *   var headers = allValues[0];
 *   
 *   // Check duplicate Aadhar using native JS methods in RAM
 *   var aadharIndex = headers.indexOf('STUDENT_AADHAR');
 *   if (aadharIndex !== -1 && allValues.length > 1 && candidate.STUDENT_AADHAR) {
 *     var isDuplicate = allValues.slice(1).some(function(row) {
 *       return String(row[aadharIndex]).trim() === String(candidate.STUDENT_AADHAR).trim();
 *     });
 *     if (isDuplicate) {
 *       return ContentService.createTextOutput(JSON.stringify({
 *         status: "error",
 *         message: "Duplicate student detected: A student with Aadhar number " + candidate.STUDENT_AADHAR + " is already enrolled."
 *       })).setMimeType(ContentService.MimeType.JSON);
 *     }
 *   }
 * 
 *   // 📂 FILE STREAMING: Store Base64 strings directly in Google Drive as blobs
 *   var parentFolder = getOrCreateDriveFolder("Babla Yoga Candidate Documents");
 *   
 *   candidate.STUDENT_PHOTO_URL = uploadBase64ToDrive(candidate.STUDENT_PHOTO_URL, "STUDENT_" + candidate.STUDENT_NAME.replace(/\s+/g, "_") + "_" + candidate.STUDENT_ID, parentFolder);
 *   candidate.FATHER_PHOTO_URL = uploadBase64ToDrive(candidate.FATHER_PHOTO_URL, "FATHER_" + candidate.STUDENT_NAME.replace(/\s+/g, "_") + "_" + candidate.STUDENT_ID, parentFolder);
 *   candidate.MOTHER_PHOTO_URL = uploadBase64ToDrive(candidate.MOTHER_PHOTO_URL, "MOTHER_" + candidate.STUDENT_NAME.replace(/\s+/g, "_") + "_" + candidate.STUDENT_ID, parentFolder);
 *   candidate.SCANNED_FORM_URL = uploadBase64ToDrive(candidate.SCANNED_FORM_URL, "FORM_" + candidate.STUDENT_NAME.replace(/\s+/g, "_") + "_" + candidate.STUDENT_ID, parentFolder);
 *   
 *   // Assemble row in exact column layout
 *   var rowData = [
 *     candidate.STUDENT_ID || "",
 *     candidate.RL_NO || "",
 *     candidate.SESSION || "",
 *     candidate.DATE_OF_ADMISSION || "",
 *     candidate.ENROLLED_COURSE || "",
 *     candidate.CLASS_BATCH_DAYS || "",
 *     candidate.STUDENT_NAME || "",
 *     candidate.DOB || "",
 *     candidate.GENDER || "",
 *     candidate.BLOOD_GROUP || "",
 *     candidate.RELIGION || "",
 *     candidate.STUDENT_AADHAR || "",
 *     candidate.CATEGORY || "",
 *     candidate.STUDENT_MOBILE || "",
 *     candidate.PHYSICAL_DISABILITY || "",
 *     candidate.FATHER_NAME || "",
 *     candidate.FATHER_OCCUPATION || "",
 *     candidate.FATHER_MOBILE || "",
 *     candidate.FATHER_AADHAR || "",
 *     candidate.MOTHER_NAME || "",
 *     candidate.MOTHER_OCCUPATION || "",
 *     candidate.MOTHER_MOBILE || "",
 *     candidate.MOTHER_AADHAR || "",
 *     candidate.HOME_ADDRESS || "",
 *     candidate.CONTACT_EMAIL || "",
 *     candidate.ADMISSION_FEE_PAID || "",
 *     candidate.PAYMENT_MODE || "",
 *     candidate.TXN_ID || "",
 *     candidate.STUDENT_PHOTO_URL || "",
 *     candidate.FATHER_PHOTO_URL || "",
 *     candidate.MOTHER_PHOTO_URL || "",
 *     candidate.SCANNED_FORM_URL || "",
 *     candidate.TIMESTAMP || new Date().toISOString()
 *   ];
 *   
 *   // ⚡ HIGH-SPEED APPEND: Isolated single append row write to minimize write latency
 *   sheet.appendRow(rowData);
 *   
 *   return ContentService.createTextOutput(JSON.stringify({
 *     status: "success",
 *     message: "Candidate " + candidate.STUDENT_NAME + " successfully enrolled!",
 *     studentId: candidate.STUDENT_ID
 *   })).setMimeType(ContentService.MimeType.JSON);
 * }
 * 
 * function getOrCreateDriveFolder(folderName) {
 *   var folders = DriveApp.getFoldersByName(folderName);
 *   if (folders.hasNext()) {
 *     return folders.next();
 *   }
 *   return DriveApp.createFolder(folderName);
 * }
 * 
 * function uploadBase64ToDrive(base64Str, baseFilename, parentFolder) {
 *   if (!base64Str || !base64Str.startsWith("data:")) {
 *     return base64Str || ""; // Write original if already URL or empty
 *   }
 *   
 *   try {
 *     var parts = base64Str.split(",");
 *     var mimeType = parts[0].match(/data:([^;]+);/)[1];
 *     var extension = mimeType.split("/")[1] || "png";
 *     var filename = baseFilename + "." + extension;
 *     
 *     var decodedData = Utilities.base64Decode(parts[1]);
 *     var blob = Utilities.newBlob(decodedData, mimeType, filename);
 *     
 *     var file = parentFolder.createFile(blob);
 *     file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
 *     
 *     return file.getUrl();
 *   } catch (err) {
 *     console.error("Base64 upload failed: ", err);
 *     return "Upload Error: " + err.toString();
 *   }
 * }
 * ```
 */

window.NewCandidateModule = (function () {
    'use strict';

    // ⚡ In-Memory Queue State Initialization
    if (!window.CandidateQueue) {
        window.CandidateQueue = [];
    }

    // Load persisted queue from LocalStorage on bootstrap
    try {
        const cached = localStorage.getItem('bytc_pending_queue');
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
                // Restore but mark any 'Syncing' items back to 'Pending'
                parsed.forEach(item => {
                    if (item.status === 'Syncing') item.status = 'Pending';
                });
                window.CandidateQueue = parsed;
            }
        }
    } catch (e) {
        console.debug('[Cache Restore] Suppressed storage read error:', e);
    }

    // Module internal state for holding base64 media blocks
    const state = {
        studentPhoto: '',
        studentSignature: '',
        isProcessing: false,
        isInspectorOpen: false,
        isOffline: false
    };

    /**
     * Helper to save active queue status to LocalStorage, catching oversized limits gracefully
     */
    function persistQueue() {
        try {
            // Strip extremely large base64 fields if they risk throwing QuotaExceededError (5MB local storage ceiling)
            // Storing full base64 strings is preferred for true offline reliability, so we attempt first.
            localStorage.setItem('bytc_pending_queue', JSON.stringify(window.CandidateQueue));
        } catch (error) {
            console.debug('[Queue Engine] LocalStorage quota reached. Pruning rich media items from cache...');
            try {
                // If it fails, strip the base64 media strings to at least save candidate text credentials safely
                const prunedQueue = window.CandidateQueue.map(item => {
                    const cloned = JSON.parse(JSON.stringify(item));
                    if (cloned.data) {
                        cloned.data.STUDENT_PHOTO_URL = cloned.data.STUDENT_PHOTO_URL.startsWith('data:') ? 'Rich Media Stripped (Quota)' : cloned.data.STUDENT_PHOTO_URL;
                    }
                    return cloned;
                });
                localStorage.setItem('bytc_pending_queue', JSON.stringify(prunedQueue));
            } catch (innerError) {
                console.warn('[Queue Engine] Unable to backup queue to storage:', innerError);
            }
        }
    }

    /**
     * Generates a sleek, readable mock candidate identifier on load
     */
    function generateMockID() {
        const rand = Math.floor(1000 + Math.random() * 9000);
        return `BYTC-${new Date().getFullYear().toString().slice(-2)}-${rand}`;
    }

    /**
     * Renders the modular interface into the container
     */
    function mount(container) {
        try {
            container.innerHTML = `
                <div class="max-w-6xl mx-auto flex flex-col animate-fade-in pb-16">
                    
                    <!-- Recreated Clean Admission Registry Section Header -->
                    <div class="relative bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 dark:border-slate-700/80 mb-8 transition-all duration-300 overflow-hidden shrink-0">
                        <!-- Subtle brand background accent glows (premium dark-mode halos) -->
                        <div class="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-brand-500/5 dark:bg-brand-500/10 blur-3xl pointer-events-none"></div>
                        <div class="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 blur-3xl pointer-events-none"></div>
                        
                        <div class="flex items-center gap-4 relative z-10">
                            <div class="w-12 h-12 bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
                                </svg>
                            </div>
                            <div class="space-y-1">
                                <h1 class="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-white leading-tight">Admission Registry</h1>
                                <p class="text-slate-500 dark:text-slate-400 font-medium text-xs sm:text-sm max-w-2xl leading-relaxed">
                                    Queue and transmit yoga candidate admissions silently. High-performance non-blocking data layers secure all attachments locally in RAM prior to sheet replication.
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Admission Form -->
                    <form id="enrollmentForm" class="space-y-8 select-none" onsubmit="window.NewCandidateModule.handleFormSubmit(event)">
                        
                        <!-- SECTION A: System & Enrollment Parameters -->
                        <div class="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300">
                            <div class="border-b border-slate-100 dark:border-slate-700/80 pb-4 mb-6 flex items-center gap-3">
                                <div class="w-10 h-10 bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-2xl flex items-center justify-center shrink-0">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                </div>
                                <div>
                                    <h2 class="text-lg font-extrabold text-slate-800 dark:text-white">Section A: System & Enrollment Parameters</h2>
                                    <p class="text-xs text-slate-400 dark:text-slate-400 font-semibold uppercase tracking-wider">Registration credentials & schedule routing</p>
                                </div>
                            </div>
                            
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Student ID (Auto)</label>
                                    <input type="text" id="field_student_id" required readonly value="${generateMockID()}"
                                        class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-bold text-slate-500 dark:text-slate-400 outline-none cursor-not-allowed">
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Roll Number</label>
                                    <input type="text" id="field_rl_no" required
                                        class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all">
                                </div>
                                <div class="space-y-1.5 flex gap-2">
                                    <div class="flex-1">
                                        <label class="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Session From</label>
                                        <input type="number" id="field_session_from" required min="2000" max="2099" placeholder="YYYY"
                                            class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all">
                                    </div>
                                    <div class="flex-1">
                                        <label class="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Session To</label>
                                        <input type="number" id="field_session_to" required min="2000" max="2099" placeholder="YYYY"
                                            class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all">
                                    </div>
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Date of Admission</label>
                                    <input type="date" id="field_date_of_admission" required value="${new Date().toISOString().split('T')[0]}"
                                        class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all">
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Enrolled Class</label>
                                    <select id="field_enrolled_course" required
                                        class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all">
                                        <option value="" disabled selected>Select Class</option>
                                        <option value="Teachers Training">Teachers Training</option>
                                        <option value="Diploma">Diploma</option>
                                        <option value="Yoga/Hula Hoopla/Karate/Meditation">Yoga/Hula Hoopla/Karate/Meditation</option>
                                    </select>
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Class Batch & Days</label>
                                    <select id="field_class_batch_days" required
                                        class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all">
                                        <option value="" disabled selected>Choose Schedule</option>
                                        <option value="Evening: Mon-Wed-Fri">Evening: Mon-Wed-Fri</option>
                                        <option value="Evening: Sat-Sun-Wed">Evening: Sat-Sun-Wed</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- SECTION B: Candidate Demographics -->
                        <div class="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300">
                            <div class="border-b border-slate-100 dark:border-slate-700/80 pb-4 mb-6 flex items-center gap-3">
                                <div class="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shrink-0">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                </div>
                                <div>
                                    <h2 class="text-lg font-extrabold text-slate-800 dark:text-white">Section B: Candidate Demographics</h2>
                                    <p class="text-xs text-slate-400 dark:text-slate-400 font-semibold uppercase tracking-wider">Personal particulars & unique ID indexes</p>
                                </div>
                            </div>
                            
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div class="space-y-1.5 md:col-span-2">
                                    <label class="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Candidate Full Name</label>
                                    <input type="text" id="field_student_name" required placeholder="Enter student full name"
                                        class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all">
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Date of Birth</label>
                                    <input type="date" id="field_dob" required
                                        class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all">
                                </div>
                                
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Gender</label>
                                    <select id="field_gender" required
                                        class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all">
                                        <option value="" disabled selected>Select Gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Blood Group</label>
                                    <select id="field_blood_group" required
                                        class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all">
                                        <option value="" disabled selected>Select Blood Group</option>
                                        <option value="A+">A+</option>
                                        <option value="A-">A-</option>
                                        <option value="B+">B+</option>
                                        <option value="B-">B-</option>
                                        <option value="O+">O+</option>
                                        <option value="O-">O-</option>
                                        <option value="AB+">AB+</option>
                                        <option value="AB-">AB-</option>
                                    </select>
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Religion</label>
                                    <select id="field_religion" required
                                        class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all">
                                        <option value="" disabled selected>Select Religion</option>
                                        <option value="Hindu">Hindu</option>
                                        <option value="Muslim">Muslim</option>
                                        <option value="Others">Others</option>
                                    </select>
                                </div>

                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Student Aadhar Card No</label>
                                    <input type="text" id="field_student_aadhar" required placeholder="0000 0000 0000" maxlength="14"
                                        oninput="window.NewCandidateModule.formatAadhar(this)"
                                        class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all">
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Category</label>
                                    <select id="field_category" required
                                        class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all">
                                        <option value="" disabled selected>Choose Category</option>
                                        <option value="General">General</option>
                                        <option value="OBC">OBC</option>
                                        <option value="SC">SC</option>
                                        <option value="ST">ST</option>
                                        <option value="EWS">EWS</option>
                                    </select>
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Student Mobile Number</label>
                                    <input type="tel" id="field_student_mobile" required placeholder="9876543210" maxlength="10"
                                        class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all">
                                </div>
                                
                                <div class="space-y-1.5 md:col-span-3">
                                    <label class="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Physical Disability / Medical Notes (If Any)</label>
                                    <textarea id="field_physical_disability" rows="2" placeholder="Describe any existing physical disabilities, chronic pains, allergies or medical notes..."
                                        class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all resize-none"></textarea>
                                </div>
                            </div>
                        </div>

                        <!-- SECTION C: Parent/Guardian Details -->
                        <div class="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300">
                            <div class="border-b border-slate-100 dark:border-slate-700/80 pb-4 mb-6 flex items-center gap-3">
                                <div class="w-10 h-10 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center shrink-0">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                                </div>
                                <div>
                                    <h2 class="text-lg font-extrabold text-slate-800 dark:text-white">Section C: Parent/Guardian Details</h2>
                                    <p class="text-xs text-slate-400 dark:text-slate-400 font-semibold uppercase tracking-wider">Family parameters & residential details</p>
                                </div>
                            </div>
                            
                            <!-- Father Profile Block -->
                            <div class="mb-8 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <h3 class="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-4 flex items-center gap-2">
                                    <span class="w-2 h-2 rounded-full bg-brand-500"></span> Father Profile Block
                                </h3>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div class="space-y-1.5">
                                        <label class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Father's Name</label>
                                        <input type="text" id="field_father_name" required placeholder="Full Name" oninput="window.NewCandidateModule.handleGuardianChange()"
                                            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all">
                                    </div>
                                    <div class="space-y-1.5">
                                        <label class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Father's Mobile</label>
                                        <input type="tel" id="field_father_mobile" required placeholder="10 Digit Number" maxlength="10" oninput="window.NewCandidateModule.handleGuardianChange()"
                                            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all">
                                    </div>
                                </div>
                            </div>

                            <!-- Mother Profile Block -->
                            <div class="mb-8 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <h3 class="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-4 flex items-center gap-2">
                                    <span class="w-2 h-2 rounded-full bg-pink-500"></span> Mother Profile Block
                                </h3>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div class="space-y-1.5">
                                        <label class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mother's Name</label>
                                        <input type="text" id="field_mother_name" required placeholder="Full Name" oninput="window.NewCandidateModule.handleGuardianChange()"
                                            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all">
                                    </div>
                                    <div class="space-y-1.5">
                                        <label class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mother's Mobile</label>
                                        <input type="tel" id="field_mother_mobile" required placeholder="10 Digit Number" maxlength="10" oninput="window.NewCandidateModule.handleGuardianChange()"
                                            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all">
                                    </div>
                                </div>
                            </div>

                            <!-- Guardian Block -->
                            <div class="mb-8 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <h3 class="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-4 flex items-center gap-2">
                                    <span class="w-2 h-2 rounded-full bg-indigo-500"></span> Guardian Details
                                </h3>
                                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div class="space-y-1.5">
                                        <label class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Guardian Relation</label>
                                        <select id="field_guardian_relation" required onchange="window.NewCandidateModule.handleGuardianChange()"
                                            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all">
                                            <option value="" disabled selected>Select Guardian</option>
                                            <option value="Father">Father</option>
                                            <option value="Mother">Mother</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div class="space-y-1.5">
                                        <label class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Guardian Name</label>
                                        <input type="text" id="field_guardian_name" required placeholder="Full Name"
                                            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all">
                                    </div>
                                    <div class="space-y-1.5">
                                        <label class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Guardian Mobile</label>
                                        <input type="tel" id="field_guardian_mobile" required placeholder="10 Digit Number" maxlength="10"
                                            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all">
                                    </div>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div class="space-y-1.5 md:col-span-2">
                                    <label class="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Full Residential Address</label>
                                    <textarea id="field_home_address" required rows="2" placeholder="Full residential physical address for records lookup..."
                                        class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all resize-none"></textarea>
                                </div>
                                <div class="space-y-1.5">
                                    <label class="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Contact Email ID</label>
                                    <input type="email" id="field_contact_email" required placeholder="student.parent@gmail.com"
                                        class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all">
                                </div>
                            </div>
                        </div>

                        <!-- SECTION D: Document Attachments (Optimized Base64 Streamers) -->
                        <div class="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300">
                            <div class="border-b border-slate-100 dark:border-slate-700/80 pb-4 mb-6 flex items-center gap-3">
                                <div class="w-10 h-10 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center shrink-0">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                </div>
                                <div>
                                    <h2 class="text-lg font-extrabold text-slate-800 dark:text-white">Section D: Document Attachments</h2>
                                    <p class="text-xs text-slate-400 dark:text-slate-400 font-semibold uppercase tracking-wider">Drag-and-drop secure media files converter</p>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                                
                                <!-- Student Photo -->
                                <div class="space-y-2 flex flex-col">
                                    <label class="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Student Photo</label>
                                    <div class="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-900/30 text-center relative overflow-hidden group min-h-[160px]">
                                        <input type="file" id="file_student_photo" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer z-10" onchange="window.NewCandidateModule.processAttachment(this, 'studentPhoto')">
                                        <div id="preview_studentPhoto" class="hidden absolute inset-0 bg-slate-900 z-20">
                                            <img id="img_studentPhoto" src="" class="w-full h-full object-cover">
                                            <button type="button" onclick="window.NewCandidateModule.clearAttachment('studentPhoto', event)" class="absolute top-2 right-2 p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow z-30 transition-all">
                                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                            </button>
                                        </div>
                                        <div class="flex flex-col items-center space-y-2 group-hover:scale-105 transition-transform duration-300">
                                            <svg class="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
                                            <span class="text-[11px] font-bold text-brand-600 dark:text-brand-400">Upload Image</span>
                                            <span class="text-[9px] text-slate-400 font-medium">JPEG / PNG up to 2MB</span>
                                        </div>
                                    </div>
                                </div>

                                <!-- Student Signature -->
                                <div class="space-y-2 flex flex-col">
                                    <label class="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Student Signature</label>
                                    <div class="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-900/30 text-center relative overflow-hidden group min-h-[160px]">
                                        <input type="file" id="file_student_signature" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer z-10" onchange="window.NewCandidateModule.processAttachment(this, 'studentSignature')">
                                        <div id="preview_studentSignature" class="hidden absolute inset-0 bg-slate-900 z-20">
                                            <img id="img_studentSignature" src="" class="w-full h-full object-contain bg-white">
                                            <button type="button" onclick="window.NewCandidateModule.clearAttachment('studentSignature', event)" class="absolute top-2 right-2 p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow z-30 transition-all">
                                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                            </button>
                                        </div>
                                        <div class="flex flex-col items-center space-y-2 group-hover:scale-105 transition-transform duration-300">
                                            <svg class="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                            <span class="text-[11px] font-bold text-brand-600 dark:text-brand-400">Upload Signature</span>
                                            <span class="text-[9px] text-slate-400 font-medium">JPEG / PNG up to 2MB</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- SECTION E: Declarations & Financial Data -->
                        <div class="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300">
                            <div class="border-b border-slate-100 dark:border-slate-700/80 pb-4 mb-6 flex items-center gap-3">
                                <div class="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center shrink-0">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                </div>
                                <div>
                                    <h2 class="text-lg font-extrabold text-slate-800 dark:text-white">Section E: Declarations & Financial Data</h2>
                                    <p class="text-xs text-slate-400 dark:text-slate-400 font-semibold uppercase tracking-wider">Consents, agreements, and fee handling</p>
                                </div>
                            </div>
                            
                            <!-- Declarations Block -->
                            <div class="mb-8 space-y-4">
                                <label class="flex items-start gap-3 cursor-pointer group">
                                    <div class="relative flex items-center justify-center w-5 h-5 mt-0.5">
                                        <input type="checkbox" id="field_declaration_1" required class="w-5 h-5 appearance-none border-2 border-slate-300 dark:border-slate-600 rounded-md checked:bg-brand-500 checked:border-brand-500 transition-all cursor-pointer">
                                        <svg class="absolute w-3 h-3 text-white pointer-events-none opacity-0 group-has-[:checked]:opacity-100" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>
                                    </div>
                                    <span class="text-sm font-medium text-slate-700 dark:text-slate-300">I do hereby declare that the above information is true to the best of my knowledge.</span>
                                </label>
                                
                                <label class="flex items-start gap-3 cursor-pointer group">
                                    <div class="relative flex items-center justify-center w-5 h-5 mt-0.5">
                                        <input type="checkbox" id="field_declaration_2" required class="w-5 h-5 appearance-none border-2 border-slate-300 dark:border-slate-600 rounded-md checked:bg-brand-500 checked:border-brand-500 transition-all cursor-pointer">
                                        <svg class="absolute w-3 h-3 text-white pointer-events-none opacity-0 group-has-[:checked]:opacity-100" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>
                                    </div>
                                    <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Babla Yoga Training Center will not be held responsible if anything happens to any student during class.</span>
                                </label>
                            </div>
                            
                            <!-- Financial Data Block -->
                            <div class="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                                    <div class="space-y-1.5">
                                        <label class="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Total Payable Amount</label>
                                        <div class="relative">
                                            <span class="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                                            <input type="number" id="field_payable_amount" required placeholder="0.00" min="0" step="1"
                                                class="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all">
                                        </div>
                                    </div>
                                    
                                    <div class="space-y-1.5 flex flex-col justify-end pb-3">
                                        <label class="flex items-center gap-3 cursor-pointer group">
                                            <div class="relative flex items-center justify-center w-5 h-5">
                                                <input type="checkbox" id="field_is_fee_paid" class="w-5 h-5 appearance-none border-2 border-slate-300 dark:border-slate-600 rounded-md checked:bg-brand-500 checked:border-brand-500 transition-all cursor-pointer">
                                                <svg class="absolute w-3 h-3 text-white pointer-events-none opacity-0 group-has-[:checked]:opacity-100" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>
                                            </div>
                                            <span class="text-sm font-bold text-slate-700 dark:text-slate-300">Mark as Paid</span>
                                        </label>
                                    </div>

                                    <div class="space-y-1.5">
                                        <label class="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Academic Session</label>
                                        <div class="flex gap-2">
                                            <input type="number" id="field_session_from" required min="2000" max="2099" step="1" maxlength="4" placeholder="From (Year)"
                                                class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all">
                                            <input type="number" id="field_session_to" required min="2000" max="2099" step="1" maxlength="4" placeholder="To (Year)"
                                                class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all">
                                        </div>
                                    </div>

                                    <div class="space-y-1.5">
                                        <label class="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Payment Mode</label>
                                        <select id="field_payment_mode" required onchange="window.NewCandidateModule.toggleTxnIdField(this)"
                                            class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all">
                                            <option value="" disabled selected>Select Mode</option>
                                            <option value="Cash">Cash</option>
                                            <option value="UPI">UPI (Google Pay / PhonePe)</option>
                                            <option value="Card">Card</option>
                                            <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                                        </select>
                                    </div>
                                    
                                    <div class="space-y-1.5" id="txn_id_container">
                                        <label class="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Transaction ID</label>
                                        <input type="text" id="field_txn_id" placeholder="UPI Ref / UTR / Txn Number"
                                            class="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Submission Controls -->
                        <div class="flex flex-col sm:flex-row items-center gap-4 justify-end pt-4">
                            <button type="button" onclick="window.NewCandidateModule.resetFormFields()"
                                class="w-full sm:w-auto px-6 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors text-center cursor-pointer">
                                Reset Inputs
                            </button>
                            
                            <button type="button" onclick="window.NewCandidateModule.generatePDF()"
                                class="w-full sm:w-auto px-6 py-4 rounded-2xl border-2 border-brand-500 text-brand-600 dark:text-brand-400 font-bold hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all text-center cursor-pointer flex items-center justify-center gap-2">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                Generate Form PDF
                            </button>
                            
                            <button type="submit"
                                class="w-full sm:w-auto px-8 py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-bold transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer">
                                <span>Submit</span>
                                <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path></svg>
                            </button>
                        </div>
                    </form>

                </div>
            `;

            // Auto hook background sync loop intervals and network detection listeners
            window.removeEventListener('online', handleNetworkRestoration);
            window.addEventListener('online', handleNetworkRestoration);

            // Set up initial rendering of status indicators
            updateOperationsBadge();

            // Fire queue processor to catch any resurrected payloads
            processNextQueueItem();

        } catch (error) {
            console.debug('[NewCandidateModule] Mounting caught structural error:', error);
        }
    }

    /**
     * Handles live updates of the Operations Monitor indicator badge in the top bar
     */
    function updateOperationsBadge() {
        const badge = document.getElementById('globalQueueBtn');
        if (!badge) return;

        const count = window.CandidateQueue.length;
        const processing = window.CandidateQueue.some(j => j.status === 'Syncing');
        const failedCount = window.CandidateQueue.filter(j => j.status === 'Failed').length;
        const offline = state.isOffline || failedCount > 0;

        let statusHtml = '';

        if (count === 0) {
            // Green "Synced" state - Idle
            statusHtml = `
                <span class="flex h-2 w-2 rounded-full bg-emerald-500 relative shrink-0">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                </span>
                <svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span class="hidden sm:block font-bold text-[11px] tracking-tight uppercase text-slate-600 dark:text-slate-300">Queue: Idle</span>
            `;
            badge.className = "flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 transition-all text-xs font-bold font-sans cursor-pointer";
        } else if (failedCount > 0) {
            // Red "Failed/Stalled" state - Stalled
            statusHtml = `
                <span class="flex h-2 w-2 rounded-full bg-rose-500 relative shrink-0">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                </span>
                <svg class="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                <span class="hidden sm:block font-bold text-[11px] tracking-tight uppercase text-rose-600 dark:text-rose-400">Queue: Stalled (${failedCount})</span>
            `;
            badge.className = "flex items-center gap-2 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/30 bg-rose-50/50 dark:bg-rose-950/10 hover:bg-rose-100/50 dark:hover:bg-rose-900/20 text-rose-700 dark:text-rose-400 transition-all text-xs font-bold font-sans cursor-pointer animate-pulse";
        } else {
            // Amber "Syncing" state - Busy
            statusHtml = `
                <span class="flex h-2 w-2 relative shrink-0">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <svg class="w-4 h-4 text-amber-500 animate-spin shrink-0" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span class="hidden sm:block font-bold text-[11px] tracking-tight uppercase text-amber-600 dark:text-amber-500">Queue: Syncing (${count})</span>
            `;
            badge.className = "flex items-center gap-2 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-950/10 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 text-amber-700 dark:text-amber-400 transition-all text-xs font-bold font-sans cursor-pointer";
        }

        badge.innerHTML = statusHtml;

        // Sync visual inspector list if shelf is open
        if (state.isInspectorOpen) {
            renderInspectorList();
        }
    }

    /**
     * Toggles the interactive audit log inspector shelf visibility
     */
    function toggleInspector() {
        const shelf = document.getElementById('queueInspectorShelf');
        if (!shelf) return;

        state.isInspectorOpen = !state.isInspectorOpen;
        if (state.isInspectorOpen) {
            shelf.classList.remove('hidden');
            renderInspectorList();
        } else {
            shelf.classList.add('hidden');
        }
    }

    /**
     * Renders pending items dynamically inside the inspector shelf
     */
    function renderInspectorList() {
        const container = document.getElementById('inspectorQueueList');
        if (!container) return;

        if (window.CandidateQueue.length === 0) {
            container.innerHTML = `
                <div class="text-center py-6 text-slate-400 dark:text-slate-500 text-sm font-semibold">
                    Queue is completely empty. System idle.
                </div>
            `;
            // Hide bulk discard button since queue is empty
            const discardBtn = document.getElementById('discardFailedBtn');
            if (discardBtn) discardBtn.classList.add('hidden');
            return;
        }

        const hasFailed = window.CandidateQueue.some(j => j.status === 'Failed');
        const discardBtn = document.getElementById('discardFailedBtn');
        if (discardBtn) {
            if (hasFailed) {
                discardBtn.classList.remove('hidden');
            } else {
                discardBtn.classList.add('hidden');
            }
        }

        container.innerHTML = window.CandidateQueue.map((item, idx) => {
            let badgeClass = 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
            let iconHtml = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;

            if (item.status === 'Syncing') {
                badgeClass = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 animate-pulse';
                iconHtml = `<svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
            } else if (item.status === 'Failed') {
                badgeClass = 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
                iconHtml = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
            }

            return `
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 text-sm font-semibold">
                    <div class="flex items-start gap-3">
                        <span class="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">${idx + 1}</span>
                        <div>
                            <p class="text-slate-800 dark:text-slate-200">${item.data.STUDENT_NAME || 'Unknown student'}</p>
                            <p class="text-xs text-slate-400">${item.data.ENROLLED_COURSE} | Roll: ${item.data.RL_NO}</p>
                            ${item.error ? `<p class="text-xs text-rose-500 mt-1 font-bold">Error: ${item.error}</p>` : ''}
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                        <span class="px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 ${badgeClass}">
                            ${iconHtml}
                            <span>${item.status}</span>
                        </span>
                        
                        <button onclick="window.NewCandidateModule.retrySyncJob('${item.id}')"
                            class="p-2 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-xl transition-all cursor-pointer" title="Retry Transmission">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18m0 0V9m-6 3a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        </button>
                        
                        ${item.status === 'Failed' ? `
                        <button onclick="window.NewCandidateModule.pruneSyncJob('${item.id}')"
                            class="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 border border-rose-200 dark:border-rose-900/30 rounded-lg transition-all cursor-pointer" title="Discard Failed Operation">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            <span>Discard</span>
                        </button>
                        ` : `
                        <button onclick="window.NewCandidateModule.pruneSyncJob('${item.id}')"
                            class="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all cursor-pointer" title="Remove from Queue">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                        `}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Retries a specific job directly from the inspector log
     */
    function retrySyncJob(jobId) {
        const job = window.CandidateQueue.find(j => j.id === jobId);
        if (job) {
            job.status = 'Pending';
            job.error = '';
            persistQueue();
            updateOperationsBadge();
            processNextQueueItem();
        }
    }

    /**
     * Safely deletes a job out of the task queue
     */
    function pruneSyncJob(jobId) {
        window.CandidateQueue = window.CandidateQueue.filter(j => j.id !== jobId);
        persistQueue();
        updateOperationsBadge();
        window.UIUtils.showToast("Job dropped from queue buffer.", "info");
    }

    /**
     * Discards all failed operations from the sync queue at once
     */
    function discardFailedJobs() {
        const failedJobs = window.CandidateQueue.filter(j => j.status === 'Failed');
        if (failedJobs.length === 0) return;

        window.CandidateQueue = window.CandidateQueue.filter(j => j.status !== 'Failed');
        persistQueue();
        updateOperationsBadge();
        window.UIUtils.showToast(`${failedJobs.length} failed operations discarded from queue buffer.`, "info");
    }

    /**
     * Primary queue processing worker loop
     */
    async function processNextQueueItem() {
        if (state.isProcessing) return; // Prevent concurrent double executions

        // Locate next ready job
        const job = window.CandidateQueue.find(j => j.status === 'Pending');
        if (!job) {
            state.isProcessing = false;
            updateOperationsBadge();
            return;
        }

        state.isProcessing = true;
        job.status = 'Syncing';
        updateOperationsBadge();

        // Soft online check - only preemptively stall if we have already established offline status
        if (state.isOffline) {
            console.debug('[Worker Engine] System is currently in offline retry hold.');
            job.status = 'Failed';
            job.error = "Offline pending re-transmission.";
            state.isProcessing = false;
            updateOperationsBadge();
            return;
        }

        try {
            // Dispatches directly via central utility payload handler
            const response = await window.UIUtils.fetchFromEngine({
                action: "ADD_CANDIDATE",
                token: localStorage.getItem(window.SystemConfig.AUTH_KEY) || "",
                candidate: job.data
            });

            if (response && response.status === "success") {
                // Success - remove from pipeline
                window.CandidateQueue = window.CandidateQueue.filter(j => j.id !== job.id);
                window.UIUtils.showToast(`Candidate "${job.data.STUDENT_NAME}" committed to cloud successfully!`, "success");
                state.isOffline = false;
            } else {
                // Server validation or execution error
                job.status = 'Failed';
                job.error = response.message || "Spreadsheet engine execution failure.";
                window.UIUtils.showToast(`Cloud write rejected: ${job.error}`, "error");
                state.isOffline = false;
            }
        } catch (networkError) {
            // General network exceptions
            console.debug('[Worker Engine] Network exception suppressed:', networkError);
            job.status = 'Failed';
            job.error = "Engine communication timeout or endpoint rejected payload.";
            state.isOffline = true;
        } finally {
            state.isProcessing = false;
            persistQueue();
            updateOperationsBadge();

            // Recurse to handle remaining pipeline
            setTimeout(processNextQueueItem, 1000);
        }
    }

    /**
     * Reacts dynamically when network connection restores online
     */
    function handleNetworkRestoration() {
        window.UIUtils.showToast("Network restored. Sync worker resuming...", "success");
        state.isOffline = false;
        // Mark all failed/offline jobs back to Pending for automatic sweep
        window.CandidateQueue.forEach(job => {
            if (job.status === 'Failed') {
                job.status = 'Pending';
                job.error = '';
            }
        });
        persistQueue();
        updateOperationsBadge();
        processNextQueueItem();
    }

    /**
     * Intercepts and parses admission submissions
     */
    function handleFormSubmit(e) {
        e.preventDefault();

        // Gather all variables for mapping
        const nameVal = document.getElementById('field_student_name').value.trim();
        const aadharVal = document.getElementById('field_student_aadhar').value.replace(/\s+/g, '');
        const mobileVal = document.getElementById('field_student_mobile').value.trim();

        // High reliability validation patterns
        if (!nameVal) {
            return window.UIUtils.showToast("Candidate Full Name is required.", "error");
        }
        if (aadharVal.length !== 12 || isNaN(aadharVal)) {
            return window.UIUtils.showToast("Student Aadhar must represent a clean 12-digit record.", "error");
        }
        if (mobileVal.length !== 10 || isNaN(mobileVal)) {
            return window.UIUtils.showToast("Student Mobile must represent a clean 10-digit number.", "error");
        }

        // Assemble unified MasterRecord mapping payload
        const record = {
            STUDENT_ID: document.getElementById('field_student_id').value,
            RL_NO: document.getElementById('field_rl_no').value.trim(),
            SESSION: document.getElementById('field_session_from').value + "-" + document.getElementById('field_session_to').value,
            DATE_OF_ADMISSION: document.getElementById('field_date_of_admission').value,
            ENROLLED_COURSE: document.getElementById('field_enrolled_course').value,
            CLASS_BATCH_DAYS: document.getElementById('field_class_batch_days').value,
            STUDENT_NAME: nameVal,
            DOB: document.getElementById('field_dob').value,
            GENDER: document.getElementById('field_gender').value,
            BLOOD_GROUP: document.getElementById('field_blood_group').value,
            RELIGION: document.getElementById('field_religion').value,
            STUDENT_AADHAR: aadharVal,
            CATEGORY: document.getElementById('field_category').value,
            STUDENT_MOBILE: mobileVal,
            CONTACT_EMAIL: document.getElementById('field_contact_email').value.trim(),
            HOME_ADDRESS: document.getElementById('field_home_address').value.trim(),
            PHYSICAL_DISABILITY: document.getElementById('field_physical_disability').value.trim(),
            FATHER_NAME: document.getElementById('field_father_name').value.trim(),
            FATHER_MOBILE: document.getElementById('field_father_mobile').value.trim(),
            MOTHER_NAME: document.getElementById('field_mother_name').value.trim(),
            MOTHER_MOBILE: document.getElementById('field_mother_mobile').value.trim(),
            GUARDIAN_RELATION: document.getElementById('field_guardian_relation').value,
            GUARDIAN_NAME: document.getElementById('field_guardian_name').value.trim(),
            GUARDIAN_MOBILE: document.getElementById('field_guardian_mobile').value.trim(),
            DECLARATION_1: document.getElementById('field_declaration_1').checked ? 'Yes' : 'No',
            DECLARATION_2: document.getElementById('field_declaration_2').checked ? 'Yes' : 'No',
            PAYABLE_AMOUNT: document.getElementById('field_payable_amount').value,
            IS_FEE_PAID: document.getElementById('field_is_fee_paid').checked ? 'Yes' : 'No',
            PAYMENT_MODE: document.getElementById('field_payment_mode').value,
            TXN_ID: document.getElementById('field_txn_id').value.trim(),
            // Capture Base64 streams securely from internal state
            STUDENT_PHOTO_URL: state.studentPhoto,
            STUDENT_SIGNATURE_URL: state.studentSignature,
            TIMESTAMP: new Date().toISOString()
        };

        const job = {
            id: 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            status: 'Pending',
            data: record,
            error: ''
        };

        // Push into local active array
        window.CandidateQueue.push(job);
        persistQueue();

        // ⚡ NON-BLOCKING PIPELINE: Clear form inputs instantly to free view back to user
        resetFormFields();
        window.UIUtils.showToast("Admission saved locally! Syncing silently...", "success");

        // Refresh indicators and trigger background worker instantly
        updateOperationsBadge();
        processNextQueueItem();
    }

    /**
     * File processing adapter for reading Base64 streaming inputs
     */
    function processAttachment(input, stateKey) {
        if (!input.files || !input.files[0]) return;

        const file = input.files[0];

        // Safety limitation size to keep local queue payload sizes reasonable
        const limitSize = 2 * 1024 * 1024;
        if (file.size > limitSize) {
            input.value = '';
            return window.UIUtils.showToast(`Selected file exceeds standard limit of ${limitSize / (1024 * 1024)}MB.`, "error");
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            // Save base64 string directly inside internal modular state
            state[stateKey] = e.target.result;

            // Trigger visual thumbnail preview wrapper
            const previewBlock = document.getElementById(`preview_${stateKey}`);
            const imgElement = document.getElementById(`img_${stateKey}`);
            if (previewBlock && imgElement) {
                imgElement.src = e.target.result;
                previewBlock.classList.remove('hidden');
            }
            window.UIUtils.showToast("Attachment captured and prepared for Drive streaming.", "success");
        };
        reader.onerror = function () {
            console.debug(`[Base64 Converter] Conversion failed for: ${stateKey}`);
            window.UIUtils.showToast("File reading interrupted. Please try again.", "error");
        };
        reader.readAsDataURL(file);
    }

    /**
     * Clears and resets attachment inputs
     */
    function clearAttachment(stateKey, event) {
        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }

        state[stateKey] = '';
        const previewBlock = document.getElementById(`preview_${stateKey}`);
        const imgElement = document.getElementById(`img_${stateKey}`);
        if (previewBlock && imgElement) {
            imgElement.src = '';
            previewBlock.classList.add('hidden');
        }

        // Reset corresponding file input
        let inputId = stateKey === 'studentPhoto' ? 'file_student_photo' : 'file_student_signature';

        const fileInput = document.getElementById(inputId);
        if (fileInput) fileInput.value = '';
    }

    /**
     * Interactive layout utility to handle conditional payment ID visibility
     */
    function toggleTxnIdField(select) {
        const container = document.getElementById('txn_id_container');
        const input = document.getElementById('field_txn_id');
        if (!container || !input) return;

        if (select.value === 'Cash') {
            container.classList.add('opacity-40');
            input.disabled = true;
            input.value = '';
            input.placeholder = "No Txn ID required for Cash";
        } else {
            container.classList.remove('opacity-40');
            input.disabled = false;
            input.placeholder = "UPI Ref / UTR / Txn Number";
        }
    }

    /**
     * Formats Aadhar inputs live to standard "XXXX XXXX XXXX" styling blocks
     */
    function formatAadhar(input) {
        let value = input.value.replace(/\D/g, '');
        let formatted = '';
        for (let i = 0; i < value.length; i++) {
            if (i > 0 && i % 4 === 0) formatted += ' ';
            formatted += value[i];
        }
        input.value = formatted;
    }

    /**
     * Generates a PDF of the application form without triggering cloud upload
     */
    function generatePDF() {
        if (!window.PDFGenerator) {
            return window.UIUtils.showToast("PDF Utility is not loaded.", "error");
        }
        
        // Gather all variables for mapping
        const nameVal = document.getElementById('field_student_name').value.trim();
        const aadharVal = document.getElementById('field_student_aadhar').value.replace(/\s+/g, '');
        const mobileVal = document.getElementById('field_student_mobile').value.trim();

        // Assemble unified MasterRecord mapping payload
        const record = {
            STUDENT_ID: document.getElementById('field_student_id').value,
            RL_NO: document.getElementById('field_rl_no').value.trim(),
            SESSION: document.getElementById('field_session_from').value + "-" + document.getElementById('field_session_to').value,
            DATE_OF_ADMISSION: document.getElementById('field_date_of_admission').value,
            ENROLLED_COURSE: document.getElementById('field_enrolled_course').value,
            CLASS_BATCH_DAYS: document.getElementById('field_class_batch_days').value,
            STUDENT_NAME: nameVal,
            DOB: document.getElementById('field_dob').value,
            GENDER: document.getElementById('field_gender').value,
            BLOOD_GROUP: document.getElementById('field_blood_group').value,
            RELIGION: document.getElementById('field_religion').value,
            STUDENT_AADHAR: aadharVal,
            CATEGORY: document.getElementById('field_category').value,
            STUDENT_MOBILE: mobileVal,
            PHYSICAL_DISABILITY: document.getElementById('field_physical_disability').value.trim(),
            FATHER_NAME: document.getElementById('field_father_name').value.trim(),
            FATHER_MOBILE: document.getElementById('field_father_mobile').value.trim(),
            MOTHER_NAME: document.getElementById('field_mother_name').value.trim(),
            MOTHER_MOBILE: document.getElementById('field_mother_mobile').value.trim(),
            GUARDIAN_RELATION: document.getElementById('field_guardian_relation').value,
            GUARDIAN_NAME: document.getElementById('field_guardian_name').value.trim(),
            GUARDIAN_MOBILE: document.getElementById('field_guardian_mobile').value.trim(),
            DECLARATION_1: document.getElementById('field_declaration_1').checked ? 'Yes' : 'No',
            DECLARATION_2: document.getElementById('field_declaration_2').checked ? 'Yes' : 'No',
            PAYABLE_AMOUNT: document.getElementById('field_payable_amount').value,
            IS_FEE_PAID: document.getElementById('field_is_fee_paid').checked ? 'Yes' : 'No',
            PAYMENT_MODE: document.getElementById('field_payment_mode').value,
            TXN_ID: document.getElementById('field_txn_id').value.trim(),
            HOME_ADDRESS: document.getElementById('field_home_address').value.trim(),
            CONTACT_EMAIL: document.getElementById('field_contact_email').value.trim(),
            STUDENT_PHOTO_URL: state.studentPhoto,
            STUDENT_SIGNATURE_URL: state.studentSignature
        };

        window.PDFGenerator.createApplicationForm(record);
    }

    /**
     * Resets form values and resets media inputs
     */
    function resetFormFields() {
        const form = document.getElementById('enrollmentForm');
        if (!form) return;

        form.reset();

        // Clear all media attachment bindings out of memory
        clearAttachment('studentPhoto');
        clearAttachment('studentSignature');

        // Regenerate unique Student ID
        const studentIdField = document.getElementById('field_student_id');
        if (studentIdField) {
            studentIdField.value = generateMockID();
        }

        window.UIUtils.showToast("Form fields reset to defaults.", "info");
    }

    /**
     * Handles Guardian auto-fill logic
     */
    function handleGuardianChange() {
        const relationElement = document.getElementById('field_guardian_relation');
        if (!relationElement) return;
        const relation = relationElement.value;
        const nameField = document.getElementById('field_guardian_name');
        const mobileField = document.getElementById('field_guardian_mobile');
        
        if (relation === 'Father') {
            nameField.value = document.getElementById('field_father_name').value;
            mobileField.value = document.getElementById('field_father_mobile').value;
            nameField.readOnly = true;
            mobileField.readOnly = true;
            nameField.classList.add('bg-slate-50', 'dark:bg-slate-800');
            mobileField.classList.add('bg-slate-50', 'dark:bg-slate-800');
        } else if (relation === 'Mother') {
            nameField.value = document.getElementById('field_mother_name').value;
            mobileField.value = document.getElementById('field_mother_mobile').value;
            nameField.readOnly = true;
            mobileField.readOnly = true;
            nameField.classList.add('bg-slate-50', 'dark:bg-slate-800');
            mobileField.classList.add('bg-slate-50', 'dark:bg-slate-800');
        } else {
            if (nameField.readOnly) {
                nameField.value = '';
                mobileField.value = '';
            }
            nameField.readOnly = false;
            mobileField.readOnly = false;
            nameField.classList.remove('bg-slate-50', 'dark:bg-slate-800');
            mobileField.classList.remove('bg-slate-50', 'dark:bg-slate-800');
        }
    }

    return {
        mount,
        handleFormSubmit,
        generatePDF,
        processAttachment,
        clearAttachment,
        toggleTxnIdField,
        handleGuardianChange,
        formatAadhar,
        resetFormFields,
        toggleInspector,
        retrySyncJob,
        pruneSyncJob,
        discardFailedJobs,
        updateOperationsBadge,
        state
    };

})();
