const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authenticate } = require('./middleware');
const { syncSnapshot } = require('../agent/snapshot');

const router = express.Router();
router.use(authenticate);

router.get('/summary', (req, res, next) => {
  try {
    const db = getDb();
    const year = new Date().getFullYear();
    const yearPrefix = `${year}-%`;

    const budget = db.prepare(
      'SELECT annual_limit FROM parental_budgets WHERE user_id = ? AND year = ?'
    ).get([req.userId, year]);

    const ccRow = db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
       WHERE user_id = ? AND funding_source = 'parental' AND is_expense = 1 AND date LIKE ?`
    ).get([req.userId, yearPrefix]);

    const manualRows = db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM parental_manual_entries
       WHERE user_id = ? AND month LIKE ?`
    ).get([req.userId, yearPrefix]);

    const rentRow = db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM parental_manual_entries
       WHERE user_id = ? AND category = 'Rent' AND month LIKE ?`
    ).get([req.userId, yearPrefix]);

    const utilitiesRow = db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM parental_manual_entries
       WHERE user_id = ? AND category = 'Utilities' AND month LIKE ?`
    ).get([req.userId, yearPrefix]);

    const creditCardSpent = ccRow ? ccRow.total : 0;
    const manualSpent = manualRows ? manualRows.total : 0;
    const totalSpent = creditCardSpent + manualSpent;
    const annualLimit = budget ? budget.annual_limit : null;

    res.json({
      year,
      annualLimit,
      totalSpent,
      remaining: annualLimit !== null ? annualLimit - totalSpent : null,
      breakdown: {
        creditCard: creditCardSpent,
        rent: rentRow ? rentRow.total : 0,
        utilities: utilitiesRow ? utilitiesRow.total : 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/setup', (req, res, next) => {
  try {
    const { annual_limit, year } = req.body;
    if (!annual_limit || isNaN(annual_limit) || annual_limit <= 0) {
      return res.status(400).json({ error: 'annual_limit must be a positive number' });
    }
    const db = getDb();
    const targetYear = year || new Date().getFullYear();

    const existing = db.prepare(
      'SELECT id FROM parental_budgets WHERE user_id = ? AND year = ?'
    ).get([req.userId, targetYear]);

    if (existing) {
      db.prepare('UPDATE parental_budgets SET annual_limit = ? WHERE user_id = ? AND year = ?')
        .run([annual_limit, req.userId, targetYear]);
    } else {
      db.prepare('INSERT INTO parental_budgets (id, user_id, annual_limit, year) VALUES (?, ?, ?, ?)')
        .run([uuidv4(), req.userId, annual_limit, targetYear]);
    }

    syncSnapshot(req.userId);
    res.json({ success: true, annual_limit, year: targetYear });
  } catch (err) {
    next(err);
  }
});

router.get('/manual-entries', (req, res, next) => {
  try {
    const db = getDb();
    const entries = db.prepare(
      'SELECT * FROM parental_manual_entries WHERE user_id = ? ORDER BY month DESC, created_at DESC'
    ).all([req.userId]);
    res.json({ entries });
  } catch (err) {
    next(err);
  }
});

router.post('/manual-entries', (req, res, next) => {
  try {
    const { amount, category, month, description } = req.body;
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }
    if (!['Rent', 'Utilities'].includes(category)) {
      return res.status(400).json({ error: 'category must be Rent or Utilities' });
    }
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'month must be in YYYY-MM format' });
    }

    const db = getDb();
    const id = uuidv4();
    db.prepare(
      'INSERT INTO parental_manual_entries (id, user_id, amount, category, month, description) VALUES (?, ?, ?, ?, ?, ?)'
    ).run([id, req.userId, amount, category, month, description || null]);

    syncSnapshot(req.userId);
    res.json({ success: true, id, amount, category, month });
  } catch (err) {
    next(err);
  }
});

router.delete('/manual-entries/:id', (req, res, next) => {
  try {
    const db = getDb();
    const result = db.prepare(
      'DELETE FROM parental_manual_entries WHERE id = ? AND user_id = ?'
    ).run([req.params.id, req.userId]);

    if (result.changes === 0) return res.status(404).json({ error: 'Entry not found' });
    syncSnapshot(req.userId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
