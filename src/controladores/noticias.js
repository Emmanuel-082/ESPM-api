// ============================================================
// controladores/noticias.js
// Pantalla "Noticias y Comunicados":
//   GET  /api/noticias?tipo=Corte&buscar=agua   (público)
//   POST /api/noticias                          (administrador)
// ============================================================

const db = require('../db');
const { ErrorHttp } = require('../errores');
const { exigirAdmin } = require('../seguridad');
const V = require('../validaciones');

const TIPOS = ['Corte', 'Mantenimiento', 'Comunicado'];

// ---------- Listar ----------
function listar({ query }) {
  const tipo = V.limpiar(query.tipo);
  const buscar = V.limpiar(query.buscar).toLowerCase();

  if (tipo && !TIPOS.includes(tipo)) {
    throw new ErrorHttp(400, `El tipo debe ser uno de: ${TIPOS.join(', ')}.`);
  }

  let lista = db.leer().noticias;
  if (tipo) lista = lista.filter((n) => n.tipo === tipo);
  if (buscar) {
    lista = lista.filter((n) => `${n.titulo} ${n.descripcion}`.toLowerCase().includes(buscar));
  }
  // Las más recientes primero.
  lista = [...lista].sort((a, b) => b.fecha.localeCompare(a.fecha));

  return { mensaje: `${lista.length} noticia(s).`, datos: lista };
}

// ---------- Publicar (solo administrador) ----------
function crear({ req, body }) {
  exigirAdmin(req);

  const noticia = {
    tipo: V.limpiar(body.tipo),
    titulo: V.limpiar(body.titulo),
    descripcion: V.limpiar(body.descripcion),
    horario: V.limpiar(body.horario) || null,
    fecha: V.limpiar(body.fecha) || new Date().toISOString().slice(0, 10),
  };

  V.lanzarSiHayErrores([
    V.validarUnoDeLista(noticia.tipo, TIPOS, 'El tipo'),
    V.validarTextoLargo(noticia.titulo, 'El título', 5, 150),
    V.validarTextoLargo(noticia.descripcion, 'La descripción', 10, 1000),
    /^\d{4}-\d{2}-\d{2}$/.test(noticia.fecha) && !Number.isNaN(Date.parse(noticia.fecha))
      ? null
      : 'La fecha debe tener el formato AAAA-MM-DD.',
  ]);

  const datos = db.leer();
  datos.contadores.noticia += 1;
  const nueva = { id: datos.contadores.noticia, ...noticia };
  datos.noticias.push(nueva);
  db.guardar(datos);

  return { estado: 201, mensaje: 'Noticia publicada.', datos: nueva };
}

module.exports = { listar, crear };
