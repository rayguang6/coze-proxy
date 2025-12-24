import { config, validateConfig } from '../config/index.js';
import { isCozeFormat, isDeepSeekFormat } from '../utils/formatters.js';
import { callCozeApi, handleCozeStreamResponse } from '../services/cozeApi.js';
import { callDeepSeekApi } from '../services/deepseekApi.js';
import { 
  convertDeepSeekStreamToCoze, 
  handleDeepSeekStreamResponse,
  handleNonStreamingResponse 
} from '../services/streamingHandler.js';
import { setCorsHeaders, handleCorsPreflight } from '../middleware/cors.js';

/**
 * Main relay handler - routes requests to Coze or DeepSeek with fallback
 */
export default async function relayHandler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    handleCorsPreflight(req, res);
    return;
  }

  if (req.method !== 'POST') {
    setCorsHeaders(res);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Set CORS headers
  setCorsHeaders(res);

  try {
    // Validate configuration
    validateConfig();
  } catch (configError) {
    return res.status(500).json({
      error: 'Configuration error',
      details: configError.message
    });
  }

  try {
    console.log("Incoming Payload:", JSON.stringify(req.body, null, 2));

    // Detect payload format
    const isCozePayload = isCozeFormat(req.body);
    const isDeepSeekPayload = isDeepSeekFormat(req.body);

    // Handle Coze format payload
    if (isCozePayload) {
      return await handleCozeFormatRequest(req, res);
    }

    // Handle DeepSeek format payload
    if (isDeepSeekPayload) {
      return await handleDeepSeekFormatRequest(req, res);
    }

    // Unknown format (should be caught by validation middleware, but handle just in case)
    return res.status(400).json({
      error: 'Invalid payload format',
      details: 'Payload must be in Coze format (bot_id, user_id, additional_messages) or DeepSeek format (model, messages)'
    });

  } catch (err) {
    console.error('[Proxy Error]', err);
    return res.status(500).json({
      error: 'Proxy Error',
      details: err.message
    });
  }
}

/**
 * Handles Coze format requests
 * Tries Coze API first (if enabled), then falls back to DeepSeek
 */
async function handleCozeFormatRequest(req, res) {
  console.log("Detected Coze format payload");

  const shouldStream = req.body.stream === true;

  // Try Coze API first if enabled
  if (config.useCoze && config.cozeApiKey) {
    try {
      console.log("Attempting Coze API call...");
      const cozeRes = await callCozeApi(req.body);

      if (cozeRes.ok) {
        console.log("Coze API call successful");
        
        if (shouldStream && cozeRes.body) {
          await handleCozeStreamResponse(cozeRes, res);
        } else {
          await handleNonStreamingResponse(cozeRes, res);
        }
        return;
      } else {
        // Coze API returned error status, fallback to DeepSeek
        const errorText = await cozeRes.text();
        console.warn(`Coze API returned error ${cozeRes.status}, falling back to DeepSeek:`, errorText);
      }
    } catch (cozeError) {
      // Coze API call failed, fallback to DeepSeek
      console.warn("Coze API call failed, falling back to DeepSeek:", cozeError.message);
    }
  } else {
    console.log("Coze API not enabled or not configured, using DeepSeek directly");
  }

  // Fallback to DeepSeek (convert Coze format to DeepSeek format)
  console.log("Routing to DeepSeek API (converted from Coze format)");
  try {
    const deepseekRes = await callDeepSeekApi(req.body, true); // true = isCozeFormat

    if (shouldStream && deepseekRes.body) {
      await convertDeepSeekStreamToCoze(deepseekRes, res);
    } else {
      await handleNonStreamingResponse(deepseekRes, res);
    }
  } catch (deepseekError) {
    console.error("DeepSeek API call failed:", deepseekError.message);
    throw deepseekError;
  }
}

/**
 * Handles DeepSeek format requests
 * If USE_COZE=true, tries Coze API first (but this requires converting DeepSeek to Coze format which may not be fully supported)
 * Otherwise, routes directly to DeepSeek
 */
async function handleDeepSeekFormatRequest(req, res) {
  console.log("Detected DeepSeek format payload");

  const shouldStream = req.body.stream === true;

  // For DeepSeek format payloads, we can't easily convert to Coze format
  // because we don't have bot_id, user_id, etc. So we route directly to DeepSeek
  // This maintains simplicity - if you want Coze, send Coze format
  console.log("Routing directly to DeepSeek API (DeepSeek format payload)");
  
  try {
    const deepseekRes = await callDeepSeekApi(req.body, false); // false = not Coze format

    if (shouldStream && deepseekRes.body) {
      await handleDeepSeekStreamResponse(deepseekRes, res);
    } else {
      await handleNonStreamingResponse(deepseekRes, res);
    }
  } catch (deepseekError) {
    console.error("DeepSeek API call failed:", deepseekError.message);
    throw deepseekError;
  }
}

