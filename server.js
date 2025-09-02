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

const dbConfig = {
    host: process.env.MYSQLHOST || 'localhost',
    user: process.env.MYSQLUSER || 'root',
    password: process.env.MYSQLPASSWORD || '',
    database: process.env.MYSQLDATABASE || 'swiftxchangerate',
    port: process.env.MYSQLPORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Pool
const pool = mysql.createPool(dbConfig);

// Session store
const sessionStore = new MySQLStore({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    createDatabaseTable: true
});

// Sessions
app.use(session({
    key: 'swiftx_session',
    secret: process.env.SESSION_SECRET || 'supersecret',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        secure: false
    }
}));

// Email transporter - manual Gmail configuration (no service override)
const emailTransporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: false,
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
    const { firstName, lastName, username, email, phone, country, password } = req.body;
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
        await pool.execute("INSERT INTO user_profiles (user_id, account_type) VALUES (?, 'demo')", [userId]);
        await pool.execute("INSERT INTO trading_accounts (user_id, account_number, account_type, balance, currency) VALUES (?, ?, 'demo', 10000, 'USD')", [userId, generateAccountNumber()]);

        await sendVerificationEmail(email, code, firstName);

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

        req.session.userId = user.id;
        req.session.userEmail = user.email;
        await pool.execute("UPDATE users SET failed_logins=0, last_login_at=NOW(), last_login_ip=? WHERE id=?", [req.ip, user.id]);

        res.json({ success: true, message: "Login successful", redirectUrl: "/dashboard.html" });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Login failed" });
    }
});

// Dashboard (protected)
app.get('/api/dashboard', authRequired, async (req, res) => {
    try {
        const [user] = await pool.execute("SELECT first_name, last_name, email, status FROM users WHERE id=?", [req.session.userId]);
        const [accounts] = await pool.execute("SELECT account_number, account_type, balance, currency FROM trading_accounts WHERE user_id=?", [req.session.userId]);
        res.json({ success: true, user: user[0], accounts });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Dashboard failed" });
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

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Database: ${dbConfig.database}`);
});