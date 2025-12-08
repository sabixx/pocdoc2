const express = require('express');

const config = require('../config');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const usecases = require('../services/usecases');
const remote = require('../services/remote');
const insights = require('../services/insights');
const logger = require('../services/logger');

const router = express.Router();

// Get session info
router.get('/session', requireAuth, (req, res) => {
    res.json({
        authenticated: true,
        role: req.session.role,
        username: req.session.username
    });
});

// Get current configuration (admin only)
router.get('/config', requireAdmin, async (req, res) => {
    try {
        const { useCases, conflicts } = await usecases.getAll();
        const remoteUpdates = await remote.checkForUpdates();
        const cfg = config.get();
        const pocState = insights.getState();
        
        res.json({
            config: {
                prospect: cfg.prospect,
                partner: cfg.partner,
                saasName: cfg.saasName,
                pocStartDate: cfg.pocStartDate,
                pocEndDate: cfg.pocEndDate,
                pocOrDemo: cfg.pocOrDemo,
                useCaseRepoUrl: cfg.useCaseRepoUrl,
                useCaseLocalPath: cfg.useCaseLocalPath,
                activeUseCases: cfg.activeUseCases,
                useCaseOrder: cfg.useCaseOrder
            },
            useCases,
            conflicts,
            remote: remoteUpdates,
            // Include POC state for admin visibility
            pocState: pocState ? {
                poc_uid: pocState.poc_uid,
                registered_at: pocState.registered_at,
                last_heartbeat: pocState.last_heartbeat
            } : null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update configuration (admin only)
router.post('/config', requireAdmin, async (req, res) => {
    try {
        const oldMode = config.get('pocOrDemo');
        
        config.update(req.body);
        await config.save();
        
        const newMode = config.get('pocOrDemo');
        
        // Handle mode change
        if (oldMode !== newMode) {
            if (newMode === 'poc') {
                // Switching to POC mode - register
                console.log('[API] Mode changed to POC - registering...');
                await insights.register();
                insights.startHeartbeat();
            } else {
                // Switching to demo mode - deregister
                console.log('[API] Mode changed to demo - deregistering...');
                await insights.deregister();
                insights.stopHeartbeat();
            }
        }
        
        res.json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all active use cases (for main app)
router.get('/use-cases', requireAuth, async (req, res) => {
    try {
        const activeUseCases = await usecases.getActive();
        const completed = await usecases.loadCompleted();
        const cfg = config.get();
        
        res.json({
            useCases: activeUseCases,
            completed,
            session: {
                role: req.session.role,
                username: req.session.username
            },
            config: {
                prospect: cfg.prospect,
                partner: cfg.partner,
                saasName: cfg.saasName,
                pocStartDate: cfg.pocStartDate,
                pocEndDate: cfg.pocEndDate
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single use case
router.get('/use-cases/:productCategory/:slug', requireAuth, async (req, res) => {
    try {
        const { productCategory, slug } = req.params;
        const useCase = await usecases.loadFromDisk(productCategory, slug);
        
        if (!useCase) {
            return res.status(404).json({ error: 'Use case not found' });
        }
        
        res.json(useCase);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Mark use case complete/incomplete
router.post('/use-cases/:productCategory/:slug/complete', requireAuth, async (req, res) => {
    try {
        const { productCategory, slug } = req.params;
        const { completed } = req.body;
        const id = `${productCategory}/${slug}`;
        
        const completedUseCases = await usecases.loadCompleted();
        completedUseCases[id] = {
            completed,
            completedAt: completed ? new Date().toISOString() : null
        };
        
        await usecases.saveCompleted(completedUseCases);
        
        // Send to backend (async, don't wait)
        insights.sendCompletion(id, completed).catch(err => {
            console.error('[API] Failed to send completion to backend:', err.message);
        });
        
        res.json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Submit feedback (rating and/or message)
router.post('/use-cases/:productCategory/:slug/feedback', requireAuth, async (req, res) => {
    try {
        const { productCategory, slug } = req.params;
        const { rating, message } = req.body;
        const id = `${productCategory}/${slug}`;
        
        await usecases.saveFeedback(id, rating, message);
        
        // Send to backend (async, don't wait)
        if (rating) {
            insights.sendRating(id, rating).catch(err => {
                console.error('[API] Failed to send rating to backend:', err.message);
            });
        }
        if (message) {
            insights.sendFeedback(id, message).catch(err => {
                console.error('[API] Failed to send feedback to backend:', err.message);
            });
        }
        
        res.json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Download single use case (admin only)
router.post('/download-use-case', requireAdmin, async (req, res) => {
    try {
        const { productCategory, slug } = req.body;
        const cfg = config.get();
        await remote.downloadUseCase(cfg.useCaseRepoUrl, productCategory, slug);
        res.json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Download all use cases with progress streaming (admin only)
router.post('/download-all-use-cases', requireAdmin, async (req, res) => {
    const { repoUrl } = req.body;
    
    if (!repoUrl) {
        return res.status(400).json({ error: 'Repository URL is required' });
    }

    // Set up streaming response
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Transfer-Encoding', 'chunked');

    const sendProgress = (data) => {
        res.write(JSON.stringify(data) + '\n');
    };

    try {
        sendProgress({ progress: 5, message: 'Fetching manifest...' });
        
        const result = await remote.downloadAll(repoUrl, (progress) => {
            sendProgress({
                progress: progress.progress,
                message: `Downloading: ${progress.name} (${progress.current}/${progress.total})`
            });
        });

        sendProgress({ 
            progress: 100, 
            complete: true, 
            downloaded: result.downloaded,
            failed: result.failed,
            message: `Downloaded ${result.downloaded} use cases${result.failed > 0 ? `, ${result.failed} failed` : ''}` 
        });

    } catch (error) {
        console.error('Download all error:', error);
        sendProgress({ error: error.message });
    }

    res.end();
});

// Check for remote updates (admin only)
router.get('/remote-updates', requireAdmin, async (req, res) => {
    try {
        const repoUrl = req.query.repoUrl;
        const result = await remote.checkForUpdates(repoUrl);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Force heartbeat (admin only, for testing)
router.post('/force-heartbeat', requireAdmin, async (req, res) => {
    try {
        await insights.sendHeartbeat();
        res.json({ status: 'success', message: 'Heartbeat sent' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get POC state (admin only)
router.get('/poc-state', requireAdmin, async (req, res) => {
    try {
        await insights.loadState();
        const state = insights.getState();
        res.json(state || { registered: false });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add this route
router.get('/logs', requireAuth, (req, res) => {
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    const lines = parseInt(req.query.lines) || 50;
    res.json({ logs: logger.getLogs(lines) });
});

module.exports = router;