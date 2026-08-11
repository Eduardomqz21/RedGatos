'use strict';
const path = require('path');
const sharp = require('sharp');
const fs = require('fs');
const crypto = require('crypto');
const { consultarBd } = require('../config/bd.config');
const { BASE_UPLOAD_DIR, borrarArchivoFisico } = require('../utils/archivos.util');

const limpiarArchivoTemporal = (ruta) => {
  if (!ruta) return;
  fs.unlink(ruta, (err) => {
    if (err && err.code !== 'ENOENT') console.error('Error limpiando tmp memorial:', err.message);
  });
};

const registrarMemorial = async (req, res) => {
  try {
    const { nombre, especie, raza, fecha_nacimiento, fecha_fallecimiento, mensaje } = req.body;
    if (!nombre || !especie || !fecha_fallecimiento || !mensaje || !req.file) {
      if (req.file) limpiarArchivoTemporal(req.file.path);
      return res.status(400).json({ mensaje: 'Datos y foto obligatorios.' });
    }

    const dirMemorial = path.join(BASE_UPLOAD_DIR, 'memorial');
    if (!fs.existsSync(dirMemorial)) fs.mkdirSync(dirMemorial, { recursive: true });

    const nombreArchivo = `${crypto.randomUUID()}.webp`;
    await sharp(req.file.path).resize(600, 600, { fit: 'cover' }).webp({ quality: 80 }).toFile(path.join(dirMemorial, nombreArchivo));
    limpiarArchivoTemporal(req.file.path);

    const fotoUrl = `/uploads/memorial/${nombreArchivo}`;
    const consulta = `INSERT INTO mascotas_memorial (nombre, especie, raza, fecha_nacimiento, fecha_fallecimiento, mensaje, foto_url) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;`;
    const resultado = await consultarBd(consulta, [nombre, especie, raza || null, fecha_nacimiento || null, fecha_fallecimiento, mensaje, fotoUrl]);

    res.status(201).json({ mensaje: 'Homenaje registrado.', memorial: resultado.rows[0] });
  } catch (error) {
    if (req.file) limpiarArchivoTemporal(req.file.path);
    res.status(500).json({ mensaje: 'Error interno.' });
  }
};

const obtenerMemoriales = async (req, res) => {
  try {
    const resultado = await consultarBd(`SELECT * FROM mascotas_memorial ORDER BY creado_en DESC LIMIT 200;`);
    res.status(200).json({ memoriales: resultado.rows });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener memoriales.' });
  }
};

const encenderVeladora = async (req, res) => {
  try {
    const resultado = await consultarBd(`UPDATE mascotas_memorial SET contador_veladoras = contador_veladoras + 1 WHERE id = $1 RETURNING contador_veladoras;`, [req.params.id]);
    if (resultado.rowCount === 0) return res.status(404).json({ mensaje: 'No encontrado' });
    res.status(200).json({ veladoras: resultado.rows[0].contador_veladoras });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al encender veladora.' });
  }
};

const borrarMemorial = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await consultarBd('SELECT foto_url FROM mascotas_memorial WHERE id = $1', [id]);
    if (!result.rowCount) return res.status(404).json({ mensaje: 'Memorial no encontrado.' });

    await consultarBd('DELETE FROM mascotas_memorial WHERE id = $1', [id]);
    borrarArchivoFisico(result.rows[0].foto_url);

    res.status(200).json({ mensaje: 'Homenaje eliminado correctamente.' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar el memorial.' });
  }
};

module.exports = { registrarMemorial, obtenerMemoriales, encenderVeladora, borrarMemorial };