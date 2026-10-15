<?php
header('Content-Type: application/json');

$cronSecret = getenv('CRON_SECRET') ?: ($_ENV['CRON_SECRET'] ?? ($_SERVER['CRON_SECRET'] ?? ''));

// Validate secret is configured on the server
if (empty($cronSecret)) {
  http_response_code(500);
  echo json_encode([
    "success" => false,
    "error" => "CRON_SECRET environment variable is not configured on server."
  ]);
  exit;
}

// Extract token from Authorization: Bearer header or ?key= query parameter
$token = null;
$headers = function_exists('getallheaders') ? getallheaders() : [];
$authHeader = $headers['Authorization'] ?? ($headers['authorization'] ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? ''));

if (preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
  $token = $matches[1];
} elseif (isset($_GET['key']) && is_string($_GET['key'])) {
  $token = $_GET['key'];
}

// Reject unauthorized requests with 401
if (!$token || !hash_equals($cronSecret, $token)) {
  http_response_code(401);
  echo json_encode([
    "success" => false,
    "error" => "Unauthorized: Invalid or missing cron secret."
  ]);
  exit;
}

try {
  include "connection-pdo.php";

  // 1. Mark overdue AR invoices:
  // Approved invoices with balance > 0 and due_date strictly earlier than current date
  $stmtOverdue = $conn->prepare(
    "UPDATE tblar_invoice
     SET status = 'Overdue'
     WHERE status = 'Approved'
       AND COALESCE(balance, 0) > 0
       AND due_date IS NOT NULL
       AND due_date < CURRENT_DATE"
  );
  $stmtOverdue->execute();
  $updatedOverdue = $stmtOverdue->rowCount();

  // 2. Mark fully settled AR invoices as 'Paid' if balance is 0 or less
  $stmtPaid = $conn->prepare(
    "UPDATE tblar_invoice
     SET status = 'Paid'
     WHERE COALESCE(balance, 0) <= 0
       AND status NOT IN ('Paid', 'Pending')"
  );
  $stmtPaid->execute();
  $updatedPaid = $stmtPaid->rowCount();

  $totalUpdated = $updatedOverdue + $updatedPaid;

  echo json_encode([
    "success" => true,
    "updated" => $totalUpdated,
    "details" => [
      "marked_overdue" => $updatedOverdue,
      "marked_paid" => $updatedPaid,
      "processed_at" => date('Y-m-d H:i:s')
    ]
  ]);
} catch (Throwable $e) {
  // Safe failure output: no leaked credentials or stack traces
  http_response_code(500);
  echo json_encode([
    "success" => false,
    "error" => "Failed to execute scheduled AR maintenance."
  ]);
}
?>
