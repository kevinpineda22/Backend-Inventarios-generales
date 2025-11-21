// =====================================================
// RUTAS: PASILLOS
// =====================================================

import express from 'express';
import EstructuraController from '../controllers/estructura.controller.js';

const router = express.Router();

// Crear pasillo
router.post('/', EstructuraController.createPasillo);

export default router;
