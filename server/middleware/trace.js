const crypto = require('crypto');

/**
 * Attaches request correlation ID and API version headers.
 */
function traceMiddleware(req, res, next) {
  const incomingTraceId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  const traceId = (typeof incomingTraceId === 'string' && incomingTraceId.trim()) 
    ? incomingTraceId.trim() 
    : crypto.randomUUID();

  req.traceId = traceId;
  res.setHeader('X-Request-Id', traceId);
  res.setHeader('API-Version', '1.0.0');

  next();
}

module.exports = {
  traceMiddleware
};

