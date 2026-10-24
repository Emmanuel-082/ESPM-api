// ============================================================
// seguridad.js
// Funciones para proteger contraseñas y manejar sesiones.
// Solo usa el módulo "crypto" que ya trae Node.js.
//
//  - Las contraseñas NUNCA se guardan en texto plano: se guarda
//    un "hash" (huella irreversible) creado con scrypt + una sal.
//  - Al iniciar sesión se entrega un token firmado (formato JWT)
//    que el cliente envía en la cabecera:
//        Authorization: Bearer <token>
// ============================================================

const crypto = require('crypto');
const { ErrorHttp } = require('./errores');

// Clave con la que se firman los tokens. En producción debe
// definirse con la variable de entorno JWT_SECRETO.
const SECRETO = process.env.JWT_SECRETO || 'clave-solo-para-desarrollo-cambiala';

// ---------- Contraseñas ----------

function hashContrasena(contrasena) {
  const sal = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(contrasena, sal, 64).toString('hex');
  return `${sal}:${hash}`; // se guarda "sal:hash"
}

function verificarContrasena(contrasena, almacenado) {
  const [sal, hashGuardado] = almacenado.split(':');
  const hashNuevo = crypto.scryptSync(contrasena, sal, 64);
  return crypto.timingSafeEqual(Buffer.from(hashGuardado, 'hex'), hashNuevo);
}

// ---------- Tokens (JWT sencillo, firma HMAC-SHA256) ----------

function aBase64Url(texto) {
  return Buffer.from(texto).toString('base64url');
}

function firmar(contenido) {
  return crypto.createHmac('sha256', SECRETO).update(contenido).digest('base64url');
}

function crearToken(datos, horasDeVida = 2) {
  const cabecera = aBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = Math.floor(Date.now() / 1000) + horasDeVida * 3600;
  const cuerpo = aBase64Url(JSON.stringify({ ...datos, exp }));
  return `${cabecera}.${cuerpo}.${firmar(`${cabecera}.${cuerpo}`)}`;
}

// Devuelve los datos del token si es válido y no ha vencido; si no, null.
function verificarToken(token) {
  const partes = (token || '').split('.');
  if (partes.length !== 3) return null;
  const [cabecera, cuerpo, firma] = partes;

  const firmaEsperada = firmar(`${cabecera}.${cuerpo}`);
  const a = Buffer.from(firma);
  const b = Buffer.from(firmaEsperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const datos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
    if (!datos.exp || datos.exp < Math.floor(Date.now() / 1000)) return null;
    return datos;
  } catch {
    return null;
  }
}

// ---------- Control de acceso ----------

// Exige que la petición traiga un token válido. Devuelve los datos del usuario.
function exigirSesion(req) {
  const cabecera = req.headers['authorization'] || '';
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : '';
  const datos = verificarToken(token);
  if (!datos) {
    throw new ErrorHttp(401, 'Debes iniciar sesión para usar este servicio.');
  }
  return datos; // { id, correo, rol, cedula, exp }
}

// Exige sesión y además que el usuario sea administrador.
function exigirAdmin(req) {
  const usuario = exigirSesion(req);
  if (usuario.rol !== 'admin') {
    throw new ErrorHttp(403, 'Solo el administrador puede usar este servicio.');
  }
  return usuario;
}

// Devuelve la sesión si existe, o null si no hay token (sin lanzar error).
function sesionOpcional(req) {
  const cabecera = req.headers['authorization'] || '';
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : '';
  return verificarToken(token);
}

module.exports = {
  hashContrasena,
  verificarContrasena,
  crearToken,
  verificarToken,
  exigirSesion,
  exigirAdmin,
  sesionOpcional,
};
