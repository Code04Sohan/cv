/**
 * ==========================================
 * 🖨️ PDF GENERATOR UTILITY (pdfGenerator.js)
 * ==========================================
 * Refined for strict 1-page structural flow and accurate bounds tracking.
 */
window.PDFGenerator = (function () {
    'use strict';

    /**
     * Resolves a Google Drive share/view URL to a direct binary stream URL.
     */
    function resolveDriveUrl(url) {
        if (!url || typeof url !== 'string') return '';
        if (url.startsWith('data:')) return url;
        const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/) || url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
            return `https://docs.google.com/uc?export=download&id=${match[1]}`;
        }
        return url;
    }

    /**
     * Fetches any image URL (including resolved Drive stream links) as a Blob,
     * converts it to a Base64 data URI string. Bypasses CORS taint.
     */
    async function getBase64FromDriveUrl(url) {
        if (!url || typeof url !== 'string' || url.trim() === '') return null;
        if (url.startsWith('Rich Media Stripped')) return null;
        if (url.startsWith('data:')) return url;

        const streamUrl = resolveDriveUrl(url);

        try {
            const response = await fetch(streamUrl, { mode: 'cors' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            return await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(blob);
            });
        } catch (fetchErr) {
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'Anonymous';
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, img.width, img.height);
                        ctx.drawImage(img, 0, 0);
                        resolve(canvas.toDataURL('image/jpeg', 0.85));
                    } catch (e) {
                        resolve(null);
                    }
                };
                img.onerror = () => resolve(null);
                img.src = streamUrl;
            });
        }
    }

    async function createApplicationForm(data) {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            console.error("jsPDF is not loaded");
            if (window.UIUtils) window.UIUtils.showToast("PDF generation failed: jsPDF library not found.", "error");
            return;
        }

        if (window.UIUtils) window.UIUtils.showToast("Generating Professional PDF Document...", "info");

        // The very first step: dynamically resolve ALL image assets
        let CENTER_LOGO_BASE64 = null;
        let STUDENT_PHOTO_BASE64 = null;
        let STUDENT_SIGNATURE_BASE64 = null;
        
        try {
            [CENTER_LOGO_BASE64, STUDENT_PHOTO_BASE64, STUDENT_SIGNATURE_BASE64] = await Promise.all([
                getBase64FromDriveUrl('./resources/logo_babla.jpeg'),
                getBase64FromDriveUrl(data.STUDENT_PHOTO_URL),
                getBase64FromDriveUrl(data.STUDENT_SIGNATURE_URL)
            ]);
        } catch (e) {
            console.warn("Image resolution failed gracefully:", e);
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        const pageWidth = 210;
        // Calculate the absolute bottom of the page
        const pageHeight = doc.internal.pageSize.height;
        const margin = 15;
        let currentY = margin;

        // ==========================================
        // 2. Header Design (Fixed Positioning)
        // ==========================================

        // Render CENTER_LOGO_BASE64 in the top-left corner
        if (CENTER_LOGO_BASE64 && CENTER_LOGO_BASE64.startsWith('data:image')) {
            doc.addImage(CENTER_LOGO_BASE64, 'JPEG', margin, currentY, 25, 25);
        }

        // Center-align the text block
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

        // Candidate Photo: Reserve a fixed area in the top-right corner
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
                console.warn("Failed to inject student photo:", err);
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

        // ==========================================
        // 3. Body Design (Strict 1-Page Layout)
        // ==========================================

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

            let startY = Math.max(col1Y, col2Y); // synchronize row starts
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

        // Output fixed data perfectly spaced
        renderRow("Student ID", data.STUDENT_ID, "Roll No", data.RL_NO);
        renderRow("Session", data.SESSION, "Date of Admission", data.DATE_OF_ADMISSION);
        renderRow("Class", data.ENROLLED_COURSE, "Class Batch", data.CLASS_BATCH_DAYS);
        renderDivider();

        renderRow("Full Name", data.STUDENT_NAME, "Date of Birth", data.DOB);
        renderRow("Gender", data.GENDER, "Blood Group", data.BLOOD_GROUP);
        renderRow("Religion", data.RELIGION, "Category", data.CATEGORY);
        renderRow("Aadhar No", data.STUDENT_AADHAR, "Mobile No", data.STUDENT_MOBILE);
        renderRow("Disability Notes", data.PHYSICAL_DISABILITY, null, null, true);
        renderDivider();

        renderRow("Father's Name", data.FATHER_NAME, "Father's Mobile", data.FATHER_MOBILE);
        renderRow("Mother's Name", data.MOTHER_NAME, "Mother's Mobile", data.MOTHER_MOBILE);
        renderRow("Guardian", data.GUARDIAN_RELATION + (data.GUARDIAN_NAME ? ' (' + data.GUARDIAN_NAME + ')' : ''), "Guardian Mob", data.GUARDIAN_MOBILE);
        renderRow("Contact Email", data.CONTACT_EMAIL, null, null, true);
        renderRow("Home Address", data.HOME_ADDRESS, null, null, true);
        renderDivider();

        renderRow("Payable Amount", "Rs. " + (data.PAYABLE_AMOUNT || "0"), "Is Fee Paid", data.IS_FEE_PAID);
        renderRow("Payment Mode", data.PAYMENT_MODE, "Txn ID", data.TXN_ID);

        let finalGridY = Math.max(col1Y, col2Y);

        // ==========================================
        // 4. Footer & Declarations Adjustments
        // ==========================================

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

        // Fixed Footer Base (Bottom Left / Bottom Right)
        const finishPDF = () => {
            const sanitizedName = (data.STUDENT_NAME || "Candidate").replace(/[^a-zA-Z0-9]/g, '_');
            doc.save(`BYTC_Admission_${sanitizedName}.pdf`);
            if (window.UIUtils) window.UIUtils.showToast("Professional PDF Generated Successfully!", "success");
        };

        const renderSignaturesAndSave = (qrImage) => {
            // QR Code: Lock strictly to the bottom-left corner
            const qrX = 15;
            const qrY = pageHeight - 45;
            if (qrImage) {
                doc.addImage(qrImage, 'PNG', qrX, qrY, 24, 24);
            }

            // Signature Image & Date: Lock strictly to the bottom-right corner
            const signX = 140;
            const signY = pageHeight - 40;
            const signWidth = 40;
            const signHeight = 12;

            if (STUDENT_SIGNATURE_BASE64 && STUDENT_SIGNATURE_BASE64.startsWith('data:image')) {
                try {
                    doc.addImage(STUDENT_SIGNATURE_BASE64, 'JPEG', signX, signY - signHeight - 2, signWidth, signHeight);
                } catch (err) {
                    console.warn("Signature inject failed silently:", err);
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
            doc.text("Candidate Signature", signX, signY + 9);

            finishPDF();
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
