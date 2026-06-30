const { Pool } = require('pg');

const configuracionPool = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 5432),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

const pool = new Pool(configuracionPool);

// Prueba de conexión automática al iniciar
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error crítico: No se pudo conectar a PostgreSQL.');
    console.error('Revisa tu .env (Usuario, Contraseña, Puerto). Detalle:', err.message);
  } else {
    console.log('✅ Conexión a PostgreSQL (red_gatos_bd) establecida con éxito.');
    release();
  }
});

const consultarBd = (consulta, valores = []) => pool.query(consulta, valores);

module.exports = {
  pool,
  consultarBd,
};