// ============================================================
// server.js
// Punto de entrada de la API REST de ESPM Moniquirá.
//
// Hace tres cosas:
//   1. Crea el servidor HTTP (módulo "http" de Node.js).
//   2. Define la tabla de rutas: método + dirección -> función.
//   3. Convierte cada resultado o error en una respuesta JSON.
//
// Para iniciarlo:   node server.js     (o: npm start)
// ============================================================

const http = require('http');
const { ErrorHttp } = require('./src/errores');
const auth = require('./src/controladores/auth');
const facturas = require('./src/controladores/facturas');
const pqr = require('./src/controladores/pqr');
const noticias = require('./src/controladores/noticias');
const contacto = require('./src/controladores/contacto');

const PUERTO = process.env.PORT || 3000;
const LIMITE_CUERPO = 100 * 1024; // 100 KB máximo por petición

// ---------- Tabla de rutas ----------
// ":id" y ":radicado" son partes variables de la dirección.
const rutas = [
  { metodo: 'GET', ruta: '/api/salud', manejador: () => ({ mensaje: 'API ESPM funcionando.' }) },

  // Cuentas
  { metodo: 'POST', ruta: '/api/auth/registro', manejador: auth.registro },
  { metodo: 'POST', ruta: '/api/auth/login', manejador: auth.login },
  { metodo: 'POST', ruta: '/api/auth/recuperar', manejador: auth.recuperar },

  // Facturas
  { metodo: 'GET', ruta: '/api/facturas', manejador: facturas.consultar },
  { metodo: 'POST', ruta: '/api/facturas/:id/pagar', manejador: facturas.pagar },
  { metodo: 'GET', ruta: '/api/facturas/:id/recibo', manejador: facturas.recibo },

  // PQR
  { metodo: 'POST', ruta: '/api/pqr', manejador: pqr.radicar },
  { metodo: 'GET', ruta: '/api/pqr', manejador: pqr.consultar },
  { metodo: 'PUT', ruta: '/api/pqr/:radicado', manejador: pqr.actualizar },

  // Noticias
  { metodo: 'GET', ruta: '/api/noticias', manejador: noticias.listar },
  { metodo: 'POST', ruta: '/api/noticias', manejador: noticias.crear },

  // Contacto
  { metodo: 'POST', ruta: '/api/contacto', manejador: contacto.enviar },
  { metodo: 'GET', ruta: '/api/contacto', manejador: contacto.listar },
];

// Convierte "/api/facturas/:id/pagar" en una expresión regular.
const rutasCompiladas = rutas.map((r) => {
  const nombres = [];
  const patron = r.ruta.replace(/:([a-zA-Z]+)/g, (_, nombre) => {
    nombres.push(nombre);
    return '([^/]+)';
  });
  return { ...r, regex: new RegExp(`^${patron}$`), nombres };
});

// ---------- Utilidades ----------

// Envía una respuesta JSON con el código HTTP indicado.
function responder(res, estado, contenido) {
  const texto = JSON.stringify(contenido);
  res.writeHead(estado, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(texto),
    // CORS: permite que el front-end (otro dominio) consuma la API.
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  });
  res.end(texto);
}

// Lee y convierte el cuerpo (JSON) de la petición.
function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let texto = '';
    req.on('data', (trozo) => {
      texto += trozo;
      if (texto.length > LIMITE_CUERPO) {
        reject(new ErrorHttp(413, 'El cuerpo de la petición es demasiado grande.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!texto) return resolve({});
      try {
        const objeto = JSON.parse(texto);
        if (objeto === null || typeof objeto !== 'object' || Array.isArray(objeto)) {
          return reject(new ErrorHttp(400, 'El cuerpo debe ser un objeto JSON.'));
        }
        resolve(objeto);
      } catch {
        reject(new ErrorHttp(400, 'El cuerpo no es un JSON válido.'));
      }
    });
    req.on('error', reject);
  });
}

// ---------- Servidor ----------
function crearServidor() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');

      // Respuesta a las consultas previas del navegador (CORS).
      if (req.method === 'OPTIONS') return responder(res, 204, {});

      // Busca la ruta que coincide con la dirección y el método.
      let rutaEncontrada = null;
      let params = {};
      let existeLaDireccion = false;
      for (const r of rutasCompiladas) {
        const coincide = url.pathname.match(r.regex);
        if (!coincide) continue;
        existeLaDireccion = true;
        if (r.metodo !== req.method) continue;
        rutaEncontrada = r;
        r.nombres.forEach((nombre, i) => (params[nombre] = decodeURIComponent(coincide[i + 1])));
        break;
      }

      if (!rutaEncontrada) {
        throw existeLaDireccion
          ? new ErrorHttp(405, `Método ${req.method} no permitido en ${url.pathname}.`)
          : new ErrorHttp(404, `La ruta ${url.pathname} no existe.`);
      }

      const body = ['POST', 'PUT'].includes(req.method) ? await leerCuerpo(req) : {};
      const query = Object.fromEntries(url.searchParams);

      const resultado = await rutaEncontrada.manejador({ req, params, query, body });
      responder(res, resultado.estado || 200, { ok: true, mensaje: resultado.mensaje, datos: resultado.datos });
    } catch (error) {
      if (error instanceof ErrorHttp) {
        return responder(res, error.estado, { ok: false, error: error.message, detalles: error.detalles });
      }
      console.error('Error inesperado:', error);
      responder(res, 500, { ok: false, error: 'Error interno del servidor.', detalles: [] });
    }
  });
}

// Solo arranca si se ejecuta con "node server.js" (no al importarlo en las pruebas).
if (require.main === module) {
  crearServidor().listen(PUERTO, () => {
    console.log(`API ESPM lista en http://localhost:${PUERTO}`);
    console.log('Prueba: http://localhost:' + PUERTO + '/api/salud');
  });
}

module.exports = { crearServidor };
