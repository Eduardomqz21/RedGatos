const fs = require('fs');
const path = require('path');

const BASE_UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

const obtenerLetraDirectorio = (nombre) => {
  const textoNombre = String(nombre || '').trim();
  if (!textoNombre) return 'A';
  
  const letra = textoNombre.charAt(0).toUpperCase();
  return /^[A-Z0-9]$/i.test(letra) ? letra : 'A';
};

const asegurarDirectorioMascota = (nombre) => {
  const letra = obtenerLetraDirectorio(nombre);
  const directorio = path.join(BASE_UPLOAD_DIR, letra);

  if (!fs.existsSync(directorio)) {
    fs.mkdirSync(directorio, { recursive: true });
  }
  return directorio;
};

const borrarArchivoFisico = (rutaRelativa) => {
  if (!rutaRelativa) return;
  
  const rutaAbsoluta = path.resolve(__dirname, '../../', rutaRelativa.replace(/^\/+/, ''));
  
  // Seguridad Reforzada: Asegurar que el borrado ocurra estrictamente DENTRO de la carpeta permitida
  const baseSegura = path.resolve(BASE_UPLOAD_DIR) + path.sep;
  
  if (rutaAbsoluta.startsWith(baseSegura)) {
    if (fs.existsSync(rutaAbsoluta)) {
      try {
        fs.unlinkSync(rutaAbsoluta);
      } catch (error) {
        console.error(`Error al borrar el archivo físico: ${rutaAbsoluta}`, error);
      }
    }
  } else {
    console.warn(`Intento de borrado fuera del directorio permitido bloqueado: ${rutaAbsoluta}`);
  }
};

module.exports = { BASE_UPLOAD_DIR, obtenerLetraDirectorio, asegurarDirectorioMascota, borrarArchivoFisico };