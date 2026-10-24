// ============================================================
// errores.js
// Define un tipo de error propio para responder con el código
// HTTP correcto (400, 401, 403, 404, 409...).
// ============================================================

class ErrorHttp extends Error {
  /**
   * @param {number} estado   Código HTTP (ej: 400, 404)
   * @param {string} mensaje  Texto que verá quien consume la API
   * @param {string[]} detalles Lista opcional de errores de validación
   */
  constructor(estado, mensaje, detalles = []) {
    super(mensaje);
    this.estado = estado;
    this.detalles = detalles;
  }
}

module.exports = { ErrorHttp };
