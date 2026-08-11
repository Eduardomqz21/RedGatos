// src/migrations/migrate.js
'use strict';
require('dotenv').config();
const { pool } = require('../config/bd.config');
const bcrypt = require('bcrypt');

const correrMigraciones = async () => {
  console.log('⏳ Ejecutando migraciones seguras (IF NOT EXISTS)...');
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');

    // NOTA: Se utilizan sentencias seguras. NO DROP TABLES.
    await pool.query(`CREATE TABLE IF NOT EXISTS usuarios ( id UUID PRIMARY KEY ... )`);
    // (AQUÍ PEGA EL RESTO DE TUS TABLAS ORIGINALES DE setup-db.js CON IF NOT EXISTS)

    console.log('✅ Base de datos estructurada con éxito. Sin destrucción.');
  } catch (error) {
    console.error('❌ Error migrando BD:', error.message);
  } finally {
    pool.end();
  }
};

correrMigraciones();