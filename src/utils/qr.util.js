const QRCode = require('qrcode');

const generarQrMascota = async (url) => {
  if (!url) {
    throw new Error('La URL de la mascota es obligatoria.');
  }

  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    margin: 1,
    scale: 8,
  });
};

module.exports = {
  generarQrMascota,
};