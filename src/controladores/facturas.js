// ============================================================
// controladores/facturas.js
// Servicios de facturación (pantalla "Consulta y Pago de Facturas"):
//   GET  /api/facturas?cuenta=...  (o ?cedula=...)
//   POST /api/facturas/:id/pagar
//   GET  /api/facturas/:id/recibo
// ============================================================

const db = require('../db');
const { ErrorHttp } = require('../errores');
const { exigirSesion } = require('../seguridad');
const V = require('../validaciones');

const METODOS_PAGO = ['PSE', 'Tarjeta'];

// Una factura pendiente cuya fecha de vencimiento ya pasó se muestra "Vencida".
function conEstadoActual(factura) {
  const hoy = new Date().toISOString().slice(0, 10);
  if (factura.estado === 'Pendiente' && factura.fechaVencimiento < hoy) {
    return { ...factura, estado: 'Vencida' };
  }
  return factura;
}

// Solo el dueño de la factura (misma cédula) o el administrador pueden operarla.
function exigirDuenoOAdmin(usuario, factura) {
  if (usuario.rol !== 'admin' && usuario.cedula !== factura.cedula) {
    throw new ErrorHttp(403, 'Esta factura no pertenece a tu cuenta.');
  }
}

function buscarFactura(datos, id) {
  const factura = datos.facturas.find((f) => f.id === id);
  if (!factura) throw new ErrorHttp(404, `No existe la factura ${id}.`);
  return factura;
}

// ---------- Consultar facturas ----------
function consultar({ query }) {
  const cuenta = V.limpiar(query.cuenta);
  const cedula = V.limpiar(query.cedula);

  if (!cuenta && !cedula) {
    throw new ErrorHttp(400, 'Debes indicar el número de cuenta (?cuenta=) o la cédula/NIT (?cedula=).');
  }
  if (cuenta && !/^\d{3}-\d{4}-\d$/.test(cuenta)) {
    throw new ErrorHttp(400, 'El número de cuenta debe tener el formato 001-2345-6.');
  }
  if (cedula && V.validarCedula(cedula)) {
    throw new ErrorHttp(400, V.validarCedula(cedula));
  }

  const encontradas = db
    .leer()
    .facturas.filter((f) => (cuenta ? f.cuenta === cuenta : f.cedula === cedula))
    .map(conEstadoActual);

  if (encontradas.length === 0) {
    throw new ErrorHttp(404, 'No se encontraron facturas para los datos indicados.');
  }
  return { mensaje: `Se encontraron ${encontradas.length} factura(s).`, datos: encontradas };
}

// ---------- Pagar una factura ----------
function pagar({ req, params, body }) {
  const usuario = exigirSesion(req);
  const metodo = V.limpiar(body.metodo);
  V.lanzarSiHayErrores([V.validarUnoDeLista(metodo, METODOS_PAGO, 'El método de pago')]);

  const datos = db.leer();
  const factura = buscarFactura(datos, params.id);
  exigirDuenoOAdmin(usuario, factura);

  if (factura.estado === 'Pagada') {
    throw new ErrorHttp(409, 'Esta factura ya fue pagada.');
  }

  datos.contadores.recibo += 1;
  factura.estado = 'Pagada';
  factura.fechaPago = new Date().toISOString();
  factura.metodoPago = metodo;
  factura.numeroRecibo = `REC-${new Date().getFullYear()}-${String(datos.contadores.recibo).padStart(4, '0')}`;
  factura.pagadaPor = usuario.cedula;
  db.guardar(datos);

  return { mensaje: 'Pago registrado correctamente.', datos: construirRecibo(factura) };
}

// ---------- Generar recibo ----------
function construirRecibo(factura) {
  return {
    numeroRecibo: factura.numeroRecibo,
    factura: factura.id,
    cuenta: factura.cuenta,
    titular: factura.titular,
    periodo: factura.periodo,
    detalle: factura.detalle,
    totalPagado: factura.total,
    metodoPago: factura.metodoPago,
    fechaPago: factura.fechaPago,
  };
}

function recibo({ req, params }) {
  const usuario = exigirSesion(req);
  const factura = buscarFactura(db.leer(), params.id);
  exigirDuenoOAdmin(usuario, factura);

  if (factura.estado !== 'Pagada') {
    throw new ErrorHttp(409, 'El recibo solo se genera cuando la factura está pagada.');
  }
  return { mensaje: 'Recibo generado.', datos: construirRecibo(factura) };
}

module.exports = { consultar, pagar, recibo };
