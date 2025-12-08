const express = require('express');
const path = require('path');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Login page
router.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../../views/login.html'));
});

// Login handler
router.post('/login', (req, res) => {
    console.log('[LOGIN] POST received, body:', req.body);
    const { username, password } = req.body;
    const user = authenticate(username, password);
    console.log('[LOGIN] authenticate result:', user);
    
    if (user) {
        req.session.authenticated = true;
        req.session.role = user.role;
        req.session.username = user.username;
        console.log('[LOGIN] Session set:', req.session);
        req.session.save((err) => {
            if (err) {
                console.log('[LOGIN] Session save error:', err);
            }
            console.log('[LOGIN] Redirecting to /');
            return res.redirect('/');
        });
        return;
    }
    
    console.log('[LOGIN] Auth failed');
    res.redirect('/login?error=invalid');
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

module.exports = router;