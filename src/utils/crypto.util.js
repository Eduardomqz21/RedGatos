const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY 
  ? Buffer.from(process.env.ENCRYPTION_KEY, 'base64') 
  : crypto.randomBytes(32);

const ALGORITHM = 'aes-256-gcm';

const cifrarDatos = (texto) => {
  if (!texto) return texto;
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(String(texto), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (error) {
    console.error('Error al cifrar datos:', error.message);
    return texto;
  }
};

const descifrarDatos = (textoCifrado) => {
  // Solución: Prevenir fallos con tipos de datos incorrectos
  if (!textoCifrado || typeof textoCifrado !== 'string' || !textoCifrado.includes(':')) {
    return textoCifrado;
  }
  
  try {
    const [ivHex, authTagHex, encryptedHex] = textoCifrado.split(':');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Error al descifrar datos (posible llave incorrecta):', error.message);
    return textoCifrado; 
  }
};

module.exports = { cifrarDatos, descifrarDatos };