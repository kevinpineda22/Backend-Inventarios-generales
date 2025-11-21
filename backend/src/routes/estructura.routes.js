// =====================================================
// RUTAS: ESTRUCTURA
// =====================================================

import express from 'express';
import EstructuraController from '../controllers/estructura.controller.js';

const router = express.Router();

// --- RUTAS ESPECÍFICAS (Deben ir antes de las rutas con parámetros genéricos) ---

// Obtener navegación jerárquica
router.get('/navegacion', EstructuraController.getNavegacion);

// Obtener ubicación por ID
router.get('/ubicacion/:id', EstructuraController.getUbicacion);

// --- RUTAS GENÉRICAS ---

// Obtener estructura completa de una compañía
router.get('/:companiaId', EstructuraController.getEstructuraCompleta);

// --- RUTAS DE CREACIÓN/EDICIÓN ---

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
