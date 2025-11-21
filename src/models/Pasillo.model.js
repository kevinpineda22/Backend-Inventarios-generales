// =====================================================
// MODELO: PASILLOS
// =====================================================

import { supabase, TABLES, handleSupabaseError } from '../config/supabase.js';

export class PasilloModel {
  /**
   * Obtener todos los pasillos de una zona
   */
  static async findByZona(zonaId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.PASILLOS)
        .select('*')
        .eq('zona_id', zonaId)
        .eq('activo', true)
        .order('numero', { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Obtener pasillo por ID
   */
  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from(TABLES.PASILLOS)
        .select('*, zona:inv_general_zonas(*, bodega:inv_general_bodegas(*))')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Crear un pasillo
   */
  static async create(pasilloData) {
    try {
      const { data, error } = await supabase
        .from(TABLES.PASILLOS)
        .insert([pasilloData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Actualizar un pasillo
   */
  static async update(id, updateData) {
    try {
      const { data, error } = await supabase
        .from(TABLES.PASILLOS)
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
   * Desactivar un pasillo
   */
  static async deactivate(id) {
    try {
      const { data, error } = await supabase
        .from(TABLES.PASILLOS)
        .update({ activo: false, updated_at: new Date().toISOString() })
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
   * Eliminar un pasillo
   */
  static async delete(id) {
    try {
      const { error } = await supabase
        .from(TABLES.PASILLOS)
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }
}

export default PasilloModel;
