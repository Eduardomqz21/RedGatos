const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { consultarBd } = require('../config/bd.config');
const { asegurarDirectorioMascota } = require('../utils/archivos.util');
const { construirUrlFrontend, generarQrMascota } = require('../utils/qr.util');

const storageFotosMascotas = multer.diskStorage({
  destination: (req, _file, cb) => {
    try {
      const directorio = asegurarDirectorioMascota(req.body.nombre);
      cb(null, directorio);
    } catch (error) {
      cb(error);
    }
  },
  filename: (_req, file, cb) => {
    const nombreSeguro = String(file.originalname || 'foto').replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${nombreSeguro}`);
  },
});

const uploadMascotaFoto = multer({ storage: storageFotosMascotas });

const convertirBooleano = (valor) => {
  if (typeof valor === 'boolean') {
    return valor;
  }

  if (typeof valor === 'string') {
    return valor.toLowerCase() === 'true';
  }

  return Boolean(valor);
};

const enmascararTelefono = (telefono) => {
  const textoTelefono = String(telefono || '').trim();

  if (!textoTelefono) {
    return '';
  }

  if (textoTelefono.length <= 7) {
    return 'x'.repeat(textoTelefono.length);
  }

  const inicio = textoTelefono.slice(0, 4);
  const final = textoTelefono.slice(-3);
  const enmascarado = 'x'.repeat(Math.max(textoTelefono.length - 7, 0));

  return `${inicio}${enmascarado}${final}`;
};

const obtenerMascotaPorId = async (idMascota) => {
  const consultaMascota = `
    SELECT
      id,
      nombre,
      especie,
      raza,
      descripcion,
      telefono_dueno,
      direccion_dueno,
      esta_perdida,
      idioma_registro,
      foto_url,
      latitud,
      longitud,
      ST_AsGeoJSON(ubicacion)::json AS ubicacion,
      creado_en
    FROM mascotas
    WHERE id = $1
    LIMIT 1;
  `;

  const resultado = await consultarBd(consultaMascota, [idMascota]);
  return resultado.rows[0] || null;
};

const limpiarMascotaParaRespuesta = (mascota) => {
  if (mascota.esta_perdida === false) {
    const { telefono_dueno, direccion_dueno, ...restoMascota } = mascota;
    return restoMascota;
  }

  return mascota;
};

const obtenerPerfilPublico = async (req, res) => {
  try {
    const { id } = req.params;
    const mascota = await obtenerMascotaPorId(id);

    if (!mascota) {
      return res.status(404).json({
        mensaje: 'No se encontró la mascota solicitada.',
      });
    }

    return res.status(200).json({
      mascota: limpiarMascotaParaRespuesta(mascota),
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al obtener el perfil público de la mascota.',
      error: error.message,
    });
  }
};

const registrarMascota = async (req, res) => {
  try {
    const idUsuario = req.usuario?.id;
    const {
      nombre,
      especie,
      raza,
      descripcion,
      telefono_dueno,
      direccion_dueno,
      esta_perdida,
      latitud,
      longitud,
      idioma_registro,
    } = req.body;

    if (!idUsuario) {
      return res.status(401).json({
        mensaje: 'No autorizado. Token faltante o inválido.',
      });
    }

    if (!nombre || !especie || latitud === undefined || longitud === undefined) {
      return res.status(400).json({
        mensaje: 'nombre, especie, latitud y longitud son obligatorios.',
      });
    }

    const latitudNumerica = Number(latitud);
    const longitudNumerica = Number(longitud);

    if (Number.isNaN(latitudNumerica) || Number.isNaN(longitudNumerica)) {
      return res.status(400).json({
        mensaje: 'latitud y longitud deben ser valores numéricos válidos.',
      });
    }

    const fotoUrl = req.file
      ? `/uploads/${path.basename(path.dirname(req.file.path))}/${req.file.filename}`
      : null;

    const consultaInsertarMascota = `
      INSERT INTO mascotas (
        id_usuario,
        nombre,
        especie,
        raza,
        descripcion,
        telefono_dueno,
        direccion_dueno,
        esta_perdida,
        idioma_registro,
        latitud,
        longitud,
        ubicacion,
        foto_url
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        ST_SetSRID(ST_MakePoint($11, $10), 4326),
        $12
      )
      RETURNING
        id,
        id_usuario,
        nombre,
        especie,
        raza,
        descripcion,
        telefono_dueno,
        direccion_dueno,
        esta_perdida,
        idioma_registro,
        foto_url,
        latitud,
        longitud,
        ST_AsGeoJSON(ubicacion)::json AS ubicacion,
        creado_en;
    `;

    const valoresMascota = [
      idUsuario,
      nombre,
      especie,
      raza || null,
      descripcion || null,
      telefono_dueno || null,
      direccion_dueno || null,
      convertirBooleano(esta_perdida),
      idioma_registro || null,
      latitudNumerica,
      longitudNumerica,
      fotoUrl,
    ];

    const resultado = await consultarBd(consultaInsertarMascota, valoresMascota);
    const mascotaRegistrada = resultado.rows[0];
    const urlPerfilMascota = construirUrlFrontend(req, mascotaRegistrada.id);
    const qrPerfilMascota = await generarQrMascota(urlPerfilMascota);

    return res.status(201).json({
      mensaje: 'Mascota registrada correctamente.',
      mascota: mascotaRegistrada,
      url_perfil: urlPerfilMascota,
      qr_perfil: qrPerfilMascota,
      foto_url: fotoUrl,
    });
  } catch (error) {
    // ESTA LÍNEA ES LA CLAVE PARA DEBUGGEAR
    console.error('🚨 [ERROR SQL AL REGISTRAR]:', error);

    return res.status(500).json({
      mensaje: 'Error al registrar la mascota.',
      error: error.message,
    });
  }
};

const obtenerMascotasPerdidas = async (_req, res) => {
  try {
    const consultaObtenerMascotas = `
      SELECT
        id,
        nombre,
        especie,
        raza,
        descripcion,
        telefono_dueno,
        direccion_dueno,
        esta_perdida,
        foto_url,
        latitud,
        longitud,
        ST_AsGeoJSON(ubicacion)::json AS ubicacion,
        creado_en
      FROM mascotas
      WHERE esta_perdida = TRUE
      ORDER BY creado_en DESC;
    `;

    const resultado = await consultarBd(consultaObtenerMascotas);
    const mascotas = resultado.rows.map((mascota) => limpiarMascotaParaRespuesta(mascota));

    return res.status(200).json({
      total: mascotas.length,
      mascotas,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al obtener las mascotas perdidas.',
      error: error.message,
    });
  }
};

const obtenerMisMascotas = async (req, res) => {
  try {
    const idUsuario = req.usuario?.id;

    if (!idUsuario) {
      return res.status(401).json({
        mensaje: 'No autorizado. Token faltante o inválido.',
      });
    }

    const consultaObtenerMisMascotas = `
      SELECT
        id,
        id_usuario,
        nombre,
        especie,
        raza,
        descripcion,
        telefono_dueno,
        direccion_dueno,
        esta_perdida,
        idioma_registro,
        foto_url,
        latitud,
        longitud,
        ST_AsGeoJSON(ubicacion)::json AS ubicacion,
        creado_en
      FROM mascotas
      WHERE id_usuario = $1
      ORDER BY creado_en DESC;
    `;

    const resultado = await consultarBd(consultaObtenerMisMascotas, [idUsuario]);

    return res.status(200).json({
      total: resultado.rows.length,
      mascotas: resultado.rows,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al obtener tus mascotas.',
      error: error.message,
    });
  }
};

const buscarMascotasPorNombre = async (req, res) => {
  try {
    const textoBusqueda = String(req.query.q || '').trim();

    const consultaBuscarMascotas = textoBusqueda
      ? {
          sql: `
            SELECT
              id,
              nombre,
              especie,
              raza,
              descripcion,
              telefono_dueno,
              direccion_dueno,
              esta_perdida,
              foto_url,
              creado_en
            FROM mascotas
            WHERE nombre ILIKE $1
            ORDER BY creado_en DESC;
          `,
          valores: [`%${textoBusqueda}%`],
        }
      : {
          sql: `
            SELECT
              id,
              nombre,
              especie,
              raza,
              descripcion,
              telefono_dueno,
              direccion_dueno,
              esta_perdida,
              foto_url,
              creado_en
            FROM mascotas
            ORDER BY creado_en DESC;
          `,
          valores: [],
        };

    const resultado = await consultarBd(consultaBuscarMascotas.sql, consultaBuscarMascotas.valores);
    const mascotas = resultado.rows.map((mascota) => limpiarMascotaParaRespuesta(mascota));

    return res.status(200).json({
      total: mascotas.length,
      mascotas,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al buscar mascotas por nombre.',
      error: error.message,
    });
  }
};

const verificarAccesoMascota = async (req, res) => {
  try {
    const { id } = req.params;
    const { telefono_dueno } = req.body;

    if (!telefono_dueno) {
      return res.status(400).json({
        mensaje: 'El teléfono es obligatorio para verificar el acceso.',
      });
    }

    const mascota = await obtenerMascotaPorId(id);

    if (!mascota) {
      return res.status(404).json({
        mensaje: 'No se encontró la mascota solicitada.',
      });
    }

    if (String(mascota.telefono_dueno || '') !== String(telefono_dueno || '')) {
      return res.status(401).json({
        mensaje: 'El teléfono proporcionado no coincide con el registro.',
      });
    }

    const urlPerfilMascota = construirUrlPerfilMascota(req, mascota.id);
    const qrPerfilMascota = await generarQrMascota(urlPerfilMascota);

    return res.status(200).json({
      mensaje: 'Acceso verificado correctamente.',
      mascota: limpiarMascotaParaRespuesta(mascota),
      url_perfil: urlPerfilMascota,
      qr_perfil: qrPerfilMascota,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al verificar el acceso de la mascota.',
      error: error.message,
    });
  }
};

const cambiarEstadoMascota = async (req, res) => {
  try {
    const { id } = req.params;
    const { telefono_dueno, esta_perdida } = req.body;

    if (!telefono_dueno) {
      return res.status(400).json({
        mensaje: 'El teléfono es obligatorio para cambiar el estado.',
      });
    }

    const mascota = await obtenerMascotaPorId(id);

    if (!mascota) {
      return res.status(404).json({
        mensaje: 'No se encontró la mascota solicitada.',
      });
    }

    if (String(mascota.telefono_dueno || '') !== String(telefono_dueno || '')) {
      return res.status(401).json({
        mensaje: 'El teléfono proporcionado no coincide con el registro.',
      });
    }

    const nuevoEstado = convertirBooleano(esta_perdida);

    const consultaActualizarEstado = `
      UPDATE mascotas
      SET esta_perdida = $1
      WHERE id = $2
      RETURNING
        id,
        nombre,
        especie,
        raza,
        descripcion,
        telefono_dueno,
        direccion_dueno,
        esta_perdida,
        idioma_registro,
        foto_url,
        latitud,
        longitud,
        ST_AsGeoJSON(ubicacion)::json AS ubicacion,
        creado_en;
    `;

    const resultado = await consultarBd(consultaActualizarEstado, [nuevoEstado, id]);
    const mascotaActualizada = resultado.rows[0];
    const urlPerfilMascota = construirUrlFrontend(req, mascotaActualizada.id);
    const qrPerfilMascota = await generarQrMascota(urlPerfilMascota);

    return res.status(200).json({
      mensaje: 'Estado de la mascota actualizado correctamente.',
      mascota: limpiarMascotaParaRespuesta(mascotaActualizada),
      url_perfil: urlPerfilMascota,
      qr_perfil: qrPerfilMascota,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al cambiar el estado de la mascota.',
      error: error.message,
    });
  }
};

const borrarMascota = async (req, res) => {
  try {
    const { id } = req.params;

    const consultaBorrarMascota = `
      DELETE FROM mascotas
      WHERE id = $1
      RETURNING id, nombre;
    `;

    const resultado = await consultarBd(consultaBorrarMascota, [id]);
    const mascotaEliminada = resultado.rows[0];

    if (!mascotaEliminada) {
      return res.status(404).json({
        mensaje: 'No se encontró la mascota para eliminar.',
      });
    }

    return res.status(200).json({
      mensaje: 'Mascota eliminada correctamente.',
      mascota: mascotaEliminada,
    });
  } catch (error) {
    return res.status(500).json({
      mensaje: 'Error al borrar la mascota.',
      error: error.message,
    });
  }
};

module.exports = {
  uploadMascotaFoto,
  registrarMascota,
  obtenerMascotasPerdidas,
  obtenerMisMascotas,
  buscarMascotasPorNombre,
  obtenerPerfilPublico,
  verificarAccesoMascota,
  cambiarEstadoMascota,
  borrarMascota,
};