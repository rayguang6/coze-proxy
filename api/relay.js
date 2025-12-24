// Vercel serverless function wrapper
// This file is for Vercel deployment - it wraps the handler from src/handlers/relay.js
import relayHandler from '../src/handlers/relay.js';
import { validateRequestSize, validateRequestBody } from '../src/middleware/validation.js';

/**
 * Vercel serverless function handler
 */
export default async function handler(req, res) {
  // Apply validation middleware
  try {
    // Validate request size
    const contentLength = req.headers['content-length'];
    if (contentLength && parseInt(contentLength, 10) > 10485760) { // 10MB
      return res.status(413).json({
        error: 'Request entity too large',
        details: 'Request size exceeds maximum of 10485760 bytes'
      });
    }

    // Validate request body for non-OPTIONS requests
    if (req.method !== 'OPTIONS' && (!req.body || typeof req.body !== 'object')) {
      return res.status(400).json({
        error: 'Invalid request body',
        details: 'Request body must be a valid JSON object'
      });
    }

    // Call the main handler
    return await relayHandler(req, res);
  } catch (error) {
    console.error('[Vercel Handler Error]', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
