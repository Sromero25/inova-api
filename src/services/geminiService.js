const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_PROMPT = `Eres un asistente de salud mental empático y profesional. 
Tu objetivo es apoyar emocionalmente al usuario, escuchar activamente y ofrecer orientación constructiva.
Si detectas señales de riesgo (ideación suicida, autolesión, crisis severa), responde con empatía y sugiere recursos de ayuda profesional.
Responde siempre en español, de forma cálida y sin juzgar.`;

const RISK_KEYWORDS = [
  'suicidio', 'suicidarme', 'matarme', 'no quiero vivir', 'quitarme la vida',
  'hacerme daño', 'autolesión', 'cortarme', 'overdosis', 'no vale la pena vivir'
];

function detectRisk(text) {
  const lower = text.toLowerCase();
  return RISK_KEYWORDS.some(kw => lower.includes(kw));
}

async function getChatResponse(userMessage, history = []) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    // Construir historial para Gemini
    const formattedHistory = history.slice(0, -1).map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
        { role: 'model', parts: [{ text: 'Entendido. Estoy aquí para apoyarte. ¿Cómo te sientes hoy?' }] },
        ...formattedHistory
      ]
    });

    const result = await chat.sendMessage(userMessage);
    const responseText = result.response.text();
    const hasRiskSignal = detectRisk(userMessage) || detectRisk(responseText);

    return { message: responseText, hasRiskSignal };
  } catch (error) {
    console.error('Error Gemini:', error.message);
    return {
      message: 'Lo siento, en este momento no puedo responder. Por favor intenta de nuevo en un momento.',
      hasRiskSignal: false
    };
  }
}

module.exports = { getChatResponse };