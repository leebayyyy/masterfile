import { showToast, showError, showSuccess } from "./swal-helper.js";

const baseApiUrl = new URL("../api", import.meta.url).href;

let openInvoices = [];
let paymentMethods = [];
let allInvoicesData = [];
let allPaymentsData = [];
let canRecordPayment = false;

let invoiceSortDirection = "desc";
let paymentSortDirection = "desc";

document.addEventListener("DOMContentLoaded", () => {
  sessionStorage.setItem("baseAPIUrl", baseApiUrl);

  document.getElementById("payment-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    insertPayment();
  });
  document.getElementById("ar_invoice_id")?.addEventListener("change", updateInvoiceBalance);
  document.getElementById("btn-add")?.addEventListener("click", preparePaymentForm);
  document.getElementById("amount")?.addEventListener("input", validateAmount);

  // Search & Filter Listeners
  document.getElementById("invoice-customer-filter")?.addEventListener("change", filterInvoices);
  document.getElementById("invoice-search-filter")?.addEventListener("input", filterInvoices);
  document.getElementById("payment-search-filter")?.addEventListener("input", filterPayments);

  loadPaymentData();
  loadInvoicesData();
  displayRecords();
});

const loadPaymentData = async () => {
  try {
    const response = await axios.get(`${baseApiUrl}/payment.php`, {
      params: { operation: "getPaymentFormData" },
    });
    openInvoices = response.data.invoices || [];
    paymentMethods = response.data.paymentMethods || [];
    canRecordPayment = !!response.data.canRecordPayment;
    document.getElementById("btn-add")?.classList.toggle("d-none", !canRecordPayment);
    populateSelect("ar_invoice_id", openInvoices, "ar_invoice_id", "-- SELECT OPEN INVOICE --", (invoice) =>
      `${invoice.invoice_number || `Invoice #${invoice.ar_invoice_id}`} - ${invoice.customer_name} - Outstanding: ₱${Number(invoice.balance).toFixed(2)}`
    );
    populateSelect("payment_method_id", paymentMethods, "payment_method_id", "-- SELECT PAYMENT METHOD --", (method) => method.method_name);
  } catch (error) {
    console.error(error);
    showError("Unable to load payment options.");
  }
};

const loadInvoicesData = async () => {
  try {
    const response = await axios.get(`${baseApiUrl}/payment.php`, {
      params: { operation: "getAllInvoices" },
    });
    allInvoicesData = response.data || [];
    populateCustomerFilter(allInvoicesData);
    filterInvoices();
  } catch (error) {
    console.error(error);
    const container = document.getElementById("invoices-table-div");
    if (container) {
      container.innerHTML = '<p class="text-danger p-3">Unable to load customer invoice records.</p>';
    }
  }
};

const populateCustomerFilter = (invoices) => {
  const select = document.getElementById("invoice-customer-filter");
  if (!select) return;
  const currentVal = select.value;
  const customersMap = new Map();
  invoices.forEach((inv) => {
    if (inv.ar_customer_id && inv.customer_name) {
      customersMap.set(String(inv.ar_customer_id), inv.customer_name);
    }
  });

  select.innerHTML = '<option value="">-- All Customers --</option>';
  Array.from(customersMap.entries())
    .sort((a, b) => a[1].localeCompare(b[1]))
    .forEach(([id, name]) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = name;
      select.appendChild(opt);
    });
  if (currentVal) select.value = currentVal;
};

const filterInvoices = () => {
  const custId = document.getElementById("invoice-customer-filter")?.value || "";
  const query = (document.getElementById("invoice-search-filter")?.value || "").toLowerCase().trim();

  const filtered = allInvoicesData.filter((inv) => {
    const matchesCust = !custId || String(inv.ar_customer_id) === custId;
    const matchesQuery =
      !query ||
      String(inv.invoice_number || "").toLowerCase().includes(query) ||
      String(inv.ar_invoice_id || "").toLowerCase().includes(query) ||
      String(inv.customer_name || "").toLowerCase().includes(query) ||
      String(inv.status || "").toLowerCase().includes(query) ||
      String(inv.collection_status || "").toLowerCase().includes(query);
    return matchesCust && matchesQuery;
  });

  renderInvoicesTable(filtered);
};

const renderInvoicesTable = (records) => {
  const container = document.getElementById("invoices-table-div");
  if (!container) return;

  const sorted = [...records].sort((a, b) => {
    const idA = Number(a.ar_invoice_id || 0);
    const idB = Number(b.ar_invoice_id || 0);
    return invoiceSortDirection === "desc" ? idB - idA : idA - idB;
  });

  if (!sorted.length) {
    container.innerHTML = '<p class="text-muted p-4 mb-0 text-center">No invoice records found.</p>';
    return;
  }

  container.innerHTML = `
    <table class="table table-hover table-striped table-sm mb-0 align-middle">
      <thead class="table-light">
        <tr>
          <th id="th-invoice-id" style="cursor: pointer; user-select: none;" title="Click to sort by Invoice ID">
            INVOICE # <span class="sort-icon">${invoiceSortDirection === "desc" ? "▼" : "▲"}</span>
          </th>
          <th>CUSTOMER</th>
          <th>INVOICE DATE</th>
          <th>DUE DATE</th>
          <th class="text-end">AMOUNT</th>
          <th class="text-end">BALANCE</th>
          <th>STATUS</th>
          <th>COLLECTION</th>
          <th class="text-center">ACTION</th>
        </tr>
      </thead>
      <tbody>
        ${sorted
          .map((inv) => {
            const hasBalance = Number(inv.balance || 0) > 0;
            const collectionBadge =
              inv.collection_status === "Overdue"
                ? '<span class="badge bg-danger">Overdue</span>'
                : inv.collection_status === "Due today"
                ? '<span class="badge bg-warning text-dark">Due today</span>'
                : inv.collection_status === "Paid"
                ? '<span class="badge bg-success">Paid</span>'
                : '<span class="badge bg-primary">Current</span>';

            return `
              <tr>
                <td class="font-monospace fw-bold">${escapeHtml(inv.invoice_number || `#${inv.ar_invoice_id}`)}</td>
                <td class="fw-semibold">${escapeHtml(inv.customer_name || "")}</td>
                <td class="small">${escapeHtml(inv.invoice_date || "")}</td>
                <td class="small font-monospace">${escapeHtml(inv.due_date || "—")}</td>
                <td class="text-end font-monospace">₱${Number(inv.invoice_amount || 0).toFixed(2)}</td>
                <td class="text-end font-monospace fw-bold ${hasBalance ? "text-danger" : "text-success"}">
                  ₱${Number(inv.balance || 0).toFixed(2)}
                </td>
                <td><span class="badge ${inv.status === "Approved" ? "bg-info text-dark" : "bg-secondary"}">${escapeHtml(inv.status || "")}</span></td>
                <td>${collectionBadge} ${Number(inv.days_overdue || 0) > 0 ? `<small class="text-danger fw-bold">(${inv.days_overdue}d)</small>` : ""}</td>
                <td class="text-center">
                  ${
                    hasBalance && canRecordPayment
                      ? `<button type="button" class="btn btn-sm btn-outline-success py-0 px-2 pay-invoice-btn" data-invoice-id="${inv.ar_invoice_id}">Pay Debt</button>`
                      : hasBalance
                      ? `<span class="badge bg-warning text-dark">Unpaid</span>`
                      : `<span class="badge bg-success-subtle text-success border border-success-subtle">Settled</span>`
                  }
                </td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;

  document.getElementById("th-invoice-id")?.addEventListener("click", () => {
    invoiceSortDirection = invoiceSortDirection === "desc" ? "asc" : "desc";
    renderInvoicesTable(records);
  });

  container.querySelectorAll(".pay-invoice-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const invId = btn.dataset.invoiceId;
      openPayModalForInvoice(invId);
    });
  });
};

const openPayModalForInvoice = (invoiceId) => {
  preparePaymentForm();
  const select = document.getElementById("ar_invoice_id");
  if (select) {
    select.value = invoiceId;
    updateInvoiceBalance();
  }
  const modalEl = document.getElementById("payment-modal");
  if (modalEl) {
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }
};

const populateSelect = (id, records, valueKey, placeholder, labelBuilder = (record) => record[valueKey]) => {
  const select = document.getElementById(id);
  if (!select) return;
  select.innerHTML = `<option value="">${placeholder}</option>`;
  records.forEach((record) => {
    const option = document.createElement("option");
    option.value = record[valueKey];
    option.textContent = labelBuilder(record);
    select.appendChild(option);
  });
};

const preparePaymentForm = () => {
  document.getElementById("payment-form")?.reset();
  populateSelect("ar_invoice_id", openInvoices, "ar_invoice_id", "-- SELECT OPEN INVOICE --", (invoice) =>
    `${invoice.invoice_number || `Invoice #${invoice.ar_invoice_id}`} - ${invoice.customer_name} - Outstanding: ₱${Number(invoice.balance).toFixed(2)}`
  );
  populateSelect("payment_method_id", paymentMethods, "payment_method_id", "-- SELECT PAYMENT METHOD --", (method) => method.method_name);
  const dateInput = document.getElementById("payment_date");
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
  const balEl = document.getElementById("invoice-balance");
  if (balEl) balEl.textContent = "";
  const amtInput = document.getElementById("amount");
  if (amtInput) {
    amtInput.value = "";
    amtInput.setCustomValidity("");
    amtInput.removeAttribute("max");
  }
  const refInput = document.getElementById("reference_number");
  if (refInput) refInput.value = "";
};

const updateInvoiceBalance = () => {
  const invoice = openInvoices.find((record) => String(record.ar_invoice_id) === document.getElementById("ar_invoice_id")?.value);
  const amountInput = document.getElementById("amount");
  const balEl = document.getElementById("invoice-balance");
  if (!invoice) {
    if (balEl) balEl.textContent = "Select an invoice to view its outstanding balance.";
    if (amountInput) {
      amountInput.value = "";
      amountInput.removeAttribute("max");
    }
    validateAmount();
    return;
  }
  const balance = Number(invoice.balance);
  if (balEl) {
    balEl.textContent = `Outstanding balance: ₱${balance.toFixed(2)}. Enter a smaller amount for a partial payment.`;
  }
  if (amountInput) {
    amountInput.max = balance.toFixed(2);
    amountInput.value = balance.toFixed(2);
  }
  validateAmount();
};

const validateAmount = () => {
  const amountInput = document.getElementById("amount");
  if (!amountInput) return;
  const invoice = openInvoices.find((record) => String(record.ar_invoice_id) === document.getElementById("ar_invoice_id")?.value);
  amountInput.setCustomValidity(
    invoice && Number(amountInput.value) > Number(invoice.balance)
      ? "Payment cannot exceed the selected invoice's outstanding balance."
      : ""
  );
};

const displayRecords = async () => {
  try {
    const response = await axios.get(`${baseApiUrl}/payment.php`, {
      params: { operation: "getAllPayments" },
    });
    allPaymentsData = response.data || [];
    filterPayments();
  } catch (error) {
    console.error(error);
    showError("Unable to load payment records.");
  }
};

const filterPayments = () => {
  const query = (document.getElementById("payment-search-filter")?.value || "").toLowerCase().trim();
  const filtered = allPaymentsData.filter((p) => {
    return (
      !query ||
      String(p.payment_id || "").toLowerCase().includes(query) ||
      String(p.invoice_number || "").toLowerCase().includes(query) ||
      String(p.customer_name || "").toLowerCase().includes(query) ||
      String(p.reference_number || "").toLowerCase().includes(query) ||
      String(p.method_name || "").toLowerCase().includes(query)
    );
  });
  renderPaymentsTable(filtered);
};

const renderPaymentsTable = (records) => {
  const tableDiv = document.getElementById("table-div");
  if (!tableDiv) return;

  const sorted = [...records].sort((a, b) => {
    const idA = Number(a.payment_id || 0);
    const idB = Number(b.payment_id || 0);
    return paymentSortDirection === "desc" ? idB - idA : idA - idB;
  });

  if (!sorted.length) {
    tableDiv.innerHTML = '<p class="text-muted p-4 mb-0 text-center">No payment records found.</p>';
    return;
  }

  tableDiv.innerHTML = `
    <table class="table table-hover table-striped table-sm mb-0 align-middle">
      <thead class="table-light">
        <tr>
          <th id="th-payment-id" style="cursor: pointer; user-select: none;" title="Click to sort by Payment ID">
            PAYMENT # <span class="sort-icon">${paymentSortDirection === "desc" ? "▼" : "▲"}</span>
          </th>
          <th>DATE</th>
          <th>INVOICE</th>
          <th>CUSTOMER</th>
          <th class="text-end">AMOUNT</th>
          <th>STATUS</th>
          <th class="text-end">REMAINING BALANCE</th>
          <th>METHOD</th>
          <th>REFERENCE #</th>
        </tr>
      </thead>
      <tbody>
        ${sorted
          .map((payment) => `
          <tr>
            <td class="font-monospace fw-bold">#${payment.payment_id}</td>
            <td class="small">${escapeHtml(payment.payment_date || "")}</td>
            <td class="font-monospace">${escapeHtml(payment.invoice_number || "")}</td>
            <td class="fw-semibold">${escapeHtml(payment.customer_name || "")}</td>
            <td class="text-end font-monospace fw-bold">₱${Number(payment.amount).toFixed(2)}</td>
            <td><span class="badge ${payment.invoice_status === "Paid" ? "bg-success" : "bg-warning text-dark"}">${escapeHtml(payment.invoice_status || "")}</span></td>
            <td class="text-end font-monospace">₱${Number(payment.invoice_balance || 0).toFixed(2)}</td>
            <td><span class="badge bg-light text-dark border">${escapeHtml(payment.method_name || "")}</span></td>
            <td class="font-monospace small">${escapeHtml(payment.reference_number || "—")}</td>
          </tr>`)
          .join("")}
      </tbody>
    </table>`;

  document.getElementById("th-payment-id")?.addEventListener("click", () => {
    paymentSortDirection = paymentSortDirection === "desc" ? "asc" : "desc";
    renderPaymentsTable(records);
  });
};

const insertPayment = async () => {
  const data = {
    invoiceId: document.getElementById("ar_invoice_id")?.value,
    paymentDate: document.getElementById("payment_date")?.value,
    amount: document.getElementById("amount")?.value,
    paymentMethodId: document.getElementById("payment_method_id")?.value,
    notes: document.getElementById("notes")?.value,
  };
  try {
    const formData = new FormData();
    formData.append("operation", "insertPayment");
    formData.append("json", JSON.stringify(data));
    const response = await axios.post(`${baseApiUrl}/payment.php`, formData);
    if (response.data.returnValue === 1) {
      bootstrap.Modal.getOrCreateInstance(document.getElementById("payment-modal"))?.hide();
      const refInput = document.getElementById("reference_number");
      if (refInput) refInput.value = response.data.referenceNumber;
      await Promise.all([displayRecords(), loadPaymentData(), loadInvoicesData()]);
      const settlementMessage =
        response.data.invoiceStatus === "Paid"
          ? "The invoice is now fully paid."
          : `Remaining invoice balance: ₱${Number(response.data.remainingBalance).toFixed(2)}.`;
      showSuccess(`Payment successfully saved. ${settlementMessage}\nReference: ${response.data.referenceNumber}`, "Payment Recorded");
    } else {
      showError(response.data.message || "Unable to save payment.");
    }
  } catch (error) {
    console.error(error);
    showError(error.response?.data?.message || "Unable to save payment.");
  }
};

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
