const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { getChatResponse } = require('../services/geminiService');
const router = express.Router();

// Storage en memoria (suficiente para el demo)
const chatSessions = {};

// Obtener todas las sesiones de un usuario
router.get('/sessions', authMiddleware, (req, res) => {
  const userSessions = chatSessions[req.userId] || [];
  res.json(userSessions.map(s => ({
    id: s.id,
    title: s.title,
    lastMessage: s.messages[s.messages.length - 1]?.content || '',
    updatedAt: s.updatedAt,
    messageCount: s.messages.length
  })));
});

// Crear nueva sesión de chat
router.post('/sessions', authMiddleware, (req, res) => {
  if (!chatSessions[req.userId]) {
    chatSessions[req.userId] = [];
  }
  
  const session = {
    id: Date.now().toString(),
    title: req.body.title || `Sesión ${chatSessions[req.userId].length + 1}`,
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  chatSessions[req.userId].push(session);
  res.status(201).json(session);
});

// Obtener mensajes de una sesión
router.get('/sessions/:sessionId/messages', authMiddleware, (req, res) => {
  const sessions = chatSessions[req.userId] || [];
  const session = sessions.find(s => s.id === req.params.sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Sesión no encontrada' });
  }
  
  res.json(session.messages);
});

// Enviar mensaje y obtener respuesta de IA
router.post('/sessions/:sessionId/messages', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
    }
    
    const sessions = chatSessions[req.userId] || [];
    const session = sessions.find(s => s.id === req.params.sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }
    
    // Agregar mensaje del usuario
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date()
    };
    session.messages.push(userMessage);
    
    // Obtener respuesta de Gemini
    const aiResponse = await getChatResponse(message, session.messages.slice(-10));
    
    const aiMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: aiResponse.message,
      hasRiskSignal: aiResponse.hasRiskSignal,
      timestamp: new Date()
    };
    session.messages.push(aiMessage);
    session.updatedAt = new Date();
    
    res.json({
      userMessage,
      aiMessage,
      sessionId: session.id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;