// ============================================================
// controladores/auth.js
// Servicios de cuentas de usuario:
//   POST /api/auth/registro
//   POST /api/auth/login
//   POST /api/auth/recuperar
// ============================================================

const crypto = require('crypto');
const db = require('../db');
const { ErrorHttp } = require('../errores');
const { hashContrasena, verificarContrasena, crearToken } = require('../seguridad');
const V = require('../validaciones');

// Quita la contraseña antes de devolver un usuario al cliente.
function usuarioPublico(u) {
  return { id: u.id, nombre: u.nombre, cedula: u.cedula, telefono: u.telefono, correo: u.correo, rol: u.rol };
}

// ---------- Registro (pantalla "Crear cuenta", 3 pasos) ----------
function registro({ body }) {
  const nombre = V.limpiar(body.nombre);
  const cedula = V.limpiar(body.cedula);
  const telefono = V.limpiar(body.telefono);
  const correo = V.limpiar(body.correo).toLowerCase();

  V.lanzarSiHayErrores([
    V.validarNombre(nombre),
    V.validarCedula(cedula),
    V.validarTelefono(telefono),
    V.validarCorreo(correo),
    V.validarContrasena(body.contrasena),
    body.contrasena !== body.confirmarContrasena ? 'Las contraseñas no coinciden.' : null,
  ]);

  const datos = db.leer();

  // No se permiten correos ni cédulas repetidos.
  if (datos.usuarios.some((u) => u.correo === correo)) {
    throw new ErrorHttp(409, 'Ya existe una cuenta registrada con ese correo.');
  }
  if (datos.usuarios.some((u) => u.cedula === cedula)) {
    throw new ErrorHttp(409, 'Ya existe una cuenta registrada con esa cédula/NIT.');
  }

  datos.contadores.usuario += 1;
  const nuevo = {
    id: datos.contadores.usuario,
    nombre,
    cedula,
    telefono,
    correo,
    contrasena: hashContrasena(body.contrasena),
    rol: 'usuario', // todos los registros públicos son usuarios normales
    creadoEn: new Date().toISOString(),
  };
  datos.usuarios.push(nuevo);
  db.guardar(datos);

  return { estado: 201, mensaje: 'Cuenta creada correctamente.', datos: usuarioPublico(nuevo) };
}

// ---------- Inicio de sesión ----------
function login({ body }) {
  const correo = V.limpiar(body.correo).toLowerCase();
  const contrasena = typeof body.contrasena === 'string' ? body.contrasena : '';

  V.lanzarSiHayErrores([
    correo ? null : 'El correo es obligatorio.',
    contrasena ? null : 'La contraseña es obligatoria.',
  ]);

  const usuario = db.leer().usuarios.find((u) => u.correo === correo);

  // Mismo mensaje si falla el correo o la contraseña (no revela cuál fue).
  if (!usuario || !verificarContrasena(contrasena, usuario.contrasena)) {
    throw new ErrorHttp(401, 'Error de autenticación: correo o contraseña incorrectos.');
  }

  const token = crearToken({
    id: usuario.id,
    correo: usuario.correo,
    rol: usuario.rol,
    cedula: usuario.cedula,
  });

  return { mensaje: 'Inicio de sesión exitoso.', datos: { token, usuario: usuarioPublico(usuario) } };
}

// ---------- Recuperar contraseña ----------
// Siempre responde lo mismo, exista o no el correo, para no revelar
// qué correos están registrados. En un sistema real aquí se enviaría
// un correo; en este proyecto se guarda el código y se muestra en consola.
function recuperar({ body }) {
  const correo = V.limpiar(body.correo).toLowerCase();
  V.lanzarSiHayErrores([V.validarCorreo(correo)]);

  const datos = db.leer();
  if (datos.usuarios.some((u) => u.correo === correo)) {
    const codigo = crypto.randomBytes(16).toString('hex');
    datos.recuperaciones.push({
      correo,
      codigo,
      expira: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
    db.guardar(datos);
    console.log(`[correo simulado] Enlace de recuperación para ${correo}: código ${codigo}`);
  }

  return { mensaje: 'Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.' };
}

module.exports = { registro, login, recuperar };
