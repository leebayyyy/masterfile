<?php
require_once "auth-lib.php";
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
requireRoles(["Admin", "Manager"]);
include "connection-pdo.php";

$operation = $_SERVER['REQUEST_METHOD'] === 'GET' ? ($_GET['operation'] ?? '') : ($_POST['operation'] ?? '');
$json = $_SERVER['REQUEST_METHOD'] === 'GET' ? ($_GET['json'] ?? '') : ($_POST['json'] ?? '');
$data = json_decode($json, true);

if ($operation === 'getSettings') {
  echo json_encode([
    "promotions" => $conn->query("SELECT promo_id, promo_name, description, start_date, end_date, discount_rate, is_active FROM tblpromo ORDER BY promo_name")->fetchAll(PDO::FETCH_ASSOC),
    "paymentMethods" => $conn->query("SELECT payment_method_id, method_name, description, is_active FROM tblpayment_method ORDER BY method_name")->fetchAll(PDO::FETCH_ASSOC)
    ,"products" => $conn->query("SELECT product_id, product_name FROM tblproducts WHERE is_active=1 ORDER BY product_name")->fetchAll(PDO::FETCH_ASSOC)
    ,"productPromos" => $conn->query("SELECT pp.product_promo_id, pp.product_id, pp.promo_id, p.product_name, pr.promo_name FROM tblproduct_promo pp INNER JOIN tblproducts p ON p.product_id=pp.product_id INNER JOIN tblpromo pr ON pr.promo_id=pp.promo_id ORDER BY p.product_name, pr.promo_name")->fetchAll(PDO::FETCH_ASSOC)
  ]);
  exit;
}

if ($operation === 'assignPromotion') {
  $productId = filter_var($data['productId'] ?? null, FILTER_VALIDATE_INT);
  $promoId = filter_var($data['promoId'] ?? null, FILTER_VALIDATE_INT);
  if (!$productId || $productId < 1 || !$promoId || $promoId < 1) {
    http_response_code(422);
    echo json_encode(["message"=>"Select a valid product and promotion."]);
    exit;
  }
  $product = $conn->prepare("SELECT 1 FROM tblproducts WHERE product_id=:id AND is_active=1");
  $product->execute([":id"=>$productId]);
  $promotion = $conn->prepare("SELECT 1 FROM tblpromo WHERE promo_id=:id");
  $promotion->execute([":id"=>$promoId]);
  if (!$product->fetchColumn() || !$promotion->fetchColumn()) {
    http_response_code(422);
    echo json_encode(["message"=>"The selected product or promotion is unavailable."]);
    exit;
  }
  $stmt = $conn->prepare("INSERT INTO tblproduct_promo(product_id, promo_id) SELECT :productId, :promoId WHERE NOT EXISTS (SELECT 1 FROM tblproduct_promo WHERE product_id=:productId2 AND promo_id=:promoId2)");
  $stmt->execute([":productId"=>$productId, ":promoId"=>$promoId, ":productId2"=>$productId, ":promoId2"=>$promoId]);
  echo json_encode(["returnValue"=>1]);
  exit;
}
if ($operation === 'removePromotion') {
  $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
  if (!$id || $id < 1) {
    http_response_code(422);
    echo json_encode(["message"=>"A valid product promotion assignment is required."]);
    exit;
  }
  $stmt = $conn->prepare("DELETE FROM tblproduct_promo WHERE product_promo_id=:id");
  $stmt->execute([":id"=>$id]);
  echo json_encode(["returnValue"=>1]);
  exit;
}

if ($operation === 'insertPromotion') {
  $name = trim((string)($data['promoName'] ?? ''));
  $description = $data['description'] ?? null;
  $startDate = $data['startDate'] ?? '';
  $endDate = $data['endDate'] ?? '';
  $rate = $data['discountRate'] ?? '';
  $nameLength = preg_match_all('/./us', $name, $nameCharacters);
  $descriptionLength = is_string($description)
    ? preg_match_all('/./us', $description, $descriptionCharacters)
    : 0;
  $validDate = function($value) {
    if ($value === '') return true;
    if (!is_string($value)) return false;
    $date = DateTime::createFromFormat('!Y-m-d', $value);
    return $date && $date->format('Y-m-d') === $value;
  };
  if ($name === '' || $nameLength === false || $nameLength > 150 ||
      (!is_string($description) && $description !== null) ||
      $descriptionLength === false || $descriptionLength > 255 ||
      !is_string($startDate) || !is_string($endDate) || !$validDate($startDate) || !$validDate($endDate) ||
      ($startDate !== '' && $endDate !== '' && $endDate < $startDate) ||
      !is_scalar($rate) ||
      !preg_match('/^(?:0?\.\d{1,2}|[1-9]\d?(?:\.\d{1,2})?|100(?:\.0{1,2})?)$/', (string)$rate) ||
      (float)$rate <= 0 || (float)$rate > 100) {
    http_response_code(422);
    echo json_encode(["message"=>"Enter a promotion name, valid date range, and a discount rate greater than 0 up to 100."]);
    exit;
  }
  $stmt = $conn->prepare("INSERT INTO tblpromo(promo_name, description, start_date, end_date, discount_rate, is_active) VALUES(:name, :description, :startDate, :endDate, :rate, 1)");
  $stmt->execute([":name"=>$name, ":description"=>$description === '' ? null : $description, ":startDate"=>$startDate ?: null, ":endDate"=>$endDate ?: null, ":rate"=>$rate === '' ? null : $rate]);
  echo json_encode(["returnValue"=>1]);
  exit;
}

if ($operation === 'insertPaymentMethod') {
  if (!is_array($data)) {
    http_response_code(422);
    echo json_encode(["message"=>"Enter a valid payment method."]);
    exit;
  }
  $name = is_string($data['methodName'] ?? null) ? trim($data['methodName']) : '';
  $description = $data['description'] ?? '';
  $nameLength = preg_match_all('/./us', $name, $nameCharacters);
  $descriptionLength = is_string($description)
    ? preg_match_all('/./us', $description, $descriptionCharacters)
    : false;
  if ($name === '' || $nameLength === false || $nameLength > 100 ||
      !is_string($description) || $descriptionLength === false || $descriptionLength > 255) {
    http_response_code(422);
    echo json_encode(["message"=>"Enter a payment method name up to 100 characters and a description up to 255 characters."]);
    exit;
  }
  $stmt = $conn->prepare("INSERT INTO tblpayment_method(method_name, description, is_active) VALUES(:name, :description, 1)");
  $stmt->execute([":name"=>$name, ":description"=>$description === '' ? null : $description]);
  echo json_encode(["returnValue"=>1]);
  exit;
}

if ($operation === 'setActive') {
  if (!is_array($data) || !in_array($data['type'] ?? '', ['promotion', 'payment_method'], true) ||
      !array_key_exists('active', $data) || !in_array((string)$data['active'], ['0', '1'], true)) {
    http_response_code(422);
    echo json_encode(["message"=>"A valid setting and active state are required."]);
    exit;
  }
  $id = filter_var($data['id'] ?? null, FILTER_VALIDATE_INT);
  if (!$id || $id < 1) {
    http_response_code(422);
    echo json_encode(["message"=>"A valid setting ID is required."]);
    exit;
  }
  $table = $data['type'] === 'promotion' ? 'tblpromo' : 'tblpayment_method';
  $idColumn = $data['type'] === 'promotion' ? 'promo_id' : 'payment_method_id';
  $stmt = $conn->prepare("UPDATE {$table} SET is_active=:active WHERE {$idColumn}=:id");
  $stmt->execute([":active" => (int)$data['active'], ":id" => $id]);
  if ($stmt->rowCount() === 0) {
    $exists = $conn->prepare("SELECT 1 FROM {$table} WHERE {$idColumn}=:id");
    $exists->execute([":id"=>$id]);
    if (!$exists->fetchColumn()) {
      http_response_code(404);
      echo json_encode(["message"=>"The selected setting was not found."]);
      exit;
    }
  }
  echo json_encode(["returnValue"=>1]);
  exit;
}

http_response_code(400);
echo json_encode(["message"=>"Invalid settings operation."]);
?>
