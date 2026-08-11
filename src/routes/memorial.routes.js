const { Router } = require('express');
const { subidaFotoMascota } = require('../controllers/mascotas.controller');
const { registrarMemorial, obtenerMemoriales, encenderVeladora, borrarMemorial } = require('../controllers/memorial.controller');
const { verificarToken, verificarRolAdmin } = require('../middlewares/auth.middleware');
const rateLimit = require('express-rate-limit');

const rutasMemorial = Router();

const limiteVeladoras = rateLimit({
  windowMs: 15 * 60 * 1000, 
  limit: 20, 
  message: { mensaje: 'Demasiadas veladoras por ahora.' }
});

rutasMemorial.get('/', obtenerMemoriales);
rutasMemorial.post('/', subidaFotoMascota.single('foto'), registrarMemorial);
rutasMemorial.post('/:id/veladora', limiteVeladoras, encenderVeladora);

// CORRECCIÓN: Ruta de eliminación de Memorial añadida y protegida
rutasMemorial.delete('/:id', verificarToken, verificarRolAdmin, borrarMemorial);

module.exports = rutasMemorial;