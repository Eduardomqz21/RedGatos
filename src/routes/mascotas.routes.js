'use strict';
const { Router } = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const {
  subidaFotoMascota,
  registrarMascota,
  obtenerTodasMascotasAdmin,
  obtenerMascotasPerdidas, 
  obtenerMisMascotas,
  obtenerPerfilPublico, 
  verificarAccesoMascota,
  cambiarEstadoMascota, 
  borrarMascota,
} = require('../controllers/mascotas.controller');
const { verificarToken, verificarRolAdmin } = require('../middlewares/auth.middleware');

const rutas = Router();

const limitePublico = rateLimit({ windowMs: 10 * 60 * 1000, limit: 300, message: { mensaje: 'Exceso de peticiones públicas.' }});
const limiteSubida = rateLimit({ windowMs: 60 * 60 * 1000, limit: 30, message: { mensaje: 'Límite de registros alcanzado.' }});

const procesarSubida = (req, res, next) => {
  subidaFotoMascota.single('foto')(req, res, (err) => {
    if (err) return res.status(400).json({ mensaje: err.code === 'LIMIT_FILE_SIZE' ? 'La foto supera 5 MB.' : (err.message === 'TIPO_ARCHIVO_INVALIDO' ? 'Formato inválido (JPG/PNG/WEBP)' : 'Error de carga.') });
    next();
  });
};

rutas.post('/', verificarToken, limiteSubida, procesarSubida, registrarMascota);
rutas.get('/perdidas', limitePublico, obtenerMascotasPerdidas);
rutas.get('/mis-mascotas', verificarToken, obtenerMisMascotas);

// RUTA ADMIN GLOBAL PARA LAS TABLAS DE MASCOTAS
rutas.get('/admin/todas', verificarToken, verificarRolAdmin, obtenerTodasMascotasAdmin);

rutas.get('/:id/publico', limitePublico, obtenerPerfilPublico);
rutas.post('/:id/verificar', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }), verificarAccesoMascota);
rutas.put('/:id/estado', verificarToken, cambiarEstadoMascota);
rutas.delete('/:id', verificarToken, borrarMascota);

module.exports = rutas;