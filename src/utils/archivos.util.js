'use strict';
const fs = require('fs');
const path = require('path');

// Directorio para fotos de mascotas: por variable de entorno o disco independiente /mnt/disco_1tb
const UPLOAD_DIR_MASCOTAS = process.env.UPLOAD_DIR_MASCOTAS || 
  (fs.existsSync('/mnt/disco_1tb') ? '/mnt/disco_1tb/redgatos_uploads/mascotas' : path.join(__dirname, '../../uploads/mascotas'));

// Directorio para fotos del altar / memorial: por variable de entorno o disco independiente /mnt/disco_500gb_1
const UPLOAD_DIR_MEMORIAL = process.env.UPLOAD_DIR_MEMORIAL || 
  (fs.existsSync('/mnt/disco_500gb_1') ? '/mnt/disco_500gb_1/redgatos_uploads/altar' : path.join(__dirname, '../../uploads/memorial'));

// Retrocompatibilidad con código existente
const BASE_UPLOAD_DIR = UPLOAD_DIR_MASCOTAS;

const asegurarDirectorio = (directorio) => {
  if (!fs.existsSync(directorio)) {
    fs.mkdirSync(directorio, { recursive: true });
  }
  return directorio;
};

// Asegurar que existan las raíces de subida al iniciar
asegurarDirectorio(UPLOAD_DIR_MASCOTAS);
asegurarDirectorio(UPLOAD_DIR_MEMORIAL);

const obtenerLetraDirectorio = (nombre) => {
  const textoNombre = String(nombre || '').trim();
  if (!textoNombre) return 'A';
  
  const letra = textoNombre.charAt(0).toUpperCase();
  return /^[A-Z0-9]$/i.test(letra) ? letra : 'A';
};

const asegurarDirectorioMascota = (nombre) => {
  const letra = obtenerLetraDirectorio(nombre);
  const directorio = path.join(UPLOAD_DIR_MASCOTAS, letra);
  return asegurarDirectorio(directorio);
};

const asegurarDirectorioMemorial = () => {
  return asegurarDirectorio(UPLOAD_DIR_MEMORIAL);
};

const borrarArchivoFisico = (rutaRelativa) => {
  if (!rutaRelativa) return;
  const normalizada = String(rutaRelativa).replace(/^\/+/, '');
  
  let rutaAbsoluta = null;
  let baseSegura = null;

  if (normalizada.startsWith('uploads/memorial/')) {
    const subRuta = normalizada.replace(/^uploads\/memorial\//, '');
    rutaAbsoluta = path.resolve(UPLOAD_DIR_MEMORIAL, subRuta);
    baseSegura = path.resolve(UPLOAD_DIR_MEMORIAL) + path.sep;
  } else if (normalizada.startsWith('uploads/mascotas/')) {
    const subRuta = normalizada.replace(/^uploads\/mascotas\//, '');
    rutaAbsoluta = path.resolve(UPLOAD_DIR_MASCOTAS, subRuta);
    baseSegura = path.resolve(UPLOAD_DIR_MASCOTAS) + path.sep;
  } else if (normalizada.startsWith('uploads/')) {
    const subRuta = normalizada.replace(/^uploads\//, '');
    rutaAbsoluta = path.resolve(UPLOAD_DIR_MASCOTAS, subRuta);
    baseSegura = path.resolve(UPLOAD_DIR_MASCOTAS) + path.sep;
  } else {
    // Si la ruta ya es absoluta o relativa a la raíz
    const pruebaAbs = path.resolve(__dirname, '../../', normalizada);
    const baseMascotas = path.resolve(UPLOAD_DIR_MASCOTAS) + path.sep;
    const baseMemorial = path.resolve(UPLOAD_DIR_MEMORIAL) + path.sep;

    if (pruebaAbs.startsWith(baseMascotas)) {
      rutaAbsoluta = pruebaAbs;
      baseSegura = baseMascotas;
    } else if (pruebaAbs.startsWith(baseMemorial)) {
      rutaAbsoluta = pruebaAbs;
      baseSegura = baseMemorial;
    }
  }

  if (rutaAbsoluta && baseSegura && (rutaAbsoluta.startsWith(baseSegura) || rutaAbsoluta === baseSegura.slice(0, -1))) {
    if (fs.existsSync(rutaAbsoluta)) {
      try {
        fs.unlinkSync(rutaAbsoluta);
      } catch (error) {
        console.error(`Error al borrar archivo físico: ${rutaAbsoluta}`, error.message);
      }
    }
  } else {
    console.warn(`Intento de borrado bloqueado (fuera de límites permitidos): ${rutaRelativa}`);
  }
};

module.exports = {
  UPLOAD_DIR_MASCOTAS,
  UPLOAD_DIR_MEMORIAL,
  BASE_UPLOAD_DIR,
  obtenerLetraDirectorio,
  asegurarDirectorioMascota,
  asegurarDirectorioMemorial,
  borrarArchivoFisico
};
