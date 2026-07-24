/**
 * ====================================================================
 * 🖨️ FEE INVOICE PDF GENERATOR (feePdfGenerator.js)
 * ====================================================================
 * Compiles a genuine binary PDF fee receipt entirely in browser RAM
 * using jsPDF primitives and returns a volatile Base64 data URI string.
 *
 * Architecture:
 *   - Renders a styled fee receipt using jsPDF's vector drawing API
 *   - Calls doc.output('datauristring') to obtain a real PDF Base64 URI:
 *       "data:application/pdf;base64,JVBERi0x..." (actual PDF bytes)
 *   - The backend relay's .split(',').pop() correctly strips the prefix,
 *     yielding a clean Base64 PDF binary ready for MIME attachment
 *   - The full data URI is also usable directly for local browser download
 *   - Payload is serialized via JSON.stringify() in UIUtils.fetchFromEngine,
 *     guaranteeing zero truncation over the wire
 *   - Returns a volatile reference — never stored at module scope
 *
 * ⚠️  BUG FIXED: The previous implementation encoded raw HTML as Base64
 *     and labelled it as application/pdf. This produced a corrupt file
 *     because the decoded bytes were HTML text, not a valid PDF binary.
 *     The backend relay decoded and attached it faithfully, but email
 *     clients (and PDF viewers) rejected it as a malformed PDF. Fix:
 *     use jsPDF's doc.output('datauristring') which produces genuine
 *     cross-platform PDF binary bytes from the start.
 *
 * Exposed as: window.FeePDFGeneratorModule
 *
 * Public API:
 *   generateFeePDFBase64(student, summaryData) → Promise<string>
 *   downloadFeePDF(student, summaryData)       → Promise<void>
 *
 * summaryData shape:
 *   { txnId: string, amount: number|string, feePeriods: string }
 * ====================================================================
 */
window.FeePDFGeneratorModule = (function () {
    'use strict';

    // =========================================
    // 🎨 BRAND COLOR CONSTANTS (jsPDF RGB triplets)
    // =========================================
    const C = {

        TEAL_DARK: [15, 118, 110],  // #0f766e — primary brand

        SLATE_900: [15, 23, 42],  // #0f172a

        SLATE_700: [51, 65, 85],  // #334155

        SLATE_500: [100, 116, 139],  // #64748b

        SLATE_300: [203, 213, 225],  // #cbd5e1

        SLATE_100: [241, 245, 249],  // #f1f5f9

        WHITE: [255, 255, 255],

        EMERALD: [16, 185, 129],  // #10b981

        INDIGO: [67, 56, 202],  // #4338ca

        GREEN_BG: [240, 253, 244],  // #f0fdf4

        HEADER_SUB: [180, 230, 225],  // light teal for header subtext

    };

    // =========================================
    // 🔧 INTERNAL PDF DOCUMENT BUILDER
    // =========================================

    /**
     * Constructs the fee receipt jsPDF document using vector drawing primitives.
     * No HTML, no canvas — pure PDF binary.
     *
     * @param {Object} student     - Candidate MasterRecord object
     * @param {Object} summaryData - { txnId, amount, feePeriods }
     * @returns {jsPDF|null}
     */
    function _buildPdfDocument(student, summaryData) {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            console.error('[FeePDFGeneratorModule] jsPDF library not loaded — cannot generate PDF.');
            return null;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        const PW = 210;           // A4 page width mm
        const PH = 297;           // A4 page height mm
        const MARGIN = 14;
        const CW = PW - MARGIN * 2;
        let Y = MARGIN;

        // ── Shorthand helpers ───────────────────────────────────────────
        const tc = (rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
        const fc = (rgb) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
        const dc = (rgb) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
        const ln = (x1, y1, x2, y2) => doc.line(x1, y1, x2, y2);
        const bx = (x, y, w, h, style) => doc.rect(x, y, w, h, style);
        const tx = (str, x, y, o) => doc.text(String(str || ''), x, y, o || {});
        const ph = doc.internal.pageSize.height;

        // ── Resolved data values ────────────────────────────────────────
        const now = new Date();
        const dateString = now.toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        const amountDisplay = Number(summaryData.amount || 0).toLocaleString('en-IN');
        const txnId = summaryData.txnId || 'N/A';
        const feePeriods = summaryData.feePeriods || 'N/A';
        const paymentDate = student.TIMESTAMP || dateString;

        // ══════════════════════════════════════════════════════════════════
        // 1. CENTER HEADER BLOCK
        // ══════════════════════════════════════════════════════════════════
        const HEADER_H = 48;
        fc(C.TEAL_DARK);
        bx(0, 0, PW, HEADER_H, 'F');

        // Institution name
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        tc(C.WHITE);
        tx('BABLA YOGA TRAINING CENTER', PW / 2, Y + 9, { align: 'center' });

        // Sub-detail lines
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        tc(C.HEADER_SUB);
        tx('Govt. Regd. No. S0032148 of 2021-2022  |  Estd: 2015', PW / 2, Y + 16, { align: 'center' });
        tx('Address: Jagriti More, Maynaguri, Jalpaiguri, West Bengal, Pin-735224', PW / 2, Y + 21.5, { align: 'center' });
        tx('Email: bablayogatrainingcenter@gmail.com', PW / 2, Y + 27, { align: 'center' });
        tx('Cont. 7076280550 (Call/Wp)  |  8597125683 (Call)', PW / 2, Y + 32.5, { align: 'center' });

        Y = HEADER_H + 5;

        // ══════════════════════════════════════════════════════════════════
        // 2. DOCUMENT TITLE BADGE
        // ══════════════════════════════════════════════════════════════════
        fc(C.GREEN_BG);
        dc(C.TEAL_DARK);
        doc.setLineWidth(0.5);
        bx(MARGIN, Y, CW, 10, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        tc(C.TEAL_DARK);
        tx('OFFICIAL FEE PAYMENT RECEIPT', PW / 2, Y + 6.8, { align: 'center' });

        Y += 14;

        // ══════════════════════════════════════════════════════════════════
        // 3. RECEIPT META BAR  (TXN ID — left  |  Generated date — right)
        // ══════════════════════════════════════════════════════════════════
        fc(C.SLATE_100);
        dc(C.SLATE_300);
        doc.setLineWidth(0.2);
        bx(MARGIN, Y, CW, 8, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        tc(C.SLATE_500);
        tx('Transaction ID:', MARGIN + 3, Y + 5.2);
        doc.setFont('helvetica', 'bold');
        tc(C.INDIGO);
        tx(txnId, MARGIN + 29, Y + 5.2);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        tc(C.SLATE_500);
        tx('Receipt Generated: ' + dateString, PW - MARGIN - 2, Y + 5.2, { align: 'right' });

        Y += 12;

        // ══════════════════════════════════════════════════════════════════
        // 4. CANDIDATE DETAILS GRID  (2-column, 3-row card layout)
        // ══════════════════════════════════════════════════════════════════
        const DETAIL_SECTION_LABEL_Y = Y;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        tc(C.TEAL_DARK);
        tx('CANDIDATE DETAILS', MARGIN, Y + 4);

        // Horizontal rule below section heading
        dc(C.TEAL_DARK);
        doc.setLineWidth(0.4);
        ln(MARGIN, Y + 6, PW - MARGIN, Y + 6);

        Y += 10;

        const COL_W = CW / 2 - 2;
        const ROW_GAP = 11;

        const detailFields = [
            { label: 'Student Name', value: student.STUDENT_NAME || 'N/A' },
            { label: 'Student ID', value: student.STUDENT_ID || 'N/A' },
            { label: 'Roll Number', value: String(student.RL_NO || 'N/A') },
            { label: 'Class / Batch', value: student.CLASS_BATCH_DAYS || student.ENROLLED_COURSE || 'N/A' },
            { label: 'Transaction ID', value: txnId, highlight: true },
            { label: 'Payment Date', value: paymentDate },
        ];

        detailFields.forEach(function (field, idx) {
            const col = idx % 2;
            const row = Math.floor(idx / 2);
            const fx = MARGIN + col * (COL_W + 4);
            const fy = Y + row * ROW_GAP;

            // Card pill background
            if (field.highlight) {
                fc(C.GREEN_BG);
                dc(C.TEAL_DARK);
                doc.setLineWidth(0.2);
                bx(fx, fy - 3, COL_W, 9, 'FD');
            } else {
                fc(C.SLATE_100);
                dc(C.SLATE_300);
                doc.setLineWidth(0.2);
                bx(fx, fy - 3, COL_W, 9, 'FD');
            }

            // Label
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            tc(C.SLATE_500);
            tx(field.label + ':', fx + 3, fy + 0.5);

            // Value
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            tc(field.highlight ? C.TEAL_DARK : C.SLATE_900);
            // Truncate long values to prevent overflow
            const maxW = COL_W - 6;
            const valLines = doc.splitTextToSize(field.value, maxW);
            tx(valLines[0], fx + 3, fy + 5.5); // Single line only for grid cells
        });

        Y += Math.ceil(detailFields.length / 2) * ROW_GAP + 8;

        // ══════════════════════════════════════════════════════════════════
        // 5. BILLING DESCRIPTION TABLE
        // ══════════════════════════════════════════════════════════════════
        // — Section heading
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        tc(C.TEAL_DARK);
        tx('BILLING SUMMARY', MARGIN, Y + 4);
        dc(C.TEAL_DARK);
        doc.setLineWidth(0.4);
        ln(MARGIN, Y + 6, PW - MARGIN, Y + 6);

        Y += 10;

        // — Table header row
        fc(C.TEAL_DARK);
        bx(MARGIN, Y, CW, 9, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        tc(C.WHITE);
        tx('Item / Billing Description', MARGIN + 4, Y + 6);
        tx('Period', MARGIN + 108, Y + 6);
        tx('Amount (\u20B9)', PW - MARGIN - 2, Y + 6, { align: 'right' });

        Y += 9;

        // — Item row
        fc(C.WHITE);
        dc(C.SLATE_300);
        doc.setLineWidth(0.25);
        bx(MARGIN, Y, CW, 16, 'FD');

        // Vertical dividers
        doc.setLineWidth(0.2);
        ln(MARGIN + 104, Y, MARGIN + 104, Y + 16); // col 1 | col 2 divider
        ln(MARGIN + 148, Y, MARGIN + 148, Y + 16); // col 2 | col 3 divider

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        tc(C.SLATE_700);
        tx('Tuition Fees Settled', MARGIN + 4, Y + 6.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        tc(C.SLATE_500);
        tx('(Academic fee payment collected in full)', MARGIN + 4, Y + 12);

        // Period
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        tc(C.TEAL_DARK);
        const periodLines = doc.splitTextToSize(feePeriods, 42);
        doc.text(periodLines.slice(0, 2), MARGIN + 107, Y + 6.5);

        // Amount
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        tc(C.SLATE_900);
        tx(amountDisplay + ' /-', PW - MARGIN - 2, Y + 9, { align: 'right' });

        Y += 16;

        // — Total Amount Paid (highlighted grand-total row)
        fc(C.GREEN_BG);
        dc(C.TEAL_DARK);
        doc.setLineWidth(0.6);
        bx(MARGIN, Y, CW, 12, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        tc(C.TEAL_DARK);
        tx('TOTAL AMOUNT PAID', MARGIN + 4, Y + 7.8);
        doc.setFontSize(12);
        tx(amountDisplay + ' /-', PW - MARGIN - 2, Y + 8.5, { align: 'right' });

        Y += 16;

        // ══════════════════════════════════════════════════════════════════
        // 6. TERMS AND CONDITIONS
        // ══════════════════════════════════════════════════════════════════
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        tc(C.TEAL_DARK);
        tx('TERMS & CONDITIONS', MARGIN, Y + 4);
        dc(C.SLATE_300);
        doc.setLineWidth(0.2);
        ln(MARGIN, Y + 5.5, PW - MARGIN, Y + 5.5);

        Y += 8;

        const terms = [
            '1. This receipt confirms payment received by Babla Yoga Training Center. Fees are non-refundable once submitted.',
            '2. This document serves as official proof of payment and is subject to center guidelines and policies.',
            '3. Any disputes must be raised within 7 days of the payment date with a valid proof of transaction.',
        ];
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        tc(C.SLATE_500);
        terms.forEach(function (line) {
            const wrapped = doc.splitTextToSize(line, CW);
            doc.text(wrapped, MARGIN, Y);
            Y += wrapped.length * 4;
        });

        Y += 4;

        // ══════════════════════════════════════════════════════════════════
        // 7. NOTE SECTION (Administrator Notes Placeholder)
        // ══════════════════════════════════════════════════════════════════
        fc(C.SLATE_100);
        dc(C.SLATE_300);
        doc.setLineWidth(0.2);
        bx(MARGIN, Y, CW, 14, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        tc(C.SLATE_500);
        tx('Note:', MARGIN + 3, Y + 5.5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        tc(C.SLATE_500);
        tx('No additional administrator notes for this transaction.', MARGIN + 14, Y + 5.5);
        doc.setFontSize(7);
        tx('(This field is reserved for optional remarks by the issuing authority.)', MARGIN + 3, Y + 10.5);

        Y += 18;

        // ══════════════════════════════════════════════════════════════════
        // 8. PAYMENT VERIFIED STAMP BADGE
        // ══════════════════════════════════════════════════════════════════
        fc([220, 252, 231]);  // #dcfce7
        dc([134, 239, 172]);  // #86efac
        doc.setLineWidth(0.4);
        bx(MARGIN, Y, 96, 9, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        tc([21, 128, 61]);    // #15803d
        tx('Payment Verified & Recorded', MARGIN + 4, Y + 6.2);

        Y += 13;

        // ══════════════════════════════════════════════════════════════════
        // 9. AUTHORIZATION BLOCK (Signature + Date)
        // ══════════════════════════════════════════════════════════════════
        const SIG_BLOCK_X = PW - MARGIN - 70;
        const SIG_BLOCK_W = 70;
        const SIG_BLOCK_H = 28;

        fc(C.SLATE_100);
        dc(C.SLATE_300);
        doc.setLineWidth(0.2);
        bx(SIG_BLOCK_X, Y, SIG_BLOCK_W, SIG_BLOCK_H, 'FD');

        // Try to embed the owner signature image
        const sigUrl = (window.SystemConfig && window.SystemConfig.OWNER_SIGNATURE_URL) || '';
        let sigEmbedded = false;

        if (sigUrl && sigUrl.trim() !== '') {
            try {
                // addImage accepts data URIs, URL strings (same-origin), or ArrayBuffers.
                // For external URLs we attempt CORS load; if it throws we fall through
                // to the safe styled-line fallback below.
                doc.addImage(sigUrl, 'PNG', SIG_BLOCK_X + 5, Y + 2, 60, 16);
                sigEmbedded = true;
            } catch (imgErr) {
                // Image failed to load — safe fallback will render below
                console.warn('[FeePDFGeneratorModule] Signature image could not be embedded:', imgErr.message);
            }
        }

        if (!sigEmbedded) {
            // Styled signature line fallback
            dc(C.SLATE_700);
            doc.setLineWidth(0.4);
            doc.setLineDash([1, 1]);
            ln(SIG_BLOCK_X + 8, Y + 18, SIG_BLOCK_X + 62, Y + 18);
            doc.setLineDash([]);
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(7);
            tc(C.SLATE_500);
            tx('Authorized Signatory', SIG_BLOCK_X + SIG_BLOCK_W / 2, Y + 15, { align: 'center' });
        }

        // Signatory labels below the image / line
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        tc(C.SLATE_700);
        tx('Authorized Signatory', SIG_BLOCK_X + SIG_BLOCK_W / 2, Y + 22, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        tc(C.SLATE_500);
        tx('Babla Yoga Training Center', SIG_BLOCK_X + SIG_BLOCK_W / 2, Y + 26.5, { align: 'center' });

        // Verification date — left side of the authorization row
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        tc(C.SLATE_500);
        tx('Verified On:', MARGIN, Y + 12);
        doc.setFont('helvetica', 'bold');
        tc(C.SLATE_700);
        tx(dateString, MARGIN, Y + 17);

        Y = Math.max(Y + SIG_BLOCK_H + 6, Y + 40);

        // ══════════════════════════════════════════════════════════════════
        // 10. FOOTER
        // ══════════════════════════════════════════════════════════════════
        const FOOTER_TOP = ph - 26;

        dc(C.SLATE_300);
        doc.setLineWidth(0.3);
        doc.setLineDash([2, 2]);
        ln(MARGIN, FOOTER_TOP, PW - MARGIN, FOOTER_TOP);
        doc.setLineDash([]);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        tc(C.SLATE_500);
        tx(
            'This is an electronically generated receipt verified at application checkout.',
            PW / 2, FOOTER_TOP + 5, { align: 'center' }
        );
        tx(
            'Babla Yoga Training Center  \u00B7  Jagriti More, Maynaguri, Jalpaiguri  \u00B7  Pin-735224',
            PW / 2, FOOTER_TOP + 10, { align: 'center' }
        );
        doc.setFont('helvetica', 'bold');
        tc(C.TEAL_DARK);
        tx('Thank you for joining with us!', PW / 2, FOOTER_TOP + 16, { align: 'center' });

        // ── Subtle developer credit ────────────────────────────────────
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        tc(C.SLATE_300);
        tx(
            'This ERP is designed and engineered by Sohan Adhikari  |  dev contact - sohanadhikari04@gmail.com',
            PW / 2, ph - 3, { align: 'center' }
        );

        return doc;
    }

    // =========================================
    // 📤 PUBLIC FUNCTIONS
    // =========================================

    /**
     * Generates a genuine binary PDF fee receipt and returns it as a
     * volatile Base64 data URI string.
     *
     * Output format:  "data:application/pdf;base64,JVBERi0x..."
     *
     * The backend relay's .split(',').pop() correctly strips the prefix,
     * leaving a clean Base64 PDF binary ready for MIME encoding and
     * email attachment. The full payload is serialized via JSON.stringify()
     * inside UIUtils.fetchFromEngine — no truncation risk.
     *
     * @param {Object} student      - Candidate MasterRecord object
     * @param {Object} summaryData  - { txnId: string, amount: number|string, feePeriods: string }
     * @returns {Promise<string>}   - Resolves to a Base64 data URI or empty string on failure
     */
    async function generateFeePDFBase64(student, summaryData) {
        try {
            const doc = _buildPdfDocument(student, summaryData);
            if (!doc) return '';

            // doc.output('datauristring') returns a genuine PDF binary as:
            //   "data:application/pdf;base64,JVBERi0xLjMK..."
            // The Base64 payload after the comma is real PDF bytes — not HTML —
            // so the email client renders a valid, uncorrupted PDF attachment.
            const dataUriString = doc.output('datauristring');

            return dataUriString;

        } catch (err) {
            console.error('[FeePDFGeneratorModule] generateFeePDFBase64 failed:', err);
            return '';
        }
    }

    /**
     * Triggers an immediate local browser download of the fee receipt PDF.
     * Exposed for use by the Payment Ledger "Download" action button.
     *
     * @param {Object} student      - Candidate MasterRecord object
     * @param {Object} summaryData  - { txnId: string, amount: number|string, feePeriods: string }
     * @returns {Promise<void>}
     */
    async function downloadFeePDF(student, summaryData) {
        try {
            const doc = _buildPdfDocument(student, summaryData);
            if (!doc) {
                if (window.UIUtils) window.UIUtils.showToast('PDF generation failed — jsPDF unavailable.', 'error');
                return;
            }

            const safeName = (student.STUDENT_NAME || 'Student').replace(/[^a-zA-Z0-9]/g, '_');
            const safeTxn = (summaryData.txnId || 'BYTC').replace(/[^a-zA-Z0-9_-]/g, '_');
            doc.save('Fee_Receipt_' + safeName + '_' + safeTxn + '.pdf');

            if (window.UIUtils) window.UIUtils.showToast('\u{1F4E5} PDF receipt downloaded.', 'success');

        } catch (err) {
            console.error('[FeePDFGeneratorModule] downloadFeePDF failed:', err);
            if (window.UIUtils) window.UIUtils.showToast('PDF download failed: ' + err.message, 'error');
        }
    }

    // =========================================
    // 📦 PUBLIC API
    // =========================================
    return {
        generateFeePDFBase64: generateFeePDFBase64,
        downloadFeePDF: downloadFeePDF
    };

})();
