// SwiftXchangerate.com Complete Backend (Session-based) - PostgreSQL Version
// Copy-paste ready ✅

const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/admin', express.static('admin'));
app.use(express.static('public'));

// Always prefer DATABASE_URL (standard for PostgreSQL)
if (!process.env.DATABASE_URL) {
  throw new Error("❌ DATABASE_URL not set in environment!");
}

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://swiftxchangepro.netlify.app';

app.use(cors({
  origin: 'https://swiftxchangepro.netlify.app',
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS']
}));

// PostgreSQL Connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err);
  } else {
    console.log('✅ PostgreSQL connected successfully');
  }
});

// Initialize tables if missing
async function initializeDatabase() {
    try {
        // Create users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                first_name VARCHAR(50) NOT NULL,
                last_name VARCHAR(50) NOT NULL,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                phone VARCHAR(20),
                country VARCHAR(50),
                password_hash VARCHAR(255) NOT NULL,
                verification_code VARCHAR(10),
                email_verified BOOLEAN DEFAULT FALSE,
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
                role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
                failed_logins INT DEFAULT 0,
                last_login_at TIMESTAMP,
                last_login_ip VARCHAR(45),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
      
        // User profiles
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_profiles (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                account_type VARCHAR(20) DEFAULT 'demo' CHECK (account_type IN ('demo', 'live')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Trading accounts
        await pool.query(`
            CREATE TABLE IF NOT EXISTS trading_accounts (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                account_number VARCHAR(50) UNIQUE NOT NULL,
                account_type VARCHAR(20) DEFAULT 'demo' CHECK (account_type IN ('demo', 'live')),
                balance DECIMAL(15,2) DEFAULT 10000,
                currency VARCHAR(3) DEFAULT 'USD',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Trades
        await pool.query(`
            CREATE TABLE IF NOT EXISTS trades (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                account_id INT NOT NULL,
                asset VARCHAR(50) NOT NULL,
                asset_name VARCHAR(100),
                quantity DECIMAL(15,8) NOT NULL,
                price DECIMAL(15,2) NOT NULL,
                total_amount DECIMAL(15,2) NOT NULL,
                trade_type VARCHAR(10) NOT NULL CHECK (trade_type IN ('buy','sell')),
                status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending','completed','failed')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (account_id) REFERENCES trading_accounts(id) ON DELETE CASCADE
            )
        `);

        // Deposits table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS deposits (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                account_id INT NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                currency VARCHAR(3) DEFAULT 'USD',
                payment_method VARCHAR(50),
                reference_number VARCHAR(100),
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (account_id) REFERENCES trading_accounts(id) ON DELETE CASCADE
            )
        `);

        // Withdrawals table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS withdrawals (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                account_id INT NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                currency VARCHAR(3) DEFAULT 'USD',
                payment_method VARCHAR(50),
                bank_details JSONB,
                reference_number VARCHAR(100),
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (account_id) REFERENCES trading_accounts(id) ON DELETE CASCADE
            )
        `);

        // Support tickets table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS support_tickets (
                id SERIAL PRIMARY KEY,
                user_id INT NOT NULL,
                ticket_number VARCHAR(20) UNIQUE NOT NULL,
                subject VARCHAR(200) NOT NULL,
                category VARCHAR(20) DEFAULT 'general' CHECK (category IN ('technical', 'account', 'trading', 'billing', 'general')),
                priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
                status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_response', 'resolved', 'closed')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Support messages
        await pool.query(`
            CREATE TABLE IF NOT EXISTS support_messages (
                id SERIAL PRIMARY KEY,
                ticket_id INT NOT NULL,
                sender_id INT NOT NULL,
                sender_type VARCHAR(10) NOT NULL CHECK (sender_type IN ('user', 'admin')),
                message TEXT NOT NULL,
                attachments JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
                FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Knowledge base articles
        await pool.query(`
            CREATE TABLE IF NOT EXISTS kb_articles (
                id SERIAL PRIMARY KEY,
                title VARCHAR(200) NOT NULL,
                slug VARCHAR(200) UNIQUE NOT NULL,
                content TEXT NOT NULL,
                category VARCHAR(100),
                tags JSONB,
                status VARCHAR(20) DEFAULT 'published' CHECK (status IN ('draft', 'published')),
                views INT DEFAULT 0,
                helpful_votes INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Ensure admin user exists
        const adminExists = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            ['swiftxchangepro@gmail.com']
        );

        if (adminExists.rows.length === 0) {
            console.log('🔧 Creating default admin user...');
            const defaultPassword = 'AdminPass123!';
            const hashedPassword = await bcrypt.hash(defaultPassword, 12);

            await pool.query(`
                INSERT INTO users (
                    first_name, last_name, username, email, 
                    password_hash, email_verified, status, role, failed_logins
                ) VALUES ($1, $2, $3, $4, $5, true, 'active', 'admin', 0)
            `, [
                'Super', 'Admin', 'superadmin', 'swiftxchangepro@gmail.com', 
                hashedPassword
            ]);

            console.log('✅ Default admin created:');
            console.log('📧 Email: swiftxchangepro@gmail.com');
            console.log('🔑 Password: AdminPass123!');
            console.log('⚠️  CHANGE THIS PASSWORD IMMEDIATELY!');
        } else {
            await pool.query(`
                UPDATE users 
                SET role = 'admin' 
                WHERE email = $1
            `, ['swiftxchangepro@gmail.com']);
            console.log('✅ Admin role updated for existing user');
        }

        console.log('✅ Database tables initialized successfully');
    } catch (error) {
        console.error('❌ Database initialization error:', error);
    }
}

// Call at startup
initializeDatabase();

// Session store using PostgreSQL
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session'
    }),
    secret: process.env.SESSION_SECRET || 'supersecret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        secure: true,
        sameSite: 'none',
        httpOnly: true
    }
}));

// Email transporter
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

emailTransporter.verify((error, success) => {
    if (error) {
        console.log('❌ Email configuration error:', error.message);
    } else {
        console.log('✅ Email server is ready');
    }
});

// Helper functions
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
        const existing = await pool.query(
            "SELECT id FROM users WHERE email = $1 OR username = $2", 
            [email, username]
        );
        
        if (existing.rows.length > 0) {
            return res.json({ success: false, message: "Email or username already in use" });
        }

        const hash = await bcrypt.hash(password, 12);
        const code = generateVerificationCode();

        const result = await pool.query(
            "INSERT INTO users (first_name, last_name, username, email, phone, country, password_hash, verification_code, status, failed_logins) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 0) RETURNING id",
            [firstName, lastName, username, email, phone, country, hash, code]
        );

        const userId = result.rows[0].id;
        
        await pool.query(
            "INSERT INTO user_profiles (user_id, account_type) VALUES ($1, $2)", 
            [userId, accountType || 'demo']
        );
        
        const startingBalance = accountType === 'live' ? 0 : 10000;
        await pool.query(
            "INSERT INTO trading_accounts (user_id, account_number, account_type, balance, currency) VALUES ($1, $2, $3, $4, 'USD')", 
            [userId, generateAccountNumber(), accountType || 'demo', startingBalance]
        );

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
        const result = await pool.query(
            "SELECT id, verification_code FROM users WHERE email = $1 AND status = 'pending'", 
            [email]
        );
        
        if (result.rows.length === 0) {
            return res.json({ success: false, message: "Invalid request" });
        }

        if (result.rows[0].verification_code !== code) {
            return res.json({ success: false, message: "Invalid code" });
        }

        await pool.query(
            "UPDATE users SET email_verified = true, status = 'active', verification_code = NULL WHERE id = $1", 
            [result.rows[0].id]
        );
        
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
        const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        
        if (result.rows.length === 0) {
            return res.json({ success: false, message: "Invalid email or password" });
        }
        
        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        
        if (!valid) {
            await pool.query(
                "UPDATE users SET failed_logins = failed_logins + 1 WHERE id = $1", 
                [user.id]
            );
            return res.json({ success: false, message: "Invalid email or password" });
        }
        
        let finalAccountType = accountType && ['demo', 'live'].includes(accountType) ? accountType : 'demo';
        
        try {
            const existingAccount = await pool.query(
                "SELECT id FROM trading_accounts WHERE user_id = $1", 
                [user.id]
            );
            
            if (existingAccount.rows.length > 0) {
                await pool.query(
                    "UPDATE trading_accounts SET account_type = $1, updated_at = NOW() WHERE user_id = $2", 
                    [finalAccountType, user.id]
                );
            } else {
                const accountNumber = 'SXR' + Date.now().toString() + Math.floor(Math.random() * 1000);
                const initialBalance = finalAccountType === 'demo' ? 10000 : 0;
                
                await pool.query(
                    "INSERT INTO trading_accounts (user_id, account_number, account_type, balance, currency, created_at, updated_at) VALUES ($1, $2, $3, $4, 'USD', NOW(), NOW())", 
                    [user.id, accountNumber, finalAccountType, initialBalance]
                );
            }
        } catch (accountError) {
            console.error('Trading account error:', accountError);
        }
        
        req.session.userId = user.id;
        req.session.userEmail = user.email;
        req.session.accountType = finalAccountType;
        
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.json({ success: false, message: 'Login failed - session error' });
            }
            
            pool.query(
                "UPDATE users SET failed_logins = 0, last_login_at = NOW(), last_login_ip = $1 WHERE id = $2", 
                [req.ip, user.id]
            ).catch(console.error);
            
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

// Switch account
app.post('/api/switch-account', authRequired, async (req, res) => {
    const { accountType } = req.body;
    
    try {
        req.session.accountType = accountType;
        
        const existingAccount = await pool.query(
            "SELECT id FROM trading_accounts WHERE user_id = $1 AND account_type = $2", 
            [req.session.userId, accountType]
        );
        
        if (existingAccount.rows.length === 0) {
            const accountNumber = 'SXR' + Date.now().toString() + Math.floor(Math.random() * 1000);
            const initialBalance = accountType === 'demo' ? 10000 : 0;
            
            await pool.query(
                "INSERT INTO trading_accounts (user_id, account_number, account_type, balance, currency) VALUES ($1, $2, $3, $4, 'USD')", 
                [req.session.userId, accountNumber, accountType, initialBalance]
            );
        }
        
        res.json({ success: true, message: `Switched to ${accountType} account` });
    } catch (error) {
        console.error('Account switch error:', error);
        res.json({ success: false, message: 'Account switch failed' });
    }
});

// Admin registration
app.post('/api/register-admin', async (req, res) => {
    const { firstName, lastName, username, email, password } = req.body;
    
    try {
        const existing = await pool.query(
            "SELECT id FROM users WHERE email = $1 OR role = 'admin'", 
            [email]
        );
        
        if (existing.rows.length > 0) {
            return res.json({ success: false, message: "Admin user already exists" });
        }

        const hash = await bcrypt.hash(password, 12);

        const result = await pool.query(
            "INSERT INTO users (first_name, last_name, username, email, password_hash, email_verified, status, role, failed_logins) VALUES ($1, $2, $3, $4, $5, true, 'active', 'admin', 0) RETURNING id",
            [firstName, lastName, username, email, hash]
        );

        const userId = result.rows[0].id;
        await pool.query("INSERT INTO user_profiles (user_id, account_type) VALUES ($1, 'admin')", [userId]);
        await pool.query(
            "INSERT INTO trading_accounts (user_id, account_number, account_type, balance, currency) VALUES ($1, $2, 'admin', 100000, 'USD')", 
            [userId, generateAccountNumber()]
        );

        res.json({ success: true, message: "Admin user created successfully" });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Admin registration failed" });
    }
});

// Admin login
app.post('/api/admin-login', async (req, res) => {
    const { email, password } = req.body;
    
    console.log('🔐 Admin login attempt:', email);
    
    try {
        const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        
        if (result.rows.length === 0) {
            console.log('❌ No user found with email:', email);
            return res.json({ success: false, message: "Invalid admin credentials" });
        }
        
        const user = result.rows[0];
        console.log('👤 User found:', { id: user.id, email: user.email, role: user.role });
        
        if (user.role !== 'admin') {
            console.log('❌ User is not admin, role:', user.role);
            return res.json({ success: false, message: "Admin access required" });
        }
        
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            console.log('❌ Invalid password for:', email);
            await pool.query(
                "UPDATE users SET failed_logins = failed_logins + 1 WHERE id = $1", 
                [user.id]
            );
            return res.json({ success: false, message: "Invalid admin credentials" });
        }
        
        console.log('✅ Password valid, setting session data');
        
        req.session.userId = user.id;
        req.session.userEmail = user.email;
        req.session.isAdmin = true;
        req.session.role = 'admin';
        
        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err) {
                    console.error('❌ Session save error:', err);
                    reject(err);
                } else {
                    console.log('✅ Session saved successfully');
                    resolve();
                }
            });
        });
        
        await pool.query(
            "UPDATE users SET failed_logins = 0, last_login_at = NOW(), last_login_ip = $1 WHERE id = $2", 
            [req.ip, user.id]
        );
        
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
        
        const ticketNumber = 'TK' + Date.now().toString().slice(-8);
        
        const ticketResult = await pool.query(`
            INSERT INTO support_tickets (user_id, ticket_number, subject, category, priority)
            VALUES ($1, $2, $3, $4, $5) RETURNING id
        `, [userId, ticketNumber, subject, category, priority]);
        
        const ticketId = ticketResult.rows[0].id;
        
        await pool.query(`
            INSERT INTO support_messages (ticket_id, sender_id, sender_type, message)
            VALUES ($1, $2, 'user', $3)
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
        
        const response = await fetch(url);
        const data = await response.json();
        
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
                .reverse();
            
            res.json({ success: true, data: formattedData });
        } else if (data['Error Message']) {
            res.json({ success: false, message: data['Error Message'] });
        } else if (data['Note']) {
            res.json({ success: false, message: 'Rate limit exceeded. Please try again later.' });
        } else {
            res.json({ success: false, message: 'Invalid forex data format' });
        }
    } catch (error) {
        console.error('Forex data error:', error);
        res.json({ success: false, message: 'Failed to fetch forex data' });
    }
});

// Live prices for multiple symbols
app.get('/api/live-prices', async (req, res) => {
    try {
        const { symbols, market } = req.query;
        const symbolList = symbols ? symbols.split(',') : [];
        const prices = {};
        
        if (market === 'crypto') {
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
                            change: 0,
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

// Start real-time feed
app.get('/api/start-realtime/:market', (req, res) => {
    const { market } = req.params;
    
    if (market === 'crypto') {
        res.json({ success: true, message: 'Crypto real-time feed started' });
    } else {
        res.json({ success: true, message: 'Forex real-time feed started' });
    }
});

// Get user's support tickets
app.get('/api/support/tickets', authRequired, async (req, res) => {
    try {
        const userId = req.session.userId;
        
        const result = await pool.query(`
            SELECT st.*, 
                   (SELECT COUNT(*) FROM support_messages WHERE ticket_id = st.id) as message_count,
                   (SELECT created_at FROM support_messages WHERE ticket_id = st.id ORDER BY created_at DESC LIMIT 1) as last_message_at
            FROM support_tickets st 
            WHERE st.user_id = $1
            ORDER BY st.updated_at DESC
        `, [userId]);
        
        res.json({ success: true, tickets: result.rows });
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
        
        const ticket = await pool.query(
            'SELECT user_id FROM support_tickets WHERE id = $1', 
            [ticketId]
        );
        
        if (ticket.rows.length === 0 || (ticket.rows[0].user_id !== userId && !req.session.isAdmin)) {
            return res.json({ success: false, message: 'Access denied' });
        }
        
        const messages = await pool.query(`
            SELECT sm.*, u.first_name, u.last_name, u.email
            FROM support_messages sm
            JOIN users u ON sm.sender_id = u.id
            WHERE sm.ticket_id = $1
            ORDER BY sm.created_at ASC
        `, [ticketId]);
        
        res.json({ success: true, messages: messages.rows });
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
        
        const tickets = await pool.query(`
            SELECT st.*, u.first_name, u.last_name, u.email,
                   (SELECT COUNT(*) FROM support_messages WHERE ticket_id = st.id) as message_count
            FROM support_tickets st
            JOIN users u ON st.user_id = u.id
            ORDER BY st.updated_at DESC
        `);
        
        res.json({ success: true, tickets: tickets.rows });
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
            query += ` AND (title ILIKE $1 OR content ILIKE $2)`;
            params.push(`%${q}%`, `%${q}%`);
        }
        
        query += ` ORDER BY helpful_votes DESC, views DESC LIMIT 20`;
        
        const articles = await pool.query(query, params);
        
        res.json({ success: true, articles: articles.rows });
    } catch (error) {
        console.error('Error searching knowledge base:', error);
        res.json({ success: false, message: 'Search failed' });
    }
});

// Dashboard
app.get('/api/dashboard', authRequired, async (req, res) => {
    try {
        const user = await pool.query(
            "SELECT first_name, last_name, email, status FROM users WHERE id = $1", 
            [req.session.userId]
        );
        
        const accountType = req.session.accountType || 'demo';
        
        const accounts = await pool.query(
            "SELECT account_number, account_type, balance, currency FROM trading_accounts WHERE user_id = $1 AND account_type = $2", 
            [req.session.userId, accountType]
        );
        
        if (accounts.rows.length === 0) {
            const accountNumber = 'SXR' + Date.now().toString() + Math.floor(Math.random() * 1000);
            const initialBalance = accountType === 'demo' ? 10000 : 0;
            
            await pool.query(
                "INSERT INTO trading_accounts (user_id, account_number, account_type, balance, currency) VALUES ($1, $2, $3, $4, 'USD')",
                [req.session.userId, accountNumber, accountType, initialBalance]
            );
            
            const newAccounts = await pool.query(
                "SELECT account_number, account_type, balance, currency FROM trading_accounts WHERE user_id = $1 AND account_type = $2", 
                [req.session.userId, accountType]
            );
            
            return res.json({ success: true, user: user.rows[0], accounts: newAccounts.rows });
        }
        
        res.json({ success: true, user: user.rows[0], accounts: accounts.rows });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Dashboard failed" });
    }
});

// Enhanced orders endpoint
app.get('/api/orders', authRequired, async (req, res) => {
    try {
        const userId = req.session.userId;
        const {
            page = 1,
            limit = 25,
            type = 'all',
            status = 'all',
            dateFrom,
            dateTo,
            search = '',
            sortBy = 'created_at',
            sortOrder = 'DESC'
        } = req.query;

        const offset = (page - 1) * limit;
        let baseQueries = [];
        let queryParams = [];
        let paramIndex = 1;

        // Trades query
        if (type === 'all' || type === 'trades') {
            let tradeWhere = [`user_id = ${paramIndex++}`];
            let tradeParams = [userId];

            if (status !== 'all') {
                tradeWhere.push(`status = ${paramIndex++}`);
                tradeParams.push(status);
            }

            if (search) {
                tradeWhere.push(`(asset ILIKE ${paramIndex} OR asset_name ILIKE ${paramIndex})`);
                paramIndex++;
                tradeParams.push(`%${search}%`);
            }

            if (dateFrom) {
                tradeWhere.push(`DATE(created_at) >= ${paramIndex++}`);
                tradeParams.push(dateFrom);
            }

            if (dateTo) {
                tradeWhere.push(`DATE(created_at) <= ${paramIndex++}`);
                tradeParams.push(dateTo);
            }

            const tradeQuery = `
                SELECT 
                    'trade' as order_type,
                    id,
                    asset as symbol,
                    asset_name as description,
                    quantity,
                    price,
                    total_amount as amount,
                    trade_type as action,
                    status,
                    created_at,
                    NULL as reference_number,
                    NULL as payment_method
                FROM trades 
                WHERE ${tradeWhere.join(' AND ')}
            `;
            
            baseQueries.push(tradeQuery);
            queryParams.push(...tradeParams);
        }

        // Deposits query
        if (type === 'all' || type === 'deposits') {
            let depositWhere = [`user_id = ${paramIndex++}`];
            let depositParams = [userId];

            if (status !== 'all') {
                depositWhere.push(`status = ${paramIndex++}`);
                depositParams.push(status);
            }

            if (search) {
                depositWhere.push(`(payment_method ILIKE ${paramIndex} OR reference_number ILIKE ${paramIndex})`);
                paramIndex++;
                depositParams.push(`%${search}%`);
            }

            if (dateFrom) {
                depositWhere.push(`DATE(created_at) >= ${paramIndex++}`);
                depositParams.push(dateFrom);
            }

            if (dateTo) {
                depositWhere.push(`DATE(created_at) <= ${paramIndex++}`);
                depositParams.push(dateTo);
            }

            const depositQuery = `
                SELECT 
                    'deposit' as order_type,
                    id,
                    'DEPOSIT' as symbol,
                    payment_method as description,
                    NULL as quantity,
                    NULL as price,
                    amount,
                    'deposit' as action,
                    status,
                    created_at,
                    reference_number,
                    payment_method
                FROM deposits 
                WHERE ${depositWhere.join(' AND ')}
            `;
            
            baseQueries.push(depositQuery);
            queryParams.push(...depositParams);
        }

        // Withdrawals query
        if (type === 'all' || type === 'withdrawals') {
            let withdrawalWhere = [`user_id = ${paramIndex++}`];
            let withdrawalParams = [userId];

            if (status !== 'all') {
                withdrawalWhere.push(`status = ${paramIndex++}`);
                withdrawalParams.push(status);
            }

            if (search) {
                withdrawalWhere.push(`(payment_method ILIKE ${paramIndex} OR reference_number ILIKE ${paramIndex})`);
                paramIndex++;
                withdrawalParams.push(`%${search}%`);
            }

            if (dateFrom) {
                withdrawalWhere.push(`DATE(created_at) >= ${paramIndex++}`);
                withdrawalParams.push(dateFrom);
            }

            if (dateTo) {
                withdrawalWhere.push(`DATE(created_at) <= ${paramIndex++}`);
                withdrawalParams.push(dateTo);
            }

            const withdrawalQuery = `
                SELECT 
                    'withdrawal' as order_type,
                    id,
                    'WITHDRAWAL' as symbol,
                    payment_method as description,
                    NULL as quantity,
                    NULL as price,
                    amount,
                    'withdrawal' as action,
                    status,
                    created_at,
                    reference_number,
                    payment_method
                FROM withdrawals 
                WHERE ${withdrawalWhere.join(' AND ')}
            `;
            
            baseQueries.push(withdrawalQuery);
            queryParams.push(...withdrawalParams);
        }

        // Combine queries
        const mainQuery = `
            SELECT * FROM (
                ${baseQueries.join(' UNION ALL ')}
            ) AS combined_orders
            ORDER BY ${sortBy} ${sortOrder}
            LIMIT ${paramIndex} OFFSET ${paramIndex + 1}
        `;

        queryParams.push(parseInt(limit), parseInt(offset));

        const orders = await pool.query(mainQuery, queryParams);

        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total FROM (
                ${baseQueries.join(' UNION ALL ')}
            ) AS combined_orders
        `;
        
        const countParams = queryParams.slice(0, -2);
        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].total);

        res.json({
            success: true,
            orders: orders.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit),
                hasNext: (page * limit) < total,
                hasPrev: page > 1
            }
        });

    } catch (err) {
        console.error('Orders fetch error:', err);
        res.json({ success: false, message: "Failed to fetch orders" });
    }
});

// Get individual order details
app.get('/api/orders/:id/:type', authRequired, async (req, res) => {
    try {
        const { id, type } = req.params;
        const userId = req.session.userId;
        
        let query;
        
        switch(type) {
            case 'trade':
                query = `
                    SELECT t.*, ta.account_number, ta.account_type 
                    FROM trades t 
                    JOIN trading_accounts ta ON t.account_id = ta.id 
                    WHERE t.id = $1 AND t.user_id = $2
                `;
                break;
            case 'deposit':
                query = `
                    SELECT d.*, ta.account_number, ta.account_type 
                    FROM deposits d 
                    JOIN trading_accounts ta ON d.account_id = ta.id 
                    WHERE d.id = $1 AND d.user_id = $2
                `;
                break;
            case 'withdrawal':
                query = `
                    SELECT w.*, ta.account_number, ta.account_type 
                    FROM withdrawals w 
                    JOIN trading_accounts ta ON w.account_id = ta.id 
                    WHERE w.id = $1 AND w.user_id = $2
                `;
                break;
            default:
                return res.json({ success: false, message: "Invalid order type" });
        }

        const orders = await pool.query(query, [id, userId]);
        
        if (orders.rows.length === 0) {
            return res.json({ success: false, message: "Order not found" });
        }

        res.json({ success: true, order: orders.rows[0], type });
        
    } catch (err) {
        console.error('Order details error:', err);
        res.json({ success: false, message: "Failed to fetch order details" });
    }
});

// Order statistics
app.get('/api/orders/stats', authRequired, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { period = '30' } = req.query;

        const tradesCount = await pool.query(
            'SELECT COUNT(*) as count FROM trades WHERE user_id = $1 AND created_at >= NOW() - INTERVAL \'$2 days\'',
            [userId, period]
        );

        const totalVolume = await pool.query(
            'SELECT SUM(total_amount) as total FROM trades WHERE user_id = $1 AND created_at >= NOW() - INTERVAL \'$2 days\'',
            [userId, period]
        );

        const completedTrades = await pool.query(
            'SELECT COUNT(*) as total, SUM(CASE WHEN trade_type = \'sell\' AND status = \'completed\' THEN 1 ELSE 0 END) as sells FROM trades WHERE user_id = $1 AND created_at >= NOW() - INTERVAL \'$2 days\'',
            [userId, period]
        );

        const recentActivity = await pool.query(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as trades,
                SUM(total_amount) as volume
            FROM trades 
            WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `, [userId]);

        const stats = {
            totalTrades: tradesCount.rows[0].count,
            totalVolume: totalVolume.rows[0].total || 0,
            winRate: completedTrades.rows[0].total > 0 ? ((completedTrades.rows[0].sells / completedTrades.rows[0].total) * 100).toFixed(1) : 0,
            recentActivity: recentActivity.rows
        };

        res.json({ success: true, stats });

    } catch (err) {
        console.error('Order stats error:', err);
        res.json({ success: false, message: "Failed to fetch order statistics" });
    }
});

// Export orders to CSV
app.get('/api/orders/export', authRequired, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { type = 'all', format = 'csv' } = req.query;

        let baseQueries = [];
        let queryParams = [];
        let paramIndex = 1;

        if (type === 'all' || type === 'trades') {
            baseQueries.push(`
                SELECT 
                    'Trade' as Type,
                    asset as Symbol,
                    trade_type as Action,
                    quantity as Quantity,
                    price as Price,
                    total_amount as Amount,
                    status as Status,
                    created_at as Date
                FROM trades WHERE user_id = ${paramIndex++}
            `);
            queryParams.push(userId);
        }

        if (type === 'all' || type === 'deposits') {
            baseQueries.push(`
                SELECT 
                    'Deposit' as Type,
                    payment_method as Symbol,
                    'deposit' as Action,
                    NULL as Quantity,
                    NULL as Price,
                    amount as Amount,
                    status as Status,
                    created_at as Date
                FROM deposits WHERE user_id = ${paramIndex++}
            `);
            queryParams.push(userId);
        }

        if (type === 'all' || type === 'withdrawals') {
            baseQueries.push(`
                SELECT 
                    'Withdrawal' as Type,
                    payment_method as Symbol,
                    'withdrawal' as Action,
                    NULL as Quantity,
                    NULL as Price,
                    amount as Amount,
                    status as Status,
                    created_at as Date
                FROM withdrawals WHERE user_id = ${paramIndex++}
            `);
            queryParams.push(userId);
        }

        const query = `
            SELECT * FROM (
                ${baseQueries.join(' UNION ALL ')}
            ) AS export_data
            ORDER BY Date DESC
        `;

        const orders = await pool.query(query, queryParams);

        if (format === 'csv') {
            const csvHeader = 'Type,Symbol,Action,Quantity,Price,Amount,Status,Date\n';
            const csvData = orders.rows.map(order => 
                `${order.type},${order.symbol || ''},${order.action || ''},${order.quantity || ''},${order.price || ''},${order.amount},${order.status},${order.date}`
            ).join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="swiftxchange-orders-${new Date().toISOString().split('T')[0]}.csv"`);
            res.send(csvHeader + csvData);
        } else {
            res.json({ success: true, orders: orders.rows });
        }

    } catch (err) {
        console.error('Export error:', err);
        res.json({ success: false, message: "Failed to export orders" });
    }
});

// Get account balance and info
app.get('/api/account/info', authRequired, async (req, res) => {
    try {
        const userId = req.session.userId;
        const accountType = req.session.accountType || 'demo';

        const account = await pool.query(
            'SELECT account_number, account_type, balance, currency FROM trading_accounts WHERE user_id = $1 AND account_type = $2',
            [userId, accountType]
        );

        if (account.rows.length === 0) {
            return res.json({ success: false, message: "Account not found" });
        }

        res.json({ success: true, account: account.rows[0] });

    } catch (err) {
        console.error('Account info error:', err);
        res.json({ success: false, message: "Failed to fetch account info" });
    }
});

// Trade endpoint
app.post('/api/trade', authRequired, async (req, res) => {
    const { accountId, asset, quantity, price, totalAmount, tradeType, assetName } = req.body;
    try {
        await pool.query(
            "INSERT INTO trades (user_id, account_id, asset, quantity, price, total_amount, trade_type, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed')",
            [req.session.userId, accountId, asset, quantity, price, totalAmount, tradeType]
        );
        
        const balanceChange = tradeType === 'buy' ? -totalAmount : totalAmount;
        await pool.query(
            "UPDATE trading_accounts SET balance = balance + $1 WHERE id = $2 AND user_id = $3",
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
        await pool.query(
            "INSERT INTO deposits (user_id, account_id, amount, currency, payment_method, reference_number, status) VALUES ($1, $2, $3, $4, $5, $6, 'pending')",
            [req.session.userId, accountId, amount, currency, method, 'REF' + Date.now()]
        );
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
        await pool.query(
            "INSERT INTO withdrawals (user_id, account_id, amount, currency, payment_method, bank_details, reference_number, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')",
            [req.session.userId, accountId, amount, currency, method, JSON.stringify(bankDetails), 'WD' + Date.now()]
        );
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

// Verify admin access
app.get('/api/verify-admin-access', (req, res) => {
    if (!req.session.userId || !req.session.isAdmin) {
        return res.json({ success: false, message: "Admin access required" });
    }
    
    res.json({ 
        success: true, 
        admin: {
            id: req.session.userId,
            email: req.session.userEmail,
            role: req.session.role
        }
    });
});

// Debug admin session
app.get('/api/debug-admin-session', (req, res) => {
    res.json({
        sessionExists: !!req.session,
        sessionId: req.sessionID,
        userId: req.session.userId || null,
        userEmail: req.session.userEmail || null,
        isAdmin: req.session.isAdmin || false,
        fullSession: req.session
    });
});

// Trades History
app.get('/api/trades', authRequired, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, asset, asset_name, quantity, price, total_amount, trade_type, status, created_at " +
            "FROM trades WHERE user_id = $1 ORDER BY created_at DESC",
            [req.session.userId]
        );
        res.json({ success: true, trades: result.rows });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Failed to fetch trades" });
    }
});

// Deposits History
app.get('/api/deposits', authRequired, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, amount, currency, payment_method, reference_number, status, created_at " +
            "FROM deposits WHERE user_id = $1 ORDER BY created_at DESC",
            [req.session.userId]
        );
        res.json({ success: true, deposits: result.rows });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Failed to fetch deposits" });
    }
});

// Withdrawals History
app.get('/api/withdrawals', authRequired, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, amount, currency, payment_method, bank_details, reference_number, status, created_at " +
            "FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC",
            [req.session.userId]
        );
        res.json({ success: true, withdrawals: result.rows });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Failed to fetch withdrawals" });
    }
});

// Combined Transaction History
app.get('/api/history', authRequired, async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        
        const result = await pool.query(`
            SELECT 'trade' AS type, id, asset AS description, total_amount AS amount, 'USD' AS currency, status, created_at
            FROM trades
            WHERE user_id = $1

            UNION ALL

            SELECT 'deposit' AS type, id, payment_method AS description, amount, currency, status, created_at
            FROM deposits
            WHERE user_id = $1

            UNION ALL

            SELECT 'withdrawal' AS type, id, payment_method AS description, amount, currency, status, created_at
            FROM withdrawals
            WHERE user_id = $1

            ORDER BY created_at DESC
            LIMIT $2
        `, [req.session.userId, parseInt(limit)]);

        res.json({ success: true, history: result.rows });
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: "Failed to fetch history" });
    }
});

// Get user profile
app.get('/api/profile', authRequired, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT first_name, last_name, email, phone, country FROM users WHERE id = $1",
            [req.session.userId]
        );
        res.json({ success: true, user: result.rows[0] });
    } catch (err) {
        res.json({ success: false, message: "Failed to fetch profile" });
    }
});

// Admin: Get all users
app.get('/api/admin/users', authRequired, async (req, res) => {
    try {
        if (!req.session.isAdmin) {
            return res.json({ success: false, message: "Admin access required" });
        }

        const users = await pool.query(`
            SELECT 
                u.id, u.email, u.first_name, u.last_name, u.username, 
                u.phone, u.country, u.status, u.role, u.email_verified, 
                u.created_at, u.last_login_at,
                ta.balance, ta.account_type, ta.account_number
            FROM users u
            LEFT JOIN trading_accounts ta ON u.id = ta.user_id
            ORDER BY u.created_at DESC
        `);

        res.json({ success: true, users: users.rows });
    } catch (error) {
        console.error('Database error fetching users:', error);
        res.json({ success: false, message: `Database error: ${error.message}` });
    }
});

// Admin dashboard stats
app.get('/api/admin/dashboard-stats', authRequired, async (req, res) => {
    try {
        if (!req.session.isAdmin) {
            return res.json({ success: false, message: "Admin access required" });
        }

        const userCount = await pool.query('SELECT COUNT(*) as count FROM users');
        const balanceSum = await pool.query('SELECT SUM(balance) as total FROM trading_accounts');
        const tradesCount = await pool.query('SELECT COUNT(*) as count FROM trades');
        const pendingDeposits = await pool.query("SELECT COUNT(*) as count FROM deposits WHERE status = 'pending'");
        const pendingWithdrawals = await pool.query("SELECT COUNT(*) as count FROM withdrawals WHERE status = 'pending'");
        
        res.json({ 
            success: true, 
            stats: {
                totalUsers: userCount.rows[0].count,
                totalBalance: balanceSum.rows[0].total || 0,
                totalTrades: tradesCount.rows[0].count,
                pendingActions: parseInt(pendingDeposits.rows[0].count) + parseInt(pendingWithdrawals.rows[0].count)
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.json({ success: false, message: "Failed to fetch stats" });
    }
});

// Admin: Get all trades
app.get('/api/admin/trades', authRequired, async (req, res) => {
    try {
        if (!req.session.isAdmin) {
            return res.json({ success: false, message: "Admin access required" });
        }

        const trades = await pool.query(`
            SELECT t.*, u.first_name, u.last_name, u.email 
            FROM trades t 
            JOIN users u ON t.user_id = u.id 
            ORDER BY t.created_at DESC
        `);

        res.json({ success: true, trades: trades.rows });
    } catch (error) {
        console.error('Admin trades error:', error);
        res.json({ success: false, message: 'Failed to fetch trades' });
    }
});

// Admin: Get all deposits
app.get('/api/admin/deposits', authRequired, async (req, res) => {
    try {
        if (!req.session.isAdmin) {
            return res.json({ success: false, message: "Admin access required" });
        }

        const deposits = await pool.query(`
            SELECT d.*, u.first_name, u.last_name, u.email 
            FROM deposits d 
            JOIN users u ON d.user_id = u.id 
            ORDER BY d.created_at DESC
        `);

        res.json({ success: true, deposits: deposits.rows });
    } catch (error) {
        console.error('Admin deposits error:', error);
        res.json({ success: false, message: 'Failed to fetch deposits' });
    }
});

// Admin: Get all withdrawals
app.get('/api/admin/withdrawals', authRequired, async (req, res) => {
    try {
        if (!req.session.isAdmin) {
            return res.json({ success: false, message: "Admin access required" });
        }

        const withdrawals = await pool.query(`
            SELECT w.*, u.first_name, u.last_name, u.email 
            FROM withdrawals w 
            JOIN users u ON w.user_id = u.id 
            ORDER BY w.created_at DESC
        `);

        res.json({ success: true, withdrawals: withdrawals.rows });
    } catch (error) {
        console.error('Admin withdrawals error:', error);
        res.json({ success: false, message: 'Failed to fetch withdrawals' });
    }
});

// Admin: Update user balance
app.post('/api/admin/update-balance', authRequired, async (req, res) => {
    try {
        if (!req.session.isAdmin) {
            return res.json({ success: false, message: "Admin access required" });
        }

        const { userId, amount, action } = req.body;
        
        if (action === 'credit') {
            await pool.query('UPDATE trading_accounts SET balance = balance + $1 WHERE user_id = $2', [amount, userId]);
        } else if (action === 'debit') {
            await pool.query('UPDATE trading_accounts SET balance = balance - $1 WHERE user_id = $2', [amount, userId]);
        }

        res.json({ success: true, message: `Successfully ${action}ed ${amount}` });
    } catch (error) {
        console.error('Error updating balance:', error);
        res.json({ success: false, message: "Failed to update balance" });
    }
});

// Admin: Update deposit status
app.post('/api/admin/update-deposit-status', authRequired, async (req, res) => {
    try {
        if (!req.session.isAdmin) {
            return res.json({ success: false, message: "Admin access required" });
        }

        const { depositId, status } = req.body;
        
        await pool.query(
            'UPDATE deposits SET status = $1 WHERE id = $2',
            [status, depositId]
        );

        if (status === 'completed') {
            const deposit = await pool.query('SELECT * FROM deposits WHERE id = $1', [depositId]);
            if (deposit.rows[0]) {
                await pool.query(
                    'UPDATE trading_accounts SET balance = balance + $1 WHERE user_id = $2',
                    [deposit.rows[0].amount, deposit.rows[0].user_id]
                );
            }
        }

        res.json({ success: true, message: `Deposit ${status} successfully` });
    } catch (error) {
        console.error('Update deposit status error:', error);
        res.json({ success: false, message: 'Failed to update deposit status' });
    }
});

// Admin: Update withdrawal status
app.post('/api/admin/update-withdrawal-status', authRequired, async (req, res) => {
    try {
        if (!req.session.isAdmin) {
            return res.json({ success: false, message: "Admin access required" });
        }

        const { withdrawalId, status } = req.body;
        
        await pool.query(
            'UPDATE withdrawals SET status = $1 WHERE id = $2',
            [status, withdrawalId]
        );

        if (status === 'failed') {
            const withdrawal = await pool.query('SELECT * FROM withdrawals WHERE id = $1', [withdrawalId]);
            if (withdrawal.rows[0]) {
                await pool.query(
                    'UPDATE trading_accounts SET balance = balance + $1 WHERE user_id = $2',
                    [withdrawal.rows[0].amount, withdrawal.rows[0].user_id]
                );
            }
        }

        res.json({ success: true, message: `Withdrawal ${status} successfully` });
    } catch (error) {
        console.error('Update withdrawal status error:', error);
        res.json({ success: false, message: 'Failed to update withdrawal status' });
    }
});

// Update user profile
app.put('/api/profile', authRequired, async (req, res) => {
    const { firstName, lastName, email, phone, country } = req.body;
    try {
        await pool.query(
            "UPDATE users SET first_name = $1, last_name = $2, email = $3, phone = $4, country = $5 WHERE id = $6",
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
        const user = await pool.query(
            "SELECT password_hash FROM users WHERE id = $1", 
            [req.session.userId]
        );
        
        const valid = await bcrypt.compare(currentPassword, user.rows[0].password_hash);
        
        if (!valid) {
            return res.json({ success: false, message: "Current password is incorrect" });
        }
        
        const newHash = await bcrypt.hash(newPassword, 12);
        await pool.query(
            "UPDATE users SET password_hash = $1 WHERE id = $2", 
            [newHash, req.session.userId]
        );
        
        res.json({ success: true, message: "Password updated successfully" });
    } catch (err) {
        res.json({ success: false, message: "Failed to update password" });
    }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Database: PostgreSQL`);
    console.log(`🔗 Connected to: ${process.env.DATABASE_URL ? 'Custom Database' : 'Default'}`);
});
