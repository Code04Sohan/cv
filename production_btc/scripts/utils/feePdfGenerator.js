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
        TEAL_DARK:  [15,  118, 110],  // #0f766e — primary brand
        SLATE_900:  [15,   23,  42],  // #0f172a
        SLATE_700:  [51,   65,  85],  // #334155
        SLATE_500:  [100, 116, 139],  // #64748b
        SLATE_300:  [203, 213, 225],  // #cbd5e1
        SLATE_100:  [241, 245, 249],  // #f1f5f9
        WHITE:      [255, 255, 255],
        EMERALD:    [16,  185, 129],  // #10b981
        INDIGO:     [67,   56, 202],  // #4338ca
        GREEN_BG:   [240, 253, 244],  // #f0fdf4
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

        const PW     = 210;           // A4 page width mm
        const MARGIN = 15;
        const CW     = PW - MARGIN * 2;
        let   Y      = MARGIN;

        // ── Shorthand helpers ───────────────────────────────────────────
        const tc  = (rgb)            => doc.setTextColor(rgb[0], rgb[1], rgb[2]);
        const fc  = (rgb)            => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
        const dc  = (rgb)            => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
        const ln  = (x1,y1,x2,y2)   => doc.line(x1, y1, x2, y2);
        const bx  = (x,y,w,h,style) => doc.rect(x, y, w, h, style);
        const tx  = (str, x, y, o)  => doc.text(String(str || ''), x, y, o || {});
        const ph  = doc.internal.pageSize.height;

        // ── 1. HEADER BAND ─────────────────────────────────────────────
        fc(C.TEAL_DARK);
        bx(0, 0, PW, 33, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(17);
        tc(C.WHITE);
        tx('BABLA YOGA TRAINING CENTER', PW / 2, Y + 9, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        tc(C.HEADER_SUB);
        tx('Govt. Regd. No. S0032148 of 2021-2022 | Estd: 2015', PW / 2, Y + 15, { align: 'center' });
        tx('Jagriti More, Maynaguri, Jalpaiguri, West Bengal - Pin 735224', PW / 2, Y + 20, { align: 'center' });
        tx('Email: bablayogatrainingcenter@gmail.com  |  Cont: 7076280550 / 8158027894', PW / 2, Y + 26, { align: 'center' });

        Y = 39;

        // ── 2. RECEIPT TITLE BADGE ─────────────────────────────────────
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        fc(C.GREEN_BG);
        dc(C.TEAL_DARK);
        doc.setLineWidth(0.5);
        bx(MARGIN, Y, CW, 10, 'FD');
        tc(C.TEAL_DARK);
        tx('OFFICIAL FEE PAYMENT RECEIPT', PW / 2, Y + 6.8, { align: 'center' });

        Y += 15;

        // ── 3. RECEIPT DATE (right-aligned) ────────────────────────────
        const dateString = new Date().toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        tc(C.SLATE_500);
        tx('Receipt Generated: ' + dateString, PW - MARGIN, Y, { align: 'right' });

        Y += 6;

        // ── 4. STUDENT & TRANSACTION DETAILS GRID ─────────────────────
        const COL1_LX = MARGIN + 2;
        const COL1_VX = MARGIN + 38;
        const COL2_LX = PW / 2 + 2;
        const COL2_VX = PW / 2 + 40;
        const ROW_H   = 8;
        const GRID_H  = ROW_H * 4 + 4;

        fc(C.SLATE_100);
        dc(C.SLATE_300);
        doc.setLineWidth(0.3);
        bx(MARGIN, Y, CW, GRID_H, 'FD');

        const detailRows = [
            { l1: 'Student Name',   v1: student.STUDENT_NAME    || 'N/A', l2: 'Transaction ID', v2: summaryData.txnId || 'N/A', v1teal: true,   v2indigo: true },
            { l1: 'Student ID',     v1: student.STUDENT_ID      || 'N/A', l2: 'Payment Date',   v2: dateString,                v1teal: false,  v2indigo: false },
            { l1: 'Roll Number',    v1: student.RL_NO           || 'N/A', l2: 'Class / Batch',  v2: student.ENROLLED_COURSE || 'N/A', v1teal: false, v2indigo: false },
            { l1: 'Payment Status', v1: 'SUCCESSFUL / PAID',               l2: '',               v2: '',                        v1emerald: true },
        ];

        let rowY = Y + ROW_H - 1.5;
        detailRows.forEach(function(row, idx) {
            if (idx > 0) {
                dc(C.SLATE_300);
                doc.setLineWidth(0.2);
                ln(MARGIN, rowY - ROW_H + 1.5, MARGIN + CW, rowY - ROW_H + 1.5);
            }

            // Label 1
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            tc(C.SLATE_500);
            tx(row.l1 + ':', COL1_LX, rowY);

            // Value 1
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(row.l1 === 'Student Name' ? 10 : 9);
            tc(row.v1emerald ? C.EMERALD : row.v1teal ? C.TEAL_DARK : C.SLATE_900);
            tx(row.v1, COL1_VX, rowY);

            // Label 2
            if (row.l2) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7.5);
                tc(C.SLATE_500);
                tx(row.l2 + ':', COL2_LX, rowY);

                // Value 2
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(9);
                tc(row.v2indigo ? C.INDIGO : C.SLATE_900);
                tx(row.v2, COL2_VX, rowY);
            }

            rowY += ROW_H;
        });

        Y += GRID_H + 8;

        // ── 5. BILLING LINE ITEM TABLE ─────────────────────────────────
        const amountDisplay = Number(summaryData.amount || 0).toLocaleString('en-IN');
        const TABLE_H       = 10;

        // Header row
        fc(C.TEAL_DARK);
        dc(C.TEAL_DARK);
        doc.setLineWidth(0.3);
        bx(MARGIN, Y, CW, TABLE_H, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        tc(C.WHITE);
        tx('BILLING LEDGER ITEM DESCRIPTION', MARGIN + 4, Y + 6.8);
        tx('AMOUNT (INR)', PW - MARGIN - 2, Y + 6.8, { align: 'right' });

        Y += TABLE_H;

        // Item row — white background with border
        fc(C.WHITE);
        dc(C.SLATE_300);
        doc.setLineWidth(0.3);
        bx(MARGIN, Y, CW, 15, 'FD');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        tc(C.SLATE_700);
        tx('Tuition Fees Settled for Billing Period(s):', MARGIN + 4, Y + 6);

        doc.setFont('helvetica', 'bold');
        tc(C.TEAL_DARK);
        // Wrap fee periods if too long
        const periodLines = doc.splitTextToSize(summaryData.feePeriods || 'N/A', CW - 50);
        doc.text(periodLines, MARGIN + 4, Y + 11);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        tc(C.SLATE_900);
        tx('\u20B9 ' + amountDisplay + '.00', PW - MARGIN - 2, Y + 9, { align: 'right' });

        Y += 15;

        // Grand total row
        fc(C.GREEN_BG);
        dc(C.TEAL_DARK);
        doc.setLineWidth(0.7);
        bx(MARGIN, Y, CW, 12, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        tc(C.TEAL_DARK);
        tx('Net Settled Balance:', PW - MARGIN - 45, Y + 7.5);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        tx('\u20B9 ' + amountDisplay + '.00', PW - MARGIN - 2, Y + 8, { align: 'right' });

        Y += 18;

        // ── 6. VERIFIED PAYMENT STAMP ──────────────────────────────────
        fc([220, 252, 231]); // #dcfce7
        dc([134, 239, 172]); // #86efac
        doc.setLineWidth(0.4);
        bx(MARGIN, Y, 84, 9, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        tc([21, 128, 61]); // #15803d
        tx('\u2705 Payment Verified & Recorded', MARGIN + 4, Y + 6);

        // ── 7. FOOTER ──────────────────────────────────────────────────
        dc(C.SLATE_300);
        doc.setLineWidth(0.3);
        doc.setLineDash([2, 2]);
        ln(MARGIN, ph - 22, PW - MARGIN, ph - 22);
        doc.setLineDash([]);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        tc(C.SLATE_500);
        tx('This is an electronically generated receipt verified at application checkout.', PW / 2, ph - 17, { align: 'center' });
        tx('Babla Yoga Training Center \u00B7 Jagriti More, Maynaguri, Jalpaiguri \u00B7 Pin-735224', PW / 2, ph - 12, { align: 'center' });

        doc.setFont('helvetica', 'bold');
        tc(C.TEAL_DARK);
        tx('Thank you for studying with us!', PW / 2, ph - 7, { align: 'center' });

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
            const safeTxn  = (summaryData.txnId || 'BYTC').replace(/[^a-zA-Z0-9_-]/g, '_');
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
