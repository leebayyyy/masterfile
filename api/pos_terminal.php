<?php
require_once "auth-lib.php";
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$operation = $_SERVER['REQUEST_METHOD'] === 'GET' ? ($_GET['operation'] ?? '') : ($_POST['operation'] ?? '');
$json = $_SERVER['REQUEST_METHOD'] === 'GET' ? ($_GET['json'] ?? '') : ($_POST['json'] ?? '');
$data = json_decode($json, true);

if ($operation === 'getAllPosTerminals') {
  requireRoles(["Admin", "Cashier", "Manager"]);
  include "connection-pdo.php";
  echo json_encode($conn->query(
    "SELECT pos_terminal_id, terminal_name FROM tblpos_terminals ORDER BY terminal_name"
  )->fetchAll(PDO::FETCH_ASSOC));
  exit;
}

if ($operation === 'selectTerminal') {
  $cashier = requireRoles(["Cashier"]);
  include "connection-pdo.php";
  if (!empty($_SESSION['pos_terminal_id'])) {
    http_response_code(409);
    echo json_encode(["message"=>"A POS terminal is already selected for this login. Log out and sign in again to choose a different terminal."]);
    exit;
  }
  $terminalId = filter_var($data['terminalId'] ?? null, FILTER_VALIDATE_INT);
  if (!$terminalId || $terminalId < 1) {
    http_response_code(422);
    echo json_encode(["message"=>"Select a valid POS terminal."]);
    exit;
  }
  $terminalStmt = $conn->prepare(
    "SELECT pos_terminal_id, terminal_name FROM tblpos_terminals WHERE pos_terminal_id=:terminalId"
  );
  $terminalStmt->execute([":terminalId"=>$terminalId]);
  $terminal = $terminalStmt->fetch(PDO::FETCH_ASSOC);
  if (!$terminal) {
    http_response_code(422);
    echo json_encode(["message"=>"The selected POS terminal is unavailable."]);
    exit;
  }
  $_SESSION['pos_terminal_id'] = (int)$terminal['pos_terminal_id'];
  echo json_encode([
    "returnValue"=>1,
    "selectedTerminal"=>[
      "pos_terminal_id"=>(int)$terminal['pos_terminal_id'],
      "terminal_name"=>$terminal['terminal_name']
    ],
    "cashier_user_id"=>(int)$cashier['user_id']
  ]);
  exit;
}

requireRoles(["Admin"]);
include "connection-pdo.php";

if ($operation === 'getPosTerminal') {
  $terminalId = filter_var($data['posTerminalId'] ?? null, FILTER_VALIDATE_INT);
  if (!$terminalId || $terminalId < 1) {
    http_response_code(422);
    echo json_encode(["message"=>"A valid POS terminal is required."]);
    exit;
  }
  $stmt = $conn->prepare("SELECT pos_terminal_id, terminal_name FROM tblpos_terminals WHERE pos_terminal_id=:id");
  $stmt->execute([":id"=>$terminalId]);
  echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
  exit;
}

if ($operation === 'insertPosTerminal') {
  $name = trim((string)($data['terminalName'] ?? ''));
  if ($name === '' || strlen($name) > 150) {
    http_response_code(422);
    echo json_encode(["message"=>"Enter a terminal name up to 150 characters."]);
    exit;
  }
  $stmt = $conn->prepare("INSERT INTO tblpos_terminals(terminal_name) VALUES(:terminalName)");
  $stmt->execute([":terminalName"=>$name]);
  echo json_encode(1);
  exit;
}

if ($operation === 'updatePosTerminal') {
  $terminalId = filter_var($data['posTerminalId'] ?? null, FILTER_VALIDATE_INT);
  $name = trim((string)($data['terminalName'] ?? ''));
  if (!$terminalId || $terminalId < 1 || $name === '' || strlen($name) > 150) {
    http_response_code(422);
    echo json_encode(["message"=>"Enter a valid terminal and name up to 150 characters."]);
    exit;
  }
  $stmt = $conn->prepare("UPDATE tblpos_terminals SET terminal_name=:name WHERE pos_terminal_id=:id");
  $stmt->execute([":name"=>$name, ":id"=>$terminalId]);
  echo json_encode(1);
  exit;
}

if ($operation === 'deletePosTerminal') {
  $terminalId = filter_var($data['posTerminalId'] ?? null, FILTER_VALIDATE_INT);
  if (!$terminalId || $terminalId < 1) {
    http_response_code(422);
    echo json_encode(["message"=>"A valid POS terminal is required."]);
    exit;
  }
  $salesCheck = $conn->prepare("SELECT COUNT(*) FROM tblsales WHERE pos_terminal_id=:id");
  $salesCheck->execute([":id"=>$terminalId]);
  if ((int)$salesCheck->fetchColumn() > 0) {
    echo json_encode(["returnValue"=>0, "message"=>"Cannot delete this terminal: it already has sales transactions recorded."]);
    exit;
  }
  $stmt = $conn->prepare("DELETE FROM tblpos_terminals WHERE pos_terminal_id=:id");
  $stmt->execute([":id"=>$terminalId]);
  echo json_encode($stmt->rowCount() > 0 ? 1 : 0);
  exit;
}

http_response_code(400);
echo json_encode(["message"=>"Invalid POS terminal operation."]);
?>
