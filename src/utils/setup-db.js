require('dotenv').config();

const { pool } = require('../config/bd.config');
const bcrypt = require('bcrypt');

const inicializarBaseDeDatos = async () => {
  console.log('⏳ Iniciando configuración de la base de datos...');

  try {
    console.log('Instalando extensión PostGIS...');
    await pool.query('CREATE EXTENSION IF NOT EXISTS postgis;');

    console.log('Instalando extensión pgcrypto...');
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

    console.log('Borrando tabla existente si aplica...');
    await pool.query('DROP TABLE IF EXISTS mascotas;');

    console.log('Creando tabla "mascotas"...');
    const queryCrearTabla = `
      CREATE TABLE mascotas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre VARCHAR(100) NOT NULL,
        especie VARCHAR(50) NOT NULL,
        raza VARCHAR(100),
        descripcion TEXT,
        telefono_dueno VARCHAR(50),
        direccion_dueno TEXT,
        esta_perdida BOOLEAN DEFAULT false,
        idioma_registro VARCHAR(10) DEFAULT 'es',
        latitud DOUBLE PRECISION,
        longitud DOUBLE PRECISION,
        ubicacion GEOMETRY(Point, 4326),
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await pool.query(queryCrearTabla);

    console.log('Creando tabla "usuarios"...');
    const queryCrearUsuarios = `
      CREATE TABLE IF NOT EXISTS usuarios (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre VARCHAR(100),
        correo VARCHAR(255) UNIQUE NOT NULL,
        contrasena_hash VARCHAR(255) NOT NULL,
        rol VARCHAR(50) DEFAULT 'admin',
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await pool.query(queryCrearUsuarios);

    await pool.query(`
      ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS nombre VARCHAR(100);
    `);

    console.log('Creando Súper Administrador por defecto...');
    const hashAdmin = await bcrypt.hash('admin123', 10);
    const queryAdmin = `
      INSERT INTO usuarios (correo, contrasena_hash, rol)
      VALUES ('admin@redgatos.com', $1, 'superadmin')
      ON CONFLICT (correo)
      DO UPDATE SET
        contrasena_hash = EXCLUDED.contrasena_hash,
        rol = EXCLUDED.rol,
        nombre = 'Super Admin';
    `;

    await pool.query(queryAdmin, [hashAdmin]);

    console.log('Creando índice espacial...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS indice_mascotas_ubicacion
      ON mascotas USING GIST (ubicacion);
    `);

    console.log('✅ ¡Base de datos estructurada con éxito! Ya puedes iniciar tu API.');
  } catch (error) {
    console.error('❌ Error al configurar la base de datos:', error.message);
  } finally {
    await pool.end();
  }
};

inicializarBaseDeDatos();