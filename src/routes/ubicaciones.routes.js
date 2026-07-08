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

// Obtener el QR de la clave de una ubicación (imagen PNG o ?format=json)
router.get('/:id/qr', EstructuraController.getUbicacionQr);

// Obtener ubicación por ID
router.get('/:id', EstructuraController.getUbicacion);

// Generar PDF con etiquetas para imprimir (media carta, pasillo + ubicacion + codigo barras)
router.get('/etiquetas/imprimir', EstructuraController.getEtiquetasPdf);

export default router;
