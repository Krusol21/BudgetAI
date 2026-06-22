const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');

const router = express.Router();

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

router.post('/register', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get([email.toLowerCase()]);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 12);
    const id = uuidv4();
    db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run([id, email.toLowerCase(), hash]);

    // Seed default budget categories
    const defaults = [
      { category: 'Groceries', limit: 250 },
      { category: 'Dining Out', limit: 100 },
      { category: 'Transportation', limit: 80 },
      { category: 'Entertainment', limit: 60 },
      { category: 'Roth IRA Savings', limit: 200 },
      { category: 'Personal Care', limit: 50 },
      { category: 'Utilities', limit: 70 },
      { category: 'Miscellaneous', limit: 100 },
    ];
    const insertBudget = db.prepare(
      'INSERT OR IGNORE INTO budgets (id, user_id, category, budget_limit) VALUES (?, ?, ?, ?)'
    );
    for (const b of defaults) insertBudget.run([uuidv4(), id, b.category, b.limit]);

    res.status(201).json({ token: signToken(id), email: email.toLowerCase() });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get([email.toLowerCase()]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({ token: signToken(user.id), email: user.email });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
