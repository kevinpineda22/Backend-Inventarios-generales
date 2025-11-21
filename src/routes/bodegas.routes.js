// =====================================================
// RUTAS: BODEGAS
// =====================================================

import express from 'express';
import EstructuraController from '../controllers/estructura.controller.js';

const router = express.Router();

// Todas las operaciones de bodegas están centralizadas en el controlador de estructura
// Estas rutas son aliases para mantener la API REST semántica

// Crear bodega
router.post('/', EstructuraController.createBodega);

// Actualizar bodega
router.put('/:id', EstructuraController.updateBodega);

// Eliminar bodega
router.delete('/:id', EstructuraController.deleteBodega);

export default router;
