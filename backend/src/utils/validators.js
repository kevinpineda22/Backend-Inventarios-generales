/**
 * Validar fila de la base de datos maestra
 */
export const validateMaestraRow = (row) => {
  if (!row.codigo || typeof row.codigo !== 'string' || row.codigo.trim() === '') {
    return { valid: false, error: 'El campo "codigo" es requerido' };
  }
  if (!row.item || typeof row.item !== 'string' || row.item.trim() === '') {
    return { valid: false, error: 'El campo "item" es requerido' };
  }
  if (!row.descripcion || typeof row.descripcion !== 'string' || row.descripcion.trim() === '') {
    return { valid: false, error: 'El campo "descripcion" es requerido' };
  }
  if (!row.unidad_medida || typeof row.unidad_medida !== 'string' || row.unidad_medida.trim() === '') {
    return { valid: false, error: 'El campo "unidad_medida" es requerido' };
  }
  return { valid: true };
};
// =====================================================
// UTILIDAD: VALIDACIONES
// =====================================================

/**
 * Validar que un valor no esté vacío
 */
export const isNotEmpty = (value) => {
  return value !== null && value !== undefined && value !== '';
};

/**
 * Validar UUID
 */
export const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Validar email
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validar número positivo
 */
export const isPositiveNumber = (value) => {
  return typeof value === 'number' && value > 0;
};

/**
 * Validar número no negativo
 */
export const isNonNegativeNumber = (value) => {
  return typeof value === 'number' && value >= 0;
};

/**
 * Validar tipo de conteo (1, 2, 3)
 */
export const isValidTipoConteo = (tipo) => {
  return [1, 2, 3].includes(parseInt(tipo));
};

/**
 * Validar estado de conteo
 */
export const isValidEstadoConteo = (estado) => {
  const estadosValidos = ['en_progreso', 'finalizado', 'pendiente', 'aprobado', 'rechazado'];
  return estadosValidos.includes(estado);
};

/**
 * Validar estructura de item del Excel
 */
export const validateExcelItem = (item) => {
  const errors = [];

  if (!isNotEmpty(item.item)) {
    errors.push('Campo "item" es requerido');
  }

  if (!isNotEmpty(item.descripcion)) {
    errors.push('Campo "descripcion" es requerido');
  }

  if (!isNotEmpty(item.codigo_barra)) {
    errors.push('Campo "codigo_barra" es requerido');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Sanitizar string (remover caracteres especiales)
 */
export const sanitizeString = (str) => {
  if (!str) return '';
  return str.trim().replace(/[<>]/g, '');
};

/**
 * Validar longitud de string
 */
export const isValidLength = (str, min, max) => {
  if (!str) return false;
  const length = str.length;
  return length >= min && length <= max;
};

/**
 * Validar compañía ID
 */
export const isValidCompaniaId = (companiaId) => {
  return isNotEmpty(companiaId);
};

/**
 * Validar datos de bodega
 */
export const validateBodegaData = (data) => {
  const errors = [];

  if (!isNotEmpty(data.nombre)) {
    errors.push('Nombre de bodega es requerido');
  }

  if (!isValidCompaniaId(data.compania_id)) {
    errors.push('ID de compañía es requerido');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validar datos de zona
 */
export const validateZonaData = (data) => {
  const errors = [];

  if (!isNotEmpty(data.nombre)) {
    errors.push('Nombre de zona es requerido');
  }

  if (!isValidUUID(data.bodega_id)) {
    errors.push('ID de bodega válido es requerido');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validar datos de pasillo
 */
export const validatePasilloData = (data) => {
  const errors = [];

  if (!isNotEmpty(data.numero)) {
    errors.push('Número de pasillo es requerido');
  }

  if (!isValidUUID(data.zona_id)) {
    errors.push('ID de zona válido es requerido');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validar datos de ubicación
 */
export const validateUbicacionData = (data) => {
  const errors = [];

  if (!isNotEmpty(data.numero)) {
    errors.push('Número de ubicación es requerido');
  }

  if (!isNotEmpty(data.clave)) {
    errors.push('Clave de ubicación es requerida');
  }

  if (!isValidUUID(data.pasillo_id)) {
    errors.push('ID de pasillo válido es requerido');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validar datos de conteo
 */
export const validateConteoData = (data) => {
  const errors = [];

  if (!isValidUUID(data.ubicacion_id)) {
    errors.push('ID de ubicación válido es requerido');
  }

  if (!isValidUUID(data.usuario_id)) {
    errors.push('ID de usuario válido es requerido');
  }

  if (!isValidTipoConteo(data.tipo_conteo)) {
    errors.push('Tipo de conteo debe ser 1, 2 o 3');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

export default {
  isNotEmpty,
  isValidUUID,
  isValidEmail,
  isPositiveNumber,
  isNonNegativeNumber,
  isValidTipoConteo,
  isValidEstadoConteo,
  validateExcelItem,
  sanitizeString,
  isValidLength,
  isValidCompaniaId,
  validateBodegaData,
  validateZonaData,
  validatePasilloData,
  validateUbicacionData,
  validateConteoData
};
