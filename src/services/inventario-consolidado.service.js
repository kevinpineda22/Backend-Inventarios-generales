// =====================================================
// SERVICIO: INVENTARIO CONSOLIDADO
// =====================================================

import InventarioConsolidadoModel from '../models/InventarioConsolidado.model.js';
import ConteoModel from '../models/Conteo.model.js';
import ConteoItemModel from '../models/ConteoItem.model.js';
import UbicacionModel from '../models/Ubicacion.model.js';
import PasilloModel from '../models/Pasillo.model.js';
import ZonaModel from '../models/Zona.model.js';
import BodegaModel from '../models/Bodega.model.js';

class InventarioConsolidadoService {
  /**
   * Consolidar inventario según nivel jerárquico
   */
  static async consolidarInventario(nivel, referenciaId) {
    try {
      let itemsConsolidados = [];
      let jerarquia = {};

      switch (nivel) {
        case 'ubicacion':
          itemsConsolidados = await this.calcularInventarioUbicacion(referenciaId);
          jerarquia = await this.getJerarquiaUbicacion(referenciaId);
          break;

        case 'pasillo':
          // Primero consolidar todas las ubicaciones del pasillo
          await this.consolidarUbicacionesDePasillo(referenciaId);
          // Luego sumar las consolidaciones
          itemsConsolidados = await this.sumarInventarioHijos('ubicacion', 'pasillo_id', referenciaId);
          jerarquia = await this.getJerarquiaPasillo(referenciaId);
          break;

        case 'zona':
          // Primero consolidar todos los pasillos de la zona
          await this.consolidarPasillosDeZona(referenciaId);
          // Luego sumar las consolidaciones
          itemsConsolidados = await this.sumarInventarioHijos('pasillo', 'zona_id', referenciaId);
          jerarquia = await this.getJerarquiaZona(referenciaId);
          break;

        case 'bodega':
          // Primero consolidar todas las zonas de la bodega
          await this.consolidarZonasDeBodega(referenciaId);
          // Luego sumar las consolidaciones
          itemsConsolidados = await this.sumarInventarioHijos('zona', 'bodega_id', referenciaId);
          jerarquia = await this.getJerarquiaBodega(referenciaId);
          break;

        default:
          throw new Error(`Nivel no válido: ${nivel}`);
      }

      // Guardar en tabla consolidada
      if (itemsConsolidados.length > 0) {
        await InventarioConsolidadoModel.upsertBatch(
          itemsConsolidados,
          nivel,
          referenciaId,
          jerarquia
        );
      }

      return {
        success: true,
        items_consolidados: itemsConsolidados.length,
        nivel,
        referencia_id: referenciaId
      };
    } catch (error) {
      throw new Error(`Error al consolidar inventario: ${error.message}`);
    }
  }

  /**
   * Calcular inventario de una ubicación específica
   */
  static async calcularInventarioUbicacion(ubicacionId) {
    try {
      // Obtener conteos de esta ubicación (C1, C2, C3, C4)
      const conteos = await ConteoModel.findByUbicacion(ubicacionId);

      const conteosPorTipo = {
        c1: conteos.find(c => c.tipo_conteo === 1),
        c2: conteos.find(c => c.tipo_conteo === 2),
        c3: conteos.find(c => c.tipo_conteo === 3),
        c4: conteos.find(c => c.tipo_conteo === 4)
      };

      // Obtener items de cada conteo
      const itemsMap = new Map();

      for (const [tipo, conteo] of Object.entries(conteosPorTipo)) {
        if (!conteo) continue;

        const items = await ConteoItemModel.findByConteo(conteo.id);
        items.forEach(item => {
          const key = item.item_id;
          if (!itemsMap.has(key)) {
            itemsMap.set(key, { q1: 0, q2: 0, q3: 0, q4: 0 });
          }

          const data = itemsMap.get(key);
          const qty = Number(item.cantidad);

          if (tipo === 'c1') data.q1 += qty;
          else if (tipo === 'c2') data.q2 += qty;
          else if (tipo === 'c3') data.q3 += qty;
          else if (tipo === 'c4') data.q4 += qty;
        });
      }

      // Aplicar lógica de consenso (misma lógica que exportarBodega)
      const resultado = [];
      for (const [itemId, counts] of itemsMap) {
        let cantidadFinal = 0;

        // Prioridad: C4 > C3 > Consenso C1=C2 > C2 > C1
        if (counts.q4 > 0) {
          cantidadFinal = counts.q4;
        } else if (counts.q3 > 0) {
          cantidadFinal = counts.q3;
        } else if (counts.q1 === counts.q2 && counts.q1 > 0) {
          cantidadFinal = counts.q1;
        } else if (counts.q2 > 0) {
          cantidadFinal = counts.q2;
        } else {
          cantidadFinal = counts.q1;
        }

        // Safety net: rescatar si hay historial positivo
        if (cantidadFinal === 0) {
          const maxH = Math.max(counts.q1 || 0, counts.q2 || 0, counts.q3 || 0);
          if (maxH > 0) {
            cantidadFinal = maxH;
          }
        }

        if (cantidadFinal > 0) {
          resultado.push({ item_id: itemId, cantidad: cantidadFinal });
        }
      }

      return resultado;
    } catch (error) {
      throw new Error(`Error al calcular inventario de ubicación: ${error.message}`);
    }
  }

  /**
   * Sumar inventario de hijos (ubicaciones de un pasillo, pasillos de una zona, etc.)
   */
  static async sumarInventarioHijos(nivelHijo, campoFiltro, valorFiltro) {
    try {
      return await InventarioConsolidadoModel.sumByParent(nivelHijo, campoFiltro, valorFiltro);
    } catch (error) {
      throw new Error(`Error al sumar inventario de hijos: ${error.message}`);
    }
  }

  /**
   * Consolidar todas las ubicaciones de un pasillo
   */
  static async consolidarUbicacionesDePasillo(pasilloId) {
    const ubicaciones = await UbicacionModel.findByPasillo(pasilloId);
    
    for (const ubicacion of ubicaciones) {
      try {
        const itemsConsolidados = await this.calcularInventarioUbicacion(ubicacion.id);
        const jerarquia = await this.getJerarquiaUbicacion(ubicacion.id);
        
        if (itemsConsolidados.length > 0) {
          await InventarioConsolidadoModel.upsertBatch(
            itemsConsolidados,
            'ubicacion',
            ubicacion.id,
            jerarquia
          );
        }
      } catch (error) {
        console.error(`Error consolidando ubicación ${ubicacion.id}:`, error);
        // Continuar con la siguiente ubicación
      }
    }
  }

  /**
   * Consolidar todos los pasillos de una zona
   */
  static async consolidarPasillosDeZona(zonaId) {
    const pasillos = await PasilloModel.findByZona(zonaId);
    
    for (const pasillo of pasillos) {
      try {
        // Consolidar ubicaciones del pasillo primero
        await this.consolidarUbicacionesDePasillo(pasillo.id);
        
        // Luego consolidar el pasillo
        const itemsConsolidados = await this.sumarInventarioHijos('ubicacion', 'pasillo_id', pasillo.id);
        const jerarquia = await this.getJerarquiaPasillo(pasillo.id);
        
        if (itemsConsolidados.length > 0) {
          await InventarioConsolidadoModel.upsertBatch(
            itemsConsolidados,
            'pasillo',
            pasillo.id,
            jerarquia
          );
        }
      } catch (error) {
        console.error(`Error consolidando pasillo ${pasillo.id}:`, error);
        // Continuar con el siguiente pasillo
      }
    }
  }

  /**
   * Consolidar todas las zonas de una bodega
   */
  static async consolidarZonasDeBodega(bodegaId) {
    const zonas = await ZonaModel.findByBodega(bodegaId);
    
    for (const zona of zonas) {
      try {
        // Consolidar pasillos de la zona primero
        await this.consolidarPasillosDeZona(zona.id);
        
        // Luego consolidar la zona
        const itemsConsolidados = await this.sumarInventarioHijos('pasillo', 'zona_id', zona.id);
        const jerarquia = await this.getJerarquiaZona(zona.id);
        
        if (itemsConsolidados.length > 0) {
          await InventarioConsolidadoModel.upsertBatch(
            itemsConsolidados,
            'zona',
            zona.id,
            jerarquia
          );
        }
      } catch (error) {
        console.error(`Error consolidando zona ${zona.id}:`, error);
        // Continuar con la siguiente zona
      }
    }
  }

  /**
   * Obtener jerarquía completa de una ubicación
   */
  static async getJerarquiaUbicacion(ubicacionId) {
    const ubicacion = await UbicacionModel.findById(ubicacionId);
    const pasillo = await PasilloModel.findById(ubicacion.pasillo_id);
    const zona = await ZonaModel.findById(pasillo.zona_id);
    const bodega = await BodegaModel.findById(zona.bodega_id);

    return {
      compania_id: bodega.compania_id,
      bodega_id: bodega.id,
      zona_id: zona.id,
      pasillo_id: pasillo.id,
      ubicacion_id: ubicacion.id
    };
  }

  /**
   * Obtener jerarquía completa de un pasillo
   */
  static async getJerarquiaPasillo(pasilloId) {
    const pasillo = await PasilloModel.findById(pasilloId);
    const zona = await ZonaModel.findById(pasillo.zona_id);
    const bodega = await BodegaModel.findById(zona.bodega_id);

    return {
      compania_id: bodega.compania_id,
      bodega_id: bodega.id,
      zona_id: zona.id,
      pasillo_id: pasillo.id,
      ubicacion_id: null
    };
  }

  /**
   * Obtener jerarquía completa de una zona
   */
  static async getJerarquiaZona(zonaId) {
    const zona = await ZonaModel.findById(zonaId);
    const bodega = await BodegaModel.findById(zona.bodega_id);

    return {
      compania_id: bodega.compania_id,
      bodega_id: bodega.id,
      zona_id: zona.id,
      pasillo_id: null,
      ubicacion_id: null
    };
  }

  /**
   * Obtener jerarquía completa de una bodega
   */
  static async getJerarquiaBodega(bodegaId) {
    const bodega = await BodegaModel.findById(bodegaId);

    return {
      compania_id: bodega.compania_id,
      bodega_id: bodega.id,
      zona_id: null,
      pasillo_id: null,
      ubicacion_id: null
    };
  }
}

export default InventarioConsolidadoService;
