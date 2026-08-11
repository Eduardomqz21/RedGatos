const { Router } = require('express');
const { subidaFotoMascota } = require('../controllers/mascotas.controller');
const { registrarMemorial, obtenerMemoriales, encenderVeladora } = require('../controllers/memorial.controller');
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

module.exports = rutasMemorial;