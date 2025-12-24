import express from 'express';
import cors from 'cors';
import handler from './api/relay.js';
import { config } from 'dotenv';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Proxy endpoint
app.all('/api/relay', async (req, res) => {
  await handler(req, res);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 Proxy endpoint: http://localhost:${PORT}/api/relay`);
  console.log(`💡 Make sure to set COZE_API_KEY and/or DEEPSEEK_API_KEY in your .env file`);
});

