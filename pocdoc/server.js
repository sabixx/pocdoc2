// Initialize logger FIRST - before any other imports
const logger = require('./src/services/logger');

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
const remote = require('./src/services/remote');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================================================
// Middleware
// ==========================================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.set('trust proxy', 1);
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
// Startup Functions
// ==========================================================================

/**
 * Print all environment variables and warn about missing required ones
 */
function printStartupBanner() {
    const divider = '='.repeat(70);
    
    console.log('');
    console.log(divider);
    console.log('  POC Portal - Starting Up');
    console.log(divider);
    console.log('');
    
    // Determine mode
    const pocOrDemo = process.env.POC_OR_DEMO || 'demo';
    const isPocMode = pocOrDemo === 'poc';
    
    console.log('MODE CONFIGURATION:');
    console.log(`  POC_OR_DEMO:          ${pocOrDemo} ${isPocMode ? '(POC mode - will register)' : '(Demo mode - no backend calls)'}`);
    console.log('');
    
    console.log('CUSTOMER CONFIGURATION:');
    console.log(`  PROSPECT:             ${process.env.PROSPECT || 'demo'}`);
    console.log(`  PARTNER:              ${process.env.PARTNER || '(not set)'}`);
    console.log(`  SAAS_NAME:            ${process.env.SAAS_NAME || 'Certificate Manager SaaS'}`);
    console.log(`  POC_START_DATE:       ${process.env.POC_START_DATE || '(auto: +2 days)'}`);
    console.log(`  POC_END_DATE:         ${process.env.POC_END_DATE || '(auto: start +2 weeks)'}`);
    console.log('');
    
    console.log('SA CONFIGURATION:');
    console.log(`  SA_NAME:              ${process.env.SA_NAME || '(not set)'}`);
    console.log(`  SA_EMAIL:             ${process.env.SA_EMAIL || '(not set)'}`);
    console.log('');
    
    console.log('BACKEND CONFIGURATION:');
    console.log(`  POC_INSIGHTS_URL:     ${process.env.POC_INSIGHTS_URL || '(not set)'}`);
    console.log(`  API_SHARED_SECRET:    ${process.env.API_SHARED_SECRET ? '(set)' : process.env.X_API_KEY ? '(set via X_API_KEY)' : '(not set)'}`);
    console.log(`  HEARTBEAT_INTERVAL:   ${process.env.HEARTBEAT_INTERVAL_MINUTES || '1440'} minutes`);
    console.log('');
    
    console.log('USE CASE CONFIGURATION:');
    console.log(`  USE_CASE_REPO_URL:    ${process.env.USE_CASE_REPO_URL || '(not set)'}`);
    console.log(`  USE_CASE_LOCAL_PATH:  ${process.env.USE_CASE_LOCAL_PATH || './use-cases'}`);
    console.log(`  ACTIVE_USE_CASES:     ${process.env.ACTIVE_USE_CASES || '(from config.json)'}`);
    console.log('');
    
    console.log('AUTH CONFIGURATION:');
    console.log(`  AUTH_ADMIN_USERNAME:  ${process.env.AUTH_ADMIN_USERNAME || 'admin'}`);
    console.log(`  AUTH_ADMIN_PASSWORD:  ${process.env.AUTH_ADMIN_PASSWORD ? '(set)' : '(using default)'}`);
    console.log(`  AUTH_PROSPECT_PASSWORD: ${process.env.AUTH_PROSPECT_PASSWORD ? '(set)' : '(using default)'}`);
    console.log('');
    
    console.log('OTHER:');
    console.log(`  NODE_ENV:             ${process.env.NODE_ENV || 'development'}`);
    console.log(`  PORT:                 ${PORT}`);
    console.log(`  TLSPC_URL:            ${process.env.TLSPC_URL || 'https://ui.venafi.cloud'}`);
    console.log('');
    
    // Warnings for missing required configuration
    const warnings = [];
    
    // USE_CASE_REPO_URL is always required (need to download use cases)
    if (!process.env.USE_CASE_REPO_URL) {
        warnings.push('USE_CASE_REPO_URL is required to download use cases');
    }
    
    // POC mode specific requirements
    if (isPocMode) {
        if (!process.env.SA_EMAIL) {
            warnings.push('SA_EMAIL is required for POC mode registration');
        }
        if (!process.env.PROSPECT || process.env.PROSPECT === 'demo') {
            warnings.push('PROSPECT should be set to the customer name');
        }
        if (!process.env.POC_INSIGHTS_URL) {
            warnings.push('POC_INSIGHTS_URL is required to report to backend');
        }
        if (!process.env.API_SHARED_SECRET && !process.env.X_API_KEY) {
            warnings.push('API_SHARED_SECRET should be set for API authentication');
        }
    }
    
    if (warnings.length > 0) {
        console.log('⚠️  WARNINGS:');
        warnings.forEach(w => console.log(`    - ${w}`));
        console.log('');
    }
    
    console.log(divider);
    console.log('');
}

/**
 * Download use cases from remote repository
 */
async function downloadUseCases() {
    const repoUrl = process.env.USE_CASE_REPO_URL;
    
    if (!repoUrl) {
        console.warn('[Startup] ⚠ USE_CASE_REPO_URL not set - cannot download use cases!');
        console.warn('[Startup] ⚠ Use cases must be manually placed in /app/use-cases');
        return;
    }
    
    console.log('[Startup] Checking for use case updates...');
    
    try {
        const updates = await remote.checkForUpdates(repoUrl);
        
        if (updates.error) {
            console.error('[Startup] Error checking updates:', updates.error);
            return;
        }
        
        const totalNew = updates.newUseCases?.length || 0;
        const totalUpdated = updates.updated?.length || 0;
        
        console.log(`[Startup] Remote manifest: ${updates.totalInManifest} use cases, ${updates.imageCount || 0} images`);
        console.log(`[Startup] New: ${totalNew}, Updated: ${totalUpdated}`);
        
        if (totalNew > 0 || totalUpdated > 0) {
            console.log('[Startup] Downloading use cases...');
            
            const result = await remote.downloadAll(repoUrl, (progress) => {
                if (progress.current % 5 === 0 || progress.current === progress.total) {
                    console.log(`[Startup] Download progress: ${progress.current}/${progress.total} - ${progress.name}`);
                }
            });
            
            console.log(`[Startup] ✓ Downloaded ${result.downloaded} items (${result.failed} failed)`);
        } else {
            console.log('[Startup] ✓ Use cases are up to date');
        }
        
    } catch (error) {
        console.error('[Startup] Use case download error:', error.message);
    }
}

/**
 * Register POC with backend
 */
async function registerPoc() {
    const cfg = config.get();
    
    if (cfg.pocOrDemo !== 'poc') {
        console.log('[Startup] Demo mode - skipping POC registration');
        return;
    }
    
    console.log('[Startup] Registering POC with backend...');
    
    const pocUid = await insights.register();
    
    if (pocUid) {
        console.log(`[Startup] ✓ POC registered: ${pocUid}`);
    } else {
        console.warn('[Startup] ⚠ POC registration failed or skipped');
    }
}

// ==========================================================================
// Main Startup
// ==========================================================================

async function startup() {
    // 1. Print startup banner with all variables
    printStartupBanner();
    
    // 2. Load/create configuration
    console.log('[Startup] Loading configuration...');
    await config.load();
    const cfg = config.get();
    console.log(`[Startup] ✓ Configuration loaded (mode: ${cfg.pocOrDemo})`);
    
    // 3. Set up use-cases static route
    const useCasesPath = cfg.useCaseLocalPath || path.join(__dirname, 'use-cases');
    app.use('/use-cases', express.static(useCasesPath));
    console.log(`[Startup] ✓ Serving use-cases from: ${useCasesPath}`);
    
    // 4. Download use cases (if repo URL configured)
    await downloadUseCases();
    
    // 5. Register POC (if in POC mode)
    await registerPoc();
    
    // 6. Start heartbeat scheduler
    insights.startHeartbeat();
    
    // 7. Start HTTP server
    app.listen(PORT, () => {
        console.log('');
        console.log('='.repeat(70));
        console.log(`  ✓ POC Portal running on http://localhost:${PORT}`);
        console.log(`  ✓ Mode: ${cfg.pocOrDemo}`);
        console.log(`  ✓ Prospect: ${cfg.prospect}`);
        console.log('='.repeat(70));
        console.log('');
    });
}

// Handle startup errors
startup().catch(error => {
    console.error('');
    console.error('='.repeat(70));
    console.error('  ✗ STARTUP FAILED');
    console.error('='.repeat(70));
    console.error(error);
    process.exit(1);
});