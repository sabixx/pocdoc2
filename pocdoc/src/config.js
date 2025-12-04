const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// Default configuration from environment variables
const defaultConfig = {
    prospect: process.env.PROSPECT || 'demo',
    partner: process.env.PARTNER || '',
    saasName: process.env.SAAS_NAME || 'Certificate Manager SaaS',
    pocStartDate: process.env.POC_START_DATE || new Date().toISOString().split('T')[0],
    pocEndDate: process.env.POC_END_DATE || new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
    pocOrDemo: process.env.POC_OR_DEMO || 'demo',
    pocInsightsUrl: process.env.POC_INSIGHTS_URL || '',
    useCaseRepoUrl: process.env.USE_CASE_REPO_URL || '',
    useCaseLocalPath: process.env.USE_CASE_LOCAL_PATH || path.join(__dirname, '../use-cases'),
    authAdminUsername: process.env.AUTH_ADMIN_USERNAME || 'admin',
    authAdminPassword: process.env.AUTH_ADMIN_PASSWORD || 'admin',
    authProspectPassword: process.env.AUTH_PROSPECT_PASSWORD || 'password',
    tlspcUrl: process.env.TLSPC_URL || 'https://ui.venafi.cloud',
    password: process.env.DEFAULT_PASSWORD || 'ChangeMe123!',
    activeUseCases: process.env.ACTIVE_USE_CASES ? process.env.ACTIVE_USE_CASES.split(',').filter(Boolean) : [],
    useCaseOrder: {}
};

let currentConfig = { ...defaultConfig };

async function load() {
    try {
        if (fsSync.existsSync(CONFIG_FILE)) {
            const data = await fs.readFile(CONFIG_FILE, 'utf8');
            const diskConfig = JSON.parse(data);
            currentConfig = { ...defaultConfig, ...diskConfig };
            console.log('Loaded configuration from disk');
        } else {
            currentConfig = { ...defaultConfig };
            await save();
            console.log('Created default configuration');
        }
    } catch (error) {
        console.error('Error loading config:', error);
        currentConfig = { ...defaultConfig };
    }
    return currentConfig;
}

async function save() {
    try {
        await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
        await fs.writeFile(CONFIG_FILE, JSON.stringify(currentConfig, null, 2));
        console.log('Configuration saved to disk');
    } catch (error) {
        console.error('Error saving config:', error);
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
        'useCaseRepoUrl', 'useCaseLocalPath', 'activeUseCases', 'useCaseOrder'
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

function replaceVariables(text) {
    if (!text) return text;
    
    const replacements = {
        '@@PROSPECT@@': currentConfig.prospect,
        '@@PARTNER@@': currentConfig.partner,
        '@@SAAS_NAME@@': currentConfig.saasName,
        '@@TLSPCURL@@': currentConfig.tlspcUrl,
        '@@PASSWORD@@': currentConfig.password,
        '@@POC_START_DATE@@': currentConfig.pocStartDate,
        '@@POC_END_DATE@@': currentConfig.pocEndDate
    };
    
    let result = text;
    for (const [key, value] of Object.entries(replacements)) {
        result = result.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value || '');
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