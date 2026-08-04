require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const rutasMascotas = require('./src/routes/mascotas.routes');
const rutasAuth = require('./src/routes/auth.routes');
const rutasUsuarios = require('./src/routes/usuarios.routes');
const { BASE_UPLOAD_DIR } = require('./src/utils/archivos.util');
const { inicializarBaseDeDatos } = require('./src/utils/setup-db');

const app = express();
const puerto = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static(path.resolve(BASE_UPLOAD_DIR)));

app.use('/api/mascotas', rutasMascotas);
app.use('/api/auth', rutasAuth);
app.use('/api/usuarios', rutasUsuarios);

app.get('/salud', (_req, res) => {
  res.status(200).json({ mensaje: 'API de RedGatos activa.' });
});

app.use((_req, res) => {
  res.status(404).json({ mensaje: 'Ruta no encontrada.' });
});

if (require.main === module) {
  inicializarBaseDeDatos()
    .then(() => {
      app.listen(puerto, () => {
        // eslint-disable-next-line no-console
        console.log(`Servidor de RedGatos escuchando en el puerto ${puerto}`);
      });
    })
    .catch((error) => {
      console.error('❌ No fue posible inicializar la base de datos antes de iniciar el servidor:', error.message);
      process.exit(1);
    });
}

module.exports = app;