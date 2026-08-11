'use strict';
const jwt = require('jsonwebtoken');
const { consultarBd } = require('../config/bd.config');

const ROLES_ADMIN = new Set(['admin', 'superadmin']);

const verificarToken = async (req, res, next) => {
  const token = req.cookies?.petmap_token;
  
  console.log(`[AUTH] Verificando acceso... (Cookie presente: ${!!token})`);

  if (!token) {
      console.log('❌ Rechazado: Sin token de sesión.');
      return res.status(401).json({ mensaje: 'No autorizado. Sesión no existe.' });
  }

  try {
    const usuario = jwt.verify(token, process.env.JWT_SECRET);
    if (!usuario?.id || !usuario?.rol) throw new Error('TOKEN_INVALIDO');

    const bloqueo = await consultarBd(`SELECT 1 FROM tokens_bloqueados WHERE token = $1 LIMIT 1;`, [token]);
    if (bloqueo.rowCount > 0) throw new Error('TOKEN_REVOCADO');

    req.usuario = usuario;
    console.log(`✅ Sesión confirmada para el usuario: ${usuario.nombre}`);
    next();
  } catch (error) {
    console.log('❌ Rechazado: Token inválido/expirado.');
    res.clearCookie('petmap_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict' });
    res.status(403).json({ mensaje: 'Sesión expirada o revocada.' });
  }
};

const verificarRolAdmin = (req, res, next) => {
  if (!ROLES_ADMIN.has(String(req.usuario?.rol || '').toLowerCase())) {
    return res.status(403).json({ mensaje: 'Acceso denegado. Se requiere nivel de administrador.' });
  }
  next();
};

module.exports = { verificarToken, verificarRolAdmin };