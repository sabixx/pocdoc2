const config = require('../config');

function requireAuth(req, res, next) {
    if (req.session && req.session.authenticated) {
        return next();
    }
    
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    res.redirect('/login');
}

function requireAdmin(req, res, next) {
    if (req.session && req.session.authenticated && req.session.role === 'admin') {
        return next();
    }
    
    if (req.path.startsWith('/api/')) {
        return res.status(403).json({ error: 'Forbidden - Admin access required' });
    }
    
    res.redirect('/');
}

function authenticate(username, password) {
    const cfg = config.get();
    
    // Check admin credentials
    if (username === cfg.authAdminUsername && password === cfg.authAdminPassword) {
        return { role: 'admin', username };
    }
    
    // Check prospect credentials
    if (username === cfg.prospect && password === cfg.authProspectPassword) {
        return { role: 'prospect', username };
    }
    
    return null;
}

module.exports = {
    requireAuth,
    requireAdmin,
    authenticate
};