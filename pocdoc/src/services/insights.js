const config = require('../config');
const usecases = require('./usecases');

async function send(eventType, data) {
    const cfg = config.get();
    
    if (cfg.pocOrDemo !== 'poc' || !cfg.pocInsightsUrl) {
        return; // Only send for POC mode with configured URL
    }
    
    try {
        await fetch(cfg.pocInsightsUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                eventType,
                prospect: cfg.prospect,
                partner: cfg.partner,
                pocStartDate: cfg.pocStartDate,
                pocEndDate: cfg.pocEndDate,
                timestamp: new Date().toISOString(),
                ...data
            })
        });
    } catch (error) {
        console.error('Error sending to insights:', error);
    }
}

async function sendHeartbeat() {
    const cfg = config.get();
    
    if (cfg.pocOrDemo !== 'poc' || !cfg.pocInsightsUrl) {
        return;
    }
    
    try {
        const allUseCases = await usecases.getActive();
        const completed = await usecases.loadCompleted();
        
        await send('heartbeat', {
            activeUseCases: cfg.activeUseCases,
            useCaseMetadata: allUseCases.map(uc => ({
                id: uc.id,
                name: uc.name,
                version: uc.version,
                product: uc.product,
                category: uc.category
            })),
            completionStatus: completed
        });
    } catch (error) {
        console.error('Heartbeat error:', error);
    }
}

function startHeartbeat() {
    const cfg = config.get();
    
    if (cfg.pocOrDemo === 'poc') {
        sendHeartbeat(); // Initial heartbeat
        setInterval(sendHeartbeat, 24 * 60 * 60 * 1000); // Daily
    }
}

module.exports = {
    send,
    sendHeartbeat,
    startHeartbeat
};