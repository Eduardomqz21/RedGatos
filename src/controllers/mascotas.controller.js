const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { consultarBd } = require('../config/bd.config');
const { asegurarDirectorioMascota, borrarArchivoFisico } = require('../utils/archivos.util');
const { construirUrlFrontend, generarQrMascota } = require('../utils/qr.util');

const almacenamientoTemporal = multer.diskStorage({
  destination: (peticion, archivo, callback) => callback(null, os.tmpdir()),
  filename: (peticion, archivo, callback) => callback(null, Date.now() + '-' + crypto.randomBytes(8).toString('hex'))
});

const subidaFotoMascota = multer({
  storage: almacenamientoTemporal,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (peticion, archivo, devolucionLlamada) => {
    const tiposPermitidos = /jpeg|jpg|png|webp/;
    const extensionValida = tiposPermitidos.test(path.extname(archivo.originalname).toLowerCase());
    const tipoMimeValido = tiposPermitidos.test(archivo.mimetype);

    if (extensionValida && tipoMimeValido) {
      return devolucionLlamada(null, true);
    }
    devolucionLlamada(new Error('TIPO_ARCHIVO_INVALIDO'));
  },
});

const convertirBooleano = (valor) => {
  if (typeof valor === 'boolean') return valor;
  if (typeof valor === 'string') return valor.toLowerCase() === 'true';
  return Boolean(valor);
};

const obtenerNumeroNulo = (valor) => {
  if (valor === '' || valor == null) return null;
  const numero = Number(valor);
  return Number.isNaN(numero) ? null : numero;
};

const validarLongitudTexto = (texto, maximo) => {
  if (!texto) return true;
  return String(texto).length <= maximo;
};

const obtenerMascotaPorId = async (idMascota) => {
  const consultaObtenerMascota = `
    SELECT id, id_usuario, nombre, especie, raza, descripcion, telefono_dueno,
      direccion_dueno, fecha_nacimiento, esta_perdida, idioma_registro,
      foto_url, latitud, longitud, ST_AsGeoJSON(ubicacion)::json AS ubicacion, creado_en
    FROM mascotas WHERE id = $1 LIMIT 1;
  `;
  const resultado = await consultarBd(consultaObtenerMascota, [idMascota]);
  return resultado.rows[0] || null;
};

const limpiarMascotaParaRespuesta = (mascota) => {
  if (mascota.esta_perdida === false) {
    const { telefono_dueno, direccion_dueno, ...restoMascota } = mascota;
    return restoMascota;
  }
  return mascota;
};

const obtenerPerfilPublico = async (peticion, respuesta) => {
  try {
    const { id } = peticion.params;
    const mascotaEncontrada = await obtenerMascotaPorId(id);

    if (!mascotaEncontrada) {
      return respuesta.status(404).json({ mensaje: 'No se encontró la mascota.' });
    }
    return respuesta.status(200).json({ mascota: limpiarMascotaParaRespuesta(mascotaEncontrada) });
  } catch (error) {
    return respuesta.status(500).json({ mensaje: 'Error interno del servidor.' });
  }
};

const registrarMascota = async (peticion, respuesta) => {
  try {
    const idUsuario = peticion.usuario?.id;
    const {
      nombre, especie, raza, descripcion, telefono_dueno, direccion_dueno,
      fecha_nacimiento, esta_perdida, latitud, longitud, idioma_registro,
    } = peticion.body;
    const esMascotaPerdida = convertirBooleano(esta_perdida);

    if (!idUsuario) return respuesta.status(401).json({ mensaje: 'No autorizado.' });
    if (!nombre || !especie) return respuesta.status(400).json({ mensaje: 'Nombre y especie obligatorios.' });

    if (!validarLongitudTexto(nombre, 100)) return respuesta.status(400).json({ mensaje: 'Nombre muy largo.' });
    if (!validarLongitudTexto(especie, 50)) return respuesta.status(400).json({ mensaje: 'Especie muy larga.' });
    
    if (esMascotaPerdida && (!telefono_dueno || !direccion_dueno)) {
      return respuesta.status(400).json({ mensaje: 'Teléfono y dirección obligatorios.' });
    }

    const latitudNumerica = obtenerNumeroNulo(latitud);
    const longitudNumerica = obtenerNumeroNulo(longitud);

    let fotoRutaFinal = null;

    if (peticion.file) {
      const directorioBase = asegurarDirectorioMascota(nombre);
      // Seguridad Reforzada: Usar UUID para evitar inyección y colisión en el File System
      const idUnicoFoto = crypto.randomUUID();
      const nombreArchivoFinal = `${idUnicoFoto}.webp`;
      const rutaAbsoluta = path.join(directorioBase, nombreArchivoFinal);

      await sharp(peticion.file.path)
        .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(rutaAbsoluta);

      fs.unlinkSync(peticion.file.path);

      const carpetaLetra = path.basename(directorioBase);
      fotoRutaFinal = `/uploads/${carpetaLetra}/${nombreArchivoFinal}`;
    }

    const consultaInsertar = `
      INSERT INTO mascotas (
        id_usuario, nombre, especie, raza, descripcion, telefono_dueno,
        direccion_dueno, fecha_nacimiento, esta_perdida, idioma_registro,
        latitud, longitud, ubicacion, foto_url
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::boolean, false), $10,
        CASE WHEN $9::boolean = TRUE THEN $11::float ELSE NULL END,
        CASE WHEN $9::boolean = TRUE THEN $12::float ELSE NULL END,
        CASE WHEN $9::boolean = TRUE AND $11::float IS NOT NULL AND $12::float IS NOT NULL
          THEN ST_SetSRID(ST_MakePoint($12, $11), 4326) ELSE NULL END,
        $13
      ) RETURNING *;
    `;

    const valoresInsercion = [
      idUsuario, nombre, especie, raza || null, descripcion || null, telefono_dueno || null,
      direccion_dueno || null, fecha_nacimiento || null, esta_perdida, idioma_registro || null,
      latitudNumerica, longitudNumerica, fotoRutaFinal,
    ];

    const resultado = await consultarBd(consultaInsertar, valoresInsercion);
    const mascotaRegistrada = resultado.rows[0];
    const urlPerfilMascota = construirUrlFrontend(peticion, mascotaRegistrada.id);
    const qrPerfilMascota = await generarQrMascota(urlPerfilMascota);

    return respuesta.status(201).json({
      mensaje: 'Mascota registrada.',
      mascota: mascotaRegistrada,
      url_perfil: urlPerfilMascota,
      qr_perfil: qrPerfilMascota,
      foto_url: fotoRutaFinal,
    });
  } catch (error) {
    if (peticion.file && fs.existsSync(peticion.file.path)) fs.unlinkSync(peticion.file.path);
    return respuesta.status(500).json({ mensaje: 'Error interno al registrar.' });
  }
};

const obtenerMascotasPerdidas = async (peticion, respuesta) => {
  try {
    const { norte, sur, este, oeste, limit, page } = peticion.query;
    const limite = Math.min(parseInt(limit) || 100, 500);
    const desplazamiento = (Math.max(parseInt(page) || 1, 1) - 1) * limite;

    let consultaPerdidas;
    let parametros;

    if (norte && sur && este && oeste) {
      consultaPerdidas = `
        SELECT id, nombre, especie, raza, descripcion, telefono_dueno,
               fecha_nacimiento, esta_perdida, foto_url,
               latitud, longitud, ST_AsGeoJSON(ubicacion)::json AS ubicacion, creado_en
        FROM mascotas
        WHERE esta_perdida = TRUE 
          AND ST_Contains(ST_MakeEnvelope($1, $2, $3, $4, 4326), ubicacion)
        ORDER BY creado_en DESC
        LIMIT $5 OFFSET $6;
      `;
      parametros = [parseFloat(oeste), parseFloat(sur), parseFloat(este), parseFloat(norte), limite, desplazamiento];
    } else {
      consultaPerdidas = `
        SELECT id, nombre, especie, raza, descripcion, telefono_dueno,
               fecha_nacimiento, esta_perdida, foto_url,
               latitud, longitud, ST_AsGeoJSON(ubicacion)::json AS ubicacion, creado_en
        FROM mascotas
        WHERE esta_perdida = TRUE
        ORDER BY creado_en DESC
        LIMIT $1 OFFSET $2;
      `;
      parametros = [limite, desplazamiento];
    }

    const resultado = await consultarBd(consultaPerdidas, parametros);
    const listaMascotas = resultado.rows.map(limpiarMascotaParaRespuesta);

    return respuesta.status(200).json({ total: listaMascotas.length, mascotas: listaMascotas });
  } catch (error) {
    return respuesta.status(500).json({ mensaje: 'Error al obtener mascotas perdidas.' });
  }
};

const obtenerMisMascotas = async (peticion, respuesta) => {
  try {
    const idUsuario = peticion.usuario?.id;
    const resultado = await consultarBd(`SELECT * FROM mascotas WHERE id_usuario = $1 ORDER BY creado_en DESC;`, [idUsuario]);
    
    const misMascotas = await Promise.all(
      resultado.rows.map(async (mascota) => {
        const urlPerfil = construirUrlFrontend(peticion, mascota.id);
        return { ...mascota, url_perfil: urlPerfil, qr_perfil: await generarQrMascota(urlPerfil) };
      })
    );
    return respuesta.status(200).json({ total: misMascotas.length, mascotas: misMascotas });
  } catch (error) {
    return respuesta.status(500).json({ mensaje: 'Error interno.' });
  }
};

const buscarMascotasPorNombre = async (peticion, respuesta) => {
  try {
    const textoBusqueda = String(peticion.query.q || '').trim();
    const limite = Math.min(parseInt(peticion.query.limit) || 50, 100);
    const desplazamiento = (Math.max(parseInt(peticion.query.page) || 1, 1) - 1) * limite;

    const consultaBusqueda = textoBusqueda ? `
      SELECT id, nombre, especie, raza, descripcion, telefono_dueno, direccion_dueno,
             fecha_nacimiento, esta_perdida, foto_url, creado_en
      FROM mascotas WHERE nombre ILIKE $1 OR especie ILIKE $1 OR raza ILIKE $1
      ORDER BY creado_en DESC LIMIT $2 OFFSET $3;
    ` : `
      SELECT id, nombre, especie, raza, descripcion, telefono_dueno, direccion_dueno,
             fecha_nacimiento, esta_perdida, foto_url, creado_en
      FROM mascotas ORDER BY creado_en DESC LIMIT $1 OFFSET $2;
    `;

    const valoresBusqueda = textoBusqueda ? [`%${textoBusqueda}%`, limite, desplazamiento] : [limite, desplazamiento];
    const resultado = await consultarBd(consultaBusqueda, valoresBusqueda);
    return respuesta.status(200).json({ total: resultado.rows.length, mascotas: resultado.rows.map(limpiarMascotaParaRespuesta) });
  } catch (error) {
    return respuesta.status(500).json({ mensaje: 'Error en búsqueda.' });
  }
};

const verificarAccesoMascota = async (peticion, respuesta) => {
  try {
    const { id } = peticion.params;
    const { telefono_dueno } = peticion.body;

    const mascotaEncontrada = await obtenerMascotaPorId(id);
    if (!mascotaEncontrada) return respuesta.status(404).json({ mensaje: 'No se encontró.' });
    if (String(mascotaEncontrada.telefono_dueno || '') !== String(telefono_dueno || '')) {
      return respuesta.status(401).json({ mensaje: 'Teléfono incorrecto.' });
    }

    const urlPerfilMascota = construirUrlFrontend(peticion, mascotaEncontrada.id);
    return respuesta.status(200).json({
      mensaje: 'Acceso verificado.',
      mascota: limpiarMascotaParaRespuesta(mascotaEncontrada),
      url_perfil: urlPerfilMascota,
      qr_perfil: await generarQrMascota(urlPerfilMascota),
    });
  } catch (error) {
    return respuesta.status(500).json({ mensaje: 'Error interno.' });
  }
};

const cambiarEstadoMascota = async (peticion, respuesta) => {
  try {
    const { id } = peticion.params;
    const { telefono_dueno, direccion_dueno, esta_perdida, latitud, longitud } = peticion.body;
    const nuevoEstado = convertirBooleano(esta_perdida);
    
    const mascotaEncontrada = await obtenerMascotaPorId(id);
    if (!mascotaEncontrada) return respuesta.status(404).json({ mensaje: 'Mascota no encontrada.' });

    if (mascotaEncontrada.id_usuario !== peticion.usuario.id && peticion.usuario.rol !== 'superadmin' && peticion.usuario.rol !== 'admin') {
        return respuesta.status(403).json({ mensaje: 'Acceso denegado.' });
    }

    const consultaActualizacion = `
      UPDATE mascotas SET esta_perdida = $1::boolean, telefono_dueno = COALESCE($4, telefono_dueno),
      direccion_dueno = COALESCE($5, direccion_dueno),
      latitud = CASE WHEN $1::boolean = TRUE THEN $2::float ELSE NULL END,
      longitud = CASE WHEN $1::boolean = TRUE THEN $3::float ELSE NULL END,
      ubicacion = CASE WHEN $1::boolean = TRUE AND $2::float IS NOT NULL AND $3::float IS NOT NULL
        THEN ST_SetSRID(ST_MakePoint($3::float, $2::float), 4326) ELSE NULL END
      WHERE id = $6 RETURNING *;
    `;

    const resultado = await consultarBd(consultaActualizacion, [
      nuevoEstado, obtenerNumeroNulo(latitud), obtenerNumeroNulo(longitud),
      telefono_dueno || null, direccion_dueno || null, id
    ]);

    const urlPerfil = construirUrlFrontend(peticion, resultado.rows[0].id);
    return respuesta.status(200).json({
      mensaje: 'Estado actualizado.',
      mascota: limpiarMascotaParaRespuesta(resultado.rows[0]),
      url_perfil: urlPerfil,
      qr_perfil: await generarQrMascota(urlPerfil)
    });
  } catch (error) {
    return respuesta.status(500).json({ mensaje: 'Error al actualizar.' });
  }
};

const borrarMascota = async (peticion, respuesta) => {
  try {
    const { id } = peticion.params;
    const mascotaEncontrada = await obtenerMascotaPorId(id);
    if (!mascotaEncontrada) return respuesta.status(404).json({ mensaje: 'Mascota no encontrada.' });

    if (mascotaEncontrada.id_usuario !== peticion.usuario.id && peticion.usuario.rol !== 'superadmin' && peticion.usuario.rol !== 'admin') {
        return respuesta.status(403).json({ mensaje: 'Acceso denegado.' });
    }

    await consultarBd(`DELETE FROM mascotas WHERE id = $1;`, [id]);
    if (mascotaEncontrada.foto_url) borrarArchivoFisico(mascotaEncontrada.foto_url);

    return respuesta.status(200).json({ mensaje: 'Mascota eliminada.' });
  } catch (error) {
    return respuesta.status(500).json({ mensaje: 'Error al borrar.' });
  }
};

module.exports = {
  subidaFotoMascota, registrarMascota, obtenerMascotasPerdidas,
  obtenerMisMascotas, buscarMascotasPorNombre, obtenerPerfilPublico,
  verificarAccesoMascota, cambiarEstadoMascota, borrarMascota,
};