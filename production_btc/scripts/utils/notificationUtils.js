/**
 * ====================================================================
 * 📣 NOTIFICATION UTILITY MODULE (notificationUtils.js)
 * ====================================================================
 * Zero-Storage Runtime Email & WhatsApp Notification System
 *
 * Architecture:
 *   - EMAIL  → Generates a PDF blob client-side via window.PDFGenerator,
 *              encodes it as Base64, and fires it to the backend
 *              SEND_RUNTIME_EMAIL_ATTACHMENT relay. Zero Drive storage.
 *   - WHATSAPP → Opens a wa.me redirect with a pure plain-text message
 *              pre-composed and URL-encoded. Zero cloud links or attachments.
 *
 * Exposed as: window.NotificationUtils
 *
 * Public API:
 *   sendAdmissionEmail(candidateRecord)
 *   sendAdmissionWhatsApp(candidateRecord)
 *   sendPaymentReceiptEmail(candidateRecord, paymentSummary)
 *   sendPaymentReceiptWhatsApp(candidateRecord, paymentSummary)
 * ====================================================================
 */
window.NotificationUtils = (function () {
    'use strict';

    // =========================================
    // ⚙️ INTERNAL CONFIG
    // =========================================

    /**
     * Returns the active session auth token from localStorage.
     */
    function getToken() {
        return window.SystemConfig ? localStorage.getItem(window.SystemConfig.AUTH_KEY) : '';
    }

    /**
     * Formats a number as Indian Rupees (₹1,00,000).
     */
    function formatINR(amount) {
        return '₹' + Number(amount || 0).toLocaleString('en-IN');
    }

    /**
     * Returns a clean date string from various raw date values.
     */
    function formatDate(dateVal) {
        if (!dateVal) return 'N/A';
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return String(dateVal);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
    }

    // =========================================
    // 🖨️ RUNTIME PDF → BASE64 BRIDGE
    // =========================================

    /**
     * Renders the jsPDF document for a candidate record into a volatile
     * Base64 string entirely in browser RAM. No file is saved, no URL
     * is generated. The string is passed directly to the email relay.
     *
     * This works by intercepting jsPDF's output('datauristring') call
     * instead of pdf.save(), which normally triggers a download.
     *
     * @param {Object} record - Full candidate MasterRecord object
     * @returns {Promise<string|null>} Base64 data URI string or null on failure
     */
    async function generatePdfBase64(record) {
        return new Promise(async (resolve) => {
            try {
                if (!window.jspdf || !window.jspdf.jsPDF) {
                    console.warn('[NotificationUtils] jsPDF not loaded — cannot generate PDF base64.');
                    return resolve(null);
                }

                // ── Re-implement the same FETCH-PRINT pipeline as pdfGenerator.js ──
                // but output datauristring instead of triggering save().

                const fetchViaProxy = async (url) => {
                    if (!url || typeof url !== 'string' || url.trim() === '') return null;
                    if (url.startsWith('Rich Media Stripped') || url === 'N/A') return null;
                    if (url.startsWith('data:')) return url;
                    try {
                        const res = await window.UIUtils.fetchFromEngine({
                            action: 'GET_IMAGE_BASE64',
                            url: url,
                            token: getToken()
                        });
                        return (res && res.status === 'success' && res.base64) ? res.base64 : null;
                    } catch (e) {
                        return null;
                    }
                };

                // FETCH phase
                let logoB64 = null;
                let photoB64 = null;
                let sigB64   = null;

                try {
                    const logoPromise = (async () => {
                        try {
                            const res = await fetch('./resources/logo_babla.jpeg');
                            if (!res.ok) return null;
                            const blob = await res.blob();
                            return await new Promise((res2) => {
                                const reader = new FileReader();
                                reader.onloadend = () => res2(reader.result);
                                reader.onerror   = () => res2(null);
                                reader.readAsDataURL(blob);
                            });
                        } catch (e) { return null; }
                    })();

                    [logoB64, photoB64, sigB64] = await Promise.all([
                        logoPromise,
                        fetchViaProxy(record.STUDENT_PHOTO_URL),
                        fetchViaProxy(record.STUDENT_SIGNATURE_URL)
                    ]);
                } catch (e) {
                    console.warn('[NotificationUtils] Image fetch phase failed gracefully:', e);
                }

                // PRINT phase — identical layout to pdfGenerator.js createApplicationForm()
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF('p', 'mm', 'a4');

                const pageWidth  = 210;
                const pageHeight = doc.internal.pageSize.height;
                const margin     = 15;
                let   currentY   = margin;

                // Header
                if (logoB64 && logoB64.startsWith('data:image')) {
                    try { doc.addImage(logoB64, 'JPEG', margin, currentY, 25, 25); } catch (e) {}
                }

                const hcx = pageWidth / 2;
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(16);
                doc.setTextColor(15, 23, 42);
                doc.text('BABLA YOGA TRAINING CENTER', hcx, currentY + 5, { align: 'center' });

                doc.setFontSize(9);
                doc.setTextColor(71, 85, 105);
                doc.text('Govt. Regd. No. S0032148 of 2021-2022 | Estd: 2015', hcx, currentY + 11, { align: 'center' });

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8.5);
                doc.text('Address: Jagriti More, Maynaguri, Jalpaiguri, West Bengal, Pin-735224', hcx, currentY + 16, { align: 'center' });
                doc.text('Email: bablayogatrainingcenter@gmail.com', hcx, currentY + 20, { align: 'center' });
                doc.text('Cont. 7076280550 (Call/Wp), 8158027894 (Call)', hcx, currentY + 24, { align: 'center' });

                const photoW = 30, photoH = 40;
                const photoX = pageWidth - margin - photoW;
                doc.setDrawColor(203, 213, 225);
                doc.setLineWidth(0.3);
                doc.rect(photoX, currentY, photoW, photoH);
                if (photoB64 && photoB64.startsWith('data:image')) {
                    try { doc.addImage(photoB64, 'JPEG', photoX + 1, currentY + 1, photoW - 2, photoH - 2); } catch (e) {}
                } else {
                    doc.setFontSize(8); doc.setTextColor(148, 163, 184);
                    doc.text('Candidate', photoX + 8, currentY + 18);
                    doc.text('Photo',     photoX + 10, currentY + 22);
                }

                currentY += Math.max(25, photoH) + 6;
                doc.setLineWidth(0.5); doc.setDrawColor(226, 232, 240);
                doc.line(margin, currentY, pageWidth - margin, currentY);
                currentY += 8;

                // Section title
                doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
                doc.setTextColor(13, 148, 136);
                doc.text('Admission Details', hcx, currentY, { align: 'center' });
                currentY += 8;

                const col1LX = 15, col1VX = 50, col2LX = 110, col2VX = 145;
                const col1MaxW = col2LX - col1VX - 5;
                const col2MaxW = pageWidth - margin - col2VX;
                const fs = 10;
                let c1Y = currentY, c2Y = currentY;

                function renderRow(l1, v1, l2, v2, full) {
                    doc.setFontSize(fs);
                    let sY = Math.max(c1Y, c2Y);
                    let n1Y = sY, n2Y = sY;
                    if (l1) {
                        doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139);
                        doc.text(l1 + ':', col1LX, sY);
                        doc.setFont('helvetica', 'normal'); doc.setTextColor(15, 23, 42);
                        const mW = full ? (pageWidth - margin - col1VX) : col1MaxW;
                        const sv1 = doc.splitTextToSize(v1 || 'N/A', mW);
                        doc.text(sv1, col1VX, sY);
                        n1Y = sY + (sv1.length * (fs * 0.35)) + 3.5;
                    }
                    if (l2 && !full) {
                        doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 116, 139);
                        doc.text(l2 + ':', col2LX, sY);
                        doc.setFont('helvetica', 'normal'); doc.setTextColor(15, 23, 42);
                        const sv2 = doc.splitTextToSize(v2 || 'N/A', col2MaxW);
                        doc.text(sv2, col2VX, sY);
                        n2Y = sY + (sv2.length * (fs * 0.35)) + 3.5;
                    }
                    c1Y = full ? n1Y : n1Y;
                    c2Y = full ? n1Y : n2Y;
                }

                function renderDiv() {
                    let sY = Math.max(c1Y, c2Y) + 1;
                    doc.setLineWidth(0.2); doc.setDrawColor(241, 245, 249);
                    doc.line(margin, sY, pageWidth - margin, sY);
                    c1Y = sY + 5; c2Y = sY + 5;
                }

                const safeAdm = window.UIUtils ? window.UIUtils.cleanDateTimeString(record.DATE_OF_ADMISSION) : record.DATE_OF_ADMISSION;

                renderRow('Student ID', record.STUDENT_ID, 'Roll No', record.RL_NO);
                renderRow('Session', record.SESSION, 'Date of Admission', safeAdm);
                renderRow('Class', record.ENROLLED_COURSE, 'Class Batch', record.CLASS_BATCH_DAYS);
                renderDiv();

                renderRow('Full Name', record.STUDENT_NAME, 'Date of Birth', record.DOB);
                renderRow('Gender', record.GENDER, 'Blood Group', record.BLOOD_GROUP);
                renderRow('Religion', record.RELIGION, 'Category', record.CATEGORY);
                renderRow('Aadhar No', record.STUDENT_AADHAR, 'Mobile No', record.STUDENT_MOBILE);
                renderRow('Contact Email', record.CONTACT_EMAIL, null, null, true);
                renderRow('Home Address', record.HOME_ADDRESS, null, null, true);
                renderRow('Disability Notes', record.PHYSICAL_DISABILITY, null, null, true);
                renderDiv();

                renderRow("Father's Name", record.FATHER_NAME, "Father's Mobile", record.FATHER_MOBILE);
                renderRow("Mother's Name", record.MOTHER_NAME, "Mother's Mobile", record.MOTHER_MOBILE);
                renderRow('Guardian', record.GUARDIAN_RELATION + (record.GUARDIAN_NAME ? ' (' + record.GUARDIAN_NAME + ')' : ''), 'Guardian Mob', record.GUARDIAN_MOBILE);
                renderDiv();

                renderRow('Payable Amount', 'Rs. ' + (record.PAYABLE_AMOUNT || '0'), 'Is Fee Paid', record.IS_FEE_PAID);
                renderRow('Payment Mode', record.PAYMENT_MODE, 'Txn ID', record.TXN_ID);

                let finalGridY = Math.max(c1Y, c2Y);

                // Declarations
                let curY = finalGridY + 15;
                doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(15, 23, 42);
                doc.text('Declarations', 15, curY);
                doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(71, 85, 105);

                const d1 = '1. ' + (record.DECLARATION_1 === 'Yes' ? '[X]' : '[ ]') + ' I declare that all the information provided above is true and correct to the best of my knowledge.';
                const d2 = '2. ' + (record.DECLARATION_2 === 'Yes' ? '[X]' : '[ ]') + ' I understand the risks involved in physical training and release the center from any liability.';
                const sd1 = doc.splitTextToSize(d1, 180);
                doc.text(sd1, 15, curY + 5);
                const d2off = curY + 5 + (sd1.length * (8.5 * 0.35)) + 2;
                const sd2 = doc.splitTextToSize(d2, 180);
                doc.text(sd2, 15, d2off);

                // Footer / Signature
                const signX = 140, signY = pageHeight - 40;
                const signW = 40, signH = 12;
                if (sigB64 && sigB64.startsWith('data:image')) {
                    try { doc.addImage(sigB64, 'JPEG', signX, signY - signH - 2, signW, signH); } catch (e) {}
                }
                doc.setLineWidth(0.5); doc.setDrawColor(15, 23, 42);
                doc.line(signX, signY, signX + signW, signY);
                doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(15, 23, 42);
                doc.text('Date: ' + new Date().toLocaleDateString(), signX, signY + 5);
                doc.setFont('helvetica', 'bold');
                doc.text('Candidate/Guardian Signature', signX, signY + 9);

                // OUTPUT as base64 string — zero file save, zero Drive call
                const pdfBase64 = doc.output('datauristring');

                // Flush image buffers from RAM immediately
                logoB64 = null;
                photoB64 = null;
                sigB64 = null;

                resolve(pdfBase64);

            } catch (err) {
                console.error('[NotificationUtils] PDF Base64 generation failed:', err);
                resolve(null);
            }
        });
    }

    // =========================================
    // 📧 EMAIL COMPOSERS
    // =========================================

    /**
     * Composes the HTML email body for an admission confirmation.
     * @param {Object} r - Candidate MasterRecord
     * @returns {string} HTML email body string
     */
    function composeAdmissionEmailBody(r) {
        return '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">' +
            '<div style="background:linear-gradient(135deg,#0d9488,#0891b2);padding:28px 32px;border-radius:12px 12px 0 0;">' +
                '<h1 style="color:#fff;margin:0;font-size:22px;">🧘 Babla Yoga Training Center</h1>' +
                '<p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">Govt. Regd. No. S0032148 | Estd. 2015</p>' +
            '</div>' +
            '<div style="background:#f8fafc;padding:28px 32px;border:1px solid #e2e8f0;">' +
                '<h2 style="color:#0d9488;margin:0 0 6px;">Admission Confirmed!</h2>' +
                '<p style="color:#475569;font-size:14px;margin:0 0 20px;">Dear <strong>' + (r.STUDENT_NAME || 'Student') + '</strong>, your enrollment has been successfully recorded. Please find your admission form attached.</p>' +
                '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
                    '<tr style="background:#e0f2fe;"><td style="padding:8px 12px;font-weight:bold;width:45%;">Student ID</td><td style="padding:8px 12px;">' + (r.STUDENT_ID || 'N/A') + '</td></tr>' +
                    '<tr style="background:#fff;"><td style="padding:8px 12px;font-weight:bold;">Roll Number</td><td style="padding:8px 12px;">' + (r.RL_NO || 'N/A') + '</td></tr>' +
                    '<tr style="background:#e0f2fe;"><td style="padding:8px 12px;font-weight:bold;">Session</td><td style="padding:8px 12px;">' + (r.SESSION || 'N/A') + '</td></tr>' +
                    '<tr style="background:#fff;"><td style="padding:8px 12px;font-weight:bold;">Enrolled Class</td><td style="padding:8px 12px;">' + (r.ENROLLED_COURSE || 'N/A') + '</td></tr>' +
                    '<tr style="background:#e0f2fe;"><td style="padding:8px 12px;font-weight:bold;">Class Batch</td><td style="padding:8px 12px;">' + (r.CLASS_BATCH_DAYS || 'N/A') + '</td></tr>' +
                    '<tr style="background:#fff;"><td style="padding:8px 12px;font-weight:bold;">Date of Admission</td><td style="padding:8px 12px;">' + formatDate(r.DATE_OF_ADMISSION) + '</td></tr>' +
                    '<tr style="background:#e0f2fe;"><td style="padding:8px 12px;font-weight:bold;">Admission Fee Paid</td><td style="padding:8px 12px;">' + (r.IS_FEE_PAID === 'Yes' ? '✅ Yes — ' + formatINR(r.PAYABLE_AMOUNT) : '⏳ Pending') + '</td></tr>' +
                    '<tr style="background:#fff;"><td style="padding:8px 12px;font-weight:bold;">Payment Mode</td><td style="padding:8px 12px;">' + (r.PAYMENT_MODE || 'N/A') + '</td></tr>' +
                    (r.TXN_ID ? '<tr style="background:#e0f2fe;"><td style="padding:8px 12px;font-weight:bold;">Transaction ID</td><td style="padding:8px 12px;">' + r.TXN_ID + '</td></tr>' : '') +
                '</table>' +
                '<p style="margin:20px 0 0;font-size:13px;color:#64748b;">For queries, contact us at <a href="mailto:bablayogatrainingcenter@gmail.com" style="color:#0d9488;">bablayogatrainingcenter@gmail.com</a> or call <strong>7076280550</strong>.</p>' +
            '</div>' +
            '<div style="background:#0f172a;padding:14px 32px;border-radius:0 0 12px 12px;text-align:center;">' +
                '<p style="color:#94a3b8;font-size:12px;margin:0;">Babla Yoga Training Center · Jagriti More, Maynaguri, Jalpaiguri · Pin-735224</p>' +
            '</div>' +
        '</div>';
    }

    /**
     * Composes the HTML email body for a fee payment receipt.
     * @param {Object} r - Candidate MasterRecord
     * @param {Object} summary - Payment summary object
     *   { months: string[], totalAmount: number, txnId: string, timestamp: string }
     * @returns {string} HTML email body string
     */
    function composePaymentEmailBody(r, summary) {
        const monthList = Array.isArray(summary.months) ? summary.months.join(', ') : (summary.months || 'N/A');
        const count     = Array.isArray(summary.months) ? summary.months.length : 1;

        return '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">' +
            '<div style="background:linear-gradient(135deg,#059669,#0d9488);padding:28px 32px;border-radius:12px 12px 0 0;">' +
                '<h1 style="color:#fff;margin:0;font-size:22px;">💳 Fee Payment Receipt</h1>' +
                '<p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">Babla Yoga Training Center</p>' +
            '</div>' +
            '<div style="background:#f8fafc;padding:28px 32px;border:1px solid #e2e8f0;">' +
                '<p style="color:#475569;font-size:14px;margin:0 0 20px;">Dear <strong>' + (r.STUDENT_NAME || 'Student') + '</strong>, we have received your fee payment. A receipt is attached for your records.</p>' +
                '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
                    '<tr style="background:#d1fae5;"><td style="padding:8px 12px;font-weight:bold;width:45%;">Student Name</td><td style="padding:8px 12px;">' + (r.STUDENT_NAME || 'N/A') + '</td></tr>' +
                    '<tr style="background:#fff;"><td style="padding:8px 12px;font-weight:bold;">Student ID</td><td style="padding:8px 12px;">' + (r.STUDENT_ID || 'N/A') + '</td></tr>' +
                    '<tr style="background:#d1fae5;"><td style="padding:8px 12px;font-weight:bold;">Roll Number</td><td style="padding:8px 12px;">' + (r.RL_NO || 'N/A') + '</td></tr>' +
                    '<tr style="background:#fff;"><td style="padding:8px 12px;font-weight:bold;">Enrolled Class</td><td style="padding:8px 12px;">' + (r.ENROLLED_COURSE || 'N/A') + '</td></tr>' +
                    '<tr style="background:#d1fae5;"><td style="padding:8px 12px;font-weight:bold;">Months Paid</td><td style="padding:8px 12px;">' + monthList + '</td></tr>' +
                    '<tr style="background:#fff;"><td style="padding:8px 12px;font-weight:bold;">Number of Months</td><td style="padding:8px 12px;">' + count + '</td></tr>' +
                    '<tr style="background:#d1fae5;"><td style="padding:8px 12px;font-weight:bold;font-size:16px;">Total Amount</td><td style="padding:8px 12px;font-size:16px;font-weight:bold;color:#059669;">' + formatINR(summary.totalAmount) + '</td></tr>' +
                    '<tr style="background:#fff;"><td style="padding:8px 12px;font-weight:bold;">Transaction ID</td><td style="padding:8px 12px;font-family:monospace;">' + (summary.txnId || 'N/A') + '</td></tr>' +
                    '<tr style="background:#d1fae5;"><td style="padding:8px 12px;font-weight:bold;">Payment Date</td><td style="padding:8px 12px;">' + formatDate(summary.timestamp) + '</td></tr>' +
                '</table>' +
                '<div style="margin:20px 0 0;background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;padding:12px 16px;">' +
                    '<p style="margin:0;font-size:13px;color:#064e3b;font-weight:bold;">✅ Payment verified and recorded in our ledger.</p>' +
                '</div>' +
                '<p style="margin:16px 0 0;font-size:13px;color:#64748b;">For queries, contact us at <a href="mailto:bablayogatrainingcenter@gmail.com" style="color:#059669;">bablayogatrainingcenter@gmail.com</a> or call <strong>7076280550</strong>.</p>' +
            '</div>' +
            '<div style="background:#0f172a;padding:14px 32px;border-radius:0 0 12px 12px;text-align:center;">' +
                '<p style="color:#94a3b8;font-size:12px;margin:0;">Babla Yoga Training Center · Jagriti More, Maynaguri, Jalpaiguri · Pin-735224</p>' +
            '</div>' +
        '</div>';
    }

    // =========================================
    // 📱 WHATSAPP MESSAGE COMPOSERS
    // =========================================

    /**
     * Composes a clean plain-text WhatsApp message for an admission event.
     * @param {Object} r - Candidate MasterRecord
     * @returns {string} Raw plain text string (no HTML, no URLs)
     */
    function composeAdmissionWhatsAppText(r) {
        return '*BABLA YOGA TRAINING CENTER*\n' +
            'Govt. Regd. No. S0032148 | Estd. 2015\n' +
            'Jagriti More, Maynaguri, Jalpaiguri - 735224\n' +
            '--------------------------------------\n' +
            '*ADMISSION CONFIRMATION*\n' +
            '--------------------------------------\n' +
            'Dear *' + (r.STUDENT_NAME || 'Student') + '*, your enrollment has been confirmed!\n\n' +
            '*Student ID:* ' + (r.STUDENT_ID  || 'N/A') + '\n' +
            '*Roll No:*    ' + (r.RL_NO       || 'N/A') + '\n' +
            '*Session:*    ' + (r.SESSION     || 'N/A') + '\n' +
            '*Class:*      ' + (r.ENROLLED_COURSE || 'N/A') + '\n' +
            '*Batch Days:* ' + (r.CLASS_BATCH_DAYS || 'N/A') + '\n' +
            '*Admitted On:*' + formatDate(r.DATE_OF_ADMISSION) + '\n\n' +
            '*Fee Details:*\n' +
            '  Payable: ' + formatINR(r.PAYABLE_AMOUNT) + '\n' +
            '  Status: ' + (r.IS_FEE_PAID === 'Yes' ? 'PAID' : 'PENDING') + '\n' +
            (r.PAYMENT_MODE ? '  Mode: ' + r.PAYMENT_MODE + '\n' : '') +
            (r.TXN_ID ? '  Txn ID: ' + r.TXN_ID + '\n' : '') +
            '\nFor queries: 7076280550 (Call/WhatsApp) or 8158027894\n' +
            'Email: bablayogatrainingcenter@gmail.com\n\n' +
            'Thank you for joining Babla Yoga Training Center!';
    }

    /**
     * Composes a clean plain-text WhatsApp message for a fee payment receipt.
     * @param {Object} r - Candidate MasterRecord
     * @param {Object} summary - { months: string[], totalAmount: number, txnId: string, timestamp: string }
     * @returns {string} Raw plain text string (no HTML, no URLs)
     */
    function composePaymentWhatsAppText(r, summary) {
        const monthList = Array.isArray(summary.months) ? summary.months.join(', ') : (summary.months || 'N/A');
        const count     = Array.isArray(summary.months) ? summary.months.length : 1;

        return '*BABLA YOGA TRAINING CENTER*\n' +
            'Govt. Regd. No. S0032148 | Estd. 2015\n' +
            'Jagriti More, Maynaguri, Jalpaiguri - 735224\n' +
            '--------------------------------------\n' +
            '*FEE PAYMENT RECEIPT*\n' +
            '--------------------------------------\n' +
            'Dear *' + (r.STUDENT_NAME || 'Student') + '*, your fee payment has been received!\n\n' +
            '*Student ID:*   ' + (r.STUDENT_ID || 'N/A') + '\n' +
            '*Roll No:*      ' + (r.RL_NO      || 'N/A') + '\n' +
            '*Class:*        ' + (r.ENROLLED_COURSE || 'N/A') + '\n\n' +
            '*Months Paid:*  ' + monthList + '\n' +
            '*No. of Months:*' + count + '\n' +
            '*Total Amount:* ' + formatINR(summary.totalAmount) + '\n' +
            '*Transaction ID:*' + (summary.txnId || 'N/A') + '\n' +
            '*Payment Date:* ' + formatDate(summary.timestamp) + '\n\n' +
            'Payment has been verified and recorded in our system.\n\n' +
            'For queries: 7076280550 (Call/WhatsApp)\n' +
            'Email: bablayogatrainingcenter@gmail.com\n\n' +
            'Thank you! Stay healthy with Babla Yoga!';
    }

    // =========================================
    // 🚀 PUBLIC DISPATCH FUNCTIONS
    // =========================================

    /**
     * Sends an admission confirmation email with the candidate's PDF attached.
     * PDF is generated in browser RAM and streamed directly to the backend
     * SMTP relay as a volatile Base64 chunk. No Drive file is created.
     *
     * @param {Object} candidateRecord - Full MasterRecord object
     * @returns {Promise<void>}
     */
    async function sendAdmissionEmail(candidateRecord) {
        const email = (candidateRecord.CONTACT_EMAIL || '').trim();

        if (!email) {
            if (window.UIUtils) window.UIUtils.showToast('No contact email on record — email skipped.', 'info');
            return;
        }

        if (window.UIUtils) window.UIUtils.showToast('Generating PDF & sending admission email...', 'info');

        try {
            const pdfBase64 = await generatePdfBase64(candidateRecord);

            const payload = {
                action: 'SEND_RUNTIME_EMAIL_ATTACHMENT',
                token: getToken(),
                recipientEmail: email,
                subject: 'Babla Yoga Training Center — Admission Confirmed: ' + (candidateRecord.STUDENT_NAME || ''),
                bodyHtml: composeAdmissionEmailBody(candidateRecord),
                base64Pdf: pdfBase64 || '',
                fileName: 'BYTC_Admission_' + (candidateRecord.STUDENT_NAME || 'Form').replace(/[^a-zA-Z0-9]/g, '_') + '.pdf'
            };

            const res = await window.UIUtils.fetchFromEngine(payload);

            if (res && res.status === 'success') {
                if (window.UIUtils) window.UIUtils.showToast('Admission email sent successfully to ' + email, 'success');
            } else {
                throw new Error((res && res.message) || 'Email relay returned an error.');
            }

        } catch (err) {
            console.error('[NotificationUtils] Admission email failed:', err);
            if (window.UIUtils) window.UIUtils.showToast('Email send failed: ' + err.message, 'error');
        }
    }

    /**
     * Opens a WhatsApp browser redirect for an admission confirmation.
     * Message is pure plain text. No cloud links, no attachments.
     * Targets the student's primary mobile number.
     *
     * @param {Object} candidateRecord - Full MasterRecord object
     */
    function sendAdmissionWhatsApp(candidateRecord) {
        const mobile = String(candidateRecord.STUDENT_MOBILE || '').replace(/\D/g, '');

        if (!mobile || mobile.length < 10) {
            if (window.UIUtils) window.UIUtils.showToast('No valid mobile number on record — WhatsApp skipped.', 'info');
            return;
        }

        const text       = composeAdmissionWhatsAppText(candidateRecord);
        const e164Mobile = '91' + mobile.slice(-10); // Prepend India country code
        const waUrl      = 'https://wa.me/' + e164Mobile + '?text=' + encodeURIComponent(text);

        window.open(waUrl, '_blank');

        if (window.UIUtils) window.UIUtils.showToast('WhatsApp redirect opened for ' + (candidateRecord.STUDENT_NAME || 'student') + '.', 'success');
    }

    /**
     * Sends a fee payment receipt email with a PDF attached.
     * PDF is generated in browser RAM from the candidate record and
     * streamed to the backend SMTP relay. No Drive file is created.
     *
     * @param {Object} candidateRecord - Full MasterRecord object
     * @param {Object} paymentSummary  - { months: string[], totalAmount: number, txnId: string, timestamp: string }
     * @returns {Promise<void>}
     */
    async function sendPaymentReceiptEmail(candidateRecord, paymentSummary) {
        const email = (candidateRecord.CONTACT_EMAIL || '').trim();

        if (!email) {
            if (window.UIUtils) window.UIUtils.showToast('No contact email on record — email skipped.', 'info');
            return;
        }

        if (window.UIUtils) window.UIUtils.showToast('Generating receipt PDF & sending email...', 'info');

        try {
            const pdfBase64 = await generatePdfBase64(candidateRecord);

            const payload = {
                action: 'SEND_RUNTIME_EMAIL_ATTACHMENT',
                token: getToken(),
                recipientEmail: email,
                subject: 'Babla Yoga Training Center — Fee Receipt: ' + (candidateRecord.STUDENT_NAME || ''),
                bodyHtml: composePaymentEmailBody(candidateRecord, paymentSummary),
                base64Pdf: pdfBase64 || '',
                fileName: 'BYTC_FeeReceipt_' + (candidateRecord.STUDENT_NAME || 'Receipt').replace(/[^a-zA-Z0-9]/g, '_') + '.pdf'
            };

            const res = await window.UIUtils.fetchFromEngine(payload);

            if (res && res.status === 'success') {
                if (window.UIUtils) window.UIUtils.showToast('Fee receipt email sent to ' + email, 'success');
            } else {
                throw new Error((res && res.message) || 'Email relay returned an error.');
            }

        } catch (err) {
            console.error('[NotificationUtils] Payment email failed:', err);
            if (window.UIUtils) window.UIUtils.showToast('Email send failed: ' + err.message, 'error');
        }
    }

    /**
     * Opens a WhatsApp browser redirect for a fee payment receipt.
     * Message is pure plain text. No cloud links, no attachments.
     * Targets the student's primary mobile number.
     *
     * @param {Object} candidateRecord - Full MasterRecord object
     * @param {Object} paymentSummary  - { months: string[], totalAmount: number, txnId: string, timestamp: string }
     */
    function sendPaymentReceiptWhatsApp(candidateRecord, paymentSummary) {
        const mobile = String(candidateRecord.STUDENT_MOBILE || '').replace(/\D/g, '');

        if (!mobile || mobile.length < 10) {
            if (window.UIUtils) window.UIUtils.showToast('No valid mobile number on record — WhatsApp skipped.', 'info');
            return;
        }

        const text       = composePaymentWhatsAppText(candidateRecord, paymentSummary);
        const e164Mobile = '91' + mobile.slice(-10);
        const waUrl      = 'https://wa.me/' + e164Mobile + '?text=' + encodeURIComponent(text);

        window.open(waUrl, '_blank');

        if (window.UIUtils) window.UIUtils.showToast('WhatsApp redirect opened for ' + (candidateRecord.STUDENT_NAME || 'student') + '.', 'success');
    }

    // =========================================
    // 🎯 UNIFIED FEE DISPATCH GATEWAY
    // =========================================

    /**
     * Single-call unified fee notification dispatcher.
     * Reads triggerEmail / triggerWhatsApp flags and routes to the
     * appropriate delivery channels, all within a single await call.
     *
     * EMAIL path:
     *   - Generates admission-record PDF as volatile Base64 in browser RAM
     *   - Streams it to the SEND_RUNTIME_EMAIL_ATTACHMENT backend relay
     *   - Drops the Base64 string from memory immediately after dispatch
     *   - Zero Drive I/O at every step
     *
     * WHATSAPP path:
     *   - Composes a pure plain-text message with no URLs or attachments
     *   - Opens wa.me redirect in a new browser tab
     *
     * @param {Object}  student         - Full candidate MasterRecord object
     * @param {Object}  summaryData     - Fee summary: { txnId, amount, feePeriods }
     *   summaryData.txnId              - Transaction reference string
     *   summaryData.amount             - Numeric rupee total (e.g. 1000)
     *   summaryData.feePeriods         - Human-readable month list string (e.g. "January 2026, February 2026")
     * @param {boolean} triggerEmail    - Send email with PDF attachment if true
     * @param {boolean} triggerWhatsApp - Open WhatsApp redirect if true
     * @returns {Promise<void>}
     */
    async function dispatchFeeNotification(student, summaryData, triggerEmail, triggerWhatsApp) {

        // ── A. RUNTIME PDF GENERATION & EMAIL DISPATCH ────────────────────
        if (triggerEmail && (student.CONTACT_EMAIL || '').trim()) {
            try {
                if (window.UIUtils) window.UIUtils.showToast('Generating PDF invoice & dispatching email...', 'info');


                // ── ROUTE TO DEDICATED FEE INVOICE GENERATOR ──────────────
                // window.FeePDFGeneratorModule produces an HTML-based invoice
                // layout that is entirely separate from the admission form PDF.
                // This prevents layout bleed between the two document types.
                // Falls back to the general admission PDF generator only if the
                // fee module failed to load (e.g. script tag missing).
                let base64DataStream = '';
                if (window.FeePDFGeneratorModule && typeof window.FeePDFGeneratorModule.generateFeePDFBase64 === 'function') {
                    base64DataStream = await window.FeePDFGeneratorModule.generateFeePDFBase64(student, summaryData);
                } else {
                    // Fallback: annotate the candidate record and use the jsPDF admission generator
                    const annotatedRecord = Object.assign({}, student, {
                        PAYABLE_AMOUNT: summaryData.amount,
                        TXN_ID: summaryData.txnId,
                        IS_FEE_PAID: 'Yes',
                        PAYMENT_MODE: student.PAYMENT_MODE || 'Online'
                    });
                    base64DataStream = await generatePdfBase64(annotatedRecord);
                }


                const emailSubject = 'Babla Yoga Training Center — Fee Receipt | Ref: ' + summaryData.txnId;
                const emailBody =
                    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">' +
                    '<div style="background:linear-gradient(135deg,#059669,#0d9488);padding:28px 32px;border-radius:12px 12px 0 0;">' +
                        '<h1 style="color:#fff;margin:0;font-size:22px;">💳 Fee Payment Receipt</h1>' +
                        '<p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px;">Babla Yoga Training Center — Govt. Regd. No. S0032148</p>' +
                    '</div>' +
                    '<div style="background:#f8fafc;padding:28px 32px;border:1px solid #e2e8f0;">' +
                        '<p style="color:#475569;font-size:15px;margin:0 0 16px;">Dear <strong>' + (student.STUDENT_NAME || 'Student') + '</strong>,</p>' +
                        '<p style="color:#475569;font-size:14px;margin:0 0 20px;">We have successfully received your fee payment. Your electronic receipt is attached to this email.</p>' +
                        '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
                            '<tr style="background:#d1fae5;"><td style="padding:9px 13px;font-weight:bold;width:46%;">Student Name</td><td style="padding:9px 13px;">' + (student.STUDENT_NAME || 'N/A') + '</td></tr>' +
                            '<tr style="background:#fff;"><td style="padding:9px 13px;font-weight:bold;">Roll No</td><td style="padding:9px 13px;">' + (student.RL_NO || 'N/A') + '</td></tr>' +
                            '<tr style="background:#d1fae5;"><td style="padding:9px 13px;font-weight:bold;">Enrolled Class</td><td style="padding:9px 13px;">' + (student.ENROLLED_COURSE || 'N/A') + '</td></tr>' +
                            '<tr style="background:#fff;"><td style="padding:9px 13px;font-weight:bold;">Billing Periods</td><td style="padding:9px 13px;">' + (summaryData.feePeriods || 'N/A') + '</td></tr>' +
                            '<tr style="background:#d1fae5;"><td style="padding:9px 13px;font-weight:bold;font-size:15px;">Amount Paid</td><td style="padding:9px 13px;font-size:15px;font-weight:bold;color:#059669;">₹' + Number(summaryData.amount || 0).toLocaleString('en-IN') + '</td></tr>' +
                            '<tr style="background:#fff;"><td style="padding:9px 13px;font-weight:bold;">Transaction Ref</td><td style="padding:9px 13px;font-family:monospace;letter-spacing:0.04em;">' + (summaryData.txnId || 'N/A') + '</td></tr>' +
                            '<tr style="background:#d1fae5;"><td style="padding:9px 13px;font-weight:bold;">Receipt Date</td><td style="padding:9px 13px;">' + new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + '</td></tr>' +
                        '</table>' +
                        '<div style="margin:20px 0 0;background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;padding:14px 16px;">' +
                            '<p style="margin:0;font-size:13px;color:#064e3b;font-weight:bold;">✅ Payment verified and recorded in the BYTC ledger.</p>' +
                        '</div>' +
                        '<p style="margin:18px 0 0;font-size:13px;color:#64748b;">Queries? Reach us at <a href="mailto:bablayogatrainingcenter@gmail.com" style="color:#059669;">bablayogatrainingcenter@gmail.com</a> or call <strong>7076280550</strong>.</p>' +
                    '</div>' +
                    '<div style="background:#0f172a;padding:14px 32px;border-radius:0 0 12px 12px;text-align:center;">' +
                        '<p style="color:#94a3b8;font-size:12px;margin:0;">Babla Yoga Training Center · Jagriti More, Maynaguri, Jalpaiguri · Pin-735224</p>' +
                    '</div>' +
                    '</div>';

                await window.UIUtils.fetchFromEngine({
                    action: 'SEND_RUNTIME_EMAIL_ATTACHMENT',
                    token: getToken(),
                    recipientEmail: student.CONTACT_EMAIL.trim(),
                    subject: emailSubject,
                    bodyHtml: emailBody,
                    base64Pdf: base64DataStream || '',
                    fileName: 'Fee_Receipt_' + (summaryData.txnId || 'BYTC').replace(/[^a-zA-Z0-9_-]/g, '_') + '.pdf'
                });

                // ── Immediately drop Base64 string from RAM ────────────────
                // The local variable goes out of scope after this IIFE exits.
                // No reference is retained anywhere in the module.

                if (window.UIUtils) window.UIUtils.showToast('📧 Payment invoice emailed to student.', 'success');

            } catch (err) {
                console.error('[NotificationUtils] dispatchFeeNotification — email relay failed:', err);
                if (window.UIUtils) window.UIUtils.showToast('Email dispatch failed: ' + err.message, 'error');
            }
        }

        // ── B. PURE TEXT WHATSAPP REDIRECT ────────────────────────────────
        if (triggerWhatsApp) {
            const mobileNum = String(student.STUDENT_MOBILE || '').replace(/\D/g, '');
            if (mobileNum && mobileNum.length >= 10) {
                const textPreset =
                    '*BABLA YOGA TRAINING CENTER*\n' +
                    'Govt. Regd. No. S0032148 | Estd. 2015\n' +
                    'Jagriti More, Maynaguri, Jalpaiguri - 735224\n' +
                    '--------------------------------------\n' +
                    '*FEE RECEIPT ISSUED* 💳\n' +
                    '--------------------------------------\n' +
                    'Dear *' + (student.STUDENT_NAME || 'Student') + '*,\n\n' +
                    'Your fee payment has been received and recorded.\n\n' +
                    '*Student:*  ' + (student.STUDENT_NAME || 'N/A') + '\n' +
                    '*Roll No:*  ' + (student.RL_NO || 'N/A') + '\n' +
                    '*Class:*    ' + (student.ENROLLED_COURSE || 'N/A') + '\n\n' +
                    '*Periods:*  ' + (summaryData.feePeriods || 'N/A') + '\n' +
                    '*Amount:*   ₹' + Number(summaryData.amount || 0).toLocaleString('en-IN') + '\n' +
                    '*Ref ID:*   ' + (summaryData.txnId || 'N/A') + '\n\n' +
                    'For queries: 7076280550 (Call/WhatsApp)\n' +
                    'Email: bablayogatrainingcenter@gmail.com\n\n' +
                    'Thank you! Stay healthy with Babla Yoga! 🧘';

                window.open('https://wa.me/91' + mobileNum.slice(-10) + '?text=' + encodeURIComponent(textPreset), '_blank');

                if (window.UIUtils) window.UIUtils.showToast('💬 WhatsApp receipt redirect opened.', 'success');
            } else {
                if (window.UIUtils) window.UIUtils.showToast('No valid mobile on record — WhatsApp skipped.', 'info');
            }
        }
    }

    // =========================================
    // 📦 PUBLIC API
    // =========================================
    return {
        sendAdmissionEmail,
        sendAdmissionWhatsApp,
        sendPaymentReceiptEmail,
        sendPaymentReceiptWhatsApp,
        dispatchFeeNotification
    };

})();
