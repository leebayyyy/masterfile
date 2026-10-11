<?php
  header('Content-Type: application/json');
  header("Access-Control-Allow-Origin: *");

  class WholesalePrice {

    function getAllWholesalePrices(){
      include "connection-pdo.php";
      $sql = "SELECT a.*, b.product_name
              FROM tblwholesale_prices a INNER JOIN tblproducts b
              ON a.product_id = b.product_id
              ORDER BY b.product_name, a.effective_from DESC";
      $stmt = $conn->prepare($sql);
      $stmt->execute();
      $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);
      return json_encode($rs);
    }

    function getWholesalePrice($json){
      include "connection-pdo.php";
      $json = json_decode($json, true);
      $sql = "SELECT a.*, b.product_name
              FROM tblwholesale_prices a INNER JOIN tblproducts b
              ON a.product_id = b.product_id
              WHERE a.wholesale_price_id = :wholesalePriceId";
      $stmt = $conn->prepare($sql);
      $stmt->bindParam(":wholesalePriceId", $json['wholesalePriceId']);
      $stmt->execute();
      $rs = $stmt->fetchAll(PDO::FETCH_ASSOC);
      return json_encode($rs);
    }

    function insertWholesalePrice($json){
      include "connection-pdo.php";
      $json = json_decode($json, true);
      $sql = "INSERT INTO tblwholesale_prices(product_id, wholesale_price, price_tier, effective_from, effective_to)
              VALUES(:productId, :wholesalePrice, :priceTier, :effectiveFrom, :effectiveTo)";
      $stmt = $conn->prepare($sql);
      $stmt->bindParam(":productId", $json['productId']);
      $stmt->bindParam(":wholesalePrice", $json['wholesalePrice']);
      $stmt->bindParam(":priceTier", $json['priceTier']);
      $stmt->bindParam(":effectiveFrom", $json['effectiveFrom']);
      $stmt->bindParam(":effectiveTo", $json['effectiveTo']);
      $stmt->execute();
      $returnValue = 0;
      if($stmt->rowCount() > 0){
        $returnValue = 1;
      }
      return json_encode($returnValue);
    }

    function updateWholesalePrice($json){
      include "connection-pdo.php";
      $json = json_decode($json, true);
      $sql = "UPDATE tblwholesale_prices SET product_id=:productId, wholesale_price=:wholesalePrice,
                price_tier=:priceTier, effective_from=:effectiveFrom, effective_to=:effectiveTo
              WHERE wholesale_price_id=:wholesalePriceId";
      $stmt = $conn->prepare($sql);
      $stmt->bindParam(":productId", $json['productId']);
      $stmt->bindParam(":wholesalePrice", $json['wholesalePrice']);
      $stmt->bindParam(":priceTier", $json['priceTier']);
      $stmt->bindParam(":effectiveFrom", $json['effectiveFrom']);
      $stmt->bindParam(":effectiveTo", $json['effectiveTo']);
      $stmt->bindParam(":wholesalePriceId", $json['wholesalePriceId']);
      $stmt->execute();
      $returnValue = $stmt->rowCount() > 0 ? 1 : 0;
      return json_encode($returnValue);
    }

    //no downstream FK references a price tier directly - plain hard delete
    function deleteWholesalePrice($json){
      include "connection-pdo.php";
      $json = json_decode($json, true);
      $sql = "DELETE FROM tblwholesale_prices WHERE wholesale_price_id=:wholesalePriceId";
      $stmt = $conn->prepare($sql);
      $stmt->bindParam(":wholesalePriceId", $json['wholesalePriceId']);
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

  $wholesalePrice = new WholesalePrice();
  switch($operation){
    case "getAllWholesalePrices":
      echo $wholesalePrice->getAllWholesalePrices();
      break;
    case "getWholesalePrice":
      echo $wholesalePrice->getWholesalePrice($json);
      break;
    case "insertWholesalePrice":
      echo $wholesalePrice->insertWholesalePrice($json);
      break;
    case "updateWholesalePrice":
      echo $wholesalePrice->updateWholesalePrice($json);
      break;
    case "deleteWholesalePrice":
      echo $wholesalePrice->deleteWholesalePrice($json);
      break;
  }
?>
