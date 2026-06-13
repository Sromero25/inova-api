const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { getChatResponse } = require('../services/geminiService');
const { dbGet, dbAll, dbRun } = require('../database');
const router = express.Router();

router.get('/sessions', authMiddleware, (req, res) => {
  const sessions = dbAll(
    `SELECT cs.id, cs.title, cs.updated_at as updatedAt,
      (SELECT content FROM messages WHERE session_id = cs.id ORDER BY timestamp DESC LIMIT 1) as lastMessage,
      (SELECT COUNT(*) FROM messages WHERE session_id = cs.id) as messageCount
     FROM chat_sessions cs
     WHERE cs.user_id = ?
     ORDER BY cs.updated_at DESC`,
    [req.userId]
  );
  res.json(sessions.map(s => ({
    ...s,
    lastMessage: s.lastMessage || '',
    messageCount: s.messageCount || 0
  })));
});

router.post('/sessions', authMiddleware, (req, res) => {
  const countRow = dbGet('SELECT COUNT(*) as cnt FROM chat_sessions WHERE user_id = ?', [req.userId]);
  const id = Date.now().toString();
  const title = req.body.title || `Sesión ${(countRow?.cnt || 0) + 1}`;
  const now = new Date().toISOString();

  dbRun('INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [id, req.userId, title, now, now]);

  res.status(201).json({ id, title, messages: [], createdAt: now, updatedAt: now });
});

router.get('/sessions/:sessionId/messages', authMiddleware, (req, res) => {
  const session = dbGet('SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?',
    [req.params.sessionId, req.userId]);

  if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });

  const messages = dbAll(
    'SELECT id, role, content, has_risk_signal as hasRiskSignal, timestamp FROM messages WHERE session_id = ? ORDER BY timestamp ASC',
    [req.params.sessionId]
  );

  res.json(messages.map(m => ({ ...m, hasRiskSignal: m.hasRiskSignal === 1 })));
});

router.post('/sessions/:sessionId/messages', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'El mensaje no puede estar vacío' });

    const session = dbGet('SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?',
      [req.params.sessionId, req.userId]);
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });

    const userMsgId = Date.now().toString();
    const now = new Date().toISOString();
    dbRun('INSERT INTO messages (id, session_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)',
      [userMsgId, req.params.sessionId, 'user', message, now]);

    const history = dbAll(
      'SELECT role, content FROM messages WHERE session_id = ? ORDER BY timestamp ASC LIMIT 20',
      [req.params.sessionId]
    );

    const aiResponse = await getChatResponse(message, history);

    const aiMsgId = (Date.now() + 1).toString();
    const aiNow = new Date().toISOString();
    dbRun('INSERT INTO messages (id, session_id, role, content, has_risk_signal, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      [aiMsgId, req.params.sessionId, 'assistant', aiResponse.message, aiResponse.hasRiskSignal ? 1 : 0, aiNow]);

    dbRun('UPDATE chat_sessions SET updated_at = ? WHERE id = ?', [aiNow, req.params.sessionId]);

    res.json({
      userMessage: { id: userMsgId, role: 'user', content: message, hasRiskSignal: false, timestamp: now },
      aiMessage: { id: aiMsgId, role: 'assistant', content: aiResponse.message, hasRiskSignal: aiResponse.hasRiskSignal, timestamp: aiNow },
      sessionId: req.params.sessionId
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;