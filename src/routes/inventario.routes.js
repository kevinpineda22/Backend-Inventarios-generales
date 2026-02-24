// =====================================================
// RUTAS: INVENTARIO (ACCIONES DE CIERRE)
// =====================================================

import express from 'express';
import InventarioController from '../controllers/inventario.controller.js';

const router = express.Router();

// Cerrar Pasillo
router.post('/cerrar-pasillo', InventarioController.cerrarPasillo);

// Cerrar Zona
router.post('/cerrar-zona', InventarioController.cerrarZona);

// Cerrar Bodega
router.post('/cerrar-bodega', InventarioController.cerrarBodega);

// Abrir Bodega
router.post('/abrir-bodega', InventarioController.abrirBodega);

// Obtener Estado Jerarquía
router.get('/estado-jerarquia', InventarioController.getEstadoJerarquia);

export default router;
