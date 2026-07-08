// =====================================================
// CONTROLADOR: ESTRUCTURA
// =====================================================

import EstructuraService from '../services/estructura.service.js';
import QrService from '../services/qr.service.js';
import UbicacionModel from '../models/Ubicacion.model.js';
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
      const { pasilloId, cantidad, ubicaciones } = req.body;

      let result;
      if (ubicaciones && Array.isArray(ubicaciones)) {
        result = await EstructuraService.createUbicacionesBatch(ubicaciones);
      } else {
        result = await EstructuraService.createMultipleUbicaciones(pasilloId, cantidad);
      }

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

  /**
   * Actualizar zona
   * PUT /api/estructura/zona/:id
   */
  static async updateZona(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const result = await EstructuraService.updateZona(id, updateData);

      return successResponse(res, result.data, result.message);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Eliminar zona
   * DELETE /api/estructura/zona/:id
   */
  static async deleteZona(req, res) {
    try {
      const { id } = req.params;

      const result = await EstructuraService.deleteZona(id);

      return successResponse(res, null, result.message);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Actualizar pasillo
   * PUT /api/estructura/pasillo/:id
   */
  static async updatePasillo(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const result = await EstructuraService.updatePasillo(id, updateData);

      return successResponse(res, result.data, result.message);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Eliminar pasillo
   * DELETE /api/estructura/pasillo/:id
   */
  static async deletePasillo(req, res) {
    try {
      const { id } = req.params;

      const result = await EstructuraService.deletePasillo(id);

      return successResponse(res, null, result.message);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Eliminar ubicación
   * DELETE /api/estructura/ubicacion/:id
   */
  static async deleteUbicacion(req, res) {
    try {
      const { id } = req.params;

      const result = await EstructuraService.deleteUbicacion(id);

      return successResponse(res, null, result.message);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Eliminar múltiples ubicaciones
   * DELETE /api/estructura/ubicaciones-multiple
   */
  static async deleteMultipleUbicaciones(req, res) {
    try {
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return errorResponse(res, 'Se requiere un array de IDs', 400);
      }

      const result = await EstructuraService.deleteMultipleUbicaciones(ids);

      return successResponse(res, null, result.message);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Obtener ubicación por ID
   * GET /api/estructura/ubicacion/:id
   */
  static async getUbicacion(req, res) {
    try {
      const { id } = req.params;
      const result = await EstructuraService.getUbicacion(id);
      return successResponse(res, result.data, 'Ubicación obtenida exitosamente');
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Obtener el QR de la clave de una ubicación.
   * GET /api/ubicaciones/:id/qr            -> imagen PNG
   * GET /api/ubicaciones/:id/qr?format=json -> { qr: dataURL, clave, ... }
   */
  static async getUbicacionQr(req, res) {
    try {
      const { id } = req.params;
      const { format } = req.query;

      if (format === 'json' || format === 'dataurl') {
        const result = await QrService.generateUbicacionQrDataUrl(id);
        return successResponse(res, result.data, 'QR generado exitosamente');
      }

      const { buffer } = await QrService.generateUbicacionQrBuffer(id);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(buffer);
    } catch (error) {
      const status = error.message?.includes('no encontrada') ? 404 : 500;
      return errorResponse(res, error.message, status, error);
    }
  }

  /**
   * Descargar PDF con las claves (texto + QR) de las ubicaciones de un pasillo.
   * GET /api/pasillos/:id/claves-pdf
   */
  static async getPasilloClavesPdf(req, res) {
    try {
      const { id } = req.params;

      const pdfBuffer = await QrService.generatePasilloClavesPdf(id);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="claves-pasillo-${id}.pdf"`
      );
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(pdfBuffer);
    } catch (error) {
      const status = error.message?.includes('no encontrado') ? 404 : 500;
      return errorResponse(res, error.message, status, error);
    }
  }

  /**
   * Generar PDF con etiquetas de ubicaciones para imprimir.
   * GET /api/ubicaciones/etiquetas?ids=id1,id2,id3
   * o ?all=true&bodegaId=xxx para TODAS las ubicaciones de una bodega
   */
  static async getEtiquetasPdf(req, res) {
    try {
      let ubicaciones;

      if (req.query.all === 'true' && req.query.bodegaId) {
        // Traer TODAS las ubicaciones activas de la bodega
        const { supabase } = await import('../config/supabase.js');
        const { data, error } = await supabase
          .from('inv_general_ubicaciones')
          .select(`
            *,
            pasillo:inv_general_pasillos(
              *,
              zona:inv_general_zonas!inner(
                bodega_id
              )
            )
          `)
          .eq('pasillo.zona.bodega_id', req.query.bodegaId)
          .eq('activo', true)
          .order('pasillo_id')
          .order('numero');

        if (error) throw error;
        if (!data || data.length === 0) {
          return errorResponse(res, 'No se encontraron ubicaciones para esta bodega', 404);
        }
        ubicaciones = data;
      } else if (req.query.ids) {
        const ids = req.query.ids.split(',').map(id => id.trim()).filter(Boolean);
        if (ids.length === 0) {
          return errorResponse(res, 'Debe proporcionar al menos un ID de ubicación', 400);
        }
        ubicaciones = await Promise.all(ids.map(id => UbicacionModel.findById(id)));
        ubicaciones = ubicaciones.filter(Boolean);
        if (ubicaciones.length === 0) {
          return errorResponse(res, 'Ninguna ubicación encontrada', 404);
        }
      } else {
        return errorResponse(res, 'Debe proporcionar ids de ubicaciones o all=true con bodegaId', 400);
      }

      // Verificar que tengan la info del pasillo
      for (const u of ubicaciones) {
        if (!u.pasillo) {
          return errorResponse(res, `La ubicación ${u.numero || u.id} no tiene pasillo asociado`, 400);
        }
      }

      const pdfBuffer = await QrService.generateEtiquetasPdf(ubicaciones);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="etiquetas-ubicaciones.pdf"');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).send(pdfBuffer);
    } catch (error) {
      const status = error.message?.includes('no encontrado') || error.message?.includes('No se encontraron') ? 404 : 500;
      return errorResponse(res, error.message, status, error);
    }
  }
}

export default EstructuraController;
