const express = require('express');
const config = require('../config');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const usecases = require('../services/usecases');
const remote = require('../services/remote');
const insights = require('../services/insights');

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
            remote: remoteUpdates
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update configuration (admin only)
router.post('/config', requireAdmin, async (req, res) => {
    try {
        config.update(req.body);
        await config.save();
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
        await insights.send('usecase_completion', { useCaseId: id, completed });
        
        res.json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Submit feedback
router.post('/use-cases/:productCategory/:slug/feedback', requireAuth, async (req, res) => {
    try {
        const { productCategory, slug } = req.params;
        const { rating, message } = req.body;
        const id = `${productCategory}/${slug}`;
        
        await usecases.saveFeedback(id, rating, message);
        await insights.send('usecase_feedback', { useCaseId: id, rating, message });
        
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

module.exports = router;