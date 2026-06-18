// =====================================================
// RUTAS: PASILLOS
// =====================================================

import express from 'express';
import EstructuraController from '../controllers/estructura.controller.js';

const router = express.Router();

// Crear pasillo
router.post('/', EstructuraController.createPasillo);

// Descargar PDF con las claves + QR de las ubicaciones del pasillo
router.get('/:id/claves-pdf', EstructuraController.getPasilloClavesPdf);

export default router;
