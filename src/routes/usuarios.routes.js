const { Router } = require('express');
const {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
} = require('../controllers/usuarios.controller');
const { verificarToken, verificarRolAdmin } = require('../middlewares/auth.middleware');

const rutasUsuarios = Router();

rutasUsuarios.use(verificarToken, verificarRolAdmin);

rutasUsuarios.get('/', listarUsuarios);
rutasUsuarios.post('/', crearUsuario);
rutasUsuarios.put('/:id', actualizarUsuario);
rutasUsuarios.delete('/:id', eliminarUsuario);

module.exports = rutasUsuarios;