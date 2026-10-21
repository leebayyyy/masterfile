<?php
require_once "auth-lib.php";
  header('Content-Type: application/json');
  header("Access-Control-Allow-Origin: *");

  function getPaymentFormData($user){
    include "connection-pdo.php";
    $invoices = $conn->query(
      "SELECT a.ar_invoice_id, a.invoice_number, a.balance, b.customer_name
       FROM tblar_invoice a
       INNER JOIN tblar_customers b ON a.ar_customer_id = b.ar_customer_id
       WHERE COALESCE(a.balance, 0) > 0 AND a.status <> 'Pending'
       ORDER BY a.invoice_number"
    )->fetchAll(PDO::FETCH_ASSOC);
    $methods = $conn->query(
      "SELECT payment_method_id, method_name
       FROM tblpayment_method
       WHERE is_active = 1
       ORDER BY method_name"
    )->fetchAll(PDO::FETCH_ASSOC);
    $customers = $conn->query(
      "SELECT c.ar_customer_id, c.customer_name, c.credit_limit,
              COALESCE(SUM(i.balance), 0) AS total_debt,
              COUNT(CASE WHEN COALESCE(i.balance, 0) > 0 THEN 1 END) AS open_invoice_count
       FROM tblar_customers c
       LEFT JOIN tblar_invoice i ON i.ar_customer_id = c.ar_customer_id AND i.status <> 'Pending' AND COALESCE(i.balance, 0) > 0
       WHERE c.is_active = 1
       GROUP BY c.ar_customer_id, c.customer_name, c.credit_limit
       ORDER BY c.customer_name"
    )->fetchAll(PDO::FETCH_ASSOC);
    return json_encode([
      "invoices" => $invoices,
      "customers" => $customers,
      "paymentMethods" => $methods,
      "canRecordPayment" => in_array($user['role_name'], ['Accounts Receivable Staff', 'Cashier', 'Admin', 'Manager'], true)
    ]);
  }

  function getAllPayments(){
    include "connection-pdo.php";
    $sql = "SELECT h.payment_id, h.payment_date, h.amount, h.reference_number, h.notes,
                   COALESCE(STRING_AGG(DISTINCT i.invoice_number, ', '), '—') AS invoice_number,
                   c.customer_name, m.method_name,
                   COUNT(DISTINCT d.ar_invoice_id) AS invoice_count
            FROM tblpayment_header h
            LEFT JOIN tblpayment_detail d ON h.payment_id = d.payment_id
            LEFT JOIN tblar_invoice i ON d.ar_invoice_id = i.ar_invoice_id
            LEFT JOIN tblar_customers c ON i.ar_customer_id = c.ar_customer_id
            LEFT JOIN tblpayment_method m ON h.payment_method_id = m.payment_method_id
            GROUP BY h.payment_id, h.payment_date, h.amount, h.reference_number, h.notes, c.customer_name, m.method_name
            ORDER BY h.payment_id DESC";
    return json_encode($conn->query($sql)->fetchAll(PDO::FETCH_ASSOC));
  }

  function getPaymentAllocations($paymentId){
    include "connection-pdo.php";
    $pid = filter_var($paymentId, FILTER_VALIDATE_INT);
    if (!$pid) {
      http_response_code(400);
      return json_encode(["returnValue" => 0, "message" => "Invalid payment ID."]);
    }
    $hdrStmt = $conn->prepare(
      "SELECT h.payment_id, h.payment_date, h.amount, h.reference_number, h.notes,
              m.method_name, u.fullname AS processed_by
       FROM tblpayment_header h
       LEFT JOIN tblpayment_method m ON h.payment_method_id = m.payment_method_id
       LEFT JOIN tblusers u ON h.processed_by_user_id = u.user_id
       WHERE h.payment_id = :pid"
    );
    $hdrStmt->execute([":pid" => $pid]);
    $header = $hdrStmt->fetch(PDO::FETCH_ASSOC);

    $allocStmt = $conn->prepare(
      "SELECT a.allocation_id, a.invoice_id, a.amount_applied, a.created_at,
              i.invoice_number, i.invoice_date, i.invoice_amount, i.balance AS remaining_balance, i.status AS invoice_status,
              c.customer_name
       FROM tblpayment_allocations a
       INNER JOIN tblar_invoice i ON a.invoice_id = i.ar_invoice_id
       INNER JOIN tblar_customers c ON i.ar_customer_id = c.ar_customer_id
       WHERE a.payment_id = :pid
       ORDER BY a.allocation_id ASC"
    );
    $allocStmt->execute([":pid" => $pid]);
    $allocations = $allocStmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($allocations)) {
      $detailStmt = $conn->prepare(
        "SELECT d.payment_detail_id AS allocation_id, d.ar_invoice_id AS invoice_id, d.applied_amount AS amount_applied, d.applied_date AS created_at,
                i.invoice_number, i.invoice_date, i.invoice_amount, i.balance AS remaining_balance, i.status AS invoice_status,
                c.customer_name
         FROM tblpayment_detail d
         INNER JOIN tblar_invoice i ON d.ar_invoice_id = i.ar_invoice_id
         INNER JOIN tblar_customers c ON i.ar_customer_id = c.ar_customer_id
         WHERE d.payment_id = :pid
         ORDER BY d.payment_detail_id ASC"
      );
      $detailStmt->execute([":pid" => $pid]);
      $allocations = $detailStmt->fetchAll(PDO::FETCH_ASSOC);
    }

    return json_encode([
      "returnValue" => 1,
      "header" => $header,
      "allocations" => $allocations
    ]);
  }

  function getAllInvoices(){
    include "connection-pdo.php";
    // Auto-approve unbilled AR sales so they have invoices
    $unbilled = $conn->query(
      "SELECT s.sale_id, s.sale_date, s.total_amount, s.ar_customer_id, s.cashier_user_id, COALESCE(ct.days, 30) AS days
       FROM tblsales s
       INNER JOIN tblar_customers c ON c.ar_customer_id=s.ar_customer_id
       LEFT JOIN tblar_customer_types ct ON ct.customer_type_id=c.customer_type_id
       WHERE s.sale_type='AR' AND NOT EXISTS (SELECT 1 FROM tblar_invoice i WHERE i.sale_id=s.sale_id)"
    )->fetchAll(PDO::FETCH_ASSOC);
    foreach ($unbilled as $ub) {
      $invNumber = "INV-" . str_pad((string)$ub['sale_id'], 8, "0", STR_PAD_LEFT);
      $ins = $conn->prepare(
        "INSERT INTO tblar_invoice (invoice_number, ar_customer_id, sale_id, created_by_user_id, invoice_date, due_date, invoice_amount, balance, status)
         VALUES (:number, :customerId, :saleId, :userId, :saleDate, (CAST(:saleDate2 AS date) + (CAST(:days AS integer) * INTERVAL '1 day'))::date, :amount, :balance, 'Approved')"
      );
      $ins->execute([
        ":number" => $invNumber,
        ":customerId" => $ub['ar_customer_id'],
        ":saleId" => $ub['sale_id'],
        ":userId" => $ub['cashier_user_id'],
        ":saleDate" => $ub['sale_date'],
        ":saleDate2" => $ub['sale_date'],
        ":days" => (int)$ub['days'],
        ":amount" => $ub['total_amount'],
        ":balance" => $ub['total_amount']
      ]);
    }

    $sql = "SELECT i.ar_invoice_id, i.invoice_number, i.invoice_date, i.due_date,
                   i.invoice_amount, i.balance, i.status, c.customer_name, c.ar_customer_id,
                   CASE
                     WHEN COALESCE(i.balance, 0) <= 0 THEN 'Paid'
                     WHEN i.due_date IS NULL THEN 'No due date'
                     WHEN i.due_date < CURRENT_DATE THEN 'Overdue'
                     WHEN i.due_date = CURRENT_DATE THEN 'Due today'
                     ELSE 'Current'
                   END AS collection_status,
                   CASE
                     WHEN COALESCE(i.balance, 0) > 0 AND i.due_date < CURRENT_DATE
                     THEN (CURRENT_DATE - i.due_date)
                     ELSE 0
                   END AS days_overdue
            FROM tblar_invoice i
            INNER JOIN tblar_customers c ON c.ar_customer_id = i.ar_customer_id
            WHERE i.status <> 'Pending'
            ORDER BY i.ar_invoice_id DESC";
    return json_encode($conn->query($sql)->fetchAll(PDO::FETCH_ASSOC));
  }

  function paymentAmountToCents($value){
    if (!is_string($value) && !is_int($value) && !is_float($value)) {
      return null;
    }
    $amount = (string)$value;
    if (!preg_match('/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/', $amount)) {
      return null;
    }
    [$whole, $fraction] = array_pad(explode('.', $amount, 2), 2, '');
    return ((int)$whole * 100) + (int)str_pad($fraction, 2, '0');
  }

  function validPaymentDate($value){
    if (!is_string($value)) {
      return false;
    }
    $date = DateTime::createFromFormat('!Y-m-d', $value);
    return $date && $date->format('Y-m-d') === $value;
  }

  function insertPayment($json){
    include "connection-pdo.php";
    $data = json_decode($json, true);
    $user = requireLogin();
    $amountCents = is_array($data) ? paymentAmountToCents($data['amount'] ?? null) : null;
    $invoiceId = is_array($data) ? filter_var($data['invoiceId'] ?? null, FILTER_VALIDATE_INT) : false;
    $paymentMethodId = is_array($data) ? filter_var($data['paymentMethodId'] ?? null, FILTER_VALIDATE_INT) : false;
    $paymentDate = is_array($data) ? ($data['paymentDate'] ?? null) : null;
    if ($amountCents === null || $amountCents <= 0 || !$invoiceId || $invoiceId < 1 ||
        !$paymentMethodId || $paymentMethodId < 1 || !validPaymentDate($paymentDate)) {
      http_response_code(422);
      return json_encode(["message" => "Enter a valid invoice, payment date, positive amount, and payment method."]);
    }
    $amount = intdiv($amountCents, 100) . "." . str_pad((string)($amountCents % 100), 2, '0', STR_PAD_LEFT);

    try {
      $conn->beginTransaction();
      $invoiceStmt = $conn->prepare(
        "SELECT balance, status FROM tblar_invoice
         WHERE ar_invoice_id = :invoiceId AND status <> 'Pending' FOR UPDATE"
      );
      $invoiceStmt->execute([":invoiceId" => $invoiceId]);
      $invoice = $invoiceStmt->fetch(PDO::FETCH_ASSOC);
      $balanceCents = $invoice ? paymentAmountToCents((string)$invoice['balance']) : null;
      if ($balanceCents === null || $balanceCents <= 0 || $amountCents > $balanceCents) {
        $conn->rollBack();
        http_response_code(422);
        return json_encode(["message" => "Payment amount cannot exceed the invoice balance."]);
      }

      $methodStmt = $conn->prepare(
        "SELECT payment_method_id FROM tblpayment_method
         WHERE payment_method_id = :methodId AND is_active = 1"
      );
      $methodStmt->execute([":methodId" => $paymentMethodId]);
      if (!$methodStmt->fetchColumn()) {
        $conn->rollBack();
        http_response_code(422);
        return json_encode(["message" => "Select a valid active payment method."]);
      }

      $referenceNumber = "PAY-" . date("Ymd") . "-" . bin2hex(random_bytes(8));
      $headerStmt = $conn->prepare(
        "INSERT INTO tblpayment_header
          (payment_date, amount, payment_method_id, processed_by_user_id, reference_number, notes)
         VALUES (:paymentDate, :amount, :paymentMethodId, :processedByUserId, :referenceNumber, :notes)
         RETURNING payment_id"
      );
      $headerStmt->execute([
        ":paymentDate" => $paymentDate,
        ":amount" => $amount,
        ":paymentMethodId" => $paymentMethodId,
        ":processedByUserId" => $user['user_id'],
        ":referenceNumber" => $referenceNumber,
        ":notes" => $data['notes'] ?? null
      ]);
      $paymentId = $headerStmt->fetchColumn();

      $detailStmt = $conn->prepare(
        "INSERT INTO tblpayment_detail (payment_id, ar_invoice_id, applied_amount, applied_date)
         VALUES (:paymentId, :invoiceId, :amount, :paymentDate)"
      );
      $detailStmt->execute([
        ":paymentId" => $paymentId,
        ":invoiceId" => $invoiceId,
        ":amount" => $amount,
        ":paymentDate" => $paymentDate
      ]);

      $newBalanceCents = $balanceCents - $amountCents;
      $newBalance = intdiv($newBalanceCents, 100) . "." . str_pad((string)($newBalanceCents % 100), 2, '0', STR_PAD_LEFT);
      $status = $newBalanceCents === 0 ? "Paid" : "Partially Paid";
      $updateStmt = $conn->prepare(
        "UPDATE tblar_invoice SET balance = :balance, status = :status
         WHERE ar_invoice_id = :invoiceId"
      );
      $updateStmt->execute([
        ":balance" => $newBalance,
        ":status" => $status,
        ":invoiceId" => $invoiceId
      ]);
      $conn->commit();
      return json_encode([
        "returnValue" => 1,
        "paymentId" => $paymentId,
        "referenceNumber" => $referenceNumber,
        "invoiceStatus" => $status,
        "remainingBalance" => $newBalance
      ]);
    } catch (PDOException $e) {
      if ($conn->inTransaction()) {
        $conn->rollBack();
      }
      error_log("Unable to save payment: " . $e->getMessage());
      http_response_code(500);
      return json_encode(["message" => "Unable to save payment."]);
    }
  }

  function previewFifoAllocation($json) {
    include "connection-pdo.php";
    $data = json_decode($json, true) ?: [];
    $customerId = filter_var($data['customerId'] ?? ($data['ar_customer_id'] ?? null), FILTER_VALIDATE_INT);
    $amountCents = paymentAmountToCents($data['amount'] ?? null);

    if (!$customerId || $customerId < 1 || $amountCents === null || $amountCents <= 0) {
      http_response_code(422);
      return json_encode(["returnValue" => 0, "message" => "Please select an AR customer and enter a valid positive payment amount."]);
    }

    $stmt = $conn->prepare(
      "SELECT ar_invoice_id, invoice_number, invoice_date, due_date, invoice_amount, balance, status
       FROM tblar_invoice
       WHERE ar_customer_id = :customerId AND COALESCE(balance, 0) > 0 AND status <> 'Pending'
       ORDER BY invoice_date ASC, ar_invoice_id ASC"
    );
    $stmt->execute([":customerId" => $customerId]);
    $invoices = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($invoices)) {
      http_response_code(422);
      return json_encode(["returnValue" => 0, "message" => "This customer has no outstanding unpaid invoices."]);
    }

    $remainingPaymentCents = $amountCents;
    $allocations = [];
    $totalDebtCents = 0;

    foreach ($invoices as $inv) {
      $invBalCents = paymentAmountToCents((string)$inv['balance']) ?: 0;
      $totalDebtCents += $invBalCents;

      if ($remainingPaymentCents > 0) {
        $applyCents = min($remainingPaymentCents, $invBalCents);
        $newBalCents = $invBalCents - $applyCents;
        $remainingPaymentCents -= $applyCents;

        $allocations[] = [
          "invoice_id" => (int)$inv['ar_invoice_id'],
          "invoice_number" => $inv['invoice_number'],
          "invoice_date" => $inv['invoice_date'],
          "due_date" => $inv['due_date'],
          "invoice_amount" => (float)$inv['invoice_amount'],
          "current_balance" => (float)number_format($invBalCents / 100, 2, '.', ''),
          "amount_applied" => (float)number_format($applyCents / 100, 2, '.', ''),
          "remaining_balance" => (float)number_format($newBalCents / 100, 2, '.', ''),
          "resulting_status" => $newBalCents === 0 ? "Paid" : "Partially Paid"
        ];
      } else {
        $allocations[] = [
          "invoice_id" => (int)$inv['ar_invoice_id'],
          "invoice_number" => $inv['invoice_number'],
          "invoice_date" => $inv['invoice_date'],
          "due_date" => $inv['due_date'],
          "invoice_amount" => (float)$inv['invoice_amount'],
          "current_balance" => (float)number_format($invBalCents / 100, 2, '.', ''),
          "amount_applied" => 0.00,
          "remaining_balance" => (float)number_format($invBalCents / 100, 2, '.', ''),
          "resulting_status" => $inv['status']
        ];
      }
    }

    $totalAppliedCents = $amountCents - $remainingPaymentCents;
    $newTotalDebtCents = max(0, $totalDebtCents - $totalAppliedCents);

    return json_encode([
      "returnValue" => 1,
      "customer_id" => $customerId,
      "total_payment_entered" => (float)number_format($amountCents / 100, 2, '.', ''),
      "total_applied" => (float)number_format($totalAppliedCents / 100, 2, '.', ''),
      "unallocated_amount" => (float)number_format($remainingPaymentCents / 100, 2, '.', ''),
      "total_current_debt" => (float)number_format($totalDebtCents / 100, 2, '.', ''),
      "new_customer_debt" => (float)number_format($newTotalDebtCents / 100, 2, '.', ''),
      "allocations" => $allocations
    ]);
  }

  function insertFifoPayment($json, $user) {
    include "connection-pdo.php";
    $data = json_decode($json, true) ?: [];
    $customerId = filter_var($data['customerId'] ?? ($data['ar_customer_id'] ?? null), FILTER_VALIDATE_INT);
    $amountCents = paymentAmountToCents($data['amount'] ?? null);
    $paymentMethodId = filter_var($data['paymentMethodId'] ?? null, FILTER_VALIDATE_INT);
    $paymentDate = $data['paymentDate'] ?? date('Y-m-d');
    $notes = trim($data['notes'] ?? '');

    if (!$customerId || $customerId < 1 || $amountCents === null || $amountCents <= 0 ||
        !$paymentMethodId || $paymentMethodId < 1 || !validPaymentDate($paymentDate)) {
      http_response_code(422);
      return json_encode(["returnValue" => 0, "message" => "Please provide a valid customer, positive payment amount, payment method, and payment date."]);
    }

    try {
      $conn->beginTransaction();

      $methodStmt = $conn->prepare("SELECT payment_method_id, method_name FROM tblpayment_method WHERE payment_method_id = :mid AND is_active = 1");
      $methodStmt->execute([":mid" => $paymentMethodId]);
      $method = $methodStmt->fetch(PDO::FETCH_ASSOC);
      if (!$method) {
        $conn->rollBack();
        http_response_code(422);
        return json_encode(["returnValue" => 0, "message" => "Invalid payment method selected."]);
      }

      $invoiceStmt = $conn->prepare(
        "SELECT ar_invoice_id, invoice_number, invoice_date, due_date, invoice_amount, balance, status
         FROM tblar_invoice
         WHERE ar_customer_id = :customerId AND COALESCE(balance, 0) > 0 AND status <> 'Pending'
         ORDER BY invoice_date ASC, ar_invoice_id ASC FOR UPDATE"
      );
      $invoiceStmt->execute([":customerId" => $customerId]);
      $invoices = $invoiceStmt->fetchAll(PDO::FETCH_ASSOC);

      if (empty($invoices)) {
        $conn->rollBack();
        http_response_code(422);
        return json_encode(["returnValue" => 0, "message" => "Customer has no outstanding unpaid invoices."]);
      }

      $totalDebtCents = 0;
      foreach ($invoices as $inv) {
        $totalDebtCents += paymentAmountToCents((string)$inv['balance']) ?: 0;
      }

      $remainingPaymentCents = $amountCents;
      $totalAppliedCents = min($amountCents, $totalDebtCents);
      $paymentTotalFormatted = number_format($totalAppliedCents / 100, 2, '.', '');

      $referenceNumber = "PAY-" . date("Ymd") . "-" . bin2hex(random_bytes(8));
      $headerStmt = $conn->prepare(
        "INSERT INTO tblpayment_header (payment_date, amount, payment_method_id, processed_by_user_id, reference_number, notes)
         VALUES (:paymentDate, :amount, :paymentMethodId, :processedByUserId, :referenceNumber, :notes)
         RETURNING payment_id"
      );
      $headerStmt->execute([
        ":paymentDate" => $paymentDate,
        ":amount" => $paymentTotalFormatted,
        ":paymentMethodId" => $paymentMethodId,
        ":processedByUserId" => $user['user_id'],
        ":referenceNumber" => $referenceNumber,
        ":notes" => $notes ?: "FIFO Allocation Settlement"
      ]);
      $paymentId = (int)$headerStmt->fetchColumn();

      $allocatedRecords = [];
      $allocStmt = $conn->prepare(
        "INSERT INTO tblpayment_allocations (payment_id, invoice_id, amount_applied, created_at)
         VALUES (:paymentId, :invoiceId, :amountApplied, CURRENT_TIMESTAMP)"
      );
      $detailStmt = $conn->prepare(
        "INSERT INTO tblpayment_detail (payment_id, ar_invoice_id, applied_amount, applied_date)
         VALUES (:paymentId, :invoiceId, :amountApplied, :paymentDate)"
      );
      $updateInvStmt = $conn->prepare(
        "UPDATE tblar_invoice SET balance = :balance, status = :status WHERE ar_invoice_id = :invoiceId"
      );

      foreach ($invoices as $inv) {
        if ($remainingPaymentCents <= 0) break;
        $invBalCents = paymentAmountToCents((string)$inv['balance']) ?: 0;
        $applyCents = min($remainingPaymentCents, $invBalCents);
        $newBalCents = $invBalCents - $applyCents;
        $remainingPaymentCents -= $applyCents;

        $applyFormatted = number_format($applyCents / 100, 2, '.', '');
        $newBalFormatted = number_format($newBalCents / 100, 2, '.', '');
        $status = $newBalCents === 0 ? "Paid" : "Partially Paid";

        $allocStmt->execute([
          ":paymentId" => $paymentId,
          ":invoiceId" => $inv['ar_invoice_id'],
          ":amountApplied" => $applyFormatted
        ]);

        $detailStmt->execute([
          ":paymentId" => $paymentId,
          ":invoiceId" => $inv['ar_invoice_id'],
          ":amountApplied" => $applyFormatted,
          ":paymentDate" => $paymentDate
        ]);

        $updateInvStmt->execute([
          ":balance" => $newBalFormatted,
          ":status" => $status,
          ":invoiceId" => $inv['ar_invoice_id']
        ]);

        $allocatedRecords[] = [
          "invoice_id" => (int)$inv['ar_invoice_id'],
          "invoice_number" => $inv['invoice_number'],
          "applied_amount" => (float)$applyFormatted,
          "remaining_balance" => (float)$newBalFormatted,
          "status" => $status
        ];
      }

      $conn->commit();

      $expStmt = $conn->prepare(
        "SELECT c.ar_customer_id, c.customer_name, c.credit_limit,
                COALESCE(i.invoice_balance, 0) AS credit_exposure,
                c.credit_limit - COALESCE(i.invoice_balance, 0) AS available_credit
         FROM tblar_customers c
         LEFT JOIN (
           SELECT ar_customer_id, SUM(balance) AS invoice_balance FROM tblar_invoice
           WHERE status <> 'Pending' AND COALESCE(balance, 0) > 0 GROUP BY ar_customer_id
         ) i ON i.ar_customer_id=c.ar_customer_id
         WHERE c.ar_customer_id = :cid"
      );
      $expStmt->execute([":cid" => $customerId]);
      $updatedCustomer = $expStmt->fetch(PDO::FETCH_ASSOC);

      return json_encode([
        "returnValue" => 1,
        "paymentId" => $paymentId,
        "referenceNumber" => $referenceNumber,
        "totalApplied" => (float)$paymentTotalFormatted,
        "allocations" => $allocatedRecords,
        "customer" => $updatedCustomer
      ]);

    } catch (Throwable $e) {
      if ($conn->inTransaction()) $conn->rollBack();
      error_log("FIFO payment failure: " . $e->getMessage());
      http_response_code(500);
      return json_encode(["returnValue" => 0, "message" => "Unable to process FIFO payment: " . $e->getMessage()]);
    }
  }

  $operation = $_SERVER['REQUEST_METHOD'] === 'GET' ? ($_GET['operation'] ?? '') : ($_POST['operation'] ?? '');
  $json = $_SERVER['REQUEST_METHOD'] === 'GET' ? ($_GET['json'] ?? '') : ($_POST['json'] ?? '');
  switch ($operation) {
    case "getPaymentFormData":
      $user = requireRoles(["Admin", "Cashier", "Accounts Receivable Staff", "Manager"]);
      echo getPaymentFormData($user);
      break;
    case "getAllPayments":
      requireRoles(["Admin", "Cashier", "Accounts Receivable Staff", "Manager"]);
      echo getAllPayments();
      break;
    case "getAllInvoices":
      requireRoles(["Admin", "Cashier", "Accounts Receivable Staff", "Manager"]);
      echo getAllInvoices();
      break;
    case "previewFifoAllocation":
      requireRoles(["Admin", "Cashier", "Accounts Receivable Staff", "Manager"]);
      echo previewFifoAllocation($json);
      break;
    case "insertFifoPayment":
      $user = requireRoles(["Admin", "Cashier", "Accounts Receivable Staff", "Manager"]);
      echo insertFifoPayment($json, $user);
      break;
    case "insertPayment":
      requireRoles(["Accounts Receivable Staff", "Admin", "Manager", "Cashier"]);
      echo insertPayment($json);
      break;
    case "getPaymentAllocations":
      requireRoles(["Admin", "Cashier", "Accounts Receivable Staff", "Manager"]);
      $pid = $_SERVER['REQUEST_METHOD'] === 'GET' ? ($_GET['payment_id'] ?? ($_GET['id'] ?? null)) : ($_POST['payment_id'] ?? null);
      echo getPaymentAllocations($pid);
      break;
    default:
      http_response_code(400);
      echo json_encode(["message" => "Invalid payment operation."]);
  }
?>
