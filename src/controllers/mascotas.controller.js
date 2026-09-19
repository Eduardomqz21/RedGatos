'use strict';
const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { consultarBd } = require('../config/bd.config');
const { asegurarDirectorioMascota, borrarArchivoFisico } = require('../utils/archivos.util');
const { construirUrlFrontend, generarQrMascota } = require('../utils/qr.util');
const { cifrarDatos, descifrarDatos } = require('../utils/crypto.util');

const almacenamientoTemporal = multer.diskStorage({
  destination: (req, file, cb) => cb(null, os.tmpdir()),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`)
});

const subidaFotoMascota = multer({
  storage: almacenamientoTemporal,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const permitidos = /jpeg|jpg|png|webp/;
    if (permitidos.test(path.extname(file.originalname).toLowerCase()) && permitidos.test(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('TIPO_ARCHIVO_INVALIDO'));
  }
});

const limpiarArchivoTemporal = (ruta) => {
  if (!ruta) return;
  fs.unlink(ruta, (err) => {
    if (err && err.code !== 'ENOENT') console.error('Error al limpiar archivo temporal:', err.message);
  });
};

const limpiarMascotaParaPerfil = ({ ubicacion, id_usuario, ...seguro }) => {
  if (!seguro.esta_perdida) {
    delete seguro.telefono_dueno;
    delete seguro.direccion_dueno;
    delete seguro.latitud;
    delete seguro.longitud;
  } else {
    seguro.telefono_dueno = descifrarDatos(seguro.telefono_dueno) || '';
    seguro.direccion_dueno = descifrarDatos(seguro.direccion_dueno) || '';
  }
  return seguro;
};
const limpiarMascotaParaMapa = (m) => {
  const { id_usuario, ubicacion, ...mapa } = m;
  if (m.esta_perdida) {
    mapa.telefono_dueno = descifrarDatos(m.telefono_dueno) || '';
    mapa.direccion_dueno = descifrarDatos(m.direccion_dueno) || '';
  } else {
    delete mapa.telefono_dueno;
    delete mapa.direccion_dueno;
  }
  return mapa;
};

const registrarMascota = async (req, res) => {
  try {
    const idUsuario = req.usuario?.id;
    const { nombre, especie, raza, descripcion, telefono_dueno, direccion_dueno, fecha_nacimiento, esta_perdida, latitud, longitud, idioma_registro } = req.body;
    const perdida = esta_perdida === 'true' || esta_perdida === true;

    if (!idUsuario) return res.status(401).json({ mensaje: 'No autorizado.' });
    if (!nombre || !especie) return res.status(400).json({ mensaje: 'Nombre y especie obligatorios.' });
    if (perdida && (!telefono_dueno || !direccion_dueno)) return res.status(400).json({ mensaje: 'Teléfono y dirección obligatorios.' });

    let fotoRutaFinal = null;
    if (req.file) {
      const dirBase = asegurarDirectorioMascota(nombre);
      const nombreArchivo = `${crypto.randomUUID()}.webp`;
      await sharp(req.file.path).resize(800, 800, { fit: 'inside' }).webp({ quality: 80 }).toFile(path.join(dirBase, nombreArchivo));
      fotoRutaFinal = `/uploads/${path.basename(dirBase)}/${nombreArchivo}`;
    }

    const latNum = (perdida && latitud) ? Number(latitud) : null;
    const lonNum = (perdida && longitud) ? Number(longitud) : null;
    
    const telefonoCifrado = cifrarDatos(telefono_dueno);
    const direccionCifrada = cifrarDatos(direccion_dueno);
    
    const consulta = `
      INSERT INTO mascotas (
        id_usuario, nombre, especie, raza, descripcion, telefono_dueno, direccion_dueno, 
        fecha_nacimiento, esta_perdida, idioma_registro, latitud, longitud, ubicacion, foto_url
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::double precision, $12::double precision, 
        CASE WHEN $9 = TRUE AND $11 IS NOT NULL AND $12 IS NOT NULL 
          THEN ST_SetSRID(ST_MakePoint($12::double precision, $11::double precision), 4326) 
          ELSE NULL 
        END, 
        $13
      )
      RETURNING *;
    `;
    
    const valores = [
      idUsuario, nombre, especie, raza || null, descripcion || null, 
      telefonoCifrado, direccionCifrada, fecha_nacimiento || null, 
      perdida, idioma_registro || 'es', latNum, lonNum, fotoRutaFinal
    ];
    
    const resultado = await consultarBd(consulta, valores);
    const mascota = resultado.rows[0];
    
    mascota.telefono_dueno = descifrarDatos(mascota.telefono_dueno);
    mascota.direccion_dueno = descifrarDatos(mascota.direccion_dueno);

    const url = construirUrlFrontend(req, mascota.id);
    res.status(201).json({ mensaje: 'Registrada.', mascota, url_perfil: url, qr_perfil: await generarQrMascota(url), foto_url: fotoRutaFinal });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al registrar mascota.' });
  } finally {
    if (req.file) limpiarArchivoTemporal(req.file.path);
  }
};

const obtenerPerfilPublico = async (req, res) => {
  try {
    const result = await consultarBd('SELECT * FROM mascotas WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ mensaje: 'No encontrada.' });
    res.status(200).json({ mascota: limpiarMascotaParaPerfil(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error del servidor.' });
  }
};

const obtenerMisMascotas = async (req, res) => {
  try {
    const result = await consultarBd('SELECT * FROM mascotas WHERE id_usuario = $1 ORDER BY creado_en DESC', [req.usuario.id]);
    const mascotas = await Promise.all(result.rows.map(async m => {
      m.telefono_dueno = descifrarDatos(m.telefono_dueno);
      m.direccion_dueno = descifrarDatos(m.direccion_dueno);
      const url = construirUrlFrontend(req, m.id);
      return { ...m, url_perfil: url, qr_perfil: await generarQrMascota(url) };
    }));
    res.status(200).json({ total: mascotas.length, mascotas });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno.' });
  }
};

const obtenerTodasMascotasAdmin = async (req, res) => {
  try {
    // Solución: Traemos todos los campos y creamos un nuevo objeto seguro al iterar
    const result = await consultarBd('SELECT * FROM mascotas ORDER BY creado_en DESC LIMIT 500');
    const mascotas = result.rows.map(m => {
      return {
        ...m,
        telefono_dueno: descifrarDatos(m.telefono_dueno) || '',
        direccion_dueno: descifrarDatos(m.direccion_dueno) || ''
      };
    });
    res.status(200).json({ mascotas });
  } catch (error) {
    console.error("Error Admin Mascotas:", error);
    res.status(500).json({ mensaje: 'Error al obtener lista global de mascotas.' });
  }
};

const obtenerMascotasPerdidas = async (req, res) => {
  try {
    const limite = Math.min(parseInt(req.query.limit) || 100, 500);
    const { norte, sur, este, oeste } = req.query;
    let consulta = 'SELECT * FROM mascotas WHERE esta_perdida = TRUE ORDER BY creado_en DESC LIMIT $1';
    let params = [limite];

    if (norte && sur && este && oeste) {
      consulta = 'SELECT * FROM mascotas WHERE esta_perdida = TRUE AND ST_Contains(ST_MakeEnvelope($1, $2, $3, $4, 4326), ubicacion) ORDER BY creado_en DESC LIMIT $5';
      params = [parseFloat(oeste), parseFloat(sur), parseFloat(este), parseFloat(norte), limite];
    }
    
    const result = await consultarBd(consulta, params);
    res.status(200).json({ total: result.rowCount, mascotas: result.rows.map(limpiarMascotaParaMapa) });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener datos.' });
  }
};

const cambiarEstadoMascota = async (req, res) => {
  try {
    const { id } = req.params;
    const { telefono_dueno, direccion_dueno, esta_perdida, latitud, longitud } = req.body;
    const esPerdida = esta_perdida === true || esta_perdida === 'true';

    const mascota = await consultarBd('SELECT id_usuario FROM mascotas WHERE id = $1', [id]);
    if (!mascota.rowCount) return res.status(404).json({ mensaje: 'No encontrada.' });
    if (mascota.rows[0].id_usuario !== req.usuario.id && !['admin', 'superadmin'].includes(req.usuario.rol)) {
      return res.status(403).json({ mensaje: 'Denegado.' });
    }

    const telCifrado = telefono_dueno ? cifrarDatos(telefono_dueno) : null;
    const dirCifrada = direccion_dueno ? cifrarDatos(direccion_dueno) : null;

    const consulta = `
      UPDATE mascotas SET esta_perdida = $1, telefono_dueno = COALESCE($2, telefono_dueno), direccion_dueno = COALESCE($3, direccion_dueno),
      latitud = CASE WHEN $1 THEN $4::float ELSE NULL END, longitud = CASE WHEN $1 THEN $5::float ELSE NULL END,
      ubicacion = CASE WHEN $1 AND $4 IS NOT NULL THEN ST_SetSRID(ST_MakePoint($5, $4), 4326) ELSE NULL END
      WHERE id = $6 RETURNING *;
    `;
    const result = await consultarBd(consulta, [esPerdida, telCifrado, dirCifrada, latitud ? Number(latitud) : null, longitud ? Number(longitud) : null, id]);
    
    const m = result.rows[0];
    m.telefono_dueno = descifrarDatos(m.telefono_dueno);
    m.direccion_dueno = descifrarDatos(m.direccion_dueno);
    
    res.status(200).json({ mensaje: 'Actualizado.', mascota: m, url_perfil: construirUrlFrontend(req, id) });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar.' });
  }
};

const verificarAccesoMascota = async (req, res) => {
  try {
    const result = await consultarBd('SELECT * FROM mascotas WHERE id = $1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ mensaje: 'No encontrada.' });

    const mascota = result.rows[0];
    const telReal = descifrarDatos(mascota.telefono_dueno) || '';
    const telIngresado = String(req.body.telefono_dueno || '').replace(/\D/g, '');
    
    if (telReal.replace(/\D/g, '') !== telIngresado) return res.status(401).json({ mensaje: 'Teléfono incorrecto.' });
    
    mascota.telefono_dueno = telReal;
    mascota.direccion_dueno = descifrarDatos(mascota.direccion_dueno);
    res.status(200).json({ mensaje: 'Verificado.', mascota });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error interno.' });
  }
};

const borrarMascota = async (req, res) => {
  try {
    const result = await consultarBd('SELECT id_usuario, foto_url FROM mascotas WHERE id = $1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ mensaje: 'No encontrada.' });
    
    if (result.rows[0].id_usuario !== req.usuario.id && !['admin', 'superadmin'].includes(req.usuario.rol)) {
      return res.status(403).json({ mensaje: 'Denegado.' });
    }

    await consultarBd('DELETE FROM mascotas WHERE id = $1', [req.params.id]);
    borrarArchivoFisico(result.rows[0].foto_url);
    res.status(200).json({ mensaje: 'Eliminada.' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al borrar.' });
  }
};

const actualizarMascotaAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, especie, raza, descripcion } = req.body;
    
    const result = await consultarBd(
      `UPDATE mascotas SET 
        nombre = COALESCE($1, nombre), 
        especie = COALESCE($2, especie), 
        raza = COALESCE($3, raza), 
        descripcion = COALESCE($4, descripcion) 
       WHERE id = $5 RETURNING *;`,
      [nombre ? nombre.trim() : null, especie ? especie.trim() : null, raza ? raza.trim() : null, descripcion ? descripcion.trim() : null, id]
    );

    if (!result.rowCount) return res.status(404).json({ mensaje: 'Mascota no encontrada.' });
    res.status(200).json({ mensaje: 'Mascota actualizada correctamente.', mascota: result.rows[0] });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar la mascota.' });
  }
};

module.exports = { subidaFotoMascota, registrarMascota, obtenerTodasMascotasAdmin, obtenerMascotasPerdidas, obtenerMisMascotas, obtenerPerfilPublico, verificarAccesoMascota, cambiarEstadoMascota, borrarMascota, actualizarMascotaAdmin };