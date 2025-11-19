// =====================================================
// SERVICIO: ESTRUCTURA (BODEGAS, ZONAS, PASILLOS, UBICACIONES)
// =====================================================

import BodegaModel from '../models/Bodega.model.js';
import ZonaModel from '../models/Zona.model.js';
import PasilloModel from '../models/Pasillo.model.js';
import UbicacionModel from '../models/Ubicacion.model.js';

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
      // Si hay pasillo, devolver ubicaciones
      else if (pasilloId) {
        const ubicaciones = await UbicacionModel.findByPasillo(pasilloId);
        data = { ubicaciones };
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
}

export default EstructuraService;
