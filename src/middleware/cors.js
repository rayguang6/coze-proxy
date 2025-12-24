/**
 * CORS middleware - sets CORS headers for all requests
 */
export function setCorsHeaders(res) {
  // TODO: In production, replace '*' with specific allowed origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/**
 * Handles CORS preflight requests
 */
export function handleCorsPreflight(req, res) {
  setCorsHeaders(res);
  res.status(200).end();
}

