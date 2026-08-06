const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { 
  registrarUsuario, 
  iniciarSesion, 
  cerrarSesion, 
  solicitarRecuperacion, 
  restablecerContrasena 
} = require('../controllers/auth.controller');

const rutasAuth = Router();

const limiteIntentosLogin = rateLimit({ 
  windowMs: 15 * 60 * 1000, 
  limit: 5, 
  message: { mensaje: 'Demasiados intentos de inicio de sesión.' }
});

const limiteRecuperacion = rateLimit({ 
  windowMs: 60 * 60 * 1000, 
  limit: 3, 
  message: { mensaje: 'Demasiados intentos de recuperación de contraseña.' }
});

rutasAuth.post('/login', limiteIntentosLogin, iniciarSesion);
rutasAuth.post('/registro', registrarUsuario);
rutasAuth.post('/logout', cerrarSesion);

rutasAuth.post('/recuperar', limiteRecuperacion, solicitarRecuperacion);
rutasAuth.post('/resetear', limiteRecuperacion, restablecerContrasena);

module.exports = rutasAuth;