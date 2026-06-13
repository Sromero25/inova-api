const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initDb } = require('./database');
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chats');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

const PORT = process.env.PORT || 3000;

// Primero inicializa la BD, luego levanta el servidor
initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
}).catch(err => {
  console.error('Error iniciando base de datos:', err);
  process.exit(1);
});