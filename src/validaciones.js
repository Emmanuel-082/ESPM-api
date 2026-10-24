// ============================================================
// validaciones.js
// Funciones que revisan los datos que llegan en cada petición.
// Cada una devuelve un texto con el error, o null si todo está bien.
// Los controladores juntan los errores y, si hay alguno, responden
// 400 (Solicitud incorrecta) sin guardar nada.
// ============================================================

const { ErrorHttp } = require('./errores');

// Quita espacios sobrantes; si no es texto devuelve cadena vacía.
function limpiar(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function validarNombre(valor) {
  const v = limpiar(valor);
  if (v.length < 3 || v.length > 80) return 'El nombre debe tener entre 3 y 80 caracteres.';
  if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü' ]+$/.test(v)) return 'El nombre solo puede tener letras y espacios.';
  return null;
}

function validarCedula(valor) {
  const v = limpiar(valor);
  if (!/^\d{6,10}$/.test(v)) return 'La cédula/NIT debe tener entre 6 y 10 dígitos, solo números.';
  return null;
}

function validarTelefono(valor) {
  const v = limpiar(valor);
  if (!/^3\d{9}$/.test(v)) return 'El teléfono debe ser un celular colombiano de 10 dígitos que empiece por 3.';
  return null;
}

function validarCorreo(valor) {
  const v = limpiar(valor);
  if (v.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
    return 'El correo electrónico no tiene un formato válido.';
  }
  return null;
}

function validarContrasena(valor) {
  if (typeof valor !== 'string' || valor.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (valor.length > 64) return 'La contraseña no puede superar 64 caracteres.';
  if (!/[A-Za-z]/.test(valor) || !/\d/.test(valor)) return 'La contraseña debe combinar letras y números.';
  return null;
}

function validarTextoLargo(valor, campo, minimo = 10, maximo = 2000) {
  const v = limpiar(valor);
  if (v.length < minimo) return `${campo} debe tener al menos ${minimo} caracteres.`;
  if (v.length > maximo) return `${campo} no puede superar ${maximo} caracteres.`;
  return null;
}

function validarUnoDeLista(valor, lista, campo) {
  if (!lista.includes(valor)) return `${campo} debe ser uno de: ${lista.join(', ')}.`;
  return null;
}

// Recibe una lista de resultados (texto o null), y si hay errores lanza 400.
function lanzarSiHayErrores(resultados) {
  const errores = resultados.filter(Boolean);
  if (errores.length > 0) {
    throw new ErrorHttp(400, 'Los datos enviados no son válidos.', errores);
  }
}

module.exports = {
  limpiar,
  validarNombre,
  validarCedula,
  validarTelefono,
  validarCorreo,
  validarContrasena,
  validarTextoLargo,
  validarUnoDeLista,
  lanzarSiHayErrores,
};
