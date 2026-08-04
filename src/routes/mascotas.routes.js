const { Router } = require('express');
const multer = require('multer');
const {
  uploadMascotaFoto,
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

const manejarSubidaFoto = (req, res, next) => {
  const upload = uploadMascotaFoto.single('foto');

  upload(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ mensaje: 'La foto es muy pesada. El límite es de 5 MB.' });
      }

      return res.status(400).json({ mensaje: `Error al subir la imagen: ${error.message}` });
    }

    if (error) {
      if (error.message === 'TIPO_ARCHIVO_INVALIDO') {
        return res.status(400).json({ mensaje: 'Formato no válido. Solo se permiten imágenes JPG, PNG o WEBP.' });
      }

      return res.status(500).json({ mensaje: 'Error desconocido al procesar la imagen.' });
    }

    next();
  });
};

rutasMascotas.post('/', verificarToken, manejarSubidaFoto, registrarMascota);
rutasMascotas.get('/perdidas', obtenerMascotasPerdidas);
rutasMascotas.get('/mis-mascotas', verificarToken, obtenerMisMascotas);
rutasMascotas.get('/buscar', buscarMascotasPorNombre);
rutasMascotas.get('/:id/publico', obtenerPerfilPublico);
rutasMascotas.post('/:id/verificar', verificarAccesoMascota);
rutasMascotas.put('/:id/estado', cambiarEstadoMascota);
rutasMascotas.delete('/:id', verificarToken, borrarMascota);

module.exports = rutasMascotas;