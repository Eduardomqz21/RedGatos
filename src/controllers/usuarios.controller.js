const bcrypt = require('bcrypt');
const { consultarBd } = require('../config/bd.config');

const ROLES_VALIDOS = new Set(['admin', 'superadmin']);

const normalizarRol = (rol) => {
  const rolNormalizado = String(rol || 'admin').trim().toLowerCase();
  return ROLES_VALIDOS.has(rolNormalizado) ? rolNormalizado : 'admin';
};

const mapearUsuario = (usuario) => ({
  id: usuario.id,
  nombre: usuario.nombre,
  correo: usuario.correo,
  rol: usuario.rol,
  creado_en: usuario.creado_en,
});

const esCorreoValido = (correo) => {
  const expresionRegular = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return expresionRegular.test(correo);
};

const expresionContrasena = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const validarLongitudTexto = (texto, maximo) => {
  if (!texto) return true;
  return String(texto).length <= maximo;
};

const listarUsuarios = async (peticion, respuesta) => {
  try {
    const limite = Math.min(parseInt(peticion.query.limit) || 50, 100);
    const pagina = Math.max(parseInt(peticion.query.page) || 1, 1);
    const desplazamiento = (pagina - 1) * limite;

    const consultaConteo = `SELECT COUNT(*) FROM usuarios;`;
    const resultadoConteo = await consultarBd(consultaConteo);
    const totalUsuarios = parseInt(resultadoConteo.rows[0].count, 10);

    const consulta = `
      SELECT id, nombre, correo, rol, creado_en
      FROM usuarios
      ORDER BY creado_en DESC
      LIMIT $1 OFFSET $2;
    `;
    const resultado = await consultarBd(consulta, [limite, desplazamiento]);

    return respuesta.status(200).json({
      total: totalUsuarios,
      pagina: pagina,
      total_paginas: Math.ceil(totalUsuarios / limite),
      usuarios: resultado.rows.map(mapearUsuario),
    });
  } catch (error) {
    return respuesta.status(500).json({ mensaje: 'Ocurrió un error interno al listar los usuarios.' });
  }
};

const crearUsuario = async (peticion, respuesta) => {
  try {
    const { nombre, correo, contrasena, rol } = peticion.body;

    if (!nombre || !correo || !contrasena) {
      return respuesta.status(400).json({ mensaje: 'El nombre, correo y contraseña son obligatorios.' });
    }

    if (!validarLongitudTexto(nombre, 100)) return respuesta.status(400).json({ mensaje: 'El nombre excede los 100 caracteres.' });
    if (!validarLongitudTexto(correo, 255) || !esCorreoValido(correo)) return respuesta.status(400).json({ mensaje: 'El correo no es válido o excede los 255 caracteres.' });
    if (!validarLongitudTexto(contrasena, 128)) return respuesta.status(400).json({ mensaje: 'La contraseña excede los 128 caracteres.' });

    if (!expresionContrasena.test(contrasena)) {
      return respuesta.status(400).json({
        mensaje: 'La contraseña debe tener mínimo 8 caracteres, incluir mayúsculas, minúsculas, números y al menos un símbolo especial.'
      });
    }

    const rolNormalizado = normalizarRol(rol);
    if (rolNormalizado === 'superadmin' && peticion.usuario?.rol !== 'superadmin') {
        return respuesta.status(403).json({ mensaje: 'Privilegios insuficientes para crear un superadmin.' });
    }

    const contrasenaHash = await bcrypt.hash(contrasena, 10);

    const consulta = `
      INSERT INTO usuarios (nombre, correo, contrasena_hash, rol)
      VALUES ($1, $2, $3, $4)
      RETURNING id, nombre, correo, rol, creado_en;
    `;

    const resultado = await consultarBd(consulta, [nombre, correo, contrasenaHash, rolNormalizado]);

    return respuesta.status(201).json({
      mensaje: 'Usuario creado correctamente.',
      usuario: mapearUsuario(resultado.rows[0]),
    });
  } catch (error) {
    const esCorreoDuplicado = error.code === '23505';
    return respuesta.status(esCorreoDuplicado ? 409 : 500).json({
      mensaje: esCorreoDuplicado ? 'El correo ya está registrado.' : 'Error interno al crear el usuario.',
    });
  }
};

const actualizarUsuario = async (peticion, respuesta) => {
  try {
    const { id } = peticion.params;
    const { nombre, correo, contrasena, rol } = peticion.body;

    // SEC-001: Obtener el usuario objetivo primero para validar jerarquía
    const consultaObjetivo = `SELECT rol FROM usuarios WHERE id = $1 LIMIT 1;`;
    const resObjetivo = await consultarBd(consultaObjetivo, [id]);
    
    if (resObjetivo.rowCount === 0) {
      return respuesta.status(404).json({ mensaje: 'No se encontró el usuario para actualizar.' });
    }

    const usuarioObjetivo = resObjetivo.rows[0];

    // Bloquear si un admin intenta modificar a un superadmin
    if (usuarioObjetivo.rol === 'superadmin' && peticion.usuario?.rol !== 'superadmin') {
      return respuesta.status(403).json({ mensaje: 'Privilegios insuficientes. No puedes modificar la cuenta de un superadmin.' });
    }

    const campos = [];
    const valores = [];

    if (nombre !== undefined) {
      const nombreLimpio = String(nombre).trim();
      if (!nombreLimpio || !validarLongitudTexto(nombreLimpio, 100)) {
          return respuesta.status(400).json({ mensaje: 'El nombre es inválido o excede los 100 caracteres.' });
      }
      campos.push(`nombre = $${valores.length + 1}`);
      valores.push(nombreLimpio);
    }

    if (correo !== undefined) {
      const correoLimpio = String(correo).trim();
      if (!correoLimpio || !validarLongitudTexto(correoLimpio, 255) || !esCorreoValido(correoLimpio)) {
          return respuesta.status(400).json({ mensaje: 'El correo es inválido o excede los 255 caracteres.' });
      }
      campos.push(`correo = $${valores.length + 1}`);
      valores.push(correoLimpio);
    }

    if (contrasena !== undefined && String(contrasena).trim()) {
      if (!validarLongitudTexto(contrasena, 128) || !expresionContrasena.test(contrasena)) {
        return respuesta.status(400).json({
          mensaje: 'La contraseña es inválida. Mínimo 8 caracteres, mayúsculas, minúsculas, números y un símbolo especial.'
        });
      }
      const contrasenaHash = await bcrypt.hash(String(contrasena), 10);
      campos.push(`contrasena_hash = $${valores.length + 1}`);
      valores.push(contrasenaHash);
    }

    if (rol !== undefined) {
      const rolNormalizado = normalizarRol(rol);
      if (rolNormalizado === 'superadmin' && peticion.usuario?.rol !== 'superadmin') {
          return respuesta.status(403).json({ mensaje: 'Privilegios insuficientes para asignar el rol superadmin.' });
      }
      campos.push(`rol = $${valores.length + 1}`);
      valores.push(rolNormalizado);
    }

    if (!campos.length) return respuesta.status(400).json({ mensaje: 'Debes enviar al menos un campo para actualizar.' });

    valores.push(id);
    const consulta = `
      UPDATE usuarios SET ${campos.join(', ')} WHERE id = $${valores.length} RETURNING id, nombre, correo, rol, creado_en;
    `;

    const resultado = await consultarBd(consulta, valores);
    
    return respuesta.status(200).json({
      mensaje: 'Usuario actualizado correctamente.',
      usuario: mapearUsuario(resultado.rows[0]),
    });
  } catch (error) {
    const esCorreoDuplicado = error.code === '23505';
    return respuesta.status(esCorreoDuplicado ? 409 : 500).json({
      mensaje: esCorreoDuplicado ? 'El correo ya está registrado.' : 'Error interno al actualizar el usuario.',
    });
  }
};

const eliminarUsuario = async (peticion, respuesta) => {
  try {
    const { id } = peticion.params;

    if (String(peticion.usuario?.id || '') === String(id)) {
      return respuesta.status(400).json({ mensaje: 'No puedes eliminar tu propia cuenta desde este panel.' });
    }

    const consultaObjetivo = `SELECT id, rol FROM usuarios WHERE id = $1 LIMIT 1;`;
    const usuarioObjetivo = await consultarBd(consultaObjetivo, [id]);
    const filaUsuario = usuarioObjetivo.rows[0];

    if (!filaUsuario) return respuesta.status(404).json({ mensaje: 'No se encontró el usuario para eliminar.' });

    if (filaUsuario.rol === 'superadmin' && peticion.usuario?.rol !== 'superadmin') {
      return respuesta.status(403).json({ mensaje: 'Solo un superadmin puede eliminar otro superadmin.' });
    }

    await consultarBd(`DELETE FROM usuarios WHERE id = $1;`, [id]);

    return respuesta.status(200).json({ mensaje: 'Usuario eliminado correctamente.' });
  } catch (error) {
    return respuesta.status(500).json({ mensaje: 'Ocurrió un error interno al eliminar el usuario.' });
  }
};

module.exports = { listarUsuarios, crearUsuario, actualizarUsuario, eliminarUsuario };