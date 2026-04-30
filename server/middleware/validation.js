const { validationResult } = require('express-validator');

function validateRequest(req, res, next) {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return next();
  }

  return res.status(400).json({
    message: 'Validation failed',
    errors: errors.array({ onlyFirstError: true }).map((error) => ({
      field: error.path,
      location: error.location,
      message: error.msg,
    })),
  });
}

module.exports = validateRequest;
