// =====================================================
// SERVICIO: ESTRUCTURA (BODEGAS, ZONAS, PASILLOS, UBICACIONES)
// =====================================================

import BodegaModel from '../models/Bodega.model.js';
import ZonaModel from '../models/Zona.model.js';
import PasilloModel from '../models/Pasillo.model.js';
import UbicacionModel from '../models/Ubicacion.model.js';
import ConteoModel from '../models/Conteo.model.js'; // Importar ConteoModel

export class EstructuraService {
  /**
   * Obtener estructura completa de una compañía
   */
  static async getEstructuraCompleta(companiaId) {
    try {
      const bodegas = await BodegaModel.findByCompany(companiaId);

      const estructura = await Promise.all(
        bodegas.map(async (bodega) => {
          const zonas = await ZonaModel.findByBodega(bodega.id);

          const zonasConPasillos = await Promise.all(
            zonas.map(async (zona) => {
              const pasillos = await PasilloModel.findByZona(zona.id);

              const pasillosConUbicaciones = await Promise.all(
                pasillos.map(async (pasillo) => {
                  const ubicaciones = await UbicacionModel.findByPasillo(pasillo.id);
                  return {
                    ...pasillo,
                    ubicaciones
                  };
                })
              );

              return {
                ...zona,
                pasillos: pasillosConUbicaciones
              };
            })
          );

          return {
            ...bodega,
            zonas: zonasConPasillos
          };
        })
      );

      return {
        success: true,
        data: estructura
      };
    } catch (error) {
      throw new Error(`Error al obtener estructura: ${error.message}`);
    }
  }

  /**
   * Obtener navegación jerárquica para empleado
   */
  static async getNavegacion(companiaId, bodegaId = null, zonaId = null, pasilloId = null) {
    try {
      let data = {};

      // Si no hay bodega, devolver bodegas
      if (!bodegaId) {
        const bodegas = await BodegaModel.findByCompany(companiaId);
        data = { bodegas };
      }
      // Si hay bodega pero no zona, devolver zonas
      else if (bodegaId && !zonaId) {
        const zonas = await ZonaModel.findByBodega(bodegaId);
        data = { zonas };
      }
      // Si hay zona pero no pasillo, devolver pasillos
      else if (zonaId && !pasilloId) {
        const pasillos = await PasilloModel.findByZona(zonaId);
        data = { pasillos };
      }
      // Si hay pasillo, devolver ubicaciones con estado de conteos
      else if (pasilloId) {
        const ubicaciones = await UbicacionModel.findByPasillo(pasilloId);
        const conteos = await ConteoModel.getHistorialByPasillo(pasilloId);
        
        // Mapear conteos a ubicaciones
        const ubicacionesConEstado = ubicaciones.map(u => {
            const conteosUbicacion = conteos.filter(c => c.ubicacion_id === u.id);
            
            // Determinar estado de conteo 1
            const conteo1 = conteosUbicacion.find(c => c.tipo_conteo === 1);
            const conteo1_estado = conteo1 ? conteo1.estado : 'no_iniciado';
            
            // Determinar estado de conteo 2
            const conteo2 = conteosUbicacion.find(c => c.tipo_conteo === 2);
            const conteo2_estado = conteo2 ? conteo2.estado : 'no_iniciado';

            // Determinar conteo actual sugerido (legacy logic)
            let conteo_actual = 0;
            if (conteo1 && conteo1.estado === 'finalizado') conteo_actual = 1;
            if (conteo2 && conteo2.estado === 'finalizado') conteo_actual = 2;
            
            return { 
                ...u, 
                conteo_actual, 
                conteo1_estado,
                conteo2_estado,
                conteo1_id: conteo1?.id,
                conteo2_id: conteo2?.id
            };
        });

        data = { ubicaciones: ubicacionesConEstado };
      }

      return {
        success: true,
        data
      };
    } catch (error) {
      throw new Error(`Error al obtener navegación: ${error.message}`);
    }
  }

  /**
   * Crear bodega
   */
  static async createBodega(bodegaData) {
    try {
      const bodega = await BodegaModel.create(bodegaData);
      
      return {
        success: true,
        data: bodega,
        message: 'Bodega creada exitosamente'
      };
    } catch (error) {
      throw new Error(`Error al crear bodega: ${error.message}`);
    }
  }

  /**
   * Crear zona
   */
  static async createZona(zonaData) {
    try {
      const zona = await ZonaModel.create(zonaData);
      
      return {
        success: true,
        data: zona,
        message: 'Zona creada exitosamente'
      };
    } catch (error) {
      throw new Error(`Error al crear zona: ${error.message}`);
    }
  }

  /**
   * Crear pasillo
   */
  static async createPasillo(pasilloData) {
    try {
      const pasillo = await PasilloModel.create(pasilloData);
      
      return {
        success: true,
        data: pasillo,
        message: 'Pasillo creado exitosamente'
      };
    } catch (error) {
      throw new Error(`Error al crear pasillo: ${error.message}`);
    }
  }

  /**
   * Crear ubicación
   */
  static async createUbicacion(ubicacionData) {
    try {
      // Generar clave si no se proporciona
      if (!ubicacionData.clave) {
        ubicacionData.clave = this.generateClave();
      }

      const ubicacion = await UbicacionModel.create(ubicacionData);
      
      return {
        success: true,
        data: ubicacion,
        message: 'Ubicación creada exitosamente'
      };
    } catch (error) {
      throw new Error(`Error al crear ubicación: ${error.message}`);
    }
  }

  /**
   * Crear múltiples ubicaciones
   */
  static async createMultipleUbicaciones(pasilloId, cantidad) {
    try {
      const ubicaciones = [];
      
      for (let i = 1; i <= cantidad; i++) {
        ubicaciones.push({
          numero: i.toString(),
          clave: this.generateClave(),
          pasillo_id: pasilloId
        });
      }

      const result = await UbicacionModel.createMany(ubicaciones);
      
      return {
        success: true,
        data: result,
        message: `${cantidad} ubicaciones creadas exitosamente`
      };
    } catch (error) {
      throw new Error(`Error al crear ubicaciones: ${error.message}`);
    }
  }

  /**
   * Eliminar múltiples ubicaciones
   */
  static async deleteUbicacionesBatch(ids) {
    try {
      await UbicacionModel.deleteMany(ids);

      return {
        success: true,
        message: `${ids.length} ubicaciones eliminadas exitosamente`,
      };
    } catch (error) {
      throw new Error(`Error al eliminar ubicaciones: ${error.message}`);
    }
  }

  /**
   * Crear lote de ubicaciones (custom)
   */
  static async createUbicacionesBatch(ubicaciones) {
    try {
      // Asegurar que todas tengan clave
      const ubicacionesWithKeys = ubicaciones.map(u => ({
        ...u,
        clave: u.clave || this.generateClave()
      }));

      const result = await UbicacionModel.createMany(ubicacionesWithKeys);
      
      return {
        success: true,
        data: result,
        message: `${result.length} ubicaciones creadas exitosamente`
      };
    } catch (error) {
      throw new Error(`Error al crear lote de ubicaciones: ${error.message}`);
    }
  }

  /**
   * Generar clave aleatoria para ubicación
   */
  static generateClave() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  /**
   * Actualizar bodega
   */
  static async updateBodega(id, updateData) {
    try {
      const bodega = await BodegaModel.update(id, updateData);
      
      return {
        success: true,
        data: bodega,
        message: 'Bodega actualizada exitosamente'
      };
    } catch (error) {
      throw new Error(`Error al actualizar bodega: ${error.message}`);
    }
  }

  /**
   * Eliminar bodega
   */
  static async deleteBodega(id) {
    try {
      await BodegaModel.delete(id);
      
      return {
        success: true,
        message: 'Bodega eliminada exitosamente'
      };
    } catch (error) {
      throw new Error(`Error al eliminar bodega: ${error.message}`);
    }
  }

  /**
   * Actualizar zona
   */
  static async updateZona(id, updateData) {
    try {
      const zona = await ZonaModel.update(id, updateData);
      
      return {
        success: true,
        data: zona,
        message: 'Zona actualizada exitosamente'
      };
    } catch (error) {
      throw new Error(`Error al actualizar zona: ${error.message}`);
    }
  }

  /**
   * Eliminar zona
   */
  static async deleteZona(id) {
    try {
      await ZonaModel.delete(id);
      
      return {
        success: true,
        message: 'Zona eliminada exitosamente'
      };
    } catch (error) {
      throw new Error(`Error al eliminar zona: ${error.message}`);
    }
  }

  /**
   * Actualizar pasillo
   */
  static async updatePasillo(id, updateData) {
    try {
      const pasillo = await PasilloModel.update(id, updateData);
      
      return {
        success: true,
        data: pasillo,
        message: 'Pasillo actualizado exitosamente'
      };
    } catch (error) {
      throw new Error(`Error al actualizar pasillo: ${error.message}`);
    }
  }

  /**
   * Eliminar pasillo
   */
  static async deletePasillo(id) {
    try {
      await PasilloModel.delete(id);
      
      return {
        success: true,
        message: 'Pasillo eliminado exitosamente'
      };
    } catch (error) {
      throw new Error(`Error al eliminar pasillo: ${error.message}`);
    }
  }

  /**
   * Eliminar ubicación
   */
  static async deleteUbicacion(id) {
    try {
      await UbicacionModel.delete(id);
      
      return {
        success: true,
        message: 'Ubicación eliminada exitosamente'
      };
    } catch (error) {
      throw new Error(`Error al eliminar ubicación: ${error.message}`);
    }
  }

  /**
   * Eliminar múltiples ubicaciones (Alias para deleteUbicacionesBatch)
   */
  static async deleteMultipleUbicaciones(ids) {
    return this.deleteUbicacionesBatch(ids);
  }

  /**
   * Obtener ubicación por ID
   */
  static async getUbicacion(id) {
    try {
      const ubicacion = await UbicacionModel.findById(id);
      if (!ubicacion) {
        throw new Error('Ubicación no encontrada');
      }
      return {
        success: true,
        data: ubicacion
      };
    } catch (error) {
      throw new Error(`Error al obtener ubicación: ${error.message}`);
    }
  }
}

export default EstructuraService;
