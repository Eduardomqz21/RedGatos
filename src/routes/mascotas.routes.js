const { Router } = require('express');
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

rutasMascotas.post('/', verificarToken, uploadMascotaFoto.single('foto'), registrarMascota);
rutasMascotas.get('/perdidas', obtenerMascotasPerdidas);
rutasMascotas.get('/mis-mascotas', verificarToken, obtenerMisMascotas);
rutasMascotas.get('/buscar', buscarMascotasPorNombre);
rutasMascotas.get('/:id/publico', obtenerPerfilPublico);
rutasMascotas.post('/:id/verificar', verificarAccesoMascota);
rutasMascotas.put('/:id/estado', cambiarEstadoMascota);
rutasMascotas.delete('/:id', verificarToken, borrarMascota);

module.exports = rutasMascotas;