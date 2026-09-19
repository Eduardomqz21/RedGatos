'use strict';
const bcrypt = require('bcrypt');
const { consultarBd } = require('../config/bd.config');

// CORRECCIÓN: Se agrega 'usuario' como un rol válido y predeterminado
const ROLES_VALIDOS = new Set(['usuario', 'admin', 'superadmin']);
const normalizarRol = (rol) => ROLES_VALIDOS.has(String(rol).toLowerCase()) ? String(rol).toLowerCase() : 'usuario';
const expContrasena = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const listarUsuarios = async (req, res) => {
  try {
    const limite = Math.min(parseInt(req.query.limit) || 50, 100);
    const pagina = Math.max(parseInt(req.query.page) || 1, 1);
    const resultado = await consultarBd(`SELECT id, nombre, correo, rol, creado_en FROM usuarios ORDER BY creado_en DESC LIMIT $1 OFFSET $2;`, [limite, (pagina - 1) * limite]);
    const conteo = await consultarBd(`SELECT COUNT(*) FROM usuarios;`);
    
    res.status(200).json({
      total: parseInt(conteo.rows[0].count, 10),
      pagina,
      total_paginas: Math.ceil(conteo.rows[0].count / limite),
      usuarios: resultado.rows
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al listar usuarios.' });
  }
};

const crearUsuario = async (req, res) => {
  try {
    const { nombre, correo, contrasena, rol } = req.body;
    if (!nombre || !correo || !contrasena || !expContrasena.test(contrasena)) {
      return res.status(400).json({ mensaje: 'Datos inválidos o contraseña débil.' });
    }

    const rolNorm = normalizarRol(rol);
    if (rolNorm === 'superadmin' && req.usuario.rol !== 'superadmin') {
      return res.status(403).json({ mensaje: 'Privilegios insuficientes.' });
    }

    const hash = await bcrypt.hash(contrasena, 10);
    const resultado = await consultarBd(`INSERT INTO usuarios (nombre, correo, contrasena_hash, rol) VALUES ($1, $2, $3, $4) RETURNING id, nombre, correo, rol;`, [nombre.trim(), correo.trim(), hash, rolNorm]);
    res.status(201).json({ mensaje: 'Usuario creado.', usuario: resultado.rows[0] });
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 500).json({ mensaje: error.code === '23505' ? 'Correo duplicado.' : 'Error interno.' });
  }
};

const actualizarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const objetivo = await consultarBd(`SELECT rol FROM usuarios WHERE id = $1 LIMIT 1;`, [id]);
    if (!objetivo.rowCount) return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    if (objetivo.rows[0].rol === 'superadmin' && req.usuario.rol !== 'superadmin') return res.status(403).json({ mensaje: 'Intocable para admin estándar.' });

    const { nombre, correo, contrasena, rol } = req.body;
    const campos = [], valores = [];

    if (nombre) { campos.push(`nombre = $${valores.length + 1}`); valores.push(nombre.trim()); }
    if (correo) { campos.push(`correo = $${valores.length + 1}`); valores.push(correo.trim()); }
    
    if (contrasena && contrasena.trim() !== '') {
      if (!expContrasena.test(contrasena)) return res.status(400).json({ mensaje: 'Contraseña inválida. Debe incluir mayúsculas, minúsculas, números y símbolos (mínimo 8 caracteres).' });
      campos.push(`contrasena_hash = $${valores.length + 1}`); 
      valores.push(await bcrypt.hash(contrasena, 10)); 
    }
    if (rol) {
      const rolNorm = normalizarRol(rol);
      if (rolNorm === 'superadmin' && req.usuario.rol !== 'superadmin') return res.status(403).json({ mensaje: 'No autorizado para otorgar superadmin.' });
      campos.push(`rol = $${valores.length + 1}`); valores.push(rolNorm);
    }

    if (!campos.length) return res.status(400).json({ mensaje: 'Nada que actualizar.' });

    valores.push(id);
    const resultado = await consultarBd(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = $${valores.length} RETURNING id, nombre, correo, rol;`, valores);
    res.status(200).json({ mensaje: 'Actualizado.', usuario: resultado.rows[0] });
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 500).json({ mensaje: error.code === '23505' ? 'Correo duplicado.' : 'Error interno.' });
  }
};

const eliminarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.usuario.id) return res.status(400).json({ mensaje: 'No puedes auto-eliminarte aquí.' });
    
    const objetivo = await consultarBd(`SELECT rol FROM usuarios WHERE id = $1 LIMIT 1;`, [id]);
    if (!objetivo.rowCount) return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    if (objetivo.rows[0].rol === 'superadmin' && req.usuario.rol !== 'superadmin') return res.status(403).json({ mensaje: 'Solo un superadmin elimina superadmins.' });

    await consultarBd(`DELETE FROM usuarios WHERE id = $1;`, [id]);
    res.status(200).json({ mensaje: 'Usuario eliminado.' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar.' });
  }
};

module.exports = { listarUsuarios, crearUsuario, actualizarUsuario, eliminarUsuario };