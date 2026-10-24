// ============================================================
// db.js
// "Base de datos" sencilla: un archivo JSON (data/db.json).
// - leer()    carga todo el contenido.
// - guardar() escribe todo el contenido.
// Si el archivo no existe, se crea solo con datos de ejemplo.
// Para cambiar de archivo (por ejemplo en las pruebas) se usa
// la variable de entorno DB_FILE.
// ============================================================

const fs = require('fs');
const path = require('path');
const { hashContrasena } = require('./seguridad');

const RUTA = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'db.json');

// Datos de ejemplo basados en las pantallas del proyecto ESPM.
function datosIniciales() {
  return {
    usuarios: [
      {
        id: 1,
        nombre: 'Administrador ESPM',
        cedula: '900123456',
        telefono: '3100000000',
        correo: 'admin@espm.gov.co',
        // Contraseña inicial del administrador (cámbiala con ADMIN_CLAVE).
        contrasena: hashContrasena(process.env.ADMIN_CLAVE || 'Admin12345'),
        rol: 'admin',
        creadoEn: new Date().toISOString(),
      },
    ],
    facturas: [
      {
        id: 'FAC-2025-0601',
        cuenta: '001-2345-6',
        cedula: '1234567890',
        titular: 'Juan Pérez',
        periodo: 'Mayo 2025',
        detalle: [
          { servicio: 'Acueducto', valor: 38500 },
          { servicio: 'Alcantarillado', valor: 21200 },
          { servicio: 'Aseo y Recolección', valor: 17300 },
        ],
        total: 77000,
        fechaVencimiento: '2025-06-20',
        estado: 'Pendiente',
      },
      {
        id: 'FAC-2025-0501',
        cuenta: '001-2345-6',
        cedula: '1234567890',
        titular: 'Juan Pérez',
        periodo: 'Abril 2025',
        detalle: [
          { servicio: 'Acueducto', valor: 36000 },
          { servicio: 'Alcantarillado', valor: 20500 },
          { servicio: 'Aseo y Recolección', valor: 17300 },
        ],
        total: 73800,
        fechaVencimiento: '2025-05-20',
        estado: 'Pagada',
        fechaPago: '2025-05-12T15:30:00.000Z',
        metodoPago: 'PSE',
        numeroRecibo: 'REC-2025-0001',
        pagadaPor: '1234567890',
      },
      {
        id: 'FAC-2025-0602',
        cuenta: '002-1000-1',
        cedula: '987654321',
        titular: 'María Gómez',
        periodo: 'Mayo 2025',
        detalle: [
          { servicio: 'Acueducto', valor: 29000 },
          { servicio: 'Aseo y Recolección', valor: 17300 },
        ],
        total: 46300,
        fechaVencimiento: '2025-06-20',
        estado: 'Pendiente',
      },
    ],
    pqr: [
      {
        radicado: 'PQR-2025-0189',
        tipo: 'Reclamo',
        servicio: 'Facturación',
        nombre: 'Juan Pérez',
        cedula: '1234567890',
        telefono: '3100000000',
        correo: 'juan@ejemplo.com',
        cuenta: '001-2345-6',
        descripcion: 'Cobro excesivo en factura de mayo',
        estado: 'En revisión',
        respuesta: null,
        fechaRadicacion: '2025-06-05T10:00:00.000Z',
        fechaLimite: '2025-06-26',
      },
      {
        radicado: 'PQR-2025-0143',
        tipo: 'Queja',
        servicio: 'Agua Potable',
        nombre: 'Juan Pérez',
        cedula: '1234567890',
        telefono: '3100000000',
        correo: 'juan@ejemplo.com',
        cuenta: '001-2345-6',
        descripcion: 'Baja presión del agua sector Ospina',
        estado: 'Resuelto',
        respuesta: 'Se ajustó la válvula de distribución del sector.',
        fechaRadicacion: '2025-05-20T09:00:00.000Z',
        fechaLimite: '2025-06-10',
      },
    ],
    noticias: [
      {
        id: 1,
        tipo: 'Corte',
        titulo: 'Corte programado de agua — Barrio Centro y Los Pinos',
        descripcion:
          'Por mantenimiento preventivo de la red de distribución principal, se realizará un corte de agua en los barrios Centro y Los Pinos.',
        horario: '8:00 AM - 4:00 PM',
        fecha: '2025-06-15',
      },
      {
        id: 2,
        tipo: 'Mantenimiento',
        titulo: 'Mantenimiento preventivo red de alcantarillado — Sector Norte',
        descripcion:
          'Trabajos de limpieza y mantenimiento en la red de alcantarillado del sector norte del municipio.',
        horario: '7:00 AM - 1:00 PM',
        fecha: '2025-06-18',
      },
      {
        id: 3,
        tipo: 'Comunicado',
        titulo: 'Nuevas tarifas de servicios públicos vigentes desde julio 2025',
        descripcion:
          'A partir del 1 de julio de 2025 entran en vigencia las nuevas tarifas aprobadas por la CRA para los servicios de acueducto, alcantarillado y aseo.',
        horario: null,
        fecha: '2025-06-10',
      },
      {
        id: 4,
        tipo: 'Corte',
        titulo: 'Suspensión servicio de aseo — Festivo 20 de julio',
        descripcion:
          'Con motivo del festivo nacional del 20 de julio, no habrá servicio de recolección de basuras. La ruta se reprogramará para el 21 de julio.',
        horario: 'Todo el día',
        fecha: '2025-07-20',
      },
      {
        id: 5,
        tipo: 'Comunicado',
        titulo: 'Inauguración nuevo tanque de almacenamiento',
        descripcion:
          'ESPM inaugura el nuevo tanque de almacenamiento de agua potable que mejorará la cobertura y presión del servicio en el municipio.',
        horario: null,
        fecha: '2025-06-05',
      },
    ],
    contactos: [],
    recuperaciones: [],
    // Contadores para generar identificadores consecutivos.
    contadores: { usuario: 1, pqr: 189, noticia: 5, contacto: 0, recibo: 1 },
  };
}

function guardar(datos) {
  fs.mkdirSync(path.dirname(RUTA), { recursive: true });
  fs.writeFileSync(RUTA, JSON.stringify(datos, null, 2), 'utf8');
}

function leer() {
  if (!fs.existsSync(RUTA)) {
    const iniciales = datosIniciales();
    guardar(iniciales);
    return iniciales;
  }
  return JSON.parse(fs.readFileSync(RUTA, 'utf8'));
}

module.exports = { leer, guardar };
