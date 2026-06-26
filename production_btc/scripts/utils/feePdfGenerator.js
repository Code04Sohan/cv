/**
 * ====================================================================
 * 🖨️ FEE INVOICE PDF GENERATOR (feePdfGenerator.js)
 * ====================================================================
 * Compiles high-fidelity, standalone electronic payment receipt layouts
 * at runtime entirely inside browser RAM.
 *
 * Architecture:
 *   - Renders a styled HTML invoice string (no external assets)
 *   - Encodes via btoa(unescape(encodeURIComponent(html))) to handle
 *     full Unicode safely without escape characters
 *   - Returns a volatile Base64 data URI string — never saved to Drive
 *   - Caller (NotificationUtils.dispatchFeeNotification) is responsible
 *     for immediately passing the string to the email relay and dropping
 *     the reference from scope
 *
 * Exposed as: window.FeePDFGeneratorModule
 *
 * Public API:
 *   generateFeePDFBase64(student, summaryData) → Promise<string>
 *
 * summaryData shape:
 *   { txnId: string, amount: number|string, feePeriods: string }
 * ====================================================================
 */
window.FeePDFGeneratorModule = (function () {
    'use strict';

    /**
     * Compiles a high-contrast, institutionally branded fee receipt as a
     * volatile Base64-encoded HTML data URI.
     *
     * The receipt is rendered from a pure HTML/CSS template — no jsPDF,
     * no image assets, no external CDN calls. This keeps the compile time
     * under ~50ms and avoids any CORS fetch phase.
     *
     * @param {Object} student      - Candidate MasterRecord object
     * @param {Object} summaryData  - { txnId: string, amount: number|string, feePeriods: string }
     * @returns {Promise<string>}   - Resolves to a Base64 data URI string or empty string on failure
     */
    async function generateFeePDFBase64(student, summaryData) {
        try {
            const dateString = new Date().toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const amountDisplay = Number(summaryData.amount || 0).toLocaleString('en-IN');

            const rawHtmlInvoice = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: #1e293b;
      padding: 35px;
      line-height: 1.5;
      font-size: 13px;
      background: #ffffff;
    }

    /* ── HEADER ── */
    .receipt-header {
      text-align: center;
      border-bottom: 3px double #0f766e;
      padding-bottom: 14px;
      margin-bottom: 22px;
    }
    .org-title {
      font-size: 26px;
      font-weight: 900;
      color: #0f766e;
      margin: 0 0 4px 0;
      letter-spacing: -0.5px;
    }
    .org-sub {
      font-size: 11px;
      font-weight: 700;
      color: #475569;
      margin: 5px 0 2px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .org-meta {
      font-size: 11px;
      color: #64748b;
      margin: 2px 0;
      font-weight: 500;
    }

    /* ── TITLE BADGE ── */
    .title-badge {
      display: block;
      margin: 20px 0 18px 0;
      text-align: center;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 800;
      color: #0f766e;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }

    /* ── STUDENT DETAILS GRID ── */
    .details-grid {
      width: 100%;
      margin-bottom: 22px;
      border-collapse: collapse;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }
    .details-grid td {
      padding: 7px 12px;
      vertical-align: top;
    }
    .details-grid tr:not(:last-child) td {
      border-bottom: 1px solid #e2e8f0;
    }
    .field-lbl {
      color: #64748b;
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      width: 22%;
    }
    .field-val {
      color: #1e293b;
      font-weight: 700;
      width: 28%;
    }

    /* ── INVOICE LINE TABLE ── */
    .invoice-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    .invoice-table th {
      background: #0f766e;
      color: #ffffff;
      padding: 10px 12px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      border: 1px solid #0f766e;
    }
    .invoice-table td {
      padding: 13px 12px;
      border-bottom: 1px solid #e2e8f0;
      border-left: 1px solid #e2e8f0;
      border-right: 1px solid #e2e8f0;
      font-weight: 500;
      color: #334155;
    }
    .grand-total-row td {
      background: #f0fdf4;
      font-weight: 800;
      color: #0f766e;
      font-size: 14px;
      border-top: 2px solid #0f766e;
    }

    /* ── STATUS STAMP ── */
    .status-stamp {
      display: inline-block;
      margin-top: 20px;
      padding: 6px 14px;
      background: #dcfce7;
      border: 1.5px solid #86efac;
      border-radius: 6px;
      color: #15803d;
      font-weight: 800;
      font-size: 12px;
      letter-spacing: 0.4px;
      text-transform: uppercase;
    }

    /* ── FOOTER ── */
    .receipt-footer {
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
      margin-top: 50px;
      border-top: 1px dashed #e2e8f0;
      padding-top: 15px;
      font-weight: 600;
    }
  </style>
</head>
<body>

  <!-- INSTITUTIONAL HEADER -->
  <div class="receipt-header">
    <div class="org-title">BABLA YOGA TRAINING CENTER</div>
    <div class="org-sub">Govt. Regd. No. S0032148 of 2021-2022 | Estd: 2015</div>
    <div class="org-meta">Address: Jagriti More, Maynaguri, Jalpaiguri, West Bengal, Pin-735224</div>
    <div class="org-meta">Email: bablayogatrainingcenter@gmail.com</div>
    <div class="org-meta">Cont. 7076280550 (Call/Wp), 8158027894 (Call)</div>
  </div>

  <!-- DOCUMENT TITLE -->
  <div class="title-badge">Official Fee Payment Receipt</div>

  <!-- STUDENT & TRANSACTION DETAILS -->
  <table class="details-grid">
    <tr>
      <td class="field-lbl">Student Name</td>
      <td class="field-val" style="font-size:14px;color:#0f766e;">${student.STUDENT_NAME || 'N/A'}</td>
      <td class="field-lbl">Transaction ID</td>
      <td class="field-val" style="font-family:monospace;color:#4338ca;letter-spacing:0.03em;">${summaryData.txnId || 'N/A'}</td>
    </tr>
    <tr>
      <td class="field-lbl">Student ID</td>
      <td class="field-val">${student.STUDENT_ID || 'N/A'}</td>
      <td class="field-lbl">Payment Date</td>
      <td class="field-val">${dateString}</td>
    </tr>
    <tr>
      <td class="field-lbl">Roll Number</td>
      <td class="field-val">${student.RL_NO || 'N/A'}</td>
      <td class="field-lbl">Class / Batch</td>
      <td class="field-val">${student.ENROLLED_COURSE || 'N/A'}</td>
    </tr>
    <tr>
      <td class="field-lbl">Payment Status</td>
      <td class="field-val" style="color:#10b981;" colspan="3">SUCCESSFUL / PAID</td>
    </tr>
  </table>

  <!-- BILLING LINE ITEM TABLE -->
  <table class="invoice-table">
    <thead>
      <tr>
        <th style="text-align:left;width:75%;">Billing Ledger Item Description</th>
        <th style="text-align:right;width:25%;">Amount (INR)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="font-weight:600;">
          Tuition Fees Settled for Billing Period(s):
          <span style="color:#0f766e;font-weight:700;">${summaryData.feePeriods || 'N/A'}</span>
        </td>
        <td style="text-align:right;font-weight:700;font-family:monospace;">
          ₹ ${amountDisplay}.00
        </td>
      </tr>
      <tr class="grand-total-row">
        <td style="text-align:right;padding-right:20px;">Net Settled Balance:</td>
        <td style="text-align:right;font-family:monospace;">₹ ${amountDisplay}.00</td>
      </tr>
    </tbody>
  </table>

  <!-- PAYMENT VERIFIED STAMP -->
  <div style="margin-top:18px;">
    <span class="status-stamp">✅ Payment Verified &amp; Recorded</span>
  </div>

  <!-- FOOTER -->
  <div class="receipt-footer">
    This is an electronically generated receipt verified at application checkout interface.<br>
    Babla Yoga Training Center · Jagriti More, Maynaguri, Jalpaiguri · Pin-735224<br>
    Thank you for studying with us! 🙏
  </div>

</body>
</html>`;

            // ── VOLATILE BASE64 ENCODING ──────────────────────────────────
            // btoa(unescape(encodeURIComponent(str))) handles full Unicode
            // safely without inserting any escape backslashes.
            // The resulting string is returned to the caller and is never
            // stored in any module-level variable — it lives only in the
            // call stack until the email relay consumes it.
            const base64Encoded = btoa(unescape(encodeURIComponent(rawHtmlInvoice)));

            return 'data:application/pdf;base64,' + base64Encoded;

        } catch (err) {
            console.error('[FeePDFGeneratorModule] generateFeePDFBase64 failed:', err);
            return '';
        }
    }

    // =========================================
    // 📦 PUBLIC API
    // =========================================
    return {
        generateFeePDFBase64: generateFeePDFBase64
    };

})();
