// ============================================================
// controladores/contacto.js
// Pantalla "Contáctenos" (formulario "Envíanos un mensaje"):
//   POST /api/contacto   (público)
//   GET  /api/contacto   (administrador: ver los mensajes recibidos)
// ============================================================

const db = require('../db');
const { exigirAdmin } = require('../seguridad');
const V = require('../validaciones');

function enviar({ body }) {
  const mensaje = {
    nombre: V.limpiar(body.nombre),
    telefono: V.limpiar(body.telefono),
    correo: V.limpiar(body.correo).toLowerCase(),
    mensaje: V.limpiar(body.mensaje),
  };

  V.lanzarSiHayErrores([
    V.validarNombre(mensaje.nombre),
    V.validarTelefono(mensaje.telefono),
    V.validarCorreo(mensaje.correo),
    V.validarTextoLargo(mensaje.mensaje, 'El mensaje', 10, 1000),
  ]);

  const datos = db.leer();
  datos.contadores.contacto += 1;
  const nuevo = { id: datos.contadores.contacto, ...mensaje, recibidoEn: new Date().toISOString() };
  datos.contactos.push(nuevo);
  db.guardar(datos);

  return { estado: 201, mensaje: 'Mensaje enviado. Te responderemos pronto.', datos: { id: nuevo.id } };
}

function listar({ req }) {
  exigirAdmin(req);
  const lista = db.leer().contactos;
  return { mensaje: `${lista.length} mensaje(s).`, datos: lista };
}

module.exports = { enviar, listar };
