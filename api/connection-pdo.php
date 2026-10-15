<?php
date_default_timezone_set('Asia/Manila');

$databaseUrl = getenv('DATABASE_URL') ?: ($_ENV['DATABASE_URL'] ?? ($_SERVER['DATABASE_URL'] ?? ''));

if ($databaseUrl) {
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
} else {
  // Fallback to discrete PostgreSQL environment variables
  $dbHost = getenv('PGHOST') ?: ($_ENV['PGHOST'] ?? ($_SERVER['PGHOST'] ?? (getenv('DB_HOST') ?: ($_ENV['DB_HOST'] ?? ($_SERVER['DB_HOST'] ?? '')))));
  $dbPort = getenv('PGPORT') ?: ($_ENV['PGPORT'] ?? ($_SERVER['PGPORT'] ?? (getenv('DB_PORT') ?: ($_ENV['DB_PORT'] ?? ($_SERVER['DB_PORT'] ?? 5432)))));
  $dbName = getenv('PGDATABASE') ?: ($_ENV['PGDATABASE'] ?? ($_SERVER['PGDATABASE'] ?? (getenv('DB_NAME') ?: ($_ENV['DB_NAME'] ?? ($_SERVER['DB_NAME'] ?? '')))));
  $dbUser = getenv('PGUSER') ?: ($_ENV['PGUSER'] ?? ($_SERVER['PGUSER'] ?? (getenv('DB_USER') ?: ($_ENV['DB_USER'] ?? ($_SERVER['DB_USER'] ?? '')))));
  $dbPass = getenv('PGPASSWORD') ?: ($_ENV['PGPASSWORD'] ?? ($_SERVER['PGPASSWORD'] ?? (getenv('DB_PASSWORD') ?: ($_ENV['DB_PASSWORD'] ?? ($_SERVER['DB_PASSWORD'] ?? '')))));

  if (!$dbHost || !$dbName) {
    http_response_code(500);
    die(json_encode(["error" => "Database connection error: DATABASE_URL or DB environment variables not configured."]));
  }
}

$sslMode = getenv('PGSSLMODE') ?: (getenv('DB_SSLMODE') ?: 'require');
$dsn = "pgsql:host={$dbHost};port={$dbPort};dbname={$dbName};sslmode={$sslMode}";

try {
  $conn = new PDO($dsn, $dbUser, $dbPass);
  $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $conn->exec("SET TIME ZONE 'Asia/Manila'");
} catch (PDOException $e) {
  error_log("Database connection failed: " . $e->getMessage());
  http_response_code(500);
  die(json_encode(["error" => "Database connection failed"]));
}
