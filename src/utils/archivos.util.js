const fs = require('fs');
const path = require('path');

const BASE_UPLOAD_DIR = 'D:/PetMap';

const obtenerLetraDirectorio = (nombre) => {
  const textoNombre = String(nombre || '').trim();

  if (!textoNombre) {
    return 'A';
  }

  const letra = textoNombre.charAt(0).toUpperCase();
  return /^[A-ZÁÉÍÓÚÑ0-9]$/.test(letra) ? letra : 'A';
};

const asegurarDirectorioMascota = (nombre) => {
  const letra = obtenerLetraDirectorio(nombre);
  const directorio = path.join(BASE_UPLOAD_DIR, letra);

  if (!fs.existsSync(directorio)) {
    fs.mkdirSync(directorio, { recursive: true });
  }

  return directorio;
};

module.exports = {
  BASE_UPLOAD_DIR,
  obtenerLetraDirectorio,
  asegurarDirectorioMascota,
};