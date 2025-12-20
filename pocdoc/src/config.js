const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// Calculate default dates
function addWorkdays(date, workdays) {
    // Add workdays, skipping weekends (Saturday=6, Sunday=0)
    const result = new Date(date);
    let added = 0;
    while (added < workdays) {
        result.setDate(result.getDate() + 1);
        const dayOfWeek = result.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            added++;
        }
    }
    return result;
}

function getDefaultStartDate() {
    // 4 workdays from today
    const date = addWorkdays(new Date(), 4);
    return date.toISOString().split('T')[0];
}

function getDefaultEndDate(startDateStr) {
    // 3 weeks after start date
    const startDate = startDateStr ? new Date(startDateStr) : new Date();
    if (isNaN(startDate.getTime())) {
        // Invalid date, use 4 workdays + 3 weeks from now
        const date = addWorkdays(new Date(), 4);
        date.setDate(date.getDate() + 21);
        return date.toISOString().split('T')[0];
    }
    startDate.setDate(startDate.getDate() + 21);
    return startDate.toISOString().split('T')[0];
}

// Get start date from env or default
const defaultStartDate = process.env.POC_START_DATE || getDefaultStartDate();
const defaultEndDate = process.env.POC_END_DATE || getDefaultEndDate(defaultStartDate);

// Default configuration from environment variables
const defaultConfig = {
    // Customer info
    prospect: process.env.PROSPECT || 'demo',
    partner: process.env.PARTNER || '',
    saasName: process.env.SAAS_NAME || 'Certificate Manager SaaS',
    
    // POC dates
    pocStartDate: defaultStartDate,
    pocEndDate: defaultEndDate,
    
    // Mode
    pocOrDemo: process.env.POC_OR_DEMO || 'demo',
    
    // SA info (for POC registration)
    saName: process.env.SA_NAME || '',
    saEmail: process.env.SA_EMAIL || '',
    
    // Backend API
    pocInsightsUrl: process.env.POC_INSIGHTS_URL || '',
    
    // Use cases
    useCaseRepoUrl: process.env.USE_CASE_REPO_URL || '',
    useCaseLocalPath: process.env.USE_CASE_LOCAL_PATH || path.join(__dirname, '../use-cases'),
    activeUseCases: process.env.ACTIVE_USE_CASES ? process.env.ACTIVE_USE_CASES.split(',').filter(Boolean) : [],
    useCaseOrder: {},
    
    // Auth (not persisted to disk for security)
    authAdminUsername: process.env.AUTH_ADMIN_USERNAME || 'admin',
    authAdminPassword: process.env.AUTH_ADMIN_PASSWORD || 'admin',
    authProspectPassword: process.env.AUTH_PROSPECT_PASSWORD || 'password',
    
    // TLSPC config - set via TLSPC_URL environment variable
    tlspcUrl: process.env.TLSPC_URL || 'https://ui.venafi.cloud',
    password: process.env.DEFAULT_PASSWORD || 'ChangeMe123!'
};

let currentConfig = { ...defaultConfig };

async function load() {
    try {
        if (fsSync.existsSync(CONFIG_FILE)) {
            const data = await fs.readFile(CONFIG_FILE, 'utf8');
            const diskConfig = JSON.parse(data);
            
            // Merge: env vars override disk config for certain fields
            currentConfig = { ...defaultConfig };
            
            // Fields that should come from disk (user-editable)
            const diskOverrideFields = [
                'activeUseCases', 
                'useCaseOrder'
            ];
            
            // Fields that env vars should always override
            const envOverrideFields = [
                'prospect', 'partner', 'saasName',
                'pocStartDate', 'pocEndDate', 'pocOrDemo',
                'saName', 'saEmail', 'pocInsightsUrl',
                'useCaseRepoUrl', 'useCaseLocalPath'
            ];
            
            // Apply disk config first
            for (const key of Object.keys(diskConfig)) {
                if (diskConfig[key] !== undefined && diskConfig[key] !== null && diskConfig[key] !== '') {
                    currentConfig[key] = diskConfig[key];
                }
            }
            
            // Then override with env vars if set
            for (const key of envOverrideFields) {
                const envValue = defaultConfig[key];
                // Only override if env var was actually set (not default)
                if (process.env[toEnvVar(key)]) {
                    currentConfig[key] = envValue;
                }
            }
            
            console.log('[Config] Loaded configuration from disk, merged with env vars');
        } else {
            currentConfig = { ...defaultConfig };
            await save();
            console.log('[Config] Created default configuration');
        }
    } catch (error) {
        console.error('[Config] Error loading config:', error);
        currentConfig = { ...defaultConfig };
    }
    
    return currentConfig;
}

// Helper to convert camelCase to UPPER_SNAKE_CASE
function toEnvVar(camelCase) {
    return camelCase.replace(/([A-Z])/g, '_$1').toUpperCase();
}

async function save() {
    try {
        await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
        
        // Don't persist sensitive auth fields
        const configToSave = { ...currentConfig };
        delete configToSave.authAdminUsername;
        delete configToSave.authAdminPassword;
        delete configToSave.authProspectPassword;
        
        await fs.writeFile(CONFIG_FILE, JSON.stringify(configToSave, null, 2));
        console.log('[Config] Configuration saved to disk');
    } catch (error) {
        console.error('[Config] Error saving config:', error);
        throw error;
    }
}

function get(key) {
    return key ? currentConfig[key] : currentConfig;
}

function set(key, value) {
    currentConfig[key] = value;
}

function update(updates) {
    const allowedFields = [
        'prospect', 'partner', 'saasName',
        'pocStartDate', 'pocEndDate', 'pocOrDemo',
        'useCaseRepoUrl', 'useCaseLocalPath', 
        'activeUseCases', 'useCaseOrder'
    ];
    
    for (const field of allowedFields) {
        if (updates[field] !== undefined) {
            currentConfig[field] = updates[field];
        }
    }
}

function getUseCasePath() {
    return currentConfig.useCaseLocalPath || defaultConfig.useCaseLocalPath;
}

function getDataPath() {
    return DATA_DIR;
}

function escapeForJson(str) {
    if (!str) return '';
    // Escape characters that would break JSON syntax
    return str
        .replace(/\\/g, '\\\\')     // backslashes first
        .replace(/"/g, '\\"')       // double quotes
        .replace(/\n/g, '\\n')      // newlines
        .replace(/\r/g, '\\r')      // carriage returns
        .replace(/\t/g, '\\t');     // tabs
}

function replaceVariables(text, isJson = false) {
    if (!text) return text;

    // Auto-detect if text looks like JSON
    const shouldEscapeJson = isJson || (text.startsWith('{') && text.endsWith('}'));

    const replacements = {
        '@@PROSPECT@@': currentConfig.prospect,
        '@@PARTNER@@': currentConfig.partner,
        '@@SAAS_NAME@@': currentConfig.saasName,
        '@@TLSPCURL@@': currentConfig.tlspcUrl,
        '@@PASSWORD@@': currentConfig.password,
        '@@POC_START_DATE@@': currentConfig.pocStartDate,
        '@@POC_END_DATE@@': currentConfig.pocEndDate,
        '@@SA_NAME@@': currentConfig.saName,
        '@@SA_EMAIL@@': currentConfig.saEmail
    };

    let result = text;
    for (const [key, value] of Object.entries(replacements)) {
        const safeValue = shouldEscapeJson ? escapeForJson(value) : (value || '');
        result = result.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), safeValue);
    }

    return result;
}

module.exports = {
    load,
    save,
    get,
    set,
    update,
    replaceVariables,
    getUseCasePath,
    getDataPath,
    CONFIG_FILE
};