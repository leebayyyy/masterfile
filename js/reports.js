const reportsUrl = new URL("../api/reports.php", import.meta.url).href;

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

const loadReport = async () => {
  const reportDiv = document.getElementById("report-content");
  reportDiv.innerHTML = '<div class="text-muted">Loading report...</div>';
  try {
    const { data } = await axios.get(reportsUrl, {
      params: { operation: "summary", date: document.getElementById("report-date").value },
      withCredentials: true,
    });
    renderReport(data);
  } catch (error) {
    console.error(error);
    reportDiv.innerHTML = `<div class="alert alert-danger">${error.response?.data?.message || "Unable to load reports."}</div>`;
  }
};

const renderReport = (data) => {
  const dateLabel = new Date(`${data.date}T00:00:00`).toLocaleDateString();
  document.getElementById("report-date-label").textContent = dateLabel;
  document.getElementById("report-cards").innerHTML = `
    <div class="col-md-3"><div class="card p-3 h-100"><div class="text-muted">Sales on ${dateLabel}</div><strong>${data.sales.count} transactions</strong><span>Total: ${Number(data.sales.total).toFixed(2)}</span><span>Tax: ${Number(data.sales.tax).toFixed(2)}</span></div></div>
    <div class="col-md-3"><div class="card p-3 h-100"><div class="text-muted">Outstanding AR</div><strong>${data.ar.invoices} invoices</strong><span>Balance: ${Number(data.ar.outstanding).toFixed(2)}</span></div></div>
    <div class="col-md-3"><div class="card p-3 h-100"><div class="text-muted">Credit Sales Awaiting Invoice</div><strong>${data.ar.pending_sales} sales</strong><span>Total: ${Number(data.ar.pending_sales_total).toFixed(2)}</span></div></div>
    <div class="col-md-3"><div class="card p-3 h-100 border-danger"><div class="text-muted">Overdue Collections</div><strong>${data.ar.overdue_invoices} invoices</strong><span>Balance: ${Number(data.ar.overdue_balance).toFixed(2)}</span></div></div>
    <div class="col-md-3"><div class="card p-3 h-100"><div class="text-muted">Promotion Savings on ${dateLabel}</div><strong>${data.promotions.sale_count} sales</strong><span>Total discounts: ${Number(data.promotions.total_discount).toFixed(2)}</span></div></div>
    <div class="col-md-3"><div class="card p-3 h-100"><div class="text-muted">Payments on ${dateLabel}</div><strong>${data.payments.count} payments</strong><span>Total: ${Number(data.payments.total).toFixed(2)}</span></div></div>`;

  const salesRows = data.dailySales.map((sale) => `
    <tr><td>${sale.sale_id}</td><td>${sale.sale_type || ""}</td><td>${sale.cashier}</td>
    <td>${sale.customer_name || "Walk-in"}</td><td>${escapeHtml(sale.terminal_name)}</td>
    <td>${escapeHtml(sale.payment_method || (sale.sale_type === "AR" ? "AR Credit" : "Not recorded"))}</td>
    <td>${sale.promotions_applied || "—"}</td><td>${Number(sale.promotion_discount || 0).toFixed(2)}</td>
    <td>${Number(sale.total_amount || 0).toFixed(2)}</td></tr>`).join("");
  const terminalRows = data.terminalSales.map((terminal) => `
    <tr><td>${escapeHtml(terminal.terminal_name)}</td><td>${terminal.sale_count}</td>
    <td>${Number(terminal.sales_total || 0).toFixed(2)}</td></tr>`).join("");
  const invoiceRows = data.invoices.map((invoice) => `
    <tr><td>${invoice.invoice_number || `Invoice #${invoice.ar_invoice_id}`}</td>
    <td>${invoice.customer_name}</td><td>${invoice.invoice_date || ""}</td><td>${invoice.due_date || ""}</td>
    <td>${Number(invoice.invoice_amount || 0).toFixed(2)}</td><td>${Number(invoice.balance || 0).toFixed(2)}</td>
    <td>${invoice.status}</td><td>${invoice.collection_status === "Overdue"
      ? `<span class="badge bg-danger">Overdue — ${invoice.days_overdue} days</span>`
      : invoice.collection_status === "Due today"
        ? '<span class="badge bg-warning text-dark">Due today</span>'
        : '<span class="badge bg-primary">Current</span>'}</td></tr>`).join("");
  const customerRows = data.customerBalances.map((customer) => `
    <tr><td>${customer.customer_name}</td><td>${customer.open_invoice_count}</td>
    <td>${Number(customer.invoice_balance).toFixed(2)}</td><td>${customer.pending_sale_count}</td>
    <td>${Number(customer.pending_balance).toFixed(2)}</td><td>${Number(customer.total_balance).toFixed(2)}</td>
    <td>${Number(customer.credit_limit).toFixed(2)}</td><td>${Number(customer.available_credit).toFixed(2)}</td></tr>`).join("");
  const paymentRows = data.dailyPayments.map((payment) => `
    <tr><td>${payment.reference_number || ""}</td><td>${payment.invoice_number || ""}</td>
    <td>${payment.customer_name}</td><td>${payment.processed_by}</td><td>${payment.method_name}</td>
    <td>${Number(payment.amount || 0).toFixed(2)}</td><td>${payment.invoice_status || ""}</td>
    <td>${Number(payment.invoice_balance || 0).toFixed(2)}</td></tr>`).join("");

  document.getElementById("report-content").innerHTML = `
    <section class="mt-4"><h2 class="h4">Sales by Cashier — ${dateLabel}</h2><div class="table-responsive"><table class="table table-sm table-striped"><thead><tr><th>Sale</th><th>Type</th><th>Cashier</th><th>Customer</th><th>Terminal</th><th>Payment Method</th><th>Promotions</th><th>Promotion Savings</th><th>Total</th></tr></thead><tbody>${salesRows || '<tr><td colspan="9" class="text-muted">No sales recorded for this date.</td></tr>'}</tbody></table></div></section>
    <section class="mt-4"><h2 class="h4">Sales by POS Terminal — ${dateLabel}</h2><div class="table-responsive"><table class="table table-sm table-striped"><thead><tr><th>Terminal</th><th>Transactions</th><th>Sales Total</th></tr></thead><tbody>${terminalRows || '<tr><td colspan="3" class="text-muted">No POS terminals configured.</td></tr>'}</tbody></table></div></section>
    <section class="mt-4"><h2 class="h4">Customer Credit Exposure</h2><div class="table-responsive"><table class="table table-sm table-striped"><thead><tr><th>Customer</th><th>Open Invoices</th><th>Invoice Balance</th><th>Pending Credit Sales</th><th>Pending Sale Total</th><th>Total Outstanding</th><th>Credit Limit</th><th>Available Credit</th></tr></thead><tbody>${customerRows || '<tr><td colspan="8" class="text-muted">No outstanding balances or approved credit limits.</td></tr>'}</tbody></table></div></section>
    <section class="mt-4"><h2 class="h4">Outstanding Invoices and Collection Follow-up</h2><div class="table-responsive"><table class="table table-sm table-striped"><thead><tr><th>Invoice</th><th>Customer</th><th>Invoice Date</th><th>Due Date</th><th>Total</th><th>Balance</th><th>Invoice Status</th><th>Collection Status</th></tr></thead><tbody>${invoiceRows || '<tr><td colspan="8" class="text-muted">No outstanding invoices.</td></tr>'}</tbody></table></div></section>
    <section class="mt-4"><h2 class="h4">Payments Recorded — ${dateLabel}</h2><div class="table-responsive"><table class="table table-sm table-striped"><thead><tr><th>Reference</th><th>Invoice</th><th>Customer</th><th>Processed By</th><th>Method</th><th>Amount</th><th>Invoice Status</th><th>Remaining Balance</th></tr></thead><tbody>${paymentRows || '<tr><td colspan="8" class="text-muted">No payments recorded for this date.</td></tr>'}</tbody></table></div></section>`;
};
