// ============================================================
// controladores/pqr.js
// Peticiones, Quejas y Reclamos (pantalla "PQR"):
//   POST /api/pqr            radicar una PQR
//   GET  /api/pqr?cedula=... consultar el estado de las PQR de una persona
//   PUT  /api/pqr/:radicado  (administrador) cambiar estado / responder
// ============================================================

const db = require('../db');
const { ErrorHttp } = require('../errores');
const { exigirAdmin, sesionOpcional } = require('../seguridad');
const V = require('../validaciones');

const TIPOS = ['Petición', 'Queja', 'Reclamo', 'Sugerencia'];
const SERVICIOS = ['Agua Potable', 'Alcantarillado', 'Aseo y Recolección', 'Facturación'];
const ESTADOS = ['Radicado', 'En revisión', 'Resuelto', 'Cerrado'];
const DIAS_HABILES_RESPUESTA = 15; // plazo legal que muestra la pantalla

// Suma días hábiles (lunes a viernes) a una fecha. No considera festivos.
function sumarDiasHabiles(fecha, dias) {
  const resultado = new Date(fecha);
  let sumados = 0;
  while (sumados < dias) {
    resultado.setDate(resultado.getDate() + 1);
    const dia = resultado.getDay(); // 0 = domingo, 6 = sábado
    if (dia !== 0 && dia !== 6) sumados += 1;
  }
  return resultado.toISOString().slice(0, 10);
}

// ---------- Radicar ----------
function radicar({ body }) {
  const datosPqr = {
    tipo: V.limpiar(body.tipo),
    servicio: V.limpiar(body.servicio),
    nombre: V.limpiar(body.nombre),
    cedula: V.limpiar(body.cedula),
    telefono: V.limpiar(body.telefono),
    correo: V.limpiar(body.correo).toLowerCase(),
    cuenta: V.limpiar(body.cuenta), // opcional
    descripcion: V.limpiar(body.descripcion),
  };

  V.lanzarSiHayErrores([
    V.validarUnoDeLista(datosPqr.tipo, TIPOS, 'El tipo de solicitud'),
    V.validarUnoDeLista(datosPqr.servicio, SERVICIOS, 'El servicio relacionado'),
    V.validarNombre(datosPqr.nombre),
    V.validarCedula(datosPqr.cedula),
    V.validarTelefono(datosPqr.telefono),
    V.validarCorreo(datosPqr.correo),
    datosPqr.cuenta && !/^\d{3}-\d{4}-\d$/.test(datosPqr.cuenta)
      ? 'El número de cuenta debe tener el formato 001-2345-6.'
      : null,
    V.validarTextoLargo(datosPqr.descripcion, 'La descripción del caso', 10, 2000),
  ]);

  const datos = db.leer();
  datos.contadores.pqr += 1;
  const ahora = new Date();
  const nueva = {
    radicado: `PQR-${ahora.getFullYear()}-${String(datos.contadores.pqr).padStart(4, '0')}`,
    ...datosPqr,
    cuenta: datosPqr.cuenta || null,
    estado: 'Radicado',
    respuesta: null,
    fechaRadicacion: ahora.toISOString(),
    fechaLimite: sumarDiasHabiles(ahora, DIAS_HABILES_RESPUESTA),
  };
  datos.pqr.push(nueva);
  db.guardar(datos);

  return { estado: 201, mensaje: `PQR radicada con el número ${nueva.radicado}.`, datos: nueva };
}

// ---------- Consultar estado ----------
// Usuario (o visitante): debe indicar su cédula.
// Administrador (con token): puede listar todas si no indica cédula.
function consultar({ req, query }) {
  const cedula = V.limpiar(query.cedula);
  const sesion = sesionOpcional(req);
  const esAdmin = sesion && sesion.rol === 'admin';

  let lista;
  if (cedula) {
    const error = V.validarCedula(cedula);
    if (error) throw new ErrorHttp(400, error);
    lista = db.leer().pqr.filter((p) => p.cedula === cedula);
  } else if (esAdmin) {
    lista = db.leer().pqr;
  } else {
    throw new ErrorHttp(400, 'Debes indicar la cédula a consultar (?cedula=).');
  }

  if (lista.length === 0) {
    throw new ErrorHttp(404, 'No se encontraron PQR para los datos indicados.');
  }
  return { mensaje: `Se encontraron ${lista.length} PQR.`, datos: lista };
}

// ---------- Actualizar (solo administrador) ----------
function actualizar({ req, params, body }) {
  exigirAdmin(req);
  const estado = V.limpiar(body.estado);
  const respuesta = V.limpiar(body.respuesta);

  V.lanzarSiHayErrores([
    V.validarUnoDeLista(estado, ESTADOS, 'El estado'),
    estado === 'Resuelto' && respuesta.length < 10
      ? 'Para marcar una PQR como Resuelta debes escribir la respuesta (mínimo 10 caracteres).'
      : null,
  ]);

  const datos = db.leer();
  const pqr = datos.pqr.find((p) => p.radicado === params.radicado);
  if (!pqr) throw new ErrorHttp(404, `No existe la PQR ${params.radicado}.`);

  pqr.estado = estado;
  if (respuesta) pqr.respuesta = respuesta;
  db.guardar(datos);

  return { mensaje: `La PQR ${pqr.radicado} ahora está en estado "${estado}".`, datos: pqr };
}

module.exports = { radicar, consultar, actualizar };
