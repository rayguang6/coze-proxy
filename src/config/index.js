import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

// Validate required environment variables
function validateEnv() {
  const errors = [];
  
  if (!process.env.DEEPSEEK_API_KEY) {
    errors.push('DEEPSEEK_API_KEY is required');
  }
  
  // COZE_API_KEY is optional - only needed if USE_COZE=true
  const useCoze = process.env.USE_COZE === 'true';
  if (useCoze && !process.env.COZE_API_KEY) {
    errors.push('COZE_API_KEY is required when USE_COZE=true');
  }
  
  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }
}

// Validate on module load (only for server.js, not for Vercel serverless)
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
  try {
    validateEnv();
  } catch (err) {
    // For Vercel serverless, we'll validate per-request
    // This allows the function to load even if env vars aren't set yet
    if (!process.env.VERCEL) {
      console.warn('Environment validation warning:', err.message);
    }
  }
}

export const config = {
  cozeApiKey: process.env.COZE_API_KEY,
  deepseekApiKey: process.env.DEEPSEEK_API_KEY,
  useCoze: process.env.USE_COZE === 'true',
  cozeApiUrl: process.env.COZE_API_URL || 'https://api.coze.com/v1/chat',
  deepseekApiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions',
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10), // 30 seconds default
  maxRequestSize: parseInt(process.env.MAX_REQUEST_SIZE || '10485760', 10), // 10MB default
};

export function validateConfig() {
  if (!config.deepseekApiKey) {
    throw new Error('DEEPSEEK_API_KEY is required');
  }
  
  if (config.useCoze && !config.cozeApiKey) {
    throw new Error('COZE_API_KEY is required when USE_COZE=true');
  }
  
  return true;
}

