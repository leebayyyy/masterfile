<?php
session_start();

function currentUser() {
  return $_SESSION['user'] ?? null;
}

function normalizeRoleName($roleName) {
  $normalized = strtolower(str_replace('_', ' ', trim((string)$roleName)));
  $knownRoles = [
    'admin' => 'Admin',
    'cashier' => 'Cashier',
    'manager' => 'Manager',
    'supervisor' => 'Supervisor',
    'accounts receivable staff' => 'Accounts Receivable Staff',
    'ar staff' => 'Accounts Receivable Staff'
  ];
  return $knownRoles[$normalized] ?? trim((string)$roleName);
}

function requireLogin() {
  $user = currentUser();
  if (!$user) {
    http_response_code(401);
    echo json_encode(["message" => "Login required."]);
    exit;
  }
  return $user;
}

function requireRoles($roles) {
  $user = requireLogin();
  include "connection-pdo.php";
  $stmt = $conn->prepare(
    "SELECT u.user_id, u.username, u.first_name, u.last_name, r.role_id, r.role_name
     FROM tblusers u
     INNER JOIN tblroles r ON r.role_id=u.role_id
     WHERE u.user_id=:userId AND u.is_active=1"
  );
  $stmt->execute([":userId"=>$user['user_id']]);
  $currentUser = $stmt->fetch(PDO::FETCH_ASSOC);
  if (!$currentUser) {
    unset($_SESSION['user']);
    http_response_code(401);
    echo json_encode(["message" => "Your account is inactive or unavailable. Please log in again."]);
    exit;
  }
  $currentUser['role_name'] = normalizeRoleName($currentUser['role_name']);
  $_SESSION['user'] = $currentUser;
  $user = $currentUser;
  header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
  header("Pragma: no-cache");
  header("Expires: Sat, 01 Jan 2000 00:00:00 GMT");

  $userRole = strtolower(trim($user['role_name']));
  $allowedRoles = array_map(function($r) { return strtolower(trim($r)); }, (array)$roles);
  if (!in_array($userRole, $allowedRoles, true)) {
    http_response_code(403);
    echo json_encode(["message" => "You are not authorized to perform this action."]);
    exit;
  }
  return $user;
}
