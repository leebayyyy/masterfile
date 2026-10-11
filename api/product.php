<?php
  require_once "auth-lib.php";
  header('Content-Type: application/json');
  header("Access-Control-Allow-Origin: *");

  class Product {

    function getAllUnitsOfMeasure(){
      include "connection-pdo.php";
      $sql = "SELECT unit_of_measure_id, measure_name, description
              FROM tblunit_of_measure
              ORDER BY measure_name";
      $stmt = $conn->prepare($sql);
      $stmt->execute();
      return json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    function getAllProducts(){
      include "connection-pdo.php";
      $sql = "SELECT a.product_id, a.price, a.product_name, a.category_id, a.unit_of_measure_id, a.price_tier, a.wholesale_price, a.is_active,
                     b.category_name
              FROM tblproducts a INNER JOIN tblproduct_categories b
              ON a.category_id = b.category_id
              ORDER BY a.product_name";
      $stmt = $conn->prepare($sql);
      $stmt->execute();
      $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);
      return json_encode($rs);
    }

    function getProduct($json){
      include "connection-pdo.php";
      $json = json_decode($json, true);
      $sql = "SELECT a.product_id, a.price, a.product_name, a.category_id, a.unit_of_measure_id, a.price_tier, a.wholesale_price, a.is_active,
                     b.category_name
              FROM tblproducts a INNER JOIN tblproduct_categories b
              ON a.category_id = b.category_id
              WHERE a.product_id = :productId";
      $stmt = $conn->prepare($sql);
      $stmt->bindParam(":productId", $json['productId']);
      $stmt->execute();
      $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);
      return json_encode($rs);
    }

    function insertProduct($json){
      include "connection-pdo.php";
      $json = json_decode($json, true);
      $price = ($json['price'] ?? '') === '' ? null : $json['price'];
      $sql = "INSERT INTO tblproducts(price, product_name, category_id, unit_of_measure_id, price_tier, wholesale_price, is_active)
              VALUES(:price, :productName, :categoryId, :unitOfMeasureId, :priceTier, :wholesalePrice, 1)";
      $stmt = $conn->prepare($sql);
      $stmt->bindParam(":price", $price);
      $stmt->bindParam(":productName", $json['productName']);
      $stmt->bindParam(":categoryId", $json['categoryId']);
      $stmt->bindParam(":unitOfMeasureId", $json['unitOfMeasureId']);
      $stmt->bindValue(":priceTier", $json['priceTier'] ?? null);
      $stmt->bindValue(":wholesalePrice", ($json['wholesalePrice'] ?? '') === '' ? null : $json['wholesalePrice']);
      $stmt->execute();
      $returnValue = 0;
      if($stmt->rowCount() > 0){
        $returnValue = 1;
      }
      return json_encode($returnValue);
    }

    function updateProduct($json){
      include "connection-pdo.php";
      $json = json_decode($json, true);
      $price = ($json['price'] ?? '') === '' ? null : $json['price'];
      $sql = "UPDATE tblproducts SET price=:price, product_name=:productName,
                category_id=:categoryId, unit_of_measure_id=:unitOfMeasureId, price_tier=:priceTier, wholesale_price=:wholesalePrice
              WHERE product_id=:productId";
      $stmt = $conn->prepare($sql);
      $stmt->bindParam(":price", $price);
      $stmt->bindParam(":productName", $json['productName']);
      $stmt->bindParam(":categoryId", $json['categoryId']);
      $stmt->bindParam(":unitOfMeasureId", $json['unitOfMeasureId']);
      $stmt->bindValue(":priceTier", $json['priceTier'] ?? null);
      $stmt->bindValue(":wholesalePrice", ($json['wholesalePrice'] ?? '') === '' ? null : $json['wholesalePrice']);
      $stmt->bindParam(":productId", $json['productId']);
      $stmt->execute();
      $returnValue = 1;
      return json_encode($returnValue);
    }

    //soft delete - products already sold must stay visible in sales history
    function deactivateProduct($json){
      include "connection-pdo.php";
      $json = json_decode($json, true);
      $sql = "UPDATE tblproducts SET is_active=0 WHERE product_id=:productId";
      $stmt = $conn->prepare($sql);
      $stmt->bindParam(":productId", $json['productId']);
      $stmt->execute();
      $returnValue = $stmt->rowCount() > 0 ? 1 : 0;
      return json_encode($returnValue);
    }

    function restoreProduct($json){
      include "connection-pdo.php";
      $json = json_decode($json, true);
      $sql = "UPDATE tblproducts SET is_active=1 WHERE product_id=:productId";
      $stmt = $conn->prepare($sql);
      $stmt->bindParam(":productId", $json['productId']);
      $stmt->execute();
      $returnValue = $stmt->rowCount() > 0 ? 1 : 0;
      return json_encode($returnValue);
    }
  }

  //submitted by the client - operation and json
  if ($_SERVER['REQUEST_METHOD'] == 'GET'){
    $operation = $_GET['operation'];
    $json = isset($_GET['json']) ? $_GET['json'] : "";
  }else if($_SERVER['REQUEST_METHOD'] == 'POST'){
    $operation = $_POST['operation'];
    $json = isset($_POST['json']) ? $_POST['json'] : "";
  }

  $product = new Product();
  if (in_array($operation, ["insertProduct", "updateProduct", "deactivateProduct", "restoreProduct"], true)) {
    requireRoles(["Admin"]);
  } else {
    requireRoles(["Admin", "Cashier", "Manager"]);
  }
  switch($operation){
    case "getAllUnitsOfMeasure":
      echo $product->getAllUnitsOfMeasure();
      break;
    case "getAllProducts":
      echo $product->getAllProducts();
      break;
    case "getProduct":
      echo $product->getProduct($json);
      break;
    case "insertProduct":
      echo $product->insertProduct($json);
      break;
    case "updateProduct":
      echo $product->updateProduct($json);
      break;
    case "deactivateProduct":
      echo $product->deactivateProduct($json);
      break;
    case "restoreProduct":
      echo $product->restoreProduct($json);
      break;
  }
?>
