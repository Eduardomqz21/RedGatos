const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { consultarBd } = require('../config/bd.config');

const esCorreoValido = (correo) => {
  const expresionRegular = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return expresionRegular.test(correo);
};

const registrarUsuario = async (peticion, respuesta) => {
  try {
    const { nombre, correo, contrasena } = peticion.body;

    if (!nombre || typeof nombre !== 'string' || nombre.length > 100) {
      return respuesta.status(400).json({ mensaje: 'El nombre es obligatorio y debe tener máximo 100 caracteres.' });
    }
    if (!correo || typeof correo !== 'string' || correo.length > 255 || !esCorreoValido(correo)) {
      return respuesta.status(400).json({ mensaje: 'El correo es obligatorio, válido y menor a 255 caracteres.' });
    }
    if (!contrasena || typeof contrasena !== 'string' || contrasena.length > 128) {
      return respuesta.status(400).json({ mensaje: 'La contraseña es obligatoria y no debe exceder los 128 caracteres.' });
    }

    const expresionContrasena = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!expresionContrasena.test(contrasena)) {
      return respuesta.status(400).json({
        mensaje: 'La contraseña debe tener mínimo 8 caracteres, mayúsculas, minúsculas, números y un símbolo especial.'
      });
    }

    const contrasenaCifrada = await bcrypt.hash(contrasena, 10);
    const consultaRegistro = `
      INSERT INTO usuarios (nombre, correo, contrasena_hash)
      VALUES ($1, $2, $3)
      RETURNING id, nombre, correo;
    `;
    const resultado = await consultarBd(consultaRegistro, [nombre, correo, contrasenaCifrada]);

    return respuesta.status(201).json({
      mensaje: 'Usuario registrado correctamente.',
      usuario: resultado.rows[0],
    });
  } catch (error) {
    const correoDuplicado = error.code === '23505';
    // Solución SEC-005: No exponer error.message de la base de datos
    return respuesta.status(correoDuplicado ? 409 : 500).json({
      mensaje: correoDuplicado ? 'El correo ya está registrado.' : 'Ocurrió un error interno al registrar el usuario.',
    });
  }
};

const iniciarSesion = async (peticion, respuesta) => {
  try {
    const { correo, contrasena } = peticion.body;

    if (!correo || typeof correo !== 'string' || correo.length > 255) {
      return respuesta.status(400).json({ mensaje: 'El correo es obligatorio y debe tener un formato válido.' });
    }
    if (!contrasena || typeof contrasena !== 'string' || contrasena.length > 128) {
      return respuesta.status(400).json({ mensaje: 'La contraseña es obligatoria.' });
    }

    const consultaUsuario = `SELECT id, correo, contrasena_hash, rol FROM usuarios WHERE correo = $1 LIMIT 1;`;
    const resultado = await consultarBd(consultaUsuario, [correo]);
    const usuarioEncontrado = resultado.rows[0];

    if (!usuarioEncontrado) {
      return respuesta.status(401).json({ mensaje: 'Credenciales inválidas.' });
    }

    const esContrasenaValida = await bcrypt.compare(contrasena, usuarioEncontrado.contrasena_hash);
    if (!esContrasenaValida) {
      return respuesta.status(401).json({ mensaje: 'Credenciales inválidas.' });
    }

    const tokenSesion = jwt.sign(
      { id: usuarioEncontrado.id, rol: usuarioEncontrado.rol, correo: usuarioEncontrado.correo },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    respuesta.cookie('petmap_token', tokenSesion, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 24 * 60 * 60 * 1000
    });

    return respuesta.status(200).json({
      mensaje: 'Inicio de sesión exitoso.',
      usuario: { id: usuarioEncontrado.id, correo: usuarioEncontrado.correo, rol: usuarioEncontrado.rol },
    });
  } catch (error) {
    return respuesta.status(500).json({ mensaje: 'Ocurrió un error interno al iniciar sesión.' });
  }
};

const cerrarSesion = async (peticion, respuesta) => {
  const token = peticion.cookies?.petmap_token;
  
  // Solución ARCH-001: Agregamos el token a la lista negra
  if (token) {
    try {
      const consultaBloqueo = `INSERT INTO tokens_bloqueados (token) VALUES ($1) ON CONFLICT DO NOTHING;`;
      await consultarBd(consultaBloqueo, [token]);
    } catch (e) {
      console.error('Error al revocar token:', e.message);
    }
  }

  respuesta.clearCookie('petmap_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict'
  });
  return respuesta.status(200).json({ mensaje: 'Sesión cerrada y token revocado correctamente.' });
};

const solicitarRecuperacion = async (peticion, respuesta) => {
  try {
    const { correo } = peticion.body;
    if (!correo || !esCorreoValido(correo)) {
      return respuesta.status(400).json({ mensaje: 'Proporciona un correo válido.' });
    }

    const tokenRecuperacionPlano = crypto.randomBytes(32).toString('hex');
    // Solución SEC-003: Ciframos el token con SHA-256 antes de guardarlo en BD
    const tokenRecuperacionHash = crypto.createHash('sha256').update(tokenRecuperacionPlano).digest('hex');
    const fechaExpiracion = new Date(Date.now() + 3600000); 

    const consultaActualizarToken = `
      UPDATE usuarios
      SET token_recuperacion = $1, expiracion_recuperacion = $2
      WHERE correo = $3
      RETURNING id, correo;
    `;
    
    const resultado = await consultarBd(consultaActualizarToken, [tokenRecuperacionHash, fechaExpiracion, correo]);

    // Aquí en un entorno real enviaríamos el correo con 'tokenRecuperacionPlano'.
    return respuesta.status(200).json({ 
      mensaje: 'Si el correo está registrado, se enviarán las instrucciones.' 
    });

  } catch (error) {
    return respuesta.status(500).json({ mensaje: 'Ocurrió un error al procesar la solicitud de recuperación.' });
  }
};

const restablecerContrasena = async (peticion, respuesta) => {
  try {
    const { token, nuevaContrasena } = peticion.body;

    if (!token || !nuevaContrasena) {
      return respuesta.status(400).json({ mensaje: 'El token y la nueva contraseña son obligatorios.' });
    }

    const expresionContrasena = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!expresionContrasena.test(nuevaContrasena)) {
      return respuesta.status(400).json({
        mensaje: 'La contraseña debe tener mínimo 8 caracteres, mayúsculas, minúsculas, números y un símbolo especial.'
      });
    }

    // Hasheamos el token recibido para compararlo con la BD
    const tokenHashBuscado = crypto.createHash('sha256').update(token).digest('hex');

    const consultaBuscarToken = `
      SELECT id FROM usuarios
      WHERE token_recuperacion = $1 AND expiracion_recuperacion > NOW();
    `;
    const resultadoBusqueda = await consultarBd(consultaBuscarToken, [tokenHashBuscado]);

    if (resultadoBusqueda.rowCount === 0) {
      return respuesta.status(400).json({ mensaje: 'El enlace de recuperación es inválido o ha expirado.' });
    }

    const contrasenaCifrada = await bcrypt.hash(nuevaContrasena, 10);
    const consultaActualizarContrasena = `
      UPDATE usuarios
      SET contrasena_hash = $1, token_recuperacion = NULL, expiracion_recuperacion = NULL
      WHERE id = $2;
    `;
    
    await consultarBd(consultaActualizarContrasena, [contrasenaCifrada, resultadoBusqueda.rows[0].id]);

    return respuesta.status(200).json({ mensaje: 'La contraseña ha sido restablecida con éxito.' });
  } catch (error) {
    return respuesta.status(500).json({ mensaje: 'Ocurrió un error al restablecer la contraseña.' });
  }
};

module.exports = { 
  registrarUsuario, 
  iniciarSesion, 
  cerrarSesion, 
  solicitarRecuperacion, 
  restablecerContrasena 
};