// src/controllers/mascotas.controller.js
const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { consultarBd } = require('../config/bd.config');
const { asegurarDirectorioMascota, borrarArchivoFisico } = require('../utils/archivos.util');
const { construirUrlFrontend, generarQrMascota } = require('../utils/qr.util');
const { cifrarDatos, descifrarDatos } = require('../utils/crypto.util'); // NUEVO

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

const limpiarArchivoTemporal = (ruta) => {
  if (ruta) {
    fs.unlink(ruta, (err) => {
      if (err && err.code !== 'ENOENT') console.error('Error limpiando archivo tmp:', err.message);
    });
  }
};

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

// BE-001: Validación estricta del teléfono
const validarTelefono = (tel) => {
  if (!tel) return true; 
  // Limpiamos todo lo que no sea número y revisamos si quedan al menos 10 dígitos
  const digitos = String(tel).replace(/\D/g, '');
  return digitos.length >= 10;
};

const obtenerMascotaPorId = async (idMascota) => {
  const consultaObtenerMascota = `
    SELECT id, id_usuario, nombre, especie, raza, descripcion, telefono_dueno,
      direccion_dueno, fecha_nacimiento, esta_perdida, idioma_registro,
      foto_url, latitud, longitud, ST_AsGeoJSON(ubicacion)::json AS ubicacion, creado_en
    FROM mascotas WHERE id = $1 LIMIT 1;
  `;
  const resultado = await consultarBd(consultaObtenerMascota, [idMascota]);
  
  if (resultado.rows[0]) {
    // Desciframos la información sensible en memoria solo si se necesita
    resultado.rows[0].telefono_dueno = descifrarDatos(resultado.rows[0].telefono_dueno);
    resultado.rows[0].direccion_dueno = descifrarDatos(resultado.rows[0].direccion_dueno);
  }
  return resultado.rows[0] || null;
};

// SEC-001: Limpieza estricta para el PERFIL PÚBLICO (No PII, No Coordenadas)
const limpiarMascotaParaPerfil = (mascota) => {
  const { telefono_dueno, direccion_dueno, latitud, longitud, ubicacion, id_usuario, ...perfilSeguro } = mascota;
  return perfilSeguro;
};

// Limpieza para el MAPA (Requiere coordenadas, pero NADA de PII)
const limpiarMascotaParaMapa = (mascota) => {
  const { telefono_dueno, direccion_dueno, id_usuario, ...mascotaMapa } = mascota;
  return mascotaMapa;
};

const obtenerPerfilPublico = async (peticion, respuesta) => {
  try {
    const { id } = peticion.params;
    const mascotaEncontrada = await obtenerMascotaPorId(id);

    if (!mascotaEncontrada) {
      return respuesta.status(404).json({ mensaje: 'No se encontró la mascota.' });
    }
    
    return respuesta.status(200).json({ mascota: limpiarMascotaParaPerfil(mascotaEncontrada) });
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

    if (telefono_dueno && !validarTelefono(telefono_dueno)) {
      return respuesta.status(400).json({ mensaje: 'El formato del teléfono es inválido (mínimo 10 dígitos).' });
    }

    const latitudNumerica = obtenerNumeroNulo(latitud);
    const longitudNumerica = obtenerNumeroNulo(longitud);

    let fotoRutaFinal = null;

    if (peticion.file) {
      const directorioBase = asegurarDirectorioMascota(nombre);
      const idUnicoFoto = crypto.randomUUID();
      const nombreArchivoFinal = `${idUnicoFoto}.webp`;
      const rutaAbsoluta = path.join(directorioBase, nombreArchivoFinal);

      await sharp(peticion.file.path)
        .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(rutaAbsoluta);

      // PERF-001: Borrado asíncrono y seguro
      limpiarArchivoTemporal(peticion.file.path);

      const carpetaLetra = path.basename(directorioBase);
      fotoRutaFinal = `/uploads/${carpetaLetra}/${nombreArchivoFinal}`;
    }

    // PRIVACIDAD: Ciframos los datos antes de inyectarlos
    const telefonoCifrado = cifrarDatos(telefono_dueno);
    const direccionCifrada = cifrarDatos(direccion_dueno);

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
      idUsuario, nombre, especie, raza || null, descripcion || null, telefonoCifrado || null,
      direccionCifrada || null, fecha_nacimiento || null, esta_perdida, idioma_registro || null,
      latitudNumerica, longitudNumerica, fotoRutaFinal,
    ];

    const resultado = await consultarBd(consultaInsertar, valoresInsercion);
    const mascotaRegistrada = resultado.rows[0];
    
    // Desciframos solo para el retorno inmediato al dueño (no se va al mapa)
    mascotaRegistrada.telefono_dueno = descifrarDatos(mascotaRegistrada.telefono_dueno);
    mascotaRegistrada.direccion_dueno = descifrarDatos(mascotaRegistrada.direccion_dueno);

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
    if (peticion.file) limpiarArchivoTemporal(peticion.file.path);
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
    // Para el mapa, pasamos limpiarMascotaParaMapa (Elimina PII cifrado, deja Coords)
    const listaMascotas = resultado.rows.map(limpiarMascotaParaMapa);

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
        
        // Desciframos para que el dueño vea sus propios datos
        mascota.telefono_dueno = descifrarDatos(mascota.telefono_dueno);
        mascota.direccion_dueno = descifrarDatos(mascota.direccion_dueno);

        return { ...mascota, url_perfil: urlPerfil, qr_perfil: await generarQrMascota(urlPerfil) };
      })
    );
    return respuesta.status(200).json({ total: misMascotas.length, mascotas: misMascotas });
  } catch (error) {
    return respuesta.status(500).json({ mensaje: 'Error interno.' });
  }
};

const verificarAccesoMascota = async (peticion, respuesta) => {
  try {
    const { id } = peticion.params;
    const { telefono_dueno } = peticion.body;

    const mascotaEncontrada = await obtenerMascotaPorId(id);
    if (!mascotaEncontrada) return respuesta.status(404).json({ mensaje: 'No se encontró.' });
    
    const telefonoDescifrado = mascotaEncontrada.telefono_dueno; // Ya descifrado por obtenerMascotaPorId

    // Comparamos ignorando espacios y símbolos
    const telIngresadoLimpio = String(telefono_dueno || '').replace(/\D/g, '');
    const telRealLimpio = String(telefonoDescifrado || '').replace(/\D/g, '');

    if (telRealLimpio !== telIngresadoLimpio) {
      return respuesta.status(401).json({ mensaje: 'Teléfono incorrecto.' });
    }

    const urlPerfilMascota = construirUrlFrontend(peticion, mascotaEncontrada.id);
    return respuesta.status(200).json({
      mensaje: 'Acceso verificado.',
      mascota: mascotaEncontrada, // Aquí enviamos la mascota completa con el PII descifrado
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

    if (telefono_dueno && !validarTelefono(telefono_dueno)) {
      return respuesta.status(400).json({ mensaje: 'El formato del teléfono es inválido.' });
    }

    const telefonoCifrado = telefono_dueno ? cifrarDatos(telefono_dueno) : null;
    const direccionCifrada = direccion_dueno ? cifrarDatos(direccion_dueno) : null;

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
      telefonoCifrado, direccionCifrada, id
    ]);

    const mascotaActualizada = resultado.rows[0];
    mascotaActualizada.telefono_dueno = descifrarDatos(mascotaActualizada.telefono_dueno);
    mascotaActualizada.direccion_dueno = descifrarDatos(mascotaActualizada.direccion_dueno);

    const urlPerfil = construirUrlFrontend(peticion, mascotaActualizada.id);
    
    return respuesta.status(200).json({
      mensaje: 'Estado actualizado.',
      mascota: mascotaActualizada, // Se envía descifrada a la vista privada del dueño
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
  obtenerMisMascotas, obtenerPerfilPublico,
  verificarAccesoMascota, cambiarEstadoMascota, borrarMascota,
};