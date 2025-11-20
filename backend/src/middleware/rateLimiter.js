// =====================================================
// MIDDLEWARE: RATE LIMITING
// =====================================================

import rateLimit from 'express-rate-limit';
import { config } from '../config/config.js';

export const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    message: 'Demasiadas peticiones desde esta IP, por favor intenta más tarde',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter estricto para endpoints críticos (carga de Excel, etc.)
export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 peticiones
  message: {
    success: false,
    message: 'Límite de peticiones excedido para esta operación',
    timestamp: new Date().toISOString()
  }
});

// Rate limiter flexible para carga maestra (permite múltiples lotes)
export const maestraRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 500, // 500 peticiones (suficiente para lotes grandes)
  message: {
    success: false,
    message: 'Demasiadas peticiones de carga maestra, espera un momento',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false
});

export default rateLimiter;
