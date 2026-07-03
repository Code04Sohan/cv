/**
 * FEE INVOICE PDF GENERATOR (feePdfGenerator.js) - v3 HTML-table pipeline
 * ====================================================================
 * Produces a genuine binary PDF fee receipt in browser RAM.
 * Uses jsPDF doc.html() to render a rigid HTML-table invoice.
 * All layout bugs from v2 (text collision, footer float) are fixed.
 *
 * Layout guarantees:
 *   - Details table: table-layout:fixed, 4 cols (17%/33%/17%/33%)
 *     Long names wrap in-cell; never bleed into adjacent column
 *   - Billing table: table-layout:fixed, 72% desc / 28% amount
 *     Period text and price column never collide horizontally
 *   - All sections in normal block flow -> footer never overlaps body
 *
 * Public API:
 *   generateFeePDFBase64(student, summaryData) -> Promise<string>
 *   downloadFeePDF(student, summaryData)       -> Promise<void>
 * ====================================================================
 */
window.FeePDFGeneratorModule = (function () {
    'use strict';

    var BRAND = {
        teal:       '#0f766e',
        tealLight:  '#ccfbf1',
        greenBg:    '#f0fdf4',
        greenBdr:   '#bbf7d0',
        greenStamp: '#dcfce7',
        greenText:  '#15803d',
        stampBdr:   '#86efac',
        indigo:     '#4338ca',
        slate900:   '#0f172a',
        slate700:   '#334155',
        slate500:   '#64748b',
        slate400:   '#94a3b8',
        slate200:   '#e2e8f0',
        slate100:   '#f1f5f9',
        white:      '#ffffff',
        emerald:    '#10b981'
    };

    function _esc(v) {
        return String(v || 'N/A')
            .replace(/&/g,  '&amp;')
            .replace(/</g,  '&lt;')
            .replace(/>/g,  '&gt;')
            .replace(/"/g,  '&quot;');
    }

    /**
     * Builds a complete HTML invoice using rigid <table> layout + inline CSS.
     * table-layout:fixed on both tables guarantees column widths are honoured
     * regardless of content length — eliminating all text collision bugs.
     */
    function _buildInvoiceHTML(student, summaryData) {
        var d   = new Date().toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        var amt     = Number(summaryData.amount || 0).toLocaleString('en-IN');
        var sName   = _esc(student.STUDENT_NAME);
        var sId     = _esc(student.STUDENT_ID);
        var sRoll   = _esc(student.RL_NO);
        var sCourse = _esc(student.ENROLLED_COURSE);
        var sTxn    = _esc(summaryData.txnId);
        var sPer    = _esc(summaryData.feePeriods);
        var B       = BRAND;

        var css =
            '* { box-sizing:border-box; margin:0; padding:0; }' +
            'body { font-family:Helvetica Neue,Arial,sans-serif; font-size:12px; color:' + B.slate900 + '; background:' + B.white + '; width:794px; padding:0; margin:0; }' +
            '.page { width:794px; padding:0 0 28px 0; }' +
            /* Header band */
            '.hb { background:' + B.teal + '; padding:22px 32px 18px; text-align:center; width:100%; }' +
            '.hn { font-size:21px; font-weight:900; color:' + B.white + '; margin-bottom:5px; letter-spacing:-0.3px; }' +
            '.hs { font-size:10px; font-weight:700; color:' + B.tealLight + '; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px; }' +
            '.hm { font-size:10px; color:' + B.tealLight + '; margin-bottom:2px; }' +
            /* Body */
            '.bw { padding:18px 32px 0; }' +
            '.tb { background:' + B.greenBg + '; border:1.5px solid ' + B.greenBdr + '; border-radius:6px; text-align:center; padding:8px 0; font-size:13px; font-weight:900; color:' + B.teal + '; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:12px; }' +
            '.dl { text-align:right; font-size:9.5px; color:' + B.slate500 + '; font-weight:600; margin-bottom:10px; }' +
            /* Details table - 4-column fixed layout */
            '.dt { width:100%; border-collapse:collapse; border:1px solid ' + B.slate200 + '; background:' + B.slate100 + '; table-layout:fixed; margin-bottom:16px; }' +
            '.dt td { padding:8px 10px; vertical-align:middle; overflow:hidden; word-break:break-word; }' +
            '.dt tr+tr td { border-top:1px solid ' + B.slate200 + '; }' +
            '.cl { width:17%; } .cv { width:33%; }' +
            '.lbl { font-size:9px; font-weight:700; color:' + B.slate500 + '; text-transform:uppercase; letter-spacing:0.3px; white-space:nowrap; }' +
            '.val { font-size:11px; font-weight:700; color:' + B.slate900 + '; }' +
            '.vt { color:' + B.teal + '; font-size:12px; }' +
            '.vi { color:' + B.indigo + '; font-family:Courier New,monospace; font-size:10px; word-break:break-all; }' +
            '.ve { color:' + B.emerald + '; font-size:11px; letter-spacing:0.5px; }' +
            /* Billing table - 2-column fixed layout */
            '.bt { width:100%; border-collapse:collapse; table-layout:fixed; margin-bottom:0; }' +
            '.bt thead tr { background:' + B.teal + '; }' +
            '.bt th { padding:9px 12px; font-size:9.5px; font-weight:800; color:' + B.white + '; text-transform:uppercase; letter-spacing:0.5px; border:1px solid ' + B.teal + '; }' +
            '.bt .cd { width:72%; text-align:left; } .bt .ca { width:28%; text-align:right; }' +
            '.bt .ir td { padding:12px; border:1px solid ' + B.slate200 + '; background:' + B.white + '; vertical-align:top; }' +
            '.il { font-size:11px; font-weight:500; color:' + B.slate700 + '; margin-bottom:5px; }' +
            '.ip { font-size:12px; font-weight:700; color:' + B.teal + '; word-break:break-word; }' +
            '.ia { font-size:13px; font-weight:800; color:' + B.slate900 + '; font-family:Courier New,monospace; text-align:right; white-space:nowrap; }' +
            /* Total row */
            '.bt .tr td { background:' + B.greenBg + '; border:2px solid ' + B.teal + '; padding:10px 12px; vertical-align:middle; }' +
            '.tl { font-size:11px; font-weight:700; color:' + B.teal + '; text-align:right; padding-right:8px; }' +
            '.ta { font-size:16px; font-weight:900; color:' + B.teal + '; font-family:Courier New,monospace; text-align:right; white-space:nowrap; }' +
            /* Stamp */
            '.sw { margin-top:16px; margin-bottom:16px; }' +
            '.st { display:inline-block; background:' + B.greenStamp + '; border:1.5px solid ' + B.stampBdr + '; border-radius:5px; padding:6px 14px; font-size:11px; font-weight:800; color:' + B.greenText + '; letter-spacing:0.4px; text-transform:uppercase; }' +
            /* Footer */
            '.fd { border:none; border-top:1px dashed ' + B.slate200 + '; margin:0 0 10px 0; }' +
            '.ft { text-align:center; font-size:9.5px; color:' + B.slate400 + '; font-weight:500; line-height:1.7; padding:0 20px; }' +
            '.fh { text-align:center; font-size:11px; font-weight:800; color:' + B.teal + '; margin-top:5px; }';

        return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><style>' + css + '</style></head><body>' +
            '<div class="page">' +
            '<div class="hb">' +
            '<div class="hn">BABLA YOGA TRAINING CENTER</div>' +
            '<div class="hs">Govt. Regd. No. S0032148 of 2021-2022 &nbsp;|&nbsp; Estd: 2015</div>' +
            '<div class="hm">Jagriti More, Maynaguri, Jalpaiguri, West Bengal &nbsp;&#183;&nbsp; Pin-735224</div>' +
            '<div class="hm">Email: bablayogatrainingcenter@gmail.com &nbsp;|&nbsp; Cont: 7076280550 / 8158027894</div>' +
            '</div>' +
            '<div class="bw">' +
            '<div class="tb">&#128203; Official Fee Payment Receipt</div>' +
            '<div class="dl">Receipt Generated: ' + d + '</div>' +
            '<table class="dt"><colgroup><col class="cl"><col class="cv"><col class="cl"><col class="cv"></colgroup><tbody>' +
            '<tr>' +
            '<td class="cl"><span class="lbl">Student Name</span></td>' +
            '<td class="cv"><span class="val vt">' + sName + '</span></td>' +
            '<td class="cl"><span class="lbl">Transaction ID</span></td>' +
            '<td class="cv"><span class="val vi">' + sTxn + '</span></td>' +
            '</tr><tr>' +
            '<td class="cl"><span class="lbl">Student ID</span></td>' +
            '<td class="cv"><span class="val">' + sId + '</span></td>' +
            '<td class="cl"><span class="lbl">Payment Date</span></td>' +
            '<td class="cv"><span class="val">' + d + '</span></td>' +
            '</tr><tr>' +
            '<td class="cl"><span class="lbl">Roll Number</span></td>' +
            '<td class="cv"><span class="val">' + sRoll + '</span></td>' +
            '<td class="cl"><span class="lbl">Class / Batch</span></td>' +
            '<td class="cv"><span class="val">' + sCourse + '</span></td>' +
            '</tr><tr>' +
            '<td class="cl"><span class="lbl">Payment Status</span></td>' +
            '<td colspan="3"><span class="val ve">&#10003; SUCCESSFUL / PAID</span></td>' +
            '</tr></tbody></table>' +
            '<table class="bt"><colgroup><col style="width:72%"><col style="width:28%"></colgroup>' +
            '<thead><tr><th class="cd">Billing Ledger Item Description</th><th class="ca">Amount (INR)</th></tr></thead>' +
            '<tbody>' +
            '<tr class="ir">' +
            '<td><div class="il">Tuition Fees Settled for Billing Period(s):</div><div class="ip">' + sPer + '</div></td>' +
            '<td style="text-align:right;vertical-align:middle;"><span class="ia">&#x20B9;&nbsp;' + amt + '.00</span></td>' +
            '</tr>' +
            '<tr class="tr"><td class="tl">Net Settled Balance:</td><td class="ta">&#x20B9;&nbsp;' + amt + '.00</td></tr>' +
            '</tbody></table>' +
            '<div class="sw"><span class="st">&#9989; Payment Verified &amp; Recorded</span></div>' +
            '<hr class="fd">' +
            '<div class="ft">This is an electronically generated receipt verified at application checkout interface.<br>' +
            'Babla Yoga Training Center &nbsp;&#183;&nbsp; Jagriti More, Maynaguri, Jalpaiguri &nbsp;&#183;&nbsp; Pin-735224</div>' +
            '<div class="fh">Thank you for studying with us! &#x1F64F;</div>' +
            '</div></div></body></html>';
    }

    /**
     * Renders the HTML invoice via jsPDF doc.html() -> html2canvas bridge.
     * Returns Promise<jsPDF|null>.
     *
     * doc.html() delegates layout to the browser CSS engine — the same
     * engine used by the ERP UI — giving pixel-accurate, collision-free
     * output without any manual Y-coordinate arithmetic.
     */
    function _buildPdfDocument(student, summaryData) {
        return new Promise(function(resolve) {
            if (!window.jspdf || !window.jspdf.jsPDF) {
                console.error('[FeePDFGeneratorModule] jsPDF library is not loaded.');
                return resolve(null);
            }
            var jsPDF = window.jspdf.jsPDF;
            var doc = new jsPDF({ orientation:'portrait', unit:'px', format:'a4', hotfixes:['px_scaling'] });
            var container = document.createElement('div');
            container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;z-index:-1;pointer-events:none;';
            container.innerHTML = _buildInvoiceHTML(student, summaryData);
            document.body.appendChild(container);
            doc.html(container, {
                callback: function(pdfDoc) {
                    try { document.body.removeChild(container); } catch(_) {}
                    resolve(pdfDoc);
                },
                x: 0, y: 0,
                width: 794,
                windowWidth: 794,
                margin: [0, 0, 0, 0],
                autoPaging: 'text'
            });
        });
    }

    /**
     * Generates a genuine binary PDF fee receipt and returns it as a volatile
     * Base64 data URI: "data:application/pdf;base64,JVBERi0x..."
     *
     * Backend relay's .split(',').pop() strips the prefix correctly.
     * Payload serialised via JSON.stringify() in UIUtils.fetchFromEngine.
     *
     * @param {Object} student     - Candidate MasterRecord
     * @param {Object} summaryData - { txnId, amount, feePeriods }
     * @returns {Promise<string>}
     */
    async function generateFeePDFBase64(student, summaryData) {
        try {
            var doc = await _buildPdfDocument(student, summaryData);
            if (!doc) return '';
            return doc.output('datauristring');
        } catch(err) {
            console.error('[FeePDFGeneratorModule] generateFeePDFBase64 failed:', err);
            return '';
        }
    }

    /**
     * Triggers an immediate browser download of the fee receipt PDF.
     * Exposed for the Payment Ledger "Download" action button.
     *
     * @param {Object} student     - Candidate MasterRecord
     * @param {Object} summaryData - { txnId, amount, feePeriods }
     * @returns {Promise<void>}
     */
    async function downloadFeePDF(student, summaryData) {
        try {
            if (window.UIUtils) window.UIUtils.showToast('Generating PDF receipt...', 'info');
            var doc = await _buildPdfDocument(student, summaryData);
            if (!doc) {
                if (window.UIUtils) window.UIUtils.showToast('PDF generation failed — jsPDF unavailable.', 'error');
                return;
            }
            var safeName = (student.STUDENT_NAME || 'Student').replace(/[^a-zA-Z0-9]/g, '_');
            var safeTxn  = (summaryData.txnId || 'BYTC').replace(/[^a-zA-Z0-9_-]/g, '_');
            doc.save('Fee_Receipt_' + safeName + '_' + safeTxn + '.pdf');
            if (window.UIUtils) window.UIUtils.showToast('\uD83D\uDCE5 PDF receipt downloaded.', 'success');
        } catch(err) {
            console.error('[FeePDFGeneratorModule] downloadFeePDF failed:', err);
            if (window.UIUtils) window.UIUtils.showToast('PDF download failed: ' + err.message, 'error');
        }
    }

    return {
        generateFeePDFBase64: generateFeePDFBase64,
        downloadFeePDF: downloadFeePDF
    };

})();
