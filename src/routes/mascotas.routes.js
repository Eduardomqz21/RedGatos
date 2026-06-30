const { Router } = require('express');
const {
  registrarMascota,
  obtenerMascotasPerdidas,
  buscarMascotasPorNombre,
  verificarAccesoMascota,
  cambiarEstadoMascota,
  borrarMascota,
} = require('../controllers/mascotas.controller');
const { verificarTokenAdmin } = require('../middlewares/auth.middleware');

const rutasMascotas = Router();

rutasMascotas.post('/', registrarMascota);
rutasMascotas.get('/perdidas', obtenerMascotasPerdidas);
rutasMascotas.get('/buscar', buscarMascotasPorNombre);
rutasMascotas.post('/:id/verificar', verificarAccesoMascota);
rutasMascotas.put('/:id/estado', cambiarEstadoMascota);
rutasMascotas.delete('/:id', verificarTokenAdmin, borrarMascota);

module.exports = rutasMascotas;