# API ESPM – Servicios Públicos de Moniquirá

API REST del proyecto formativo ESPM (evidencia GA7-220501096-AA5-EV03). Respalda la web con servicios de cuentas de usuario, facturas, PQR, noticias y contacto.

Hecha con JavaScript sobre Node.js (18 o superior), sin paquetes externos. Los datos se guardan en `data/db.json`, que se crea solo al iniciar.

## Cómo ejecutarla

```
node server.js
```

Abre http://localhost:3000/api/salud para comprobar que funciona. Para ejecutar las 34 pruebas automáticas:

```
npm test
```

## Servicios

| Método | Dirección | Quién | Para qué |
|---|---|---|---|
| GET | /api/salud | Todos | Comprobar que la API está activa |
| POST | /api/auth/registro | Todos | Crear cuenta |
| POST | /api/auth/login | Todos | Iniciar sesión (devuelve token) |
| POST | /api/auth/recuperar | Todos | Recuperar contraseña |
| GET | /api/facturas?cuenta= o ?cedula= | Todos | Consultar facturas |
| POST | /api/facturas/:id/pagar | Usuario | Pagar una factura |
| GET | /api/facturas/:id/recibo | Usuario | Generar el recibo de una factura pagada |
| POST | /api/pqr | Todos | Radicar una PQR |
| GET | /api/pqr?cedula= | Todos | Consultar el estado de las PQR |
| PUT | /api/pqr/:radicado | Administrador | Cambiar estado y responder una PQR |
| GET | /api/noticias?tipo=&buscar= | Todos | Listar noticias y comunicados |
| POST | /api/noticias | Administrador | Publicar una noticia |
| POST | /api/contacto | Todos | Enviar mensaje de contacto |
| GET | /api/contacto | Administrador | Ver mensajes recibidos |

Los servicios protegidos usan la cabecera `Authorization: Bearer <token>`.
La explicación detallada de cada servicio está en `docs/DOCUMENTACION_SERVICIOS_ESPM.docx`.

## Datos de prueba

Administrador: `admin@espm.gov.co` con contraseña inicial `Admin12345` (se puede cambiar con la variable de entorno `ADMIN_CLAVE` antes del primer inicio).
Facturas de ejemplo: cuenta `001-2345-6` (cédula `1234567890`) y cuenta `002-1000-1` (cédula `987654321`).

## Estructura

```
server.js                  Servidor y tabla de rutas
src/db.js                  Lectura y escritura del archivo JSON
src/seguridad.js           Contraseñas con hash y tokens de sesión
src/validaciones.js        Reglas de validación de los datos
src/errores.js             Errores con código HTTP
src/controladores/         Un archivo por grupo de servicios
test/api.test.js           Pruebas automáticas
docs/                      Documentación de los servicios
```
