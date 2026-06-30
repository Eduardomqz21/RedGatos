const jwt = require('jsonwebtoken');

const verificarTokenAdmin = (req, res, next) => {
  const encabezadoAutorizacion = req.headers.authorization || '';
  const [esquema, token] = encabezadoAutorizacion.split(' ');

  if (esquema !== 'Bearer' || !token) {
    return res.status(401).json({
      mensaje: 'No autorizado. Token faltante o formato inválido.',
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      mensaje: 'JWT_SECRET no está configurado en el servidor.',
    });
  }

  try {
    const usuario = jwt.verify(token, process.env.JWT_SECRET);

    if (!usuario?.id || !usuario?.rol) {
      return res.status(403).json({
        mensaje: 'Token inválido para acceso administrativo.',
      });
    }

    if (!['admin', 'superadmin'].includes(usuario.rol)) {
      return res.status(403).json({
        mensaje: 'No tienes permisos para acceder a este recurso.',
      });
    }

    req.usuario = usuario;
    return next();
  } catch (error) {
    return res.status(403).json({
      mensaje: 'Token inválido o expirado.',
      error: error.message,
    });
  }
};

module.exports = {
  verificarTokenAdmin,
};