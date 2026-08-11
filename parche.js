// parche-rol.js
'use strict';
require('dotenv').config();
const { pool } = require('./src/config/bd.config');

(async () => {
  try {
    console.log('🔧 Aplicando parche de seguridad en la Base de Datos...');
    
    // 1. Cambiamos el comportamiento por defecto de la tabla
    await pool.query("ALTER TABLE usuarios ALTER COLUMN rol SET DEFAULT 'usuario';");
    
    // 2. Degradamos a 'usuario' todas las cuentas que se crearon como 'admin' por error.
    // (Tu cuenta superadmin está protegida porque su rol es 'superadmin', no 'admin').
    const resultado = await pool.query("UPDATE usuarios SET rol = 'usuario' WHERE rol = 'admin';");
    
    console.log(`✅ ¡Parche exitoso! Se degradaron ${resultado.rowCount} cuentas a usuario normal.`);
  } catch (error) {
    console.error('❌ Error aplicando el parche:', error.message);
  } finally {
    pool.end();
  }
})();