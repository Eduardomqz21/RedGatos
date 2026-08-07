// src/controllers/memorial.controller.js
const { consultarBd } = require('../config/bd.config');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs');
const crypto = require('crypto');
const { BASE_UPLOAD_DIR } = require('../utils/archivos.util');

const limpiarArchivoTemporal = (ruta) => {
  if (ruta) {
    fs.unlink(ruta, (err) => {
      if (err && err.code !== 'ENOENT') console.error('Error limpiando archivo tmp memorial:', err.message);
    });
  }
};

const registrarMemorial = async (peticion, respuesta) => {
  try {
    const { nombre, especie, raza, fecha_nacimiento, fecha_fallecimiento, mensaje } = peticion.body;

    if (!nombre || !especie || !fecha_fallecimiento || !mensaje) {
      return respuesta.status(400).json({ mensaje: 'Faltan datos obligatorios para el memorial.' });
    }

    let fotoRutaFinal = null;

    if (peticion.file) {
      // Carpeta independiente para el memorial
      const directorioMemorial = path.join(BASE_UPLOAD_DIR, 'memorial');
      if (!fs.existsSync(directorioMemorial)) fs.mkdirSync(directorioMemorial, { recursive: true });

      const idUnicoFoto = crypto.randomUUID();
      const nombreArchivoFinal = `${idUnicoFoto}.webp`;
      const rutaAbsoluta = path.join(directorioMemorial, nombreArchivoFinal);

      await sharp(peticion.file.path)
        .resize({ width: 600, height: 600, fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(rutaAbsoluta);

      limpiarArchivoTemporal(peticion.file.path);
      fotoRutaFinal = `/uploads/memorial/${nombreArchivoFinal}`;
    } else {
      return respuesta.status(400).json({ mensaje: 'Una foto es obligatoria para el memorial.' });
    }

    const consulta = `
      INSERT INTO mascotas_memorial (
        nombre, especie, raza, fecha_nacimiento, fecha_fallecimiento, mensaje, foto_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;
    `;
    const valores = [nombre, especie, raza || null, fecha_nacimiento || null, fecha_fallecimiento, mensaje, fotoRutaFinal];
    const resultado = await consultarBd(consulta, valores);

    return respuesta.status(201).json({ mensaje: 'Homenaje registrado.', memorial: resultado.rows[0] });
  } catch (error) {
    if (peticion.file) limpiarArchivoTemporal(peticion.file.path);
    return respuesta.status(500).json({ mensaje: 'Error al crear memorial.' });
  }
};

const obtenerMemoriales = async (peticion, respuesta) => {
  try {
    const consulta = `SELECT * FROM mascotas_memorial ORDER BY creado_en DESC LIMIT 200;`;
    const resultado = await consultarBd(consulta);
    return respuesta.status(200).json({ memoriales: resultado.rows });
  } catch (error) {
    return respuesta.status(500).json({ mensaje: 'Error al obtener memoriales.' });
  }
};

const encenderVeladora = async (peticion, respuesta) => {
  try {
    const { id } = peticion.params;
    const consulta = `UPDATE mascotas_memorial SET contador_veladoras = contador_veladoras + 1 WHERE id = $1 RETURNING contador_veladoras;`;
    const resultado = await consultarBd(consulta, [id]);
    
    if (resultado.rowCount === 0) return respuesta.status(404).json({ mensaje: 'No encontrado' });
    
    return respuesta.status(200).json({ veladoras: resultado.rows[0].contador_veladoras });
  } catch (error) {
    return respuesta.status(500).json({ mensaje: 'Error al enviar homenaje.' });
  }
};

module.exports = { registrarMemorial, obtenerMemoriales, encenderVeladora };