// =====================================================
// SERVICIO: CONTEOS
// =====================================================

import ConteoModel from '../models/Conteo.model.js';
import ConteoItemModel from '../models/ConteoItem.model.js';
import UbicacionModel from '../models/Ubicacion.model.js';
import ItemModel from '../models/Item.model.js';

export class ConteoService {
  /**
   * Iniciar un conteo
   */
  static async iniciarConteo(ubicacionId, usuarioId, tipoConteo, clave) {
    try {
      // Verificar que la ubicación existe y la clave es correcta
      const ubicacion = await UbicacionModel.findById(ubicacionId);
      
      if (!ubicacion) {
        return {
          success: false,
          message: 'Ubicación no encontrada'
        };
      }

      // Verificar clave
      const claveValida = await UbicacionModel.verifyClave(ubicacionId, clave);
      if (!claveValida) {
        return {
          success: false,
          message: 'Clave incorrecta'
        };
      }

      // Verificar si ya existe un conteo de este tipo para esta ubicación
      const conteoExistente = await ConteoModel.findByUbicacionAndTipo(ubicacionId, tipoConteo);
      
      if (conteoExistente && conteoExistente.estado !== 'finalizado') {
        return {
          success: false,
          message: 'Ya existe un conteo en progreso para esta ubicación'
        };
      }

      // Crear el conteo
      const conteo = await ConteoModel.create({
        ubicacion_id: ubicacionId,
        usuario_id: usuarioId,
        tipo_conteo: tipoConteo,
        estado: 'en_progreso'
      });

      return {
        success: true,
        data: conteo,
        message: 'Conteo iniciado exitosamente'
      };
    } catch (error) {
      throw new Error(`Error al iniciar conteo: ${error.message}`);
    }
  }

  /**
   * Agregar item a un conteo
   */
  static async agregarItem(conteoId, codigoBarra, cantidad, companiaId) {
    try {
      // Buscar el item por código de barras
      const item = await ItemModel.findByBarcode(codigoBarra, companiaId);
      
      if (!item) {
        return {
          success: false,
          message: 'Item no encontrado con ese código de barras'
        };
      }

      // Agregar o actualizar el item en el conteo
      const conteoItem = await ConteoItemModel.upsert(conteoId, item.id, cantidad);

      return {
        success: true,
        data: conteoItem,
        message: 'Item agregado al conteo exitosamente'
      };
    } catch (error) {
      throw new Error(`Error al agregar item al conteo: ${error.message}`);
    }
  }

  /**
   * Obtener items de un conteo
   */
  static async getItemsConteo(conteoId) {
    try {
      const items = await ConteoItemModel.findByConteo(conteoId);
      
      return {
        success: true,
        data: items,
        count: items.length
      };
    } catch (error) {
      throw new Error(`Error al obtener items del conteo: ${error.message}`);
    }
  }

  /**
   * Finalizar un conteo
   */
  static async finalizarConteo(conteoId) {
    try {
      const conteo = await ConteoModel.finalizar(conteoId);
      
      return {
        success: true,
        data: conteo,
        message: 'Conteo finalizado exitosamente'
      };
    } catch (error) {
      throw new Error(`Error al finalizar conteo: ${error.message}`);
    }
  }

  /**
   * Obtener conteo con todos sus items
   */
  static async getConteoById(id) {
    try {
      const conteo = await ConteoModel.findById(id);
      
      if (!conteo) {
        return {
          success: false,
          message: 'Conteo no encontrado'
        };
      }

      return {
        success: true,
        data: conteo
      };
    } catch (error) {
      throw new Error(`Error al obtener conteo: ${error.message}`);
    }
  }

  /**
   * Obtener historial de conteos por ubicación
   */
  static async getHistorialByUbicacion(ubicacionId) {
    try {
      const conteos = await ConteoModel.findByUbicacion(ubicacionId);
      
      return {
        success: true,
        data: conteos
      };
    } catch (error) {
      throw new Error(`Error al obtener historial: ${error.message}`);
    }
  }

  /**
   * Obtener historial de conteos por pasillo
   */
  static async getHistorialByPasillo(pasilloId) {
    try {
      const conteos = await ConteoModel.getHistorialByPasillo(pasilloId);
      
      return {
        success: true,
        data: conteos
      };
    } catch (error) {
      throw new Error(`Error al obtener historial: ${error.message}`);
    }
  }

  /**
   * Calcular diferencias entre conteo 1 y conteo 2
   */
  static async calcularDiferencias(ubicacionId) {
    try {
      // Obtener conteo 1 y conteo 2
      const conteo1 = await ConteoModel.findByUbicacionAndTipo(ubicacionId, 1);
      const conteo2 = await ConteoModel.findByUbicacionAndTipo(ubicacionId, 2);

      if (!conteo1 || !conteo2) {
        return {
          success: false,
          message: 'Deben existir conteo 1 y conteo 2 para calcular diferencias'
        };
      }

      // Obtener items de ambos conteos
      const items1 = await ConteoItemModel.findByConteo(conteo1.id);
      const items2 = await ConteoItemModel.findByConteo(conteo2.id);

      // Calcular diferencias
      const diferencias = [];
      const itemsMap = new Map();

      // Agregar items del conteo 1
      items1.forEach(item => {
        itemsMap.set(item.item_id, {
          item_id: item.item_id,
          item: item.item,
          cantidad_conteo1: item.cantidad,
          cantidad_conteo2: 0
        });
      });

      // Agregar items del conteo 2
      items2.forEach(item => {
        if (itemsMap.has(item.item_id)) {
          itemsMap.get(item.item_id).cantidad_conteo2 = item.cantidad;
        } else {
          itemsMap.set(item.item_id, {
            item_id: item.item_id,
            item: item.item,
            cantidad_conteo1: 0,
            cantidad_conteo2: item.cantidad
          });
        }
      });

      // Calcular diferencias
      itemsMap.forEach((value, key) => {
        const diferencia = value.cantidad_conteo2 - value.cantidad_conteo1;
        if (diferencia !== 0) {
          diferencias.push({
            ...value,
            diferencia
          });
        }
      });

      return {
        success: true,
        data: {
          conteo1,
          conteo2,
          diferencias,
          total_diferencias: diferencias.length
        }
      };
    } catch (error) {
      throw new Error(`Error al calcular diferencias: ${error.message}`);
    }
  }

  /**
   * Aprobar conteo
   */
  static async aprobarConteo(conteoId) {
    try {
      const conteo = await ConteoModel.aprobar(conteoId);
      
      return {
        success: true,
        data: conteo,
        message: 'Conteo aprobado exitosamente'
      };
    } catch (error) {
      throw new Error(`Error al aprobar conteo: ${error.message}`);
    }
  }

  /**
   * Rechazar conteo
   */
  static async rechazarConteo(conteoId, motivo) {
    try {
      const conteo = await ConteoModel.rechazar(conteoId, motivo);
      
      return {
        success: true,
        data: conteo,
        message: 'Conteo rechazado'
      };
    } catch (error) {
      throw new Error(`Error al rechazar conteo: ${error.message}`);
    }
  }

  /**
   * Obtener conteos pendientes de aprobación
   */
  static async getConteosPendientes() {
    try {
      const conteos = await ConteoModel.getPendientes();
      
      return {
        success: true,
        data: conteos,
        count: conteos.length
      };
    } catch (error) {
      throw new Error(`Error al obtener conteos pendientes: ${error.message}`);
    }
  }
}

export default ConteoService;
