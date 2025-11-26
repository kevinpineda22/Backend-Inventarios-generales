// =====================================================
// MODELO: BODEGAS
// =====================================================

import {
  supabase,
  supabaseAdmin,
  TABLES,
  handleSupabaseError,
} from "../config/supabase.js";

const client = supabaseAdmin || supabase;

export class BodegaModel {
  /**
   * Obtener todas las bodegas de una compañía
   */
  static async findByCompany(companiaId) {
    try {
      const { data, error } = await client
        .from(TABLES.BODEGAS)
        .select("*")
        .eq("compania_id", companiaId)
        .eq("activo", true)
        .order("nombre", { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Obtener bodega por ID
   */
  static async findById(id) {
    try {
      const { data, error } = await client
        .from(TABLES.BODEGAS)
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Crear una bodega
   */
  static async create(bodegaData) {
    try {
      const { data, error } = await client
        .from(TABLES.BODEGAS)
        .insert([bodegaData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Actualizar una bodega
   */
  static async update(id, updateData) {
    try {
      const { data, error } = await client
        .from(TABLES.BODEGAS)
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Desactivar una bodega (soft delete)
   */
  static async deactivate(id) {
    try {
      const { data, error } = await client
        .from(TABLES.BODEGAS)
        .update({ activo: false, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Eliminar una bodega (hard delete)
   */
  static async delete(id) {
    try {
      const { error } = await client.from(TABLES.BODEGAS).delete().eq("id", id);

      if (error) throw error;
      return true;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }
}

export default BodegaModel;
