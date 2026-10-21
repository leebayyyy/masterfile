<?php
/**
 * Local XAMPP MySQL Database Configuration
 * Used for defense demo on localhost with XAMPP MariaDB.
 */

return [
  'db_driver' => 'mysql',        // 'mysql' for XAMPP MariaDB, 'pgsql' for PostgreSQL
  'db_host'   => 'localhost',
  'db_port'   => 3306,
  'db_name'   => 'pos_ar_system',
  'db_user'   => 'root',
  'db_pass'   => '',              // XAMPP default: empty password for root
  'ssl_mode'  => 'disable'
];
