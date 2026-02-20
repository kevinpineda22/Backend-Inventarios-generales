// =====================================================
// CONTROLADOR: RECONTEO SIESA
// =====================================================

import ReconteoSiesaService from '../services/reconteo-siesa.service.js';
import { successResponse, errorResponse } from '../utils/responses.js';

export class ReconteoSiesaController {

  static async generar(req, res) {
    try {
      const { companiaId, bodegaId, bodegaNombre, itemsDiferencia } = req.body;
      if (!companiaId || !bodegaId || !itemsDiferencia) {
        return errorResponse(res, 'companiaId, bodegaId y itemsDiferencia son requeridos', 400);
      }
      const result = await ReconteoSiesaService.generarReconteos({ companiaId, bodegaId, bodegaNombre, itemsDiferencia });
      if (!result.success) return errorResponse(res, result.message, 400);
      return successResponse(res, result.data, result.message, 201);
    } catch (error) { return errorResponse(res, error.message, 500, error); }
  }

  static async obtenerPorBodega(req, res) {
    try {
      const { bodegaId } = req.params;
      const filters = req.query;
      const result = await ReconteoSiesaService.obtenerReconteos(bodegaId, filters);
      return successResponse(res, result.data, `${result.count} reconteos encontrados`);
    } catch (error) { return errorResponse(res, error.message, 500, error); }
  }

  static async obtenerPorEmpleado(req, res) {
    try {
      const { correo } = req.params;
      const filters = req.query;
      if (!correo) return errorResponse(res, 'Correo del empleado es requerido', 400);
      const result = await ReconteoSiesaService.obtenerReconteosEmpleado(correo, filters);
      return successResponse(res, result.data, `${result.total_ubicaciones} ubicaciones asignadas`);
    } catch (error) { return errorResponse(res, error.message, 500, error); }
  }

  static async asignar(req, res) {
    try {
      const { reconteoIds, correoEmpleado } = req.body;
      if (!reconteoIds || !correoEmpleado) {
        return errorResponse(res, 'reconteoIds y correoEmpleado son requeridos', 400);
      }
      const result = await ReconteoSiesaService.asignarReconteos(reconteoIds, correoEmpleado);
      if (!result.success) return errorResponse(res, result.message, 400);
      return successResponse(res, result.data, result.message);
    } catch (error) { return errorResponse(res, error.message, 500, error); }
  }

  static async asignarUbicacion(req, res) {
    try {
      const { ubicacionId, correoEmpleado, loteId } = req.body;
      if (!ubicacionId || !correoEmpleado) {
        return errorResponse(res, 'ubicacionId y correoEmpleado son requeridos', 400);
      }
      const result = await ReconteoSiesaService.asignarUbicacion(ubicacionId, correoEmpleado, loteId);
      if (!result.success) return errorResponse(res, result.message, 400);
      return successResponse(res, result.data, result.message);
    } catch (error) { return errorResponse(res, error.message, 500, error); }
  }

  static async iniciarReconteo(req, res) {
    try {
      const { ubicacionId, usuarioId, usuarioEmail } = req.body;
      if (!ubicacionId || !usuarioId || !usuarioEmail) {
        return errorResponse(res, 'ubicacionId, usuarioId y usuarioEmail son requeridos', 400);
      }
      const result = await ReconteoSiesaService.iniciarReconteoUbicacion(ubicacionId, usuarioId, usuarioEmail);
      if (!result.success) return errorResponse(res, result.message, 400);
      return successResponse(res, result.data, result.message, 201);
    } catch (error) { return errorResponse(res, error.message, 500, error); }
  }

  static async registrarCantidad(req, res) {
    try {
      const { reconteoId } = req.params;
      const { cantidad, conteoId, itemId, usuarioEmail } = req.body;
      if (cantidad === undefined || cantidad === null) {
        return errorResponse(res, 'cantidad es requerida', 400);
      }
      const result = await ReconteoSiesaService.registrarCantidadReconteo(
        reconteoId, Number(cantidad), conteoId, itemId, usuarioEmail
      );
      if (!result.success) return errorResponse(res, result.message, 400);
      return successResponse(res, result.data, result.message);
    } catch (error) { return errorResponse(res, error.message, 500, error); }
  }

  static async finalizarReconteo(req, res) {
    try {
      const { ubicacionId, conteoId } = req.body;
      if (!ubicacionId) return errorResponse(res, 'ubicacionId es requerido', 400);
      const result = await ReconteoSiesaService.finalizarReconteoUbicacion(ubicacionId, conteoId);
      if (!result.success) return errorResponse(res, result.message, 400);
      return successResponse(res, result.data, result.message);
    } catch (error) { return errorResponse(res, error.message, 500, error); }
  }

  static async aprobar(req, res) {
    try {
      const { reconteoIds } = req.body;
      if (!reconteoIds || !Array.isArray(reconteoIds)) {
        return errorResponse(res, 'reconteoIds (array) es requerido', 400);
      }
      const result = await ReconteoSiesaService.aprobarReconteos(reconteoIds);
      if (!result.success) return errorResponse(res, result.message, 400);
      return successResponse(res, result.data, result.message);
    } catch (error) { return errorResponse(res, error.message, 500, error); }
  }

  static async rechazar(req, res) {
    try {
      const { reconteoIds, motivo } = req.body;
      if (!reconteoIds || !Array.isArray(reconteoIds)) {
        return errorResponse(res, 'reconteoIds (array) es requerido', 400);
      }
      const result = await ReconteoSiesaService.rechazarReconteos(reconteoIds, motivo);
      if (!result.success) return errorResponse(res, result.message, 400);
      return successResponse(res, null, result.message);
    } catch (error) { return errorResponse(res, error.message, 500, error); }
  }

  static async obtenerResumen(req, res) {
    try {
      const { bodegaId } = req.params;
      const result = await ReconteoSiesaService.obtenerResumen(bodegaId);
      return successResponse(res, result.data, 'Resumen obtenido');
    } catch (error) { return errorResponse(res, error.message, 500, error); }
  }

  static async eliminarLote(req, res) {
    try {
      const { loteId } = req.params;
      const result = await ReconteoSiesaService.eliminarLote(loteId);
      return successResponse(res, null, result.message);
    } catch (error) { return errorResponse(res, error.message, 500, error); }
  }

  static async obtenerPorUbicacion(req, res) {
    try {
      const { ubicacionId } = req.params;
      const filters = req.query;
      const { default: ReconteoSiesaModel } = await import('../models/ReconteoSiesa.model.js');
      const data = await ReconteoSiesaModel.findByUbicacion(ubicacionId, filters);
      return successResponse(res, data, `${data.length} items encontrados`);
    } catch (error) { return errorResponse(res, error.message, 500, error); }
  }
}

export default ReconteoSiesaController;
