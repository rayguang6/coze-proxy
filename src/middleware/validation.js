import { config } from '../config/index.js';

/**
 * Validates request size
 */
export function validateRequestSize(req, res, next) {
  const contentLength = req.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > config.maxRequestSize) {
    return res.status(413).json({
      error: 'Request entity too large',
      details: `Request size exceeds maximum of ${config.maxRequestSize} bytes`
    });
  }
  next();
}

/**
 * Validates request body structure
 */
export function validateRequestBody(req, res, next) {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({
      error: 'Invalid request body',
      details: 'Request body must be a valid JSON object'
    });
  }

  // Check if it's a valid format (either Coze or DeepSeek)
  const hasCozeFormat = req.body.bot_id || req.body.user_id || req.body.additional_messages;
  const hasDeepSeekFormat = req.body.model && Array.isArray(req.body.messages);

  if (!hasCozeFormat && !hasDeepSeekFormat) {
    return res.status(400).json({
      error: 'Invalid payload format',
      details: 'Payload must be in Coze format (bot_id, user_id, additional_messages) or DeepSeek format (model, messages)'
    });
  }

  next();
}

