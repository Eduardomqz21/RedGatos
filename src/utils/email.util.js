'use strict';
const nodemailer = require('nodemailer');

let transportador = null;

const obtenerTransportador = () => {
  if (transportador) return transportador;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!host || !user || !pass) {
    return null;
  }

  transportador = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });

  return transportador;
};

const enviarCorreoRecuperacion = async ({ destinatario, nombreUsuario, enlaceRecuperacion }) => {
  const trans = obtenerTransportador();
  const remitente = process.env.SMTP_FROM || `"PetMap Soporte" <${process.env.SMTP_USER || 'no-reply@lalolab.dev'}>`;

  if (!trans) {
    console.log(`\n===========================================`);
    console.log(`[AVISO EMAIL] SMTP no configurado en variables de entorno (.env).`);
    console.log(`Para activar envío real de correos, define en .env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.`);
    console.log(`Enlace de restablecimiento generado para ${destinatario}:`);
    console.log(enlaceRecuperacion);
    console.log(`===========================================\n`);
    return { enviado: false, motivo: 'SMTP_NO_CONFIGURADO' };
  }

  const plantillaHtml = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Restablecer contraseña - PetMap</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f6f8f7; margin: 0; padding: 20px; color: #23312e; }
        .contenedor { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e1e7e5; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.04); }
        .cabecera { background-color: #2e4a45; padding: 28px 24px; text-align: center; color: #ffffff; }
        .cabecera h1 { margin: 0; font-size: 24px; letter-spacing: -0.5px; }
        .cuerpo { padding: 32px 28px; line-height: 1.6; }
        .btn-enlace { display: inline-block; background-color: #2e4a45; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 600; font-size: 16px; margin: 20px 0; }
        .pie { padding: 20px 28px; background-color: #fbfcfc; border-top: 1px solid #f0f3f2; font-size: 13px; color: #6b7d79; text-align: center; }
        .alerta-expiracion { font-size: 13px; color: #8c5b23; background: #fdf8f0; border-left: 4px solid #d49742; padding: 10px 14px; border-radius: 4px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="contenedor">
        <div class="cabecera">
          <h1>🐾 PetMap</h1>
        </div>
        <div class="cuerpo">
          <h2>Hola, ${nombreUsuario || 'Usuario'}</h2>
          <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en PetMap.</p>
          <div style="text-align: center;">
            <a href="${enlaceRecuperacion}" class="btn-enlace" target="_blank" rel="noopener noreferrer">Restablecer mi contraseña</a>
          </div>
          <div class="alerta-expiracion">
            ⏳ Este enlace es válido únicamente por <strong>1 hora</strong> y solo puede ser utilizado una vez.
          </div>
          <p style="font-size: 14px; color: #5a6d68;">Si no solicitaste este cambio, puedes ignorar este mensaje; tu cuenta permanece segura.</p>
          <p style="font-size: 12px; color: #879995; word-break: break-all;">Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:<br><a href="${enlaceRecuperacion}">${enlaceRecuperacion}</a></p>
        </div>
        <div class="pie">
          © ${new Date().getFullYear()} PetMap / LaloLab. Plataforma de protección animal.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await trans.sendMail({
      from: remitente,
      to: destinatario,
      subject: 'Restablecer tu contraseña - PetMap',
      text: `Hola ${nombreUsuario || 'Usuario'},\n\nPara restablecer tu contraseña en PetMap, accede al siguiente enlace:\n${enlaceRecuperacion}\n\nEste enlace expira en 1 hora. Si no lo solicitaste, puedes ignorar este mensaje.`,
      html: plantillaHtml
    });
    console.log(`[EMAIL] Correo de recuperación enviado con éxito a ${destinatario} (ID: ${info.messageId})`);
    return { enviado: true, idMensaje: info.messageId };
  } catch (error) {
    console.error(`[EMAIL ERROR] Fallo al enviar correo a ${destinatario}:`, error.message);
    return { enviado: false, error: error.message };
  }
};

module.exports = { enviarCorreoRecuperacion };
