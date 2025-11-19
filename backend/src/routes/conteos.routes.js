// =====================================================
// RUTAS: CONTEOS
// =====================================================

import express from 'express';
import ConteoController from '../controllers/conteo.controller.js';

const router = express.Router();

// Obtener conteos pendientes
router.get('/pendientes', ConteoController.getPendientes);

// Obtener conteo por ID
router.get('/:id', ConteoController.getById);

// Obtener historial por ubicación
router.get('/ubicacion/:ubicacionId', ConteoController.getHistorialByUbicacion);

// Obtener historial por pasillo
router.get('/pasillo/:pasilloId', ConteoController.getHistorialByPasillo);

// Calcular diferencias
router.get('/diferencias/:ubicacionId', ConteoController.calcularDiferencias);

// Obtener items de un conteo
router.get('/:conteoId/items', ConteoController.getItems);

// Iniciar conteo
router.post('/iniciar', ConteoController.iniciar);

// Agregar item a conteo
router.post('/:conteoId/item', ConteoController.agregarItem);

// Finalizar conteo
router.post('/:conteoId/finalizar', ConteoController.finalizar);

// Aprobar conteo
router.post('/:conteoId/aprobar', ConteoController.aprobar);

// Rechazar conteo
router.post('/:conteoId/rechazar', ConteoController.rechazar);

export default router;
