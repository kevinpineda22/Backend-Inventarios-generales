// =====================================================
// RUTAS: UBICACIONES
// =====================================================

import express from 'express';
import EstructuraController from '../controllers/estructura.controller.js';

const router = express.Router();

// Crear ubicación
router.post('/', EstructuraController.createUbicacion);

// Crear múltiples ubicaciones
router.post('/multiple', EstructuraController.createMultipleUbicaciones);

// Obtener ubicación por ID
router.get('/:id', EstructuraController.getUbicacion);

export default router;
