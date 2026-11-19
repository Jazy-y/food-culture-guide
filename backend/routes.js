const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('./db');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Register route
router.post('/register', (req, res) => {
  const { username, email, password } = req.body || {};
  if (typeof username !== 'string' || !username.trim() ||
      typeof email !== 'string' || !EMAIL_PATTERN.test(email) ||
      typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ message: 'Username, a valid email and a password of 8+ characters are required.' });
  }
  const hashedPassword = bcrypt.hashSync(password, 10);

  const sql = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
  db.query(sql, [username.trim(), email.toLowerCase(), hashedPassword], (err) => {
    if (err) {
      console.error('Register failed:', err.code);
      return res.status(500).json({ message: 'Registration failed.' });
    }
    res.status(201).json({ message: 'User registered successfully!' });
  });
});

// Login route
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const sql = 'SELECT id, username, email, password FROM users WHERE email = ?';
  db.query(sql, [email.toLowerCase()], (err, results) => {
    if (err) {
      console.error('Login failed:', err.code);
      return res.status(500).json({ message: 'Login failed.' });
    }
    const user = results[0];
    // Same response for unknown email and wrong password (no account enumeration).
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Never return the password hash.
    res.status(200).json({
      message: 'Login successful!',
      user: { id: user.id, username: user.username, email: user.email },
    });
  });
});

module.exports = router;
