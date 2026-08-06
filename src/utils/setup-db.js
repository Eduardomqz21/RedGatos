require('dotenv').config();
const { pool } = require('../config/bd.config');
const bcrypt = require('bcrypt');

const inicializarBaseDeDatos = async () => {
  console.log('⏳ Iniciando configuración de la base de datos de PetMap...');
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');

    const queryCrearUsuarios = `
      CREATE TABLE IF NOT EXISTS usuarios (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre VARCHAR(100),
        correo VARCHAR(255) UNIQUE NOT NULL,
        contrasena_hash VARCHAR(255) NOT NULL,
        rol VARCHAR(50) DEFAULT 'admin',
        token_recuperacion VARCHAR(255),
        expresion_recuperacion TIMESTAMP,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(queryCrearUsuarios);

    const queryCrearTabla = `
      CREATE TABLE IF NOT EXISTS mascotas (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        id_usuario UUID REFERENCES usuarios(id) ON DELETE CASCADE,
        nombre VARCHAR(100) NOT NULL,
        especie VARCHAR(50) NOT NULL,
        raza VARCHAR(100),
        descripcion TEXT,
        telefono_dueno VARCHAR(50),
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
    `;
    await pool.query(queryCrearTabla);

    // Tabla para lista negra de JWT (Solución ARCH-001)
    const queryCrearTokensBloqueados = `
      CREATE TABLE IF NOT EXISTS tokens_bloqueados (
        token TEXT PRIMARY KEY,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(queryCrearTokensBloqueados);

    await pool.query(`ALTER TABLE mascotas ADD COLUMN IF NOT EXISTS curm VARCHAR(50);`);
    await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS token_recuperacion VARCHAR(255);`);
    await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS expiracion_recuperacion TIMESTAMP;`);

    const passAdmin = process.env.ADMIN_PASSWORD || 'admin123';
    const emailAdmin = process.env.ADMIN_EMAIL || 'admin@petmap.com';
    const hashAdmin = await bcrypt.hash(passAdmin, 10);
    const queryAdmin = `
      INSERT INTO usuarios (correo, contrasena_hash, rol, nombre)
      VALUES ($1, $2, 'superadmin', 'Super Admin')
      ON CONFLICT (correo)
      DO UPDATE SET contrasena_hash = EXCLUDED.contrasena_hash, rol = EXCLUDED.rol;
    `;
    await pool.query(queryAdmin, [emailAdmin, hashAdmin]);

    await pool.query(`CREATE INDEX IF NOT EXISTS indice_mascotas_ubicacion ON mascotas USING GIST (ubicacion);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_mascotas_usuario ON mascotas(id_usuario);`);
    
    // Solución DB-002: Índices para búsquedas optimizadas sin escaneo completo
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_mascotas_nombre_trgm ON mascotas USING GIN (nombre gin_trgm_ops);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_mascotas_especie_trgm ON mascotas USING GIN (especie gin_trgm_ops);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_mascotas_raza_trgm ON mascotas USING GIN (raza gin_trgm_ops);`);

    console.log('✅ ¡Base de datos estructurada con éxito!');
  } catch (error) {
    console.error('❌ Error al configurar la base de datos:', error.message);
  }
};

if (require.main === module) {
  inicializarBaseDeDatos().then(() => pool.end()).catch(async () => await pool.end());
}
module.exports = { inicializarBaseDeDatos };