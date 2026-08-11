const QRCode = require('qrcode');

const construirUrlFrontend = (req, idMascota) => {
  const protocolo = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.get('host');
  return `${protocolo}://${host}/?perfil=${idMascota}`;
};

const generarQrMascota = async (url) => {
  if (!url) throw new Error('La URL de la mascota es obligatoria.');
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    margin: 1,
    scale: 8,
  });
};

module.exports = { construirUrlFrontend, generarQrMascota };