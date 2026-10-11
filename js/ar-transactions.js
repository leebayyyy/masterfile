const arUrl = new URL("../api/ar_transactions.php", import.meta.url).href;
let arData;

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("memo-form").addEventListener("submit", saveMemo);
  document.getElementById("invoice-form").addEventListener("submit", saveInvoice);
  document.getElementById("invoice-date").addEventListener("change", updateDueDate);
  loadAr();
});

const loadAr = async () => {
  try {
    const response = await axios.get(arUrl, {
      params: { operation: "getData" },
      withCredentials: true,
    });
    arData = response.data;
    renderAr();
  } catch (error) {
    console.error(error);
    document.getElementById("invoices").innerHTML =
      '<div class="alert alert-danger">Unable to load AR transactions.</div>';
  }
};

const renderAr = () => {
  const invoices = arData.invoices || [];
  const sales = arData.sales || [];
  const memos = arData.memos || [];
  document.getElementById("btn-new-memo").classList.toggle("d-none", !arData.canManageAr);
  document.getElementById("invoices").innerHTML = `
    <h4>Invoices and Collection Follow-up</h4>
    <div class="table-responsive"><table class="table table-sm">
      <thead><tr><th>Invoice</th><th>Customer</th><th>Invoice Date</th><th>Due Date</th><th>Amount</th><th>Balance</th><th>Invoice Status</th><th>Collection Status</th><th>Days Overdue</th></tr></thead>
      <tbody>${invoices.map((invoice) => `
        <tr><td>${invoice.invoice_number}</td><td>${invoice.customer_name}</td>
        <td>${invoice.invoice_date || ""}</td><td>${invoice.due_date || ""}</td>
        <td>${Number(invoice.invoice_amount).toFixed(2)}</td><td>${Number(invoice.balance).toFixed(2)}</td>
        <td>${invoice.status}</td>
        <td>${invoice.collection_status === "Overdue"
          ? '<span class="badge bg-danger">Overdue</span>'
          : invoice.collection_status === "Due today"
            ? '<span class="badge bg-warning text-dark">Due today</span>'
            : invoice.collection_status === "Paid"
              ? '<span class="badge bg-success">Paid</span>'
              : invoice.collection_status === "No due date"
                ? '<span class="badge bg-secondary">No due date</span>'
                : '<span class="badge bg-primary">Current</span>'}</td>
        <td>${Number(invoice.days_overdue || 0) > 0 ? invoice.days_overdue : ""}</td></tr>`).join("") || '<tr><td colspan="9">No invoices recorded.</td></tr>'}
      </tbody>
    </table></div>
    <h4 class="mt-4">Credit Sales Awaiting Invoicing</h4>
    <div class="table-responsive"><table class="table table-sm">
      <thead><tr><th>Sale</th><th>Customer</th><th>Sale Date</th><th>Total</th><th></th></tr></thead>
      <tbody>${sales.map((sale) => `
        <tr><td>#${sale.sale_id}</td><td>${sale.customer_name}</td><td>${sale.sale_date}</td>
        <td>${Number(sale.invoice_amount).toFixed(2)}</td>
        <td>${arData.canManageAr
          ? `<button class="btn btn-sm btn-primary" data-create-invoice="${sale.sale_id}">Create Invoice</button>`
          : "Awaiting AR Staff"}</td></tr>`).join("") || '<tr><td colspan="5">No credit sales awaiting invoicing.</td></tr>'}
      </tbody>
    </table></div>`;

  document.getElementById("memos").innerHTML = `
    <h4>Memos</h4>
    <div class="table-responsive"><table class="table table-sm">
      <thead><tr><th>Type</th><th>Invoice</th><th>Customer</th><th>Date</th><th>Amount</th><th>Issued By</th><th>Status</th></tr></thead>
      <tbody>${memos.map((memo) => `
        <tr><td>${memo.memo_type}</td><td>${memo.invoice_number || `Invoice #${memo.ar_invoice_id}`}</td>
        <td>${memo.customer_name}</td><td>${memo.issue_date || ""}</td>
        <td>${Number(memo.amount).toFixed(2)}</td><td>${memo.issued_by}</td><td>${memo.status}</td></tr>`).join("") ||
        '<tr><td colspan="7">No memos recorded.</td></tr>'}
      </tbody>
    </table></div>`;

  document.getElementById("memo_invoice").innerHTML =
    '<option value="">-- SELECT INVOICE --</option>' +
    invoices.filter((invoice) => Number(invoice.balance) > 0)
      .map((invoice) => `<option value="${invoice.ar_invoice_id}">${invoice.invoice_number} - ${invoice.customer_name}</option>`)
      .join("");
  document.querySelectorAll("[data-create-invoice]").forEach((button) => {
    button.addEventListener("click", () => openInvoiceForm(button.dataset.createInvoice));
  });
};

const openInvoiceForm = (saleId) => {
  const sale = arData.sales.find((record) => String(record.sale_id) === String(saleId));
  if (!sale) return;

  const today = new Date();
  const invoiceDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  document.getElementById("invoice-sale-id").value = sale.sale_id;
  document.getElementById("invoice-pending-id").value = sale.pending_invoice_id || "";
  document.getElementById("invoice-sale-summary").textContent =
    `Sale #${sale.sale_id} for ${sale.customer_name} (${sale.sale_date}).`;
  document.getElementById("invoice-date").value = invoiceDate;
  document.getElementById("invoice-amount").value = Number(sale.invoice_amount).toFixed(2);
  document.getElementById("invoice-balance").value = Number(sale.invoice_amount).toFixed(2);
  updateDueDate();
  bootstrap.Modal.getOrCreateInstance(document.getElementById("invoice-modal")).show();
};

const updateDueDate = () => {
  const invoiceDate = document.getElementById("invoice-date").value;
  const saleId = document.getElementById("invoice-sale-id").value;
  const sale = arData.sales.find((record) => String(record.sale_id) === saleId);
  if (!invoiceDate || !sale) return;
  const dueDate = new Date(`${invoiceDate}T00:00:00`);
  dueDate.setDate(dueDate.getDate() + Number(sale.payment_terms_days || 0));
  document.getElementById("invoice-due-date").value =
    `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}-${String(dueDate.getDate()).padStart(2, "0")}`;
};

const saveInvoice = async (event) => {
  event.preventDefault();
  const formData = new FormData();
  formData.append("operation", "createInvoice");
  formData.append("json", JSON.stringify({
    saleId: document.getElementById("invoice-sale-id").value,
    invoiceDate: document.getElementById("invoice-date").value,
    dueDate: document.getElementById("invoice-due-date").value,
    invoiceAmount: document.getElementById("invoice-amount").value,
    balance: document.getElementById("invoice-balance").value,
  }));
  try {
    const response = await axios.post(arUrl, formData, { withCredentials: true });
    bootstrap.Modal.getOrCreateInstance(document.getElementById("invoice-modal")).hide();
    await loadAr();
    alert(`Invoice ${response.data.invoiceNumber} created.`);
  } catch (error) {
    alert(error.response?.data?.message || "Unable to create invoice.");
  }
};

const saveMemo = async (event) => {
  event.preventDefault();
  const formData = new FormData();
  formData.append("operation", "createMemo");
  formData.append("json", JSON.stringify({
    memoType: document.getElementById("memo_type").value,
    invoiceId: document.getElementById("memo_invoice").value,
    amount: document.getElementById("memo_amount").value,
  }));
  try {
    const response = await axios.post(arUrl, formData, { withCredentials: true });
    bootstrap.Modal.getOrCreateInstance(document.getElementById("memo-modal")).hide();
    event.target.reset();
    await loadAr();
    const memoLabel = response.data.memoType === "Credit" ? "Credit memo" : "Debit memo";
    alert(`${memoLabel} recorded. Updated invoice amount: ${Number(response.data.invoiceAmount).toFixed(2)}; remaining balance: ${Number(response.data.remainingBalance).toFixed(2)}; status: ${response.data.invoiceStatus}.`);
  } catch (error) {
    alert(error.response?.data?.message || "Unable to save memo.");
  }
};
