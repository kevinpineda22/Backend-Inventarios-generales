// =====================================================
// RUTAS: ITEMS
// =====================================================

import express from 'express';
import ItemController from '../controllers/item.controller.js';
import { upload, handleMulterError } from '../middleware/uploadHandler.js';
import { strictRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Obtener items por compañía
router.get('/:companiaId', ItemController.getByCompany);

// Buscar items (Sugerencias)
router.get('/search/query', ItemController.search);

// Buscar item por código de barras
router.get('/barcode/:codigoBarra/:companiaId', ItemController.getByBarcode);

// Obtener item por ID
router.get('/detail/:id', ItemController.getById);

// Crear item
router.post('/', ItemController.create);

// Cargar items desde Excel
router.post(
  '/upload',
  strictRateLimiter,
  upload.single('file'),
  handleMulterError,
  ItemController.uploadExcel
);

// Actualizar item
router.put('/:id', ItemController.update);

// Eliminar item
router.delete('/:id', ItemController.delete);

export default router;
