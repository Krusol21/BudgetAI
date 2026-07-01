const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { getDb } = require('../database');
const { authenticate } = require('./middleware');
const { categorizeTransaction } = require('../agent/tools');
const { syncSnapshot } = require('../agent/snapshot');

const router = express.Router();
router.use(authenticate);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function stripBom(text) {
  return text.replace(/^﻿/, '').replace(/^ï»¿/, '');
}

function findHeaderLine(text) {
  const DATE_WORDS = ['date', 'run date', 'transaction date', 'post date', 'posted date'];
  const DESC_WORDS = ['description', 'action', 'memo', 'payee', 'transaction description', 'details'];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    const hasDate = DATE_WORDS.some(w => lower.includes(w));
    const hasDesc = DESC_WORDS.some(w => lower.includes(w));
    if (hasDate && hasDesc) return lines.slice(i).join('\n');
  }
  return text;
}

function parseCSV(buffer) {
  const raw = stripBom(buffer.toString('utf-8'));
  const text = findHeaderLine(raw);
  const records = parse(text, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true });
  if (!records.length) throw new Error('CSV file is empty');

  const cols = Object.keys(records[0]).map(k => k.toLowerCase().trim());
  const colMap = Object.keys(records[0]);

  const dateKey = colMap.find(k =>
    ['date', 'run date', 'transaction date', 'post date', 'posted date'].includes(k.toLowerCase().trim())
  );
  const descKey = colMap.find(k =>
    ['description', 'action', 'memo', 'payee', 'transaction description', 'details'].includes(k.toLowerCase().trim())
  );
  const amountKey = colMap.find(k => {
    const l = k.toLowerCase().trim();
    return ['amount', 'transaction amount', 'amount ($)'].includes(l);
  });
  const debitKey = colMap.find(k =>
    ['debit', 'withdrawals', 'withdrawal'].includes(k.toLowerCase().trim())
  );
  const creditKey = colMap.find(k =>
    ['credit', 'deposits', 'deposit'].includes(k.toLowerCase().trim())
  );

  if (!dateKey || !descKey) throw new Error('Could not detect Date or Description columns in CSV');

  const isAmexStyle = cols.some(c => ['extended details', 'appears on your statement as'].includes(c));

  return records.map(row => {
    let amount = 0;
    let isExpense = true;

    if (amountKey) {
      const raw = String(row[amountKey] || '0').replace(/[$,\s]/g, '');
      amount = parseFloat(raw) || 0;
      if (isAmexStyle) {
        isExpense = amount > 0;
      } else {
        isExpense = amount < 0;
      }
      amount = Math.abs(amount);
    } else if (debitKey || creditKey) {
      const debit = parseFloat(String(row[debitKey] || '0').replace(/[$,\s]/g, '')) || 0;
      const credit = parseFloat(String(row[creditKey] || '0').replace(/[$,\s]/g, '')) || 0;
      if (debit > 0) { amount = debit; isExpense = true; }
      else if (credit > 0) { amount = credit; isExpense = false; }
    }

    return {
      date: row[dateKey]?.trim() || '',
      description: row[descKey]?.trim() || 'Unknown',
      amount,
      isExpense,
    };
  }).filter(r => r.date && r.amount > 0);
}

router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const rows = parseCSV(req.file.buffer);
    const db = getDb();
    const fundingSource = req.body.funding_source === 'parental' ? 'parental' : 'personal';

    const budgets = await db.prepare('SELECT category FROM budgets WHERE user_id = ?').all([req.userId]);
    const categories = budgets.map(b => b.category);

    const results = [];
    for (const row of rows) {
      const category = await categorizeTransaction(row.description, row.amount, categories);

      let date = row.date;
      try {
        const d = new Date(row.date);
        if (!isNaN(d)) date = d.toISOString().split('T')[0];
      } catch {}

      const id = crypto.createHash('sha1')
        .update(`${req.userId}|${date}|${row.description}|${row.amount}`)
        .digest('hex');

      await db.prepare(
        'INSERT INTO transactions (id, user_id, date, amount, description, category, is_expense, funding_source) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING'
      ).run([id, req.userId, date, row.amount, row.description, category, row.isExpense ? 1 : 0, fundingSource]);

      results.push({ id, date, amount: row.amount, description: row.description, category, isExpense: row.isExpense, fundingSource });
    }

    syncSnapshot(req.userId);
    res.json({ imported: results.length, transactions: results });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { limit = 50, offset = 0, category, startDate, endDate } = req.query;
    const db = getDb();

    let query = 'SELECT * FROM transactions WHERE user_id = ?';
    const params = [req.userId];

    if (category) { query += ' AND category = ?'; params.push(category); }
    if (startDate) { query += ' AND date >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND date <= ?'; params.push(endDate); }

    query += ' ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const transactions = await db.prepare(query).all(params);
    const countRow = await db.prepare('SELECT COUNT(*) as count FROM transactions WHERE user_id = ?').get([req.userId]);

    res.json({ transactions, total: Number(countRow.count) });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/category', async (req, res, next) => {
  try {
    const { category } = req.body;
    if (!category) return res.status(400).json({ error: 'category required' });

    const db = getDb();
    const result = await db.prepare(
      'UPDATE transactions SET category = ? WHERE id = ? AND user_id = ?'
    ).run([category, req.params.id, req.userId]);

    if (result.changes === 0) return res.status(404).json({ error: 'Transaction not found' });
    syncSnapshot(req.userId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const db = getDb();
    const result = await db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run([req.params.id, req.userId]);
    if (result.changes === 0) return res.status(404).json({ error: 'Transaction not found' });
    syncSnapshot(req.userId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/summary', async (req, res, next) => {
  try {
    const db = getDb();
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const monthly = await db.prepare(`
      SELECT category, SUM(amount) as total, COUNT(*) as count
      FROM transactions
      WHERE user_id = ? AND date >= ? AND is_expense = 1
      GROUP BY category ORDER BY total DESC
    `).all([req.userId, monthStart]);

    const daily = await db.prepare(`
      SELECT date, SUM(amount) as total
      FROM transactions
      WHERE user_id = ? AND date >= ? AND is_expense = 1
      GROUP BY date ORDER BY date ASC
    `).all([req.userId, monthStart]);

    const totalSpent = monthly.reduce((s, r) => s + Number(r.total), 0);
    const incomeRow = await db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM transactions
      WHERE user_id = ? AND date >= ? AND is_expense = 0
    `).get([req.userId, monthStart]);

    res.json({ monthly, daily, totalSpent, totalIncome: Number(incomeRow.total) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
