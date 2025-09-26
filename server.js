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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/admin', express.static('admin'));
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

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://swiftxchangepro.netlify.app';

app.use(cors({
  origin: 'https://swiftxchangepro.netlify.app', // Your exact Netlify URL
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS']
}));


// const limiter = rateLimit({
 // windowMs: 60 * 1000, // 1 minute
 // max: 30, // limit requests per minute
// });
// app.use(limiter);


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
                role ENUM('user', 'admin') DEFAULT 'user',
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

      // Support tickets table
await pool.execute(`
    CREATE TABLE IF NOT EXISTS support_tickets (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        ticket_number VARCHAR(20) UNIQUE NOT NULL,
        subject VARCHAR(200) NOT NULL,
        category ENUM('technical', 'account', 'trading', 'billing', 'general') DEFAULT 'general',
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        status ENUM('open', 'in_progress', 'waiting_response', 'resolved', 'closed') DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
`);

// Support messages (for ticket conversations)
await pool.execute(`
    CREATE TABLE IF NOT EXISTS support_messages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        ticket_id INT NOT NULL,
        sender_id INT NOT NULL,
        sender_type ENUM('user', 'admin') NOT NULL,
        message TEXT NOT NULL,
        attachments JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    )
`);

// Knowledge base articles
await pool.execute(`
    CREATE TABLE IF NOT EXISTS kb_articles (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(200) NOT NULL,
        slug VARCHAR(200) UNIQUE NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(100),
        tags JSON,
        status ENUM('draft', 'published') DEFAULT 'published',
        views INT DEFAULT 0,
        helpful_votes INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
       const [adminExists] = await pool.execute(
            "SELECT id FROM users WHERE email = 'swiftxchangepro@gmail.com'"
        );

        if (adminExists.length === 0) {
            console.log('🔧 Creating default admin user...');
            const defaultPassword = 'AdminPass123!'; // Change this!
            const hashedPassword = await bcrypt.hash(defaultPassword, 12);

            await pool.execute(`
                INSERT INTO users (
                    first_name, last_name, username, email, 
                    password_hash, email_verified, status, role, failed_logins
                ) VALUES (?, ?, ?, ?, ?, 1, 'active', 'admin', 0)
            `, [
                'Super', 'Admin', 'superadmin', 'swiftxchangepro@gmail.com', 
                hashedPassword
            ]);

            console.log('✅ Default admin created:');
            console.log('📧 Email: swiftxchangepro@gmail.com');
            console.log('🔑 Password: AdminPass123!');
            console.log('⚠️  CHANGE THIS PASSWORD IMMEDIATELY!');
        } else {
            // Ensure existing user has admin role
            await pool.execute(`
                UPDATE users 
                SET role = 'admin' 
                WHERE email = 'swiftxchangepro@gmail.com'
            `);
            console.log('✅ Admin role updated for existing user');
        }

        console.log('✅ Database tables initialized successfully');
    } catch (error) {
        console.error('❌ Database initialization error:', error);
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


app.use(session({
    key: 'swiftx_session',
    secret: process.env.SESSION_SECRET || 'supersecret',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        secure: true,
        sameSite: 'none',
        httpOnly: true,  // Change to false temporarily for testing
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


// Login endpoint
app.post('/api/login', async (req, res) => {
    const { email, password, accountType } = req.body;
    
    try {
        // 1. Find user by email
        const [rows] = await pool.execute("SELECT * FROM users WHERE email = ?", [email]);
        
        if (rows.length === 0) {
            return res.json({ success: false, message: "Invalid email or password" });
        }
        
        const user = rows[0];
        
        // 2. Verify password
        const valid = await bcrypt.compare(password, user.password_hash);
        
        if (!valid) {
            await pool.execute("UPDATE users SET failed_logins = failed_logins + 1 WHERE id = ?", [user.id]);
            return res.json({ success: false, message: "Invalid email or password" });
        }
        
        // 3. Determine account type
        let finalAccountType = accountType && ['demo', 'live'].includes(accountType) ? accountType : 'demo';
        
        // 4. Handle trading account
        try {
            const [existingAccount] = await pool.execute(
                "SELECT id FROM trading_accounts WHERE user_id = ?", 
                [user.id]
            );
            
            if (existingAccount.length > 0) {
                // Update existing account type
                await pool.execute(
                    "UPDATE trading_accounts SET account_type = ?, updated_at = NOW() WHERE user_id = ?", 
                    [finalAccountType, user.id]
                );
            } else {
                // Create new trading account
                const accountNumber = 'SXR' + Date.now().toString() + Math.floor(Math.random() * 1000);
                const initialBalance = finalAccountType === 'demo' ? 10000 : 0;
                
                await pool.execute(
                    "INSERT INTO trading_accounts (user_id, account_number, account_type, balance, currency, created_at, updated_at) VALUES (?, ?, ?, ?, 'USD', NOW(), NOW())", 
                    [user.id, accountNumber, finalAccountType, initialBalance]
                );
            }
        } catch (accountError) {
            console.error('Trading account error:', accountError);
            // Continue with login even if account creation fails
        }
        
        // 5. Set session data and save
        req.session.userId = user.id;
        req.session.userEmail = user.email;
        req.session.accountType = finalAccountType;
        
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.json({ success: false, message: 'Login failed - session error' });
            }
            
            // 6. Update user login statistics
            pool.execute(
                "UPDATE users SET failed_logins = 0, last_login_at = NOW(), last_login_ip = ? WHERE id = ?", 
                [req.ip, user.id]
            ).catch(console.error);
            
            // 7. Send success response
            res.json({ 
                success: true, 
                message: `Login successful with ${finalAccountType} account`, 
                redirectUrl: "/dashboard.html",
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    accountType: finalAccountType
                }
            });
        });
        
    } catch (err) {
        console.error('Login error:', err);
        res.json({ success: false, message: "Login failed" });
    }
});


// Debug endpoint - add this temporarily
app.post('/api/debug-login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const [rows] = await pool.execute("SELECT * FROM users WHERE email = ?", [email]);
        if (rows.length === 0) {
            return res.json({ success: false, message: "User not found" });
        }
        
        const user = rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        
        if (!valid) {
            return res.json({ success: false, message: "Invalid password" });
        }
        
        // Test session setting
        req.session.testUserId = user.id;
        req.session.testData = "Debug session data";
        
        req.session.save((err) => {
            if (err) {
                console.error('Debug session save error:', err);
                return res.json({ 
                    success: false, 
                    message: 'Session save failed',
                    error: err.message,
                    sessionId: req.sessionID
                });
            }
            
            res.json({ 
                success: true, 
                message: 'Debug session saved',
                sessionId: req.sessionID,
                sessionData: req.session
            });
        });
        
    } catch (err) {
        res.json({ success: false, message: err.message });
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


// Replace your /api/admin-login endpoint with this version:
app.post('/api/admin-login', async (req, res) => {
    const { email, password } = req.body;
    
    console.log('🔐 Admin login attempt:', email);
    
    try {
        // First check if user exists
        const [rows] = await pool.execute("SELECT * FROM users WHERE email = ?", [email]);
        
        if (rows.length === 0) {
            console.log('❌ No user found with email:', email);
            return res.json({ success: false, message: "Invalid admin credentials" });
        }
        
        const user = rows[0];
        console.log('👤 User found:', { id: user.id, email: user.email, role: user.role });
        
        // Check if user is admin
        if (user.role !== 'admin') {
            console.log('❌ User is not admin, role:', user.role);
            return res.json({ success: false, message: "Admin access required" });
        }
        
        // Verify password
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            console.log('❌ Invalid password for:', email);
            await pool.execute("UPDATE users SET failed_logins = failed_logins + 1 WHERE id=?", [user.id]);
            return res.json({ success: false, message: "Invalid admin credentials" });
        }
        
        console.log('✅ Password valid, setting session data');
        
        // Set session data
        req.session.userId = user.id;
        req.session.userEmail = user.email;
        req.session.isAdmin = true;
        req.session.role = 'admin';
        
        // Save session explicitly and wait for it
        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) {
                    console.error('❌ Session save error:', err);
                    reject(err);
                } else {
                    console.log('✅ Session saved successfully:', {
                        sessionId: req.sessionID,
                        userId: user.id,
                        isAdmin: true
                    });
                    resolve();
                }
            });
        });
        
        await pool.execute("UPDATE users SET failed_logins=0, last_login_at=NOW(), last_login_ip=? WHERE id=?", [req.ip, user.id]);
        
        res.json({ 
            success: true, 
            message: "Admin login successful",
            admin: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role
            }
        });
        
    } catch (err) {
        console.error('❌ Admin login error:', err);
        res.json({ success: false, message: "Admin login failed" });
    }
});

// Create support ticket
app.post('/api/support/tickets', authRequired, async (req, res) => {
    try {
        const { subject, category, priority, message } = req.body;
        const userId = req.session.userId;
        
        // Generate unique ticket number
        const ticketNumber = 'TK' + Date.now().toString().slice(-8);
        
        // Create ticket
        const [ticketResult] = await pool.execute(`
            INSERT INTO support_tickets (user_id, ticket_number, subject, category, priority)
            VALUES (?, ?, ?, ?, ?)
        `, [userId, ticketNumber, subject, category, priority]);
        
        const ticketId = ticketResult.insertId;
        
        // Add first message
        await pool.execute(`
            INSERT INTO support_messages (ticket_id, sender_id, sender_type, message)
            VALUES (?, ?, 'user', ?)
        `, [ticketId, userId, message]);
        
        res.json({ success: true, ticketNumber, ticketId });
    } catch (error) {
        console.error('Error creating support ticket:', error);
        res.json({ success: false, message: 'Failed to create ticket' });
    }
});

// Live crypto data endpoint
app.get('/api/crypto-data/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { interval = '1d', limit = 100 } = req.query;
        
        // Using Binance API for crypto data (free, no API key needed)
        const binanceSymbol = symbol.replace('/', '').toUpperCase();
        const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (Array.isArray(data)) {
            const formattedData = data.map(item => ({
                time: new Date(item[0]).toISOString().split('T')[0],
                open: parseFloat(item[1]),
                high: parseFloat(item[2]),
                low: parseFloat(item[3]),
                close: parseFloat(item[4]),
                volume: parseFloat(item[5])
            }));
            
            res.json({ success: true, data: formattedData });
        } else {
            throw new Error('Invalid data format');
        }
    } catch (error) {
        console.error('Crypto data error:', error);
        res.json({ success: false, message: 'Failed to fetch crypto data' });
    }
});

// Live forex data endpoint  
app.get('/api/forex-data/:pair', async (req, res) => {
    try {
        const { pair } = req.params;
        const { interval = 'D1', count = 100 } = req.query;
        
        const API_KEY = process.env.ALPHA_VANTAGE_KEY || '0H7XF1OM8577OKS9';
        const url = `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=${pair.substring(0,3)}&to_symbol=${pair.substring(3,6)}&apikey=${API_KEY}`;
        
        console.log('Fetching forex data from:', url);
        
        const response = await fetch(url);
        const data = await response.json();
        
        // FIXED: Correct property name
        if (data['Time Series FX (Daily)']) {
            const timeSeries = data['Time Series FX (Daily)'];
            const formattedData = Object.entries(timeSeries)
                .slice(0, count)
                .map(([date, values]) => ({
                    time: date,
                    open: parseFloat(values['1. open']),
                    high: parseFloat(values['2. high']),
                    low: parseFloat(values['3. low']),
                    close: parseFloat(values['4. close'])
                }))
                .reverse(); // Reverse to get chronological order
            
            console.log(`Successfully formatted ${formattedData.length} forex data points for ${pair}`);
            res.json({ success: true, data: formattedData });
        } else if (data['Error Message']) {
            console.error('Alpha Vantage error:', data['Error Message']);
            res.json({ success: false, message: data['Error Message'] });
        } else if (data['Note']) {
            console.error('Alpha Vantage rate limit:', data['Note']);
            res.json({ success: false, message: 'Rate limit exceeded. Please try again later.' });
        } else {
            console.error('Unexpected response structure:', data);
            res.json({ success: false, message: 'Invalid forex data format' });
        }
    } catch (error) {
        console.error('Forex data error:', error);
        res.json({ success: false, message: 'Failed to fetch forex data' });
    }
});

// Live prices for multiple symbols (for mini charts and watchlist)
app.get('/api/live-prices', async (req, res) => {
    try {
        const { symbols, market } = req.query;
        const symbolList = symbols ? symbols.split(',') : [];
        const prices = {};
        
        if (market === 'crypto') {
            // Get crypto prices from Binance
            const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
            const data = await response.json();
            
            symbolList.forEach(symbol => {
                const binanceSymbol = symbol.replace('/', '').toUpperCase();
                const ticker = data.find(t => t.symbol === binanceSymbol);
                
                if (ticker) {
                    prices[symbol] = {
                        price: parseFloat(ticker.lastPrice),
                        change: parseFloat(ticker.priceChange),
                        changePercent: parseFloat(ticker.priceChangePercent),
                        volume: parseFloat(ticker.volume)
                    };
                }
            });
        } else if (market === 'forex') {
            // For forex, you'd need a real-time forex API
            // This is a simplified example - you may need a paid service for real-time forex
            const API_KEY = process.env.ALPHA_VANTAGE_KEY || 'demo';
            
            for (const pair of symbolList) {
                try {
                    const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${pair.substring(0,3)}&to_currency=${pair.substring(3,6)}&apikey=${API_KEY}`;
                    const response = await fetch(url);
                    const data = await response.json();
                    
                    if (data['Realtime Currency Exchange Rate']) {
                        const rate = data['Realtime Currency Exchange Rate'];
                        prices[pair] = {
                            price: parseFloat(rate['5. Exchange Rate']),
                            change: 0, // Alpha Vantage free tier doesn't provide change
                            changePercent: 0,
                            lastUpdate: rate['6. Last Refreshed']
                        };
                    }
                } catch (error) {
                    console.error(`Error fetching ${pair}:`, error);
                }
            }
        }
        
        res.json({ success: true, prices });
    } catch (error) {
        console.error('Live prices error:', error);
        res.json({ success: false, message: 'Failed to fetch live prices' });
    }
});

// WebSocket for real-time updates (optional but recommended)
app.get('/api/start-realtime/:market', (req, res) => {
    const { market } = req.params;
    
    if (market === 'crypto') {
        // You can implement WebSocket connection to Binance streams
        res.json({ success: true, message: 'Crypto real-time feed started' });
    } else {
        res.json({ success: true, message: 'Forex real-time feed started' });
    }
});

// Get user's support tickets
app.get('/api/support/tickets', authRequired, async (req, res) => {
    try {
        const userId = req.session.userId;
        
        const [tickets] = await pool.execute(`
            SELECT st.*, 
                   (SELECT COUNT(*) FROM support_messages WHERE ticket_id = st.id) as message_count,
                   (SELECT created_at FROM support_messages WHERE ticket_id = st.id ORDER BY created_at DESC LIMIT 1) as last_message_at
            FROM support_tickets st 
            WHERE st.user_id = ?
            ORDER BY st.updated_at DESC
        `, [userId]);
        
        res.json({ success: true, tickets });
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.json({ success: false, message: 'Failed to fetch tickets' });
    }
});

// Get ticket messages
app.get('/api/support/tickets/:id/messages', authRequired, async (req, res) => {
    try {
        const ticketId = req.params.id;
        const userId = req.session.userId;
        
        // Verify user owns this ticket or is admin
        const [ticket] = await pool.execute(
            'SELECT user_id FROM support_tickets WHERE id = ?', 
            [ticketId]
        );
        
        if (ticket.length === 0 || (ticket[0].user_id !== userId && !req.session.isAdmin)) {
            return res.json({ success: false, message: 'Access denied' });
        }
        
        const [messages] = await pool.execute(`
            SELECT sm.*, u.first_name, u.last_name, u.email
            FROM support_messages sm
            JOIN users u ON sm.sender_id = u.id
            WHERE sm.ticket_id = ?
            ORDER BY sm.created_at ASC
        `, [ticketId]);
        
        res.json({ success: true, messages });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.json({ success: false, message: 'Failed to fetch messages' });
    }
});

// Admin: Get all support tickets
app.get('/api/admin/support/tickets', authRequired, async (req, res) => {
    try {
        if (!req.session.isAdmin) {
            return res.json({ success: false, message: 'Admin access required' });
        }
        
        const [tickets] = await pool.execute(`
            SELECT st.*, u.first_name, u.last_name, u.email,
                   (SELECT COUNT(*) FROM support_messages WHERE ticket_id = st.id) as message_count
            FROM support_tickets st
            JOIN users u ON st.user_id = u.id
            ORDER BY st.updated_at DESC
        `);
        
        res.json({ success: true, tickets });
    } catch (error) {
        console.error('Error fetching admin tickets:', error);
        res.json({ success: false, message: 'Failed to fetch tickets' });
    }
});

// Knowledge base search
app.get('/api/kb/search', async (req, res) => {
    try {
        const { q } = req.query;
        
        let query = `
            SELECT id, title, slug, category, 
                   SUBSTRING(content, 1, 200) as excerpt
            FROM kb_articles 
            WHERE status = 'published'
        `;
        
        const params = [];
        
        if (q) {
            query += ` AND (title LIKE ? OR content LIKE ?)`;
            params.push(`%${q}%`, `%${q}%`);
        }
        
        query += ` ORDER BY helpful_votes DESC, views DESC LIMIT 20`;
        
        const [articles] = await pool.execute(query, params);
        
        res.json({ success: true, articles });
    } catch (error) {
        console.error('Error searching knowledge base:', error);
        res.json({ success: false, message: 'Search failed' });
    }
});






// Check debug session
app.get('/api/debug-session', (req, res) => {
    res.json({
        sessionId: req.sessionID,
        sessionData: req.session,
        hasTestData: !!req.session.testData,
        hasUserId: !!req.session.testUserId
    });
});

// Dashboard (protected)
app.get('/api/dashboard', authRequired, async (req, res) => {
   try {
        console.log('🔍 Dashboard request debug:', {
            sessionId: req.sessionID,
            userId: req.session.userId,
            accountType: req.session.accountType,
            userAgent: req.headers['user-agent']
        });

        const [user] = await pool.execute("SELECT first_name, last_name, email, status FROM users WHERE id=?", [req.session.userId]);
        console.log('👤 User found:', user[0]);
        
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



// Authentication middleware (if you don't have one)
function authenticateUser(req, res, next) {
    // This should check if user is logged in
    // Could be session-based, JWT-based, etc.
    
    // Example for session-based:
    if (req.session && req.session.user) {
        req.user = req.session.user;
        next();
    } else {
        res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }
}

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

// Replace your existing verify-admin-access endpoint with this:
app.get('/api/verify-admin-access', (req, res) => {
    console.log('🔐 Verifying admin access for session:', req.sessionID);
    console.log('📋 Session data:', req.session);
    console.log('🍪 Request headers cookies:', req.headers.cookie);
    console.log('🌐 Request origin:', req.headers.origin);
    console.log('👤 Session userId:', req.session.userId);
    console.log('🔑 Session isAdmin:', req.session.isAdmin);
    
    if (!req.session.userId || !req.session.isAdmin) {
        console.log('❌ Admin access denied - no session data');
        return res.json({ success: false, message: "Admin access required" });
    }
    
    console.log('✅ Admin access verified');
    res.json({ 
        success: true, 
        admin: {
            id: req.session.userId,
            email: req.session.userEmail,
            role: req.session.role
        }
    });
});
// ADD THE DEBUG ENDPOINT HERE:
app.get('/api/debug-admin-session', (req, res) => {
    console.log('Session ID:', req.sessionID);
    console.log('Session data:', req.session);
    console.log('User ID from session:', req.session.userId);
    console.log('Is Admin from session:', req.session.isAdmin);
    
    res.json({
        sessionExists: !!req.session,
        sessionId: req.sessionID,
        userId: req.session.userId || null,
        userEmail: req.session.userEmail || null,
        isAdmin: req.session.isAdmin || false,
        fullSession: req.session
    });
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



// Admin endpoint to get all users with their account balances
app.get('/api/admin/users', authRequired, async (req, res) => {
    try {
        if (!req.session.isAdmin) {
            return res.json({ success: false, message: "Admin access required" });
        }

        const [users] = await pool.execute(`
            SELECT 
                u.id, u.email, u.first_name, u.last_name, u.username, 
                u.phone, u.country, u.status, u.role, u.email_verified, 
                u.created_at, u.last_login_at,
                ta.balance, ta.account_type, ta.account_number
            FROM users u
            LEFT JOIN trading_accounts ta ON u.id = ta.user_id
            ORDER BY u.created_at DESC
        `);

        res.json({ success: true, users: users });
    } catch (error) {
        console.error('Database error fetching users:', error);
        res.json({ success: false, message: `Database error: ${error.message}` });
    }
});
        
// Admin endpoint to get dashboard stats
app.get('/api/admin/dashboard-stats', authRequired, async (req, res) => {
    try {
        if (!req.session.isAdmin) {
            return res.json({ success: false, message: "Admin access required" });
        }

        // Get total users
        const [userCount] = await pool.execute('SELECT COUNT(*) as count FROM users');
        
        // Get total balance from trading accounts
        const [balanceSum] = await pool.execute('SELECT SUM(balance) as total FROM trading_accounts');
        
        // Get total trades
        const [tradesCount] = await pool.execute('SELECT COUNT(*) as count FROM trades');
        
        // Get pending deposits and withdrawals
        const [pendingDeposits] = await pool.execute("SELECT COUNT(*) as count FROM deposits WHERE status = 'pending'");
        const [pendingWithdrawals] = await pool.execute("SELECT COUNT(*) as count FROM withdrawals WHERE status = 'pending'");
        
        res.json({ 
            success: true, 
            stats: {
                totalUsers: userCount[0].count,
                totalBalance: balanceSum[0].total || 0,
                totalTrades: tradesCount[0].count,
                pendingActions: pendingDeposits[0].count + pendingWithdrawals[0].count
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.json({ success: false, message: "Failed to fetch stats" });
    }
});

// Admin endpoint to update user balance
app.post('/api/admin/update-balance', authRequired, async (req, res) => {
    try {
        if (!req.session.isAdmin) {
            return res.json({ success: false, message: "Admin access required" });
        }

        const { userId, amount, action } = req.body; // action: 'credit' or 'debit'
        
        if (action === 'credit') {
            await pool.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, userId]);
        } else if (action === 'debit') {
            await pool.execute('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, userId]);
        }

        res.json({ success: true, message: `Successfully ${action}ed $${amount}` });
    } catch (error) {
        console.error('Error updating balance:', error);
        res.json({ success: false, message: "Failed to update balance" });
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























































