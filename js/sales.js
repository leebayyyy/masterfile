import { getSession } from "./auth.js?v=3";

const apiUrl = new URL("../api/sales.php", import.meta.url).href;
let products = [];
let cart = [];
let currentUser = null;
let sukiCards = [];
let arCustomers = [];

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-new-sale").addEventListener("click", startSale);
  document.getElementById("btn-cancel-sale").addEventListener("click", closeSale);
  document.getElementById("btn-add-item").addEventListener("click", addItem);
  document.getElementById("sale_type").addEventListener("change", updateSaleTypeFields);
  document.getElementById("ar_customer_id").addEventListener("change", updateSukiFields);
  document.getElementById("ar_customer_id").addEventListener("change", refreshCreditEligibility);
  document.getElementById("suki_card_status").addEventListener("change", updateSukiFields);
  document.getElementById("suki_card_id").addEventListener("change", updateSukiFields);
  document.getElementById("tax_rate").addEventListener("input", renderCart);
  document.getElementById("sale-form").addEventListener("submit", submitSale);
  loadFormData();
  loadSales();
});

const loadFormData = async () => {
  try {
    const { data } = await axios.get(apiUrl, { params: { operation: "getFormData" } });
    const session = await getSession();
    currentUser = session.user;
    document.getElementById("btn-new-sale").classList.toggle("d-none", currentUser?.role_name !== "Cashier");
    products = data.products;
    sukiCards = data.sukiCards;
    arCustomers = data.customers;
    if (currentUser?.role_name === "Cashier" && !data.selectedTerminal) {
      window.location.href = "terminal_select.html";
      return;
    }
    document.getElementById("selected-terminal-name").textContent =
      data.selectedTerminal?.terminal_name || "Not applicable";
    fillSelect("sale_payment_method_id", data.paymentMethods, "payment_method_id", "method_name", "-- SELECT PAYMENT METHOD --");
    fillSelect("ar_customer_id", data.customers, "ar_customer_id", "customer_name", "-- SELECT CUSTOMER --");
    fillSelect("suki_card_id", sukiCards, "sku_card_id", null, "-- UNREGISTERED / ENTER POINTS --",
      (card) => `${card.card_number} — ${arCustomers.find((customer) => String(customer.ar_customer_id) === String(card.ar_customer_id))?.customer_name || "Customer"} (${Number(card.points_balance || 0).toFixed(0)} points)`);
    fillSelect("product_id", products, "product_id", null, "-- SELECT PRODUCT --", (p) => `${p.product_name} (${Number(p.price || 0).toFixed(2)}${Number(p.promo_rate) > 0 ? `, ${p.promo_name} ${Number(p.promo_rate).toFixed(2)}% off` : ""})`);
  } catch (error) {
    console.error(error);
    alert("Unable to load sales options.");
  }
};

const fillSelect = (id, records, valueKey, labelKey, placeholder, formatter = (r) => r[labelKey]) => {
  const select = document.getElementById(id);
  select.innerHTML = `<option value="">${placeholder}</option>`;
  records.forEach((record) => {
    const option = document.createElement("option");
    option.value = record[valueKey];
    option.textContent = formatter(record);
    select.appendChild(option);
  });
};

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[character]));

const startSale = () => {
  cart = [];
  document.getElementById("sale-form").reset();
  document.getElementById("tax_rate").value = 0;
  document.getElementById("sale-form-container").classList.remove("d-none");
  updateSaleTypeFields();
  updateSukiFields();
  renderCart();
};

const closeSale = () => {
  document.getElementById("sale-form-container").classList.add("d-none");
  cart = [];
};

const updateSaleTypeFields = () => {
  const isAr = document.getElementById("sale_type").value === "AR";
  document.getElementById("customer-field").classList.toggle("d-none", !isAr);
  document.getElementById("ar_customer_id").required = isAr;
  const paymentMethodSelect = document.getElementById("sale_payment_method_id");
  document.getElementById("sale-payment-method-field").classList.toggle("d-none", isAr);
  paymentMethodSelect.required = !isAr;
  if (isAr) paymentMethodSelect.value = "";
  updateSukiFields();
  refreshCreditEligibility();
};

const updateSukiFields = () => {
  const isAr = document.getElementById("sale_type").value === "AR";
  const status = document.getElementById("suki_card_status").value;
  const pointsField = document.getElementById("suki-points-field");
  const pointsInput = document.getElementById("suki_points_balance");
  const registeredCardField = document.getElementById("suki-registered-card-field");
  const registeredCardSelect = document.getElementById("suki_card_id");
  document.getElementById("suki-cash-field").classList.toggle("d-none", isAr);
  document.getElementById("suki-ar-field").classList.toggle("d-none", !isAr);
  pointsField.classList.toggle("d-none", isAr || status !== "Has");
  registeredCardField.classList.toggle("d-none", isAr || status !== "Has");
  pointsInput.required = !isAr && status === "Has";

  if (isAr) {
    registeredCardSelect.value = "";
    const customerId = document.getElementById("ar_customer_id").value;
    const customerCards = sukiCards.filter((card) => String(card.ar_customer_id) === customerId);
    let cardInfo = "Select an AR Customer to check their SUKI card.";
    if (customerId && customerCards.length === 0) {
      cardInfo = "No active SUKI card is linked to this customer.";
    } else if (customerCards.length === 1) {
      const card = customerCards[0];
      cardInfo = `Has — Card ${card.card_number}, ${Number(card.points_balance || 0).toFixed(0)} points`;
    } else if (customerCards.length > 1) {
      cardInfo = "Multiple active SUKI cards are linked. Ask AR Staff to resolve this before completing the sale.";
    }
    document.getElementById("suki-ar-card-info").textContent = cardInfo;
  } else if (status !== "Has") {
    pointsInput.value = "";
    registeredCardSelect.value = "";
    document.getElementById("suki-card-customer").textContent = "";
  } else {
    const card = sukiCards.find((record) => String(record.sku_card_id) === registeredCardSelect.value);
    if (card) {
      pointsInput.value = Number(card.points_balance || 0).toFixed(0);
      document.getElementById("suki-card-customer").textContent =
        `Linked customer: ${arCustomers.find((customer) => String(customer.ar_customer_id) === String(card.ar_customer_id))?.customer_name || "Customer"}. Sale records this balance snapshot; it does not update card points.`;
    } else {
      document.getElementById("suki-card-customer").textContent =
        "For an unregistered card, enter the points shown by the customer.";
    }
  }
};

const addItem = () => {
  const product = products.find((p) => String(p.product_id) === document.getElementById("product_id").value);
  const quantity = Number(document.getElementById("quantity").value);
  const discount = Number(document.getElementById("discount").value || 0);
  if (!product || quantity <= 0 || discount < 0) {
    alert("Select a product and enter a valid quantity.");
    return;
  }
  const existing = cart.find((item) => item.productId === Number(product.product_id));
  if (existing) {
    existing.quantity += quantity;
    existing.discount += discount;
  } else {
    cart.push({ productId: Number(product.product_id), productName: product.product_name, unitPrice: Number(product.price || 0), quantity, discount, promoId: product.promo_id ? Number(product.promo_id) : null, promoName: product.promo_name || "", promoRate: Number(product.promo_rate || 0) });
  }
  renderCart();
};

const renderCart = () => {
  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice - item.discount - ((item.quantity * item.unitPrice) * item.promoRate / 100), 0);
  const tax = subtotal * Number(document.getElementById("tax_rate").value || 0) / 100;
  document.getElementById("subtotal").textContent = subtotal.toFixed(2);
  document.getElementById("tax-total").textContent = tax.toFixed(2);
  document.getElementById("total-amount").textContent = (subtotal + tax).toFixed(2);
  document.getElementById("cart-table").innerHTML = cart.length ? `
    <table class="table table-sm"><thead><tr><th>PRODUCT</th><th>QTY</th><th>PRICE</th><th>MANUAL DISCOUNT</th><th>PROMOTION</th><th>PROMO SAVINGS</th><th>TOTAL</th><th></th></tr></thead>
    <tbody>${cart.map((item, index) => {
      const lineAmount = item.quantity * item.unitPrice;
      const promoDiscount = Math.round(lineAmount * item.promoRate) / 100;
      return `<tr><td>${item.productName}</td><td>${item.quantity}</td><td>${item.unitPrice.toFixed(2)}</td><td>${item.discount.toFixed(2)}</td><td>${item.promoRate > 0 ? `${item.promoName} (${item.promoRate}%)` : "—"}</td><td>${promoDiscount.toFixed(2)}</td><td>${(lineAmount - item.discount - promoDiscount).toFixed(2)}</td><td><button type="button" class="btn btn-sm btn-outline-danger" data-remove="${index}">Remove</button></td></tr>`;
    }).join("")}</tbody></table>` : '<p class="text-muted">No items added.</p>';
  document.querySelectorAll("[data-remove]").forEach((button) => button.addEventListener("click", () => {
    cart.splice(Number(button.dataset.remove), 1);
    renderCart();
  }));
  updateCreditEligibility();
};

const updateCreditEligibility = () => {
  const eligibility = document.getElementById("credit-eligibility");
  const isAr = document.getElementById("sale_type").value === "AR";
  const customer = arCustomers.find((record) => String(record.ar_customer_id) === document.getElementById("ar_customer_id").value);
  if (!isAr || !customer) {
    eligibility.textContent = "";
    eligibility.className = "small mt-2";
    return null;
  }
  const creditLimit = Number(customer.credit_limit || 0);
  const exposure = Number(customer.credit_exposure || 0);
  const available = creditLimit - exposure;
  const subtotal = cart.reduce((sum, item) => {
    const lineAmount = item.quantity * item.unitPrice;
    const promoDiscount = Math.round(lineAmount * item.promoRate) / 100;
    return sum + lineAmount - item.discount - promoDiscount;
  }, 0);
  const tax = Math.round(subtotal * Number(document.getElementById("tax_rate").value || 0)) / 100;
  const estimatedTotal = Math.round((subtotal + tax) * 100) / 100;
  const eligible = estimatedTotal > 0 && exposure + estimatedTotal <= creditLimit;
  eligibility.textContent = `Credit limit: ${creditLimit.toFixed(2)} · Current exposure: ${exposure.toFixed(2)} · Available: ${available.toFixed(2)} · ${
    estimatedTotal > 0
      ? `${eligible ? "Eligible" : "Not eligible"} for this sale (estimated exposure: ${(exposure + estimatedTotal).toFixed(2)}).`
      : "Add products to check eligibility."
  }`;
  eligibility.className = `small mt-2 ${estimatedTotal > 0 ? (eligible ? "text-success" : "text-danger") : "text-muted"}`;
  return { eligible, available, creditLimit, exposure, estimatedTotal };
};

const refreshCreditEligibility = async () => {
  const customerId = document.getElementById("ar_customer_id").value;
  if (document.getElementById("sale_type").value !== "AR" || !customerId) {
    updateCreditEligibility();
    return false;
  }
  try {
    const { data } = await axios.get(apiUrl, {
      params: { operation: "getCreditEligibility", customerId },
    });
    if (document.getElementById("ar_customer_id").value !== customerId) return false;
    const customer = arCustomers.find((record) => String(record.ar_customer_id) === customerId);
    if (!customer) throw new Error("The selected customer is not available in the current POS options.");
    Object.assign(customer, data);
    updateCreditEligibility();
    return true;
  } catch (error) {
    console.error(error);
    const eligibility = document.getElementById("credit-eligibility");
    eligibility.textContent = error.response?.data?.message || "Unable to verify current credit eligibility.";
    eligibility.className = "small mt-2 text-danger";
    return false;
  }
};

const submitSale = async (event) => {
  event.preventDefault();
  if (!cart.length) {
    alert("Add at least one product.");
    return;
  }
  if (document.getElementById("sale_type").value === "AR") {
    if (!await refreshCreditEligibility()) {
      alert("Unable to verify this customer's current credit eligibility.");
      return;
    }
    const creditCheck = updateCreditEligibility();
    if (!creditCheck?.eligible) {
      alert("This customer does not have enough available credit for this sale.");
      return;
    }
  }
  const data = {
    saleType: document.getElementById("sale_type").value,
    paymentMethodId: document.getElementById("sale_payment_method_id").value,
    taxRate: document.getElementById("tax_rate").value,
    customerId: document.getElementById("ar_customer_id").value,
    sukiCardStatus: document.getElementById("suki_card_status").value,
    sukiCardId: document.getElementById("suki_card_id").value,
    sukiPointsBalance: document.getElementById("suki_points_balance").value,
    items: cart,
  };
  try {
    const formData = new FormData();
    formData.append("operation", "createSale");
    formData.append("json", JSON.stringify(data));
    const response = await axios.post(apiUrl, formData);
    if (response.data.returnValue === 1) {
      alert(`Sale ${response.data.saleId} successfully recorded.`);
      closeSale();
      loadSales();
    } else {
      alert(response.data.message || "Unable to record sale.");
    }
  } catch (error) {
    console.error(error);
    alert(error.response?.data?.message || "Unable to record sale.");
  }
};

const loadSales = async () => {
  const { data } = await axios.get(apiUrl, { params: { operation: "getAllSales" } });
  document.getElementById("sales-table").innerHTML = data.length ? `
    <table class="table table-hover table-striped table-sm"><thead><tr><th>DATE</th><th>TYPE</th><th>CUSTOMER</th><th>TERMINAL</th><th>CASHIER</th><th>PAYMENT METHOD</th><th>PROMOTIONS</th><th>PROMOTION SAVINGS</th><th>TOTAL</th><th>BALANCE</th><th></th></tr></thead>
    <tbody>${data.map((sale) => `<tr><td>${sale.sale_date}</td><td>${sale.sale_type || ""}</td><td>${sale.customer_name || ""}</td><td>${sale.terminal_name}</td><td>${sale.cashier}</td><td>${escapeHtml(sale.payment_method || (sale.sale_type === "AR" ? "AR Credit" : "Not recorded"))}</td><td>${sale.promotions_applied || "—"}</td><td>${Number(sale.promotion_discount || 0).toFixed(2)}</td><td>${Number(sale.total_amount || 0).toFixed(2)}</td><td>${Number(sale.balance || 0).toFixed(2)}</td><td><button class="btn btn-sm btn-outline-primary" data-receipt="${sale.sale_id}">Receipt</button></td></tr>`).join("")}</tbody></table>` : '<p class="text-muted">No sales recorded.</p>';
  document.querySelectorAll("[data-receipt]").forEach((button) => button.addEventListener("click", () => showReceipt(button.dataset.receipt)));
};

const showReceipt = async (saleId) => {
  const { data } = await axios.get(apiUrl, { params: { operation: "getReceipt", saleId } });
  const sukiPoints = data.sale.suki_points_balance === null ? "" : `<br>SUKI Points: ${Number(data.sale.suki_points_balance).toFixed(0)}`;
  const sukiStatus = data.sale.suki_card_status || "Not recorded";
  const sukiCardNumber = data.sale.suki_card_number ? `<br>SUKI Card Number: ${data.sale.suki_card_number}` : "";
  const customer = data.sale.customer_name ? `<br>Customer: ${data.sale.customer_name}` : "";
  const paymentMethod = escapeHtml(data.sale.payment_method || (data.sale.sale_type === "AR" ? "AR Credit" : "Not recorded"));
  document.getElementById("receipt-content").innerHTML = `<div id="printable-receipt"><h4>POS RECEIPT</h4><p>Sale #${data.sale.sale_id}<br>Date: ${data.sale.sale_date}<br>Cashier: ${data.sale.cashier}${customer}<br>Terminal: ${data.sale.terminal_name}<br>Payment Method: ${paymentMethod}<br>SUKI Card: ${sukiStatus}${sukiCardNumber}${sukiPoints}</p><table class="table table-sm">${data.items.map((item) => `<tr><td>${item.product_name} x ${item.quantity}${item.promo_name ? `<br><small>${item.promo_name} — savings ${Number(item.promo_discount || 0).toFixed(2)}</small>` : ""}</td><td class="text-end">${Number(item.line_total).toFixed(2)}</td></tr>`).join("")}<tr><th>Total promotion savings</th><th class="text-end">${data.items.reduce((sum, item) => sum + Number(item.promo_discount || 0), 0).toFixed(2)}</th></tr><tr><th>Total</th><th class="text-end">${Number(data.sale.total_amount).toFixed(2)}</th></tr></table></div>`;
  bootstrap.Modal.getOrCreateInstance(document.getElementById("receipt-modal")).show();
  document.getElementById("btn-print-receipt").onclick = () => { const content = document.getElementById("printable-receipt").innerHTML; const printWindow = window.open("", "_blank"); printWindow.document.write(`<html><body>${content}</body></html>`); printWindow.document.close(); printWindow.print(); };
};
