# POS & AR System — Localhost Defense Runbook & Demo Guide

This runbook contains the exact steps and commands to launch, configure, and demonstrate the **PHP + PostgreSQL Point of Sale (POS) & Accounts Receivable (AR) System** on **LOCALHOST** for final defense. It requires **no active internet connection** once local setup is complete.

---

## 1. System Requirements & Local Prerequisites

| Component | Path / Requirement | Status / Note |
|---|---|---|
| **PHP Engine** | `C:\xampp\php\php.exe` (PHP 8.0.30+) | `pdo_pgsql` and `pgsql` extensions must be enabled in `php.ini` |
| **PostgreSQL** | PostgreSQL 14+ on `localhost:5432` | Standard install, pgAdmin 4, or Docker container |
| **Web Browser** | Google Chrome or Microsoft Edge | Supports kiosk/app mode for zero-mouse cashier testing |

---

## 2. Database Setup & Migrations

### Option A: Initialize Database from Scratch (Clean Setup)
Open PowerShell or Command Prompt:

```powershell
# 1. Create the database
createdb -U postgres -h localhost pos_ar_system

# 2. Run the master schema and seed script
psql -U postgres -h localhost -d pos_ar_system -f "c:\Users\orcuu\OneDrive\Documents\project\masterfile3\masterfile\database\pos_ar_system.pg.sql"
```

### Option B: Migrate Existing Database
If `pos_ar_system` already exists, run the incremental migration:

```powershell
psql -U postgres -h localhost -d pos_ar_system -f "c:\Users\orcuu\OneDrive\Documents\project\masterfile3\masterfile\database\revisions_migration.sql"
```

### Verify Database Tables:
Run this quick query in `psql`:
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
```
Ensure `tblshifts`, `tbldrawer_events`, `tblauthorization_log`, and `tblpayment_allocations` are present.

---

## 3. Local Environment Configuration

1. In the `api/` folder, copy the example configuration:
   ```powershell
   Copy-Item "c:\Users\orcuu\OneDrive\Documents\project\masterfile3\masterfile\api\config.local.php.example" "c:\Users\orcuu\OneDrive\Documents\project\masterfile3\masterfile\api\config.local.php"
   ```

2. Open `api/config.local.php` and verify your local PostgreSQL credentials:
   ```php
   return [
     'db_host'   => 'localhost',
     'db_port'   => 5432,
     'db_name'   => 'pos_ar_system',
     'db_user'   => 'postgres',
     'db_pass'   => 'postgres',       // Match your local postgres user password
     'ssl_mode'  => 'disable'         // 'disable' allows localhost without SSL certs
   ];
   ```

---

## 4. Starting the Local PHP Server

Run the built-in PHP server from the workspace root:

```powershell
cd "c:\Users\orcuu\OneDrive\Documents\project\masterfile3\masterfile"
C:\xampp\php\php.exe -S localhost:8000
```

> **Note:** Leave this terminal running in the background throughout the defense demo.

---

## 5. Launching the POS Terminal in Defense Kiosk Mode

To demonstrate the **"Gaisano-Style" zero-mouse cashier register** without browser shortcut conflicts (like F1 opening Chrome Help, F3 opening Find, F5 refreshing, or F11 toggling fullscreen), launch Chrome in kiosk app mode:

```powershell
# Google Chrome Kiosk Mode:
start chrome.exe --kiosk --app=http://localhost:8000/login.html

# OR Standard App Window Mode (Frameless window):
start chrome.exe --app=http://localhost:8000/login.html

# (Optional: Microsoft Edge App Mode)
start msedge.exe --app=http://localhost:8000/login.html
```

*(To exit Kiosk Mode at any time, press `Alt + F4` or `Esc`)*

---

## 6. Seed Accounts & Roles

| Role | Username | Password | Purpose |
|---|---|---|---|
| **Supervisor** | `supervisor` | `supervisor123` | Authorizes voids, line overrides, cash float, and cash lift |
| **Cashier** | `cashier` | `cashier123` | Operates cashier terminal, scanning, tender, hold/resume |
| **Admin** | `admin` | `admin123` | Full system configuration, roles, terminals, products |
| **AR Staff** | `ar_staff` | `ar123` | Handles credit limits, invoices, and FIFO collections |

---

## 7. Step-by-Step Defense Demo Script

### Demo 1: Beginning Cash & Shift Protection (Zero-Mouse Login)
1. Navigate to `http://localhost:8000/login.html`.
2. Login as `cashier` / `cashier123`.
3. System detects no open shift for today and displays the **Mandatory Beginning Cash / Starting Balance** modal.
4. Type `2000.00` and press **Enter**.
5. Shift is opened in `tblshifts` with status `open` and starting balance ₱2,000.00.
6. Re-logging in as cashier during the same shift does **not** prompt again.

### Demo 2: Quantity-First Scanning Workflow ("Una ang Quantity, Ayha Scanning")
1. At the register (`sales.html`), notice cursor is automatically placed in the **QTY [F3]** field.
2. Type `5` and press **Enter**.
3. Cursor instantly jumps to the **SCAN BARCODE** field.
4. Type barcode `00000001` (or scan barcode) and press **Enter**.
5. Product is added to the cart with **Quantity: 5**.
6. The Quantity field **automatically resets to 1** and cursor remains ready in the barcode field for the next scan.
7. Repeat without typing quantity: press Enter or scan barcode `00000002` -> item adds with default quantity 1.

### Demo 3: Product Lookup (Product ID Hidden from Cashier)
1. Press **F2** to open Product Lookup.
2. Notice the table headers: only **Barcode**, **Product Name**, and **Price** are shown. The internal `product_id` is completely hidden from the cashier.
3. Type a product name (e.g. `Milk` or `Coffee`).
4. Use **Arrow Down** and **Arrow Up** to navigate rows.
5. Press **Enter** to add the selected product to the cart.

### Demo 4: Supervisor Authorization for Protected Actions
1. **Void Line Item**:
   - Navigate cart lines using **Arrow Down / Arrow Up**.
   - Press **F4** to void the selected item.
   - Cashier is blocked by the **Supervisor Override Modal**.
   - Enter `supervisor` and `supervisor123` and press **Enter**.
   - Line is voided. Action is recorded in `tblauthorization_log` (`action_type: void_item`).
2. **Change Cart Item Quantity**:
   - Press **F3** when an item is selected in the cart.
   - Enter new quantity. Supervisor authorization prompt intercepts.
   - Upon supervisor verification, quantity is updated and logged (`action_type: edit_quantity`).
3. **Void Entire Transaction**:
   - Press **F5**.
   - Prompts for supervisor credentials.
   - Upon supervisor verification, cart is emptied and logged (`action_type: void_transaction`).

### Demo 5: Cash Drawer Float & Lift
1. Press **F6** (Float Fund):
   - Enter amount added to drawer (e.g. `500.00`).
   - Supervisor credentials entered.
   - Record created in `tbldrawer_events` (`event_type: 'float'`).
2. Press **F7** (Lift / Drop Fund):
   - Enter amount removed to safe (e.g. `1000.00`).
   - Supervisor credentials entered.
   - Record created in `tbldrawer_events` (`event_type: 'lift'`).

### Demo 6: Tender & Completed Cash Sale Recording
1. Scan items to total ₱450.00.
2. Press **F9** to open Tender / Payment modal.
3. Select Cash Tender (`C`), type `500.00`, and press **Enter**.
4. System displays Change: `₱50.00`.
5. Press **F12** to complete the sale.
6. Receipt prints.
7. Backend automatically creates a `tbldrawer_events` record with `event_type: 'sale'`, linked to the active shift.

### Demo 7: AR Payment — FIFO Auto-Allocation
1. Navigate to **Payments & Collections** (`payment.html`).
2. Click **Record FIFO Payment** (or press Pay).
3. Select an AR Customer with open invoices (e.g. `ABC Enterprises`).
4. Notice dynamic exposure card updates with Credit Limit, Total Debt, and Available Credit.
5. Enter a single payment amount (e.g. `₱3,500.00`).
6. Click **Preview Allocation** (or press **Enter**).
7. The **FIFO Cascade Preview** displays:
   - Queue #1 (Oldest invoice) receives payment first until settled.
   - Remaining balance cascades to Queue #2, #3, etc.
   - Preview shows: Current Balance, Amount Applied, Resulting Balance, Resulting Status.
   - Summary shows Total Entered, Total Applied, Unapplied, and New Customer Debt.
8. Press **Enter** to confirm.
9. Backend saves `tblpayment_header`, `tblpayment_allocations`, and `tblpayment_detail` in a single atomic transaction.
10. Customer credit exposure updates immediately.
11. The **Official AR Collection Receipt Modal** pops up with the full breakdown of settled invoices and a Print button.

---

## 8. Hotkey Summary (Printable Reference)

| Key | Action | Protected? | Notes |
|---|---|---|---|
| **F1** | Help / Hotkey Card | No | Opens shortcut cheat sheet |
| **F2** | Product Lookup | No | Search barcode/name; Arrows + Enter to pick |
| **F3** | Quantity Field | Partial | Una ang quantity; existing line qty edit requires supervisor |
| **F4** | Void Line Item | **SUPERVISOR** | Requires supervisor username + password |
| **F5** | Void Transaction | **SUPERVISOR** | Requires supervisor username + password |
| **F6** | Cash Float | **SUPERVISOR** | Adds change fund to drawer |
| **F7** | Cash Lift / Drop | **SUPERVISOR** | Removes excess cash to safe |
| **F8** | Hold Transaction | No | Suspends current cart |
| **F9** | Tender / Payment | No | Opens tender screen |
| **F10** | Resume Transaction | No | Recalls held cart |
| **F12** | Complete Sale | No | Finalizes sale and prints receipt |
| **Enter** | Confirm / Scan / Add | No | Context-aware execution key |
| **Esc** | Cancel / Close Modal | No | Safely exits dialogs without losing transaction |
| **Up / Down** | Navigate Rows | No | Selects items in cart or lookup table |
