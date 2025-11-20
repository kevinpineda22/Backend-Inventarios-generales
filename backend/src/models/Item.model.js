// =====================================================
// MODELO: ITEMS (PRODUCTOS/ARTÍCULOS)
// =====================================================

import { supabase, TABLES, handleSupabaseError } from '../config/supabase.js';

export class ItemModel {
  /**
   * Obtener todos los items de una compañía
   */
  static async findByCompany(companiaId, filters = {}) {
    try {
      let query = supabase
        .from(TABLES.ITEMS)
        .select('*')
        .eq('compania_id', companiaId);

      // Filtros opcionales
      if (filters.item) {
        query = query.ilike('item', `%${filters.item}%`);
      }
      if (filters.descripcion) {
        query = query.ilike('descripcion', `%${filters.descripcion}%`);
      }
      if (filters.codigo_barra) {
        query = query.eq('codigo_barra', filters.codigo_barra);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Buscar item por código de barras
   */
  static async findByBarcode(codigoBarra, companiaId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.ITEMS)
        .select('*')
        .eq('codigo_barra', codigoBarra)
        .eq('compania_id', companiaId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Obtener item por ID
   */
  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from(TABLES.ITEMS)
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Crear un item
   */
  static async create(itemData) {
    try {
      const { data, error } = await supabase
        .from(TABLES.ITEMS)
        .insert([itemData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Crear múltiples items (carga masiva)
   */
  static async createMany(itemsData) {
    try {
      const { data, error } = await supabase
        .from(TABLES.ITEMS)
        .insert(itemsData)
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Upsert múltiples items (insertar o actualizar si existe)
   */
  static async upsertMany(itemsData) {
    try {
      const { data, error } = await supabase
        .from(TABLES.ITEMS)
        .upsert(itemsData, { 
          onConflict: 'codigo',  // Si el codigo existe, actualiza
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
   * Actualizar un item
   */
  static async update(id, updateData) {
    try {
      const { data, error } = await supabase
        .from(TABLES.ITEMS)
        .update({ ...updateData, updated_at: new Date().toISOString() })
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
   * Eliminar un item
   */
  static async delete(id) {
    try {
      const { error } = await supabase
        .from(TABLES.ITEMS)
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Eliminar todos los items de una compañía
   */
  static async deleteByCompany(companiaId) {
    try {
      const { error } = await supabase
        .from(TABLES.ITEMS)
        .delete()
        .eq('compania_id', companiaId);

      if (error) throw error;
      return true;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Contar items de una compañía
   */
  static async countByCompany(companiaId) {
    try {
      const { count, error } = await supabase
        .from(TABLES.ITEMS)
        .select('*', { count: 'exact', head: true })
        .eq('compania_id', companiaId);

      if (error) throw error;
      return count;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }
}

export default ItemModel;
