'use strict';
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { consultarBd } = require('../config/bd.config');

const esCorreoValido = (correo) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
const expContrasena = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const registrarUsuario = async (req, res) => {
  try {
    const { nombre, correo, contrasena } = req.body;

    if (!nombre || typeof nombre !== 'string' || nombre.length > 100) {
      return res.status(400).json({ mensaje: 'Nombre obligatorio (máx 100 caracteres).' });
    }
    if (!correo || typeof correo !== 'string' || correo.length > 255 || !esCorreoValido(correo)) {
      return res.status(400).json({ mensaje: 'Correo obligatorio y válido.' });
    }
    if (!contrasena || typeof contrasena !== 'string' || contrasena.length > 128 || !expContrasena.test(contrasena)) {
      return res.status(400).json({ mensaje: 'Contraseña inválida. Revisa los requisitos de seguridad.' });
    }

    const contrasenaCifrada = await bcrypt.hash(contrasena, 10);
    
    // Se fuerza explícitamente el rol 'usuario' en el INSERT
    const consulta = `INSERT INTO usuarios (nombre, correo, contrasena_hash, rol) VALUES ($1, $2, $3, 'usuario') RETURNING id, nombre, correo, rol;`;
    const resultado = await consultarBd(consulta, [nombre.trim(), correo.trim(), contrasenaCifrada]);

    res.status(201).json({ mensaje: 'Usuario registrado.', usuario: resultado.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ mensaje: 'El correo ya está registrado.' });
    res.status(500).json({ mensaje: 'Error interno al registrar.' });
  }
};

const iniciarSesion = async (req, res) => {
  try {
    const { correo, contrasena } = req.body;
    if (!correo || !contrasena) return res.status(400).json({ mensaje: 'Faltan credenciales.' });

    const resultado = await consultarBd(`SELECT id, correo, contrasena_hash, rol, nombre FROM usuarios WHERE correo = $1 LIMIT 1;`, [correo.trim()]);
    const usuario = resultado.rows[0];

    if (!usuario || !(await bcrypt.compare(contrasena, usuario.contrasena_hash))) {
      return res.status(401).json({ mensaje: 'Credenciales inválidas.' });
    }

    const token = jwt.sign(
      { id: usuario.id, rol: usuario.rol, correo: usuario.correo, nombre: usuario.nombre },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.cookie('petmap_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax', 
      path: '/',
      maxAge: 8 * 60 * 60 * 1000 // 8 horas
    });

    res.status(200).json({
      mensaje: 'Acceso autorizado.',
      usuario: { id: usuario.id, correo: usuario.correo, rol: usuario.rol, nombre: usuario.nombre }
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno al iniciar sesión.' });
  }
};

const obtenerSesionActual = (req, res) => {
  if (!req.usuario) return res.status(401).json({ mensaje: 'No hay sesión activa.' });
  res.status(200).json({ usuario: req.usuario });
};

const cerrarSesion = async (req, res) => {
  const token = req.cookies?.petmap_token;
  if (token) {
    try {
      await consultarBd(`INSERT INTO tokens_bloqueados (token) VALUES ($1) ON CONFLICT DO NOTHING;`, [token]);
    } catch (e) {
      console.error('Error al revocar token:', e.message);
    }
  }
  
  res.clearCookie('petmap_token', { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === 'production', 
    sameSite: 'Lax', 
    path: '/' 
  });
  
  res.status(200).json({ mensaje: 'Sesión cerrada.' });
};

const solicitarRecuperacion = async (req, res) => {
  try {
    const { correo } = req.body;
    if (!correo || !esCorreoValido(correo)) return res.status(400).json({ mensaje: 'Correo inválido.' });

    const tokenPlano = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(tokenPlano).digest('hex');
    const expiracion = new Date(Date.now() + 3600000); // 1 hora

    const resultado = await consultarBd(`UPDATE usuarios SET token_recuperacion = $1, expiracion_recuperacion = $2 WHERE correo = $3 RETURNING id;`, [tokenHash, expiracion, correo]);
    
    if (resultado.rowCount > 0) {
      // Como no hay servicio de emails configurado en backend, imprimimos la ruta completa en consola para que puedas testear.
      const urlFrontend = req.headers['x-forwarded-proto'] || req.protocol;
      const hostFrontend = req.get('host');
      console.log(`\n===========================================`);
      console.log(`[TEST MODO LOCAL] ENLACE DE RECUPERACIÓN:`);
      console.log(`${urlFrontend}://${hostFrontend}/?token=${tokenPlano}`);
      console.log(`===========================================\n`);
    }

    res.status(200).json({ mensaje: 'Si el correo existe, se enviaron las instrucciones.' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al procesar solicitud.' });
  }
};

const restablecerContrasena = async (req, res) => {
  try {
    const { token, nuevaContrasena } = req.body;
    if (!token || !nuevaContrasena || !expContrasena.test(nuevaContrasena)) {
      return res.status(400).json({ mensaje: 'Datos inválidos o contraseña débil.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const resultado = await consultarBd(`SELECT id FROM usuarios WHERE token_recuperacion = $1 AND expiracion_recuperacion > NOW();`, [tokenHash]);
    
    if (resultado.rowCount === 0) return res.status(400).json({ mensaje: 'Token inválido o expirado.' });

    const hashCifrado = await bcrypt.hash(nuevaContrasena, 10);
    await consultarBd(`UPDATE usuarios SET contrasena_hash = $1, token_recuperacion = NULL, expiracion_recuperacion = NULL WHERE id = $2;`, [hashCifrado, resultado.rows[0].id]);
    
    res.status(200).json({ mensaje: 'Contraseña restablecida correctamente.' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno del servidor.' });
  }
};

module.exports = { registrarUsuario, iniciarSesion, obtenerSesionActual, cerrarSesion, solicitarRecuperacion, restablecerContrasena };