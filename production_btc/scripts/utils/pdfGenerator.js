/**
 * ==========================================
 * 🖨️ PDF GENERATOR UTILITY (pdfGenerator.js)
 * ==========================================
 * FETCH-PRINT-FLUSH Architecture:
 * 1. FETCH  — Retrieves photo & signature via server-side CORS proxy (GET_IMAGE_BASE64)
 * 2. PRINT  — Bakes resolved Base64 data into the jsPDF layout
 * 3. FLUSH  — Immediately nulls all image variables post-save for browser GC
 *
 * This completely eliminates client-side CORS errors by routing all
 * Google Drive blob reads through the Apps Script backend.
 */
window.PDFGenerator = (function () {
    'use strict';

    /**
     * ==========================================
     * 🔗 SERVER-SIDE IMAGE PROXY FETCHER
     * ==========================================
     * Calls the Code.gs GET_IMAGE_BASE64 endpoint to retrieve Drive file
     * blobs as Base64 data URIs. Runs entirely on Google's servers,
     * completely bypassing browser CORS restrictions.
     *
     * @param {string} url — Raw Drive URL from the spreadsheet record
     * @returns {Promise<string|null>} — Base64 data URI or null on failure
     */
    async function fetchImageViaProxy(url) {
        if (!url || typeof url !== 'string' || url.trim() === '') return null;
        if (url.startsWith('Rich Media Stripped')) return null;

        // Already a data URI — pass through immediately (no proxy needed)
        if (url.startsWith('data:')) return url;

        // Route through the server-side CORS proxy
        try {
            const token = window.SystemConfig ? localStorage.getItem(window.SystemConfig.AUTH_KEY) : '';
            const response = await window.UIUtils.fetchFromEngine({
                action: "GET_IMAGE_BASE64",
                url: url,
                token: token
            });

            if (response && response.status === "success" && response.base64) {
                return response.base64;
            } else {
                console.warn("[PDF Proxy] Server returned non-success for URL:", url, response?.message);
                return null;
            }
        } catch (err) {
            console.warn("[PDF Proxy] Network exception for URL:", url, err);
            return null;
        }
    }

    /**
     * ==========================================
     * 📄 FETCH-PRINT-FLUSH PDF PIPELINE
     * ==========================================
     * Orchestrates the complete PDF generation lifecycle:
     *   1. Fetches all image assets via the server-side proxy
     *   2. Constructs and renders the full PDF document
     *   3. Triggers download via pdf.save()
     *   4. Immediately flushes all Base64 strings from RAM
     */
    async function createApplicationForm(data) {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            console.error("jsPDF is not loaded");
            if (window.UIUtils) window.UIUtils.showToast("PDF generation failed: jsPDF library not found.", "error");
            return;
        }

        if (window.UIUtils) window.UIUtils.showToast("Fetching images from cloud & generating PDF...", "info");

        // ==========================================
        // PHASE 1: FETCH — Resolve all image assets via server-side proxy
        // ==========================================
        let CENTER_LOGO_BASE64 = null;
        let STUDENT_PHOTO_BASE64 = null;
        let STUDENT_SIGNATURE_BASE64 = null;

        try {
            // Logo is a local asset — load it directly via fetch blob (no CORS issue)
            const logoPromise = (async () => {
                try {
                    const res = await fetch('./resources/logo_babla.jpeg');
                    if (!res.ok) return null;
                    const blob = await res.blob();
                    return await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.onerror = () => resolve(null);
                        reader.readAsDataURL(blob);
                    });
                } catch (e) {
                    return null;
                }
            })();

            // Photo & Signature — routed through the CORS proxy backend
            [CENTER_LOGO_BASE64, STUDENT_PHOTO_BASE64, STUDENT_SIGNATURE_BASE64] = await Promise.all([
                logoPromise,
                fetchImageViaProxy(data.STUDENT_PHOTO_URL),
                fetchImageViaProxy(data.STUDENT_SIGNATURE_URL)
            ]);
        } catch (e) {
            console.warn("[PDF Fetch Phase] Image resolution failed gracefully:", e);
        }

        // ==========================================
        // PHASE 2: PRINT — Construct the full PDF document
        // ==========================================
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        const pageWidth = 210;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 15;
        let currentY = margin;

        // ------------------------------------------
        // HEADER BLOCK
        // ------------------------------------------

        // Center logo in the top-left corner
        if (CENTER_LOGO_BASE64 && CENTER_LOGO_BASE64.startsWith('data:image')) {
            try {
                doc.addImage(CENTER_LOGO_BASE64, 'JPEG', margin, currentY, 25, 25);
            } catch (err) {
                console.warn("[PDF] Logo inject failed:", err);
            }
        }

        // Center-aligned institution text
        const headerCenterX = pageWidth / 2;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.setTextColor(15, 23, 42);
        doc.text("BABLA YOGA TRAINING CENTER", headerCenterX, currentY + 5, { align: 'center' });

        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text("Govt. Regd. No. S0032148 of 2021-2022 | Estd: 2015", headerCenterX, currentY + 11, { align: 'center' });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text("Address: Jagriti More, Maynaguri, Jalpaiguri, West Bengal, Pin-735224", headerCenterX, currentY + 16, { align: 'center' });
        doc.text("Email: bablayogatrainingcenter@gmail.com", headerCenterX, currentY + 20, { align: 'center' });
        doc.text("Cont. 7076280550 (Call/Wp), 8158027894 (Call)", headerCenterX, currentY + 24, { align: 'center' });

        // Candidate Photo: Fixed area in top-right corner
        const photoW = 30;
        const photoH = 40;
        const photoX = pageWidth - margin - photoW;

        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.rect(photoX, currentY, photoW, photoH);

        if (STUDENT_PHOTO_BASE64 && STUDENT_PHOTO_BASE64.startsWith('data:image')) {
            try {
                doc.addImage(STUDENT_PHOTO_BASE64, 'JPEG', photoX + 1, currentY + 1, photoW - 2, photoH - 2);
            } catch (err) {
                console.warn("[PDF] Student photo inject failed:", err);
            }
        } else {
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text("Candidate", photoX + 8, currentY + 18);
            doc.text("Photo", photoX + 10, currentY + 22);
        }

        currentY = currentY + Math.max(25, photoH) + 6;

        doc.setLineWidth(0.5);
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 8;

        // ------------------------------------------
        // BODY: Admission Details Grid
        // ------------------------------------------

        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(13, 148, 136);
        doc.text("Admission Details", headerCenterX, currentY, { align: 'center' });
        currentY += 8;

        const col1LabelX = 15;
        const col1ValueX = 50;
        const col2LabelX = 110;
        const col2ValueX = 145;
        const col1MaxW = col2LabelX - col1ValueX - 5;
        const col2MaxW = pageWidth - margin - col2ValueX;
        const fontSize = 10;

        let col1Y = currentY;
        let col2Y = currentY;

        function renderRow(label1, val1, label2, val2, spanFullRow = false) {
            doc.setFontSize(fontSize);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(100, 116, 139);

            let startY = Math.max(col1Y, col2Y);
            let newCol1Y = startY;
            let newCol2Y = startY;

            // Column 1
            if (label1) {
                doc.text(label1 + ":", col1LabelX, startY);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(15, 23, 42);

                const maxW = spanFullRow ? (pageWidth - margin - col1ValueX) : col1MaxW;
                const splitVal1 = doc.splitTextToSize(val1 || "N/A", maxW);
                doc.text(splitVal1, col1ValueX, startY);
                newCol1Y = startY + (splitVal1.length * (fontSize * 0.35)) + 3.5;
            }

            // Column 2
            if (label2 && !spanFullRow) {
                doc.setFont("helvetica", "bold");
                doc.setTextColor(100, 116, 139);
                doc.text(label2 + ":", col2LabelX, startY);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(15, 23, 42);

                const splitVal2 = doc.splitTextToSize(val2 || "N/A", col2MaxW);
                doc.text(splitVal2, col2ValueX, startY);
                newCol2Y = startY + (splitVal2.length * (fontSize * 0.35)) + 3.5;
            }

            col1Y = spanFullRow ? newCol1Y : newCol1Y;
            col2Y = spanFullRow ? newCol1Y : newCol2Y;
        }

        function renderDivider() {
            let startY = Math.max(col1Y, col2Y) + 1;
            doc.setLineWidth(0.2);
            doc.setDrawColor(241, 245, 249);
            doc.line(margin, startY, pageWidth - margin, startY);
            col1Y = startY + 5;
            col2Y = startY + 5;
        }

        // Data rows
        const safeDateOfAdmission = window.UIUtils ? window.UIUtils.cleanDateTimeString(data.DATE_OF_ADMISSION) : data.DATE_OF_ADMISSION;
        
        renderRow("Student ID", data.STUDENT_ID, "Roll No", data.RL_NO);
        renderRow("Session", data.SESSION, "Date of Admission", safeDateOfAdmission);
        renderRow("Class", data.ENROLLED_COURSE, "Class Batch", data.CLASS_BATCH_DAYS);
        renderDivider();

        renderRow("Full Name", data.STUDENT_NAME, "Date of Birth", data.DOB);
        renderRow("Gender", data.GENDER, "Blood Group", data.BLOOD_GROUP);
        renderRow("Religion", data.RELIGION, "Category", data.CATEGORY);
        renderRow("Aadhar No", data.STUDENT_AADHAR, "Mobile No", data.STUDENT_MOBILE);
        renderRow("Contact Email", data.CONTACT_EMAIL, null, null, true);
        renderRow("Home Address", data.HOME_ADDRESS, null, null, true);
        renderRow("Disability Notes", data.PHYSICAL_DISABILITY, null, null, true);
        renderDivider();

        renderRow("Father's Name", data.FATHER_NAME, "Father's Mobile", data.FATHER_MOBILE);
        renderRow("Mother's Name", data.MOTHER_NAME, "Mother's Mobile", data.MOTHER_MOBILE);
        renderRow("Guardian", data.GUARDIAN_RELATION + (data.GUARDIAN_NAME ? ' (' + data.GUARDIAN_NAME + ')' : ''), "Guardian Mob", data.GUARDIAN_MOBILE);
        renderDivider();

        renderRow("Payable Amount", "Rs. " + (data.PAYABLE_AMOUNT || "0"), "Is Fee Paid", data.IS_FEE_PAID);
        renderRow("Payment Mode", data.PAYMENT_MODE, "Txn ID", data.TXN_ID);

        let finalGridY = Math.max(col1Y, col2Y);

        // ------------------------------------------
        // DECLARATIONS
        // ------------------------------------------

        let cursorY = finalGridY + 15;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text("Declarations", 15, cursorY);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);

        const dec1 = `1. ${data.DECLARATION_1 === 'Yes' ? '[X]' : '[ ]'} I declare that all the information provided above is true and correct to the best of my knowledge.`;
        const dec2 = `2. ${data.DECLARATION_2 === 'Yes' ? '[X]' : '[ ]'} I understand the risks involved in physical training and release the center from any liability.`;

        const splitDec1 = doc.splitTextToSize(dec1, 180);
        doc.text(splitDec1, 15, cursorY + 5);

        const dec2Offset = cursorY + 5 + (splitDec1.length * (8.5 * 0.35)) + 2;
        const splitDec2 = doc.splitTextToSize(dec2, 180);
        doc.text(splitDec2, 15, dec2Offset);

        // ------------------------------------------
        // FOOTER: QR Code + Signature + Save
        // ------------------------------------------

        /**
         * Final render step: places QR code and signature, then triggers
         * the FLUSH phase to release all image memory.
         */
        const renderSignaturesAndSave = (qrImage) => {
            // QR Code: Bottom-left corner
            const qrX = 15;
            const qrY = pageHeight - 45;
            if (qrImage) {
                try {
                    doc.addImage(qrImage, 'PNG', qrX, qrY, 24, 24);
                } catch (err) {
                    console.warn("[PDF] QR inject failed:", err);
                }
            }

            // Signature Image: Bottom-right corner
            const signX = 140;
            const signY = pageHeight - 40;
            const signWidth = 40;
            const signHeight = 12;

            if (STUDENT_SIGNATURE_BASE64 && STUDENT_SIGNATURE_BASE64.startsWith('data:image')) {
                try {
                    doc.addImage(STUDENT_SIGNATURE_BASE64, 'JPEG', signX, signY - signHeight - 2, signWidth, signHeight);
                } catch (err) {
                    console.warn("[PDF] Signature inject failed:", err);
                }
            }

            doc.setLineWidth(0.5);
            doc.setDrawColor(15, 23, 42);
            doc.line(signX, signY, signX + signWidth, signY);

            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(15, 23, 42);
            doc.text(`Date: ${new Date().toLocaleDateString()}`, signX, signY + 5);

            doc.setFont("helvetica", "bold");
            doc.text("Candidate/Guardian Signature", signX, signY + 9);

            // ==========================================
            // PHASE 2B: SAVE — Trigger PDF download
            // ==========================================
            const sanitizedName = (data.STUDENT_NAME || "Candidate").replace(/[^a-zA-Z0-9]/g, '_');
            doc.save(`BYTC_Admission_${sanitizedName}.pdf`);

            // ==========================================
            // PHASE 3: FLUSH — Immediately release all Base64 image
            // strings from browser RAM to trigger native GC
            // ==========================================
            CENTER_LOGO_BASE64 = null;
            STUDENT_PHOTO_BASE64 = null;
            STUDENT_SIGNATURE_BASE64 = null;
            if (qrImage) {
                qrImage = null;
            }

            if (window.UIUtils) window.UIUtils.showToast("Professional PDF Generated Successfully!", "success");
            console.debug("[PDF Flush] All image buffers released from RAM.");
        };

        // Generate QR Code securely
        const qrDataString = `Name: ${data.STUDENT_NAME || 'N/A'}\nRoll: ${data.RL_NO || 'N/A'}\nSession: ${data.SESSION || 'N/A'}\nMobile: ${data.STUDENT_MOBILE || 'N/A'}`;
        if (typeof window.QRCode !== 'undefined') {
            const qrContainer = document.createElement("div");
            qrContainer.style.position = "absolute";
            qrContainer.style.left = "-9999px";
            document.body.appendChild(qrContainer);

            new window.QRCode(qrContainer, {
                text: qrDataString,
                width: 128,
                height: 128,
                correctLevel: window.QRCode.CorrectLevel.M
            });

            setTimeout(() => {
                let qrDataUrl = null;
                try {
                    const canvas = qrContainer.querySelector("canvas");
                    if (canvas) {
                        qrDataUrl = canvas.toDataURL("image/png");
                    }
                } catch (e) { }
                document.body.removeChild(qrContainer);
                renderSignaturesAndSave(qrDataUrl);
            }, 100);
        } else {
            renderSignaturesAndSave(null);
        }
    }

    return {
        createApplicationForm
    };

})();
