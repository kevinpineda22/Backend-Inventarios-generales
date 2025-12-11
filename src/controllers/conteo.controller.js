// =====================================================
// CONTROLADOR: CONTEOS
// =====================================================

import ConteoService from '../services/conteo.service.js';
import { 
  successResponse, 
  errorResponse, 
  notFoundResponse 
} from '../utils/responses.js';

export class ConteoController {
  /**
   * Obtener ubicaciones de un item
   * GET /api/conteos/item-locations/:itemId/:companiaId
   */
  static async getItemLocations(req, res) {
    try {
      const { itemId, companiaId } = req.params;
      
      if (!itemId || !companiaId) {
        return errorResponse(res, 'Item ID y Company ID son requeridos', 400);
      }

      const result = await ConteoService.getItemLocations(itemId, companiaId);
      return successResponse(res, result.data);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Iniciar un conteo
   * POST /api/conteos/iniciar
   */
  static async iniciar(req, res) {
    try {
      // Debugging
      if (!ConteoService || typeof ConteoService.iniciarConteo !== 'function') {
        console.error('CRITICAL ERROR: ConteoService is not correctly imported or initialized', ConteoService);
        return errorResponse(res, 'Internal Server Error: Service not available', 500);
      }

      const { ubicacionId, usuarioId, tipoConteo, clave, usuarioEmail } = req.body;

      // Validar tipoConteo
      if (!tipoConteo || isNaN(tipoConteo)) {
         return errorResponse(res, 'El tipo de conteo es inválido o requerido', 400);
      }

      const result = await ConteoService.iniciarConteo(
        ubicacionId,
        usuarioId,
        parseInt(tipoConteo), // Asegurar que es entero
        clave,
        usuarioEmail
      );

      if (!result.success) {
        return errorResponse(res, result.message, 400);
      }

      return successResponse(res, result.data, result.message, 201);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Agregar item a un conteo
   * POST /api/conteos/:conteoId/item
   */
  static async agregarItem(req, res) {
    try {
      const { conteoId } = req.params;
      const { codigoBarra, cantidad, companiaId, usuarioEmail, itemId } = req.body; // ✅ Recibir usuarioEmail e itemId

      const result = await ConteoService.agregarItem(
        conteoId,
        codigoBarra,
        cantidad,
        companiaId,
        usuarioEmail, // ✅ Pasar usuarioEmail al servicio
        itemId // ✅ Pasar itemId al servicio (para evitar errores de barcode)
      );

      if (!result.success) {
        return errorResponse(res, result.message, 404);
      }

      return successResponse(res, result.data, result.message);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Obtener comparativa detallada
   * GET /api/conteos/comparativa/:ubicacionId
   */
  static async getComparativa(req, res) {
    try {
      const { ubicacionId } = req.params;
      const result = await ConteoService.getComparativaDetallada(ubicacionId);
      return successResponse(res, result.data);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Eliminar item de un conteo
   * DELETE /api/conteos/item/:id
   */
  static async eliminarItem(req, res) {
    try {
      const { id } = req.params;

      const result = await ConteoService.eliminarItem(id);

      return successResponse(res, null, result.message);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Obtener items de un conteo
   * GET /api/conteos/:conteoId/items
   */
  static async getItems(req, res) {
    try {
      const { conteoId } = req.params;

      const result = await ConteoService.getItemsConteo(conteoId);

      return successResponse(res, result.data, `${result.count} items encontrados`);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Finalizar un conteo
   * POST /api/conteos/:conteoId/finalizar
   */
  static async finalizar(req, res) {
    try {
      const { conteoId } = req.params;

      const result = await ConteoService.finalizarConteo(conteoId);

      return successResponse(res, result.data, result.message);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Obtener conteo por ID
   * GET /api/conteos/:id
   */
  static async getById(req, res) {
    try {
      const { id } = req.params;

      const result = await ConteoService.getConteoById(id);

      if (!result.success) {
        return notFoundResponse(res, 'Conteo');
      }

      return successResponse(res, result.data, 'Conteo encontrado');
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Obtener historial de conteos por ubicación
   * GET /api/conteos/ubicacion/:ubicacionId
   */
  static async getHistorialByUbicacion(req, res) {
    try {
      const { ubicacionId } = req.params;

      const result = await ConteoService.getHistorialByUbicacion(ubicacionId);

      return successResponse(res, result.data, 'Historial obtenido');
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Obtener historial de conteos por pasillo
   * GET /api/conteos/pasillo/:pasilloId
   */
  static async getHistorialByPasillo(req, res) {
    try {
      const { pasilloId } = req.params;

      const result = await ConteoService.getHistorialByPasillo(pasilloId);

      return successResponse(res, result.data, 'Historial obtenido');
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Calcular diferencias entre conteo 1 y 2
   * GET /api/conteos/diferencias/:ubicacionId
   */
  static async calcularDiferencias(req, res) {
    try {
      const { ubicacionId } = req.params;

      const result = await ConteoService.calcularDiferencias(ubicacionId);

      if (!result.success) {
        return errorResponse(res, result.message, 400);
      }

      return successResponse(res, result.data, 'Diferencias calculadas');
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Aprobar un conteo
   * POST /api/conteos/:conteoId/aprobar
   */
  static async aprobar(req, res) {
    try {
      const { conteoId } = req.params;

      const result = await ConteoService.aprobarConteo(conteoId);

      return successResponse(res, result.data, result.message);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Rechazar un conteo
   * POST /api/conteos/:conteoId/rechazar
   */
  static async rechazar(req, res) {
    try {
      const { conteoId } = req.params;
      const { motivo } = req.body;

      const result = await ConteoService.rechazarConteo(conteoId, motivo);

      return successResponse(res, result.data, result.message);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Obtener conteos pendientes de aprobación
   * GET /api/conteos/pendientes
   */
  static async getPendientes(req, res) {
    try {
      const result = await ConteoService.getConteosPendientes();

      return successResponse(res, result.data, `${result.count} conteos pendientes`);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Obtener historial de conteos (Admin)
   * GET /api/conteos/historial
   */
  static async getHistorial(req, res) {
    try {
      const filters = req.query; // companiaId, bodega, zona, pasillo, tipoConteo

      const result = await ConteoService.getHistorial(filters);

      return successResponse(res, result.data, 'Historial obtenido exitosamente');
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Obtener ubicaciones con diferencias pendientes de reconteo
   * GET /api/conteos/diferencias-pendientes
   */
  static async getDiferenciasPendientes(req, res) {
    try {
      const { companiaId } = req.query;

      if (!companiaId) {
        return errorResponse(res, 'CompaniaId es requerido', 400);
      }

      const result = await ConteoService.getUbicacionesConDiferencias(companiaId);

      return successResponse(res, result.data, `${result.count} ubicaciones con diferencias encontradas`);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Crear Ajuste Final (Tipo 4)
   * POST /api/conteos/ajuste-final
   */
  static async crearAjusteFinal(req, res) {
    try {
      const { ubicacionId, usuarioId, usuarioEmail, items } = req.body;

      if (!ubicacionId || !items || !Array.isArray(items)) {
        return errorResponse(res, 'Datos incompletos. Se requiere ubicacionId y array de items', 400);
      }

      const result = await ConteoService.crearAjusteFinal(
        ubicacionId,
        usuarioId,
        usuarioEmail,
        items
      );

      // Forzar un pequeño delay para asegurar que la base de datos termine de escribir
      // antes de que el frontend intente leer de nuevo.
      await new Promise(resolve => setTimeout(resolve, 500));

      return successResponse(res, result.data, result.message, 201);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Exportar datos de bodega (Agrupado por items)
   * GET /api/conteos/exportar/:bodegaId
   */
  static async exportarBodega(req, res) {
    try {
      const { bodegaId } = req.params;

      const result = await ConteoService.exportarBodega(bodegaId);

      return successResponse(res, result.data, result.message);
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }
}

export default ConteoController;
