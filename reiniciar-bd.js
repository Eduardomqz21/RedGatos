// reiniciar-base.js
'use strict';
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 5432),
  // Quitar SSL si no se necesita (producción con certificado)
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
});

(async () => {
  console.log('🚀 Reinicio total de la base de datos de PetMap...\n');

  try {
    // 1. Activar extensiones necesarias
    await pool.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
    console.log('✅ Extensiones cargadas.');

    // 2. Eliminar tablas existentes (en orden inverso de dependencias)
    console.log('🧹 Eliminando tablas antiguas...');
    await pool.query('DROP TABLE IF EXISTS tokens_bloqueados CASCADE;');
    await pool.query('DROP TABLE IF EXISTS mascotas_memorial CASCADE;');
    await pool.query('DROP TABLE IF EXISTS mascotas CASCADE;');
    await pool.query('DROP TABLE IF EXISTS usuarios CASCADE;');
    console.log('   Tablas eliminadas.');

    // 3. Crear tabla de usuarios
    await pool.query(`
      CREATE TABLE usuarios (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre VARCHAR(100),
        correo VARCHAR(255) UNIQUE NOT NULL,
        contrasena_hash VARCHAR(255) NOT NULL,
        rol VARCHAR(50) DEFAULT 'admin',
        token_recuperacion VARCHAR(255),
        expiracion_recuperacion TIMESTAMP,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabla usuarios creada.');

    // 4. Crear tabla de mascotas (con columnas TEXT para cifrado)
    await pool.query(`
      CREATE TABLE mascotas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        id_usuario UUID REFERENCES usuarios(id) ON DELETE CASCADE,
        nombre VARCHAR(100) NOT NULL,
        especie VARCHAR(50) NOT NULL,
        raza VARCHAR(100),
        descripcion TEXT,
        telefono_dueno TEXT,
        direccion_dueno TEXT,
        fecha_nacimiento DATE,
        esta_perdida BOOLEAN DEFAULT false,
        idioma_registro VARCHAR(10) DEFAULT 'es',
        latitud DOUBLE PRECISION,
        longitud DOUBLE PRECISION,
        ubicacion GEOMETRY(Point, 4326),
        foto_url TEXT,
        curm VARCHAR(50),
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabla mascotas creada.');

    // 5. Crear tabla de memorial
    await pool.query(`
      CREATE TABLE mascotas_memorial (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre VARCHAR(100) NOT NULL,
        especie VARCHAR(50) NOT NULL,
        raza VARCHAR(100),
        fecha_nacimiento DATE,
        fecha_fallecimiento DATE NOT NULL,
        mensaje TEXT NOT NULL,
        foto_url TEXT NOT NULL,
        contador_veladoras INT DEFAULT 0,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabla mascotas_memorial creada.');

    // 6. Crear tabla de tokens revocados
    await pool.query(`
      CREATE TABLE tokens_bloqueados (
        token TEXT PRIMARY KEY,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabla tokens_bloqueados creada.');

    // 7. Crear índices de rendimiento
    await pool.query('CREATE INDEX IF NOT EXISTS indice_mascotas_ubicacion ON mascotas USING GIST (ubicacion);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mascotas_usuario ON mascotas(id_usuario);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mascotas_nombre_trgm ON mascotas USING GIN (nombre gin_trgm_ops);');
    console.log('✅ Índices creados.');

    // 8. Insertar superadmin por defecto
    const emailAdmin = process.env.ADMIN_EMAIL || 'admin@petmap.com';
    const passAdmin = process.env.ADMIN_PASSWORD || 'Admin123!';
    const hashAdmin = await bcrypt.hash(passAdmin, 10);
    await pool.query(
      `INSERT INTO usuarios (correo, contrasena_hash, rol, nombre) VALUES ($1, $2, 'superadmin', 'Super Admin') ON CONFLICT (correo) DO NOTHING;`,
      [emailAdmin, hashAdmin]
    );
    console.log(`👤 Superadmin creado: ${emailAdmin} / ${passAdmin}`);

    console.log('\n🎉 ¡Base de datos reiniciada con éxito!');
    console.log('   Ahora puedes iniciar sesión con las credenciales anteriores y registrar mascotas sin problemas.');

  } catch (error) {
    console.error('❌ Error durante el reinicio:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();