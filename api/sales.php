<?php
require_once "auth-lib.php";
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

function getFormData($user) {
  include "connection-pdo.php";
  $selectedTerminal = null;
  if ($user['role_name'] === 'Cashier' && !empty($_SESSION['pos_terminal_id'])) {
    $terminalStmt = $conn->prepare(
      "SELECT pos_terminal_id, terminal_name FROM tblpos_terminals WHERE pos_terminal_id=:terminalId"
    );
    $terminalStmt->execute([":terminalId"=>$_SESSION['pos_terminal_id']]);
    $selectedTerminal = $terminalStmt->fetch(PDO::FETCH_ASSOC) ?: null;
  }
  return json_encode([
    "products" => $conn->query(
      "SELECT p.product_id, p.product_name, p.price, COALESCE(pr.discount_rate, 0) AS promo_rate,
              pr.promo_id, pr.promo_name
       FROM tblproducts p
       LEFT JOIN tblpromo pr ON pr.promo_id=(
         SELECT pr2.promo_id
         FROM tblproduct_promo pp2
         INNER JOIN tblpromo pr2 ON pr2.promo_id=pp2.promo_id
         WHERE pp2.product_id=p.product_id AND pr2.is_active=1
           AND (pr2.start_date IS NULL OR pr2.start_date <= CURDATE())
           AND (pr2.end_date IS NULL OR pr2.end_date >= CURDATE())
         ORDER BY pr2.discount_rate DESC, pr2.promo_id DESC
         LIMIT 1
       )
       WHERE p.is_active=1 ORDER BY p.product_name"
    )->fetchAll(PDO::FETCH_ASSOC),
    "selectedTerminal" => $selectedTerminal,
    "paymentMethods" => $conn->query(
      "SELECT payment_method_id, method_name
       FROM tblpayment_method
       WHERE is_active=1
       ORDER BY method_name"
    )->fetchAll(PDO::FETCH_ASSOC),
    "customers" => $conn->query(
      "SELECT c.ar_customer_id, c.customer_name, c.credit_limit,
              COALESCE(i.invoice_balance, 0) + COALESCE(s.pending_balance, 0) AS credit_exposure,
              c.credit_limit - COALESCE(i.invoice_balance, 0) - COALESCE(s.pending_balance, 0) AS available_credit
       FROM tblar_customers c
       LEFT JOIN (
         SELECT ar_customer_id, SUM(balance) AS invoice_balance FROM tblar_invoice
         WHERE status <> 'Pending' AND COALESCE(balance, 0) > 0 GROUP BY ar_customer_id
       ) i ON i.ar_customer_id=c.ar_customer_id
       LEFT JOIN (
         SELECT s.ar_customer_id, SUM(s.total_amount) AS pending_balance FROM tblsales s
         WHERE s.sale_type='AR' AND s.ar_customer_id IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM tblar_invoice ai WHERE ai.sale_id=s.sale_id)
         GROUP BY s.ar_customer_id
       ) s ON s.ar_customer_id=c.ar_customer_id
       WHERE c.is_active=1 ORDER BY c.customer_name"
    )->fetchAll(PDO::FETCH_ASSOC),
    "sukiCards" => $conn->query(
      "SELECT s.sku_card_id, s.ar_customer_id, s.card_number, s.points_balance
       FROM tblsku_card s
       INNER JOIN tblar_customers c ON c.ar_customer_id=s.ar_customer_id AND c.is_active=1
       WHERE s.is_active=1 AND (s.expiry_date IS NULL OR s.expiry_date >= CURDATE())
       ORDER BY s.ar_customer_id, s.issued_date DESC, s.sku_card_id DESC"
    )->fetchAll(PDO::FETCH_ASSOC),
    "promotions" => $conn->query("SELECT promo_id, promo_name, discount_rate FROM tblpromo WHERE is_active=1 AND (start_date IS NULL OR start_date <= CURDATE()) AND (end_date IS NULL OR end_date >= CURDATE()) ORDER BY promo_name")->fetchAll(PDO::FETCH_ASSOC)
  ]);
}

function getCreditEligibility($customerId) {
  include "connection-pdo.php";
  if ($customerId < 1) {
    http_response_code(422);
    return json_encode(["message" => "A valid AR customer is required."]);
  }
  $stmt = $conn->prepare(
    "SELECT c.ar_customer_id, c.credit_limit,
            COALESCE(i.invoice_balance, 0) + COALESCE(s.pending_balance, 0) AS credit_exposure,
            c.credit_limit - COALESCE(i.invoice_balance, 0) - COALESCE(s.pending_balance, 0) AS available_credit
     FROM tblar_customers c
     LEFT JOIN (
       SELECT ar_customer_id, SUM(balance) AS invoice_balance FROM tblar_invoice
       WHERE status <> 'Pending' AND COALESCE(balance, 0) > 0 GROUP BY ar_customer_id
     ) i ON i.ar_customer_id=c.ar_customer_id
     LEFT JOIN (
       SELECT s.ar_customer_id, SUM(s.total_amount) AS pending_balance FROM tblsales s
       WHERE s.sale_type='AR' AND s.ar_customer_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM tblar_invoice ai WHERE ai.sale_id=s.sale_id)
       GROUP BY s.ar_customer_id
     ) s ON s.ar_customer_id=c.ar_customer_id
     WHERE c.ar_customer_id=:customerId AND c.is_active=1"
  );
  $stmt->execute([":customerId"=>$customerId]);
  $eligibility = $stmt->fetch(PDO::FETCH_ASSOC);
  if (!$eligibility) {
    http_response_code(404);
    return json_encode(["message" => "The selected AR customer is not available."]);
  }
  return json_encode($eligibility);
}

function getAllSales() {
  include "connection-pdo.php";
  $user = requireLogin();
  $filter = $user['role_name'] === 'Cashier' ? " WHERE s.cashier_user_id = :cashierId" : "";
  $sql = "SELECT s.sale_id, s.sale_date, s.sale_type, s.price, s.tax_total, s.total_amount, s.balance,
                 m.method_name AS payment_method,
                 COALESCE((SELECT SUM(sd.promo_discount) FROM tblsales_detail sd WHERE sd.sale_id=s.sale_id), 0) AS promotion_discount,
                 (SELECT GROUP_CONCAT(DISTINCT pr.promo_name ORDER BY pr.promo_name SEPARATOR ', ')
                  FROM tblsales_detail sd INNER JOIN tblpromo pr ON pr.promo_id=sd.promo_id
                  WHERE sd.sale_id=s.sale_id) AS promotions_applied,
                 c.customer_name,
                 t.terminal_name, CONCAT(u.first_name, ' ', u.last_name) AS cashier
          FROM tblsales s
          INNER JOIN tblpos_terminals t ON s.pos_terminal_id=t.pos_terminal_id
          INNER JOIN tblusers u ON s.cashier_user_id=u.user_id
          LEFT JOIN tblar_customers c ON c.ar_customer_id=s.ar_customer_id
          LEFT JOIN tblpayment_method m ON m.payment_method_id=s.payment_method_id
          " . $filter . " ORDER BY s.sale_id DESC";
  $stmt = $conn->prepare($sql);
  if ($user['role_name'] === 'Cashier') {
    $stmt->execute([":cashierId" => $user['user_id']]);
  } else {
    $stmt->execute();
  }
  return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
}

function getReceipt($saleId) {
  include "connection-pdo.php";
  $user = requireLogin();
  $stmt = $conn->prepare("SELECT s.*, t.terminal_name, CONCAT(u.first_name, ' ', u.last_name) AS cashier, c.customer_name, sc.card_number AS suki_card_number, m.method_name AS payment_method
    FROM tblsales s INNER JOIN tblpos_terminals t ON s.pos_terminal_id=t.pos_terminal_id
    INNER JOIN tblusers u ON s.cashier_user_id=u.user_id
    LEFT JOIN tblar_customers c ON c.ar_customer_id=s.ar_customer_id
    LEFT JOIN tblpayment_method m ON m.payment_method_id=s.payment_method_id
    LEFT JOIN tblsku_card sc ON sc.sku_card_id=s.suki_card_id
    WHERE s.sale_id=:saleId AND (:isCashier=0 OR s.cashier_user_id=:userId)");
  $stmt->execute([":saleId"=>$saleId, ":isCashier"=>$user['role_name'] === 'Cashier' ? 1 : 0, ":userId"=>$user['user_id']]);
  $sale = $stmt->fetch(PDO::FETCH_ASSOC);
  if (!$sale) { http_response_code(404); return json_encode(["message"=>"Sale not found."]); }
  $detail = $conn->prepare("SELECT d.*, p.product_name, pr.promo_name FROM tblsales_detail d INNER JOIN tblproducts p ON d.product_id=p.product_id LEFT JOIN tblpromo pr ON pr.promo_id=d.promo_id WHERE d.sale_id=:saleId ORDER BY d.sales_detail_id");
  $detail->execute([":saleId"=>$saleId]);
  return json_encode(["sale"=>$sale, "items"=>$detail->fetchAll(PDO::FETCH_ASSOC)]);
}

function createSale($json) {
  include "connection-pdo.php";
  $data = json_decode($json, true);
  if (!is_array($data)) {
    http_response_code(422);
    return json_encode(["returnValue" => 0, "message" => "A valid sale request is required."]);
  }
  $items = $data['items'] ?? [];
  if (!is_array($items) || !$items || empty($data['saleType'])) {
    http_response_code(422);
    return json_encode(["returnValue" => 0, "message" => "Sale type and at least one item are required."]);
  }
  if (!in_array($data['saleType'], ['Cash', 'AR'], true)) {
    http_response_code(422);
    return json_encode(["returnValue" => 0, "message" => "Sale type must be Cash or AR."]);
  }
  $isAr = $data['saleType'] === 'AR';
  $paymentMethodId = is_array($data)
    ? filter_var($data['paymentMethodId'] ?? null, FILTER_VALIDATE_INT)
    : false;
  if ((!$isAr && (!$paymentMethodId || $paymentMethodId < 1)) ||
      ($isAr && !empty($data['paymentMethodId']))) {
    http_response_code(422);
    return json_encode(["returnValue" => 0, "message" => $isAr
      ? "AR credit sales are paid through the AR payment process."
      : "Select an active payment method for this cash sale."]);
  }
  $user = requireLogin();
  $data['cashierUserId'] = $user['user_id'];
  $terminalId = filter_var($_SESSION['pos_terminal_id'] ?? null, FILTER_VALIDATE_INT);
  if (!$terminalId || $terminalId < 1) {
    http_response_code(422);
    return json_encode(["returnValue"=>0, "message"=>"Choose a POS terminal after signing in before recording a sale."]);
  }
  $sukiStatus = 'None';
  $sukiPointsBalance = null;
  $sukiCardId = null;
  $creditLimit = null;
  if (!$isAr) {
    $requestedSukiStatus = $data['sukiCardStatus'] ?? '';
    if (!in_array($requestedSukiStatus, ['Has', 'None'], true)) {
      http_response_code(422);
      return json_encode(["returnValue" => 0, "message" => "Select Has or None for the SUKI card."]);
    }
    $sukiStatus = $requestedSukiStatus;
    if ($sukiStatus === 'Has') {
      $points = $data['sukiPointsBalance'] ?? null;
      if (!is_numeric($points) || (float)$points < 0 || floor((float)$points) !== (float)$points || (float)$points > 99999999.99) {
        http_response_code(422);
        return json_encode(["returnValue" => 0, "message" => "Enter a valid whole-number SUKI point balance."]);
      }
      $sukiPointsBalance = (int)$points;
    }
  }
  if ($isAr && empty($data['customerId'])) {
    http_response_code(422);
    return json_encode(["returnValue" => 0, "message" => "An AR customer is required for credit sales."]);
  }
  $customerId = $isAr ? (int)$data['customerId'] : null;
  $requestedSukiCardId = filter_var($data['sukiCardId'] ?? null, FILTER_VALIDATE_INT);
  if (!$isAr && !empty($data['sukiCardId']) && (!$requestedSukiCardId || $requestedSukiCardId < 1)) {
    http_response_code(422);
    return json_encode(["returnValue" => 0, "message" => "Select a valid registered SUKI card."]);
  }
  if (!$isAr && $sukiStatus === 'None' && !empty($data['sukiCardId'])) {
    http_response_code(422);
    return json_encode(["returnValue" => 0, "message" => "A registered SUKI card can only be selected when the customer has a card."]);
  }
  try {
    $conn->beginTransaction();
    if (!$isAr) {
      $methodStmt = $conn->prepare(
        "SELECT payment_method_id FROM tblpayment_method
         WHERE payment_method_id=:methodId AND is_active=1 FOR UPDATE"
      );
      $methodStmt->execute([":methodId"=>$paymentMethodId]);
      if (!$methodStmt->fetchColumn()) {
        throw new RuntimeException("Select a valid active payment method.");
      }
    }
    $terminalStmt = $conn->prepare(
      "SELECT pos_terminal_id FROM tblpos_terminals WHERE pos_terminal_id=:terminalId FOR UPDATE"
    );
    $terminalStmt->execute([
      ":terminalId"=>$terminalId
    ]);
    if (!$terminalStmt->fetchColumn()) {
      throw new RuntimeException("You are not assigned to the selected POS terminal.");
    }
    if (!$isAr && $sukiStatus === 'Has' && $requestedSukiCardId) {
      $cardStmt = $conn->prepare(
        "SELECT sku_card_id, ar_customer_id
         FROM tblsku_card s
         INNER JOIN tblar_customers c ON c.ar_customer_id=s.ar_customer_id AND c.is_active=1
         WHERE s.sku_card_id=:cardId AND s.is_active=1
           AND (s.expiry_date IS NULL OR s.expiry_date >= CURDATE())
         FOR UPDATE"
      );
      $cardStmt->execute([":cardId"=>$requestedSukiCardId]);
      $card = $cardStmt->fetch(PDO::FETCH_ASSOC);
      if (!$card) {
        throw new RuntimeException("The selected SUKI card is no longer active.");
      }
      $sukiCardId = $card['sku_card_id'];
      $customerId = (int)$card['ar_customer_id'];
    }
    if ($isAr) {
      $customerStmt = $conn->prepare("SELECT ar_customer_id, credit_limit FROM tblar_customers WHERE ar_customer_id=:customerId AND is_active=1 FOR UPDATE");
      $customerStmt->execute([":customerId"=>$customerId]);
      $customer = $customerStmt->fetch(PDO::FETCH_ASSOC);
      if (!$customer) {
        throw new RuntimeException("The selected AR customer is not available.");
      }
      $creditLimit = (float)$customer['credit_limit'];
      $cardStmt = $conn->prepare("SELECT sku_card_id, points_balance FROM tblsku_card WHERE ar_customer_id=:customerId AND is_active=1 AND (expiry_date IS NULL OR expiry_date >= CURDATE()) ORDER BY issued_date DESC, sku_card_id DESC FOR UPDATE");
      $cardStmt->execute([":customerId"=>$customerId]);
      $customerCards = $cardStmt->fetchAll(PDO::FETCH_ASSOC);
      if (count($customerCards) > 1) {
        throw new RuntimeException("Multiple active SUKI cards are linked to this customer. Ask AR Staff to resolve this before completing the sale.");
      }
      if ($customerCards) {
        $sukiCardId = $customerCards[0]['sku_card_id'];
        $sukiStatus = 'Has';
        $sukiPointsBalance = $customerCards[0]['points_balance'] === null ? 0 : (float)$customerCards[0]['points_balance'];
      }
    }
    $subtotal = 0;
    $detailRows = [];
    foreach ($items as $item) {
      $productStmt = $conn->prepare(
        "SELECT p.price, COALESCE(pr.discount_rate, 0) AS promo_rate, pr.promo_id, pr.promo_name
         FROM tblproducts p
         LEFT JOIN tblpromo pr ON pr.promo_id=(
           SELECT pr2.promo_id
           FROM tblproduct_promo pp2
           INNER JOIN tblpromo pr2 ON pr2.promo_id=pp2.promo_id
           WHERE pp2.product_id=p.product_id AND pr2.is_active=1
             AND (pr2.start_date IS NULL OR pr2.start_date <= CURDATE())
             AND (pr2.end_date IS NULL OR pr2.end_date >= CURDATE())
           ORDER BY pr2.discount_rate DESC, pr2.promo_id DESC
           LIMIT 1
         )
         WHERE p.product_id=:productId AND p.is_active=1"
      );
      $productStmt->execute([":productId" => $item['productId']]);
      $product = $productStmt->fetch(PDO::FETCH_ASSOC);
      $quantity = (float)($item['quantity'] ?? 0);
      $discount = (float)($item['discount'] ?? 0);
      if (!$product || $quantity <= 0 || $discount < 0) {
        throw new RuntimeException("Invalid product, quantity, or discount.");
      }
      $unitPrice = (float)$product['price'];
      $promoDiscount = round(($quantity * $unitPrice) * (float)$product['promo_rate'] / 100, 2);
      $totalDiscount = round($discount + $promoDiscount, 2);
      $lineTotal = ($quantity * $unitPrice) - $totalDiscount;
      if ($lineTotal < 0) {
        throw new RuntimeException("Discount cannot exceed the line amount.");
      }
      $subtotal += $lineTotal;
      $detailRows[] = [$item['productId'], $product['promo_id'], $quantity, $unitPrice, $totalDiscount, $promoDiscount, $lineTotal, $unitPrice];
    }
    $taxRate = max(0, (float)($data['taxRate'] ?? 0));
    $tax = round($subtotal * $taxRate / 100, 2);
    $total = round($subtotal + $tax, 2);
    if ($isAr) {
      $exposureStmt = $conn->prepare(
        "SELECT
           COALESCE((SELECT SUM(balance) FROM tblar_invoice
                     WHERE ar_customer_id=:invoiceCustomerId AND status <> 'Pending' AND COALESCE(balance, 0) > 0), 0)
           +
           COALESCE((SELECT SUM(s.total_amount) FROM tblsales s
                     WHERE s.ar_customer_id=:saleCustomerId AND s.sale_type='AR'
                       AND NOT EXISTS (SELECT 1 FROM tblar_invoice i WHERE i.sale_id=s.sale_id)), 0)"
      );
      $exposureStmt->execute([":invoiceCustomerId"=>$customerId, ":saleCustomerId"=>$customerId]);
      $exposure = (float)$exposureStmt->fetchColumn();
      if (round($exposure + $total, 2) > round($creditLimit, 2)) {
        $available = max(0, $creditLimit - $exposure);
        throw new RuntimeException(
          "Credit limit exceeded. Limit: " . number_format($creditLimit, 2, '.', '') .
          "; current exposure: " . number_format($exposure, 2, '.', '') .
          "; available credit: " . number_format($available, 2, '.', '') . "."
        );
      }
    }
    $balance = $isAr ? $total : 0;
    $saleStmt = $conn->prepare("INSERT INTO tblsales(pos_terminal_id, cashier_user_id, sale_date, sale_type, payment_method_id, ar_customer_id, price, tax_total, total_amount, balance, suki_card_id, suki_card_status, suki_points_balance)
      VALUES(:terminalId, :cashierId, CURDATE(), :saleType, :paymentMethodId, :customerId, :price, :tax, :total, :balance, :sukiCardId, :sukiStatus, :sukiPoints)");
    $saleStmt->execute([":terminalId"=>$terminalId, ":cashierId"=>$data['cashierUserId'], ":saleType"=>$data['saleType'], ":paymentMethodId"=>$isAr ? null : $paymentMethodId, ":customerId"=>$customerId, ":price"=>$subtotal, ":tax"=>$tax, ":total"=>$total, ":balance"=>$balance, ":sukiCardId"=>$sukiCardId, ":sukiStatus"=>$sukiStatus, ":sukiPoints"=>$sukiPointsBalance]);
    $saleId = $conn->lastInsertId();
    $detailStmt = $conn->prepare("INSERT INTO tblsales_detail(sale_id, product_id, promo_id, quantity, unit_price, discount, promo_discount, line_total, cost_at_sale)
      VALUES(:saleId, :productId, :promoId, :quantity, :unitPrice, :discount, :promoDiscount, :lineTotal, :cost)");
    foreach ($detailRows as $row) {
      $detailStmt->execute([":saleId"=>$saleId, ":productId"=>$row[0], ":promoId"=>$row[1], ":quantity"=>$row[2], ":unitPrice"=>$row[3], ":discount"=>$row[4], ":promoDiscount"=>$row[5], ":lineTotal"=>$row[6], ":cost"=>$row[7]]);
    }
    $conn->commit();
    return json_encode(["returnValue"=>1, "saleId"=>$saleId]);
  } catch (Throwable $e) {
    if ($conn->inTransaction()) $conn->rollBack();
    http_response_code(422);
    return json_encode(["returnValue"=>0, "message"=>$e->getMessage()]);
  }
}

$operation = $_SERVER['REQUEST_METHOD'] === 'GET' ? ($_GET['operation'] ?? '') : ($_POST['operation'] ?? '');
$json = $_SERVER['REQUEST_METHOD'] === 'GET' ? ($_GET['json'] ?? '') : ($_POST['json'] ?? '');
switch ($operation) {
  case "getFormData": $user = requireRoles(["Admin", "Cashier", "Manager"]); echo getFormData($user); break;
  case "getCreditEligibility": requireRoles(["Admin", "Cashier", "Manager"]); echo getCreditEligibility((int)($_GET['customerId'] ?? 0)); break;
  case "getAllSales": requireRoles(["Admin", "Cashier", "Manager"]); echo getAllSales(); break;
  case "getReceipt": requireRoles(["Admin", "Cashier", "Manager"]); echo getReceipt((int)($_GET['saleId'] ?? 0)); break;
  case "createSale": requireRoles(["Cashier"]); echo createSale($json); break;
  default: http_response_code(400); echo json_encode(["message"=>"Invalid sales operation."]);
}
?>
