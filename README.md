<div align="center">

  <h1>🐾 PetMap</h1>
  <p><strong>Plataforma Comunitaria de Rescate, Identificación y Memorial de Mascotas</strong></p>

  <p>
    <a href="https://petmap.lalolab.dev" target="_blank">
      <img src="https://img.shields.io/badge/Estado-En%20Línea%20(Producción)-success?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Estado en línea" />
    </a>
    <img src="https://img.shields.io/badge/Seguridad-Cifrado%20AES--256-blue?style=for-the-badge&logo=shield" alt="Cifrado AES-256" />
    <img src="https://img.shields.io/badge/Motor_Geo-PostGIS%20%2B%20Leaflet-darkgreen?style=for-the-badge&logo=postgresql" alt="PostGIS" />
    <img src="https://img.shields.io/badge/Autor-Eduardo%20Márquez-darkred?style=for-the-badge" alt="Autor Eduardo Márquez" />
  </p>

  <h3>🌐 <a href="https://petmap.lalolab.dev">https://petmap.lalolab.dev</a></h3>

  <p align="center">
    <em>Una solución tecnológica integral diseñada para salvaguardar a los animales de compañía, agilizar reencuentros familiares y honrar la memoria de quienes ya partieron.</em>
  </p>

  <br />
</div>

---

## 📌 Acerca de PetMap

**PetMap** es una plataforma web integral desarrollada como producto propietario por **Eduardo Isaías Parra Márquez (LaloLab)**. Nace como respuesta a la problemática urbana del extravío de mascotas y la falta de canales centralizados, seguros e inmediatos de contacto ciudadano.

A diferencia de redes sociales convencionales donde los reportes se pierden en el algoritmo, PetMap combina **geolocalización geoespacial de alta precisión**, **identificación física mediante códigos QR y códigos de barras**, y **blindaje criptográfico de datos sensibles** bajo estrictos estándares de privacidad.

---

## 🌟 Módulos y Capacidades del Producto

### 1. 🗺️ Mapa de Alertas Comunitarias en Tiempo Real
* **Geolocalización precisa:** Motor espacial alimentado por **PostgreSQL + PostGIS** con proyección esferoidal `EPSG:4326`.
* **Clustering inteligente:** Visualización dinámica mediante **Leaflet** que agrupa reportes por zonas urbanas para no saturar la vista.
* **Filtros avanzados:** Búsqueda inmediata por especie, raza, estado de extravío y radio geográfico de proximidad.

### 2. 🪪 Expedientes Digitales y Credenciales ID con QR
* **Identificador Único Universal (CURM):** Asignación de clave única de registro para cada animal.
* **Credenciales Físicas Imprimibles:** Generación automática de credenciales con fotografía procesada en formato WebP, código de barras Code 39 y código QR de respuesta rápida para colocar en collares o placas.
* **Perfiles Públicos Dinámicos:** Al escanear el QR, cualquier persona que encuentre a la mascota puede acceder al expediente web oficial de forma instantánea desde su teléfono móvil.

### 3. 🕊️ Altar y Memorial Digital Interactivo
* **Espacio Conmemorativo Perpetuo:** Módulo solemne dedicado a recordar y honrar a los animales de compañía fallecidos.
* **Encendido de Veladoras Virtuales:** Interacción comunitaria en tiempo real donde los usuarios pueden encender veladoras conmemorativas y dejar tributos de amor y agradecimiento.

### 4. 📢 Generador Dinámico de Carteles de Búsqueda
* Maquetación automática de carteles en alta definición con fotografía, datos clave, zona aproximada de extravío y código QR directo para impresión física y difusión inmediata en redes.

---

## 🔒 Privacidad y Arquitectura de Seguridad

PetMap fue concebido bajo el principio de **Privacidad por Diseño (Privacy by Design)** y protección contra fraudes o extorsiones:

* 🔐 **Cifrado Militar AES-256-CBC en Reposo:** Los datos de contacto del propietario (números telefónicos y domicilios) se almacenan cifrados con llaves criptográficas independientes.
* 🛡️ **Divulgación Condicionada:** Si la mascota está a salvo en casa, sus datos de contacto permanecen estrictamente inaccesibles tanto en la interfaz como en los endpoints de la API. Solo cuando el dueño activa voluntariamente el estado de *"Perdida"*, el sistema descifra la información de contacto para facilitar el rescate.
* 💾 **Almacenamiento Físico Aislado:** Arquitectura de discos físicos independientes en el servidor:
  * Disco dedicado (1 TB) exclusivo para fotografías de mascotas registradas.
  * Disco dedicado (500 GB) exclusivo para las fotografías y homenajes del Memorial.
* 🌐 **Perímetro Cloudflare Zero Trust:** Tráfico 100% cifrado con TLS 1.3, túneles seguros `cloudflared` sin puertos abiertos a internet público y protección activa contra ataques DDoS.
* ⚖️ **Alineación Legal:** Aviso de Privacidad integral (LFPDPPP y RGPD), Términos y Condiciones de uso, deslinde de responsabilidades por recompensas y garantía de Derechos ARCO para eliminación física de datos.

---

## 💻 Arquitectura Tecnológica

| Componente | Tecnología |
| :--- | :--- |
| **Frontend** | Single Page Application (SPA), Vanilla JS ES6+, Bootstrap 5.3, Leaflet Maps, MarkerCluster |
| **Backend / API** | Node.js, Express, Sharp Engine (Compresión y sanitización WebP), Helmet Security Headers |
| **Criptografía** | Node.js Crypto (`AES-256-CBC`), Hashing unidireccional `bcrypt`, JWT HttpOnly |
| **Base de Datos** | PostgreSQL 18 con extensiones `PostGIS`, `pgcrypto` y `pg_trgm` |
| **Infraestructura** | Linux Server (Ubuntu LTS), PM2 Process Manager, Cloudflare Tunnels |

---

## 👨‍💻 Autor y Desarrollo

**PetMap** es un proyecto original ideado, diseñado, programado e implementado por:

* **Eduardo Isaías Parra Márquez**
* **GitHub:** [@Eduardomqz21](https://github.com/Eduardomqz21)
* **Plataforma en Producción:** [https://petmap.lalolab.dev](https://petmap.lalolab.dev)
* **Infraestructura:** LaloLab Systems

---

<div align="center">
  <small>© 2026 PetMap / Eduardo Isaías Parra Márquez. Todos los derechos reservados.</small>
</div>
