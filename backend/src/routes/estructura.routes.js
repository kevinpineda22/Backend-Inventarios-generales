// =====================================================
// RUTAS: ESTRUCTURA
// =====================================================

import express from 'express';
import EstructuraController from '../controllers/estructura.controller.js';

const router = express.Router();

// Obtener estructura completa de una compañía
router.get('/:companiaId', EstructuraController.getEstructuraCompleta);

// Obtener navegación jerárquica
router.get('/navegacion', EstructuraController.getNavegacion);

// Crear bodega
router.post('/bodega', EstructuraController.createBodega);

// Crear zona
router.post('/zona', EstructuraController.createZona);

// Crear pasillo
router.post('/pasillo', EstructuraController.createPasillo);

// Crear ubicación
router.post('/ubicacion', EstructuraController.createUbicacion);

// Crear múltiples ubicaciones
router.post('/ubicaciones-multiple', EstructuraController.createMultipleUbicaciones);

// Actualizar bodega
router.put('/bodega/:id', EstructuraController.updateBodega);

// Eliminar bodega
router.delete('/bodega/:id', EstructuraController.deleteBodega);

export default router;
