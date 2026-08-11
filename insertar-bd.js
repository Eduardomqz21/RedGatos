// insertar-datos-prueba.js
'use strict';
require('dotenv').config();
const { pool } = require('./src/config/bd.config');
const { cifrarDatos } = require('./src/utils/crypto.util');
const fs = require('fs');
const path = require('path');

// Función auxiliar para insertar una mascota
const insertarMascota = async (datos) => {
  const {
    nombre, especie, raza, descripcion, telefono, direccion,
    fecha_nacimiento, esta_perdida, lat, lng
  } = datos;

  const telefonoCifrado = cifrarDatos(telefono || '');
  const direccionCifrada = cifrarDatos(direccion || '');

  const query = `
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
      '/uploads/_test/default-pet.png'
    )
  `;

  await pool.query(query, [
    process.env.ADMIN_EMAIL || 'admin@petmap.com',
    nombre, especie, raza || null, descripcion || null,
    telefonoCifrado, direccionCifrada,
    fecha_nacimiento || null,
    esta_perdida || false,
    lat || null, lng || null
  ]);
};

// Insertar homenaje de prueba
const insertarMemorial = async (datos) => {
  const { nombre, especie, fecha_fallecimiento, mensaje } = datos;
  await pool.query(
    `INSERT INTO mascotas_memorial (nombre, especie, fecha_fallecimiento, mensaje, foto_url)
     VALUES ($1, $2, $3, $4, '/uploads/_test/default-memorial.png')`,
    [nombre, especie, fecha_fallecimiento, mensaje]
  );
};

(async () => {
  console.log('🧪 Insertando datos de prueba...');
  try {
    // Verificar que exista el superadmin
    const admin = await pool.query('SELECT id FROM usuarios WHERE correo = $1', [process.env.ADMIN_EMAIL || 'admin@petmap.com']);
    if (admin.rowCount === 0) {
      console.error('❌ No se encontró el superadmin. Ejecuta primero reiniciar-base.js');
      process.exit(1);
    }

    // Mascota 1: Perdida con ubicación
    await insertarMascota({
      nombre: 'Luna',
      especie: 'Perro',
      raza: 'Labrador',
      descripcion: 'Perrita amigable, collar azul con placa.',
      telefono: '+52 3312345678',
      direccion: 'Av. Siempre Viva 742',
      fecha_nacimiento: '2020-03-15',
      esta_perdida: true,
      lat: 20.6767,
      lng: -103.3471
    });
    console.log('✔ Mascota 1 (Luna) insertada.');

    // Mascota 2: A salvo, sin teléfono
    await insertarMascota({
      nombre: 'Michi',
      especie: 'Gato',
      descripcion: 'Gato naranja rayado, muy casero.',
      fecha_nacimiento: '2019-07-22',
      esta_perdida: false
    });
    console.log('✔ Mascota 2 (Michi) insertada.');

    // Mascota 3: Perdida, otra ubicación
    await insertarMascota({
      nombre: 'Rocky',
      especie: 'Perro',
      raza: 'Bulldog',
      descripcion: 'Color blanco con manchas negras, usa pañuelo rojo.',
      telefono: '+52 3398765432',
      direccion: 'Calle Falsa 123',
      esta_perdida: true,
      lat: 20.6812,
      lng: -103.4325
    });
    console.log('✔ Mascota 3 (Rocky) insertada.');

    // Memorial 1
    await insertarMemorial({
      nombre: 'Max',
      especie: 'Perro',
      fecha_fallecimiento: '2024-01-10',
      mensaje: 'Siempre en nuestros corazones, el mejor amigo.'
    });
    console.log('✔ Memorial 1 (Max) insertado.');

    // Memorial 2
    await insertarMemorial({
      nombre: 'Copito',
      especie: 'Conejo',
      fecha_fallecimiento: '2023-08-05',
      mensaje: 'Pequeño, blanco y lleno de amor.'
    });
    console.log('✔ Memorial 2 (Copito) insertado.');

    console.log('\n🎉 Datos de prueba añadidos con éxito.');
    console.log('   Ahora abre el panel de administración y verifica las tablas.');
  } catch (error) {
    console.error('❌ Error insertando datos:', error.message);
  } finally {
    await pool.end();
  }
})();