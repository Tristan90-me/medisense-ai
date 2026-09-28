const { validationResult } = require('express-validator');

// Wraps an array of express-validator chains into a single middleware: runs
// them all, and short-circuits with a 400 on the first failure instead of
// letting bad input reach the controller/DB layer.
const validate = (validations) => async (req, res, next) => {
  await Promise.all(validations.map((v) => v.run(req)));

  const errors = validationResult(req);
  if (errors.isEmpty()) return next();

  res.status(400).json({
    success: false,
    message: errors.array()[0].msg,
    errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
  });
};

module.exports = validate;
