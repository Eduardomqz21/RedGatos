// src/routes/mascotas.routes.js
const { Router } = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const {
  subidaFotoMascota,
  registrarMascota, 
  obtenerMascotasPerdidas, 
  obtenerMisMascotas,
  obtenerPerfilPublico, 
  verificarAccesoMascota,
  cambiarEstadoMascota, 
  borrarMascota,
} = require('../controllers/mascotas.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

const rutasMascotas = Router();

const limitePeticionesPublicas = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 250,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiadas peticiones detectadas. Por favor, intenta de nuevo más tarde.' }
});

const limiteSubidaArchivos = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20, 
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Límite de registros alcanzado. Para evitar spam, intenta más tarde.' }
});

const limiteVerificacionPrivada = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiados intentos de verificación fallidos. Por seguridad, inténtalo en 1 hora.' }
});

const manejarSubidaFoto = (req, res, next) => {
  const upload = subidaFotoMascota.single('foto');
  
  upload(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ mensaje: 'La foto supera el límite de 5 MB.' });
      }
      return res.status(400).json({ mensaje: `Error de carga: ${error.message}` });
    }
    if (error) {
      if (error.message === 'TIPO_ARCHIVO_INVALIDO') {
        return res.status(400).json({ mensaje: 'Formato de imagen no válido. Solo JPG, PNG o WEBP.' });
      }
      return res.status(500).json({ mensaje: 'Error interno al procesar la imagen.' });
    }
    next();
  });
};

rutasMascotas.post('/', verificarToken, limiteSubidaArchivos, manejarSubidaFoto, registrarMascota);
rutasMascotas.get('/perdidas', limitePeticionesPublicas, obtenerMascotasPerdidas);
rutasMascotas.get('/mis-mascotas', verificarToken, obtenerMisMascotas);
rutasMascotas.get('/:id/publico', limitePeticionesPublicas, obtenerPerfilPublico);
rutasMascotas.post('/:id/verificar', limiteVerificacionPrivada, verificarAccesoMascota);
rutasMascotas.put('/:id/estado', verificarToken, cambiarEstadoMascota);
rutasMascotas.delete('/:id', verificarToken, borrarMascota);

module.exports = rutasMascotas;