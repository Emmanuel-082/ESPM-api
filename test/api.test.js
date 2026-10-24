// ============================================================
// test/api.test.js
// Pruebas automáticas de la API. Se ejecutan con:  npm test
// Usan una base de datos temporal, así que no tocan data/db.json.
// ============================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

// La base de datos de prueba debe definirse ANTES de cargar el servidor.
const archivoDb = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'espm-')), 'db.json');
process.env.DB_FILE = archivoDb;
process.env.JWT_SECRETO = 'secreto-de-pruebas';

const { crearServidor } = require('../server');

let servidor;
let base;

test.before(async () => {
  servidor = crearServidor();
  await new Promise((ok) => servidor.listen(0, ok));
  base = `http://localhost:${servidor.address().port}`;
});

test.after(() => servidor.close());

// Ayudante para llamar a la API.
async function llamar(metodo, ruta, cuerpo, token) {
  const respuesta = await fetch(base + ruta, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return { estado: respuesta.status, json: await respuesta.json() };
}

const usuarioPrueba = {
  nombre: 'Juan Pérez',
  cedula: '1234567890',
  telefono: '3101234567',
  correo: 'juan@ejemplo.com',
  contrasena: 'Clave12345',
  confirmarContrasena: 'Clave12345',
};

let tokenUsuario;
let tokenAdmin;

// ---------------- Cuentas ----------------

test('registro: crea la cuenta y no devuelve la contraseña', async () => {
  const r = await llamar('POST', '/api/auth/registro', usuarioPrueba);
  assert.equal(r.estado, 201);
  assert.equal(r.json.datos.correo, 'juan@ejemplo.com');
  assert.equal(r.json.datos.contrasena, undefined);
});

test('registro: rechaza correo repetido (409)', async () => {
  const r = await llamar('POST', '/api/auth/registro', { ...usuarioPrueba, cedula: '5555555555' });
  assert.equal(r.estado, 409);
});

test('registro: rechaza cédula repetida (409)', async () => {
  const r = await llamar('POST', '/api/auth/registro', { ...usuarioPrueba, correo: 'otro@ejemplo.com' });
  assert.equal(r.estado, 409);
});

test('registro: valida datos incorrectos (400)', async () => {
  const r = await llamar('POST', '/api/auth/registro', {
    nombre: 'J',
    cedula: 'abc',
    telefono: '123',
    correo: 'no-es-correo',
    contrasena: '123',
    confirmarContrasena: '456',
  });
  assert.equal(r.estado, 400);
  assert.ok(r.json.detalles.length >= 5);
});

test('registro: las contraseñas deben coincidir (400)', async () => {
  const r = await llamar('POST', '/api/auth/registro', {
    ...usuarioPrueba,
    correo: 'nuevo@ejemplo.com',
    cedula: '1111111111',
    confirmarContrasena: 'Distinta123',
  });
  assert.equal(r.estado, 400);
  assert.ok(r.json.detalles.includes('Las contraseñas no coinciden.'));
});

test('login: credenciales correctas devuelven token', async () => {
  const r = await llamar('POST', '/api/auth/login', {
    correo: 'juan@ejemplo.com',
    contrasena: 'Clave12345',
  });
  assert.equal(r.estado, 200);
  assert.ok(r.json.datos.token);
  tokenUsuario = r.json.datos.token;
});

test('login: contraseña incorrecta devuelve error de autenticación (401)', async () => {
  const r = await llamar('POST', '/api/auth/login', { correo: 'juan@ejemplo.com', contrasena: 'Mala12345' });
  assert.equal(r.estado, 401);
  assert.match(r.json.error, /autenticación/);
});

test('login: usuario inexistente devuelve el mismo error (401)', async () => {
  const r = await llamar('POST', '/api/auth/login', { correo: 'nadie@ejemplo.com', contrasena: 'Clave12345' });
  assert.equal(r.estado, 401);
});

test('login: campos vacíos (400)', async () => {
  const r = await llamar('POST', '/api/auth/login', {});
  assert.equal(r.estado, 400);
});

test('login administrador', async () => {
  const r = await llamar('POST', '/api/auth/login', { correo: 'admin@espm.gov.co', contrasena: 'Admin12345' });
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.usuario.rol, 'admin');
  tokenAdmin = r.json.datos.token;
});

test('recuperar contraseña: responde lo mismo exista o no el correo', async () => {
  const a = await llamar('POST', '/api/auth/recuperar', { correo: 'juan@ejemplo.com' });
  const b = await llamar('POST', '/api/auth/recuperar', { correo: 'nadie@ejemplo.com' });
  assert.equal(a.estado, 200);
  assert.equal(a.json.mensaje, b.json.mensaje);
  const c = await llamar('POST', '/api/auth/recuperar', { correo: 'mal-correo' });
  assert.equal(c.estado, 400);
});

// ---------------- Facturas ----------------

test('facturas: consulta por número de cuenta', async () => {
  const r = await llamar('GET', '/api/facturas?cuenta=001-2345-6');
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.length, 2);
});

test('facturas: consulta por cédula', async () => {
  const r = await llamar('GET', '/api/facturas?cedula=987654321');
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos[0].cuenta, '002-1000-1');
});

test('facturas: sin parámetros (400), formato malo (400) y no encontrada (404)', async () => {
  assert.equal((await llamar('GET', '/api/facturas')).estado, 400);
  assert.equal((await llamar('GET', '/api/facturas?cuenta=123')).estado, 400);
  assert.equal((await llamar('GET', '/api/facturas?cuenta=999-9999-9')).estado, 404);
});

test('facturas: pagar exige sesión (401)', async () => {
  const r = await llamar('POST', '/api/facturas/FAC-2025-0601/pagar', { metodo: 'PSE' });
  assert.equal(r.estado, 401);
});

test('facturas: no se puede pagar la factura de otra persona (403)', async () => {
  const r = await llamar('POST', '/api/facturas/FAC-2025-0602/pagar', { metodo: 'PSE' }, tokenUsuario);
  assert.equal(r.estado, 403);
});

test('facturas: método de pago inválido (400)', async () => {
  const r = await llamar('POST', '/api/facturas/FAC-2025-0601/pagar', { metodo: 'Bitcoin' }, tokenUsuario);
  assert.equal(r.estado, 400);
});

test('facturas: recibo de una factura pendiente no se genera (409)', async () => {
  const r = await llamar('GET', '/api/facturas/FAC-2025-0601/recibo', null, tokenUsuario);
  assert.equal(r.estado, 409);
});

test('facturas: pagar y generar recibo', async () => {
  const pago = await llamar('POST', '/api/facturas/FAC-2025-0601/pagar', { metodo: 'PSE' }, tokenUsuario);
  assert.equal(pago.estado, 200);
  assert.match(pago.json.datos.numeroRecibo, /^REC-\d{4}-\d{4}$/);

  const recibo = await llamar('GET', '/api/facturas/FAC-2025-0601/recibo', null, tokenUsuario);
  assert.equal(recibo.estado, 200);
  assert.equal(recibo.json.datos.totalPagado, 77000);
});

test('facturas: no se paga dos veces (409) y factura inexistente (404)', async () => {
  const dos = await llamar('POST', '/api/facturas/FAC-2025-0601/pagar', { metodo: 'PSE' }, tokenUsuario);
  assert.equal(dos.estado, 409);
  const no = await llamar('POST', '/api/facturas/FAC-0000/pagar', { metodo: 'PSE' }, tokenUsuario);
  assert.equal(no.estado, 404);
});

// ---------------- PQR ----------------

const pqrValida = {
  tipo: 'Reclamo',
  servicio: 'Facturación',
  nombre: 'Juan Pérez',
  cedula: '1234567890',
  telefono: '3101234567',
  correo: 'juan@ejemplo.com',
  cuenta: '001-2345-6',
  descripcion: 'Me cobraron dos veces el servicio de aseo.',
};

let radicadoNuevo;

test('pqr: radicar devuelve número de radicado y fecha límite', async () => {
  const r = await llamar('POST', '/api/pqr', pqrValida);
  assert.equal(r.estado, 201);
  assert.match(r.json.datos.radicado, /^PQR-\d{4}-0190$/);
  assert.equal(r.json.datos.estado, 'Radicado');
  assert.ok(r.json.datos.fechaLimite);
  radicadoNuevo = r.json.datos.radicado;
});

test('pqr: validaciones (tipo, servicio, descripción corta)', async () => {
  const r = await llamar('POST', '/api/pqr', { ...pqrValida, tipo: 'Otro', servicio: 'Gas', descripcion: 'corta' });
  assert.equal(r.estado, 400);
  assert.equal(r.json.detalles.length, 3);
});

test('pqr: consultar por cédula', async () => {
  const r = await llamar('GET', '/api/pqr?cedula=1234567890');
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.length, 3); // 2 de ejemplo + la nueva
});

test('pqr: sin cédula (400) y cédula sin casos (404)', async () => {
  assert.equal((await llamar('GET', '/api/pqr')).estado, 400);
  assert.equal((await llamar('GET', '/api/pqr?cedula=1000000000')).estado, 404);
});

test('pqr: el administrador lista todas sin cédula', async () => {
  const r = await llamar('GET', '/api/pqr', null, tokenAdmin);
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.length, 3);
});

test('pqr: actualizar exige ser administrador (401 y 403)', async () => {
  assert.equal((await llamar('PUT', `/api/pqr/${radicadoNuevo}`, { estado: 'Resuelto' })).estado, 401);
  assert.equal(
    (await llamar('PUT', `/api/pqr/${radicadoNuevo}`, { estado: 'Resuelto' }, tokenUsuario)).estado,
    403
  );
});

test('pqr: administrador cambia estado; resolver exige respuesta', async () => {
  const sinRespuesta = await llamar('PUT', `/api/pqr/${radicadoNuevo}`, { estado: 'Resuelto' }, tokenAdmin);
  assert.equal(sinRespuesta.estado, 400);

  const ok = await llamar(
    'PUT',
    `/api/pqr/${radicadoNuevo}`,
    { estado: 'Resuelto', respuesta: 'Se reversó el cobro duplicado.' },
    tokenAdmin
  );
  assert.equal(ok.estado, 200);
  assert.equal(ok.json.datos.estado, 'Resuelto');

  const noExiste = await llamar('PUT', '/api/pqr/PQR-0000-0000', { estado: 'Cerrado' }, tokenAdmin);
  assert.equal(noExiste.estado, 404);
});

// ---------------- Noticias ----------------

test('noticias: listar, filtrar por tipo y buscar', async () => {
  const todas = await llamar('GET', '/api/noticias');
  assert.equal(todas.json.datos.length, 5);
  const cortes = await llamar('GET', '/api/noticias?tipo=Corte');
  assert.equal(cortes.json.datos.length, 2);
  const buscar = await llamar('GET', '/api/noticias?buscar=tanque');
  assert.equal(buscar.json.datos.length, 1);
  assert.equal((await llamar('GET', '/api/noticias?tipo=Otro')).estado, 400);
});

test('noticias: publicar exige administrador y valida datos', async () => {
  const nueva = { tipo: 'Comunicado', titulo: 'Horario de atención', descripcion: 'Atenderemos hasta las 5 PM.' };
  assert.equal((await llamar('POST', '/api/noticias', nueva)).estado, 401);
  assert.equal((await llamar('POST', '/api/noticias', nueva, tokenUsuario)).estado, 403);
  assert.equal((await llamar('POST', '/api/noticias', { tipo: 'X' }, tokenAdmin)).estado, 400);
  const ok = await llamar('POST', '/api/noticias', nueva, tokenAdmin);
  assert.equal(ok.estado, 201);
  assert.equal(ok.json.datos.id, 6);
});

// ---------------- Contacto ----------------

test('contacto: enviar mensaje y validaciones', async () => {
  const mensaje = {
    nombre: 'Ana Torres',
    telefono: '3001112233',
    correo: 'ana@ejemplo.com',
    mensaje: '¿Hasta qué hora atienden los sábados?',
  };
  const ok = await llamar('POST', '/api/contacto', mensaje);
  assert.equal(ok.estado, 201);
  assert.equal((await llamar('POST', '/api/contacto', { ...mensaje, correo: 'mal', mensaje: 'hola' })).estado, 400);
});

test('contacto: solo el administrador ve los mensajes', async () => {
  assert.equal((await llamar('GET', '/api/contacto')).estado, 401);
  const r = await llamar('GET', '/api/contacto', null, tokenAdmin);
  assert.equal(r.estado, 200);
  assert.equal(r.json.datos.length, 1);
});

// ---------------- Generales ----------------

test('rutas: inexistente (404), método no permitido (405) y JSON roto (400)', async () => {
  assert.equal((await llamar('GET', '/api/no-existe')).estado, 404);
  assert.equal((await llamar('DELETE', '/api/noticias')).estado, 405);
  const rota = await fetch(base + '/api/auth/login', { method: 'POST', body: '{no es json' });
  assert.equal(rota.status, 400);
});

test('seguridad: un token alterado se rechaza (401)', async () => {
  const falso = tokenUsuario.slice(0, -3) + 'abc';
  const r = await llamar('POST', '/api/facturas/FAC-2025-0602/pagar', { metodo: 'PSE' }, falso);
  assert.equal(r.estado, 401);
});

test('seguridad: las contraseñas se guardan con hash, no en texto plano', () => {
  const db = JSON.parse(fs.readFileSync(archivoDb, 'utf8'));
  const juan = db.usuarios.find((u) => u.correo === 'juan@ejemplo.com');
  assert.notEqual(juan.contrasena, 'Clave12345');
  assert.match(juan.contrasena, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
});
