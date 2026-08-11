// check.js
require('dotenv').config();
const { Pool } = require('pg');
console.log('Dotenv cargado. DB_USER:', process.env.DB_USER);

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 5432),
});
console.log('Intentando conectar...');

pool.query('SELECT NOW()')
  .then(res => {
    console.log('✅ Conexión exitosa:', res.rows[0]);
    pool.end();
  })
  .catch(err => {
    console.error('❌ Error de conexión:', err.message);
    pool.end();
  });