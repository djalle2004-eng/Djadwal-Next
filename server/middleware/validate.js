const { formatV1Error } = require('../../packages/core/src/api-schema.js');

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message
      }));
      const payload = formatV1Error(
        'VALIDATION_FAILED',
        'البيانات المدخلة غير مستوفية للشروط المطلوبة',
        req.traceId || 'unknown',
        details
      );
      return res.status(422).json(payload);
    }
    req.body = result.data;
    next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = result.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message
      }));
      const payload = formatV1Error(
        'VALIDATION_FAILED',
        'معاملات البحث غير صالحة',
        req.traceId || 'unknown',
        details
      );
      return res.status(422).json(payload);
    }
    req.query = result.data;
    next();
  };
}

module.exports = {
  validateBody,
  validateQuery
};

