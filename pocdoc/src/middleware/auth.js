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
    const usernameLower = username?.toLowerCase();

    // Check admin credentials
    if (usernameLower === cfg.authAdminUsername?.toLowerCase() && password === cfg.authAdminPassword) {
        return { role: 'admin', username };
    }

    // Check prospect credentials
    if (usernameLower === cfg.prospect?.toLowerCase() && password === cfg.authProspectPassword) {
        return { role: 'prospect', username };
    }

    return null;
}

module.exports = {
    requireAuth,
    requireAdmin,
    authenticate
};