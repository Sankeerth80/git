const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validate, registerValidation, loginValidation } = require('../middleware/validationMiddleware');

// Routes
router.post('/register', validate(registerValidation), authController.register);
router.post('/login', validate(loginValidation), authController.login);
router.post('/google', authController.googleLogin);

module.exports = router;
