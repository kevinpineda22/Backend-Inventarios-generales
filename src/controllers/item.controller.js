// =====================================================
// CONTROLADOR: ITEMS
// =====================================================

import ItemService from '../services/item.service.js';
import { 
  successResponse, 
  errorResponse, 
  notFoundResponse 
} from '../utils/responses.js';
import { readExcelBuffer } from '../utils/excelHandler.js';
import fs from 'fs';

export class ItemController {
  /**
   * Obtener todos los items de una compañía
   * GET /api/items/:companiaId
   */
  static async getByCompany(req, res) {
    try {
      const { companiaId } = req.params;
      const filters = req.query;

      const result = await ItemService.getByCompany(companiaId, filters);

      return successResponse(res, result.data, `${result.count} items encontrados`);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Buscar item por código de barras
   * GET /api/items/barcode/:codigoBarra/:companiaId
   */
  static async getByBarcode(req, res) {
    try {
      const { codigoBarra, companiaId } = req.params;

      const result = await ItemService.getByBarcode(codigoBarra, companiaId);

      if (!result.success) {
        return notFoundResponse(res, 'Item');
      }

      return successResponse(res, result.data, 'Item encontrado');
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Obtener item por ID
   * GET /api/items/:id
   */
  static async getById(req, res) {
    try {
      const { id } = req.params;

      const result = await ItemService.getById(id);

      if (!result.success) {
        return notFoundResponse(res, 'Item');
      }

      return successResponse(res, result.data, 'Item encontrado');
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Crear un item
   * POST /api/items
   */
  static async create(req, res) {
    try {
      const itemData = req.body;

      const result = await ItemService.create(itemData);

      return successResponse(res, result.data, result.message, 201);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Cargar items desde Excel
   * POST /api/items/upload
   */
  static async uploadExcel(req, res) {
    try {
      const { companiaId } = req.body;

      if (!req.file) {
        return errorResponse(res, 'No se ha proporcionado ningún archivo', 400);
      }

      // Leer el archivo Excel
      const buffer = fs.readFileSync(req.file.path);
      const excelResult = readExcelBuffer(buffer);

      // Eliminar archivo temporal
      fs.unlinkSync(req.file.path);

      if (!excelResult.success) {
        return errorResponse(res, `Error al leer Excel: ${excelResult.error}`, 400);
      }

      // Cargar items
      const result = await ItemService.uploadFromExcel(excelResult.data, companiaId);

      if (!result.success) {
        return errorResponse(res, result.message, 400, { errors: result.errors });
      }

      return successResponse(res, result.data, result.message, 201);
    } catch (error) {
      // Eliminar archivo si existe
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Actualizar un item
   * PUT /api/items/:id
   */
  static async update(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const result = await ItemService.update(id, updateData);

      return successResponse(res, result.data, result.message);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Eliminar un item
   * DELETE /api/items/:id
   */
  static async delete(req, res) {
    try {
      const { id } = req.params;

      const result = await ItemService.delete(id);

      return successResponse(res, null, result.message);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }
}

export default ItemController;
