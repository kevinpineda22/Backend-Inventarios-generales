// =====================================================
// MODELO: INVENTARIO CONSOLIDADO
// =====================================================

import { supabase, TABLES, handleSupabaseError } from '../config/supabase.js';

export class InventarioConsolidadoModel {
  /**
   * Guardar o actualizar inventario consolidado
   */
  static async upsert(data) {
    try {
      const { data: result, error } = await supabase
        .from('inv_general_inventario_consolidado')
        .upsert([data], {
          onConflict: 'nivel,referencia_id,item_id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Guardar o actualizar múltiples registros
   */
  static async upsertBatch(items, nivel, referenciaId, jerarquia) {
    try {
      const records = items.map(item => ({
        nivel,
        referencia_id: referenciaId,
        item_id: item.item_id,
        cantidad_total: item.cantidad,
        compania_id: parseInt(jerarquia.compania_id), // Convertir a integer
        bodega_id: jerarquia.bodega_id,
        zona_id: jerarquia.zona_id || null,
        pasillo_id: jerarquia.pasillo_id || null,
        ubicacion_id: jerarquia.ubicacion_id || null
      }));

      const { data, error } = await supabase
        .from('inv_general_inventario_consolidado')
        .upsert(records, {
          onConflict: 'nivel,referencia_id,item_id',
          ignoreDuplicates: false
        })
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Obtener consolidado por nivel y referencia
   */
  static async findByNivelAndReferencia(nivel, referenciaId) {
    try {
      const { data, error } = await supabase
        .from('inv_general_inventario_consolidado')
        .select('*')
        .eq('nivel', nivel)
        .eq('referencia_id', referenciaId);

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Obtener consolidado sumando por campo padre
   */
  static async sumByParent(nivelHijo, campoFiltro, valorFiltro) {
    try {
      const { data, error } = await supabase
        .from('inv_general_inventario_consolidado')
        .select('item_id, cantidad_total')
        .eq('nivel', nivelHijo)
        .eq(campoFiltro, valorFiltro);

      if (error) throw error;

      // Agrupar por item_id y sumar
      const itemsMap = new Map();
      data.forEach(row => {
        const itemId = row.item_id;
        const cantidad = Number(row.cantidad_total);

        if (itemsMap.has(itemId)) {
          itemsMap.set(itemId, itemsMap.get(itemId) + cantidad);
        } else {
          itemsMap.set(itemId, cantidad);
        }
      });

      // Convertir a array
      return Array.from(itemsMap).map(([item_id, cantidad]) => ({
        item_id,
        cantidad
      }));
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Obtener inventario consolidado de una bodega
   */
  static async getInventarioBodega(bodegaId) {
    try {
      const { data, error } = await supabase
        .from('inv_general_inventario_consolidado')
        .select(`
          *,
          item:inv_general_items(*)
        `)
        .eq('nivel', 'bodega')
        .eq('bodega_id', bodegaId);

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }
}

export default InventarioConsolidadoModel;
