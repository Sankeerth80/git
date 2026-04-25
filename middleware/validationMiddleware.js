const { body, validationResult } = require('express-validator');

exports.validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    res.status(400).json({
      success: false,
      error: errors.array()[0].msg, // Keep error format simple for frontend compatibility
      code: 'VALIDATION_ERROR'
    });
  };
};

exports.registerValidation = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters')
    .escape(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('email')
    .optional({ checkFalsy: true })
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('phone')
    .optional({ checkFalsy: true })
    .isMobilePhone().withMessage('Invalid phone number format')
];

exports.loginValidation = [
  body('username').trim().notEmpty().withMessage('Username or email is required').escape(),
  body('password').notEmpty().withMessage('Password is required')
];

exports.promoCreateValidation = [
  body('code').optional().trim().escape(),
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 1 }).withMessage('Amount must be greater than 0'),
  body('maxUses')
    .notEmpty().withMessage('Max uses is required')
    .isInt({ min: 1 }).withMessage('Max uses must be at least 1')
];

exports.promoRedeemValidation = [
  body('code').trim().notEmpty().withMessage('Promo code is required').escape()
];

exports.tradeValidation = [
  body('symbol').trim().notEmpty().withMessage('Stock symbol is required').escape().toUpperCase(),
  body('quantity')
    .notEmpty().withMessage('Quantity is required')
    .isFloat({ min: 0.0001 }).withMessage('Quantity must be greater than 0')
];
