import express from 'express';
import cors from 'cors';
import relayHandler from './src/handlers/relay.js';
import { validateRequestSize, validateRequestBody } from './src/middleware/validation.js';
import { config as appConfig, validateConfig } from './src/config/index.js';
import { config } from 'dotenv';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3000;

// Validate configuration on startup
try {
  validateConfig();
  console.log('✅ Configuration validated successfully');
  if (appConfig.useCoze && appConfig.cozeApiKey) {
    console.log('📡 Coze API: Enabled (with DeepSeek fallback)');
  } else {
    console.log('📡 Coze API: Disabled (using DeepSeek directly)');
  }
} catch (configError) {
  console.warn('⚠️  Configuration warning:', configError.message);
  console.warn('   Server will start but API calls may fail');
}

// Middleware
app.use(cors());
app.use(express.json({ limit: `${appConfig.maxRequestSize}b` }));
app.use(validateRequestSize);
app.use('/api/relay', validateRequestBody);

// Proxy endpoint
app.all('/api/relay', async (req, res) => {
  await relayHandler(req, res);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    config: {
      cozeEnabled: appConfig.useCoze && !!appConfig.cozeApiKey,
      deepseekConfigured: !!appConfig.deepseekApiKey
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 Proxy endpoint: http://localhost:${PORT}/api/relay`);
  console.log(`💡 Environment: ${process.env.NODE_ENV || 'development'}`);
});

