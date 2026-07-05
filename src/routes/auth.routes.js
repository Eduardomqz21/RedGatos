const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { registrarUsuario, iniciarSesion } = require('../controllers/auth.controller');

const rutasAuth = Router();

const limiteIntentosLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    mensaje: 'Demasiados intentos de inicio de sesión. Intenta de nuevo más tarde.',
  },
});

rutasAuth.post('/login', limiteIntentosLogin, iniciarSesion);
rutasAuth.post('/registro', registrarUsuario);

module.exports = rutasAuth;