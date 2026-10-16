<?php
// Lightweight, unauthenticated keep-alive / health-check endpoint.
// Intentionally does NOT start a session, touch the database, or expose any
// configuration. Privileged scheduled work stays in cron.php (secret required).
header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'GET' && $method !== 'HEAD') {
  http_response_code(405);
  header('Allow: GET, HEAD');
  echo json_encode(["status" => "error", "error" => "Method not allowed."]);
  exit;
}

http_response_code(200);
if ($method === 'GET') {
  echo json_encode(["status" => "ok", "time" => gmdate('c')]);
}
