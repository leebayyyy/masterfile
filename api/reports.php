<?php
require_once "auth-lib.php";
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$user = requireRoles(["Admin", "Manager", "Accounts Receivable Staff", "Supervisor"]);
include "connection-pdo.php";
$operation = $_GET['operation'] ?? '';

function validReportDate($value) {
  if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
    return false;
  }
  [$year, $month, $day] = array_map('intval', explode('-', $value));
  return checkdate($month, $day, $year);
}

if ($operation === 'summary') {
  $date = $_GET['date'] ?? date('Y-m-d');
  if (!validReportDate($date)) {
    http_response_code(422);
    echo json_encode(["message" => "A valid report date is required."]);
    exit;
  }

  $salesStmt = $conn->prepare(
    "SELECT COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total,
            COALESCE(SUM(tax_total), 0) AS tax
     FROM tblsales
     WHERE sale_date = :reportDate"
  );
  $salesStmt->execute([":reportDate" => $date]);
  $sales = $salesStmt->fetch(PDO::FETCH_ASSOC);

  $ar = $conn->query(
    "SELECT COUNT(*) AS invoices, COALESCE(SUM(balance), 0) AS invoice_outstanding
     FROM tblar_invoice
     WHERE status <> 'Pending' AND COALESCE(balance, 0) > 0"
  )->fetch(PDO::FETCH_ASSOC);
  $pendingSales = $conn->query(
    "SELECT COUNT(*) AS count, COALESCE(SUM(s.total_amount), 0) AS total
     FROM tblsales s
     WHERE s.sale_type='AR' AND s.ar_customer_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM tblar_invoice i WHERE i.sale_id=s.sale_id)"
  )->fetch(PDO::FETCH_ASSOC);
  $ar['pending_sales'] = $pendingSales['count'];
  $ar['pending_sales_total'] = $pendingSales['total'];
  $ar['outstanding'] = (float)$ar['invoice_outstanding'] + (float)$pendingSales['total'];
  $overdue = $conn->query(
    "SELECT COUNT(*) AS count, COALESCE(SUM(balance), 0) AS balance
     FROM tblar_invoice
     WHERE status <> 'Pending' AND COALESCE(balance, 0) > 0
       AND due_date < CURRENT_DATE"
  )->fetch(PDO::FETCH_ASSOC);
  $ar['overdue_invoices'] = (int)$overdue['count'];
  $ar['overdue_balance'] = $overdue['balance'];

  $paymentsStmt = $conn->prepare(
    "SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
     FROM tblpayment_header
     WHERE payment_date = :reportDate"
  );
  $paymentsStmt->execute([":reportDate" => $date]);
  $payments = $paymentsStmt->fetch(PDO::FETCH_ASSOC);

  $promotionSummaryStmt = $conn->prepare(
    "SELECT COUNT(DISTINCT s.sale_id) AS sale_count,
            COALESCE(SUM(d.promo_discount), 0) AS total_discount
     FROM tblsales s
     INNER JOIN tblsales_detail d ON d.sale_id=s.sale_id
     WHERE s.sale_date=:reportDate AND d.promo_id IS NOT NULL"
  );
  $promotionSummaryStmt->execute([":reportDate" => $date]);
  $promotionSummary = $promotionSummaryStmt->fetch(PDO::FETCH_ASSOC);

  $dailySalesStmt = $conn->prepare(
    "SELECT s.sale_id, s.sale_date, s.sale_type, s.total_amount, s.balance,
            COALESCE((SELECT SUM(sd.promo_discount) FROM tblsales_detail sd WHERE sd.sale_id=s.sale_id), 0) AS promotion_discount,
            (SELECT GROUP_CONCAT(DISTINCT pr.promo_name ORDER BY pr.promo_name SEPARATOR ', ')
             FROM tblsales_detail sd INNER JOIN tblpromo pr ON pr.promo_id=sd.promo_id
             WHERE sd.sale_id=s.sale_id) AS promotions_applied,
            t.terminal_name, CONCAT(u.first_name, ' ', u.last_name) AS cashier,
            pm.method_name AS payment_method,
            c.customer_name
     FROM tblsales s
     INNER JOIN tblpos_terminals t ON t.pos_terminal_id=s.pos_terminal_id
     INNER JOIN tblusers u ON u.user_id=s.cashier_user_id
     LEFT JOIN tblar_customers c ON c.ar_customer_id=s.ar_customer_id
     LEFT JOIN tblpayment_method pm ON pm.payment_method_id=s.payment_method_id
     WHERE s.sale_date=:reportDate
     ORDER BY s.sale_id DESC"
  );
  $dailySalesStmt->execute([":reportDate" => $date]);

  $terminalSalesStmt = $conn->prepare(
    "SELECT t.pos_terminal_id, t.terminal_name, COUNT(s.sale_id) AS sale_count,
            COALESCE(SUM(s.total_amount), 0) AS sales_total
     FROM tblpos_terminals t
     LEFT JOIN tblsales s ON s.pos_terminal_id=t.pos_terminal_id AND s.sale_date=:reportDate
     GROUP BY t.pos_terminal_id, t.terminal_name
     ORDER BY t.terminal_name"
  );
  $terminalSalesStmt->execute([":reportDate"=>$date]);

  $invoices = $conn->query(
    "SELECT i.ar_invoice_id, i.invoice_number, i.invoice_date, i.due_date,
            i.invoice_amount, i.balance, i.status, c.customer_name,
            CASE
              WHEN i.due_date IS NULL THEN 'No due date'
              WHEN i.due_date < CURRENT_DATE THEN 'Overdue'
              WHEN i.due_date = CURRENT_DATE THEN 'Due today'
              ELSE 'Current'
            END AS collection_status,
            CASE
              WHEN i.due_date < CURRENT_DATE THEN DATEDIFF(CURRENT_DATE, i.due_date)
              ELSE 0
            END AS days_overdue
     FROM tblar_invoice i
     INNER JOIN tblar_customers c ON c.ar_customer_id=i.ar_customer_id
     WHERE i.status <> 'Pending' AND COALESCE(i.balance, 0) > 0
     ORDER BY (CASE WHEN i.due_date < CURRENT_DATE THEN 1 ELSE 0 END) DESC, i.due_date ASC, c.customer_name, i.invoice_number"
  )->fetchAll(PDO::FETCH_ASSOC);

  $customerBalances = $conn->query(
    "SELECT c.ar_customer_id, c.customer_name, c.credit_limit,
            COALESCE(i.invoice_balance, 0) AS invoice_balance,
            COALESCE(i.open_invoice_count, 0) AS open_invoice_count,
            COALESCE(s.pending_balance, 0) AS pending_balance,
            COALESCE(s.pending_sale_count, 0) AS pending_sale_count,
            COALESCE(i.invoice_balance, 0) + COALESCE(s.pending_balance, 0) AS total_balance,
            c.credit_limit - COALESCE(i.invoice_balance, 0) - COALESCE(s.pending_balance, 0) AS available_credit
     FROM tblar_customers c
     LEFT JOIN (
       SELECT ar_customer_id, SUM(balance) AS invoice_balance, COUNT(*) AS open_invoice_count
       FROM tblar_invoice
       WHERE status <> 'Pending' AND COALESCE(balance, 0) > 0
       GROUP BY ar_customer_id
     ) i ON i.ar_customer_id=c.ar_customer_id
     LEFT JOIN (
       SELECT s.ar_customer_id, SUM(s.total_amount) AS pending_balance, COUNT(*) AS pending_sale_count
       FROM tblsales s
       WHERE s.sale_type='AR' AND s.ar_customer_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM tblar_invoice ai WHERE ai.sale_id=s.sale_id)
       GROUP BY s.ar_customer_id
     ) s ON s.ar_customer_id=c.ar_customer_id
     WHERE COALESCE(i.invoice_balance, 0) > 0 OR COALESCE(s.pending_balance, 0) > 0 OR c.credit_limit > 0
     ORDER BY total_balance DESC, c.customer_name"
  )->fetchAll(PDO::FETCH_ASSOC);

  $dailyPaymentsStmt = $conn->prepare(
    "SELECT h.payment_id, h.payment_date, h.amount, h.reference_number,
            i.invoice_number, i.status AS invoice_status, i.balance AS invoice_balance,
            c.customer_name, m.method_name,
            CONCAT(u.first_name, ' ', u.last_name) AS processed_by
     FROM tblpayment_header h
     INNER JOIN tblpayment_detail d ON d.payment_id=h.payment_id
     INNER JOIN tblar_invoice i ON i.ar_invoice_id=d.ar_invoice_id
     INNER JOIN tblar_customers c ON c.ar_customer_id=i.ar_customer_id
     INNER JOIN tblpayment_method m ON m.payment_method_id=h.payment_method_id
     INNER JOIN tblusers u ON u.user_id=h.processed_by_user_id
     WHERE h.payment_date=:reportDate
     ORDER BY h.payment_id DESC"
  );
  $dailyPaymentsStmt->execute([":reportDate" => $date]);

  echo json_encode([
    "date" => $date,
    "sales" => $sales,
    "ar" => $ar,
    "payments" => $payments,
    "promotions" => $promotionSummary,
    "dailySales" => $dailySalesStmt->fetchAll(PDO::FETCH_ASSOC),
    "terminalSales" => $terminalSalesStmt->fetchAll(PDO::FETCH_ASSOC),
    "invoices" => $invoices,
    "customerBalances" => $customerBalances,
    "dailyPayments" => $dailyPaymentsStmt->fetchAll(PDO::FETCH_ASSOC)
  ]);
  exit;
}

http_response_code(400);
echo json_encode(["message" => "Invalid report operation."]);
?>
