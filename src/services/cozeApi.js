import { config } from '../config/index.js';

const COZE_API_TIMEOUT = config.requestTimeout;

/**
 * Calls the Coze API with the provided payload
 * @param {Object} payload - Coze format payload
 * @returns {Promise<Response>} - Fetch response
 */
export async function callCozeApi(payload) {
  if (!config.cozeApiKey) {
    throw new Error('Coze API key not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), COZE_API_TIMEOUT);

  try {
    const response = await fetch(config.cozeApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.cozeApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Coze API request timeout');
    }
    throw error;
  }
}

/**
 * Converts Coze SSE stream format to standardized format
 * This maintains compatibility with Chrome extension expectations
 */
export async function handleCozeStreamResponse(apiRes, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // If Coze already returns SSE format compatible with extension, pass through
  // Otherwise, we'll need to transform it
  const reader = apiRes.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
    }
    res.end();
  } catch (error) {
    console.error('Error streaming Coze response:', error);
    res.end();
    throw error;
  }
}

