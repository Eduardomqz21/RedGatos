// src/config/bd.config.js
const { Pool } = require('pg');

// Si el host es localhost, nunca usamos SSL, sin importar si estamos en producción.
// Si es un host externo en producción (ej. AWS, Supabase, Render), sí activará SSL.
const configuracionSsl = (process.env.NODE_ENV === 'production' && process.env.DB_HOST !== 'localhost') 
  ? { rejectUnauthorized: false } 
  : false;

// Solución PERF-002: Optimización del Pool para alta concurrencia
const configuracionPool = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 5432),
  ssl: configuracionSsl,
  // Toma el valor del .env o usa 50 por defecto
  max: Number(process.env.DB_POOL_MAX || 50), 
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT || 30000), 
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT || 5000), 
};

const pool = new Pool(configuracionPool);

// Monitoreo de errores inesperados en clientes inactivos (Evita caída del servidor)
pool.on('error', (err, client) => {
  console.error('[BD ERROR] Error inesperado en el cliente PostgreSQL inactivo:', err.message);
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('[BD CRÍTICO] No se pudo conectar a PostgreSQL.', err.message);
  } else {
    console.log(`✅ Conexión a PostgreSQL establecida y optimizada (Max Pool: ${configuracionPool.max}).`);
    release();
  }
});

const consultarBd = (consulta, valores = []) => pool.query(consulta, valores);

module.exports = {
  pool,
  consultarBd,
};