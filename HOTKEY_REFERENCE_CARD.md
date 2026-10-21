# 🏷️ GAISANO-STYLE POS TERMINAL — CASHIER HOTKEY REFERENCE CARD

> **DEFENSE DEMO QUICK-REFERENCE**  
> *Zero-Mouse POS Terminal Workflow: Designed for high-speed keypad and function-key cashier operations.*

---

## ⚡ Main Function Key Operations

| Key | Operation / Command | Access Level | Description & Operational Flow |
|:---:|:---|:---:|:---|
| <kbd>F1</kbd> | **Help & Reference** | All Staff | Pops up the keyboard hotkey reference guide on screen. |
| <kbd>F2</kbd> | **Product Lookup** | Cashier | Search items by barcode or description. Navigate with <kbd>↑</kbd> <kbd>↓</kbd> and press <kbd>Enter</kbd> to add. *(Product ID hidden from cashier view)* |
| <kbd>F3</kbd> | **Quantity Field** | Cashier / Supervisor* | Focuses quantity input for quantity-first scan (`[Qty]` → <kbd>Enter</kbd> → `[Barcode]`). <br>*Editing an existing cart line requires Supervisor Override. |
| <kbd>F4</kbd> | **Void Line Item** | **SUPERVISOR** | Deletes the currently selected item in the transaction cart. Prompts for supervisor credentials and logs audit entry. |
| <kbd>F5</kbd> | **Void Entire Transaction** | **SUPERVISOR** | Clears the entire cart and aborts the ongoing sale. Requires supervisor approval. |
| <kbd>F6</kbd> | **Cash Float (Change Fund)** | **SUPERVISOR** | Adds starting/supplemental change cash into the drawer. Records event in `tbldrawer_events`. |
| <kbd>F7</kbd> | **Cash Lift / Drop (Skim)** | **SUPERVISOR** | Transfers excess cash from drawer to secure safe. Requires supervisor credentials. |
| <kbd>F8</kbd> | **Hold Transaction** | Cashier | Parks current transaction cart in temporary memory to serve another customer. |
| <kbd>F9</kbd> | **Payment / Tender** | Cashier | Opens the tender screen with payment method options (Cash, AR Customer, Card). |
| <kbd>F10</kbd> | **Resume Transaction** | Cashier | Recalls and re-opens the most recently held transaction. |
| <kbd>F12</kbd> | **Complete Sale** | Cashier | Finalizes the payment, triggers drawer kick, prints receipt, and resets cart. Auto-records cash event. |

---

## ⌨️ Navigation & Confirmation Keys

| Key | Context | Action / Result |
|:---:|:---|:---|
| <kbd>Enter</kbd> | **Quantity Field** | Confirms quantity multiplier, auto-selects barcode scan field. |
| <kbd>Enter</kbd> | **Barcode Field** | Scans/adds item with designated quantity, resets qty to `1`, stays focused in barcode field. |
| <kbd>Enter</kbd> | **Lookup Modal** | Selects highlighted product from table and inserts it into cart. |
| <kbd>Enter</kbd> | **Tender Field** | Confirms amount tendered and calculates change. |
| <kbd>Enter</kbd> | **AR FIFO Modal** | Generates FIFO cascade preview or confirms allocation. |
| <kbd>Esc</kbd> | **Any Modal / Action** | Dismisses current dialog/modal. Safely cancels action without clearing sale. |
| <kbd>↑</kbd> / <kbd>↓</kbd> | **Cart Line Table** | Moves active cursor between transaction items (for void or inspection). |
| <kbd>↑</kbd> / <kbd>↓</kbd> | **Product Lookup** | Moves selection highlight up and down search results. |
| <kbd>Tab</kbd> | **Register Screen** | Moves focus between primary zones (Scan Bar ↔ Cart Table ↔ Totals). |

---

## 🔒 Protected Actions Requiring Supervisor Authorization

The following actions **immediately prompt for supervisor credentials** (`supervisor` / `supervisor123`) and log the event in `tblauthorization_log`:

1. **Void Cart Item (<kbd>F4</kbd>)**
2. **Void Transaction (<kbd>F5</kbd>)**
3. **Change Quantity of Existing Item in Cart (<kbd>F3</kbd>)**
4. **Cash Float Addition (<kbd>F6</kbd>)**
5. **Cash Lift / Drop (<kbd>F7</kbd>)**

---

## 📋 Quantity-First Scan Rules ("Una ang Quantity, Ayha Scanning")

```
[Type Quantity (e.g. 12)] ──► Press [Enter] ──► [Scan/Enter Barcode] ──► Added: 12x Product
                                                                              │
                                       Auto-resets Quantity back to 1 ◄───────┘
                                       Focus automatically stays in Barcode Scan Bar
```

---

## 💵 Shift & Cash Drawer Lifecycle

1. **Beginning Cash Prompt**: Triggered automatically once per day/shift upon login. Re-login during an active shift does not re-prompt.
2. **Mid-Shift Float / Lift**: Registered under `tbldrawer_events` with supervisor stamp.
3. **Completed Cash Sales**: Automatically appended to `tbldrawer_events` with `event_type = 'sale'`.
4. **End-of-Shift Balancing**: Cash drawer expected total = `Opening Cash + Cash Sales + Floats - Lifts`.
