import { showToast, showError, showSuccess } from "./swal-helper.js";

const baseApiUrl = "api";

let openInvoices = [];
let paymentMethods = [];
let customersList = [];
let allInvoicesData = [];
let allPaymentsData = [];
let canRecordPayment = false;
let currentPreview = null;

let invoiceSortDirection = "desc";
let paymentSortDirection = "desc";

document.addEventListener("DOMContentLoaded", () => {
  sessionStorage.setItem("baseAPIUrl", baseApiUrl);

  const form = document.getElementById("payment-form");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submitFifoPayment();
    });
  }

  document.getElementById("ar_customer_id")?.addEventListener("change", handleCustomerChange);
  document.getElementById("btn-add")?.addEventListener("click", preparePaymentForm);
  document.getElementById("btn-pay-full")?.addEventListener("click", handlePayFullDebt);
  document.getElementById("btn-preview-allocation")?.addEventListener("click", previewAllocation);

  // Trigger preview on amount Enter or blur
  document.getElementById("amount")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!currentPreview) {
        previewAllocation();
      } else {
        submitFifoPayment();
      }
    }
  });

  // Modal-level keyboard handler (Enter to confirm if preview ready, Esc to close)
  const paymentModalEl = document.getElementById("payment-modal");
  if (paymentModalEl) {
    paymentModalEl.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const modal = bootstrap.Modal.getInstance(paymentModalEl);
        if (modal) modal.hide();
      }
    });
  }

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
    customersList = response.data.customers || [];
    paymentMethods = response.data.paymentMethods || [];
    canRecordPayment = !!response.data.canRecordPayment;
    document.getElementById("btn-add")?.classList.toggle("d-none", !canRecordPayment);

    populateCustomerDropdown();
    populateSelect("payment_method_id", paymentMethods, "payment_method_id", "-- SELECT PAYMENT METHOD --", (method) => method.method_name);
  } catch (error) {
    console.error(error);
    showError("Unable to load payment options.");
  }
};

const populateCustomerDropdown = () => {
  const select = document.getElementById("ar_customer_id");
  if (!select) return;
  const currentVal = select.value;
  select.innerHTML = '<option value="">-- SELECT AR CUSTOMER --</option>';

  customersList.forEach((cust) => {
    const debt = Number(cust.total_debt || 0);
    const invCount = Number(cust.open_invoice_count || 0);
    const opt = document.createElement("option");
    opt.value = cust.ar_customer_id;
    opt.textContent = `${cust.customer_name} ${debt > 0 ? `(Debt: ₱${debt.toFixed(2)} — ${invCount} open)` : "(No open balance)"}`;
    opt.dataset.debt = debt;
    opt.dataset.creditLimit = cust.credit_limit || 0;
    opt.dataset.invCount = invCount;
    select.appendChild(opt);
  });

  if (currentVal) select.value = currentVal;
};

const handleCustomerChange = () => {
  const customerId = document.getElementById("ar_customer_id")?.value;
  const cust = customersList.find((c) => String(c.ar_customer_id) === String(customerId));

  currentPreview = null;
  const previewContainer = document.getElementById("fifo-preview-table-container");
  const footerEl = document.getElementById("fifo-summary-footer");
  if (footerEl) footerEl.classList.add("d-none");

  if (!cust) {
    document.getElementById("cust-credit-limit").textContent = "₱0.00";
    document.getElementById("cust-total-debt").textContent = "₱0.00";
    document.getElementById("cust-available-credit").textContent = "₱0.00";
    document.getElementById("cust-invoice-badge").textContent = "0 Open Invoices";
    if (previewContainer) {
      previewContainer.innerHTML = '<p class="text-muted text-center py-4 mb-0">Select a customer and enter a payment amount to preview the FIFO cascade.</p>';
    }
    return;
  }

  const limit = Number(cust.credit_limit || 0);
  const debt = Number(cust.total_debt || 0);
  const available = Math.max(0, limit - debt);
  const invCount = Number(cust.open_invoice_count || 0);

  document.getElementById("cust-credit-limit").textContent = `₱${limit.toFixed(2)}`;
  document.getElementById("cust-total-debt").textContent = `₱${debt.toFixed(2)}`;
  document.getElementById("cust-available-credit").textContent = `₱${available.toFixed(2)}`;
  document.getElementById("cust-invoice-badge").textContent = `${invCount} Open Invoice${invCount === 1 ? "" : "s"}`;

  if (invCount === 0) {
    if (previewContainer) {
      previewContainer.innerHTML = '<div class="alert alert-info m-3 mb-0">This customer currently has no unpaid open invoices.</div>';
    }
  } else {
    if (previewContainer) {
      previewContainer.innerHTML = '<p class="text-muted text-center py-4 mb-0">Customer selected. Enter payment amount and click Preview or press Enter.</p>';
    }
    const amtInput = document.getElementById("amount");
    if (amtInput && !amtInput.value && debt > 0) {
      amtInput.value = debt.toFixed(2);
      previewAllocation();
    }
  }
};

const handlePayFullDebt = () => {
  const customerId = document.getElementById("ar_customer_id")?.value;
  const cust = customersList.find((c) => String(c.ar_customer_id) === String(customerId));
  if (!cust) {
    showToast("Please select a customer first.", "warning");
    return;
  }
  const amtInput = document.getElementById("amount");
  if (amtInput) {
    amtInput.value = Number(cust.total_debt || 0).toFixed(2);
    previewAllocation();
  }
};

const previewAllocation = async () => {
  const customerId = document.getElementById("ar_customer_id")?.value;
  const amount = parseFloat(document.getElementById("amount")?.value || "0");
  const previewContainer = document.getElementById("fifo-preview-table-container");
  const footerEl = document.getElementById("fifo-summary-footer");

  if (!customerId) {
    showToast("Please select an AR Customer.", "warning");
    document.getElementById("ar_customer_id")?.focus();
    return;
  }
  if (!amount || amount <= 0) {
    showToast("Please enter a valid positive payment amount.", "warning");
    document.getElementById("amount")?.focus();
    return;
  }

  if (previewContainer) {
    previewContainer.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-success" role="status"></div><p class="small text-muted mt-2">Calculating FIFO cascade across oldest invoices...</p></div>';
  }

  try {
    const payload = { customerId: parseInt(customerId, 10), amount };
    const response = await axios.post(`${baseApiUrl}/payment.php`, new URLSearchParams({
      operation: "previewFifoAllocation",
      json: JSON.stringify(payload)
    }));

    if (response.data.returnValue === 1) {
      currentPreview = response.data;
      renderAllocationPreview(response.data);
    } else {
      currentPreview = null;
      if (footerEl) footerEl.classList.add("d-none");
      if (previewContainer) {
        previewContainer.innerHTML = `<div class="alert alert-warning m-3">${escapeHtml(response.data.message || "Unable to calculate allocation.")}</div>`;
      }
    }
  } catch (error) {
    console.error(error);
    currentPreview = null;
    if (footerEl) footerEl.classList.add("d-none");
    const msg = error.response?.data?.message || "Error calculating FIFO allocation.";
    if (previewContainer) {
      previewContainer.innerHTML = `<div class="alert alert-danger m-3">${escapeHtml(msg)}</div>`;
    }
  }
};

const renderAllocationPreview = (data) => {
  const previewContainer = document.getElementById("fifo-preview-table-container");
  const footerEl = document.getElementById("fifo-summary-footer");
  if (!previewContainer) return;

  const rows = data.allocations || [];
  if (!rows.length) {
    previewContainer.innerHTML = '<p class="text-muted text-center py-4 mb-0">No invoices found for allocation.</p>';
    if (footerEl) footerEl.classList.add("d-none");
    return;
  }

  let html = `
    <table class="table table-sm table-hover align-middle mb-0">
      <thead class="table-light">
        <tr>
          <th>QUEUE #</th>
          <th>INVOICE #</th>
          <th>INVOICE DATE</th>
          <th class="text-end">CURRENT BALANCE</th>
          <th class="text-end text-success fw-bold">AMOUNT APPLIED</th>
          <th class="text-end">NEW BALANCE</th>
          <th class="text-center">RESULTING STATUS</th>
        </tr>
      </thead>
      <tbody>
  `;

  rows.forEach((row, index) => {
    const isApplied = Number(row.amount_applied || 0) > 0;
    const isFullSettlement = Number(row.remaining_balance || 0) === 0 && isApplied;
    const statusBadge = isFullSettlement
      ? '<span class="badge bg-success">Fully Paid</span>'
      : isApplied
      ? '<span class="badge bg-warning text-dark">Partially Paid</span>'
      : '<span class="badge bg-light text-muted border">No Payment Applied</span>';

    html += `
      <tr class="${isApplied ? "table-success-subtle" : ""}">
        <td class="small font-monospace">${index === 0 ? '<span class="badge bg-primary">1st (Oldest)</span>' : `#${index + 1}`}</td>
        <td class="font-monospace fw-bold">${escapeHtml(row.invoice_number)}</td>
        <td class="small">${escapeHtml(row.invoice_date || "—")}</td>
        <td class="text-end font-monospace">₱${Number(row.current_balance).toFixed(2)}</td>
        <td class="text-end font-monospace fw-bold ${isApplied ? "text-success" : "text-muted"}">
          ₱${Number(row.amount_applied).toFixed(2)}
        </td>
        <td class="text-end font-monospace fw-bold ${Number(row.remaining_balance) > 0 ? "text-danger" : "text-success"}">
          ₱${Number(row.remaining_balance).toFixed(2)}
        </td>
        <td class="text-center">${statusBadge}</td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  previewContainer.innerHTML = html;

  if (footerEl) {
    footerEl.classList.remove("d-none");
    document.getElementById("preview-total-entered").textContent = `₱${Number(data.total_payment_entered || 0).toFixed(2)}`;
    document.getElementById("preview-total-applied").textContent = `₱${Number(data.total_applied || 0).toFixed(2)}`;
    document.getElementById("preview-unapplied").textContent = `₱${Number(data.unallocated_amount || 0).toFixed(2)}`;
    document.getElementById("preview-new-debt").textContent = `₱${Number(data.new_customer_debt || 0).toFixed(2)}`;
  }
};

const submitFifoPayment = async () => {
  const customerId = document.getElementById("ar_customer_id")?.value;
  const amount = parseFloat(document.getElementById("amount")?.value || "0");
  const paymentMethodId = document.getElementById("payment_method_id")?.value;
  const paymentDate = document.getElementById("payment_date")?.value;
  const notes = document.getElementById("notes")?.value?.trim() || "";

  if (!customerId) {
    showToast("Please select an AR Customer.", "warning");
    document.getElementById("ar_customer_id")?.focus();
    return;
  }
  if (!amount || amount <= 0) {
    showToast("Please enter a valid payment amount.", "warning");
    document.getElementById("amount")?.focus();
    return;
  }
  if (!paymentMethodId) {
    showToast("Please choose a payment method.", "warning");
    document.getElementById("payment_method_id")?.focus();
    return;
  }
  if (!paymentDate) {
    showToast("Please choose a payment date.", "warning");
    document.getElementById("payment_date")?.focus();
    return;
  }

  // If preview was never triggered, trigger preview and ask user to confirm
  if (!currentPreview) {
    await previewAllocation();
    if (!currentPreview) return;
  }

  try {
    const payload = {
      customerId: parseInt(customerId, 10),
      amount: amount,
      paymentMethodId: parseInt(paymentMethodId, 10),
      paymentDate: paymentDate,
      notes: notes
    };

    const formData = new FormData();
    formData.append("operation", "insertFifoPayment");
    formData.append("json", JSON.stringify(payload));

    const response = await axios.post(`${baseApiUrl}/payment.php`, formData);
    if (response.data.returnValue === 1) {
      bootstrap.Modal.getInstance(document.getElementById("payment-modal"))?.hide();

      await Promise.all([displayRecords(), loadPaymentData(), loadInvoicesData()]);

      // Show receipt modal with allocation breakdown
      showPaymentReceipt(response.data.paymentId);

      showSuccess(
        `FIFO Payment successfully settled across ${response.data.allocations.length} invoice(s).\nReference: ${response.data.referenceNumber}`,
        "Payment Recorded"
      );
    } else {
      showError(response.data.message || "Unable to save FIFO payment.");
    }
  } catch (error) {
    console.error(error);
    showError(error.response?.data?.message || "Unable to process FIFO payment.");
  }
};

const showPaymentReceipt = async (paymentId) => {
  try {
    const response = await axios.get(`${baseApiUrl}/payment.php`, {
      params: { operation: "getPaymentAllocations", payment_id: paymentId }
    });

    if (response.data.returnValue !== 1) {
      showError(response.data.message || "Unable to load receipt details.");
      return;
    }

    const { header, allocations } = response.data;
    const bodyEl = document.getElementById("receipt-modal-body");
    if (!bodyEl) return;

    let allocRows = (allocations || []).map((a, i) => `
      <tr>
        <td class="font-monospace">${i + 1}</td>
        <td class="font-monospace fw-bold">${escapeHtml(a.invoice_number)}</td>
        <td class="small">${escapeHtml(a.invoice_date || "—")}</td>
        <td class="text-end font-monospace">₱${Number(a.invoice_amount || 0).toFixed(2)}</td>
        <td class="text-end font-monospace fw-bold text-success">₱${Number(a.amount_applied || 0).toFixed(2)}</td>
        <td class="text-end font-monospace">₱${Number(a.remaining_balance || 0).toFixed(2)}</td>
        <td><span class="badge ${a.invoice_status === "Paid" ? "bg-success" : "bg-warning text-dark"}">${escapeHtml(a.invoice_status || "")}</span></td>
      </tr>
    `).join("");

    bodyEl.innerHTML = `
      <div class="text-center pb-3 border-bottom mb-3">
        <h4 class="fw-bold mb-1">OFFICIAL AR COLLECTION RECEIPT</h4>
        <div class="text-muted small">Department Store POS &amp; Accounts Receivable System</div>
        <div class="font-monospace fw-bold text-primary mt-1">${escapeHtml(header?.reference_number || `REF-#${header?.payment_id}`)}</div>
      </div>
      <div class="row g-2 mb-3 small">
        <div class="col-6"><strong>Customer:</strong> ${escapeHtml(allocations[0]?.customer_name || "—")}</div>
        <div class="col-6 text-end"><strong>Payment Date:</strong> ${escapeHtml(header?.payment_date || "")}</div>
        <div class="col-6"><strong>Payment Method:</strong> ${escapeHtml(header?.method_name || "—")}</div>
        <div class="col-6 text-end"><strong>Processed By:</strong> ${escapeHtml(header?.processed_by || "Cashier")}</div>
        <div class="col-12"><strong>Notes:</strong> ${escapeHtml(header?.notes || "FIFO Settlement")}</div>
      </div>
      <h6 class="fw-bold mb-2">Settled Invoice Allocations (FIFO Order)</h6>
      <div class="table-responsive mb-3">
        <table class="table table-sm table-bordered align-middle">
          <thead class="table-light">
            <tr>
              <th>#</th>
              <th>Invoice #</th>
              <th>Date</th>
              <th class="text-end">Amount</th>
              <th class="text-end">Applied</th>
              <th class="text-end">Remaining</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${allocRows || '<tr><td colspan="7" class="text-center text-muted">No details found</td></tr>'}
          </tbody>
          <tfoot class="table-light fw-bold">
            <tr>
              <td colspan="4" class="text-end">Total Payment Applied:</td>
              <td class="text-end text-success font-monospace">₱${Number(header?.amount || 0).toFixed(2)}</td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div class="alert alert-light border small text-muted mb-0">
        Receipt generated automatically on ${new Date().toLocaleString()}. All invoices settled according to FIFO debt aging rules.
      </div>
    `;

    const receiptModal = new bootstrap.Modal(document.getElementById("receipt-modal"));
    receiptModal.show();
  } catch (error) {
    console.error(error);
    showError("Unable to open receipt breakdown.");
  }
};

const openPayModalForCustomer = (customerId, suggestedAmount = null) => {
  preparePaymentForm();
  const select = document.getElementById("ar_customer_id");
  if (select) {
    select.value = customerId;
    handleCustomerChange();
  }
  if (suggestedAmount !== null) {
    const amtInput = document.getElementById("amount");
    if (amtInput) {
      amtInput.value = Number(suggestedAmount).toFixed(2);
      previewAllocation();
    }
  }
  const modalEl = document.getElementById("payment-modal");
  if (modalEl) {
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }
};

const preparePaymentForm = () => {
  document.getElementById("payment-form")?.reset();
  populateCustomerDropdown();
  populateSelect("payment_method_id", paymentMethods, "payment_method_id", "-- SELECT PAYMENT METHOD --", (method) => method.method_name);
  const dateInput = document.getElementById("payment_date");
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

  currentPreview = null;
  const previewContainer = document.getElementById("fifo-preview-table-container");
  if (previewContainer) {
    previewContainer.innerHTML = '<p class="text-muted text-center py-4 mb-0">Select a customer and enter a payment amount to preview the FIFO cascade.</p>';
  }
  document.getElementById("fifo-summary-footer")?.classList.add("d-none");
  document.getElementById("cust-credit-limit").textContent = "₱0.00";
  document.getElementById("cust-total-debt").textContent = "₱0.00";
  document.getElementById("cust-available-credit").textContent = "₱0.00";
  document.getElementById("cust-invoice-badge").textContent = "0 Open Invoices";
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
                      ? `<button type="button" class="btn btn-sm btn-outline-success py-0 px-2 pay-invoice-btn" data-customer-id="${inv.ar_customer_id}" data-balance="${inv.balance}">Pay Debt</button>`
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
      const custId = btn.dataset.customerId;
      const bal = btn.dataset.balance;
      openPayModalForCustomer(custId, bal);
    });
  });
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
          <th>CUSTOMER</th>
          <th>INVOICE(S) SETTLED</th>
          <th class="text-end">TOTAL PAID</th>
          <th>METHOD</th>
          <th>REFERENCE #</th>
          <th class="text-center">RECEIPT</th>
        </tr>
      </thead>
      <tbody>
        ${sorted
          .map((payment) => `
          <tr>
            <td class="font-monospace fw-bold">#${payment.payment_id}</td>
            <td class="small">${escapeHtml(payment.payment_date || "")}</td>
            <td class="fw-semibold">${escapeHtml(payment.customer_name || "—")}</td>
            <td class="font-monospace small">
              <span class="badge bg-light text-dark border">${escapeHtml(payment.invoice_number || "—")}</span>
              ${Number(payment.invoice_count || 1) > 1 ? `<span class="badge bg-secondary ms-1">${payment.invoice_count} inv</span>` : ""}
            </td>
            <td class="text-end font-monospace fw-bold text-success">₱${Number(payment.amount).toFixed(2)}</td>
            <td><span class="badge bg-light text-dark border">${escapeHtml(payment.method_name || "")}</span></td>
            <td class="font-monospace small">${escapeHtml(payment.reference_number || "—")}</td>
            <td class="text-center">
              <button type="button" class="btn btn-sm btn-outline-primary py-0 px-2 view-receipt-btn" data-payment-id="${payment.payment_id}">
                View Breakdown
              </button>
            </td>
          </tr>`)
          .join("")}
      </tbody>
    </table>`;

  document.getElementById("th-payment-id")?.addEventListener("click", () => {
    paymentSortDirection = paymentSortDirection === "desc" ? "asc" : "desc";
    renderPaymentsTable(records);
  });

  tableDiv.querySelectorAll(".view-receipt-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pid = btn.dataset.paymentId;
      showPaymentReceipt(pid);
    });
  });
};

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
