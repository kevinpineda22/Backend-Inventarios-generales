// =====================================================
// RUTAS: RECONTEO SIESA
// =====================================================

import express from 'express';
import ReconteoSiesaController from '../controllers/reconteo-siesa.controller.js';

const router = express.Router();

// Generar reconteos desde comparación SIESA
router.post('/generar', ReconteoSiesaController.generar);

// Asignar reconteos a empleado (por IDs)
router.post('/asignar', ReconteoSiesaController.asignar);

// Asignar ubicación completa a empleado
router.post('/asignar-ubicacion', ReconteoSiesaController.asignarUbicacion);

// Iniciar reconteo (empleado)
router.post('/iniciar', ReconteoSiesaController.iniciarReconteo);

// Registrar cantidad de reconteo para un item
router.put('/:reconteoId/cantidad', ReconteoSiesaController.registrarCantidad);

// Finalizar reconteo de ubicación
router.post('/finalizar', ReconteoSiesaController.finalizarReconteo);

// Aprobar reconteos (admin)
router.post('/aprobar', ReconteoSiesaController.aprobar);

// Rechazar reconteos (admin)
router.post('/rechazar', ReconteoSiesaController.rechazar);

// Obtener reconteos por bodega
router.get('/bodega/:bodegaId', ReconteoSiesaController.obtenerPorBodega);

// Obtener resumen por bodega
router.get('/resumen/:bodegaId', ReconteoSiesaController.obtenerResumen);

// Obtener reconteos por empleado
router.get('/empleado/:correo', ReconteoSiesaController.obtenerPorEmpleado);

// Obtener reconteos por ubicación
router.get('/ubicacion/:ubicacionId', ReconteoSiesaController.obtenerPorUbicacion);

// Eliminar lote completo
router.delete('/lote/:loteId', ReconteoSiesaController.eliminarLote);

export default router;
