// =====================================================
// MODELO: ZONAS
// =====================================================

import {
  supabase,
  supabaseAdmin,
  TABLES,
  handleSupabaseError,
} from "../config/supabase.js";

const client = supabaseAdmin || supabase;

export class ZonaModel {
  /**
   * Obtener todas las zonas de una bodega
   */
  static async findByBodega(bodegaId) {
    try {
      const { data, error } = await client
        .from(TABLES.ZONAS)
        .select("*")
        .eq("bodega_id", bodegaId)
        .eq("activo", true)
        .order("nombre", { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Obtener zona por ID
   */
  static async findById(id) {
    try {
      const { data, error } = await client
        .from(TABLES.ZONAS)
        .select("*, bodega:inv_general_bodegas(*)")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Crear una zona
   */
  static async create(zonaData) {
    try {
      const { data, error } = await client
        .from(TABLES.ZONAS)
        .insert([zonaData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Actualizar una zona
   */
  static async update(id, updateData) {
    try {
      const { data, error } = await client
        .from(TABLES.ZONAS)
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
   * Desactivar una zona
   */
  static async deactivate(id) {
    try {
      const { data, error } = await client
        .from(TABLES.ZONAS)
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
   * Eliminar una zona
   */
  static async delete(id) {
    try {
      const { error } = await client.from(TABLES.ZONAS).delete().eq("id", id);

      if (error) throw error;
      return true;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }
}

export default ZonaModel;
