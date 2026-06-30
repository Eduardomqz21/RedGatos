# RedGatos

API REST y frontend SPA para una red social de mascotas y reportes de animales perdidos.

## Tecnologías

- Node.js
- Express
- PostgreSQL + PostGIS
- Vanilla JS
- Bootstrap 5
- Leaflet

## Requisitos

- Node.js 18 o superior
- PostgreSQL con PostGIS habilitado

## Configuración

1. Instala dependencias:

```bash
npm install
```

2. Revisa tu archivo `.env` local con las variables de base de datos y `JWT_SECRET`.

3. Inicializa la base de datos:

```bash
node src/utils/setup-db.js
```

## Ejecución

```bash
npm start
```

## Credenciales de administrador por defecto

- Correo: `admin@redgatos.com`
- Contraseña: `admin123`

## Rutas principales

- `GET /salud`
- `POST /api/auth/login`
- `POST /api/mascotas`
- `GET /api/mascotas/perdidas`
- `GET /api/mascotas/buscar`
- `POST /api/mascotas/:id/verificar`
- `PUT /api/mascotas/:id/estado`
- `DELETE /api/mascotas/:id` (protegida con JWT)

## Nota

El archivo `.env` no debe subirse al repositorio.