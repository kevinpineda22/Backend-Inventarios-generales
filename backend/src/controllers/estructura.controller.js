// =====================================================
// CONTROLADOR: ESTRUCTURA
// =====================================================

import EstructuraService from '../services/estructura.service.js';
import { 
  successResponse, 
  errorResponse, 
  notFoundResponse 
} from '../utils/responses.js';

export class EstructuraController {
  /**
   * Obtener estructura completa de una compañía
   * GET /api/estructura/:companiaId
   */
  static async getEstructuraCompleta(req, res) {
    try {
      const { companiaId } = req.params;

      const result = await EstructuraService.getEstructuraCompleta(companiaId);

      return successResponse(res, result.data, 'Estructura obtenida exitosamente');
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Obtener navegación jerárquica para empleado
   * GET /api/estructura/navegacion
   */
  static async getNavegacion(req, res) {
    try {
      const { companiaId, bodegaId, zonaId, pasilloId } = req.query;

      const result = await EstructuraService.getNavegacion(
        companiaId,
        bodegaId,
        zonaId,
        pasilloId
      );

      return successResponse(res, result.data, 'Navegación obtenida exitosamente');
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Crear bodega
   * POST /api/estructura/bodega
   */
  static async createBodega(req, res) {
    try {
      const bodegaData = req.body;

      const result = await EstructuraService.createBodega(bodegaData);

      return successResponse(res, result.data, result.message, 201);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Crear zona
   * POST /api/estructura/zona
   */
  static async createZona(req, res) {
    try {
      const zonaData = req.body;

      const result = await EstructuraService.createZona(zonaData);

      return successResponse(res, result.data, result.message, 201);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Crear pasillo
   * POST /api/estructura/pasillo
   */
  static async createPasillo(req, res) {
    try {
      const pasilloData = req.body;

      const result = await EstructuraService.createPasillo(pasilloData);

      return successResponse(res, result.data, result.message, 201);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Crear ubicación
   * POST /api/estructura/ubicacion
   */
  static async createUbicacion(req, res) {
    try {
      const ubicacionData = req.body;

      const result = await EstructuraService.createUbicacion(ubicacionData);

      return successResponse(res, result.data, result.message, 201);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Crear múltiples ubicaciones
   * POST /api/estructura/ubicaciones-multiple
   */
  static async createMultipleUbicaciones(req, res) {
    try {
      const { pasilloId, cantidad } = req.body;

      const result = await EstructuraService.createMultipleUbicaciones(pasilloId, cantidad);

      return successResponse(res, result.data, result.message, 201);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Actualizar bodega
   * PUT /api/estructura/bodega/:id
   */
  static async updateBodega(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const result = await EstructuraService.updateBodega(id, updateData);

      return successResponse(res, result.data, result.message);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Eliminar bodega
   * DELETE /api/estructura/bodega/:id
   */
  static async deleteBodega(req, res) {
    try {
      const { id } = req.params;

      const result = await EstructuraService.deleteBodega(id);

      return successResponse(res, null, result.message);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }
}

export default EstructuraController;
