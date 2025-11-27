// =====================================================
// UTILIDAD: RESPUESTAS ESTÁNDAR DE LA API
// =====================================================

/**
 * Respuesta exitosa
 */
export const successResponse = (res, data, message = 'Operación exitosa', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Respuesta de error
 */
export const errorResponse = (res, message = 'Error en la operación', statusCode = 500, error = null) => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };

  if (error && process.env.NODE_ENV === 'development') {
    response.error = {
      message: error.message,
      code: error.code,
      details: error.details
    };
  }

  return res.status(statusCode).json(response);
};

/**
 * Respuesta de validación fallida
 */
export const validationErrorResponse = (res, errors) => {
  return res.status(400).json({
    success: false,
    message: 'Error de validación',
    errors,
    timestamp: new Date().toISOString()
  });
};

/**
 * Respuesta de no encontrado
 */
export const notFoundResponse = (res, resource = 'Recurso') => {
  return res.status(404).json({
    success: false,
    message: `${resource} no encontrado`,
    timestamp: new Date().toISOString()
  });
};

/**
 * Respuesta de no autorizado
 */
export const unauthorizedResponse = (res, message = 'No autorizado') => {
  return res.status(401).json({
    success: false,
    message,
    timestamp: new Date().toISOString()
  });
};

/**
 * Respuesta de prohibido
 */
export const forbiddenResponse = (res, message = 'Acceso prohibido') => {
  return res.status(403).json({
    success: false,
    message,
    timestamp: new Date().toISOString()
  });
};

/**
 * Respuesta de conflicto
 */
export const conflictResponse = (res, message = 'Conflicto en la operación') => {
  return res.status(409).json({
    success: false,
    message,
    timestamp: new Date().toISOString()
  });
};

export default {
  successResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
  unauthorizedResponse,
  forbiddenResponse,
  conflictResponse
};
