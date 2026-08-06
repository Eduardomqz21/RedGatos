// src/config/bd.config.js
const { Pool } = require('pg');

const configuracionSsl = process.env.NODE_ENV === 'production' 
  ? { rejectUnauthorized: true } 
  : false;

// Solución PERF-002: Optimización del Pool para alta concurrencia
const configuracionPool = {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 5432),
  ssl: configuracionSsl,
  max: 50, // Límite máximo de clientes en el pool (ajustar según tu RAM y servidor DB)
  idleTimeoutMillis: 30000, // Cierra conexiones inactivas después de 30s
  connectionTimeoutMillis: 5000, // Falla rápido si la DB no responde en 5s
};

const pool = new Pool(configuracionPool);

// Monitoreo de errores inesperados en clientes inactivos (Evita caída del servidor)
pool.on('error', (err, client) => {
  console.error('Error inesperado en el cliente PostgreSQL inactivo', err);
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('Error crítico: No se pudo conectar a PostgreSQL.', err.message);
  } else {
    console.log('✅ Conexión a PostgreSQL establecida y optimizada.');
    release();
  }
});

const consultarBd = (consulta, valores = []) => pool.query(consulta, valores);

module.exports = {
  pool,
  consultarBd,
};