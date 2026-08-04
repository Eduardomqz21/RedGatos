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

const listarUsuarios = async (_req, res) => {
  try {
    const consulta = `
      SELECT id, nombre, correo, rol, creado_en
      FROM usuarios
      ORDER BY creado_en DESC;
    `;

    const resultado = await consultarBd(consulta);

    return res.status(200).json({
      total: resultado.rows.length,
      usuarios: resultado.rows.map(mapearUsuario),
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al listar los usuarios.',
      error: error.message,
    });
  }
};

const crearUsuario = async (req, res) => {
  try {
    const { nombre, correo, contrasena, rol } = req.body;

    if (!nombre || !correo || !contrasena) {
      return res.status(400).json({
        mensaje: 'nombre, correo y contrasena son obligatorios.',
      });
    }

    const contrasenaHash = await bcrypt.hash(contrasena, 10);
    const rolNormalizado = normalizarRol(rol);

    const consulta = `
      INSERT INTO usuarios (nombre, correo, contrasena_hash, rol)
      VALUES ($1, $2, $3, $4)
      RETURNING id, nombre, correo, rol, creado_en;
    `;

    const resultado = await consultarBd(consulta, [nombre, correo, contrasenaHash, rolNormalizado]);

    return res.status(201).json({
      mensaje: 'Usuario creado correctamente.',
      usuario: mapearUsuario(resultado.rows[0]),
    });
  } catch (error) {
    const esCorreoDuplicado = error.code === '23505';

    return res.status(esCorreoDuplicado ? 409 : 500).json({
      mensaje: esCorreoDuplicado ? 'El correo ya está registrado.' : 'Error al crear el usuario.',
      error: error.message,
    });
  }
};

const actualizarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, correo, contrasena, rol } = req.body;

    const campos = [];
    const valores = [];

    if (nombre !== undefined) {
      const nombreLimpio = String(nombre).trim();
      if (!nombreLimpio) {
        return res.status(400).json({ mensaje: 'El nombre no puede estar vacío.' });
      }
      campos.push(`nombre = $${valores.length + 1}`);
      valores.push(nombreLimpio);
    }

    if (correo !== undefined) {
      const correoLimpio = String(correo).trim();
      if (!correoLimpio) {
        return res.status(400).json({ mensaje: 'El correo no puede estar vacío.' });
      }
      campos.push(`correo = $${valores.length + 1}`);
      valores.push(correoLimpio);
    }

    if (contrasena !== undefined && String(contrasena).trim()) {
      const contrasenaHash = await bcrypt.hash(String(contrasena), 10);
      campos.push(`contrasena_hash = $${valores.length + 1}`);
      valores.push(contrasenaHash);
    }

    if (rol !== undefined) {
      campos.push(`rol = $${valores.length + 1}`);
      valores.push(normalizarRol(rol));
    }

    if (!campos.length) {
      return res.status(400).json({
        mensaje: 'Debes enviar al menos un campo para actualizar.',
      });
    }

    valores.push(id);

    const consulta = `
      UPDATE usuarios
      SET ${campos.join(', ')}
      WHERE id = $${valores.length}
      RETURNING id, nombre, correo, rol, creado_en;
    `;

    const resultado = await consultarBd(consulta, valores);
    const usuarioActualizado = resultado.rows[0];

    if (!usuarioActualizado) {
      return res.status(404).json({
        mensaje: 'No se encontró el usuario para actualizar.',
      });
    }

    return res.status(200).json({
      mensaje: 'Usuario actualizado correctamente.',
      usuario: mapearUsuario(usuarioActualizado),
    });
  } catch (error) {
    const esCorreoDuplicado = error.code === '23505';

    return res.status(esCorreoDuplicado ? 409 : 500).json({
      mensaje: esCorreoDuplicado ? 'El correo ya está registrado.' : 'Error al actualizar el usuario.',
      error: error.message,
    });
  }
};

const eliminarUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    if (String(req.usuario?.id || '') === String(id)) {
      return res.status(400).json({
        mensaje: 'No puedes eliminar tu propia cuenta desde este panel.',
      });
    }

    const consultaObjetivo = `
      SELECT id, rol
      FROM usuarios
      WHERE id = $1
      LIMIT 1;
    `;

    const usuarioObjetivo = await consultarBd(consultaObjetivo, [id]);
    const filaUsuario = usuarioObjetivo.rows[0];

    if (!filaUsuario) {
      return res.status(404).json({
        mensaje: 'No se encontró el usuario para eliminar.',
      });
    }

    if (filaUsuario.rol === 'superadmin' && req.usuario?.rol !== 'superadmin') {
      return res.status(403).json({
        mensaje: 'Solo un superadmin puede eliminar otro superadmin.',
      });
    }

    await consultarBd(
      `
        DELETE FROM usuarios
        WHERE id = $1;
      `,
      [id],
    );

    return res.status(200).json({
      mensaje: 'Usuario eliminado correctamente.',
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al eliminar el usuario.',
      error: error.message,
    });
  }
};

module.exports = {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
};