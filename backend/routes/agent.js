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

    await db.prepare('INSERT INTO conversations (id, user_id, role, content) VALUES (?, ?, ?, ?)')
      .run([uuidv4(), req.userId, 'user', message]);

    const history = await db.prepare(
      'SELECT role, content FROM conversations WHERE user_id = ? ORDER BY created_at DESC LIMIT 20'
    ).all([req.userId]);

    const reply = await runAgent(req.userId, history.reverse());

    await db.prepare('INSERT INTO conversations (id, user_id, role, content) VALUES (?, ?, ?, ?)')
      .run([uuidv4(), req.userId, 'assistant', reply]);

    res.json({ reply });
  } catch (err) {
    next(err);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const db = getDb();
    const history = await db.prepare(
      'SELECT role, content, created_at FROM conversations WHERE user_id = ? ORDER BY created_at ASC LIMIT 100'
    ).all([req.userId]);
    res.json({ history });
  } catch (err) {
    next(err);
  }
});

router.delete('/history', async (req, res, next) => {
  try {
    const db = getDb();
    await db.prepare('DELETE FROM conversations WHERE user_id = ?').run([req.userId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
