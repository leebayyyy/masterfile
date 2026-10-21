<?php
date_default_timezone_set('Asia/Manila');

// MySQL / MariaDB (XAMPP) connection.
// Defaults match a stock XAMPP install: localhost:3306, user "root", empty password.
// Override any value in api/config.local.php (see config.local.php.example).
$localConfig = [];
$localConfigFile = __DIR__ . '/config.local.php';
if (file_exists($localConfigFile)) {
  $loaded = include $localConfigFile;
  if (is_array($loaded)) {
    $localConfig = $loaded;
  }
}

$dbHost = $localConfig['db_host'] ?? 'localhost';
$dbPort = $localConfig['db_port'] ?? 3306;
$dbName = $localConfig['db_name'] ?? 'pos_ar_system';
$dbUser = $localConfig['db_user'] ?? 'root';
$dbPass = $localConfig['db_pass'] ?? '';
$dsn = "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4";

try {
  $conn = new PDO($dsn, $dbUser, $dbPass);
  $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $conn->exec("SET time_zone = '+08:00'");
} catch (PDOException $e) {
  error_log("Database connection failed: " . $e->getMessage());
  http_response_code(500);
  die(json_encode(["error" => "Database connection failed", "details" => $e->getMessage()]));
}
?>
