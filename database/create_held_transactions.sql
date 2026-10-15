CREATE TABLE IF NOT EXISTS `tblheld_transactions` (
  `held_id` INT AUTO_INCREMENT PRIMARY KEY,
  `hold_reference` VARCHAR(100) NOT NULL,
  `cashier_user_id` INT NOT NULL,
  `customer_label` VARCHAR(255) DEFAULT NULL,
  `sale_type` VARCHAR(50) DEFAULT 'Cash',
  `items_json` LONGTEXT NOT NULL,
  `cart_state_json` LONGTEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (`cashier_user_id`),
  INDEX (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE OR REPLACE VIEW `held_transactions` AS SELECT * FROM `tblheld_transactions`;
