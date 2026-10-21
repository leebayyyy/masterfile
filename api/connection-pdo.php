<?php
date_default_timezone_set('Asia/Manila');

$databaseUrl = getenv('DATABASE_URL') ?: ($_ENV['DATABASE_URL'] ?? ($_SERVER['DATABASE_URL'] ?? ''));

// Check for local configuration file (api/config.local.php)
$localConfig = [];
$localConfigFile = __DIR__ . '/config.local.php';
if (file_exists($localConfigFile)) {
  $loaded = include $localConfigFile;
  if (is_array($loaded)) {
    $localConfig = $loaded;
  }
}

// Determine database driver: mysql or pgsql
$dbDriver = $localConfig['db_driver'] ?? (getenv('DB_DRIVER') ?: 'pgsql');

if ($databaseUrl && $dbDriver !== 'mysql') {
  // Cloud PostgreSQL via DATABASE_URL
  $dbParts = parse_url($databaseUrl);
  if ($dbParts === false) {
    http_response_code(500);
    die(json_encode(["error" => "Malformed DATABASE_URL environment variable."]));
  }
  $dbHost = $dbParts['host'] ?? 'localhost';
  $dbPort = $dbParts['port'] ?? 5432;
  $dbName = ltrim($dbParts['path'] ?? '', '/');
  $dbUser = isset($dbParts['user']) ? urldecode($dbParts['user']) : '';
  $dbPass = isset($dbParts['pass']) ? urldecode($dbParts['pass']) : '';
  $sslMode = getenv('PGSSLMODE') ?: (getenv('DB_SSLMODE') ?: 'require');
  $dsn = "pgsql:host={$dbHost};port={$dbPort};dbname={$dbName};sslmode={$sslMode}";
} elseif ($dbDriver === 'mysql') {
  // XAMPP / MySQL / MariaDB
  $dbHost = $localConfig['db_host'] ?? (getenv('DB_HOST') ?: 'localhost');
  $dbPort = $localConfig['db_port'] ?? (getenv('DB_PORT') ?: 3306);
  $dbName = $localConfig['db_name'] ?? (getenv('DB_NAME') ?: 'pos_ar_system');
  $dbUser = $localConfig['db_user'] ?? (getenv('DB_USER') ?: 'root');
  $dbPass = $localConfig['db_pass'] ?? (getenv('DB_PASSWORD') ?: '');
  $dsn = "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4";
} else {
  // Fallback to discrete PostgreSQL environment variables or local config defaults
  $dbHost = getenv('PGHOST') ?: ($_ENV['PGHOST'] ?? ($_SERVER['PGHOST'] ?? (getenv('DB_HOST') ?: ($localConfig['db_host'] ?? 'localhost'))));
  $dbPort = getenv('PGPORT') ?: ($_ENV['PGPORT'] ?? ($_SERVER['PGPORT'] ?? (getenv('DB_PORT') ?: ($localConfig['db_port'] ?? 5432))));
  $dbName = getenv('PGDATABASE') ?: ($_ENV['PGDATABASE'] ?? ($_SERVER['PGDATABASE'] ?? (getenv('DB_NAME') ?: ($localConfig['db_name'] ?? 'pos_ar_system'))));
  $dbUser = getenv('PGUSER') ?: ($_ENV['PGUSER'] ?? ($_SERVER['PGUSER'] ?? (getenv('DB_USER') ?: ($localConfig['db_user'] ?? 'postgres'))));
  $dbPass = getenv('PGPASSWORD') ?: ($_ENV['PGPASSWORD'] ?? ($_SERVER['PGPASSWORD'] ?? (getenv('DB_PASSWORD') ?: ($localConfig['db_pass'] ?? 'postgres'))));

  $isLocalHost = in_array($dbHost, ['localhost', '127.0.0.1', '::1'], true);
  $defaultSsl = $isLocalHost ? 'disable' : 'require';
  $sslMode = getenv('PGSSLMODE') ?: (getenv('DB_SSLMODE') ?: ($localConfig['ssl_mode'] ?? $defaultSsl));
  $dsn = "pgsql:host={$dbHost};port={$dbPort};dbname={$dbName};sslmode={$sslMode}";
}

try {
  $conn = new PDO($dsn, $dbUser, $dbPass);
  $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  if ($dbDriver === 'mysql') {
    $conn->exec("SET time_zone = '+08:00'");
  } else {
    $conn->exec("SET TIME ZONE 'Asia/Manila'");
  }
} catch (PDOException $e) {
  error_log("Database connection failed: " . $e->getMessage());
  http_response_code(500);
  die(json_encode(["error" => "Database connection failed", "details" => $e->getMessage()]));
}
?>
