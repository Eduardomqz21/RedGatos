// app.js
require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const { pool } = require('./src/config/bd.config');

const rutasMascotas = require('./src/routes/mascotas.routes');
const rutasAuth = require('./src/routes/auth.routes');
const rutasUsuarios = require('./src/routes/usuarios.routes');
const rutasMemorial = require('./src/routes/memorial.routes'); 
const { BASE_UPLOAD_DIR } = require('./src/utils/archivos.util');

const aplicacion = express();
const puertoServidor = Number(process.env.PORT || 3000);

// SEGURIDAD: Configurar Trust Proxy correctamente para Cloudflare
// El número 1 indica que confiamos en exactamente 1 proxy por delante (Cloudflare)
aplicacion.set('trust proxy', 1);

// SEGURIDAD: Headers HTTP seguros y CSP relajado para la UI
aplicacion.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://unpkg.com", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https:"],
      workerSrc: ["'self'", "blob:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// PERFORMANCE: Compresión Gzip/Brotli
aplicacion.use(compression());

// SEGURIDAD INTELIGENTE: CORS dinámico para pruebas fluidas
aplicacion.use(cors({
  origin: function (origin, callback) {
    // Limpiamos las URLs permitidas del .env (quitando barras al final)
    const origenesPermitidos = process.env.CORS_ORIGIN 
      ? process.env.CORS_ORIGIN.split(',').map(o => o.trim().replace(/\/$/, '')) 
      : [];
    
    if (!origin || 
        origenesPermitidos.includes(origin) || 
        origin.startsWith('http://localhost') || 
        origin.endsWith('.trycloudflare.com')) {
      callback(null, true);
    } else {
      console.error(`[CORS BLOQUEADO] Intento de acceso desde origen no autorizado: ${origin}`);
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}));

aplicacion.use(express.json({ limit: '1mb' })); // Límite de payload
aplicacion.use(express.urlencoded({ extended: true, limit: '1mb' }));
aplicacion.use(cookieParser());

// Caché inmutable para assets estáticos, no-cache para HTML
aplicacion.use(express.static(path.join(__dirname, 'public'), { 
  index: false,
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (path.match(/\.(css|js|png|jpg|webp)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// ¡¡NUEVA LÍNEA!! PARA SERVIR LA CARPETA TEMPLATES QUE ESTÁ AFUERA DE PUBLIC
aplicacion.use('/templates', express.static(path.join(__dirname, 'templates')));

// Servir uploads estáticamente pero restringiendo ejecución
aplicacion.use('/uploads', express.static(path.resolve(BASE_UPLOAD_DIR), {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
  }
}));

// Rutas API
aplicacion.use('/api/mascotas', rutasMascotas);
aplicacion.use('/api/auth', rutasAuth);
aplicacion.use('/api/usuarios', rutasUsuarios);
aplicacion.use('/api/memorial', rutasMemorial);

// Health Checks Separados
aplicacion.get('/salud', (_peticion, respuesta) => {
  respuesta.status(200).json({ estado: 'ok', mensaje: 'Servidor Node.js activo.' });
});

aplicacion.get('/salud/db', async (_peticion, respuesta) => {
  try {
    await pool.query('SELECT 1');
    respuesta.status(200).json({ estado: 'ok', mensaje: 'PostgreSQL conectado.' });
  } catch (error) {
    respuesta.status(500).json({ estado: 'error', mensaje: 'PostgreSQL inaccesible.' });
  }
});

aplicacion.get('/robots.txt', (peticion, respuesta) => {
  respuesta.type('text/plain');
  respuesta.send(`User-agent: *\nAllow: /\nSitemap: ${peticion.protocol}://${peticion.get('host')}/sitemap.xml`);
});

// Sitemap
let sitemapCache = '';
let sitemapUltimaActualizacion = 0;
const TIEMPO_CACHE_SITEMAP = 60 * 60 * 1000; 

aplicacion.get('/sitemap.xml', async (peticion, respuesta) => {
  try {
    const ahora = Date.now();
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

// Front Controller SPA
aplicacion.get('*', async (peticion, respuesta) => {
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
        const protocolo = peticion.headers['x-forwarded-proto'] || peticion.protocol || 'https';
        const dominio = peticion.get('host');
        const imagenSEO = mascota.foto_url ? `${protocolo}://${dominio}${mascota.foto_url}` : `${protocolo}://${dominio}/default-pet.png`;
        const urlActual = `${protocolo}://${dominio}/?perfil=${idPerfilMascota}`;

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
      // Ignorar silenciosamente errores de DB en la inyección SEO
    }
  }
  respuesta.send(htmlModificado);
});

// SEGURIDAD: Middleware global de manejo de errores
aplicacion.use((err, req, res, next) => {
  // Solo silenciar el stack trace en producción
  res.status(err.status || 500).json({
    error: true,
    mensaje: err.message === 'No permitido por CORS' ? err.message : (process.env.NODE_ENV === 'production' ? 'Ocurrió un error interno en el servidor.' : err.message),
    codigo: 'ERROR_INTERNO'
  });
});

if (require.main === module) {
  aplicacion.listen(puertoServidor, () => {
    console.log(`[PRODUCCION] Servidor de PetMap escuchando en el puerto ${puertoServidor}`);
  });
}

module.exports = aplicacion;