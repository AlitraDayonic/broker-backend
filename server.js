// SwiftXchangerate.com Complete Backend (Session-based)
// Copy-paste ready ✅

const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;




// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); // serve frontend

// Always prefer MYSQL_URL
if (!process.env.MYSQL_URL) {
  throw new Error("❌ MYSQL_URL not set in environment!");
}
// const helmet = require('helmet');
// const rateLimit = require('express-rate-limit');

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://your-frontend-domain.netlify.app';

// app.use(helmet());
app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS']
}));

// const limiter = rateLimit({
 // windowMs: 60 * 1000, // 1 minute
 // max: 30, // limit requests per minute
// });
// app.use(limiter);


// SESSION
app.use(session({
  key: 'swiftx_session',
  secret: process.env.SESSION_SECRET || 'supersecret',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',         // true in production
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' // none for cross-site in prod
  }
}));

// Connection pool
const pool = mysql.createPool(process.env.MYSQL_URL);





// Initialize tables if missing
async function initializeDatabase() {
    try {
        // Create users table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS users (
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
                status ENUM('pending', 'active', 'suspended') DEFAULT 'pending',
                failed_logins INT DEFAULT 0,
                last_login_at TIMESTAMP NULL,
                last_login_ip VARCHAR(45),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // User profiles
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS user_profiles (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                account_type ENUM('demo', 'live') DEFAULT 'demo',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Trading accounts
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS trading_accounts (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                account_number VARCHAR(50) UNIQUE NOT NULL,
                account_type ENUM('demo', 'live') DEFAULT 'demo',
                balance DECIMAL(15,2) DEFAULT 10000,
                currency VARCHAR(3) DEFAULT 'USD',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        

        // Trades
await pool.execute(`
    CREATE TABLE IF NOT EXISTS trades (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        account_id INT NOT NULL,
        asset VARCHAR(50) NOT NULL,
        asset_name VARCHAR(100),
        quantity DECIMAL(15,8) NOT NULL,
        price DECIMAL(15,2) NOT NULL,
        total_amount DECIMAL(15,2) NOT NULL,
        trade_type ENUM('buy','sell') NOT NULL,
        status ENUM('pending','completed','failed') DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (account_id) REFERENCES trading_accounts(id) ON DELETE CASCADE
    )
`);




        // Optional: add deposits table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS deposits (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                account_id INT NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                currency VARCHAR(3) DEFAULT 'USD',
                payment_method VARCHAR(50),
                reference_number VARCHAR(100),
                status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (account_id) REFERENCES trading_accounts(id) ON DELETE CASCADE
            )
        `);

        // Optional: add withdrawals table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS withdrawals (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                account_id INT NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                currency VARCHAR(3) DEFAULT 'USD',
                payment_method VARCHAR(50),
                bank_details JSON,
                reference_number VARCHAR(100),
                status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (account_id) REFERENCES trading_accounts(id) ON DELETE CASCADE
            )
        `);

        console.log('✅ Database tables initialized successfully');
    } catch (error) {
        console.error('❌ Database initialization error:', error);
    }
}

// Add this after your pool creation in server.js
async function initializeDatabase() {
    try {
        // Check if "role" column exists
        const [rows] = await pool.execute(`
            SHOW COLUMNS FROM users LIKE 'role'
        `);

        if (rows.length === 0) {
            await pool.execute(`
                ALTER TABLE users 
                ADD COLUMN role ENUM('user', 'admin') DEFAULT 'user'
            `);
            console.log('✅ Role column added to users table');
        } else {
            console.log('ℹ️ Role column already exists');
        }

        // Ensure your account is admin
        await pool.execute(`
            UPDATE users 
            SET role = 'admin' 
            WHERE email = 'swiftxchangepro@gmail.com'
        `);

        console.log('✅ Database initialized with admin role');
    } catch (error) {
        console.error('Database initialization error:', error.message);
    }
}

// Call at startup
initializeDatabase();




// Parse the MySQL URL from Railway (e.g. mysql://root:pass@host:port/dbname)
const mysql_url = new URL(process.env.MYSQL_URL || 'mysql://root:@localhost:3306/test');

// Session store using parsed values
const sessionStore = new MySQLStore({
    host: mysql_url.hostname,                  // e.g. trolley.proxy.rlwy.net
    port: mysql_url.port,                      // e.g. 55683
    user: mysql_url.username,                  // e.g. root
    password: mysql_url.password,              // your MySQL password
    database: mysql_url.pathname.slice(1),     // remove leading "/" from "/railway"
    createDatabaseTable: true
}, pool);


// Sessions
app.use(session({
    key: 'swiftx_session',
    secret: process.env.SESSION_SECRET || 'supersecret',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
  maxAge: 24 * 60 * 60 * 1000,
  secure: false,        
  sameSite: 'lax'
}

}));

// Email transporter - manual Gmail configuration (no service override)
const emailTransporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-email-password'
    },
    tls: {
        rejectUnauthorized: false
    },
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000
});

// Test email connection (but don't block startup if it fails)
emailTransporter.verify((error, success) => {
    if (error) {
        console.log('❌ Email configuration error:', error.message);
        console.log('💡 Email will be attempted during actual sending');
    } else {
        console.log('✅ Email server is ready');
    }
});

// Helpers
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateAccountNumber() {
    return 'SXR' + Date.now().toString() + Math.floor(Math.random() * 1000);
}

async function sendVerificationEmail(email, code, firstName) {
    try {
        await emailTransporter.sendMail({
            from: process.env.EMAIL_USER || 'noreply@swiftxchangerate.com',
            to: email,
            subject: 'SwiftXchangerate - Email Verification',
            html: `<h2>Hello ${firstName},</h2>
                   <p>Your verification code is:</p>
                   <h1>${code}</h1>
                   <p>This code expires in 24 hours.</p>`
        });
        return true;
    } catch (err) {
        console.error('Email error:', err);
        return false;
    }
}

// Middleware to protect routes
function authRequired(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: "Please log in first" });
    }
    next();
}






// ------------------- ROUTES -------------------

// Register
app.post('/api/register', async (req, res) => {
    const { firstName, lastName, username, email, phone, country, accountType, password } = req.body;
    try {
        const [existing] = await pool.execute("SELECT id FROM users WHERE email = ? OR username = ?", [email, username]);
        if (existing.length > 0) return res.json({ success: false, message: "Email or username already in use" });

        const hash = await bcrypt.hash(password, 12);
        const code = generateVerificationCode();

        const [result] = await pool.execute(
            "INSERT INTO users (first_name, last_name, username, email, phone, country, password_hash, verification_code, status, failed_logins) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)",
            [firstName, lastName, username, email, phone, country, hash, code]
        );

        const userId = result.insertId;
        await pool.execute("INSERT INTO user_profiles (user_id, account_type) VALUES (?, ?)", [userId, accountType || 'demo']);
       const startingBalance = accountType === 'live' ? 0 : 10000; 
      await pool.execute( 
        "INSERT INTO trading_accounts (user_id, account_number, account_type, balance, currency) VALUES (?, ?, ?, ?, 'USD')", 
        [userId, generateAccountNumber(), accountType || 'demo', startingBalance] );

        // await sendVerificationEmail(email, code, firstName);

        res.json({ success: true, message: "Registered successfully. Please verify your email." });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Registration failed" });
    }
});

// Verify email
app.post('/api/verify-email', async (req, res) => {
    const { email, code } = req.body;
    try {
        const [rows] = await pool.execute("SELECT id, verification_code FROM users WHERE email = ? AND status = 'pending'", [email]);
        if (rows.length === 0) return res.json({ success: false, message: "Invalid request" });

        if (rows[0].verification_code !== code) return res.json({ success: false, message: "Invalid code" });

        await pool.execute("UPDATE users SET email_verified=1, status='active', verification_code=NULL WHERE id=?", [rows[0].id]);
        res.json({ success: true, message: "Email verified successfully" });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Verification failed" });
    }
});


// Login (without email verification check)
// Enhanced Login with account type detection
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await pool.execute("SELECT * FROM users WHERE email=?", [email]);
        if (rows.length === 0) return res.json({ success: false, message: "Invalid email or password" });
        
        const user = rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            await pool.execute("UPDATE users SET failed_logins = failed_logins + 1 WHERE id=?", [user.id]);
            return res.json({ success: false, message: "Invalid email or password" });
        }

        // Get user's trading account info to determine account type
        const [accountRows] = await pool.execute(
            "SELECT account_type FROM trading_accounts WHERE user_id=? ORDER BY id DESC LIMIT 1", 
            [user.id]
        );
        
        const accountType = accountRows.length > 0 ? accountRows[0].account_type : 'demo';
        
        req.session.userId = user.id;
        req.session.userEmail = user.email;
        req.session.accountType = accountType; // Store account type in session
        
        await pool.execute("UPDATE users SET failed_logins=0, last_login_at=NOW(), last_login_ip=? WHERE id=?", [req.ip, user.id]);
        
        // Determine redirect based on account type
        let redirectUrl = "/dashboard.html"; // Default to dashboard
        
        if (accountType === 'live') {
            redirectUrl = "/dashboard.html"; // Live users go to dashboard
        } else {
            redirectUrl = "/dashboard.html"; // Demo users also go to dashboard
        }
        
        res.json({ 
            success: true, 
            message: "Login successful", 
            redirectUrl: redirectUrl,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                accountType: accountType
            }
        });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Login failed" });
    }
});

// Temporary admin registration endpoint (remove after creating admin)
app.post('/api/register-admin', async (req, res) => {
    const { firstName, lastName, username, email, password } = req.body;
    
    try {
        // Check if admin already exists
        const [existing] = await pool.execute("SELECT id FROM users WHERE email = ? OR role = 'admin'", [email]);
        if (existing.length > 0) {
            return res.json({ success: false, message: "Admin user already exists" });
        }

        const hash = await bcrypt.hash(password, 12);

        // Create admin user directly (no email verification needed)
        const [result] = await pool.execute(
            "INSERT INTO users (first_name, last_name, username, email, password_hash, email_verified, status, role, failed_logins) VALUES (?, ?, ?, ?, ?, 1, 'active', 'admin', 0)",
            [firstName, lastName, username, email, hash]
        );

        // Create admin profile and trading account
        const userId = result.insertId;
        await pool.execute("INSERT INTO user_profiles (user_id, account_type) VALUES (?, 'admin')", [userId]);
        await pool.execute("INSERT INTO trading_accounts (user_id, account_number, account_type, balance, currency) VALUES (?, ?, 'admin', 100000, 'USD')", [userId, generateAccountNumber()]);

        res.json({ success: true, message: "Admin user created successfully" });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Admin registration failed" });
    }
});



// Dashboard (protected)
app.get('/api/dashboard', authRequired, async (req, res) => {
    try {
        const [user] = await pool.execute("SELECT first_name, last_name, email, status FROM users WHERE id=?", [req.session.userId]);
        
        // Get account type from session (default to demo)
        const accountType = req.session.accountType || 'demo';
        
        // Get specific account based on type
        const [accounts] = await pool.execute(
            "SELECT account_number, account_type, balance, currency FROM trading_accounts WHERE user_id=? AND account_type=?", 
            [req.session.userId, accountType]
        );
        
        // If no account exists for this type, create it
        if (accounts.length === 0) {
            const accountNumber = 'SXR' + Date.now().toString() + Math.floor(Math.random() * 1000);
            const initialBalance = accountType === 'demo' ? 10000 : 0;
            
            await pool.execute(
                "INSERT INTO trading_accounts (user_id, account_number, account_type, balance, currency) VALUES (?, ?, ?, ?, 'USD')",
                [req.session.userId, accountNumber, accountType, initialBalance]
            );
            
            // Get the newly created account
            const [newAccounts] = await pool.execute(
                "SELECT account_number, account_type, balance, currency FROM trading_accounts WHERE user_id=? AND account_type=?", 
                [req.session.userId, accountType]
            );
            
            return res.json({ success: true, user: user[0], accounts: newAccounts });
        }
        
        res.json({ success: true, user: user[0], accounts });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Dashboard failed" });
    }
});


// ================= Account Switching Routes ================= //
// Get current account type
app.get('/api/current-account-type', authRequired, async (req, res) => {
    res.json({ 
        success: true, 
        accountType: req.session.accountType || 'demo' 
    });
});

// Switch account type
app.post('/api/switch-account-type', authRequired, async (req, res) => {
    const { accountType } = req.body;
    
    if (!['demo', 'live'].includes(accountType)) {
        return res.json({ success: false, message: 'Invalid account type' });
    }
    
    try {
        // Update session
        req.session.accountType = accountType;
        
        // Ensure the account exists in trading_accounts
        const [rows] = await pool.execute(
            "SELECT id FROM trading_accounts WHERE user_id=? AND account_type=?",
            [req.session.userId, accountType]
        );
        
        if (rows.length === 0) {
            // Create account if missing
            const startingBalance = accountType === 'live' ? 0 : 10000;
            await pool.execute(
                "INSERT INTO trading_accounts (user_id, account_number, account_type, balance, currency) VALUES (?, ?, ?, ?, 'USD')",
                [req.session.userId, 'SXR' + Date.now(), accountType, startingBalance]
            );
        }
        
        res.json({ 
            success: true, 
            message: `Switched to ${accountType} account`,
            accountType 
        });
    } catch (error) {
        console.error('Account switch error:', error);
        res.json({ success: false, message: 'Failed to switch account' });
    }
});


// Trade endpoint (add this to your server.js)
app.post('/api/trade', authRequired, async (req, res) => {
    const { accountId, asset, quantity, price, totalAmount, tradeType, assetName } = req.body;
    try {
        // Insert trade record
        await pool.execute(
            "INSERT INTO trades (user_id, account_id, asset, quantity, price, total_amount, trade_type, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')",
            [req.session.userId, accountId, asset, quantity, price, totalAmount, tradeType]
        );
        
        // Update account balance
        const balanceChange = tradeType === 'buy' ? -totalAmount : totalAmount;
        await pool.execute(
            "UPDATE trading_accounts SET balance = balance + ? WHERE id = ? AND user_id = ?",
            [balanceChange, accountId, req.session.userId]
        );
        
        res.json({ success: true, message: "Trade completed successfully" });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Trade failed" });
    }
});


// Deposit
app.post('/api/deposit', authRequired, async (req, res) => {
    const { accountId, amount, method, currency } = req.body;
    try {
        await pool.execute("INSERT INTO deposits (user_id, account_id, amount, currency, payment_method, reference_number, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')",
            [req.session.userId, accountId, amount, currency, method, 'REF' + Date.now()]);
        res.json({ success: true, message: "Deposit request submitted" });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Deposit failed" });
    }
});

// Withdraw
app.post('/api/withdraw', authRequired, async (req, res) => {
    const { accountId, amount, method, bankDetails, currency } = req.body;
    try {
        await pool.execute("INSERT INTO withdrawals (user_id, account_id, amount, currency, payment_method, bank_details, reference_number, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')",
            [req.session.userId, accountId, amount, currency, method, JSON.stringify(bankDetails), 'WD' + Date.now()]);
        res.json({ success: true, message: "Withdrawal request submitted" });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Withdrawal failed" });
    }
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.json({ success: false, message: "Logout failed" });
        res.json({ success: true, message: "Logged out successfully" });
    });
});

// Admin access verification endpoint
app.get('/api/verify-admin-access', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.json({ success: false, message: "Not logged in" });
        }

        // Destructure properly
        const [rows] = await pool.execute(
            "SELECT role FROM users WHERE id = ?", 
            [req.session.userId]
        );

        if (rows.length === 0 || rows[0].role !== 'admin') {
            return res.json({ success: false, message: "Admin access required" });
        }

        res.json({ success: true, message: "Admin access verified" });
    } catch (error) {
        console.error('Admin verification error:', error);
        res.json({ success: false, message: "Verification failed" });
    }
});


// ================= Transaction History Routes ================= //

// 1. Trades History
app.get('/api/trades', authRequired, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            "SELECT id, asset, asset_name, quantity, price, total_amount, trade_type, status, created_at " +
            "FROM trades WHERE user_id=? ORDER BY created_at DESC",
            [req.session.userId]
        );
        res.json({ success: true, trades: rows });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Failed to fetch trades" });
    }
});

// 2. Deposits History
app.get('/api/deposits', authRequired, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            "SELECT id, amount, currency, payment_method, reference_number, status, created_at " +
            "FROM deposits WHERE user_id=? ORDER BY created_at DESC",
            [req.session.userId]
        );
        res.json({ success: true, deposits: rows });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Failed to fetch deposits" });
    }
});

// 3. Withdrawals History
app.get('/api/withdrawals', authRequired, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            "SELECT id, amount, currency, payment_method, bank_details, reference_number, status, created_at " +
            "FROM withdrawals WHERE user_id=? ORDER BY created_at DESC",
            [req.session.userId]
        );
        res.json({ success: true, withdrawals: rows });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Failed to fetch withdrawals" });
    }
});

// 4. Combined Transaction History
app.get('/api/history', authRequired, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 'trade' AS type, id, asset AS description, total_amount AS amount, 'USD' AS currency, status, created_at
            FROM trades
            WHERE user_id=?

            UNION ALL

            SELECT 'deposit' AS type, id, payment_method AS description, amount, currency, status, created_at
            FROM deposits
            WHERE user_id=?

            UNION ALL

            SELECT 'withdrawal' AS type, id, payment_method AS description, amount, currency, status, created_at
            FROM withdrawals
            WHERE user_id=?

            ORDER BY created_at DESC
        `, [req.session.userId, req.session.userId, req.session.userId]);

        res.json({ success: true, history: rows });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Failed to fetch history" });
    }
});

// ================= Settings Routes ================= // 
// Get user profile
app.get('/api/profile', authRequired, async (req, res) => {
    try {
        const [user] = await pool.execute(
            "SELECT first_name, last_name, email, phone, country FROM users WHERE id=?",
            [req.session.userId]
        );
        res.json({ success: true, user: user[0] });
    } catch (err) {
        res.json({ success: false, message: "Failed to fetch profile" });
    }
});

// Update user profile  
app.put('/api/profile', authRequired, async (req, res) => {
    const { firstName, lastName, email, phone, country } = req.body;
    try {
        await pool.execute(
            "UPDATE users SET first_name=?, last_name=?, email=?, phone=?, country=? WHERE id=?",
            [firstName, lastName, email, phone, country, req.session.userId]
        );
        res.json({ success: true, message: "Profile updated successfully" });
    } catch (err) {
        res.json({ success: false, message: "Failed to update profile" });
    }
});

// Change password
app.put('/api/change-password', authRequired, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    try {
        const [user] = await pool.execute("SELECT password_hash FROM users WHERE id=?", [req.session.userId]);
        const valid = await bcrypt.compare(currentPassword, user[0].password_hash);
        
        if (!valid) {
            return res.json({ success: false, message: "Current password is incorrect" });
        }
        
        const newHash = await bcrypt.hash(newPassword, 12);
        await pool.execute("UPDATE users SET password_hash=? WHERE id=?", [newHash, req.session.userId]);
        
        res.json({ success: true, message: "Password updated successfully" });
    } catch (err) {
        res.json({ success: false, message: "Failed to update password" });
    }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
   console.log(`📊 Database: ${mysql_url.pathname.slice(1)}`);
});
























