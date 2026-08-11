// reparar-todo.js
'use strict';
console.log('🟢 INICIANDO REPARACIÓN COMPLETA...\n');

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// ─── CONEXIÓN (MISMA QUE FUNCIONÓ EN check.js) ─────────────────
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT || 5432),
  // En desarrollo NO usamos SSL
  ssl: false,
});

// ─── CIFRADO (copia exacta de tu crypto.util.js) ───────────────
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
  ? Buffer.from(process.env.ENCRYPTION_KEY, 'base64')
  : crypto.randomBytes(32);
const ALGORITHM = 'aes-256-gcm';

const cifrarDatos = (texto) => {
  if (!texto) return texto;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(String(texto), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

// ─── FUNCIONES AUXILIARES ──────────────────────────────────────
const insertarMascota = async (datos) => {
  const {
    nombre, especie, raza, descripcion, telefono, direccion,
    fecha_nacimiento, esta_perdida, lat, lng
  } = datos;

  const telefonoCifrado = cifrarDatos(telefono || '');
  const direccionCifrada = cifrarDatos(direccion || '');

  await pool.query(`
    INSERT INTO mascotas (
      id_usuario, nombre, especie, raza, descripcion,
      telefono_dueno, direccion_dueno, fecha_nacimiento,
      esta_perdida, latitud, longitud, ubicacion, foto_url
    ) VALUES (
      (SELECT id FROM usuarios WHERE correo = $1 LIMIT 1),
      $2, $3, $4, $5, $6, $7, $8, $9,
      $10::double precision, $11::double precision,
      CASE WHEN $9 = TRUE AND $10 IS NOT NULL AND $11 IS NOT NULL
        THEN ST_SetSRID(ST_MakePoint($11::double precision, $10::double precision), 4326)
        ELSE NULL
      END,
      '/uploads/_test/foto.jpg'
    )
  `, [
    process.env.ADMIN_EMAIL || 'admin@petmap.com',
    nombre, especie, raza || null, descripcion || null,
    telefonoCifrado, direccionCifrada,
    fecha_nacimiento || null,
    esta_perdida || false,
    lat || null, lng || null
  ]);
};

(async () => {
  try {
    // ─── 1. LIMPIEZA TOTAL ─────────────────────────────────────
    console.log('🧹 Eliminando tablas existentes...');
    await pool.query('DROP TABLE IF EXISTS tokens_bloqueados CASCADE;');
    await pool.query('DROP TABLE IF EXISTS mascotas_memorial CASCADE;');
    await pool.query('DROP TABLE IF EXISTS mascotas CASCADE;');
    await pool.query('DROP TABLE IF EXISTS usuarios CASCADE;');
    console.log('   ✔ Tablas eliminadas.');

    // ─── 2. CREAR EXTENSIONES ──────────────────────────────────
    console.log('🔧 Activando extensiones...');
    await pool.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
    console.log('   ✔ Extensiones listas.');

    // ─── 3. CREAR TABLAS ───────────────────────────────────────
    console.log('📦 Creando tabla usuarios...');
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
    console.log('   ✔ usuarios creada.');

    console.log('📦 Creando tabla mascotas...');
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
    console.log('   ✔ mascotas creada.');

    console.log('📦 Creando tabla mascotas_memorial...');
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
    console.log('   ✔ mascotas_memorial creada.');

    console.log('📦 Creando tabla tokens_bloqueados...');
    await pool.query(`
      CREATE TABLE tokens_bloqueados (
        token TEXT PRIMARY KEY,
        creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('   ✔ tokens_bloqueados creada.');

    // ─── 4. ÍNDICES ────────────────────────────────────────────
    console.log('📊 Creando índices...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mascotas_ubicacion ON mascotas USING GIST (ubicacion);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mascotas_usuario ON mascotas(id_usuario);');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_mascotas_nombre_trgm ON mascotas USING GIN (nombre gin_trgm_ops);');
    console.log('   ✔ Índices listos.');

    // ─── 5. SUPERADMIN ─────────────────────────────────────────
    const emailAdmin = process.env.ADMIN_EMAIL || 'adminpetmap@gmail.com';
    const passAdmin = process.env.ADMIN_PASSWORD || 'Pelismaxpalomita1!';
    const hashAdmin = await bcrypt.hash(passAdmin, 10);
    await pool.query(
      `INSERT INTO usuarios (correo, contrasena_hash, rol, nombre) VALUES ($1, $2, 'superadmin', 'Super Admin') ON CONFLICT (correo) DO NOTHING;`,
      [emailAdmin, hashAdmin]
    );
    console.log(`👤 Superadmin creado/verificado: ${emailAdmin}`);

    // ─── 6. MASCOTAS DE PRUEBA ─────────────────────────────────
    console.log('\n🐾 Insertando mascotas de prueba...');
    await insertarMascota({
      nombre: 'Luna',
      especie: 'Perro',
      raza: 'Labrador',
      descripcion: 'Collar azul, muy amigable.',
      telefono: '+52 3312345678',
      direccion: 'Av. Siempre Viva 742',
      fecha_nacimiento: '2020-03-15',
      esta_perdida: true,
      lat: 20.6767,
      lng: -103.3471
    });
    console.log('   1. Luna (perdida) – insertada.');

    await insertarMascota({
      nombre: 'Michi',
      especie: 'Gato',
      descripcion: 'Naranja rayado, casero.',
      fecha_nacimiento: '2019-07-22',
      esta_perdida: false
    });
    console.log('   2. Michi (a salvo) – insertada.');

    await insertarMascota({
      nombre: 'Rocky',
      especie: 'Perro',
      raza: 'Bulldog',
      descripcion: 'Blanco con manchas, pañuelo rojo.',
      telefono: '+52 3398765432',
      direccion: 'Calle Falsa 123',
      esta_perdida: true,
      lat: 20.6812,
      lng: -103.4325
    });
    console.log('   3. Rocky (perdida) – insertada.');

    // ─── 7. MEMORIALES DE PRUEBA ───────────────────────────────
    console.log('\n🕯️ Insertando memoriales...');
    await pool.query(
      `INSERT INTO mascotas_memorial (nombre, especie, fecha_fallecimiento, mensaje, foto_url)
       VALUES ($1, $2, $3, $4, '/uploads/_test/memorial.jpg')`,
      ['Max', 'Perro', '2024-01-10', 'Siempre en nuestros corazones.']
    );
    console.log('   1. Max – insertado.');

    await pool.query(
      `INSERT INTO mascotas_memorial (nombre, especie, fecha_fallecimiento, mensaje, foto_url)
       VALUES ($1, $2, $3, $4, '/uploads/_test/memorial.jpg')`,
      ['Copito', 'Conejo', '2023-08-05', 'Pequeño y blanco, lleno de amor.']
    );
    console.log('   2. Copito – insertado.');

    // ─── VERIFICACIÓN FINAL ────────────────────────────────────
    const totalMascotas = await pool.query('SELECT COUNT(*) FROM mascotas');
    const totalMemorial = await pool.query('SELECT COUNT(*) FROM mascotas_memorial');
    console.log(`\n✅ REPARACIÓN COMPLETA.`);
    console.log(`📊 Mascotas en BD: ${totalMascotas.rows[0].count}`);
    console.log(`📊 Memoriales en BD: ${totalMemorial.rows[0].count}`);
    console.log('👉 Ahora inicia sesión y ve al panel de administración.');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();