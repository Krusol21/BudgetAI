const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authenticate } = require('./middleware');
const { syncSnapshot } = require('../agent/snapshot');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const db = getDb();
  const budgets = db.prepare('SELECT * FROM budgets WHERE user_id = ? ORDER BY category').all([req.userId]);

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const spending = db.prepare(`
    SELECT category, SUM(ABS(amount)) as spent
    FROM transactions
    WHERE user_id = ? AND date >= ? AND is_expense = 1
    GROUP BY category
  `).all([req.userId, monthStart]);

  const spendMap = {};
  for (const s of spending) spendMap[s.category] = s.spent;

  res.json(budgets.map(b => ({
    ...b,
    spent: spendMap[b.category] || 0,
    remaining: b.budget_limit - (spendMap[b.category] || 0),
  })));
});

router.post('/', (req, res) => {
  const { category, budget_limit, period = 'monthly' } = req.body;
  if (!category || !budget_limit) return res.status(400).json({ error: 'category and budget_limit required' });

  const db = getDb();
  const id = uuidv4();
  try {
    db.prepare(
      'INSERT INTO budgets (id, user_id, category, budget_limit, period) VALUES (?, ?, ?, ?, ?)'
    ).run([id, req.userId, category, Number(budget_limit), period]);
    syncSnapshot(req.userId);
    res.status(201).json({ id, category, budget_limit: Number(budget_limit), period });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Category already exists' });
    throw err;
  }
});

router.put('/:id', (req, res) => {
  const { budget_limit, period } = req.body;
  const db = getDb();
  const budget = db.prepare('SELECT * FROM budgets WHERE id = ? AND user_id = ?').get([req.params.id, req.userId]);
  if (!budget) return res.status(404).json({ error: 'Budget not found' });

  db.prepare('UPDATE budgets SET budget_limit = ?, period = ? WHERE id = ?').run([
    budget_limit ?? budget.budget_limit,
    period ?? budget.period,
    req.params.id,
  ]);
  syncSnapshot(req.userId);
  res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM budgets WHERE id = ? AND user_id = ?').run([req.params.id, req.userId]);
  if (result.changes === 0) return res.status(404).json({ error: 'Budget not found' });
  syncSnapshot(req.userId);
  res.json({ success: true });
});

module.exports = router;
