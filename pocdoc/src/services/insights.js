/**
 * POC Insights Service
 * 
 * Handles communication with the POC Portal backend API:
 * - Registration on startup
 * - Daily heartbeat with use case status AND metadata from YAML files
 * - Completion, rating, and feedback reporting
 * 
 * State is stored in /data/poc_state.json
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const config = require('../config');
const usecases = require('./usecases');

// State file location
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const STATE_FILE = path.join(DATA_DIR, 'poc_state.json');

// Use cases directory (where YAML files are stored)
const USECASES_DIR = process.env.USE_CASE_LOCAL_PATH || path.join(__dirname, '../../use-cases');

// Heartbeat interval (default: 24 hours)
const HEARTBEAT_INTERVAL_MS = (parseInt(process.env.HEARTBEAT_INTERVAL_MINUTES, 10) || 1440) * 60 * 1000;

let heartbeatTimer = null;
let pocState = null;

// =============================================================================
// State Management
// =============================================================================

async function loadState() {
    try {
        if (fsSync.existsSync(STATE_FILE)) {
            const data = await fs.readFile(STATE_FILE, 'utf8');
            pocState = JSON.parse(data);
            console.log('[Insights] Loaded state:', pocState);
            return pocState;
        }
    } catch (error) {
        console.error('[Insights] Error loading state:', error.message);
    }
    pocState = {};
    return pocState;
}

async function saveState() {
    try {
        await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
        await fs.writeFile(STATE_FILE, JSON.stringify(pocState, null, 2));
        console.log('[Insights] State saved:', pocState);
    } catch (error) {
        console.error('[Insights] Error saving state:', error.message);
    }
}

function getApiHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const apiKey = process.env.API_SHARED_SECRET || process.env.X_API_KEY;
    if (apiKey) {
        headers['X-Api-Key'] = apiKey;
    }
    return headers;
}

// =============================================================================
// YAML Metadata Loading
// =============================================================================

/**
 * Load use case metadata from YAML file
 * @param {string} useCaseCode - e.g., "machine-identity/dashboard"
 * @returns {Object|null} - Parsed YAML data or null if not found
 */
async function loadUseCaseYaml(useCaseCode) {
    try {
        // useCaseCode is like "machine-identity/dashboard"
        // YAML file is at usecases/machine-identity/dashboard.yaml
        const yamlPath = path.join(USECASES_DIR, `${useCaseCode}.yaml`);
        
        if (!fsSync.existsSync(yamlPath)) {
            console.log(`[Insights] YAML not found: ${yamlPath}`);
            return null;
        }
        
        const yamlContent = await fs.readFile(yamlPath, 'utf8');
        const data = yaml.load(yamlContent);
        
        return data;
    } catch (error) {
        console.error(`[Insights] Error loading YAML for ${useCaseCode}:`, error.message);
        return null;
    }
}

/**
 * Transform YAML metadata to API format
 * 
 * YAML fields → API fields mapping:
 *   name             → title
 *   version          → version
 *   author           → author
 *   description      → description
 *   product          → product
 *   productCategory  → product_family
 *   category         → category
 *   estimatedHours   → estimate_hours
 *   customerPreparation → is_customer_prep
 * 
 * @param {string} useCaseCode - e.g., "machine-identity/dashboard"
 * @param {Object} yamlData - Parsed YAML data
 * @param {Object} options - Additional options (order, isActive, isCompleted)
 * @returns {Object} - Formatted use case object for API
 */
function transformYamlToApiFormat(useCaseCode, yamlData, options = {}) {
    const result = {
        code: useCaseCode,
        is_active: options.isActive !== undefined ? options.isActive : true,
        is_completed: options.isCompleted || false,
    };
    
    // Add order if provided (from config.json useCaseOrder)
    if (options.order !== undefined && options.order !== null) {
        result.order = options.order;
    }
    
    if (!yamlData) {
        // Generate title from code if no YAML
        result.title = useCaseCode.split('/').pop().replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        result.version = 1;
        return result;
    }
    
    // Map YAML fields to API fields
    
    // name → title
    if (yamlData.name) {
        result.title = yamlData.name;
    }
    
    // version → version
    if (yamlData.version !== undefined) {
        result.version = parseInt(yamlData.version, 10) || 1;
    } else {
        result.version = 1;
    }
    
    // author → author
    if (yamlData.author !== undefined) {
        result.author = yamlData.author || '';
    }
    
    // description → description
    if (yamlData.description !== undefined) {
        result.description = yamlData.description || '';
    }
    
    // product → product
    if (yamlData.product !== undefined) {
        result.product = yamlData.product || '';
    }
    
    // productCategory → product_family
    if (yamlData.productCategory !== undefined) {
        result.product_family = yamlData.productCategory || '';
    }
    
    // category → category
    if (yamlData.category !== undefined) {
        result.category = yamlData.category || '';
    }
    
    // estimatedHours → estimate_hours
    if (yamlData.estimatedHours !== undefined && yamlData.estimatedHours !== null) {
        result.estimate_hours = parseInt(yamlData.estimatedHours, 10);
    }
    
    // customerPreparation → is_customer_prep
    if (yamlData.customerPreparation !== undefined) {
        result.is_customer_prep = !!yamlData.customerPreparation;
    }
    
    return result;
}

/**
 * Load all use case metadata for active use cases
 * 
 * @param {string[]} activeUseCases - Array of use case codes
 * @param {string[]} completedUseCases - Array of completed use case codes
 * @returns {Object[]} - Array of use case objects with metadata
 */
async function loadUseCasesWithMetadata(activeUseCases, completedUseCases) {
    const cfg = config.get();
    const useCaseOrder = cfg.useCaseOrder || {};
    const completedSet = new Set(completedUseCases);
    
    const result = [];
    
    for (const code of activeUseCases) {
        // Load YAML metadata
        const yamlData = await loadUseCaseYaml(code);
        
        // Get order from config.json useCaseOrder (may be undefined)
        const order = useCaseOrder[code];
        
        // Check if completed
        const isCompleted = completedSet.has(code);
        
        // Transform to API format
        const useCaseObj = transformYamlToApiFormat(code, yamlData, {
            order: order,
            isActive: true,
            isCompleted: isCompleted,
        });
        
        result.push(useCaseObj);
    }
    
    return result;
}

// =============================================================================
// API Calls
// =============================================================================

/**
 * Register POC with backend
 * Called once on startup if not already registered
 */
async function register() {
    const cfg = config.get();
    
    if (cfg.pocOrDemo !== 'poc') {
        console.log('[Insights] Demo mode - skipping registration');
        return null;
    }
    
    if (!cfg.pocInsightsUrl) {
        console.warn('[Insights] POC_INSIGHTS_URL not configured - skipping registration');
        return null;
    }
    
    // Check required fields
    const saEmail = process.env.SA_EMAIL;
    const saName = process.env.SA_NAME;
    const prospect = cfg.prospect;
    const product = cfg.saasName;
    
    if (!saEmail || !prospect || !product) {
        console.error('[Insights] Missing required fields for registration:');
        console.error(`  SA_EMAIL: ${saEmail ? '✓' : '✗ MISSING'}`);
        console.error(`  PROSPECT: ${prospect ? '✓' : '✗ MISSING'}`);
        console.error(`  SAAS_NAME: ${product ? '✓' : '✗ MISSING'}`);
        return null;
    }
    
    // Load existing state
    await loadState();
    
    // Check if already registered with same parameters
    if (pocState.poc_uid && 
        pocState.sa_email === saEmail && 
        pocState.prospect === prospect && 
        pocState.product === product) {
        console.log(`[Insights] Already registered as ${pocState.poc_uid}`);
        return pocState.poc_uid;
    }
    
    // Build registration payload
    const payload = {
        sa_email: saEmail,
        sa_name: saName || saEmail.split('@')[0],
        prospect: prospect,
        product: product
    };
    
    if (cfg.partner) {
        payload.partner = cfg.partner;
    }
    if (cfg.pocStartDate) {
        payload.poc_start_date = cfg.pocStartDate;
    }
    if (cfg.pocEndDate) {
        payload.poc_end_date = cfg.pocEndDate;
    }
    
    console.log('[Insights] Registering POC...');
    console.log('[Insights] Payload:', JSON.stringify(payload, null, 2));
    
    try {
        const url = `${cfg.pocInsightsUrl}/api/register`;
        console.log(`[Insights] POST ${url}`);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            console.error('[Insights] Registration failed:', result);
            return null;
        }
        
        console.log('[Insights] Registration response:', result);
        
        // Save state
        pocState = {
            poc_uid: result.poc_uid,
            sa_email: saEmail,
            prospect: prospect,
            product: product,
            registered_at: new Date().toISOString(),
            is_new: result.is_new
        };
        
        if (result.user_created) {
            pocState.user_created = true;
            console.log(`[Insights] New user account created for ${saEmail}`);
            if (result.message) {
                console.log(`[Insights] ${result.message}`);
            }
        }
        
        await saveState();
        
        console.log(`[Insights] ✓ Registered as ${pocState.poc_uid} (is_new: ${result.is_new})`);
        return pocState.poc_uid;
        
    } catch (error) {
        console.error('[Insights] Registration error:', error.message);
        console.error('[Insights] Error cause:', error.cause || 'none');
        console.error('[Insights] Target URL was:', `${cfg.pocInsightsUrl}/api/register`);
        return null;
    }
}

/**
 * Deregister POC (mark as inactive)
 * Called when switching from POC to demo mode
 */
async function deregister() {
    const cfg = config.get();
    
    if (!cfg.pocInsightsUrl) {
        console.warn('[Insights] POC_INSIGHTS_URL not configured');
        return false;
    }
    
    await loadState();
    
    if (!pocState.poc_uid) {
        console.log('[Insights] No POC registered - nothing to deregister');
        return false;
    }
    
    try {
        const url = `${cfg.pocInsightsUrl}/api/deregister`;
        console.log(`[Insights] POST ${url}`);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({ poc_uid: pocState.poc_uid })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            console.error('[Insights] Deregistration failed:', result);
            return false;
        }
        
        console.log('[Insights] ✓ Deregistered:', result);
        
        // Clear state
        pocState = {};
        await saveState();
        
        return true;
        
    } catch (error) {
        console.error('[Insights] Deregistration error:', error.message);
        return false;
    }
}

/**
 * Send heartbeat with current use case status AND metadata
 * 
 * Reads YAML files to include full use case metadata.
 * Reads config.json to include useCaseOrder → poc_use_cases.order
 */
async function sendHeartbeat() {
    const cfg = config.get();
    
    if (cfg.pocOrDemo !== 'poc') {
        return;
    }
    
    if (!cfg.pocInsightsUrl) {
        return;
    }
    
    await loadState();
    
    if (!pocState.poc_uid) {
        console.warn('[Insights] No POC registered - attempting registration first');
        const registered = await register();
        if (!registered) {
            console.error('[Insights] Cannot send heartbeat without registration');
            return;
        }
    }
    
    try {
        // Get active use cases from config
        const activeUseCases = cfg.activeUseCases || [];
        
        // Get completed use cases
        const completed = await usecases.loadCompleted();
        const completedUseCases = Object.entries(completed)
            .filter(([_, v]) => v.completed)
            .map(([id, _]) => id);
        
        // Load full metadata for all use cases (YAML + order from config)
        console.log('[Insights] Loading use case metadata from YAML files...');
        const useCasesWithMetadata = await loadUseCasesWithMetadata(activeUseCases, completedUseCases);
        
        // Build payload
        const payload = {
            poc_uid: pocState.poc_uid,
            use_cases: useCasesWithMetadata
        };
        
        console.log('[Insights] Sending heartbeat...');
        console.log(`[Insights] Total use cases: ${useCasesWithMetadata.length}`);
        console.log(`[Insights] Completed: ${completedUseCases.length}`);
        
        // Log a sample of the metadata being sent
        if (useCasesWithMetadata.length > 0) {
            console.log('[Insights] Sample use case:', JSON.stringify(useCasesWithMetadata[0], null, 2));
        }
        
        const url = `${cfg.pocInsightsUrl}/api/heartbeat`;
        const response = await fetch(url, {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            console.error('[Insights] Heartbeat failed:', result);
            return;
        }
        
        console.log(`[Insights] ✓ Heartbeat sent successfully (${result.use_cases_processed} use cases processed)`);
        
        // Update last heartbeat time
        pocState.last_heartbeat = new Date().toISOString();
        await saveState();
        
    } catch (error) {
        console.error('[Insights] Heartbeat error:', error.message);
    }
}

/**
 * Report use case completion
 */
async function sendCompletion(useCaseId, completed) {
    const cfg = config.get();
    
    if (cfg.pocOrDemo !== 'poc' || !cfg.pocInsightsUrl) {
        return;
    }
    
    await loadState();
    
    if (!pocState.poc_uid) {
        console.warn('[Insights] No POC registered - cannot send completion');
        return;
    }
    
    try {
        const url = `${cfg.pocInsightsUrl}/api/complete_use_case`;
        const response = await fetch(url, {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({
                poc_uid: pocState.poc_uid,
                use_case_code: useCaseId,
                completed: completed
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            console.error('[Insights] Completion update failed:', result);
            return;
        }
        
        console.log(`[Insights] ✓ Use case ${useCaseId} marked ${completed ? 'complete' : 'incomplete'}`);
        
    } catch (error) {
        console.error('[Insights] Completion error:', error.message);
    }
}

/**
 * Report use case rating
 */
async function sendRating(useCaseId, rating) {
    const cfg = config.get();
    
    if (cfg.pocOrDemo !== 'poc' || !cfg.pocInsightsUrl) {
        return;
    }
    
    await loadState();
    
    if (!pocState.poc_uid) {
        console.warn('[Insights] No POC registered - cannot send rating');
        return;
    }
    
    try {
        const url = `${cfg.pocInsightsUrl}/api/rating`;
        const response = await fetch(url, {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({
                poc_uid: pocState.poc_uid,
                use_case_code: useCaseId,
                rating: rating
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            console.error('[Insights] Rating update failed:', result);
            return;
        }
        
        console.log(`[Insights] ✓ Rating ${rating} set for ${useCaseId}`);
        
    } catch (error) {
        console.error('[Insights] Rating error:', error.message);
    }
}

/**
 * Report use case feedback
 */
async function sendFeedback(useCaseId, text) {
    const cfg = config.get();
    
    if (cfg.pocOrDemo !== 'poc' || !cfg.pocInsightsUrl) {
        return;
    }
    
    await loadState();
    
    if (!pocState.poc_uid) {
        console.warn('[Insights] No POC registered - cannot send feedback');
        return;
    }
    
    try {
        const url = `${cfg.pocInsightsUrl}/api/feedback`;
        const response = await fetch(url, {
            method: 'POST',
            headers: getApiHeaders(),
            body: JSON.stringify({
                poc_uid: pocState.poc_uid,
                use_case_code: useCaseId,
                text: text
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            console.error('[Insights] Feedback submission failed:', result);
            return;
        }
        
        console.log(`[Insights] ✓ Feedback submitted for ${useCaseId}`);
        
    } catch (error) {
        console.error('[Insights] Feedback error:', error.message);
    }
}

// =============================================================================
// Heartbeat Scheduler
// =============================================================================

function startHeartbeat() {
    const cfg = config.get();
    
    if (cfg.pocOrDemo !== 'poc') {
        console.log('[Insights] Demo mode - heartbeat disabled');
        return;
    }
    
    if (!cfg.pocInsightsUrl) {
        console.log('[Insights] No POC_INSIGHTS_URL - heartbeat disabled');
        return;
    }
    
    // Stop existing timer if any
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
    }
    
    const intervalMinutes = HEARTBEAT_INTERVAL_MS / 60000;
    console.log(`[Insights] Starting heartbeat scheduler (every ${intervalMinutes} minutes)`);
    
    // Send initial heartbeat after a short delay (allow startup to complete)
    setTimeout(() => {
        sendHeartbeat();
    }, 5000);
    
    // Schedule periodic heartbeats
    heartbeatTimer = setInterval(() => {
        sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
        console.log('[Insights] Heartbeat scheduler stopped');
    }
}

// =============================================================================
// Legacy compatibility (for existing code that calls send())
// =============================================================================

async function send(eventType, data) {
    // Map old event types to new API calls
    if (eventType === 'usecase_completion') {
        await sendCompletion(data.useCaseId, data.completed);
    } else if (eventType === 'usecase_feedback') {
        if (data.rating) {
            await sendRating(data.useCaseId, data.rating);
        }
        if (data.message) {
            await sendFeedback(data.useCaseId, data.message);
        }
    } else if (eventType === 'heartbeat') {
        await sendHeartbeat();
    }
}

// =============================================================================
// Exports
// =============================================================================

module.exports = {
    // State
    loadState,
    saveState,
    getState: () => pocState,
    
    // Registration
    register,
    deregister,
    
    // Heartbeat
    sendHeartbeat,
    startHeartbeat,
    stopHeartbeat,
    
    // Use case events
    sendCompletion,
    sendRating,
    sendFeedback,
    
    // YAML loading (exported for testing)
    loadUseCaseYaml,
    loadUseCasesWithMetadata,
    
    // Legacy
    send
};