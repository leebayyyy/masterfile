<?php
  $dsn = "mysql:host=localhost;dbname=pos_ar_system;charset=utf8mb4";
  $dbUser = "root";
  $dbPass = "";

  try {
    $conn = new PDO($dsn, $dbUser, $dbPass);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  } catch (PDOException $e) {
    die("Connection failed: " . $e->getMessage());
  }
?>
