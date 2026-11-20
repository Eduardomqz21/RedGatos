// probar-email.js
'use strict';
require('dotenv').config();
const { verificarConexionEmail, enviarCorreoRecuperacion } = require('./src/utils/email.util');

(async () => {
  console.log('📬 Verificando configuración de correo...');
  console.log('-----------------------------------------');
  console.log('SMTP_USER:', process.env.SMTP_USER || '(no configurado)');
  console.log('SMTP_PASS:', process.env.SMTP_PASS ? '******** (configurado)' : '(no configurado)');
  console.log('-----------------------------------------');

  const resultado = await verificarConexionEmail();
  if (!resultado.ok) {
    console.error('❌ Error de conexión:', resultado.error);
    process.exit(1);
  }

  console.log('✅ ¡Conexión SMTP exitosa!');
  
  const correoDestino = process.argv[2] || process.env.SMTP_USER;
  if (correoDestino) {
    console.log(`\n📤 Enviando correo de prueba a ${correoDestino}...`);
    const envio = await enviarCorreoRecuperacion({
      destinatario: correoDestino,
      nombreUsuario: 'Prueba de Sistema',
      enlaceRecuperacion: 'https://petmap.lalolab.dev/?token=token_de_prueba_123'
    });

    if (envio.enviado) {
      console.log('🎉 ¡Correo de prueba enviado con éxito! Revisa tu bandeja de entrada o spam.');
    } else {
      console.error('❌ Error enviando correo de prueba:', envio.error || envio.motivo);
    }
  }
})();
