/**
 * ==========================================
 * 🖨️ PDF GENERATOR UTILITY (pdfGenerator.js)
 * ==========================================
 * A standalone module to generate client-side PDFs with embedded QR codes.
 * Requires jsPDF and qrcodejs to be loaded globally.
 */

window.PDFGenerator = (function () {
    'use strict';

    /**
     * Generates and downloads the Application Form PDF for a candidate
     * @param {Object} data - The candidate payload matching the standard schema
     */
    function createApplicationForm(data) {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            console.error("jsPDF is not loaded");
            if (window.UIUtils) window.UIUtils.showToast("PDF generation failed: jsPDF library not found.", "error");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4'); // A4 size: 210 x 297 mm
        const margin = 15;
        let currentY = 20;

        // --- Header Section ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(13, 148, 136); // Brand color (Teal)
        doc.text("BABLA YOGA TRAINING CENTER", 105, currentY, { align: "center" });
        
        currentY += 10;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(14);
        doc.setTextColor(71, 85, 105); // Slate 600
        doc.text("Application for Admission", 105, currentY, { align: "center" });
        
        currentY += 15;
        doc.setDrawColor(203, 213, 225); // Slate 300
        doc.setLineWidth(0.5);
        doc.line(margin, currentY, 210 - margin, currentY);
        
        currentY += 10;
        
        // Inject Student Photo
        if (data.STUDENT_PHOTO_URL && data.STUDENT_PHOTO_URL.startsWith('data:image')) {
            try {
                // Top right position
                doc.addImage(data.STUDENT_PHOTO_URL, 165, 20, 30, 35);
            } catch (err) {
                console.error("Failed to inject student photo:", err);
            }
        }

        // --- Helper Function for Rendering Fields ---
        function addField(label, value, x, y, valueMaxWidth) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139); // Slate 500
            doc.text(`${label}:`, x, y);
            
            doc.setFont("helvetica", "normal");
            doc.setTextColor(15, 23, 42); // Slate 900
            
            // Adjust x for value based on label width (approximate)
            const labelWidth = doc.getTextWidth(`${label}: `);
            const textLines = doc.splitTextToSize(value || "N/A", valueMaxWidth || 65);
            doc.text(textLines, x + labelWidth, y);
            
            return textLines.length * 5; // Return height taken
        }

        // --- Section: System & Enrollment Parameters ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(13, 148, 136); // Brand color
        doc.text("System & Enrollment Parameters", margin, currentY);
        currentY += 8;

        let col1X = margin;
        let col2X = 110;
        let rowH = 8;
        
        addField("Student ID", data.STUDENT_ID, col1X, currentY);
        addField("Roll Number", data.RL_NO, col2X, currentY);
        currentY += rowH;
        
        addField("Session", data.SESSION, col1X, currentY);
        addField("Admission Date", data.DATE_OF_ADMISSION, col2X, currentY);
        currentY += rowH;
        
        addField("Course", data.ENROLLED_COURSE, col1X, currentY, 70);
        currentY += rowH; // extra space for multiline
        addField("Class Batch", data.CLASS_BATCH_DAYS, col1X, currentY, 150);
        
        currentY += 12;
        doc.setDrawColor(226, 232, 240); // Slate 200
        doc.line(margin, currentY, 210 - margin, currentY);
        currentY += 8;

        // --- Section: Candidate Demographics ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(13, 148, 136);
        doc.text("Candidate Demographics", margin, currentY);
        currentY += 8;

        addField("Full Name", data.STUDENT_NAME, col1X, currentY);
        addField("Date of Birth", data.DOB, col2X, currentY);
        currentY += rowH;

        addField("Gender", data.GENDER, col1X, currentY);
        addField("Blood Group", data.BLOOD_GROUP, col2X, currentY);
        currentY += rowH;

        addField("Aadhar No", data.STUDENT_AADHAR, col1X, currentY);
        addField("Mobile No", data.STUDENT_MOBILE, col2X, currentY);
        currentY += rowH;

        addField("Category", data.CATEGORY, col1X, currentY);
        addField("Disability/Notes", data.PHYSICAL_DISABILITY, col2X, currentY, 60);
        currentY += rowH + 4;

        doc.line(margin, currentY, 210 - margin, currentY);
        currentY += 8;

        // --- Section: Parent/Guardian Details ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(13, 148, 136);
        doc.text("Parent/Guardian Details", margin, currentY);
        currentY += 8;

        addField("Father's Name", data.FATHER_NAME, col1X, currentY);
        addField("Mother's Name", data.MOTHER_NAME, col2X, currentY);
        currentY += rowH;

        addField("Father's Mobile", data.FATHER_MOBILE, col1X, currentY);
        addField("Mother's Mobile", data.MOTHER_MOBILE, col2X, currentY);
        currentY += rowH;

        addField("Guardian Relation", data.GUARDIAN_RELATION, col1X, currentY);
        addField("Guardian Name", data.GUARDIAN_NAME, col2X, currentY);
        currentY += rowH;

        addField("Guardian Mobile", data.GUARDIAN_MOBILE, col1X, currentY);
        currentY += rowH;

        let addressLines = addField("Home Address", data.HOME_ADDRESS, col1X, currentY, 160);
        currentY += addressLines + 2;

        addField("Contact Email", data.CONTACT_EMAIL, col1X, currentY, 160);
        currentY += 12;
        
        doc.line(margin, currentY, 210 - margin, currentY);
        currentY += 8;

        // --- Section: Financial & Declarations ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(13, 148, 136);
        doc.text("Financial & Declarations", margin, currentY);
        currentY += 8;
        
        addField("Payable Amount", "Rs. " + (data.PAYABLE_AMOUNT || "0"), col1X, currentY);
        addField("Fee Paid", data.IS_FEE_PAID, col2X, currentY);
        currentY += rowH;
        
        addField("Payment Mode", data.PAYMENT_MODE, col1X, currentY);
        addField("Txn ID", data.TXN_ID, col2X, currentY);
        currentY += rowH;
        
        addField("Dec 1 (True Info)", data.DECLARATION_1, col1X, currentY);
        addField("Dec 2 (Liability)", data.DECLARATION_2, col2X, currentY);
        currentY += rowH + 4;
        
        doc.line(margin, currentY, 210 - margin, currentY);
        currentY += 8;
        
        // Inject Student Signature
        if (data.STUDENT_SIGNATURE_URL && data.STUDENT_SIGNATURE_URL.startsWith('data:image')) {
            try {
                // Bottom right above QR
                doc.addImage(data.STUDENT_SIGNATURE_URL, 150, currentY, 40, 15);
                
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
                doc.setTextColor(148, 163, 184);
                doc.text("Student Signature", 160, currentY + 18);
            } catch (err) {
                console.error("Failed to inject student signature:", err);
            }
        }
        
        currentY += 15;

        // --- Generate QR Code ---
        const qrDataString = `Name: ${data.STUDENT_NAME || 'N/A'}\nRoll: ${data.RL_NO || 'N/A'}\nPhone: ${data.STUDENT_MOBILE || 'N/A'}\nFather: ${data.FATHER_NAME || 'N/A'}\nEmail: ${data.CONTACT_EMAIL || 'N/A'}`;
        
        if (typeof QRCode !== 'undefined') {
            const qrContainer = document.createElement("div");
            qrContainer.style.position = "absolute";
            qrContainer.style.left = "-9999px";
            document.body.appendChild(qrContainer);

            new QRCode(qrContainer, {
                text: qrDataString,
                width: 128,
                height: 128,
                correctLevel: QRCode.CorrectLevel.M
            });

            // Need to wait slightly for QRCode to finish rendering to canvas
            setTimeout(() => {
                try {
                    const canvas = qrContainer.querySelector("canvas");
                    if (canvas) {
                        const qrImage = canvas.toDataURL("image/png");
                        // Add QR code to bottom-left
                        doc.addImage(qrImage, 'PNG', margin, currentY, 35, 35);
                        
                        doc.setFont("helvetica", "normal");
                        doc.setFontSize(8);
                        doc.setTextColor(148, 163, 184); // Slate 400
                        doc.text("Official Automated Record", margin + 40, currentY + 15);
                        doc.text(`Timestamp: ${new Date().toLocaleString()}`, margin + 40, currentY + 20);
                        doc.text("Babla Yoga Training Center - Admissions Engine", margin + 40, currentY + 25);
                    }
                } catch (err) {
                    console.error("QR Code rendering failed:", err);
                } finally {
                    document.body.removeChild(qrContainer);
                    
                    // Save the PDF
                    const sanitizedName = (data.STUDENT_NAME || "Candidate").replace(/[^a-zA-Z0-9]/g, '_');
                    doc.save(`Application_${sanitizedName}.pdf`);
                    if (window.UIUtils) window.UIUtils.showToast("PDF generated successfully!", "success");
                }
            }, 100);
        } else {
            console.warn("qrcodejs not loaded, skipping QR generation.");
            const sanitizedName = (data.STUDENT_NAME || "Candidate").replace(/[^a-zA-Z0-9]/g, '_');
            doc.save(`Application_${sanitizedName}.pdf`);
            if (window.UIUtils) window.UIUtils.showToast("PDF generated (without QR) successfully!", "success");
        }
    }

    // Expose Public API
    return {
        createApplicationForm
    };

})();
