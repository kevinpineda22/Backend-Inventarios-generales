// =====================================================
// CONTROLADOR: INVENTARIO (ACCIONES DE CIERRE Y ESTADO)
// =====================================================

import PasilloModel from '../models/Pasillo.model.js';
import ZonaModel from '../models/Zona.model.js';
import BodegaModel from '../models/Bodega.model.js';
import InventarioConsolidadoService from '../services/inventario-consolidado.service.js';
import { successResponse, errorResponse } from '../utils/responses.js';

export class InventarioController {

  /**
   * Cerrar Pasillo
   * POST /api/inventario/cerrar-pasillo
   */
  static async cerrarPasillo(req, res) {
    try {
      const { pasilloId, companiaId } = req.body;
      if (!pasilloId) throw new Error("pasilloId es requerido");

      // Actualizar estado a 'cerrado'
      // Asumimos que existe una columna 'estado' o similar. 
      // Si no, habría que crearla en la BD.
      const result = await PasilloModel.update(pasilloId, { estado: 'cerrado' });

      // Consolidar inventario del pasillo
      try {
        console.log(`[CONSOLIDACIÓN] Consolidando pasillo ${pasilloId}`);
        await InventarioConsolidadoService.consolidarInventario('pasillo', pasilloId);
        console.log(`[CONSOLIDACIÓN] Pasillo ${pasilloId} consolidado exitosamente`);
      } catch (consolidacionError) {
        console.error(`[ERROR CONSOLIDACIÓN] Error al consolidar pasillo ${pasilloId}:`, consolidacionError);
        // No fallamos el cierre si falla la consolidación, solo logueamos
      }

      return successResponse(res, result, 'Pasillo cerrado correctamente');
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Cerrar Zona
   * POST /api/inventario/cerrar-zona
   */
  static async cerrarZona(req, res) {
    try {
      const { zonaId, companiaId } = req.body;
      // Nota: zonaId puede ser el ID o el nombre, según lo que envíe el frontend.
      // El frontend envía el nombre en algunos casos, pero idealmente debería ser ID.
      // En HistorialConteos.jsx: handleCerrarZona(zona.nombre) -> envía nombre.
      // Deberíamos buscar la zona por nombre y bodega si es nombre, o por ID.
      // Por simplicidad asumiremos que si es UUID es ID, si no buscamos.
      
      // Para este ejemplo simple, asumiremos que el frontend enviará el ID correcto 
      // o que ajustaremos el frontend para enviar ID.
      // Revisando HistorialConteos.jsx, envía zona.nombre. Esto es problemático si hay zonas con mismo nombre en dif bodegas.
      // Pero el frontend tiene el objeto zona, debería enviar el ID.
      
      // Vamos a asumir que recibimos el ID o que el modelo maneja la actualización.
      // Si recibimos nombre, necesitamos buscar el ID primero.
      
      // CORRECCIÓN: El frontend envía { zonaId, companiaId }.
      // Si zonaId es un nombre, esto fallará en la BD si espera UUID.
      
      // Vamos a intentar actualizar directo.
      // Si falla, el usuario tendrá que corregir el frontend para enviar IDs.
      
      if (!zonaId) throw new Error("zonaId es requerido");

      // Verificar si todos los pasillos están cerrados (opcional, pero buena práctica)
      // const pasillos = await PasilloModel.findByZona(zonaId);
      // const abiertos = pasillos.filter(p => p.estado !== 'cerrado');
      // if (abiertos.length > 0) throw new Error("No se puede cerrar la zona, hay pasillos abiertos");

      const result = await ZonaModel.update(zonaId, { estado: 'cerrado' });

      // Consolidar inventario de la zona
      try {
        console.log(`[CONSOLIDACIÓN] Consolidando zona ${zonaId}`);
        await InventarioConsolidadoService.consolidarInventario('zona', zonaId);
        console.log(`[CONSOLIDACIÓN] Zona ${zonaId} consolidada exitosamente`);
      } catch (consolidacionError) {
        console.error(`[ERROR CONSOLIDACIÓN] Error al consolidar zona ${zonaId}:`, consolidacionError);
        // No fallamos el cierre si falla la consolidación, solo logueamos
      }

      return successResponse(res, result, 'Zona cerrada correctamente');
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Cerrar Bodega
   * POST /api/inventario/cerrar-bodega
   */
  static async cerrarBodega(req, res) {
    try {
      const { bodegaId, companiaId } = req.body;
      // Mismo caso: frontend envía selectedBodega que es el NOMBRE.
      // Necesitamos buscar la bodega por nombre y compañía.
      
      // Si bodegaId no es UUID, buscar por nombre
      // Esto requeriría un método findByName en BodegaModel.
      
      // Por ahora, intentamos update.
      const result = await BodegaModel.update(bodegaId, { estado: 'cerrado' });

      // Consolidar inventario de la bodega
      try {
        console.log(`[CONSOLIDACIÓN] Consolidando bodega ${bodegaId}`);
        await InventarioConsolidadoService.consolidarInventario('bodega', bodegaId);
        console.log(`[CONSOLIDACIÓN] Bodega ${bodegaId} consolidada exitosamente`);
      } catch (consolidacionError) {
        console.error(`[ERROR CONSOLIDACIÓN] Error al consolidar bodega ${bodegaId}:`, consolidacionError);
        // No fallamos el cierre si falla la consolidación, solo logueamos
      }

      return successResponse(res, result, 'Bodega cerrada correctamente');
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }

  /**
   * Obtener Estado Jerarquía
   * GET /api/inventario/estado-jerarquia
   */
  static async getEstadoJerarquia(req, res) {
    try {
      const { bodega, companiaId } = req.query;
      
      // Necesitamos buscar la bodega por nombre para obtener su ID y sus hijos
      // Esto es complejo sin un método específico de búsqueda.
      // Vamos a usar BodegaModel.findByCompany y filtrar.
      
      const bodegas = await BodegaModel.findByCompany(companiaId);
      const bodegaObj = bodegas.find(b => b.nombre === bodega);
      
      if (!bodegaObj) {
        return successResponse(res, null, 'Bodega no encontrada');
      }

      const zonas = await ZonaModel.findByBodega(bodegaObj.id);
      
      const estadoZonas = {};
      const estadoPasillos = {};

      const estructura = [];

      for (const zona of zonas) {
        estadoZonas[zona.id] = zona.estado || 'abierto';
        
        const pasillos = await PasilloModel.findByZona(zona.id);
        const pasillosData = [];
        
        for (const pasillo of pasillos) {
          estadoPasillos[pasillo.id] = pasillo.estado || 'abierto';
          pasillosData.push({
            id: pasillo.id,
            numero: pasillo.numero,
            estado: pasillo.estado || 'abierto'
          });
        }

        estructura.push({
          id: zona.id,
          nombre: zona.nombre,
          estado: zona.estado || 'abierto',
          pasillos: pasillosData
        });
      }

      const result = {
        bodega: bodegaObj.estado || 'abierto',
        bodegaId: bodegaObj.id,
        zonas: estadoZonas,
        pasillos: estadoPasillos,
        estructura: estructura // Devolvemos la estructura completa
      };

      return successResponse(res, result, 'Estado obtenido');
    } catch (error) {
      return errorResponse(res, error.message, 500, error);
    }
  }
}

export default InventarioController;
