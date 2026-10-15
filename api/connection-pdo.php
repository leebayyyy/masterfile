<?php
date_default_timezone_set('Asia/Manila');

$databaseUrl = getenv('DATABASE_URL') ?: ($_ENV['DATABASE_URL'] ?? ($_SERVER['DATABASE_URL'] ?? ''));

if (!$databaseUrl) {
  die("Connection failed: DATABASE_URL environment variable is not set.");
}

$dbParts = parse_url($databaseUrl);
if ($dbParts === false) {
  die("Connection failed: Malformed DATABASE_URL.");
}

$dbHost = $dbParts['host'] ?? 'localhost';
$dbPort = $dbParts['port'] ?? 5432;
$dbName = ltrim($dbParts['path'] ?? '', '/');
$dbUser = isset($dbParts['user']) ? urldecode($dbParts['user']) : '';
$dbPass = isset($dbParts['pass']) ? urldecode($dbParts['pass']) : '';

$dsn = "pgsql:host={$dbHost};port={$dbPort};dbname={$dbName};sslmode=require";

try {
  $conn = new PDO($dsn, $dbUser, $dbPass);
  $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $conn->exec("SET TIME ZONE 'Asia/Manila'");
} catch (PDOException $e) {
  die("Connection failed: " . $e->getMessage());
}
