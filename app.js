// app.js
require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const { pool } = require('./src/config/bd.config');

const rutasMascotas = require('./src/routes/mascotas.routes');
const rutasAuth = require('./src/routes/auth.routes');
const rutasUsuarios = require('./src/routes/usuarios.routes');
const rutasMemorial = require('./src/routes/memorial.routes'); // NUEVO
const { BASE_UPLOAD_DIR } = require('./src/utils/archivos.util');
const { inicializarBaseDeDatos } = require('./src/utils/setup-db');

const aplicacion = express();
const puertoServidor = Number(process.env.PORT || 3000);

// SEC-002: Confiar en el proxy inverso (Nginx, AWS, Cloudflare) para que el Rate Limit lea la IP real del usuario.
aplicacion.set('trust proxy', 1);

aplicacion.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

aplicacion.use(express.json());
aplicacion.use(express.urlencoded({ extended: true }));
aplicacion.use(cookieParser());

aplicacion.use(express.static(path.join(__dirname, 'public'), { index: false }));
aplicacion.use('/uploads', express.static(path.resolve(BASE_UPLOAD_DIR)));

aplicacion.use('/api/mascotas', rutasMascotas);
aplicacion.use('/api/auth', rutasAuth);
aplicacion.use('/api/usuarios', rutasUsuarios);
aplicacion.use('/api/memorial', rutasMemorial); // NUEVO

aplicacion.get('/salud', (_peticion, respuesta) => {
  respuesta.status(200).json({ mensaje: 'API de PetMap activa y segura.' });
});

aplicacion.get('/robots.txt', (peticion, respuesta) => {
  respuesta.type('text/plain');
  respuesta.send(`User-agent: *\nAllow: /\nSitemap: ${peticion.protocol}://${peticion.get('host')}/sitemap.xml`);
});

// PERF-001: Sistema de caché para el Sitemap para evitar ataques DoS a la base de datos
let sitemapCache = '';
let sitemapUltimaActualizacion = 0;
const TIEMPO_CACHE_SITEMAP = 60 * 60 * 1000; // 1 hora en milisegundos

aplicacion.get('/sitemap.xml', async (peticion, respuesta) => {
  try {
    const ahora = Date.now();
    
    // Si el caché existe y aún no ha expirado, se devuelve directamente
    if (sitemapCache && (ahora - sitemapUltimaActualizacion < TIEMPO_CACHE_SITEMAP)) {
      respuesta.type('application/xml');
      return respuesta.send(sitemapCache);
    }

    const consulta = 'SELECT id FROM mascotas WHERE esta_perdida = TRUE ORDER BY creado_en DESC LIMIT 1000';
    const resultado = await pool.query(consulta);
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    xml += `  <url>\n    <loc>${peticion.protocol}://${peticion.get('host')}/</loc>\n    <changefreq>hourly</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
    
    resultado.rows.forEach(mascota => {
      xml += `  <url>\n    <loc>${peticion.protocol}://${peticion.get('host')}/?perfil=${mascota.id}</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    });
    
    xml += `</urlset>`;
    
    sitemapCache = xml;
    sitemapUltimaActualizacion = ahora;

    respuesta.type('application/xml');
    respuesta.send(xml);
  } catch (error) {
    respuesta.status(500).send('');
  }
});

aplicacion.get('*', async (peticion, respuesta) => {
  // Leemos dinámicamente para evitar desactualizaciones si se modifica el HTML
  const rutaIndexHtml = path.join(__dirname, 'public', 'index.html');
  let htmlModificado = fs.readFileSync(rutaIndexHtml, 'utf-8');
  
  const idPerfilMascota = peticion.query.perfil;

  if (idPerfilMascota) {
    try {
      const consultaMascota = 'SELECT nombre, descripcion, foto_url, esta_perdida FROM mascotas WHERE id = $1';
      const resultadoMascota = await pool.query(consultaMascota, [idPerfilMascota]);

      if (resultadoMascota.rows.length > 0) {
        const mascota = resultadoMascota.rows[0];
        const tituloSEO = mascota.esta_perdida ? `¡SE BUSCA! Ayuda a ${mascota.nombre} a volver a casa` : `Conoce a ${mascota.nombre} en PetMap`;
        const descripcionSEO = mascota.descripcion || 'Revisa el perfil de esta mascota y ayuda a nuestra comunidad.';
        const protocolo = peticion.headers['x-forwarded-proto'] || peticion.protocol || 'http';
        const dominio = peticion.get('host');
        const imagenSEO = mascota.foto_url ? `${protocolo}://${dominio}${mascota.foto_url}` : `${protocolo}://${dominio}/default-pet.png`;
        const urlActual = `${protocolo}://${dominio}/?perfil=${idPerfilMascota}`;

        // UX-001: Regex mejorado para tolerar saltos de línea en el HTML
        htmlModificado = htmlModificado.replace(/<title>[\s\S]*?<\/title>/, `<title>${tituloSEO} | PetMap</title>`);

        const etiquetasOpenGraph = `
            <meta property="og:title" content="${tituloSEO}" />
            <meta property="og:description" content="${descripcionSEO}" />
            <meta property="og:image" content="${imagenSEO}" />
            <meta property="og:url" content="${urlActual}" />
            <meta property="og:type" content="website" />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content="${tituloSEO}" />
            <meta name="twitter:description" content="${descripcionSEO}" />
            <meta name="twitter:image" content="${imagenSEO}" />
        `;
        htmlModificado = htmlModificado.replace('</head>', `${etiquetasOpenGraph}</head>`);
      }
    } catch (errorConsulta) {
      // Ignorar fallo de SEO y servir HTML normal
    }
  }
  respuesta.send(htmlModificado);
});

if (require.main === module) {
  inicializarBaseDeDatos()
    .then(() => {
      aplicacion.listen(puertoServidor, () => {
        console.log(`Servidor de PetMap escuchando en el puerto ${puertoServidor}`);
      });
    })
    .catch((errorInicializacion) => {
      console.error('Error al inicializar la base de datos:', errorInicializacion.message);
      process.exit(1);
    });
}

module.exports = aplicacion;