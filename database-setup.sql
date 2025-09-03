CREATE TABLE users ( 
  id INT PRIMARY KEY AUTO_INCREMENT,
 first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL, 
  username VARCHAR(50) UNIQUE NOT NULL, 
  email VARCHAR(100) UNIQUE NOT NULL, 
  phone VARCHAR(20), 
  country VARCHAR(50), 
  password_hash VARCHAR(255) NOT NULL, 
  verification_code VARCHAR(10), 
  email_verified BOOLEAN DEFAULT FALSE, 
  status ENUM('pending', 'active', 'suspended') DEFAULT 'pending', failed_logins INT DEFAULT 0, 
  last_login_at TIMESTAMP NULL, 
  last_login_ip VARCHAR(45), 
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP ); 


  CREATE TABLE user_profiles ( 
    id INT PRIMARY KEY AUTO_INCREMENT, 
    user_id INT NOT NULL, 
    account_type ENUM('demo', 'live') DEFAULT 'demo', 
    kyc_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending', 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) 
    REFERENCES users(id) ON DELETE CASCADE ); 



CREATE TABLE trading_accounts ( 
      id INT PRIMARY KEY AUTO_INCREMENT, 
      user_id INT NOT NULL, 
      account_number VARCHAR(50) UNIQUE NOT NULL, 
      account_type ENUM('demo', 'live') DEFAULT 'demo', 
      balance DECIMAL(15,2) DEFAULT 0, 
      currency VARCHAR(3) DEFAULT 'USD', 
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ); 


CREATE TABLE trades ( 
  id INT PRIMARY KEY AUTO_INCREMENT, 
  user_id INT NOT NULL, 
  account_id INT NOT NULL, 
  asset VARCHAR(20) NOT NULL, 
  quantity DECIMAL(15,8) NOT NULL, 
  price DECIMAL(15,2) NOT NULL, 
  total_amount DECIMAL(15,2) NOT NULL, 
  trade_type ENUM('buy', 'sell') NOT NULL, 
  status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending', 
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES trading_accounts(id) ON DELETE CASCADE );




 CREATE TABLE deposits ( 
   id INT PRIMARY KEY AUTO_INCREMENT, 
   user_id INT NOT NULL, account_id INT NOT NULL, 
   amount DECIMAL(15,2) NOT NULL, 
   currency VARCHAR(3) DEFAULT 'USD', 
   payment_method VARCHAR(50), 
   reference_number VARCHAR(100), 
   status ENUM('pending', 'completed', 'rejected') DEFAULT 'pending', 
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, 
   FOREIGN KEY (account_id) REFERENCES trading_accounts(id) ON DELETE CASCADE ); 




 CREATE TABLE withdrawals ( 
   id INT PRIMARY KEY AUTO_INCREMENT, 
   user_id INT NOT NULL, account_id INT NOT NULL, 
   amount DECIMAL(15,2) NOT NULL, 
   currency VARCHAR(3) DEFAULT 'USD', 
   payment_method VARCHAR(50), 
   bank_details JSON, 
   reference_number VARCHAR(100), 
   status ENUM('pending', 'completed', 'rejected') DEFAULT 'pending', 
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
   FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, 
   FOREIGN KEY (account_id) REFERENCES trading_accounts(id) ON DELETE CASCADE );
