import { config } from '../config/index.js';
import { convertCozeToDeepSeek } from '../utils/formatters.js';

const DEEPSEEK_API_TIMEOUT = config.requestTimeout;

/**
 * Calls the DeepSeek API with the provided payload
 * @param {Object} payload - DeepSeek format payload (or Coze format to be converted)
 * @param {boolean} isCozeFormat - Whether the payload is in Coze format
 * @returns {Promise<Response>} - Fetch response
 */
export async function callDeepSeekApi(payload, isCozeFormat = false) {
  if (!config.deepseekApiKey) {
    throw new Error('DeepSeek API key not configured');
  }

  // Convert Coze format to DeepSeek format if needed
  let deepseekPayload;
  if (isCozeFormat) {
    deepseekPayload = convertCozeToDeepSeek(payload);
    console.log("Converted Coze format to DeepSeek format");
  } else {
    // Already in DeepSeek format
    deepseekPayload = {
      model: payload.model || 'deepseek-chat',
      messages: payload.messages || [],
      stream: payload.stream || false,
      temperature: payload.temperature,
      max_tokens: payload.max_tokens,
    };
  }

  console.log("Calling DeepSeek API with payload:", JSON.stringify(deepseekPayload, null, 2));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEEPSEEK_API_TIMEOUT);

  try {
    const response = await fetch(config.deepseekApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.deepseekApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(deepseekPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('DeepSeek API request timeout');
    }
    throw error;
  }
}

