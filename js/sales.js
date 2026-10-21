import { getSession, logoutUser } from "./auth.js?v=20261021";
import { showToast, showError, showSuccess, showConfirm } from "./swal-helper.js";

const apiUrl = "api/sales.php";
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

// Revisions State (Shift, Drawer Events, Supervisor Overrides, Lookup Navigation)
let currentShiftId = null;
let supervisorAuthResolve = null;
let supervisorAuthReject = null;
let activeDrawerEventType = "float";
let searchResultIndex = -1;
let currentSearchResults = [];
let activeHeldRecordIndex = 0;
let activePresetIndex = -1;
let currentLogicalZone = 1;
let activeSupervisorActionType = "";
let activeSupervisorTargetRef = "";
const keyboardDropdowns = new Map();
let openKeyboardDropdown = null;
const quickCashPresets = ["exact", "50", "100", "200", "500", "1000"];

const initPosRegister = () => {
  registerKeyboardDropdown("sale_payment_method_id", "payment-method-control", "payment-method-listbox");
  registerKeyboardDropdown("suki_card_status", "suki-card-status-control", "suki-card-status-listbox");
  registerKeyboardDropdown("suki_card_id", "suki-card-control", "suki-card-listbox");
  document.addEventListener("pointerdown", (event) => {
    if (openKeyboardDropdown && !openKeyboardDropdown.button.parentElement.contains(event.target)) {
      closeKeyboardDropdown(openKeyboardDropdown, false);
    }
  });

  // Cashier View Switching Listener (dispatched from page-auth navbar)
  window.addEventListener("pos:switch-view", (e) => {
    switchPosView(e.detail?.view || "view-checkout");
  });

  // Navigation & Register Toggle
  document.getElementById("btn-new-sale")?.addEventListener("click", startSale);
  document.getElementById("btn-cancel-sale")?.addEventListener("click", requestVoidTransaction);

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

  // Quantity-First: Cashier types quantity -> Enter -> focus moves to barcode input
  const qtyInput = document.getElementById("quantity");
  qtyInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const val = Number(qtyInput.value || 1);
      if (val < 1) qtyInput.value = 1;
      focusBarcodeInput();
    }
  });

  // Barcode / Keyboard-First Scanner Entry
  const barcodeInput = document.getElementById("barcode-input");
  barcodeInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      handleBarcodeScan();
    }
  });

  // Action Buttons & Modals
  document.getElementById("btn-open-tender")?.addEventListener("click", triggerActiveCheckout);
  document.getElementById("btn-submit-tender")?.addEventListener("click", executeCheckout);
  document.getElementById("btn-open-search")?.addEventListener("click", openProductSearchModal);
  document.getElementById("btn-open-qty")?.addEventListener("click", openQuantityModal);
  document.getElementById("btn-confirm-qty")?.addEventListener("click", confirmQuantityOverride);
  document.getElementById("btn-void-item")?.addEventListener("click", voidActiveItem);
  document.getElementById("btn-void-sale")?.addEventListener("click", requestVoidTransaction);
  document.getElementById("btn-hold-sale")?.addEventListener("click", triggerHoldTransaction);
  document.getElementById("btn-confirm-hold")?.addEventListener("click", executeHold);
  document.getElementById("btn-resume-sale")?.addEventListener("click", openResumeModal);

  // Hotkey Dock Buttons
  document.getElementById("btn-hk-help")?.addEventListener("click", openHotkeyHelpModal);
  document.getElementById("btn-hk-lookup")?.addEventListener("click", openProductSearchModal);
  document.getElementById("btn-hk-qty")?.addEventListener("click", focusQuantityInput);
  document.getElementById("btn-hk-void")?.addEventListener("click", voidActiveItem);
  document.getElementById("btn-hk-void-trans")?.addEventListener("click", requestVoidTransaction);
  document.getElementById("btn-hk-float")?.addEventListener("click", openFloatModal);
  document.getElementById("btn-hk-lift")?.addEventListener("click", openLiftModal);
  document.getElementById("btn-hk-ar")?.addEventListener("click", triggerArCreditSale);
  document.getElementById("btn-hk-tender")?.addEventListener("click", triggerCashTender);
  document.getElementById("btn-hk-resume")?.addEventListener("click", openResumeModal);
  document.getElementById("btn-hk-hold")?.addEventListener("click", triggerHoldTransaction);
  document.getElementById("btn-hk-complete")?.addEventListener("click", triggerActiveCheckout);
  document.getElementById("btn-hk-cancel")?.addEventListener("click", requestVoidTransaction);

  // Supervisor Modal Listeners
  document.getElementById("btn-sup-submit")?.addEventListener("click", handleSupervisorSubmit);
  document.getElementById("btn-sup-cancel")?.addEventListener("click", handleSupervisorCancel);
  document.getElementById("btn-sup-close")?.addEventListener("click", handleSupervisorCancel);
  document.getElementById("supervisor-username")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("supervisor-password")?.focus();
    }
  });
  document.getElementById("supervisor-password")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSupervisorSubmit();
    }
  });

  // Beginning Cash & Shift Management Listeners
  document.getElementById("btn-confirm-beginning-cash")?.addEventListener("click", confirmBeginningCash);
  document.getElementById("btn-close-beginning-cash")?.addEventListener("click", closeBeginningCash);
  document.getElementById("btn-open-beginning-cash")?.addEventListener("click", promptBeginningCash);
  document.getElementById("pos-shift-badge")?.addEventListener("click", promptBeginningCash);
  document.getElementById("btn-end-shift")?.addEventListener("click", endActiveShift);
  document.getElementById("beginning-cash-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      confirmBeginningCash();
    }
  });

  // Drawer Event Modal Listeners
  document.getElementById("btn-submit-drawer-event")?.addEventListener("click", submitDrawerEvent);
  document.getElementById("drawer-event-amount")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitDrawerEvent();
    }
  });

  // Clear Cart Confirmation Modal Button
  document.getElementById("btn-confirm-clear-cart")?.addEventListener("click", () => {
    closeSale();
    bootstrap.Modal.getInstance(document.getElementById("clear-cart-confirm-modal"))?.hide();
  });

  // Product Search Query Input
  document.getElementById("product-search-query")?.addEventListener("input", filterProductSearchResults);

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

  // Navigation & Mode Controls
  document.getElementById("btn-focus-qty")?.addEventListener("click", focusQuantityInput);
  document.getElementById("btn-mode-cash")?.addEventListener("click", () => setSaleMode("Cash"));
  document.getElementById("btn-mode-ar")?.addEventListener("click", () => setSaleMode("AR"));

  document.getElementById("nav-tab-checkout")?.addEventListener("click", () => switchPosView("view-checkout"));
  document.getElementById("nav-tab-recent")?.addEventListener("click", () => switchPosView("view-recent-sales"));
  document.getElementById("nav-tab-receipts")?.addEventListener("click", () => switchPosView("view-receipts"));
  document.getElementById("btn-cashier-logout")?.addEventListener("click", () => confirmLogout());

  window.addEventListener("pos:switch-view", (e) => {
    const viewId = e.detail?.view;
    if (viewId) {
      switchPosView(viewId);
    }
  });

  // Modal Focus Restoration & Clean Transition
  const allModalIds = [
    "tender-modal",
    "product-search-modal",
    "quantity-modal",
    "receipt-modal",
    "clear-cart-confirm-modal",
    "hold-transaction-modal",
    "resume-transaction-modal",
    "supervisor-modal",
    "beginning-cash-modal",
    "drawer-event-modal",
    "hotkey-reference-modal"
  ];

  allModalIds.forEach((modalId) => {
    const el = document.getElementById(modalId);
    el?.addEventListener("hidden.bs.modal", () => {
      // Clear any kb-focus from modal elements and container
      el.querySelectorAll(".kb-focus").forEach((f) => f.classList.remove("kb-focus"));
      el.classList.remove("kb-focus");

      if (modalId === "beginning-cash-modal" && currentShiftId === null && currentUser?.role_name === "Cashier") {
        showScanFeedback("Shift is not yet opened. Click 'Beginning Cash' or the shift badge to start shift.", true);
        const shiftBadge = document.getElementById("pos-shift-badge");
        if (shiftBadge) setSpatialFocus(shiftBadge);
        return;
      }

      const scan = document.getElementById("barcode-input");
      if (scan && !isAnyModalOpen()) {
        setSpatialFocus(scan);
        focusBarcodeInput();
      }
    });

    el?.addEventListener("shown.bs.modal", () => {
      // Never allow modal backdrop or container to retain kb-focus
      el.classList.remove("kb-focus");
      const modalDialog = el.querySelector(".modal-dialog");
      const modalContent = el.querySelector(".modal-content");
      if (modalDialog) modalDialog.classList.remove("kb-focus");
      if (modalContent) modalContent.classList.remove("kb-focus");

      const target = el.querySelector("[autofocus]") ||
                     el.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled]), button:not([disabled]):not(.btn-close)');
      if (target) {
        setSpatialFocus(target);
        if (typeof target.select === "function") {
          target.select();
        }
      }
    });
  });

  // Focus Synchronization across the DOM - only interactive controls receive spatial highlight
  const isNavigableInteractive = (el) => {
    if (!el || el === document.body || !el.isConnected) return false;
    if (el.classList.contains("modal") || el.classList.contains("modal-dialog") || el.classList.contains("modal-content") || el.classList.contains("modal-body")) {
      return false;
    }
    if (el.closest?.(".swal2-container")) return false;
    const tag = el.tagName;
    if (["INPUT", "SELECT", "TEXTAREA", "BUTTON", "A"].includes(tag)) return true;
    if (el.getAttribute("role") === "button" || el.getAttribute("role") === "option" || el.getAttribute("role") === "tab") return true;
    if (el.id === "cart-table" || el.classList.contains("pos-cart-row")) return true;
    if (el.hasAttribute("tabindex") && el.getAttribute("tabindex") !== "-1") return true;
    return false;
  };

  document.addEventListener("focusin", (e) => {
    if (isNavigableInteractive(e.target)) {
      document.querySelectorAll(".kb-focus").forEach((el) => {
        if (el !== e.target) el.classList.remove("kb-focus");
      });
      e.target.classList.add("kb-focus");
      currentSpatialFocusEl = e.target;
    } else {
      if (e.target && (e.target.classList?.contains("modal") || e.target.closest?.(".modal-content") === e.target)) {
        e.target.classList?.remove("kb-focus");
      }
    }
  });

  window.addEventListener("focus", ensureFocusNeverLost);
  document.addEventListener("focusout", () => {
    setTimeout(ensureFocusNeverLost, 50);
  });

  // Global Keyboard Navigation
  window.addEventListener("keydown", handleGlobalShortcuts);

  // Live Clock
  startLiveClock();

  // Load Data & Shifts
  loadFormData();
  loadSales();
};


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
    modeBadge.textContent = isAr ? "MODE: AR CREDIT (F8)" : "MODE: CASH (F9)";
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

    // Check shift status: only Cashier role is prompted for mandatory opening shift & beginning cash
    if (currentUser?.role_name === "Cashier") {
      await checkAndPromptShift();
    } else {
      // Non-cashier roles (Admin, Manager, Supervisor): display active shift if one exists, but NEVER auto-prompt modal
      try {
        const { data: shiftData } = await axios.get(apiUrl, {
          params: { operation: "getActiveShift" },
          withCredentials: true
        });
        if (shiftData.activeShift && shiftData.activeShift.shift_id) {
          currentShiftId = Number(shiftData.activeShift.shift_id);
          updateShiftBadge(currentShiftId, shiftData.activeShift.opening_cash);
        } else {
          updateShiftBadge(null, 0);
        }
      } catch (e) {
        // Non-blocking
      }
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

    // If Cashier and register is closed, auto-open register only if shift is active
    if (currentUser?.role_name === "Cashier" && currentShiftId !== null) {
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
  syncKeyboardDropdown(id);
};

const registerKeyboardDropdown = (selectId, buttonId, listboxId) => {
  const select = document.getElementById(selectId);
  const button = document.getElementById(buttonId);
  const listbox = document.getElementById(listboxId);
  if (!select || !button || !listbox) return;

  const dropdown = { select, button, listbox, highlightedIndex: -1 };
  keyboardDropdowns.set(selectId, dropdown);
  button.addEventListener("click", () => {
    if (openKeyboardDropdown === dropdown) {
      closeKeyboardDropdown(dropdown, true);
    } else {
      openKeyboardDropdownList(dropdown);
    }
  });
  select.addEventListener("change", () => syncKeyboardDropdown(selectId));
  syncKeyboardDropdown(selectId);
};

const syncKeyboardDropdown = (selectId) => {
  const dropdown = keyboardDropdowns.get(selectId);
  if (!dropdown) return;
  const selectedOption = dropdown.select.selectedOptions[0];
  dropdown.button.textContent = selectedOption?.textContent || "No options available";
  dropdown.listbox.replaceChildren();

  Array.from(dropdown.select.options).forEach((option, index) => {
    const optionButton = document.createElement("button");
    optionButton.type = "button";
    optionButton.className = "pos-keyboard-select-option";
    optionButton.id = `${dropdown.listbox.id}-option-${index}`;
    optionButton.setAttribute("role", "option");
    optionButton.tabIndex = -1;
    optionButton.setAttribute("aria-selected", String(option.selected));
    optionButton.textContent = option.textContent;
    optionButton.disabled = option.disabled;
    optionButton.addEventListener("click", () => {
      dropdown.select.value = option.value;
      dropdown.select.dispatchEvent(new Event("change", { bubbles: true }));
      closeKeyboardDropdown(dropdown, true);
    });
    dropdown.listbox.appendChild(optionButton);
  });
};

const openKeyboardDropdownList = (dropdown) => {
  if (openKeyboardDropdown && openKeyboardDropdown !== dropdown) {
    closeKeyboardDropdown(openKeyboardDropdown, false);
  }
  const options = Array.from(dropdown.select.options);
  if (!options.some((option) => option.value !== "" && !option.disabled)) return;

  openKeyboardDropdown = dropdown;
  dropdown.highlightedIndex = Math.max(0, options.findIndex((option) => option.selected && !option.disabled));
  dropdown.listbox.classList.remove("d-none");
  dropdown.button.setAttribute("aria-expanded", "true");
  updateKeyboardDropdownHighlight(dropdown);
};

const updateKeyboardDropdownHighlight = (dropdown) => {
  const options = Array.from(dropdown.listbox.querySelectorAll('[role="option"]:not(:disabled)'));
  options.forEach((option, index) => option.classList.toggle("is-highlighted", index === dropdown.highlightedIndex));
  const highlighted = options[dropdown.highlightedIndex];
  if (highlighted) dropdown.button.setAttribute("aria-activedescendant", highlighted.id);
  else dropdown.button.removeAttribute("aria-activedescendant");
};

const closeKeyboardDropdown = (dropdown, restoreFocus) => {
  dropdown.listbox.classList.add("d-none");
  dropdown.button.setAttribute("aria-expanded", "false");
  dropdown.button.removeAttribute("aria-activedescendant");
  dropdown.listbox.querySelectorAll(".is-highlighted").forEach((option) => option.classList.remove("is-highlighted"));
  if (openKeyboardDropdown === dropdown) openKeyboardDropdown = null;
  if (restoreFocus) setSpatialFocus(dropdown.button);
};

const handleKeyboardDropdownKey = (event) => {
  const dropdown = openKeyboardDropdown;
  if (!dropdown) return false;

  if (event.key === "Escape") {
    event.preventDefault();
    closeKeyboardDropdown(dropdown, true);
    return true;
  }
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const options = Array.from(dropdown.listbox.querySelectorAll('[role="option"]:not(:disabled)'));
    if (options.length) {
      const direction = event.key === "ArrowDown" ? 1 : -1;
      dropdown.highlightedIndex = (dropdown.highlightedIndex + direction + options.length) % options.length;
      updateKeyboardDropdownHighlight(dropdown);
    }
    return true;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    const options = Array.from(dropdown.listbox.querySelectorAll('[role="option"]:not(:disabled)'));
    const highlighted = options[dropdown.highlightedIndex];
    if (highlighted) highlighted.click();
    else closeKeyboardDropdown(dropdown, true);
    return true;
  }
  return false;
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
      setSpatialFocus(input);
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
const focusQuantityInput = () => {
  const qtyInput = document.getElementById("quantity");
  if (qtyInput) {
    setSpatialFocus(qtyInput);
    qtyInput.focus();
    qtyInput.select();
  }
};

const handleBarcodeScan = () => {
  const input = document.getElementById("barcode-input");
  const qtyInput = document.getElementById("quantity");
  if (!input) return;
  const rawQuery = input.value.trim();
  if (!rawQuery) {
    if (cart.length > 0) {
      openTenderModal();
    }
    return;
  }

  const quantity = Number(qtyInput?.value || 1);
  const activeQty = quantity > 0 ? quantity : 1;

  // Search logic:
  // 1. Exact barcode match
  // 2. Exact name match (case-insensitive)
  // 3. Prefix match in product_name
  // 4. Substring match in product_name
  let matched = products.find((p) => p.barcode && String(p.barcode).trim() === rawQuery);

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
    addProductToCart(matched, activeQty);
    input.value = "";
    if (qtyInput) qtyInput.value = 1;
    showScanFeedback(`Added ${activeQty}x: ${matched.product_name} (₱${Number(matched.price).toFixed(2)})`);
  } else {
    showScanFeedback(`Item / Barcode "${rawQuery}" not found. Press F2 to lookup.`, true);
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
      barcode: product.barcode || "",
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
  focusBarcodeInput();
};

/* ==========================================================================
   Product Search Modal [F2]
   ========================================================================== */
const openProductSearchModal = () => {
  const modalEl = document.getElementById("product-search-modal");
  if (!modalEl) return;
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();

  const queryInput = document.getElementById("product-search-query");
  searchResultIndex = -1;
  if (queryInput) {
    queryInput.value = "";
    setTimeout(() => queryInput.focus(), 150);
  }
  renderProductSearchResults(products);
};

const filterProductSearchResults = () => {
  const query = (document.getElementById("product-search-query")?.value || "").toLowerCase().trim();
  searchResultIndex = 0;
  if (!query) {
    renderProductSearchResults(products);
    return;
  }
  const barcodeMatches = products.filter((p) => p.barcode && p.barcode.toLowerCase().includes(query));
  const exactNameMatches = products.filter((p) => p.product_name.toLowerCase() === query);
  const prefixNameMatches = products.filter((p) => p.product_name.toLowerCase().startsWith(query) && p.product_name.toLowerCase() !== query);
  const substrNameMatches = products.filter((p) => !p.product_name.toLowerCase().startsWith(query) && p.product_name.toLowerCase().includes(query));

  const combined = Array.from(new Set([...barcodeMatches, ...exactNameMatches, ...prefixNameMatches, ...substrNameMatches]));
  renderProductSearchResults(combined);
};

const renderProductSearchResults = (items) => {
  const tbody = document.getElementById("product-search-results");
  if (!tbody) return;
  currentSearchResults = items.slice(0, 30);

  if (!currentSearchResults.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">No matching products found.</td></tr>';
    searchResultIndex = -1;
    return;
  }

  if (searchResultIndex < 0 || searchResultIndex >= currentSearchResults.length) {
    searchResultIndex = 0;
  }

  tbody.innerHTML = currentSearchResults
    .map((p, idx) => {
      const isSelected = idx === searchResultIndex;
      const barcodeDisplay = p.barcode || `0000000${p.product_id}`.slice(-8);
      return `
        <tr class="${isSelected ? "table-active pos-row-selected" : ""}" data-result-index="${idx}">
          <td class="font-monospace fw-bold text-primary">${escapeHtml(barcodeDisplay)}</td>
          <td class="fw-semibold">${escapeHtml(p.product_name)}</td>
          <td class="text-end font-monospace">₱${Number(p.price).toFixed(2)}</td>
          <td class="text-center">
            <button type="button" class="btn btn-sm btn-primary py-0 px-2 select-product-btn" data-index="${idx}">
              Add [Enter]
            </button>
          </td>
        </tr>`;
    })
    .join("");

  const activeRow = tbody.querySelector(`tr[data-result-index="${searchResultIndex}"]`);
  activeRow?.scrollIntoView({ block: "nearest" });

  tbody.querySelectorAll("tr").forEach((row) => {
    row.addEventListener("click", () => {
      const idx = Number(row.dataset.resultIndex);
      selectSearchedProduct(idx);
    });
  });
};

const selectSearchedProduct = (index) => {
  const product = currentSearchResults[index];
  if (!product) return;
  const qtyInput = document.getElementById("quantity");
  const qty = Number(qtyInput?.value || 1);
  const activeQty = qty > 0 ? qty : 1;

  addProductToCart(product, activeQty);
  if (qtyInput) qtyInput.value = 1;
  showScanFeedback(`Added ${activeQty}x ${product.product_name} (₱${Number(product.price).toFixed(2)} each)`);

  bootstrap.Modal.getInstance(document.getElementById("product-search-modal"))?.hide();
  focusBarcodeInput();
};

/* ==========================================================================
   Quantity Modifier Modal [F3]
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

const confirmQuantityOverride = async () => {
  const inputEl = document.getElementById("qty-override-input");
  const newQty = Number(inputEl?.value || 0);
  if (newQty <= 0) {
    showError("Quantity must be greater than zero.");
    return;
  }
  const targetIndex = activeCartIndex >= 0 && activeCartIndex < cart.length ? activeCartIndex : cart.length - 1;
  const item = cart[targetIndex];
  if (!item) return;

  if (newQty === item.quantity) {
    bootstrap.Modal.getInstance(document.getElementById("quantity-modal"))?.hide();
    focusBarcodeInput();
    return;
  }

  bootstrap.Modal.getInstance(document.getElementById("quantity-modal"))?.hide();

  try {
    const auth = await requestSupervisorAuth(
      "change_cart_quantity",
      `${item.productName}: Qty ${item.quantity} -> ${newQty}`
    );
    item.quantity = newQty;
    renderCart();
    showScanFeedback(`Updated ${item.productName} qty to ${newQty} (Authorized by ${auth.supervisor?.name || "Supervisor"}).`);
  } catch (err) {
    if (err.message && err.message !== "Cancelled") {
      showError(err.message);
    }
  }
  focusBarcodeInput();
};

/* ==========================================================================
   Void Line Item [F4] & Void Transaction [F5] (Protected by Supervisor)
   ========================================================================== */
const voidActiveItem = async () => {
  if (!cart.length) {
    showScanFeedback("Cart is empty. Nothing to void.", true);
    return;
  }
  const targetIndex = activeCartIndex >= 0 && activeCartIndex < cart.length ? activeCartIndex : cart.length - 1;
  const item = cart[targetIndex];
  if (!item) return;

  try {
    const auth = await requestSupervisorAuth(
      "void_item",
      `${item.productName} (Qty: ${item.quantity}, Price: ₱${item.unitPrice})`
    );
    const removed = cart.splice(targetIndex, 1)[0];
    activeCartIndex = Math.max(0, cart.length - 1);
    renderCart();
    showScanFeedback(`Voided item: ${removed?.productName} (Authorized by ${auth.supervisor?.name || "Supervisor"}).`);
  } catch (err) {
    if (err.message && err.message !== "Cancelled") {
      showError(err.message);
    }
  }
  focusBarcodeInput();
};

const requestVoidTransaction = async () => {
  if (!cart.length) {
    showScanFeedback("Cart is already empty.");
    return;
  }
  const grandTotal = document.getElementById("pos-grand-total")?.textContent || "PHP 0.00";
  try {
    const auth = await requestSupervisorAuth(
      "void_transaction",
      `Cart Total: ${grandTotal} (${cart.length} line items)`
    );
    closeSale();
    showScanFeedback(`Transaction voided (Authorized by ${auth.supervisor?.name || "Supervisor"}).`);
  } catch (err) {
    if (err.message && err.message !== "Cancelled") {
      showError(err.message);
    }
  }
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
                  <tr class="${isActive ? "table-active pos-row-selected" : ""}" data-row-index="${index}">
                    <td class="num-cell text-muted">${index + 1}</td>
                    <td class="fw-semibold">
                      ${escapeHtml(item.productName)}${promoBadge}
                    </td>
                    <td class="text-center num-cell">
                      <span class="fw-bold font-monospace fs-6">${item.quantity}</span>
                    </td>
                    <td class="text-end num-cell">₱${item.unitPrice.toFixed(2)}</td>
                    <td class="text-end num-cell text-success font-monospace row-promo-discount">${promoText}</td>
                    <td class="text-end num-cell fw-bold row-line-total">₱${lineTotal.toFixed(2)}</td>
                    <td class="text-center">
                      <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 remove-item-btn" data-index="${index}" title="Void item [F4] (Supervisor Override)" tabindex="-1">
                        &times;
                      </button>
                    </td>
                  </tr>`;
              })
              .join("")}
          </tbody>
        </table>`;

      const activeCartRow = tableContainer.querySelector(`tr[data-row-index="${activeCartIndex}"]`);
      activeCartRow?.scrollIntoView({ block: "nearest" });

      // Row Selection Click
      tableContainer.querySelectorAll("tbody tr").forEach((row) => {
        row.addEventListener("click", (e) => {
          if (!e.target.closest(".remove-item-btn")) {
            activeCartIndex = Number(row.dataset.rowIndex);
            renderCart();
          }
        });
      });

      // Individual Remove Button -> Triggers Supervisor Override
      tableContainer.querySelectorAll(".remove-item-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          activeCartIndex = Number(btn.dataset.index);
          renderCart();
          voidActiveItem();
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
   Cash Tender [F9] vs AR Credit [F8] Actions
   ========================================================================== */
const triggerCashTender = () => {
  if (!cart.length) {
    showScanFeedback("Cannot tender an empty cart. Scan items first.", true);
    return;
  }
  // Enforce CASH mode on F9 tender
  setSaleMode("Cash");
  openTenderModal();
};

const triggerArCreditSale = () => {
  if (!cart.length) {
    showScanFeedback("Cannot tender an empty cart. Scan items first.", true);
    return;
  }
  setSaleMode("AR");
  const custSelect = document.getElementById("ar_customer_id");
  if (!custSelect?.value) {
    showScanFeedback("AR Credit mode: Please select an AR Customer first.", true);
    custSelect?.focus();
    return;
  }

  const creditCheck = updateCreditEligibility();
  if (!creditCheck?.eligible) {
    showError("This customer does not have enough available credit for this sale.");
    return;
  }

  openTenderModal();
};

const triggerActiveCheckout = () => {
  if (!cart.length) {
    showScanFeedback("Cannot tender an empty cart. Scan items first.", true);
    return;
  }
  const isAr = document.getElementById("sale_type")?.value === "AR";
  if (isAr) {
    triggerArCreditSale();
  } else {
    triggerCashTender();
  }
};

const cycleRegisterLogicalZone = (direction) => {
  currentLogicalZone = currentLogicalZone + direction;
  if (currentLogicalZone > 3) currentLogicalZone = 1;
  if (currentLogicalZone < 1) currentLogicalZone = 3;

  if (currentLogicalZone === 1) {
    const scanInput = document.getElementById("barcode-input");
    if (scanInput) {
      scanInput.focus();
      scanInput.select();
    }
    showScanFeedback("Zone 1: Barcode Scanner");
  } else if (currentLogicalZone === 2) {
    const cartWrapper = document.getElementById("cart-table");
    if (cartWrapper) {
      cartWrapper.focus();
    }
    if (cart.length > 0) {
      if (activeCartIndex < 0) activeCartIndex = 0;
      renderCart();
      showScanFeedback(`Zone 2: Cart Lines (${cart.length} items, use ↑/↓ to navigate)`);
    } else {
      showScanFeedback("Zone 2: Cart (Empty)");
    }
  } else if (currentLogicalZone === 3) {
    const tenderBtn = document.getElementById("btn-open-tender");
    if (tenderBtn) {
      tenderBtn.focus();
    }
    showScanFeedback("Zone 3: Checkout Actions [F9 Cash / F8 AR Credit / F12 Complete]");
  }
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

  // Reset Presets visual highlight
  activePresetIndex = -1;
  document.querySelectorAll(".pos-quick-cash-btn").forEach((btn) => {
    btn.classList.remove("btn-primary", "text-white");
    btn.classList.add("btn-outline-secondary");
  });

  // Toggle AR vs Cash section
  const cashSec = document.getElementById("tender-cash-section");
  const arSec = document.getElementById("tender-ar-section");
  const tenderCashInput = document.getElementById("tender-cash-input");
  const submitBtn = document.getElementById("btn-submit-tender");

  if (cashSec) cashSec.classList.toggle("d-none", isAr);
  if (arSec) arSec.classList.toggle("d-none", !isAr);

  if (isAr) {
    const custSelect = document.getElementById("ar_customer_id");
    const customer = arCustomers.find((c) => String(c.ar_customer_id) === custSelect?.value);
    const balance = Number(customer?.current_balance || 0);
    const limit = Number(customer?.credit_limit || 0);
    const availBefore = Math.max(0, limit - balance);
    const remainAfter = Math.max(0, availBefore - grandTotal);

    if (arSec) {
      arSec.innerHTML = `
        <div class="card p-3 bg-light border shadow-sm">
          <div class="d-flex justify-content-between mb-2">
            <span class="text-muted fw-semibold">AR Customer:</span>
            <strong class="text-dark">${escapeHtml(customer?.customer_name || "Customer")}</strong>
          </div>
          <div class="d-flex justify-content-between mb-2">
            <span class="text-muted">Credit Limit:</span>
            <span class="font-monospace fw-bold">₱${limit.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
          </div>
          <div class="d-flex justify-content-between mb-2">
            <span class="text-muted">Current Balance:</span>
            <span class="font-monospace text-danger fw-bold">₱${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
          </div>
          <div class="d-flex justify-content-between mb-2">
            <span class="text-muted">Available Credit (Before):</span>
            <span class="font-monospace text-success fw-bold">₱${availBefore.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
          </div>
          <hr class="my-2" />
          <div class="d-flex justify-content-between">
            <span class="fw-bold">Available Credit (After Sale):</span>
            <span class="font-monospace text-primary fw-bold fs-6">₱${remainAfter.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      `;
    }
    if (submitBtn) {
      submitBtn.textContent = "CONFIRM AR CREDIT SALE [Enter / F12]";
      submitBtn.disabled = false;
    }
  } else {
    if (tenderCashInput) {
      tenderCashInput.value = "";
      updateSukliCalculator();
    }
    if (submitBtn) {
      submitBtn.textContent = "COMPLETE SALE [Enter / F12]";
    }
  }

  const modalEl = document.getElementById("tender-modal");
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();

  if (!isAr && tenderCashInput) {
    setTimeout(() => {
      tenderCashInput.focus();
      tenderCashInput.select();
    }, 150);
  } else if (isAr && submitBtn) {
    setTimeout(() => {
      submitBtn.focus();
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
      sukliAmountEl.textContent = `Short: -₱${short}`;
      sukliAmountEl.className = "pos-sukli-amount insufficient";
    }
    if (sukliBox) {
      sukliBox.className = "pos-sukli-box insufficient";
    }
    if (submitBtn) submitBtn.disabled = true;
  }
};

const cycleQuickCashPreset = (direction) => {
  const isAr = document.getElementById("sale_type")?.value === "AR";
  if (isAr) return;

  if (activePresetIndex === -1) {
    activePresetIndex = direction > 0 ? 0 : quickCashPresets.length - 1;
  } else {
    activePresetIndex = (activePresetIndex + direction + quickCashPresets.length) % quickCashPresets.length;
  }

  const preset = quickCashPresets[activePresetIndex];
  handleQuickCashPreset(preset);
};

const handleQuickCashPreset = (preset) => {
  const grandTotal = Number(document.getElementById("total-amount")?.value || 0);
  const tenderCashInput = document.getElementById("tender-cash-input");
  if (!tenderCashInput) return;

  activePresetIndex = quickCashPresets.indexOf(preset);

  if (preset === "exact") {
    tenderCashInput.value = grandTotal.toFixed(2);
  } else {
    tenderCashInput.value = Number(preset).toFixed(2);
  }
  updateSukliCalculator();
  tenderCashInput.focus();

  document.querySelectorAll(".pos-quick-cash-btn").forEach((btn) => {
    const isThisPreset = btn.dataset.preset === preset;
    btn.classList.toggle("btn-primary", isThisPreset);
    btn.classList.toggle("text-white", isThisPreset);
    btn.classList.toggle("btn-outline-secondary", !isThisPreset);
  });
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
   2D Spatial Arrow-Key Navigation Architecture
   ========================================================================== */
let currentSpatialFocusEl = null;

const isElementVisible = (el) => {
  if (!el || !el.isConnected) return false;
  if (el.disabled) return false;
  if (el.closest(".d-none") || el.closest('[style*="display: none"]')) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};

const setSpatialFocus = (element) => {
  if (!element || !document.body.contains(element)) return;
  if (element.classList.contains("modal") || element.classList.contains("modal-dialog") || element.classList.contains("modal-content")) return;

  // Clear previous .kb-focus anywhere on page
  document.querySelectorAll(".kb-focus").forEach((el) => {
    el.classList.remove("kb-focus");
  });

  currentSpatialFocusEl = element;
  element.classList.add("kb-focus");

  if (document.activeElement !== element) {
    element.focus();
  }

  if (typeof element.scrollIntoView === "function") {
    element.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
};

const ensureFocusNeverLost = () => {
  if (isAnyModalOpen() || document.querySelector(".swal2-container")) return;
  if (!document.activeElement || document.activeElement === document.body || !document.activeElement.isConnected) {
    const scan = document.getElementById("barcode-input");
    if (scan) {
      setSpatialFocus(scan);
    }
  } else if (!document.querySelector(".kb-focus")) {
    setSpatialFocus(document.activeElement);
  }
};

const getSpatialNavigableElements = () => {
  const openModal = document.querySelector(".modal.show");
  if (openModal) {
    return Array.from(
      openModal.querySelectorAll(
        'button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), a[href]:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter(isElementVisible);
  }

  const activeView = document.querySelector(".pos-view:not(.d-none)") || document.getElementById("view-checkout");
  const candidates = [];

  // Navbar controls
  document.querySelectorAll(".navbar button:not([disabled]), .navbar a:not([disabled])").forEach((el) => {
    if (isElementVisible(el)) candidates.push(el);
  });

  if (activeView) {
    const keySelectors = [
      "#btn-focus-qty",
      "#quantity",
      "#barcode-input",
      "#btn-open-search",
      "#btn-void-item",
      "#btn-void-trans",
      "#cart-table",
      "#btn-mode-cash",
      "#btn-mode-ar",
      "#payment-method-control",
      "#ar_customer_id",
      "#suki-card-status-control",
      "#suki-card-control",
      "#btn-open-tender",
      "#btn-cancel-sale",
      ".pos-hotkey-dock .pos-hotkey-btn",
      "#sales-search-filter",
      "#btn-refresh-sales",
      "#receipt-lookup-id",
      "#btn-reprint-receipt"
    ];

    keySelectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        if (isElementVisible(el) && !candidates.includes(el)) {
          candidates.push(el);
        }
      });
    });

    activeView
      .querySelectorAll('button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), [role="button"]:not([disabled])')
      .forEach((el) => {
        if (isElementVisible(el) && !candidates.includes(el)) {
          candidates.push(el);
        }
      });
  }

  return candidates;
};

const navigateSpatially = (direction) => {
  const current = currentSpatialFocusEl || document.activeElement;
  if (!current || !document.body.contains(current) || current === document.body) {
    const scan = document.getElementById("barcode-input");
    if (scan) setSpatialFocus(scan);
    return;
  }

  // Cart internal navigation
  if (current === document.getElementById("cart-table") || current.closest("#cart-table")) {
    if (direction === "ArrowDown") {
      if (cart.length > 0) {
        if (activeCartIndex < cart.length - 1) {
          activeCartIndex++;
          renderCart();
          setSpatialFocus(document.getElementById("cart-table"));
          return;
        }
      }
    } else if (direction === "ArrowUp") {
      if (cart.length > 0) {
        if (activeCartIndex > 0) {
          activeCartIndex--;
          renderCart();
          setSpatialFocus(document.getElementById("cart-table"));
          return;
        }
      }
    }
  }

  const candidates = getSpatialNavigableElements();
  const rA = current.getBoundingClientRect();
  const cxA = rA.left + rA.width / 2;
  const cyA = rA.top + rA.height / 2;

  let bestCandidate = null;
  let minScore = Infinity;

  for (const candidate of candidates) {
    if (candidate === current) continue;
    if (!isElementVisible(candidate)) continue;

    const rB = candidate.getBoundingClientRect();
    const cxB = rB.left + rB.width / 2;
    const cyB = rB.top + rB.height / 2;

    let isValid = false;
    let primaryDist = 0;
    let secondaryDist = 0;
    let isCrossOverlapping = false;

    switch (direction) {
      case "ArrowRight":
        if (cxB > cxA + 3 || rB.left >= rA.right - 2) {
          isValid = true;
          primaryDist = Math.max(0, rB.left - rA.right);
          secondaryDist = Math.abs(cyB - cyA);
          isCrossOverlapping = (rB.bottom > rA.top + 2 && rB.top < rA.bottom - 2);
        }
        break;

      case "ArrowLeft":
        if (cxB < cxA - 3 || rB.right <= rA.left + 2) {
          isValid = true;
          primaryDist = Math.max(0, rA.left - rB.right);
          secondaryDist = Math.abs(cyB - cyA);
          isCrossOverlapping = (rB.bottom > rA.top + 2 && rB.top < rA.bottom - 2);
        }
        break;

      case "ArrowDown":
        if (cyB > cyA + 3 || rB.top >= rA.bottom - 2) {
          isValid = true;
          primaryDist = Math.max(0, rB.top - rA.bottom);
          secondaryDist = Math.abs(cxB - cxA);
          isCrossOverlapping = (rB.right > rA.left + 2 && rB.left < rA.right - 2);
        }
        break;

      case "ArrowUp":
        if (cyB < cyA - 3 || rB.bottom <= rA.top + 2) {
          isValid = true;
          primaryDist = Math.max(0, rA.top - rB.bottom);
          secondaryDist = Math.abs(cxB - cxA);
          isCrossOverlapping = (rB.right > rA.left + 2 && rB.left < rA.right - 2);
        }
        break;
    }

    if (!isValid) continue;

    const crossWeight = isCrossOverlapping ? 0.35 : 2.5;
    const score = primaryDist + secondaryDist * crossWeight;

    if (score < minScore) {
      minScore = score;
      bestCandidate = candidate;
    }
  }

  if (bestCandidate) {
    setSpatialFocus(bestCandidate);
  }
};

const activateFocusedControl = (e) => {
  const target = currentSpatialFocusEl || document.activeElement;
  if (!target) return;

  if (target === document.getElementById("barcode-input")) {
    e.preventDefault();
    handleBarcodeScan();
    return;
  }

  if (target === document.getElementById("quantity")) {
    e.preventDefault();
    const scan = document.getElementById("barcode-input");
    if (scan) setSpatialFocus(scan);
    return;
  }

  if (target.id === "btn-focus-qty") {
    e.preventDefault();
    focusQuantityInput();
    return;
  }

  if (target.id === "btn-mode-cash") {
    e.preventDefault();
    setSaleMode("Cash");
    showScanFeedback("Switched to CASH Mode (F9)");
    return;
  }

  if (target.id === "btn-mode-ar") {
    e.preventDefault();
    setSaleMode("AR");
    showScanFeedback("Switched to AR CREDIT Mode (F8)");
    return;
  }

  if (target.id === "sale_payment_method_id") {
    const select = target;
    if (select.options.length > 1) {
      e.preventDefault();
      let nextIndex = (select.selectedIndex + 1) % select.options.length;
      if (nextIndex === 0 && select.options.length > 1) nextIndex = 1;
      select.selectedIndex = nextIndex;
      select.dispatchEvent(new Event("change"));
      showScanFeedback(`Payment Method: ${select.options[nextIndex].text}`);
    }
    return;
  }

  if (target.id === "suki_card_status") {
    e.preventDefault();
    target.value = target.value === "Has" ? "None" : "Has";
    target.dispatchEvent(new Event("change"));
    showScanFeedback(`SUKI Card: ${target.value === "Has" ? "Has Card" : "None"}`);
    return;
  }

  if (target.id === "btn-open-tender") {
    e.preventDefault();
    triggerActiveCheckout();
    return;
  }

  if (target.id === "btn-cancel-sale") {
    e.preventDefault();
    requestClearCart();
    return;
  }

  if (target.id === "btn-cashier-logout" || target.id === "btn-topbar-logout") {
    e.preventDefault();
    confirmLogout();
    return;
  }

  if (target.id === "nav-tab-checkout") {
    e.preventDefault();
    switchPosView("view-checkout");
    return;
  }

  if (target.id === "nav-tab-recent") {
    e.preventDefault();
    switchPosView("view-recent-sales");
    return;
  }

  if (target.id === "nav-tab-receipts") {
    e.preventDefault();
    switchPosView("view-receipts");
    return;
  }

  if (typeof target.click === "function") {
    e.preventDefault();
    target.click();
    return;
  }
};

/* ==========================================================================
   Global Keyboard Handler Architecture (Context-Aware Single Dispatcher)
   ========================================================================== */
const handleGlobalShortcuts = (e) => {
  // Prevent ALL Function key browser defaults (Chrome kiosk safety)
  if (/^F[1-9]$|^F1[0-2]$/.test(e.key)) {
    e.preventDefault();
  }

  // Barcode / Scanner typing redirection:
  // If user types alphanumeric characters while focus is on a button or container,
  // redirect immediately to the scan field without triggering button actions.
  const isPrintable = e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && e.key !== " ";
  const activeTag = document.activeElement?.tagName;
  const isTargetTextInput = document.activeElement && (
    (activeTag === "INPUT" && document.activeElement.type !== "radio" && document.activeElement.type !== "checkbox") ||
    activeTag === "TEXTAREA"
  );

  if (openKeyboardDropdown && e.key === "Tab") {
    closeKeyboardDropdown(openKeyboardDropdown, false);
  }

  if (!openKeyboardDropdown && !isAnyModalOpen() && isPrintable && !isTargetTextInput) {
    const scanInput = document.getElementById("barcode-input");
    if (scanInput) {
      setSpatialFocus(scanInput);
      scanInput.focus();
      scanInput.value += e.key;
      e.preventDefault();
      return;
    }
  }

  if (handleKeyboardDropdownKey(e)) return;

  // Context 1: Supervisor Authorization Modal is Open
  const supModal = document.getElementById("supervisor-modal");
  if (supModal && supModal.classList.contains("show")) {
    if (e.key === "Escape") {
      e.preventDefault();
      handleSupervisorCancel();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const userInput = document.getElementById("supervisor-username");
      const passInput = document.getElementById("supervisor-password");
      if (document.activeElement === userInput) {
        passInput?.focus();
      } else {
        handleSupervisorSubmit();
      }
      return;
    }
    return;
  }

  // Context 2: Beginning Cash Modal is Open
  const begModal = document.getElementById("beginning-cash-modal");
  if (begModal && begModal.classList.contains("show")) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeBeginningCash();
      return;
    }
    if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      navigateSpatially(e.key);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (document.activeElement === document.getElementById("btn-close-beginning-cash")) {
        closeBeginningCash();
      } else {
        confirmBeginningCash();
      }
    }
    return;
  }

  // Context 3: Cash Drawer Event Modal is Open
  const drawerModal = document.getElementById("drawer-event-modal");
  if (drawerModal && drawerModal.classList.contains("show")) {
    if (e.key === "Escape") {
      e.preventDefault();
      bootstrap.Modal.getInstance(drawerModal)?.hide();
      focusBarcodeInput();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      submitDrawerEvent();
      return;
    }
    return;
  }

  // Context 4: Product Search Modal is Open
  const searchModal = document.getElementById("product-search-modal");
  if (searchModal && searchModal.classList.contains("show")) {
    if (e.key === "Escape") {
      e.preventDefault();
      bootstrap.Modal.getInstance(searchModal)?.hide();
      focusBarcodeInput();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (currentSearchResults.length > 0) {
        searchResultIndex = (searchResultIndex + 1) % currentSearchResults.length;
        renderProductSearchResults(currentSearchResults);
      }
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (currentSearchResults.length > 0) {
        searchResultIndex = (searchResultIndex - 1 + currentSearchResults.length) % currentSearchResults.length;
        renderProductSearchResults(currentSearchResults);
      }
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (searchResultIndex >= 0 && searchResultIndex < currentSearchResults.length) {
        selectSearchedProduct(searchResultIndex);
      }
      return;
    }
    return;
  }

  // Context 5: Quantity Override Modal is Open
  const qtyModal = document.getElementById("quantity-modal");
  if (qtyModal && qtyModal.classList.contains("show")) {
    if (e.key === "Escape") {
      e.preventDefault();
      bootstrap.Modal.getInstance(qtyModal)?.hide();
      focusBarcodeInput();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      confirmQuantityOverride();
      return;
    }
    return;
  }

  // Context 6: Tender Modal is Open
  const tenderModal = document.getElementById("tender-modal");
  if (tenderModal && tenderModal.classList.contains("show")) {
    if (e.key === "Escape") {
      e.preventDefault();
      const isAr = document.getElementById("sale_type")?.value === "AR";
      const tenderCashInput = document.getElementById("tender-cash-input");
      const tendered = Number(tenderCashInput?.value || 0);
      if (!isAr && tendered > 0) {
        if (!confirm("Tender amount has been entered. Discard payment and return to register?")) {
          return;
        }
      }
      bootstrap.Modal.getInstance(tenderModal)?.hide();
      focusBarcodeInput();
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      cycleQuickCashPreset(1);
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      cycleQuickCashPreset(-1);
      return;
    }
    if (e.key === "Enter" || e.key === "F12") {
      e.preventDefault();
      executeCheckout();
      return;
    }
    return;
  }

  // Context 7: Resume Held Transaction Modal is Open
  const resumeModal = document.getElementById("resume-transaction-modal");
  if (resumeModal && resumeModal.classList.contains("show")) {
    if (e.key === "Escape") {
      e.preventDefault();
      bootstrap.Modal.getInstance(resumeModal)?.hide();
      focusBarcodeInput();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (allHeldTransactions.length > 0) {
        activeHeldRecordIndex = (activeHeldRecordIndex + 1) % allHeldTransactions.length;
        renderHeldTransactionsList(allHeldTransactions);
      }
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (allHeldTransactions.length > 0) {
        activeHeldRecordIndex = (activeHeldRecordIndex - 1 + allHeldTransactions.length) % allHeldTransactions.length;
        renderHeldTransactionsList(allHeldTransactions);
      }
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (allHeldTransactions.length > 0 && activeHeldRecordIndex >= 0 && activeHeldRecordIndex < allHeldTransactions.length) {
        resumeHeldTransaction(allHeldTransactions[activeHeldRecordIndex].held_id);
      }
      return;
    }
    return;
  }

  // Context 8: Hold Transaction Modal is Open
  const holdModal = document.getElementById("hold-transaction-modal");
  if (holdModal && holdModal.classList.contains("show")) {
    if (e.key === "Escape") {
      e.preventDefault();
      bootstrap.Modal.getInstance(holdModal)?.hide();
      focusBarcodeInput();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      executeHold();
      return;
    }
    return;
  }

  // Context 9: Clear Cart Confirmation Modal is Open
  const clearCartModal = document.getElementById("clear-cart-confirm-modal");
  if (clearCartModal && clearCartModal.classList.contains("show")) {
    if (e.key === "Escape") {
      e.preventDefault();
      bootstrap.Modal.getInstance(clearCartModal)?.hide();
      focusBarcodeInput();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      bootstrap.Modal.getInstance(clearCartModal)?.hide();
      closeSale();
      return;
    }
    return;
  }

  // Context 10: Any other modal open (e.g. Hotkey Help, Receipt)
  if (isAnyModalOpen()) {
    if (e.key === "Escape" || e.key === "Enter") {
      e.preventDefault();
      document.querySelectorAll(".modal.show").forEach((m) => {
        bootstrap.Modal.getInstance(m)?.hide();
      });
      focusBarcodeInput();
    }
    return;
  }

  // Context 11: Active POS Checkout Register View

  // Tab: Logical zones navigation
  if (e.key === "Tab") {
    e.preventDefault();
    cycleRegisterLogicalZone(e.shiftKey ? -1 : 1);
    return;
  }

  // Spatial Arrow-Key Navigation across all buttons/controls
  if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
    e.preventDefault();
    navigateSpatially(e.key);
    return;
  }

  // Enter or Space: Activate focused control
  if (e.key === "Enter" || e.key === " ") {
    if (document.activeElement === document.getElementById("barcode-input")) {
      e.preventDefault();
      handleBarcodeScan();
      return;
    }
    if (document.activeElement === document.getElementById("quantity")) {
      e.preventDefault();
      const scan = document.getElementById("barcode-input");
      if (scan) setSpatialFocus(scan);
      return;
    }
    if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "SELECT")) {
      // Allow select or input native action if desirable
      activateFocusedControl(e);
      return;
    }
    activateFocusedControl(e);
    return;
  }

  // Escape: Return to home scan field, or clear cart
  if (e.key === "Escape") {
    e.preventDefault();
    const activeView = document.querySelector(".pos-view:not(.d-none)");
    if (activeView && activeView.id !== "view-checkout") {
      switchPosView("view-checkout");
      setSpatialFocus(document.getElementById("barcode-input"));
      return;
    }
    if (currentSpatialFocusEl && currentSpatialFocusEl !== document.getElementById("barcode-input")) {
      setSpatialFocus(document.getElementById("barcode-input"));
      return;
    }
    if (cart.length > 0) {
      requestClearCart();
    } else {
      showScanFeedback("Register ready.");
    }
    return;
  }

  // Dedicated Function Key Shortcuts
  switch (e.key) {
    case "F1":
      openHotkeyHelpModal();
      break;

    case "F2":
      openProductSearchModal();
      break;

    case "F3":
      focusQuantityInput();
      break;

    case "F4":
      voidActiveItem();
      break;

    case "F5":
      requestVoidTransaction();
      break;

    case "F6":
      openFloatModal();
      break;

    case "F7":
      openLiftModal();
      break;

    case "F8":
      triggerArCreditSale();
      break;

    case "F9":
      triggerCashTender();
      break;

    case "F10":
      openResumeModal();
      break;

    case "F11":
      triggerHoldTransaction();
      break;

    case "F12":
      triggerActiveCheckout();
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
  syncKeyboardDropdown("sale_payment_method_id");
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
    } else {
      if (pointsInput) pointsInput.value = "";
      if (cardCustEl) {
        cardCustEl.textContent = "For an unregistered card, enter the points shown by the customer.";
      }
    }
  }
  syncKeyboardDropdown("suki_card_status");
  syncKeyboardDropdown("suki_card_id");
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

const triggerHoldTransaction = async () => {
  if (!cart.length) {
    showScanFeedback("Cart is empty. Nothing to hold.", true);
    return;
  }
  const totalItems = cart.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
  const grandTotalStr = document.getElementById("pos-grand-total")?.textContent || "PHP 0.00";

  try {
    const auth = await requestSupervisorAuth(
      "hold",
      `Hold ${totalItems} items (${grandTotalStr})`
    );

    // Prompt optional note in hold modal
    const modalEl = document.getElementById("hold-transaction-modal");
    if (!modalEl) {
      await executeHold();
      return;
    }
    const itemCountEl = document.getElementById("hold-item-count");
    const totalAmountEl = document.getElementById("hold-total-amount");
    if (itemCountEl) itemCountEl.textContent = `${totalItems} items (${cart.length} line items)`;
    if (totalAmountEl) totalAmountEl.textContent = grandTotalStr;

    const custSelect = document.getElementById("ar_customer_id");
    const selectedCustomer = custSelect?.value ? arCustomers.find((c) => String(c.ar_customer_id) === custSelect.value) : null;
    const labelInput = document.getElementById("hold-customer-label");
    if (labelInput) {
      labelInput.value = selectedCustomer ? selectedCustomer.customer_name : (activeHoldRef ? `Continuation of ${activeHoldRef}` : `Cart ${new Date().toLocaleTimeString()}`);
    }

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
    setTimeout(() => {
      labelInput?.focus();
      labelInput?.select();
    }, 150);
  } catch (err) {
    if (err.message && err.message !== "Cancelled") {
      showError(err.message);
    }
    focusBarcodeInput();
  }
};

const openHoldModal = () => {
  triggerHoldTransaction();
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
  focusBarcodeInput();
};

const openResumeModal = async () => {
  const modalEl = document.getElementById("resume-transaction-modal");
  if (!modalEl) return;

  const listTbody = document.getElementById("held-transactions-list");
  if (listTbody) {
    listTbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Loading held transactions...</td></tr>';
  }

  activeHeldRecordIndex = 0;
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
    activeHeldRecordIndex = -1;
    return;
  }

  if (activeHeldRecordIndex < 0 || activeHeldRecordIndex >= records.length) {
    activeHeldRecordIndex = 0;
  }

  listTbody.innerHTML = records
    .map((h, idx) => {
      const isSelected = idx === activeHeldRecordIndex;
      const isResumed = activeHeldId && Number(activeHeldId) === Number(h.held_id);
      return `
        <tr class="${isSelected ? "table-active pos-row-selected" : (isResumed ? "table-warning" : "")}" data-held-index="${idx}">
          <td class="font-monospace fw-bold text-primary">${escapeHtml(h.hold_reference)}</td>
          <td class="fw-semibold">${escapeHtml(h.customer_label || "No note")}</td>
          <td class="small text-muted font-monospace">${escapeHtml(h.created_at)}</td>
          <td class="text-center fw-bold">${h.item_count}</td>
          <td class="text-end font-monospace fw-bold">PHP ${Number(h.total_amount).toFixed(2)}</td>
          <td class="text-center text-nowrap">
            <button type="button" class="btn btn-sm ${isSelected ? "btn-warning text-dark fw-bold" : (isResumed ? "btn-secondary" : "btn-primary")} py-0 px-2 resume-action-btn" data-held-id="${h.held_id}" ${isResumed ? "disabled" : ""} tabindex="-1">
              ${isResumed ? "Resumed" : "Resume [Enter]"}
            </button>
            <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 ms-1 discard-action-btn" data-held-id="${h.held_id}" title="Discard held transaction" tabindex="-1">
              &times;
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  const activeRow = listTbody.querySelector(`tr[data-held-index="${activeHeldRecordIndex}"]`);
  activeRow?.scrollIntoView({ block: "nearest" });

  listTbody.querySelectorAll("tr").forEach((row) => {
    row.addEventListener("click", () => {
      activeHeldRecordIndex = Number(row.dataset.heldIndex);
      renderHeldTransactionsList(records);
    });
  });

  listTbody.querySelectorAll(".resume-action-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const heldId = Number(btn.dataset.heldId);
      resumeHeldTransaction(heldId);
    });
  });

  listTbody.querySelectorAll(".discard-action-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
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

  // Hide the list modal while supervisor authorizes
  bootstrap.Modal.getInstance(document.getElementById("resume-transaction-modal"))?.hide();

  // Prompt supervisor authorization (retrieving held transaction audit risk)
  let auth = null;
  try {
    auth = await requestSupervisorAuth(
      "retrieve_held",
      `Recall Ref: ${held.hold_reference} (PHP ${Number(held.total_amount).toFixed(2)})`
    );
  } catch (err) {
    if (err.message && err.message !== "Cancelled") {
      showError(err.message);
    }
    focusBarcodeInput();
    return;
  }

  // Restore cart items
  cart = (held.items || []).map((item) => {
    const prod = products.find((p) => Number(p.product_id) === Number(item.productId));
    return {
      productId: Number(item.productId),
      barcode: item.barcode || prod?.barcode || "",
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

  document.getElementById("held-sale-status-badge")?.classList.remove("d-none");
  updateSaleTypeFields();
  updateSukiFields();
  renderCart();
  await updateHeldTransactionsBadge();
  showScanFeedback(`Resumed held sale ${held.hold_reference} (Authorized by ${auth?.supervisor?.name || "Supervisor"}).`);
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

/* ==========================================================================
   Revisions: Supervisor Override Authorization Logic
   ========================================================================== */
const requestSupervisorAuth = (actionType, targetRef = "") => {
  return new Promise((resolve, reject) => {
    supervisorAuthResolve = resolve;
    supervisorAuthReject = reject;
    activeSupervisorActionType = actionType;
    activeSupervisorTargetRef = targetRef;

    const modalEl = document.getElementById("supervisor-modal");
    if (!modalEl) {
      reject(new Error("Supervisor modal element missing in page."));
      return;
    }
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

    const actionBadge = document.getElementById("supervisor-action-label");
    if (actionBadge) {
      const formattedAction = actionType.replace(/_/g, " ").toUpperCase();
      actionBadge.textContent = `Action: ${formattedAction} ${targetRef ? `[${targetRef}]` : ""}`;
    }

    const userInput = document.getElementById("supervisor-username");
    const passInput = document.getElementById("supervisor-password");
    const errMsg = document.getElementById("supervisor-error-msg");

    if (userInput) userInput.value = "";
    if (passInput) passInput.value = "";
    if (errMsg) {
      errMsg.textContent = "";
      errMsg.classList.add("d-none");
    }

    modal.show();
    setTimeout(() => {
      userInput?.focus();
    }, 150);
  });
};

const handleSupervisorSubmit = async () => {
  const userInput = document.getElementById("supervisor-username");
  const passInput = document.getElementById("supervisor-password");
  const errMsg = document.getElementById("supervisor-error-msg");
  const actionLabel = document.getElementById("supervisor-action-label")?.textContent || "";

  const username = userInput?.value.trim();
  const password = passInput?.value;

  if (!username || !password) {
    if (errMsg) {
      errMsg.textContent = "Please enter both supervisor username and password.";
      errMsg.classList.remove("d-none");
    }
    if (!username) userInput?.focus();
    else passInput?.focus();
    return;
  }

  try {
    const formData = new FormData();
    formData.append("action", "verify_supervisor");
    formData.append("operation", "verify_supervisor");
    formData.append(
      "json",
      JSON.stringify({
        username,
        password,
        action_type: activeSupervisorActionType || actionLabel.replace("Action: ", "").split("[")[0].trim().toLowerCase().replace(/\s+/g, "_"),
        target_reference: activeSupervisorTargetRef || actionLabel,
        shift_id: currentShiftId
      })
    );

    const { data } = await axios.post("api/auth.php?action=verify_supervisor", formData, { withCredentials: true });
    if (data.returnValue === 1 && data.authorized) {
      bootstrap.Modal.getInstance(document.getElementById("supervisor-modal"))?.hide();
      if (supervisorAuthResolve) {
        supervisorAuthResolve(data);
        supervisorAuthResolve = null;
        supervisorAuthReject = null;
      }
    } else {
      if (errMsg) {
        errMsg.textContent = data.message || "Invalid supervisor credentials.";
        errMsg.classList.remove("d-none");
      }
      passInput?.focus();
      passInput?.select();
    }
  } catch (err) {
    if (errMsg) {
      errMsg.textContent = err.response?.data?.message || err.message || "Supervisor verification failed.";
      errMsg.classList.remove("d-none");
    }
    passInput?.focus();
    passInput?.select();
  }
};

const handleSupervisorCancel = () => {
  bootstrap.Modal.getInstance(document.getElementById("supervisor-modal"))?.hide();
  if (supervisorAuthReject) {
    supervisorAuthReject(new Error("Cancelled"));
    supervisorAuthResolve = null;
    supervisorAuthReject = null;
  }
  focusBarcodeInput();
};

/* ==========================================================================
   Revisions: Beginning Cash & Shift Management
   ========================================================================== */
const checkAndPromptShift = async () => {
  try {
    const { data } = await axios.get(apiUrl, {
      params: { operation: "getActiveShift" },
      withCredentials: true
    });
    if (data.activeShift && data.activeShift.shift_id) {
      currentShiftId = Number(data.activeShift.shift_id);
      updateShiftBadge(currentShiftId, data.activeShift.opening_cash);
      focusBarcodeInput();
    } else {
      currentShiftId = null;
      updateShiftBadge(null, 0);
      promptBeginningCash();
    }
  } catch (err) {
    console.error("Shift check error:", err);
    showError("Unable to verify the active shift.");
    throw err;
  }
};

const closeBeginningCash = () => {
  bootstrap.Modal.getInstance(document.getElementById("beginning-cash-modal"))?.hide();
};

const promptBeginningCash = () => {
  const modalEl = document.getElementById("beginning-cash-modal");
  if (!modalEl) return;

  const titleEl = document.getElementById("begCashModalLabel");
  const confirmBtn = document.getElementById("btn-confirm-beginning-cash");
  const endShiftBtn = document.getElementById("btn-end-shift");

  if (currentShiftId) {
    if (titleEl) {
      titleEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-cash-stack me-2" viewBox="0 0 16 16"><path d="M1 3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1zm7 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4"/><path d="M0 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1zm3 0a2 2 0 0 1-2 2v4a2 2 0 0 1 2 2h10a2 2 0 0 1 2-2V7a2 2 0 0 1-2-2z"/></svg>SHIFT #${currentShiftId}: BEGINNING CASH / FUND`;
    }
    if (confirmBtn) confirmBtn.textContent = "UPDATE SHIFT FUND / RESUME [Enter]";
    if (endShiftBtn) endShiftBtn.classList.remove("d-none");
  } else {
    if (titleEl) {
      titleEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-cash-stack me-2" viewBox="0 0 16 16"><path d="M1 3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1zm7 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4"/><path d="M0 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1zm3 0a2 2 0 0 1-2 2v4a2 2 0 0 1 2 2h10a2 2 0 0 1 2-2V7a2 2 0 0 1-2-2z"/></svg>OPENING SHIFT: BEGINNING CASH`;
    }
    if (confirmBtn) confirmBtn.textContent = "OPEN REGISTER & START SHIFT [Enter]";
    if (endShiftBtn) endShiftBtn.classList.add("d-none");
  }

  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  modal.show();
  const input = document.getElementById("beginning-cash-input");
  setTimeout(() => {
    if (input) {
      setSpatialFocus(input);
      input.focus();
      input.select();
    }
  }, 150);
};

const confirmBeginningCash = async () => {
  const input = document.getElementById("beginning-cash-input");
  const amount = parseFloat(input?.value || "0");
  if (isNaN(amount) || amount < 0) {
    showError("Please enter a valid starting cash balance (>= 0.00).");
    input?.focus();
    return;
  }

  try {
    const formData = new FormData();
    formData.append("operation", "openShift");
    formData.append("json", JSON.stringify({ openingCash: amount }));

    const { data } = await axios.post(apiUrl, formData, { withCredentials: true });
    if (data.returnValue === 1 && data.shift) {
      currentShiftId = Number(data.shift.shift_id);
      updateShiftBadge(currentShiftId, data.shift.opening_cash);
      bootstrap.Modal.getInstance(document.getElementById("beginning-cash-modal"))?.hide();
      showScanFeedback(`Shift #${currentShiftId} active with ₱${amount.toFixed(2)} beginning cash.`);
      if (currentUser?.role_name === "Cashier") {
        startSale();
      }
      focusBarcodeInput();
    } else {
      showError(data.message || "Failed to open shift.");
    }
  } catch (err) {
    showError(err.response?.data?.message || err.message || "Error opening shift.");
  }
};

const endActiveShift = async () => {
  const res = await showConfirm({
    title: "Close Current Shift?",
    text: `Are you sure you want to end Shift #${currentShiftId}? You can open a new shift afterwards.`,
    confirmButtonText: "Yes, End Shift",
    isDestructive: true
  });
  if (!res.isConfirmed) return;

  try {
    const formData = new FormData();
    formData.append("operation", "closeShift");
    const { data } = await axios.post(apiUrl, formData, { withCredentials: true });
    if (data.returnValue === 1) {
      currentShiftId = null;
      updateShiftBadge(null, 0);
      bootstrap.Modal.getInstance(document.getElementById("beginning-cash-modal"))?.hide();
      showScanFeedback("Shift closed successfully. Open a new shift to continue transactions.");
    } else {
      showError(data.message || "Failed to close shift.");
    }
  } catch (err) {
    showError(err.response?.data?.message || err.message || "Error closing shift.");
  }
};

const updateShiftBadge = (shiftId, openingCash) => {
  const shiftBadge = document.getElementById("pos-shift-badge");
  if (shiftBadge) {
    if (shiftId) {
      shiftBadge.textContent = `SHIFT #${shiftId} (FLOAT: ₱${Number(openingCash).toFixed(2)})`;
      shiftBadge.className = "badge bg-info text-dark border-0 px-2 py-1 fw-bold cursor-pointer";
      shiftBadge.title = "Click to view shift beginning cash";
      shiftBadge.classList.remove("d-none");
    } else {
      shiftBadge.textContent = "NO ACTIVE SHIFT";
      shiftBadge.className = "badge bg-warning text-dark border-0 px-2 py-1 fw-bold cursor-pointer";
      shiftBadge.title = "Click to open shift with beginning cash";
      shiftBadge.classList.remove("d-none");
    }
  }
};

/* ==========================================================================
   Revisions: Cash Drawer Events (Float & Lift)
   ========================================================================== */
const openFloatModal = () => {
  activeDrawerEventType = "float";
  const modalEl = document.getElementById("drawer-event-modal");
  const badge = document.getElementById("drawer-event-badge");
  const amountInput = document.getElementById("drawer-event-amount");
  const notesInput = document.getElementById("drawer-event-notes");

  if (badge) {
    badge.textContent = "CASH FLOAT: ADD CHANGE FUND";
    badge.className = "badge bg-success fs-6 px-3 py-2 fw-bold";
  }
  if (amountInput) amountInput.value = "500.00";
  if (notesInput) notesInput.value = "Replenish change fund coins/small bills";

  bootstrap.Modal.getOrCreateInstance(modalEl).show();
  setTimeout(() => {
    amountInput?.focus();
    amountInput?.select();
  }, 150);
};

const openLiftModal = () => {
  activeDrawerEventType = "lift";
  const modalEl = document.getElementById("drawer-event-modal");
  const badge = document.getElementById("drawer-event-badge");
  const amountInput = document.getElementById("drawer-event-amount");
  const notesInput = document.getElementById("drawer-event-notes");

  if (badge) {
    badge.textContent = "CASH LIFT / DROP: REMOVE EXCESS CASH";
    badge.className = "badge bg-warning text-dark fs-6 px-3 py-2 fw-bold";
  }
  if (amountInput) amountInput.value = "5000.00";
  if (notesInput) notesInput.value = "Mid-shift excess cash pickup";

  bootstrap.Modal.getOrCreateInstance(modalEl).show();
  setTimeout(() => {
    amountInput?.focus();
    amountInput?.select();
  }, 150);
};

const submitDrawerEvent = async () => {
  const amountInput = document.getElementById("drawer-event-amount");
  const notesInput = document.getElementById("drawer-event-notes");
  const amount = parseFloat(amountInput?.value || "0");
  const notes = notesInput?.value.trim() || "";

  if (isNaN(amount) || amount <= 0) {
    showError("Please enter a valid positive amount.");
    amountInput?.focus();
    return;
  }

  bootstrap.Modal.getInstance(document.getElementById("drawer-event-modal"))?.hide();

  try {
    const auth = await requestSupervisorAuth(
      activeDrawerEventType === "float" ? "cash_float" : "lift",
      `Amount: ₱${amount.toFixed(2)}${notes ? " - " + notes : ""}`
    );

    const formData = new FormData();
    formData.append("operation", "recordDrawerEvent");
    formData.append(
      "json",
      JSON.stringify({
        shiftId: currentShiftId,
        eventType: activeDrawerEventType,
        amount: amount,
        authorizedBy: auth.supervisor?.user_id,
        notes: notes
      })
    );

    const { data } = await axios.post(apiUrl, formData, { withCredentials: true });
    if (data.returnValue === 1) {
      showScanFeedback(
        `Recorded ${activeDrawerEventType.toUpperCase()}: ₱${amount.toFixed(2)} (Authorized by ${auth.supervisor?.name || "Supervisor"}).`
      );
    }
  } catch (err) {
    if (err.message && err.message !== "Cancelled") {
      showError(err.response?.data?.message || err.message);
    }
  }
  focusBarcodeInput();
};

/* ==========================================================================
   Revisions: Hotkey Reference Help Modal [F1]
   ========================================================================== */
const openHotkeyHelpModal = () => {
  const modalEl = document.getElementById("hotkey-reference-modal");
  if (modalEl) {
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPosRegister);
} else {
  initPosRegister();
}
