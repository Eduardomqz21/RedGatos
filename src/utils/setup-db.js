'use strict';
require('dotenv').config();
const { pool } = require('../config/bd.config');
const bcrypt = require('bcrypt');

const inicializarBaseDeDatos = async () => {
  console.log('⏳ Configurando Base de Datos de PetMap...');
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre VARCHAR(100), correo VARCHAR(255) UNIQUE NOT NULL,
        contrasena_hash VARCHAR(255) NOT NULL, rol VARCHAR(50) DEFAULT 'admin',
        token_recuperacion VARCHAR(255), expiracion_recuperacion TIMESTAMP,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS mascotas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        id_usuario UUID REFERENCES usuarios(id) ON DELETE CASCADE,
        nombre VARCHAR(100) NOT NULL, especie VARCHAR(50) NOT NULL,
        raza VARCHAR(100), descripcion TEXT,
        telefono_dueno TEXT, direccion_dueno TEXT,
        fecha_nacimiento DATE, esta_perdida BOOLEAN DEFAULT false,
        idioma_registro VARCHAR(10) DEFAULT 'es',
        latitud DOUBLE PRECISION, longitud DOUBLE PRECISION,
        ubicacion GEOMETRY(Point, 4326), foto_url TEXT, curm VARCHAR(50),
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 🔥 SOLUCIÓN CRÍTICA: Convierte las columnas existentes a TEXT si antes eran VARCHAR
    try {
      await pool.query(`ALTER TABLE mascotas ALTER COLUMN telefono_dueno TYPE TEXT;`);
      await pool.query(`ALTER TABLE mascotas ALTER COLUMN direccion_dueno TYPE TEXT;`);
      console.log('✅ Columnas de seguridad ajustadas a TEXT correctamente.');
    } catch (e) {
      console.log('⚠️ Las columnas ya están optimizadas o hubo un ligero desajuste, continuando...');
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS mascotas_memorial (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre VARCHAR(100) NOT NULL, especie VARCHAR(50) NOT NULL,
        raza VARCHAR(100), fecha_nacimiento DATE, fecha_fallecimiento DATE NOT NULL,
        mensaje TEXT NOT NULL, foto_url TEXT NOT NULL,
        contador_veladoras INT DEFAULT 0, creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`CREATE TABLE IF NOT EXISTS tokens_bloqueados (token TEXT PRIMARY KEY, creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`);

    const passAdmin = process.env.ADMIN_PASSWORD || 'admin123';
    const emailAdmin = process.env.ADMIN_EMAIL || 'admin@petmap.com';
    const hashAdmin = await bcrypt.hash(passAdmin, 10);
    await pool.query(`INSERT INTO usuarios (correo, contrasena_hash, rol, nombre) VALUES ($1, $2, 'superadmin', 'Super Admin') ON CONFLICT (correo) DO NOTHING;`, [emailAdmin, hashAdmin]);

    // Índices de rendimiento
    await pool.query(`CREATE INDEX IF NOT EXISTS indice_mascotas_ubicacion ON mascotas USING GIST (ubicacion);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_mascotas_usuario ON mascotas(id_usuario);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_mascotas_nombre_trgm ON mascotas USING GIN (nombre gin_trgm_ops);`);

    console.log('✅ Base de datos estructurada con éxito!');
  } catch (error) {
    console.error('❌ Error configurando BD:', error.message);
  }
};

if (require.main === module) {
  inicializarBaseDeDatos().then(() => pool.end());
}
module.exports = { inicializarBaseDeDatos };