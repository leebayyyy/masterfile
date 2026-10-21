const reportsUrl = "api/reports.php";

document.addEventListener("DOMContentLoaded", () => {
  const dateInput = document.getElementById("report-date");
  dateInput.value = localDateString(new Date());
  dateInput.addEventListener("change", loadReport);
  loadReport();
});

const localDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[character]));

let reportSalesSortDir = "desc";
let reportInvoiceSortDir = "desc";
let cachedReportData = null;

const loadReport = async () => {
  const reportDiv = document.getElementById("report-content");
  reportDiv.innerHTML = '<div class="text-muted">Loading report...</div>';
  try {
    const { data } = await axios.get(reportsUrl, {
      params: { operation: "summary", date: document.getElementById("report-date").value },
      withCredentials: true,
    });
    cachedReportData = data;
    renderReport(data);
  } catch (error) {
    console.error(error);
    reportDiv.innerHTML = `<div class="alert alert-danger">${error.response?.data?.message || "Unable to load reports."}</div>`;
  }
};

const renderReport = (data) => {
  if (!data) return;
  const dateLabel = new Date(`${data.date}T00:00:00`).toLocaleDateString();
  document.getElementById("report-date-label").textContent = dateLabel;
  document.getElementById("report-cards").innerHTML = `
    <div class="col-md-4 col-lg-4">
      <div class="card p-3 h-100 shadow-sm border-0 report-card">
        <div class="text-muted small fw-semibold text-uppercase mb-2">Sales on ${dateLabel}</div>
        <div class="h5 fw-bold text-dark mb-2">${data.sales.count} transactions</div>
        <div class="d-flex flex-column gap-1 text-secondary small pt-2 border-top">
          <div>Total: <strong class="text-dark">₱${Number(data.sales.total).toFixed(2)}</strong></div>
          <div>Tax: <strong class="text-dark">₱${Number(data.sales.tax).toFixed(2)}</strong></div>
        </div>
      </div>
    </div>
    <div class="col-md-4 col-lg-4">
      <div class="card p-3 h-100 shadow-sm border-0 report-card">
        <div class="text-muted small fw-semibold text-uppercase mb-2">Outstanding AR</div>
        <div class="h5 fw-bold text-dark mb-2">${data.ar.invoices} invoices</div>
        <div class="d-flex flex-column gap-1 text-secondary small pt-2 border-top">
          <div>Balance: <strong class="text-dark">₱${Number(data.ar.outstanding).toFixed(2)}</strong></div>
        </div>
      </div>
    </div>
    <div class="col-md-4 col-lg-4">
      <div class="card p-3 h-100 shadow-sm border-0 report-card">
        <div class="text-muted small fw-semibold text-uppercase mb-2">Credit Sales Invoiced</div>
        <div class="h5 fw-bold text-dark mb-2">${data.ar.pending_sales} sales</div>
        <div class="d-flex flex-column gap-1 text-secondary small pt-2 border-top">
          <div>Total: <strong class="text-dark">₱${Number(data.ar.pending_sales_total).toFixed(2)}</strong></div>
        </div>
      </div>
    </div>
    <div class="col-md-4 col-lg-4">
      <div class="card p-3 h-100 shadow-sm border-danger border-2 report-card">
        <div class="text-danger small fw-semibold text-uppercase mb-2">Overdue Collections</div>
        <div class="h5 fw-bold text-danger mb-2">${data.ar.overdue_invoices} invoices</div>
        <div class="d-flex flex-column gap-1 text-secondary small pt-2 border-top">
          <div>Balance: <strong class="text-danger">₱${Number(data.ar.overdue_balance).toFixed(2)}</strong></div>
        </div>
      </div>
    </div>
    <div class="col-md-4 col-lg-4">
      <div class="card p-3 h-100 shadow-sm border-0 report-card">
        <div class="text-muted small fw-semibold text-uppercase mb-2">Total Collections</div>
        <div class="h5 fw-bold text-dark mb-2">${data.payments.count} payments</div>
        <div class="d-flex flex-column gap-1 text-secondary small pt-2 border-top">
          <div>Total: <strong class="text-dark">₱${Number(data.payments.total).toFixed(2)}</strong></div>
        </div>
      </div>
    </div>
    <div class="col-md-4 col-lg-4">
      <div class="card p-3 h-100 shadow-sm border-0 report-card">
        <div class="text-muted small fw-semibold text-uppercase mb-2">Active Registers</div>
        <div class="h5 fw-bold text-dark mb-2">${data.terminalSales.length} terminals</div>
        <div class="d-flex flex-column gap-1 text-secondary small pt-2 border-top">
          <div>System status: <strong class="text-success">Operational</strong></div>
        </div>
      </div>
    </div>`;

  const sortedSales = [...(data.dailySales || [])].sort((a, b) => {
    const idA = Number(a.sale_id || 0);
    const idB = Number(b.sale_id || 0);
    return reportSalesSortDir === "desc" ? idB - idA : idA - idB;
  });

  const salesRows = sortedSales.map((sale) => `
    <tr>
      <td class="font-monospace fw-bold">#${sale.sale_id}</td>
      <td><span class="badge ${sale.sale_type === 'AR' ? 'bg-warning text-dark' : 'bg-success'}">${sale.sale_type || "Cash"}</span></td>
      <td>${escapeHtml(sale.cashier)}</td>
      <td>${escapeHtml(sale.customer_name || "Walk-in")}</td>
      <td>${escapeHtml(sale.terminal_name)}</td>
      <td>${escapeHtml(sale.payment_method || (sale.sale_type === "AR" ? "AR Credit" : "Cash"))}</td>
      <td class="text-end fw-bold">₱${Number(sale.total_amount || 0).toFixed(2)}</td>
    </tr>`).join("");

  const terminalRows = (data.terminalSales || []).map((terminal) => `
    <tr>
      <td class="fw-semibold">${escapeHtml(terminal.terminal_name)}</td>
      <td class="text-center">${terminal.sale_count}</td>
      <td class="text-end fw-bold">₱${Number(terminal.sales_total || 0).toFixed(2)}</td>
    </tr>`).join("");

  const sortedInvoices = [...(data.invoices || [])].sort((a, b) => {
    const idA = Number(a.ar_invoice_id || 0);
    const idB = Number(b.ar_invoice_id || 0);
    return reportInvoiceSortDir === "desc" ? idB - idA : idA - idB;
  });

  const invoiceRows = sortedInvoices.map((invoice) => `
    <tr>
      <td class="font-monospace fw-bold">${invoice.invoice_number || `Invoice #${invoice.ar_invoice_id}`}</td>
      <td>${escapeHtml(invoice.customer_name)}</td>
      <td>${escapeHtml(invoice.invoice_date || "")}</td>
      <td class="font-monospace">${escapeHtml(invoice.due_date || "")}</td>
      <td class="text-end">₱${Number(invoice.invoice_amount || 0).toFixed(2)}</td>
      <td class="text-end fw-bold">₱${Number(invoice.balance || 0).toFixed(2)}</td>
      <td><span class="badge bg-secondary">${escapeHtml(invoice.status)}</span></td>
      <td>${invoice.collection_status === "Overdue"
        ? `<span class="badge bg-danger">Overdue — ${invoice.days_overdue} days</span>`
        : invoice.collection_status === "Due today"
          ? '<span class="badge bg-warning text-dark">Due today</span>'
          : '<span class="badge bg-primary">Current</span>'}</td>
    </tr>`).join("");

  const customerRows = (data.customerBalances || []).map((customer) => `
    <tr>
      <td class="fw-semibold">${escapeHtml(customer.customer_name)}</td>
      <td class="text-center">${customer.open_invoice_count}</td>
      <td class="text-end">₱${Number(customer.invoice_balance).toFixed(2)}</td>
      <td class="text-center">${customer.pending_sale_count}</td>
      <td class="text-end">₱${Number(customer.pending_balance).toFixed(2)}</td>
      <td class="text-end fw-bold">₱${Number(customer.total_balance).toFixed(2)}</td>
      <td class="text-end">₱${Number(customer.credit_limit).toFixed(2)}</td>
      <td class="text-end text-success fw-semibold">₱${Number(customer.available_credit).toFixed(2)}</td>
    </tr>`).join("");

  const paymentRows = (data.dailyPayments || []).map((payment) => `
    <tr>
      <td class="font-monospace fw-semibold">${escapeHtml(payment.reference_number || "—")}</td>
      <td class="font-monospace">${escapeHtml(payment.invoice_number || "—")}</td>
      <td>${escapeHtml(payment.customer_name)}</td>
      <td>${escapeHtml(payment.processed_by)}</td>
      <td>${escapeHtml(payment.method_name)}</td>
      <td class="text-end fw-bold text-success">₱${Number(payment.amount || 0).toFixed(2)}</td>
      <td><span class="badge bg-info text-dark">${escapeHtml(payment.invoice_status || "")}</span></td>
      <td class="text-end">₱${Number(payment.invoice_balance || 0).toFixed(2)}</td>
    </tr>`).join("");

  document.getElementById("report-content").innerHTML = `
    <section class="card shadow-sm border-0 p-3 mb-4">
      <h2 class="h5 fw-bold text-dark pb-2 mb-3 border-bottom">Sales by Cashier — ${dateLabel}</h2>
      <div class="table-responsive">
        <table class="table table-hover table-striped align-middle mb-0">
          <thead>
            <tr>
              <th id="th-rep-sale-id" style="cursor: pointer; user-select: none;" title="Click to sort by Sale ID">
                Sale <span class="sort-icon">${reportSalesSortDir === "desc" ? "▼" : "▲"}</span>
              </th>
              <th>Type</th>
              <th>Cashier</th>
              <th>Customer</th>
              <th>Terminal</th>
              <th>Payment Method</th>
              <th class="text-end">Total</th>
            </tr>
          </thead>
          <tbody>${salesRows || '<tr><td colspan="7" class="text-center text-muted py-3">No sales recorded for this date.</td></tr>'}</tbody>
        </table>
      </div>
    </section>

    <section class="card shadow-sm border-0 p-3 mb-4">
      <h2 class="h5 fw-bold text-dark pb-2 mb-3 border-bottom">Sales by POS Terminal — ${dateLabel}</h2>
      <div class="table-responsive">
        <table class="table table-hover table-striped align-middle mb-0">
          <thead><tr><th>Terminal</th><th class="text-center">Transactions</th><th class="text-end">Sales Total</th></tr></thead>
          <tbody>${terminalRows || '<tr><td colspan="3" class="text-center text-muted py-3">No POS terminals configured.</td></tr>'}</tbody>
        </table>
      </div>
    </section>

    <section class="card shadow-sm border-0 p-3 mb-4">
      <h2 class="h5 fw-bold text-dark pb-2 mb-3 border-bottom">Customer Credit Exposure</h2>
      <div class="table-responsive">
        <table class="table table-hover table-striped align-middle mb-0">
          <thead><tr><th>Customer</th><th class="text-center">Open Invoices</th><th class="text-end">Invoice Balance</th><th class="text-center">Pending Sales</th><th class="text-end">Pending Total</th><th class="text-end">Total Outstanding</th><th class="text-end">Credit Limit</th><th class="text-end">Available Credit</th></tr></thead>
          <tbody>${customerRows || '<tr><td colspan="8" class="text-center text-muted py-3">No outstanding balances or approved credit limits.</td></tr>'}</tbody>
        </table>
      </div>
    </section>

    <section class="card shadow-sm border-0 p-3 mb-4">
      <h2 class="h5 fw-bold text-dark pb-2 mb-3 border-bottom">Outstanding Invoices and Collection Follow-up</h2>
      <div class="table-responsive">
        <table class="table table-hover table-striped align-middle mb-0">
          <thead>
            <tr>
              <th id="th-rep-invoice-id" style="cursor: pointer; user-select: none;" title="Click to sort by Invoice ID">
                Invoice <span class="sort-icon">${reportInvoiceSortDir === "desc" ? "▼" : "▲"}</span>
              </th>
              <th>Customer</th>
              <th>Invoice Date</th>
              <th>Due Date</th>
              <th class="text-end">Total</th>
              <th class="text-end">Balance</th>
              <th>Invoice Status</th>
              <th>Collection Status</th>
            </tr>
          </thead>
          <tbody>${invoiceRows || '<tr><td colspan="8" class="text-center text-muted py-3">No outstanding invoices.</td></tr>'}</tbody>
        </table>
      </div>
    </section>

    <section class="card shadow-sm border-0 p-3 mb-4">
      <h2 class="h5 fw-bold text-dark pb-2 mb-3 border-bottom">Payments Recorded — ${dateLabel}</h2>
      <div class="table-responsive">
        <table class="table table-hover table-striped align-middle mb-0">
          <thead><tr><th>Reference</th><th>Invoice</th><th>Customer</th><th>Processed By</th><th>Method</th><th class="text-end">Amount</th><th>Invoice Status</th><th class="text-end">Remaining Balance</th></tr></thead>
          <tbody>${paymentRows || '<tr><td colspan="8" class="text-center text-muted py-3">No payments recorded for this date.</td></tr>'}</tbody>
        </table>
      </div>
    </section>`;

  document.getElementById("th-rep-sale-id")?.addEventListener("click", () => {
    reportSalesSortDir = reportSalesSortDir === "desc" ? "asc" : "desc";
    renderReport(cachedReportData);
  });

  document.getElementById("th-rep-invoice-id")?.addEventListener("click", () => {
    reportInvoiceSortDir = reportInvoiceSortDir === "desc" ? "asc" : "desc";
    renderReport(cachedReportData);
  });
};
