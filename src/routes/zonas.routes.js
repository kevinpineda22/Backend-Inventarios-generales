// =====================================================
// RUTAS: ZONAS
// =====================================================

import express from 'express';
import EstructuraController from '../controllers/estructura.controller.js';

const router = express.Router();

// Crear zona
router.post('/', EstructuraController.createZona);

export default router;
