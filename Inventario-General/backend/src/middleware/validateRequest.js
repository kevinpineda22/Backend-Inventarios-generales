// =====================================================
// MIDDLEWARE: VALIDACIÓN DE PETICIONES
// =====================================================

import { validationResult } from 'express-validator';
import { validationErrorResponse } from '../utils/responses.js';

export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return validationErrorResponse(res, errors.array());
  }
  
  next();
};

export default validateRequest;
