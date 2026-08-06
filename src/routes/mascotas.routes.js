const { Router } = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const {
  subidaFotoMascota,
  registrarMascota, 
  obtenerMascotasPerdidas, 
  obtenerMisMascotas,
  buscarMascotasPorNombre, 
  obtenerPerfilPublico, 
  verificarAccesoMascota,
  cambiarEstadoMascota, 
  borrarMascota,
} = require('../controllers/mascotas.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

const rutasMascotas = Router();

// Límite generoso para lectura pública del mapa, pero bloquea bots agresivos
const limitePeticionesPublicas = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  limit: 250,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiadas peticiones detectadas. Por favor, intenta de nuevo más tarde.' }
});

// Límite estricto para subida de fotos (evita llenar el servidor con basura)
const limiteSubidaArchivos = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  limit: 20, 
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Límite de registros alcanzado. Para evitar spam, intenta más tarde.' }
});

// Anti-Fuerza Bruta: Máximo 5 intentos para adivinar el teléfono de un dueño
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
rutasMascotas.get('/buscar', limitePeticionesPublicas, buscarMascotasPorNombre);
rutasMascotas.get('/:id/publico', limitePeticionesPublicas, obtenerPerfilPublico);
rutasMascotas.post('/:id/verificar', limiteVerificacionPrivada, verificarAccesoMascota);
rutasMascotas.put('/:id/estado', verificarToken, cambiarEstadoMascota);
rutasMascotas.delete('/:id', verificarToken, borrarMascota);

module.exports = rutasMascotas;