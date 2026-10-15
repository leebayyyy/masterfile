import { getSession } from "./auth.js?v=3";
import { showToast, showError, showSuccess, showConfirm } from "./swal-helper.js";

const apiUrl = new URL("../api/sales.php", import.meta.url).href;
let products = [];
let cart = [];
let currentUser = null;
let sukiCards = [];
let arCustomers = [];
let activeCartIndex = -1;
let isSubmitting = false;
let allSalesData = [];
let selectedReceiptSaleId = null;
let activeHeldId = null;
let activeHoldRef = null;
let allHeldTransactions = [];

document.addEventListener("DOMContentLoaded", () => {
  // Cashier View Switching Listener (dispatched from page-auth navbar)
  window.addEventListener("pos:switch-view", (e) => {
    switchPosView(e.detail?.view || "view-checkout");
  });

  // Navigation & Register Toggle
  document.getElementById("btn-new-sale")?.addEventListener("click", startSale);
  document.getElementById("btn-cancel-sale")?.addEventListener("click", requestClearCart);

  // Fallback / standard item add button
  document.getElementById("btn-add-item")?.addEventListener("click", addItemFromDropdown);

  // Mode radio buttons (CASH / AR CREDIT segmented toggle)
  document.getElementById("mode-cash")?.addEventListener("change", () => setSaleMode("Cash"));
  document.getElementById("mode-ar")?.addEventListener("change", () => setSaleMode("AR"));

  // Form field change listeners
  document.getElementById("sale_type")?.addEventListener("change", () => {
    updateSaleTypeFields();
    updateModeBadge();
  });
  document.getElementById("ar_customer_id")?.addEventListener("change", () => {
    updateSukiFields();
    refreshCreditEligibility();
  });
  document.getElementById("suki_card_status")?.addEventListener("change", updateSukiFields);
  document.getElementById("suki_card_id")?.addEventListener("change", updateSukiFields);
  document.getElementById("tax_rate")?.addEventListener("input", renderCart);

  // Form submit prevention (handled through Tender modal)
  document.getElementById("sale-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    openTenderModal();
  });

  // Barcode / Keyboard-First Scanner Entry
  const barcodeInput = document.getElementById("barcode-input");
  barcodeInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleBarcodeScan();
    }
  });

  // Action Buttons & Modals
  document.getElementById("btn-open-tender")?.addEventListener("click", openTenderModal);
  document.getElementById("btn-submit-tender")?.addEventListener("click", executeCheckout);
  document.getElementById("btn-open-search")?.addEventListener("click", openProductSearchModal);
  document.getElementById("btn-open-qty")?.addEventListener("click", openQuantityModal);
  document.getElementById("btn-confirm-qty")?.addEventListener("click", confirmQuantityOverride);
  document.getElementById("btn-void-item")?.addEventListener("click", voidActiveItem);
  document.getElementById("btn-hold-sale")?.addEventListener("click", openHoldModal);
  document.getElementById("btn-confirm-hold")?.addEventListener("click", executeHold);
  document.getElementById("btn-resume-sale")?.addEventListener("click", openResumeModal);

  // Hotkey Dock Buttons
  document.getElementById("btn-hk-lookup")?.addEventListener("click", openProductSearchModal);
  document.getElementById("btn-hk-qty")?.addEventListener("click", openQuantityModal);
  document.getElementById("btn-hk-cash")?.addEventListener("click", () => setSaleMode("Cash"));
  document.getElementById("btn-hk-void")?.addEventListener("click", voidActiveItem);
  document.getElementById("btn-hk-resume")?.addEventListener("click", openResumeModal);
  document.getElementById("btn-hk-hold")?.addEventListener("click", openHoldModal);
  document.getElementById("btn-hk-ar")?.addEventListener("click", () => setSaleMode("AR"));
  document.getElementById("btn-hk-tender")?.addEventListener("click", openTenderModal);
  document.getElementById("btn-hk-cancel")?.addEventListener("click", requestClearCart);

  // Product Dropdown & Auto Quantity input (Task 6)
  document.getElementById("product_id")?.addEventListener("change", (e) => {
    if (e.target.value) {
      const qtyInput = document.getElementById("quantity");
      if (qtyInput) {
        qtyInput.value = 1;
        qtyInput.focus();
        qtyInput.select();
      }
    }
  });

  document.getElementById("quantity")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addItemFromDropdown();
    }
  });

  // Clear Cart Confirmation Modal Button
  document.getElementById("btn-confirm-clear-cart")?.addEventListener("click", () => {
    closeSale();
    bootstrap.Modal.getInstance(document.getElementById("clear-cart-confirm-modal"))?.hide();
  });

  // Product Search Query Input
  document.getElementById("product-search-query")?.addEventListener("input", filterProductSearchResults);
  document.getElementById("product-search-query")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const firstBtn = document.querySelector("#product-search-results .select-product-btn");
      if (firstBtn) {
        firstBtn.click();
      }
    }
  });

  // Recent Sales Filter & Refresh
  document.getElementById("sales-search-filter")?.addEventListener("input", filterRecentSales);
  document.getElementById("btn-refresh-sales")?.addEventListener("click", loadSales);

  // Receipts Archive Search & Reprint
  document.getElementById("receipt-lookup-id")?.addEventListener("input", filterReceiptHistory);
  document.getElementById("btn-reprint-receipt")?.addEventListener("click", reprintSelectedReceipt);

  // Quantity Modal Enter Key
  document.getElementById("qty-override-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmQuantityOverride();
    }
  });

  // Tender Modal Cash Input Listener (Live Sukli Calculation)
  const tenderCashInput = document.getElementById("tender-cash-input");
  tenderCashInput?.addEventListener("input", updateSukliCalculator);
  tenderCashInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      executeCheckout();
    }
  });

  // Quick Cash Preset Buttons
  document.querySelectorAll(".pos-quick-cash-btn").forEach((btn) => {
    btn.addEventListener("click", () => handleQuickCashPreset(btn.dataset.preset));
  });

  // Modal Close Focus Restoration (Returns focus to barcode input)
  ["tender-modal", "product-search-modal", "quantity-modal", "receipt-modal", "clear-cart-confirm-modal", "hold-transaction-modal", "resume-transaction-modal"].forEach((modalId) => {
    const el = document.getElementById(modalId);
    el?.addEventListener("hidden.bs.modal", () => {
      focusBarcodeInput();
    });
  });

  // Global Keyboard Navigation
  window.addEventListener("keydown", handleGlobalShortcuts);

  // Live Clock
  startLiveClock();

  // Load Data
  loadFormData();
  loadSales();
});

/* ==========================================================================
   Live Clock & Header Info
   ========================================================================== */
const startLiveClock = () => {
  const clockEl = document.getElementById("pos-clock");
  const tick = () => {
    if (clockEl) {
      const now = new Date();
      clockEl.textContent = now.toLocaleDateString() + " " + now.toLocaleTimeString();
    }
  };
  tick();
  setInterval(tick, 1000);
};

const updateModeBadge = () => {
  const modeBadge = document.getElementById("pos-mode-badge");
  const isAr = document.getElementById("sale_type")?.value === "AR";
  if (modeBadge) {
    modeBadge.textContent = isAr ? "MODE: AR CREDIT (F9)" : "MODE: CASH (F3)";
    modeBadge.className = `badge ${isAr ? "bg-warning text-dark" : "bg-success"}`;
  }
};

const setSaleMode = (mode) => {
  const select = document.getElementById("sale_type");
  if (select) select.value = mode;

  const cashRadio = document.getElementById("mode-cash");
  const arRadio = document.getElementById("mode-ar");
  if (cashRadio) cashRadio.checked = mode === "Cash";
  if (arRadio) arRadio.checked = mode === "AR";

  updateSaleTypeFields();
  updateModeBadge();
  showScanFeedback(`Switched to ${mode === "AR" ? "AR Credit (Utang)" : "Cash"} mode.`);
};

/* ==========================================================================
   Data Loading & Initialization
   ========================================================================== */
const loadFormData = async () => {
  try {
    const { data } = await axios.get(apiUrl, { params: { operation: "getFormData" } });
    const session = await getSession();
    currentUser = session.user;

    const cashierNameEl = document.getElementById("pos-cashier-name");
    if (cashierNameEl && currentUser) {
      cashierNameEl.textContent = `${currentUser.first_name} ${currentUser.last_name} (${currentUser.role_name})`;
    }

    document.getElementById("btn-new-sale")?.classList.toggle("d-none", currentUser?.role_name !== "Cashier");
    products = data.products || [];
    sukiCards = data.sukiCards || [];
    arCustomers = data.customers || [];

    if (currentUser?.role_name === "Cashier" && !data.selectedTerminal) {
      window.location.href = "terminal_select.html";
      return;
    }

    const termEl = document.getElementById("selected-terminal-name");
    if (termEl) {
      termEl.textContent = data.selectedTerminal?.terminal_name || "Terminal: None";
    }
    const navTermEl = document.getElementById("cashier-nav-terminal");
    if (navTermEl) {
      navTermEl.textContent = data.selectedTerminal?.terminal_name || "Terminal: None";
    }

    fillSelect("sale_payment_method_id", data.paymentMethods, "payment_method_id", "method_name", "-- SELECT PAYMENT METHOD --");
    fillSelect("ar_customer_id", data.customers, "ar_customer_id", "customer_name", "-- SELECT CUSTOMER --");
    fillSelect(
      "suki_card_id",
      sukiCards,
      "sku_card_id",
      null,
      "-- UNREGISTERED / ENTER POINTS --",
      (card) => `${card.card_number} — ${arCustomers.find((c) => String(c.ar_customer_id) === String(card.ar_customer_id))?.customer_name || "Customer"} (${Number(card.points_balance || 0).toFixed(0)} pts)`
    );
    fillSelect(
      "product_id",
      products,
      "product_id",
      null,
      "-- SELECT PRODUCT --",
      (p) => `${p.product_id} — ${p.product_name} (₱${Number(p.price || 0).toFixed(2)})`
    );

    // If Cashier and register is closed, auto-open register for fast workflow
    if (currentUser?.role_name === "Cashier") {
      startSale();
    }

    // Load active held transactions count
    await updateHeldTransactionsBadge();
  } catch (error) {
    console.error(error);
    showError("Unable to load sales options.");
  }
};

const fillSelect = (id, records, valueKey, labelKey, placeholder, formatter = (r) => r[labelKey]) => {
  const select = document.getElementById(id);
  if (!select) return;
  select.innerHTML = `<option value="">${placeholder}</option>`;
  (records || []).forEach((record) => {
    const option = document.createElement("option");
    option.value = record[valueKey];
    option.textContent = formatter(record);
    select.appendChild(option);
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

/* ==========================================================================
   Register Lifecycle
   ========================================================================== */
const startSale = () => {
  cart = [];
  activeCartIndex = -1;
  activeHeldId = null;
  activeHoldRef = null;
  document.getElementById("held-sale-status-badge")?.classList.add("d-none");
  document.getElementById("sale-form")?.reset();
  const taxRateInput = document.getElementById("tax_rate");
  if (taxRateInput) taxRateInput.value = 0;

  document.getElementById("sale-form-container")?.classList.remove("d-none");
  updateSaleTypeFields();
  updateSukiFields();
  updateModeBadge();
  renderCart();
  focusBarcodeInput();
  showScanFeedback("Register ready. Scan or type product code.");
};

const requestClearCart = () => {
  if (cart.length > 0) {
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("clear-cart-confirm-modal"));
    modal.show();
  } else {
    closeSale();
  }
};

const closeSale = () => {
  cart = [];
  activeCartIndex = -1;
  activeHeldId = null;
  activeHoldRef = null;
  document.getElementById("held-sale-status-badge")?.classList.add("d-none");
  renderCart();
  showScanFeedback("Register cleared.");
  focusBarcodeInput();
};

const focusBarcodeInput = () => {
  setTimeout(() => {
    const input = document.getElementById("barcode-input");
    if (input && !isAnyModalOpen()) {
      input.focus();
      input.select();
    }
  }, 50);
};

const isAnyModalOpen = () => document.querySelectorAll(".modal.show").length > 0;

const showScanFeedback = (msg, isError = false) => {
  const fb = document.getElementById("scan-feedback");
  if (fb) {
    fb.textContent = msg;
    fb.className = `pos-scan-feedback ${isError ? "text-danger fw-bold" : "text-success fw-bold"}`;
  }
};

/* ==========================================================================
   Keyboard-First Scanning & Product Lookup
   ========================================================================== */
const handleBarcodeScan = () => {
  const input = document.getElementById("barcode-input");
  if (!input) return;
  const rawQuery = input.value.trim();
  if (!rawQuery) return;

  // Search logic:
  // 1. Exact numeric product_id match
  // 2. Exact name match (case-insensitive)
  // 3. Prefix / Substring match in product_name
  let matched = products.find((p) => String(p.product_id) === rawQuery);

  if (!matched) {
    const lowerQuery = rawQuery.toLowerCase();
    matched = products.find((p) => p.product_name.toLowerCase() === lowerQuery);
  }

  if (!matched) {
    const lowerQuery = rawQuery.toLowerCase();
    matched = products.find((p) => p.product_name.toLowerCase().startsWith(lowerQuery));
  }

  if (!matched) {
    const lowerQuery = rawQuery.toLowerCase();
    matched = products.find((p) => p.product_name.toLowerCase().includes(lowerQuery));
  }

  if (matched) {
    addProductToCart(matched, 1);
    input.value = "";
    showScanFeedback(`Added: ${matched.product_name} (₱${Number(matched.price).toFixed(2)})`);
  } else {
    showScanFeedback(`Item "${rawQuery}" not found. Press F1 to lookup.`, true);
  }
  focusBarcodeInput();
};

const addItemFromDropdown = () => {
  const select = document.getElementById("product_id");
  const qtyInput = document.getElementById("quantity");

  const product = products.find((p) => String(p.product_id) === select?.value);
  const quantity = Number(qtyInput?.value || 1);

  if (!product || quantity <= 0) {
    showScanFeedback("Select a product and enter a valid quantity.", true);
    return;
  }
  addProductToCart(product, quantity);
  if (select) select.value = "";
  if (qtyInput) qtyInput.value = 1;
  focusBarcodeInput();
};

const addProductToCart = (product, quantity = 1) => {
  const qty = Number(quantity) > 0 ? Number(quantity) : 1;
  const existingIndex = cart.findIndex((item) => item.productId === Number(product.product_id));
  if (existingIndex >= 0) {
    cart[existingIndex].quantity += qty;
    cart[existingIndex].promoId = product.promo_id ? Number(product.promo_id) : (cart[existingIndex].promoId || null);
    cart[existingIndex].promoName = product.promo_name || cart[existingIndex].promoName || "";
    cart[existingIndex].promoRate = Number(product.promo_rate !== undefined ? product.promo_rate : (cart[existingIndex].promoRate || 0));
    activeCartIndex = existingIndex;
  } else {
    cart.push({
      productId: Number(product.product_id),
      productName: product.product_name,
      unitPrice: Number(product.price || 0),
      quantity: qty,
      promoId: product.promo_id ? Number(product.promo_id) : null,
      promoName: product.promo_name || "",
      promoRate: Number(product.promo_rate || 0),
    });
    activeCartIndex = cart.length - 1;
  }
  renderCart();

  // Task 6: Automatically focus and select quantity input for the active item
  setTimeout(() => {
    const activeQtyInput = document.querySelector(`.cart-qty-input[data-index="${activeCartIndex}"]`);
    if (activeQtyInput && !isAnyModalOpen()) {
      activeQtyInput.focus();
      activeQtyInput.select();
    }
  }, 60);
};

/* ==========================================================================
   Product Search Modal [F1]
   ========================================================================== */
const openProductSearchModal = () => {
  const modalEl = document.getElementById("product-search-modal");
  if (!modalEl) return;
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();

  const queryInput = document.getElementById("product-search-query");
  if (queryInput) {
    queryInput.value = "";
    setTimeout(() => queryInput.focus(), 150);
  }
  renderProductSearchResults(products);
};

const filterProductSearchResults = () => {
  const query = (document.getElementById("product-search-query")?.value || "").toLowerCase().trim();
  if (!query) {
    renderProductSearchResults(products);
    return;
  }
  // Keyed on Product ID: exact product_id match first, then product_id prefix, then product_name match
  const exactIdMatches = products.filter((p) => String(p.product_id) === query);
  const prefixIdMatches = products.filter((p) => String(p.product_id).startsWith(query) && String(p.product_id) !== query);
  const nameMatches = products.filter(
    (p) => !String(p.product_id).startsWith(query) && p.product_name.toLowerCase().includes(query)
  );
  renderProductSearchResults([...exactIdMatches, ...prefixIdMatches, ...nameMatches]);
};

const renderProductSearchResults = (items) => {
  const tbody = document.getElementById("product-search-results");
  if (!tbody) return;

  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">No matching products found.</td></tr>';
    return;
  }

  tbody.innerHTML = items
    .slice(0, 30)
    .map(
      (p) => `
      <tr>
        <td class="font-monospace fw-bold text-primary">#${p.product_id}</td>
        <td class="fw-semibold">${escapeHtml(p.product_name)}</td>
        <td class="text-end font-monospace">₱${Number(p.price).toFixed(2)}</td>
        <td class="text-center">
          <button type="button" class="btn btn-sm btn-primary py-0 px-2 select-product-btn" data-pid="${p.product_id}">
            Select [Enter]
          </button>
        </td>
      </tr>`
    )
    .join("");

  tbody.querySelectorAll(".select-product-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const pid = btn.dataset.pid;
      const product = products.find((p) => String(p.product_id) === pid);
      bootstrap.Modal.getInstance(document.getElementById("product-search-modal"))?.hide();
      if (product) {
        let qty = 1;
        if (typeof Swal !== "undefined") {
          const { value: qtyVal } = await Swal.fire({
            title: `Add ${product.product_name}`,
            text: `Product ID: #${product.product_id} | Unit Price: ₱${Number(product.price).toFixed(2)}`,
            input: "number",
            inputLabel: "Enter Quantity",
            inputValue: 1,
            inputAttributes: {
              min: "1",
              step: "1",
              autofocus: "autofocus"
            },
            showCancelButton: true,
            confirmButtonText: "Add to Cart",
            confirmButtonColor: "#198754",
            cancelButtonText: "Cancel",
            inputValidator: (val) => {
              if (!val || isNaN(val) || parseInt(val, 10) < 1) {
                return "Please enter a valid quantity of 1 or more!";
              }
            }
          });
          if (!qtyVal) {
            focusBarcodeInput();
            return;
          }
          qty = parseInt(qtyVal, 10) || 1;
        }
        addProductToCart(product, qty);
        showScanFeedback(`Added: ${product.product_name} x ${qty}`);
      }
      focusBarcodeInput();
    });
  });
};

/* ==========================================================================
   Quantity Modifier Modal [F2]
   ========================================================================== */
const openQuantityModal = () => {
  if (!cart.length) {
    showScanFeedback("Cart is empty. Scan an item first.", true);
    return;
  }
  const targetIndex = activeCartIndex >= 0 && activeCartIndex < cart.length ? activeCartIndex : cart.length - 1;
  const item = cart[targetIndex];
  if (!item) return;

  const modalEl = document.getElementById("quantity-modal");
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

  const nameEl = document.getElementById("qty-modal-item-name");
  const inputEl = document.getElementById("qty-override-input");
  if (nameEl) nameEl.textContent = `${item.productName} (Current: ${item.quantity})`;
  if (inputEl) {
    inputEl.value = item.quantity;
    modal.show();
    setTimeout(() => {
      inputEl.focus();
      inputEl.select();
    }, 150);
  }
};

const confirmQuantityOverride = () => {
  const inputEl = document.getElementById("qty-override-input");
  const newQty = Number(inputEl?.value || 0);
  if (newQty <= 0) {
    showError("Quantity must be greater than zero.");
    return;
  }
  const targetIndex = activeCartIndex >= 0 && activeCartIndex < cart.length ? activeCartIndex : cart.length - 1;
  if (cart[targetIndex]) {
    cart[targetIndex].quantity = newQty;
    renderCart();
    showScanFeedback(`Updated quantity for ${cart[targetIndex].productName} to ${newQty}.`);
  }
  bootstrap.Modal.getInstance(document.getElementById("quantity-modal"))?.hide();
  focusBarcodeInput();
};

/* ==========================================================================
   Void Line Item [F4]
   ========================================================================== */
const voidActiveItem = () => {
  if (!cart.length) {
    showScanFeedback("Cart is empty. Nothing to void.", true);
    return;
  }
  const targetIndex = activeCartIndex >= 0 && activeCartIndex < cart.length ? activeCartIndex : cart.length - 1;
  const removed = cart.splice(targetIndex, 1)[0];
  activeCartIndex = cart.length - 1;
  renderCart();
  showScanFeedback(`Voided item: ${removed?.productName || "Selected item"}.`);
  focusBarcodeInput();
};

/* ==========================================================================
   Cart Rendering & Math Engine
   ========================================================================== */
const updateCartTotalsOnly = () => {
  let grossSubtotal = 0;
  let totalPromoSavings = 0;

  cart.forEach((item, index) => {
    const grossLine = Math.round(item.quantity * item.unitPrice * 100) / 100;
    const promoDisc = item.promoRate > 0 ? Math.round(((grossLine * item.promoRate) / 100) * 100) / 100 : 0;
    const lineTotal = Math.round((grossLine - promoDisc) * 100) / 100;
    grossSubtotal += grossLine;
    totalPromoSavings += promoDisc;

    const promoEl = document.querySelector(`[data-row-index="${index}"] .row-promo-discount`);
    const lineTotalEl = document.querySelector(`[data-row-index="${index}"] .row-line-total`);
    if (promoEl) promoEl.textContent = promoDisc > 0 ? `-₱${promoDisc.toFixed(2)}` : "-";
    if (lineTotalEl) lineTotalEl.textContent = `₱${lineTotal.toFixed(2)}`;
  });

  const roundedPromoSavings = Math.round(totalPromoSavings * 100) / 100;
  const grandTotal = Math.round((grossSubtotal - roundedPromoSavings) * 100) / 100;
  const vatableSales = Math.round((grandTotal / 1.12) * 100) / 100;
  const tax = Math.round((grandTotal - vatableSales) * 100) / 100;

  const promoSavingsEl = document.getElementById("pos-promo-savings");
  const subtotalEl = document.getElementById("subtotal");
  const taxEl = document.getElementById("tax-total");
  const totalHidden = document.getElementById("total-amount");
  const grandTotalEl = document.getElementById("pos-grand-total");

  if (promoSavingsEl) promoSavingsEl.textContent = roundedPromoSavings > 0 ? `-₱${roundedPromoSavings.toFixed(2)}` : "0.00";
  if (subtotalEl) subtotalEl.textContent = vatableSales.toFixed(2);
  if (taxEl) taxEl.textContent = tax.toFixed(2);
  if (totalHidden) totalHidden.value = grandTotal.toFixed(2);
  if (grandTotalEl) grandTotalEl.textContent = `PHP ${grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  updateCreditEligibility();
};

const renderCart = () => {
  let grossSubtotal = 0;
  let totalPromoSavings = 0;

  cart.forEach((item) => {
    const grossLine = Math.round(item.quantity * item.unitPrice * 100) / 100;
    const promoDisc = item.promoRate > 0 ? Math.round(((grossLine * item.promoRate) / 100) * 100) / 100 : 0;
    grossSubtotal += grossLine;
    totalPromoSavings += promoDisc;
  });

  const roundedPromoSavings = Math.round(totalPromoSavings * 100) / 100;
  const grandTotal = Math.round((grossSubtotal - roundedPromoSavings) * 100) / 100;
  const vatableSales = Math.round((grandTotal / 1.12) * 100) / 100;
  const tax = Math.round((grandTotal - vatableSales) * 100) / 100;

  // Update display values
  const promoSavingsEl = document.getElementById("pos-promo-savings");
  const subtotalEl = document.getElementById("subtotal");
  const taxEl = document.getElementById("tax-total");
  const totalHidden = document.getElementById("total-amount");
  const grandTotalEl = document.getElementById("pos-grand-total");

  if (promoSavingsEl) promoSavingsEl.textContent = roundedPromoSavings > 0 ? `-₱${roundedPromoSavings.toFixed(2)}` : "0.00";
  if (subtotalEl) subtotalEl.textContent = vatableSales.toFixed(2);
  if (taxEl) taxEl.textContent = tax.toFixed(2);
  if (totalHidden) totalHidden.value = grandTotal.toFixed(2);
  if (grandTotalEl) grandTotalEl.textContent = `PHP ${grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Render Table
  const tableContainer = document.getElementById("cart-table");
  if (tableContainer) {
    if (!cart.length) {
      tableContainer.innerHTML = '<div class="p-4 text-center text-muted">Register is empty. Scan an item or press F1 to search.</div>';
    } else {
      tableContainer.innerHTML = `
        <table class="table pos-cart-table table-hover table-sm">
          <thead>
            <tr>
              <th style="width: 5%;">#</th>
              <th>Product Description</th>
              <th class="text-center" style="width: 14%;">Qty</th>
              <th class="text-end" style="width: 16%;">Price</th>
              <th class="text-end" style="width: 16%;">Promo</th>
              <th class="text-end" style="width: 18%;">Total</th>
              <th class="text-center" style="width: 8%;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${cart
              .map((item, index) => {
                const grossLine = Math.round(item.quantity * item.unitPrice * 100) / 100;
                const promoDisc = item.promoRate > 0 ? Math.round(((grossLine * item.promoRate) / 100) * 100) / 100 : 0;
                const lineTotal = Math.round((grossLine - promoDisc) * 100) / 100;
                const isActive = index === activeCartIndex;
                const promoText = promoDisc > 0 ? `-₱${promoDisc.toFixed(2)}` : "-";
                const promoBadge = promoDisc > 0 ? `<br><small class="text-success fw-semibold font-monospace">${escapeHtml(item.promoName || "Promo")} (${item.promoRate}% off)</small>` : "";
                return `
                  <tr class="${isActive ? "table-active" : ""}" data-row-index="${index}">
                    <td class="num-cell text-muted">${index + 1}</td>
                    <td class="fw-semibold">
                      <span class="font-monospace text-primary me-1">#${item.productId}</span> ${escapeHtml(item.productName)}${promoBadge}
                    </td>
                    <td class="text-center num-cell">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        class="form-control form-control-sm text-center fw-bold cart-qty-input d-inline-block font-monospace"
                        data-index="${index}"
                        value="${item.quantity}"
                        style="width: 65px; height: 28px; padding: 2px 4px;"
                        aria-label="Item quantity"
                      />
                    </td>
                    <td class="text-end num-cell">₱${item.unitPrice.toFixed(2)}</td>
                    <td class="text-end num-cell text-success font-monospace row-promo-discount">${promoText}</td>
                    <td class="text-end num-cell fw-bold row-line-total">₱${lineTotal.toFixed(2)}</td>
                    <td class="text-center">
                      <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 remove-item-btn" data-index="${index}" title="Remove line item">
                        &times;
                      </button>
                    </td>
                  </tr>`;
              })
              .join("")}
          </tbody>
        </table>`;

      // Row Selection Click
      tableContainer.querySelectorAll("tbody tr").forEach((row) => {
        row.addEventListener("click", (e) => {
          if (!e.target.closest(".remove-item-btn") && !e.target.closest(".cart-qty-input")) {
            activeCartIndex = Number(row.dataset.rowIndex);
            renderCart();
          }
        });
      });

      // Individual Remove Button
      tableContainer.querySelectorAll(".remove-item-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const idx = Number(btn.dataset.index);
          cart.splice(idx, 1);
          activeCartIndex = cart.length - 1;
          renderCart();
          focusBarcodeInput();
        });
      });

      // Inline Quantity Input Handlers (Task 6)
      tableContainer.querySelectorAll(".cart-qty-input").forEach((input) => {
        const idx = Number(input.dataset.index);
        input.addEventListener("click", (e) => e.stopPropagation());
        input.addEventListener("input", (e) => {
          const val = Number(e.target.value);
          if (val > 0) {
            cart[idx].quantity = val;
            updateCartTotalsOnly();
          }
        });
        input.addEventListener("change", (e) => {
          const val = Number(e.target.value);
          if (!val || val <= 0) {
            e.target.value = 1;
            cart[idx].quantity = 1;
          } else {
            cart[idx].quantity = val;
          }
          renderCart();
        });
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            renderCart();
            focusBarcodeInput();
          }
        });
      });
    }
  }

  updateCreditEligibility();
};

/* ==========================================================================
   Tender Modal & Live Sukli (Change) Calculator
   ========================================================================== */
const openTenderModal = () => {
  if (!cart.length) {
    showError("Add at least one product before proceeding to tender.");
    focusBarcodeInput();
    return;
  }

  const isAr = document.getElementById("sale_type")?.value === "AR";
  const grandTotal = Number(document.getElementById("total-amount")?.value || 0);

  if (isAr) {
    const creditCheck = updateCreditEligibility();
    if (!creditCheck?.eligible) {
      showError("This customer does not have enough available credit for this sale.");
      return;
    }
  }

  // Display Grand Total in Modal
  const modalTotalEl = document.getElementById("tender-modal-total");
  if (modalTotalEl) {
    modalTotalEl.textContent = `PHP ${grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Toggle AR vs Cash section
  const cashSec = document.getElementById("tender-cash-section");
  const arSec = document.getElementById("tender-ar-section");
  const tenderCashInput = document.getElementById("tender-cash-input");

  if (cashSec) cashSec.classList.toggle("d-none", isAr);
  if (arSec) arSec.classList.toggle("d-none", !isAr);

  if (!isAr && tenderCashInput) {
    tenderCashInput.value = "";
    updateSukliCalculator();
  }

  const modalEl = document.getElementById("tender-modal");
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();

  if (!isAr && tenderCashInput) {
    setTimeout(() => {
      tenderCashInput.focus();
      tenderCashInput.select();
    }, 150);
  }
};

const updateSukliCalculator = () => {
  const isAr = document.getElementById("sale_type")?.value === "AR";
  if (isAr) return;

  const grandTotal = Number(document.getElementById("total-amount")?.value || 0);
  const tenderCashInput = document.getElementById("tender-cash-input");
  const tendered = Number(tenderCashInput?.value || 0);
  const sukliAmountEl = document.getElementById("tender-sukli-amount");
  const sukliBox = document.getElementById("tender-sukli-box");
  const submitBtn = document.getElementById("btn-submit-tender");

  if (tendered >= grandTotal && grandTotal > 0) {
    const change = Math.round((tendered - grandTotal) * 100) / 100;
    if (sukliAmountEl) {
      sukliAmountEl.textContent = `PHP ${change.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      sukliAmountEl.className = "pos-sukli-amount";
    }
    if (sukliBox) {
      sukliBox.className = "pos-sukli-box sufficient";
    }
    if (submitBtn) submitBtn.disabled = false;
  } else if (tendered === 0 && grandTotal === 0) {
    if (sukliAmountEl) sukliAmountEl.textContent = "PHP 0.00";
    if (submitBtn) submitBtn.disabled = false;
  } else {
    if (sukliAmountEl) {
      const short = (grandTotal - tendered).toFixed(2);
      sukliAmountEl.textContent = `Short: -P${short}`;
      sukliAmountEl.className = "pos-sukli-amount insufficient";
    }
    if (sukliBox) {
      sukliBox.className = "pos-sukli-box insufficient";
    }
    if (submitBtn) submitBtn.disabled = true;
  }
};

const handleQuickCashPreset = (preset) => {
  const grandTotal = Number(document.getElementById("total-amount")?.value || 0);
  const tenderCashInput = document.getElementById("tender-cash-input");
  if (!tenderCashInput) return;

  if (preset === "exact") {
    tenderCashInput.value = grandTotal.toFixed(2);
  } else {
    tenderCashInput.value = Number(preset).toFixed(2);
  }
  updateSukliCalculator();
  tenderCashInput.focus();
};

/* ==========================================================================
   Checkout Execution with Double-Submission Guard
   ========================================================================== */
const executeCheckout = async () => {
  if (isSubmitting) return;

  if (!cart.length) {
    showError("Add at least one product.");
    return;
  }

  const isAr = document.getElementById("sale_type")?.value === "AR";
  const grandTotal = Number(document.getElementById("total-amount")?.value || 0);

  if (!isAr) {
    const tendered = Number(document.getElementById("tender-cash-input")?.value || 0);
    if (tendered < grandTotal && grandTotal > 0) {
      showError("Cash tendered is less than the total amount due.");
      document.getElementById("tender-cash-input")?.focus();
      return;
    }
  } else {
    if (!(await refreshCreditEligibility())) {
      showError("Unable to verify this customer's credit eligibility.");
      return;
    }
    const creditCheck = updateCreditEligibility();
    if (!creditCheck?.eligible) {
      showError("Customer credit limit exceeded.");
      return;
    }
  }

  // Frontend Submission Lock
  isSubmitting = true;
  const submitBtn = document.getElementById("btn-submit-tender");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Processing Transaction...";
  }

  const data = {
    heldId: activeHeldId,
    saleType: document.getElementById("sale_type")?.value,
    paymentMethodId: document.getElementById("sale_payment_method_id")?.value,
    taxRate: document.getElementById("tax_rate")?.value,
    customerId: document.getElementById("ar_customer_id")?.value,
    sukiCardStatus: document.getElementById("suki_card_status")?.value,
    sukiCardId: document.getElementById("suki_card_id")?.value,
    sukiPointsBalance: document.getElementById("suki_points_balance")?.value,
    items: cart,
  };

  try {
    const formData = new FormData();
    formData.append("operation", "createSale");
    formData.append("json", JSON.stringify(data));

    const response = await axios.post(apiUrl, formData);
    if (response.data.returnValue === 1) {
      bootstrap.Modal.getInstance(document.getElementById("tender-modal"))?.hide();
      showScanFeedback(`Sale #${response.data.saleId} completed successfully!`);
      showReceipt(response.data.saleId);
      activeHeldId = null;
      activeHoldRef = null;
      document.getElementById("held-sale-status-badge")?.classList.add("d-none");
      closeSale();
      loadSales();
      updateHeldTransactionsBadge();

      // Task 8: Live update suki points across UI without page reload
      await loadFormData();
      if (response.data.newSukiPointsBalance !== undefined && response.data.newSukiPointsBalance !== null) {
        const ptsEl = document.getElementById("suki_points_balance");
        if (ptsEl) ptsEl.value = Number(response.data.newSukiPointsBalance).toFixed(0);
      }
    } else {
      showError(response.data.message || "Unable to record sale.");
    }
  } catch (error) {
    console.error(error);
    showError(error.response?.data?.message || "Transaction failed. Please check network connection.");
  } finally {
    isSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "COMPLETE SALE [Enter]";
    }
  }
};

/* ==========================================================================
   Global Conflict-Free Keyboard Shortcuts
   ========================================================================== */
const handleGlobalShortcuts = (e) => {
  // If an input is currently inside a modal, don't hijack standard typing
  const activeTag = document.activeElement?.tagName;

  switch (e.key) {
    case "F1":
      e.preventDefault();
      openProductSearchModal();
      break;

    case "F2":
      e.preventDefault();
      openQuantityModal();
      break;

    case "F3":
      e.preventDefault();
      setSaleMode("Cash");
      break;

    case "F4":
      e.preventDefault();
      voidActiveItem();
      break;

    case "F6":
      e.preventDefault();
      openResumeModal();
      break;

    case "F7":
      e.preventDefault();
      openHoldModal();
      break;

    case "F8":
      e.preventDefault();
      startSale();
      break;

    case "F9":
      e.preventDefault();
      setSaleMode("AR");
      break;

    case "F12":
      e.preventDefault();
      openTenderModal();
      break;

    case "Escape":
      // If modal is open, close topmost modal; else prompt to clear active cart safely
      if (isAnyModalOpen()) {
        document.querySelectorAll(".modal.show").forEach((m) => {
          bootstrap.Modal.getInstance(m)?.hide();
        });
        focusBarcodeInput();
      } else {
        requestClearCart();
      }
      break;

    default:
      break;
  }
};

/* ==========================================================================
   Credit Eligibility Logic (Preserved 100% from existing codebase)
   ========================================================================== */
const updateSaleTypeFields = () => {
  const isAr = document.getElementById("sale_type")?.value === "AR";
  const customerField = document.getElementById("customer-field");
  const customerSelect = document.getElementById("ar_customer_id");
  const paymentMethodField = document.getElementById("sale-payment-method-field");
  const paymentMethodSelect = document.getElementById("sale_payment_method_id");

  if (customerField) customerField.classList.toggle("d-none", !isAr);
  if (customerSelect) customerSelect.required = isAr;
  if (paymentMethodField) paymentMethodField.classList.toggle("d-none", isAr);
  if (paymentMethodSelect) {
    paymentMethodSelect.required = !isAr;
    if (isAr) paymentMethodSelect.value = "";
  }
  updateSukiFields();
  refreshCreditEligibility();
};

const updateSukiFields = () => {
  const isAr = document.getElementById("sale_type")?.value === "AR";
  const status = document.getElementById("suki_card_status")?.value;
  const pointsField = document.getElementById("suki-points-field");
  const pointsInput = document.getElementById("suki_points_balance");
  const registeredCardField = document.getElementById("suki-registered-card-field");
  const registeredCardSelect = document.getElementById("suki_card_id");

  document.getElementById("suki-cash-field")?.classList.toggle("d-none", isAr);
  document.getElementById("suki-ar-field")?.classList.toggle("d-none", !isAr);
  if (pointsField) pointsField.classList.toggle("d-none", isAr || status !== "Has");
  if (registeredCardField) registeredCardField.classList.toggle("d-none", isAr || status !== "Has");
  if (pointsInput) pointsInput.required = false;

  if (isAr) {
    if (registeredCardSelect) registeredCardSelect.value = "";
    const customerId = document.getElementById("ar_customer_id")?.value;
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
    const arCardInfoEl = document.getElementById("suki-ar-card-info");
    if (arCardInfoEl) arCardInfoEl.textContent = cardInfo;
  } else if (status !== "Has") {
    if (pointsInput) pointsInput.value = "";
    if (registeredCardSelect) registeredCardSelect.value = "";
    const cardCustEl = document.getElementById("suki-card-customer");
    if (cardCustEl) cardCustEl.textContent = "";
  } else {
    const card = sukiCards.find((r) => String(r.sku_card_id) === registeredCardSelect?.value);
    const cardCustEl = document.getElementById("suki-card-customer");
    if (card) {
      if (pointsInput) pointsInput.value = Number(card.points_balance || 0).toFixed(0);
      if (cardCustEl) {
        cardCustEl.textContent = `Linked customer: ${arCustomers.find((c) => String(c.ar_customer_id) === String(card.ar_customer_id))?.customer_name || "Customer"}. Sale records this balance snapshot.`;
      }
    } else if (cardCustEl) {
      cardCustEl.textContent = "For an unregistered card, enter the points shown by the customer.";
    }
  }
};

const updateCreditEligibility = () => {
  const eligibility = document.getElementById("credit-eligibility");
  const isAr = document.getElementById("sale_type")?.value === "AR";
  const customer = arCustomers.find((r) => String(r.ar_customer_id) === document.getElementById("ar_customer_id")?.value);
  if (!isAr || !customer || !eligibility) {
    if (eligibility) {
      eligibility.textContent = "";
      eligibility.className = "small mt-1";
    }
    return null;
  }
  const creditLimit = Number(customer.credit_limit || 0);
  const exposure = Number(customer.credit_exposure || 0);
  const available = creditLimit - exposure;
  const estimatedTotal = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const eligible = estimatedTotal > 0 && exposure + estimatedTotal <= creditLimit;

  eligibility.textContent = `Credit limit: ₱${creditLimit.toFixed(2)} · Exposure: ₱${exposure.toFixed(2)} · Available: ₱${available.toFixed(2)} · ${
    estimatedTotal > 0
      ? `${eligible ? "Eligible" : "Not eligible"} for this sale (estimated exposure: ₱${(exposure + estimatedTotal).toFixed(2)}).`
      : "Add products to check eligibility."
  }`;
  eligibility.className = `small mt-1 ${estimatedTotal > 0 ? (eligible ? "text-success fw-bold" : "text-danger fw-bold") : "text-muted"}`;
  return { eligible, available, creditLimit, exposure, estimatedTotal };
};

const refreshCreditEligibility = async () => {
  const customerId = document.getElementById("ar_customer_id")?.value;
  if (document.getElementById("sale_type")?.value !== "AR" || !customerId) {
    updateCreditEligibility();
    return false;
  }
  try {
    const { data } = await axios.get(apiUrl, {
      params: { operation: "getCreditEligibility", customerId },
    });
    if (document.getElementById("ar_customer_id")?.value !== customerId) return false;
    const customer = arCustomers.find((r) => String(r.ar_customer_id) === customerId);
    if (!customer) throw new Error("Selected customer is not available.");
    Object.assign(customer, data);
    updateCreditEligibility();
    return true;
  } catch (error) {
    console.error(error);
    const eligibility = document.getElementById("credit-eligibility");
    if (eligibility) {
      eligibility.textContent = error.response?.data?.message || "Unable to verify credit eligibility.";
      eligibility.className = "small mt-1 text-danger fw-bold";
    }
    return false;
  }
};

/* ==========================================================================
   Sales History & Cashier Views (Recent Sales & Receipts Reprint)
   ========================================================================== */

const switchPosView = (viewId) => {
  document.querySelectorAll(".pos-view").forEach((v) => v.classList.add("d-none"));
  const targetView = document.getElementById(viewId);
  if (targetView) {
    targetView.classList.remove("d-none");
  }

  if (viewId === "view-checkout") {
    document.body.classList.add("pos-terminal-active");
    focusBarcodeInput();
  } else {
    document.body.classList.remove("pos-terminal-active");
    if (viewId === "view-recent-sales") {
      loadSales();
    } else if (viewId === "view-receipts") {
      loadReceiptsArchive();
    }
  }
};

const loadSales = async () => {
  try {
    const { data } = await axios.get(apiUrl, { params: { operation: "getAllSales" } });
    allSalesData = data || [];
    renderSalesTable(allSalesData);
  } catch (err) {
    console.error(err);
  }
};

const filterRecentSales = () => {
  const query = (document.getElementById("sales-search-filter")?.value || "").toLowerCase().trim();
  if (!query) {
    renderSalesTable(allSalesData);
    return;
  }
  const filtered = allSalesData.filter((s) => {
    return (
      String(s.sale_id).toLowerCase().includes(query) ||
      String(s.customer_name || "").toLowerCase().includes(query) ||
      String(s.cashier || "").toLowerCase().includes(query) ||
      String(s.terminal_name || "").toLowerCase().includes(query) ||
      String(s.payment_method || "").toLowerCase().includes(query) ||
      String(s.sale_type || "").toLowerCase().includes(query)
    );
  });
  renderSalesTable(filtered);
};

let salesSortDirection = "desc";

const renderSalesTable = (records) => {
  const tableDiv = document.getElementById("sales-table");
  if (!tableDiv) return;

  const sorted = [...records].sort((a, b) => {
    const idA = Number(a.sale_id || 0);
    const idB = Number(b.sale_id || 0);
    return salesSortDirection === "desc" ? idB - idA : idA - idB;
  });

  tableDiv.innerHTML = sorted.length
    ? `
    <table class="table table-hover table-striped table-sm mb-0 align-middle">
      <thead class="table-light">
        <tr>
          <th id="th-sales-id" style="cursor: pointer; user-select: none;" title="Click to sort by Receipt #">
            RECEIPT # <span class="sort-icon">${salesSortDirection === "desc" ? "▼" : "▲"}</span>
          </th>
          <th>DATE &amp; TIME</th>
          <th>TYPE</th>
          <th>CUSTOMER</th>
          <th>TERMINAL</th>
          <th>CASHIER</th>
          <th>PAYMENT TENDER</th>
          <th class="text-end">TOTAL</th>
          <th class="text-center">ACTION</th>
        </tr>
      </thead>
      <tbody>
        ${sorted
          .map(
            (sale) => `
          <tr>
            <td class="font-monospace fw-bold">#${sale.sale_id}</td>
            <td class="small">${escapeHtml(sale.sale_date)}</td>
            <td><span class="badge ${sale.sale_type === "AR" ? "bg-warning text-dark" : "bg-success"}">${sale.sale_type || ""}</span></td>
            <td class="fw-semibold">${escapeHtml(sale.customer_name || "Walk-in Cash")}</td>
            <td class="small">${escapeHtml(sale.terminal_name)}</td>
            <td class="small">${escapeHtml(sale.cashier)}</td>
            <td class="small">${escapeHtml(sale.payment_method || (sale.sale_type === "AR" ? "AR Credit" : "Cash"))}</td>
            <td class="text-end font-monospace fw-bold">₱${Number(sale.total_amount || 0).toFixed(2)}</td>
            <td class="text-center">
              <button type="button" class="btn btn-sm btn-outline-primary py-0 px-2" data-receipt="${sale.sale_id}">
                Receipt
              </button>
            </td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`
    : '<p class="text-muted p-4 mb-0 text-center">No completed sales recorded for this register.</p>';

  document.getElementById("th-sales-id")?.addEventListener("click", () => {
    salesSortDirection = salesSortDirection === "desc" ? "asc" : "desc";
    renderSalesTable(records);
  });

  tableDiv.querySelectorAll("[data-receipt]").forEach((btn) => {
    btn.addEventListener("click", () => showReceipt(btn.dataset.receipt));
  });
};

/* ==========================================================================
   Receipts & Reprint Archive
   ========================================================================== */

const loadReceiptsArchive = async () => {
  if (!allSalesData.length) {
    try {
      const { data } = await axios.get(apiUrl, { params: { operation: "getAllSales" } });
      allSalesData = data || [];
    } catch (e) {
      console.error(e);
    }
  }
  renderReceiptHistoryList(allSalesData);
};

const renderReceiptHistoryList = (records) => {
  const listEl = document.getElementById("receipt-history-list");
  if (!listEl) return;

  if (!records.length) {
    listEl.innerHTML = '<div class="list-group-item text-muted text-center py-3">No transactions found.</div>';
    return;
  }

  listEl.innerHTML = records
    .map((s) => {
      const isAr = s.sale_type === "AR";
      const isSelected = selectedReceiptSaleId && String(selectedReceiptSaleId) === String(s.sale_id);
      return `
        <button type="button" class="list-group-item list-group-item-action ${isSelected ? "active" : ""}" data-archive-sale="${s.sale_id}">
          <div class="d-flex w-100 justify-content-between align-items-center">
            <strong class="font-monospace">Receipt #${s.sale_id}</strong>
            <span class="badge ${isAr ? "bg-warning text-dark" : "bg-success"}">${s.sale_type}</span>
          </div>
          <div class="d-flex w-100 justify-content-between align-items-center mt-1">
            <small class="${isSelected ? "text-white-50" : "text-muted"}">${escapeHtml(s.customer_name || "Walk-in Cash")}</small>
            <strong class="font-monospace">P${Number(s.total_amount || 0).toFixed(2)}</strong>
          </div>
          <small class="${isSelected ? "text-white-50" : "text-muted"} d-block mt-1 font-monospace" style="font-size: 0.75rem;">${s.sale_date}</small>
        </button>
      `;
    })
    .join("");

  listEl.querySelectorAll("[data-archive-sale]").forEach((btn) => {
    btn.addEventListener("click", () => {
      loadReceiptPreview(btn.dataset.archiveSale);
    });
  });
};

const filterReceiptHistory = () => {
  const query = (document.getElementById("receipt-lookup-id")?.value || "").toLowerCase().trim();
  if (!query) {
    renderReceiptHistoryList(allSalesData);
    return;
  }
  const filtered = allSalesData.filter((s) => {
    return (
      String(s.sale_id).includes(query) ||
      String(s.customer_name || "").toLowerCase().includes(query) ||
      String(s.sale_date || "").toLowerCase().includes(query)
    );
  });
  renderReceiptHistoryList(filtered);
};

const loadReceiptPreview = async (saleId) => {
  try {
    selectedReceiptSaleId = saleId;
    renderReceiptHistoryList(allSalesData);

    const { data } = await axios.get(apiUrl, { params: { operation: "getReceipt", saleId } });
    const pane = document.getElementById("receipt-preview-pane");
    const reprintBtn = document.getElementById("btn-reprint-receipt");
    if (!pane) return;

    const sale = data.sale;
    const isAr = sale.sale_type === "AR";
    const slipTitle = isAr ? "AR CREDIT CHARGE SLIP" : "CASH SALE SLIP";
    const sukiPoints = sale.suki_points_balance === null ? "" : `SUKI Points: ${Number(sale.suki_points_balance).toFixed(0)}<br>`;
    const sukiStatus = sale.suki_card_status && sale.suki_card_status !== "None" ? `SUKI Card: ${sale.suki_card_number || "Cardholder"}<br>${sukiPoints}` : "";
    const customer = sale.customer_name ? `Customer: ${escapeHtml(sale.customer_name)}<br>` : "";
    const paymentMethod = escapeHtml(sale.payment_method || (isAr ? "AR Credit" : "Cash"));

    pane.innerHTML = `
      <div id="reprint-slip-content" class="pos-receipt-slip">
        <div class="text-center mb-2">
          <div class="fw-bold fs-6">${slipTitle}</div>
          <div class="small text-muted">POS &amp; AR Master Files System</div>
          <div class="small text-muted font-monospace">*** REPRINT / ARCHIVE COPY ***</div>
        </div>
        <hr class="my-2" />
        <div class="small font-monospace mb-2">
          Receipt #: ${sale.sale_id}<br>
          Date: ${sale.sale_date}<br>
          Terminal: ${escapeHtml(sale.terminal_name)}<br>
          Cashier: ${escapeHtml(sale.cashier)}<br>
          ${customer}Payment: ${paymentMethod}<br>
          ${sukiStatus}
        </div>
        <hr class="my-2" />
        <table class="w-100 small font-monospace mb-2">
          ${data.items
            .map(
              (item) => `
            <tr>
              <td class="py-1">
                ${escapeHtml(item.product_name)} x ${item.quantity}
                ${Number(item.promo_discount || 0) > 0 ? `<br><small class="text-success">${escapeHtml(item.promo_name || "Promo")}: -₱${Number(item.promo_discount).toFixed(2)}</small>` : ""}
              </td>
              <td class="text-end py-1 align-top">₱${Number(item.line_total).toFixed(2)}</td>
            </tr>`
            )
            .join("")}
        </table>
        <hr class="my-2" />
        ${(() => {
          const promoSavings = data.items.reduce((sum, it) => sum + Number(it.promo_discount || 0), 0);
          return promoSavings > 0 ? `
          <div class="d-flex justify-content-between small font-monospace text-success">
            <span>Promo Savings:</span>
            <span>-₱${promoSavings.toFixed(2)}</span>
          </div>` : "";
        })()}
        <div class="d-flex justify-content-between small font-monospace">
          <span>VATable Sales:</span>
          <span>₱${Number(sale.price || (Number(sale.total_amount) / 1.12)).toFixed(2)}</span>
        </div>
        <div class="d-flex justify-content-between small font-monospace">
          <span>VAT Amount (12%):</span>
          <span>₱${Number(sale.tax_total || (Number(sale.total_amount) - (Number(sale.total_amount) / 1.12))).toFixed(2)}</span>
        </div>
        <div class="d-flex justify-content-between fw-bold font-monospace fs-6 mt-1">
          <span>TOTAL DUE:</span>
          <span>₱${Number(sale.total_amount).toFixed(2)}</span>
        </div>
        ${isAr ? `
          <div class="small mt-2 p-1 bg-light border text-center font-monospace">
            CHARGED TO CUSTOMER AR ACCOUNT
          </div>` : ""}
        <div class="text-center mt-3 small text-muted font-monospace">
          --- END OF REPRINT SLIP ---
        </div>
      </div>
    `;

    if (reprintBtn) reprintBtn.disabled = false;
  } catch (err) {
    console.error(err);
    showError("Unable to load receipt preview.");
  }
};

const reprintSelectedReceipt = () => {
  const slipContent = document.getElementById("reprint-slip-content");
  if (!slipContent) return;
  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
    <html>
      <head>
        <title>Reprint Receipt</title>
        <style>
          body { font-family: "Courier New", Courier, monospace; padding: 20px; }
          .pos-receipt-slip { max-width: 380px; margin: auto; }
          hr { border-top: 1px dashed #64748b; }
          table { width: 100%; }
          .text-end { text-align: right; }
          .text-center { text-align: center; }
          .fw-bold { font-weight: bold; }
          .d-flex { display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        ${slipContent.outerHTML}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
};

const showReceipt = async (saleId) => {
  try {
    const { data } = await axios.get(apiUrl, { params: { operation: "getReceipt", saleId } });
    const sale = data.sale;
    const isAr = sale.sale_type === "AR";
    const slipTitle = isAr ? "AR CREDIT CHARGE SLIP" : "CASH SALE SLIP";
    const sukiPoints = sale.suki_points_balance === null ? "" : `<br>SUKI Points: ${Number(sale.suki_points_balance).toFixed(0)}`;
    const sukiStatus = sale.suki_card_status || "None";
    const sukiCardNumber = sale.suki_card_number ? `<br>SUKI Card Number: ${sale.suki_card_number}` : "";
    const customer = sale.customer_name ? `<br>Customer: ${escapeHtml(sale.customer_name)}` : "";
    const paymentMethod = escapeHtml(sale.payment_method || (isAr ? "AR Credit" : "Cash"));

    document.getElementById("receipt-content").innerHTML = `
      <div id="printable-receipt" class="pos-receipt-slip" style="max-width: 380px; margin: auto;">
        <div class="text-center mb-3">
          <h5 class="fw-bold mb-0">${slipTitle}</h5>
          <small class="text-muted">POS &amp; AR Master Files System</small>
        </div>
        <p class="small mb-2 font-monospace">
          Receipt #${sale.sale_id}<br>
          Date: ${sale.sale_date}<br>
          Cashier: ${escapeHtml(sale.cashier)}${customer}<br>
          Terminal: ${escapeHtml(sale.terminal_name)}<br>
          Payment: ${paymentMethod}<br>
          SUKI Status: ${sukiStatus}${sukiCardNumber}${sukiPoints}
        </p>
        <hr class="my-2" />
        <table class="table table-sm table-borderless small mb-2 font-monospace">
          ${data.items
            .map(
              (item) => `
            <tr>
              <td>
                ${escapeHtml(item.product_name)} x ${item.quantity}
                ${Number(item.promo_discount || 0) > 0 ? `<br><small class="text-success">${escapeHtml(item.promo_name || "Promo")}: -₱${Number(item.promo_discount).toFixed(2)}</small>` : ""}
              </td>
              <td class="text-end font-monospace">₱${Number(item.line_total).toFixed(2)}</td>
            </tr>`
            )
            .join("")}
        </table>
        <hr class="my-2" />
        ${(() => {
          const promoSavings = data.items.reduce((sum, it) => sum + Number(it.promo_discount || 0), 0);
          return promoSavings > 0 ? `
          <div class="d-flex justify-content-between small font-monospace text-success">
            <span>Promo Savings:</span>
            <span>-₱${promoSavings.toFixed(2)}</span>
          </div>` : "";
        })()}
        <div class="d-flex justify-content-between small font-monospace">
          <span>VATable Sales:</span>
          <span>₱${Number(sale.price || (Number(sale.total_amount) / 1.12)).toFixed(2)}</span>
        </div>
        <div class="d-flex justify-content-between small font-monospace">
          <span>VAT Amount (12%):</span>
          <span>₱${Number(sale.tax_total || (Number(sale.total_amount) - (Number(sale.total_amount) / 1.12))).toFixed(2)}</span>
        </div>
        <div class="d-flex justify-content-between fw-bold fs-6 mt-1 font-monospace">
          <span>TOTAL:</span>
          <span>₱${Number(sale.total_amount).toFixed(2)}</span>
        </div>
        ${isAr ? `
          <div class="small mt-2 p-1 bg-light border text-center font-monospace">
            CHARGED TO CUSTOMER AR ACCOUNT
          </div>` : ""}
        <div class="text-center mt-3 text-muted small font-monospace">
          <p class="mb-0">Thank you for your purchase!</p>
        </div>
      </div>`;

    bootstrap.Modal.getOrCreateInstance(document.getElementById("receipt-modal")).show();
    document.getElementById("btn-print-receipt").onclick = () => {
      const content = document.getElementById("printable-receipt").innerHTML;
      const printWindow = window.open("", "_blank");
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Receipt</title>
            <style>
              body { font-family: "Courier New", Courier, monospace; padding: 20px; }
              .pos-receipt-slip { max-width: 380px; margin: auto; }
              hr { border-top: 1px dashed #64748b; }
              table { width: 100%; }
              .text-end { text-align: right; }
              .text-center { text-align: center; }
              .fw-bold { font-weight: bold; }
              .d-flex { display: flex; justify-content: space-between; }
            </style>
          </head>
          <body>
            ${content}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    };
  } catch (err) {
    console.error(err);
    showError("Unable to fetch receipt.");
  }
};

/* ==========================================================================
   Hold & Resume Transaction Management (Task 9)
   ========================================================================== */
const updateHeldTransactionsBadge = async () => {
  try {
    const { data } = await axios.get(apiUrl, { params: { operation: "getHeldTransactions" } });
    allHeldTransactions = Array.isArray(data) ? data : [];
    const badge = document.getElementById("held-count-badge");
    if (badge) {
      if (allHeldTransactions.length > 0) {
        badge.textContent = allHeldTransactions.length;
        badge.classList.remove("d-none");
      } else {
        badge.classList.add("d-none");
      }
    }
  } catch (err) {
    console.error("Unable to load held transactions count", err);
  }
};

const openHoldModal = () => {
  if (!cart.length) {
    showScanFeedback("Cart is empty. Nothing to hold.", true);
    showError("Add at least one product before holding the transaction.");
    return;
  }

  const modalEl = document.getElementById("hold-transaction-modal");
  if (!modalEl) return;

  const totalItems = cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const grandTotalStr = document.getElementById("pos-grand-total")?.textContent || "PHP 0.00";

  const itemCountEl = document.getElementById("hold-item-count");
  const totalAmountEl = document.getElementById("hold-total-amount");
  if (itemCountEl) itemCountEl.textContent = `${totalItems} items (${cart.length} line items)`;
  if (totalAmountEl) totalAmountEl.textContent = grandTotalStr;

  const custSelect = document.getElementById("ar_customer_id");
  const selectedCustomer = custSelect?.value ? arCustomers.find((c) => String(c.ar_customer_id) === custSelect.value) : null;
  const labelInput = document.getElementById("hold-customer-label");
  if (labelInput) {
    labelInput.value = selectedCustomer ? selectedCustomer.customer_name : (activeHoldRef ? `Continuation of ${activeHoldRef}` : "");
  }

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
  setTimeout(() => {
    labelInput?.focus();
    labelInput?.select();
  }, 150);
};

const executeHold = async () => {
  if (!cart.length) return;
  const labelInput = document.getElementById("hold-customer-label");
  const customerLabel = labelInput?.value.trim() || "";

  const holdData = {
    customerLabel,
    saleType: document.getElementById("sale_type")?.value || "Cash",
    paymentMethodId: document.getElementById("sale_payment_method_id")?.value || null,
    customerId: document.getElementById("ar_customer_id")?.value || null,
    sukiCardStatus: document.getElementById("suki_card_status")?.value || "None",
    sukiCardId: document.getElementById("suki_card_id")?.value || null,
    sukiPointsBalance: document.getElementById("suki_points_balance")?.value || null,
    taxRate: document.getElementById("tax_rate")?.value || 0,
    items: cart,
  };

  try {
    const formData = new FormData();
    formData.append("operation", "holdTransaction");
    formData.append("json", JSON.stringify(holdData));

    const { data } = await axios.post(apiUrl, formData);
    if (data.returnValue === 1) {
      bootstrap.Modal.getInstance(document.getElementById("hold-transaction-modal"))?.hide();

      // If we were continuing a previously held transaction and held again, remove old held record
      if (activeHeldId && activeHeldId !== data.heldId) {
        const delForm = new FormData();
        delForm.append("operation", "deleteHeldTransaction");
        delForm.append("heldId", activeHeldId);
        await axios.post(apiUrl, delForm);
      }

      activeHeldId = null;
      activeHoldRef = null;
      document.getElementById("held-sale-status-badge")?.classList.add("d-none");
      closeSale();
      await updateHeldTransactionsBadge();
      showScanFeedback(`Transaction put on hold (${data.holdReference}). Terminal cleared.`);
    } else {
      showError(data.message || "Unable to hold transaction.");
    }
  } catch (err) {
    console.error(err);
    showError(err.response?.data?.message || "Failed to hold transaction.");
  }
};

const openResumeModal = async () => {
  const modalEl = document.getElementById("resume-transaction-modal");
  if (!modalEl) return;

  const listTbody = document.getElementById("held-transactions-list");
  if (listTbody) {
    listTbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Loading held transactions...</td></tr>';
  }

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();

  try {
    const { data } = await axios.get(apiUrl, { params: { operation: "getHeldTransactions" } });
    allHeldTransactions = Array.isArray(data) ? data : [];
    renderHeldTransactionsList(allHeldTransactions);
    updateHeldTransactionsBadge();
  } catch (err) {
    console.error(err);
    if (listTbody) {
      listTbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-3">Failed to load held transactions.</td></tr>';
    }
  }
};

const renderHeldTransactionsList = (records) => {
  const listTbody = document.getElementById("held-transactions-list");
  if (!listTbody) return;

  if (!records.length) {
    listTbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">No held transactions waiting.</td></tr>';
    return;
  }

  listTbody.innerHTML = records
    .map((h) => {
      const isResumed = activeHeldId && Number(activeHeldId) === Number(h.held_id);
      return `
        <tr class="${isResumed ? "table-warning" : ""}">
          <td class="font-monospace fw-bold">${escapeHtml(h.hold_reference)}</td>
          <td class="fw-semibold">${escapeHtml(h.customer_label || "No note")}</td>
          <td class="small text-muted font-monospace">${escapeHtml(h.created_at)}</td>
          <td class="text-center fw-bold">${h.item_count}</td>
          <td class="text-end font-monospace fw-bold">P${Number(h.total_amount).toFixed(2)}</td>
          <td class="text-center text-nowrap">
            <button type="button" class="btn btn-sm ${isResumed ? "btn-secondary" : "btn-primary"} py-0 px-2 resume-action-btn" data-held-id="${h.held_id}" ${isResumed ? "disabled" : ""}>
              ${isResumed ? "Resumed" : "Resume"}
            </button>
            <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 ms-1 discard-action-btn" data-held-id="${h.held_id}" title="Discard held transaction">
              &times;
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  listTbody.querySelectorAll(".resume-action-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const heldId = Number(btn.dataset.heldId);
      resumeHeldTransaction(heldId);
    });
  });

  listTbody.querySelectorAll(".discard-action-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const heldId = Number(btn.dataset.heldId);
      discardHeldTransaction(heldId);
    });
  });
};

const resumeHeldTransaction = async (heldId) => {
  const held = allHeldTransactions.find((h) => Number(h.held_id) === Number(heldId));
  if (!held) {
    showError("Held transaction not found.");
    return;
  }

  if (cart.length > 0 && activeHeldId !== heldId) {
    const res = await showConfirm({
      title: "Replace Active Register Cart?",
      text: "Your current active cart will be replaced with this held transaction. Continue?",
      confirmButtonText: "Yes, Replace Cart",
      isDestructive: false
    });
    if (!res.isConfirmed) {
      return;
    }
  }

  // Restore cart items
  cart = (held.items || []).map((item) => {
    const prod = products.find((p) => Number(p.product_id) === Number(item.productId));
    return {
      productId: Number(item.productId),
      productName: item.productName || prod?.product_name || "Product",
      unitPrice: Number(item.unitPrice || prod?.price || 0),
      quantity: Number(item.quantity || 1),
      promoId: item.promoId !== undefined && item.promoId !== null ? item.promoId : (prod?.promo_id ? Number(prod.promo_id) : null),
      promoName: item.promoName !== undefined ? item.promoName : (prod?.promo_name || ""),
      promoRate: item.promoRate !== undefined ? Number(item.promoRate) : Number(prod?.promo_rate || 0),
    };
  });
  activeCartIndex = cart.length - 1;

  // Track active held transaction so completion finalizes this exact held transaction
  activeHeldId = held.held_id;
  activeHoldRef = held.hold_reference;

  // Restore cart state fields
  const state = held.cart_state || {};
  if (state.saleType) {
    setSaleMode(state.saleType);
  }
  if (state.paymentMethodId && document.getElementById("sale_payment_method_id")) {
    document.getElementById("sale_payment_method_id").value = state.paymentMethodId;
  }
  if (state.customerId && document.getElementById("ar_customer_id")) {
    document.getElementById("ar_customer_id").value = state.customerId;
  }
  if (state.sukiCardStatus && document.getElementById("suki_card_status")) {
    document.getElementById("suki_card_status").value = state.sukiCardStatus;
  }
  if (state.sukiCardId && document.getElementById("suki_card_id")) {
    document.getElementById("suki_card_id").value = state.sukiCardId;
  }
  if (state.sukiPointsBalance !== undefined && document.getElementById("suki_points_balance")) {
    document.getElementById("suki_points_balance").value = state.sukiPointsBalance;
  }
  if (state.taxRate !== undefined && document.getElementById("tax_rate")) {
    document.getElementById("tax_rate").value = state.taxRate;
  }

  updateSaleTypeFields();
  updateSukiFields();
  renderCart();

  // Show status banner badge
  const statusBadge = document.getElementById("held-sale-status-badge");
  if (statusBadge) {
    statusBadge.textContent = `RESUMED: ${held.hold_reference}${held.customer_label ? ` (${held.customer_label})` : ""}`;
    statusBadge.classList.remove("d-none");
  }

  bootstrap.Modal.getInstance(document.getElementById("resume-transaction-modal"))?.hide();
  showScanFeedback(`Resumed held sale ${held.hold_reference}. Add missing items or checkout.`);
  focusBarcodeInput();
};

const discardHeldTransaction = async (heldId) => {
  const res = await showConfirm({
    title: "Discard Held Transaction?",
    text: "Are you sure you want to permanently discard this held transaction?",
    confirmButtonText: "Yes, Discard",
    isDestructive: true
  });
  if (!res.isConfirmed) return;
  try {
    const formData = new FormData();
    formData.append("operation", "deleteHeldTransaction");
    formData.append("heldId", heldId);
    const { data } = await axios.post(apiUrl, formData);
    if (data.returnValue === 1) {
      if (activeHeldId === heldId) {
        activeHeldId = null;
        activeHoldRef = null;
        document.getElementById("held-sale-status-badge")?.classList.add("d-none");
      }
      allHeldTransactions = allHeldTransactions.filter((h) => Number(h.held_id) !== Number(heldId));
      renderHeldTransactionsList(allHeldTransactions);
      updateHeldTransactionsBadge();
      showScanFeedback("Held transaction discarded.");
    }
  } catch (err) {
    console.error(err);
    showError("Unable to discard held transaction.");
  }
};
