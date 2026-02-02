// =====================================================
// MODELO: CONTEO ITEMS (ITEMS CONTADOS)
// =====================================================

import { supabase, TABLES, handleSupabaseError } from '../config/supabase.js';

export class ConteoItemModel {
  /**
   * Obtener todos los items de un conteo
   */
  static async findByConteo(conteoId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.CONTEO_ITEMS)
        .select(`
          *,
          item:inv_general_items(*)
        `)
        .eq('conteo_id', conteoId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Obtener item específico de un conteo
   */
  static async findByConteoAndItem(conteoId, itemId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.CONTEO_ITEMS)
        .select('*')
        .eq('conteo_id', conteoId)
        .eq('item_id', itemId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Buscar en qué conteos/ubicaciones están uno o varios items (Array of IDs support)
   */
  static async findLocationsByItem(itemId) {
    try {
      const ids = Array.isArray(itemId) ? itemId : [itemId];
      
      const { data, error } = await supabase
        .from(TABLES.CONTEO_ITEMS)
        .select(`
          cantidad,
          created_at,
          conteo:inv_general_conteos (
            id,
            tipo_conteo,
            estado,
            ubicacion:inv_general_ubicaciones (
              id,
              numero,
              pasillo:inv_general_pasillos (
                id,
                numero,
                zona:inv_general_zonas (
                  id,
                  nombre,
                  bodega:inv_general_bodegas (
                    id,
                    nombre,
                    compania_id
                  )
                )
              )
            )
          )
        `)
        .in('item_id', ids) // Changed from eq to in
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Agregar un item al conteo (INSERT siempre, para historial)
   */
  static async create(conteoItemData) {
    try {
      const { data, error } = await supabase
        .from(TABLES.CONTEO_ITEMS)
        .insert([conteoItemData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Actualizar cantidad de un item en el conteo
   */
  static async update(id, cantidad) {
    try {
      const { data, error } = await supabase
        .from(TABLES.CONTEO_ITEMS)
        .update({ 
          cantidad, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Agregar item (Ahora usa CREATE siempre para mantener historial de escaneos)
   */
  static async upsert(conteoId, itemId, cantidad, usuarioEmail = null) {
    try {
        // YA NO HACEMOS UPSERT, SINO INSERT PUURO
        return await this.create({
          conteo_id: conteoId,
          item_id: itemId,
          cantidad,
          usuario_email: usuarioEmail // Nuevo campo
        });
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Eliminar un item del conteo
   */
  static async delete(id) {
    try {
      const { error } = await supabase
        .from(TABLES.CONTEO_ITEMS)
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Eliminar todos los items de un conteo
   */
  static async deleteByConteo(conteoId) {
    try {
      const { error } = await supabase
        .from(TABLES.CONTEO_ITEMS)
        .delete()
        .eq('conteo_id', conteoId);

      if (error) throw error;
      return true;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Contar items de un conteo
   */
  static async countByConteo(conteoId) {
    try {
      const { count, error } = await supabase
        .from(TABLES.CONTEO_ITEMS)
        .select('*', { count: 'exact', head: true })
        .eq('conteo_id', conteoId);

      if (error) throw error;
      return count;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }
}

export default ConteoItemModel;
