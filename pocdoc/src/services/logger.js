/**
 * Simple in-memory log buffer for the console viewer
 */

const logBuffer = [];
const MAX_LOG_LINES = 2000;

// Store original console methods
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

function formatArgs(args) {
    return args.map(arg => {
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg);
            } catch (e) {
                return String(arg);
            }
        }
        return String(arg);
    }).join(' ');
}

function addToBuffer(level, args) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const prefix = level === 'log' ? '' : `${level.toUpperCase()}: `;
    const line = `[${timestamp}] ${prefix}${formatArgs(args)}`;
    logBuffer.push(line);
    if (logBuffer.length > MAX_LOG_LINES) {
        logBuffer.shift();
    }
}

// Override console methods
console.log = function(...args) {
    addToBuffer('log', args);
    originalLog.apply(console, args);
};

console.error = function(...args) {
    addToBuffer('error', args);
    originalError.apply(console, args);
};

console.warn = function(...args) {
    addToBuffer('warn', args);
    originalWarn.apply(console, args);
};

function getLogs(lines = 50) {
    return logBuffer.slice(-lines).join('\n');
}

function clear() {
    logBuffer.length = 0;
}

module.exports = {
    getLogs,
    clear
};