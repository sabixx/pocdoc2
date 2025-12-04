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
    const { username, password } = req.body;
    const user = authenticate(username, password);
    
    if (user) {
        req.session.authenticated = true;
        req.session.role = user.role;
        req.session.username = user.username;
        return res.redirect('/');
    }
    
    res.redirect('/login?error=invalid');
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

module.exports = router;