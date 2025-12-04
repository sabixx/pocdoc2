const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');

// Import modules
const config = require('./src/config');
const { requireAuth } = require('./src/middleware/auth');
const authRoutes = require('./src/routes/auth');
const apiRoutes = require('./src/routes/api');
const insights = require('./src/services/insights');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================================================
// Middleware
// ==========================================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || 'poc-portal-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Static files
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// Use-cases static route (set after config loads in startup)

// ==========================================================================
// Routes
// ==========================================================================

// Auth routes
app.use('/', authRoutes);

// API routes
app.use('/api', apiRoutes);

// Main app
app.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'views/index.html'));
});

// Config page (admin only)
app.get('/config', requireAuth, (req, res) => {
    if (req.session.role !== 'admin') {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'views/config.html'));
});

// ==========================================================================
// Startup
// ==========================================================================

async function startup() {
    await config.load();
    
    // Set up use-cases static route with configured path
    const useCasesPath = config.get('useCaseLocalPath') || path.join(__dirname, 'use-cases');
    app.use('/use-cases', express.static(useCasesPath));
    console.log(`Serving use-cases from: ${useCasesPath}`);
    
    insights.startHeartbeat();
    
    app.listen(PORT, () => {
        const cfg = config.get();
        console.log(`POC Portal running on http://localhost:${PORT}`);
        console.log(`Mode: ${cfg.pocOrDemo}`);
        console.log(`Prospect: ${cfg.prospect}`);
    });
}

startup().catch(console.error);