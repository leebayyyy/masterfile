<?php
require_once "auth-lib.php";
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');

function login($json) {
  include "connection-pdo.php";
  $data = json_decode($json, true);
  $stmt = $conn->prepare(
    "SELECT u.user_id, u.username, u.first_name, u.last_name, u.password_hash,
            r.role_id, r.role_name
     FROM tblusers u
     INNER JOIN tblroles r ON u.role_id = r.role_id
     WHERE u.username = :username AND u.is_active = 1"
  );
  $stmt->execute([":username" => trim($data['username'] ?? '')]);
  $user = $stmt->fetch(PDO::FETCH_ASSOC);
  if (!$user || !$user['password_hash'] || !password_verify($data['password'] ?? '', $user['password_hash'])) {
    http_response_code(401);
    return json_encode(["message" => "Invalid username or password."]);
  }
  session_regenerate_id(true);
  unset($user['password_hash']);
  $_SESSION['user'] = $user;
  unset($_SESSION['pos_terminal_id']);
  return json_encode(["returnValue" => 1, "user" => $user]);
}

function logout() {
  $_SESSION = [];
  if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $params["path"], $params["domain"], $params["secure"], $params["httponly"]);
  }
  session_destroy();
  return json_encode(["returnValue" => 1]);
}

function sessionInfo() {
  $user = currentUser();
  if ($user) {
    include "connection-pdo.php";
    $stmt = $conn->prepare(
      "SELECT u.user_id, u.username, u.first_name, u.last_name, r.role_id, r.role_name
       FROM tblusers u
       INNER JOIN tblroles r ON r.role_id=u.role_id
       WHERE u.user_id=:userId AND u.is_active=1"
    );
    $stmt->execute([":userId"=>$user['user_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    if ($user) {
      $_SESSION['user'] = $user;
    } else {
      unset($_SESSION['user']);
    }
  }
  $selectedTerminalId = null;
  if ($user && $user['role_name'] === 'Cashier' && !empty($_SESSION['pos_terminal_id'])) {
    include "connection-pdo.php";
    $terminalStmt = $conn->prepare(
      "SELECT pos_terminal_id FROM tblpos_terminals WHERE pos_terminal_id=:terminalId"
    );
    $terminalStmt->execute([":terminalId"=>$_SESSION['pos_terminal_id']]);
    $selectedTerminalId = $terminalStmt->fetchColumn();
    if ($selectedTerminalId === false) {
      unset($_SESSION['pos_terminal_id']);
      $selectedTerminalId = null;
    }
  } elseif (!$user || $user['role_name'] !== 'Cashier') {
    unset($_SESSION['pos_terminal_id']);
  }
  return json_encode([
    "authenticated" => (bool)$user,
    "user" => $user,
    "selectedTerminalId" => $selectedTerminalId === null ? null : (int)$selectedTerminalId
  ]);
}

function setUserPassword($json) {
  requireRoles(["Admin"]);
  include "connection-pdo.php";
  $data = json_decode($json, true);
  $password = $data['password'] ?? '';
  if (strlen($password) < 8) {
    http_response_code(422);
    return json_encode(["message" => "Password must be at least 8 characters."]);
  }
  $stmt = $conn->prepare("UPDATE tblusers SET password_hash=:passwordHash WHERE user_id=:userId");
  $stmt->execute([
    ":passwordHash" => password_hash($password, PASSWORD_DEFAULT),
    ":userId" => $data['userId']
  ]);
  return json_encode(["returnValue" => 1]);
}

$operation = $_SERVER['REQUEST_METHOD'] === 'GET' ? ($_GET['operation'] ?? '') : ($_POST['operation'] ?? '');
$json = $_SERVER['REQUEST_METHOD'] === 'GET' ? ($_GET['json'] ?? '') : ($_POST['json'] ?? '');
switch ($operation) {
  case "login": echo login($json); break;
  case "logout": echo logout(); break;
  case "session": echo sessionInfo(); break;
  case "setUserPassword": echo setUserPassword($json); break;
  default: http_response_code(400); echo json_encode(["message" => "Invalid authentication operation."]);
}
?>
