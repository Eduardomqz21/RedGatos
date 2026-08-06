const jwt = require('jsonwebtoken');
const { consultarBd } = require('../config/bd.config');

const ROLES_ADMIN = new Set(['admin', 'superadmin']);

const verificarToken = async (peticion, respuesta, siguiente) => {
  const token = peticion.cookies?.petmap_token;

  if (!token) {
    return respuesta.status(401).json({
      mensaje: 'No autorizado. La sesión no existe o ha expirado.',
    });
  }

  try {
    // 1. Verificación en memoria (Rápida - falla inmediatamente si fue manipulado)
    const usuarioDecodificado = jwt.verify(token, process.env.JWT_SECRET);

    if (!usuarioDecodificado?.id || !usuarioDecodificado?.rol) {
      return respuesta.status(403).json({ mensaje: 'El token proporcionado no es válido.' });
    }

    // 2. Verificación en base de datos (Lista negra para Logout seguro)
    const consultaBloqueo = 'SELECT 1 FROM tokens_bloqueados WHERE token = $1 LIMIT 1;';
    const resultadoBloqueo = await consultarBd(consultaBloqueo, [token]);
    
    if (resultadoBloqueo.rowCount > 0) {
      throw new Error('TOKEN_REVOCADO');
    }

    peticion.usuario = usuarioDecodificado;
    return siguiente();
  } catch (error) {
    respuesta.clearCookie('petmap_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict'
    });
    
    return respuesta.status(403).json({
      mensaje: 'La sesión ha expirado o ha sido revocada por seguridad.',
    });
  }
};

const verificarRolAdmin = (peticion, respuesta, siguiente) => {
  if (!ROLES_ADMIN.has(String(peticion.usuario?.rol || '').toLowerCase())) {
    return respuesta.status(403).json({
      mensaje: 'Acceso denegado. Se requieren privilegios de administrador para realizar esta acción.',
    });
  }
  return siguiente();
};

module.exports = {
  verificarToken,
  verificarRolAdmin,
};