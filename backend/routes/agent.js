const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authenticate } = require('./middleware');
const { runAgent } = require('../agent/tools');

const router = express.Router();
router.use(authenticate);

router.post('/chat', async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'message required' });

    const db = getDb();

    db.prepare('INSERT INTO conversations (id, user_id, role, content) VALUES (?, ?, ?, ?)')
      .run([uuidv4(), req.userId, 'user', message]);

    const history = db.prepare(
      'SELECT role, content FROM conversations WHERE user_id = ? ORDER BY created_at DESC LIMIT 20'
    ).all([req.userId]).reverse();

    const reply = await runAgent(req.userId, history);

    db.prepare('INSERT INTO conversations (id, user_id, role, content) VALUES (?, ?, ?, ?)')
      .run([uuidv4(), req.userId, 'assistant', reply]);

    res.json({ reply });
  } catch (err) {
    next(err);
  }
});

router.get('/history', (req, res) => {
  const db = getDb();
  const history = db.prepare(
    'SELECT role, content, created_at FROM conversations WHERE user_id = ? ORDER BY created_at ASC LIMIT 100'
  ).all([req.userId]);
  res.json({ history });
});

router.delete('/history', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM conversations WHERE user_id = ?').run([req.userId]);
  res.json({ success: true });
});

module.exports = router;
