const baseApiUrl = new URL("../api", import.meta.url).href;

let openInvoices = [];
let paymentMethods = [];

document.addEventListener("DOMContentLoaded", () => {
  sessionStorage.setItem("baseAPIUrl", baseApiUrl);
  document.getElementById("payment-form").addEventListener("submit", (event) => {
    event.preventDefault();
    insertPayment();
  });
  document.getElementById("ar_invoice_id").addEventListener("change", updateInvoiceBalance);
  document.getElementById("btn-add").addEventListener("click", preparePaymentForm);
  document.getElementById("amount").addEventListener("input", validateAmount);
  loadPaymentData();
  displayRecords();
});

const loadPaymentData = async () => {
  try {
    const response = await axios.get(`${baseApiUrl}/payment.php`, {
      params: { operation: "getPaymentFormData" },
    });
    openInvoices = response.data.invoices;
    paymentMethods = response.data.paymentMethods;
    document.getElementById("btn-add").classList.toggle("d-none", !response.data.canRecordPayment);
    populateSelect("ar_invoice_id", openInvoices, "ar_invoice_id", "-- SELECT OPEN INVOICE --", (invoice) =>
      `${invoice.invoice_number || `Invoice #${invoice.ar_invoice_id}`} - ${invoice.customer_name} - Outstanding: ${Number(invoice.balance).toFixed(2)}`
    );
    populateSelect("payment_method_id", paymentMethods, "payment_method_id", "-- SELECT PAYMENT METHOD --", (method) => method.method_name);
  } catch (error) {
    console.error(error);
    alert("Unable to load payment options.");
  }
};

const populateSelect = (id, records, valueKey, placeholder, labelBuilder = (record) => record[valueKey]) => {
  const select = document.getElementById(id);
  select.innerHTML = `<option value="">${placeholder}</option>`;
  records.forEach((record) => {
    const option = document.createElement("option");
    option.value = record[valueKey];
    option.textContent = labelBuilder(record);
    select.appendChild(option);
  });
};

const preparePaymentForm = () => {
  document.getElementById("payment-form").reset();
  populateSelect("ar_invoice_id", openInvoices, "ar_invoice_id", "-- SELECT OPEN INVOICE --", (invoice) =>
    `${invoice.invoice_number || `Invoice #${invoice.ar_invoice_id}`} - ${invoice.customer_name} - Outstanding: ${Number(invoice.balance).toFixed(2)}`
  );
  populateSelect("payment_method_id", paymentMethods, "payment_method_id", "-- SELECT PAYMENT METHOD --", (method) => method.method_name);
  document.getElementById("payment_date").value = new Date().toISOString().slice(0, 10);
  document.getElementById("invoice-balance").textContent = "";
  document.getElementById("amount").value = "";
  document.getElementById("amount").setCustomValidity("");
  document.getElementById("amount").removeAttribute("max");
  document.getElementById("reference_number").value = "";
};

const updateInvoiceBalance = () => {
  const invoice = openInvoices.find((record) => String(record.ar_invoice_id) === document.getElementById("ar_invoice_id").value);
  const amountInput = document.getElementById("amount");
  if (!invoice) {
    document.getElementById("invoice-balance").textContent = "Select an invoice to view its outstanding balance.";
    amountInput.value = "";
    amountInput.removeAttribute("max");
    validateAmount();
    return;
  }
  const balance = Number(invoice.balance);
  document.getElementById("invoice-balance").textContent =
    `Outstanding balance: ${balance.toFixed(2)}. Enter a smaller amount for a partial payment.`;
  amountInput.max = balance.toFixed(2);
  amountInput.value = balance.toFixed(2);
  validateAmount();
};

const validateAmount = () => {
  const amountInput = document.getElementById("amount");
  const invoice = openInvoices.find((record) => String(record.ar_invoice_id) === document.getElementById("ar_invoice_id").value);
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
    const tableDiv = document.getElementById("table-div");
    if (!response.data.length) {
      tableDiv.innerHTML = '<p class="text-muted">No payments recorded.</p>';
      return;
    }
    tableDiv.innerHTML = `
      <table class="table table-hover table-striped table-sm">
        <thead><tr><th>DATE</th><th>INVOICE</th><th>CUSTOMER</th><th>AMOUNT</th><th>INVOICE STATUS</th><th>REMAINING BALANCE</th><th>METHOD</th><th>REFERENCE</th></tr></thead>
        <tbody>${response.data.map((payment) => `
          <tr>
            <td>${payment.payment_date || ""}</td>
            <td>${payment.invoice_number || ""}</td>
            <td>${payment.customer_name || ""}</td>
            <td>${Number(payment.amount).toFixed(2)}</td>
            <td>${payment.invoice_status || ""}</td>
            <td>${Number(payment.invoice_balance || 0).toFixed(2)}</td>
            <td>${payment.method_name || ""}</td>
            <td>${payment.reference_number || ""}</td>
          </tr>`).join("")}
        </tbody>
      </table>`;
  } catch (error) {
    console.error(error);
    alert("Unable to load payment records.");
  }
};

const insertPayment = async () => {
  const data = {
    invoiceId: document.getElementById("ar_invoice_id").value,
    paymentDate: document.getElementById("payment_date").value,
    amount: document.getElementById("amount").value,
    paymentMethodId: document.getElementById("payment_method_id").value,
    notes: document.getElementById("notes").value,
  };
  try {
    const formData = new FormData();
    formData.append("operation", "insertPayment");
    formData.append("json", JSON.stringify(data));
    const response = await axios.post(`${baseApiUrl}/payment.php`, formData);
    if (response.data.returnValue === 1) {
      bootstrap.Modal.getOrCreateInstance(document.getElementById("payment-modal")).hide();
      document.getElementById("reference_number").value = response.data.referenceNumber;
      await Promise.all([displayRecords(), loadPaymentData()]);
      const settlementMessage = response.data.invoiceStatus === "Paid"
        ? "The invoice is now fully paid."
        : `Remaining invoice balance: ${Number(response.data.remainingBalance).toFixed(2)}.`;
      alert(`Payment successfully saved. ${settlementMessage} Reference: ${response.data.referenceNumber}`);
    } else {
      alert(response.data.message || "Unable to save payment.");
    }
  } catch (error) {
    console.error(error);
    alert(error.response?.data?.message || "Unable to save payment.");
  }
};
