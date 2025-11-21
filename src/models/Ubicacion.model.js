// =====================================================
// MODELO: UBICACIONES
// =====================================================

import { supabase, TABLES, handleSupabaseError } from "../config/supabase.js";

export class UbicacionModel {
  /**
   * Obtener todas las ubicaciones de un pasillo
   */
  static async findByPasillo(pasilloId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.UBICACIONES)
        .select("*")
        .eq("pasillo_id", pasilloId)
        .eq("activo", true)
        .order("numero", { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Obtener ubicación por ID
   */
  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from(TABLES.UBICACIONES)
        .select(
          `
          *, 
          pasillo:inv_general_pasillos(
            *, 
            zona:inv_general_zonas(
              *, 
              bodega:inv_general_bodegas(*)
            )
          )
        `
        )
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Crear una ubicación
   */
  static async create(ubicacionData) {
    try {
      const { data, error } = await supabase
        .from(TABLES.UBICACIONES)
        .insert([ubicacionData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Crear múltiples ubicaciones
   */
  static async createMany(ubicacionesData) {
    try {
      const { data, error } = await supabase
        .from(TABLES.UBICACIONES)
        .insert(ubicacionesData)
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Actualizar una ubicación
   */
  static async update(id, updateData) {
    try {
      const { data, error } = await supabase
        .from(TABLES.UBICACIONES)
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
   * Desactivar una ubicación
   */
  static async deactivate(id) {
    try {
      const { data, error } = await supabase
        .from(TABLES.UBICACIONES)
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
   * Eliminar una ubicación
   */
  static async delete(id) {
    try {
      const { error } = await supabase
        .from(TABLES.UBICACIONES)
        .delete()
        .eq("id", id);

      if (error) throw error;
      return true;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Eliminar múltiples ubicaciones
   */
  static async deleteMany(ids) {
    try {
      const { error } = await supabase
        .from(TABLES.UBICACIONES)
        .delete()
        .in("id", ids);

      if (error) throw error;
      return true;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Verificar clave de una ubicación
   */
  static async verifyClave(id, clave) {
    try {
      const { data, error } = await supabase
        .from(TABLES.UBICACIONES)
        .select("clave")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data.clave === clave;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }
}

export default UbicacionModel;
