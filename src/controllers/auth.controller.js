const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { consultarBd } = require('../config/bd.config');

const iniciarSesion = async (req, res) => {
  try {
    const { correo, contrasena } = req.body;

    if (!correo || !contrasena) {
      return res.status(400).json({
        mensaje: 'correo y contrasena son obligatorios.',
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        mensaje: 'JWT_SECRET no está configurado en el servidor.',
      });
    }

    const consultaUsuario = `
      SELECT id, correo, contrasena_hash, rol
      FROM usuarios
      WHERE correo = $1
      LIMIT 1;
    `;

    const resultado = await consultarBd(consultaUsuario, [correo]);
    const usuario = resultado.rows[0];

    if (!usuario) {
      return res.status(401).json({
        mensaje: 'Credenciales inválidas.',
      });
    }

    const contrasenaValida = await bcrypt.compare(contrasena, usuario.contrasena_hash);

    if (!contrasenaValida) {
      return res.status(401).json({
        mensaje: 'Credenciales inválidas.',
      });
    }

    const token = jwt.sign(
      {
        id: usuario.id,
        rol: usuario.rol,
        correo: usuario.correo,
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' },
    );

    return res.status(200).json({
      mensaje: 'Inicio de sesión exitoso.',
      token,
      usuario: {
        id: usuario.id,
        correo: usuario.correo,
        rol: usuario.rol,
      },
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al iniciar sesión.',
      error: error.message,
    });
  }
};

module.exports = {
  iniciarSesion,
};