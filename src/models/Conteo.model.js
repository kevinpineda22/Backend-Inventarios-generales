// =====================================================
// MODELO: CONTEOS
// =====================================================

import { supabase, TABLES, handleSupabaseError } from '../config/supabase.js';

export class ConteoModel {
  /**
   * Obtener todos los conteos de una ubicación
   */
  static async findByUbicacion(ubicacionId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.CONTEOS)
        .select('*')
        .eq('ubicacion_id', ubicacionId)
        .order('tipo_conteo', { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Obtener conteo por ID con sus items
   */
  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from(TABLES.CONTEOS)
        .select(`
          *,
          ubicacion:inv_general_ubicaciones(*),
          items:inv_general_conteo_items(
            *,
            item:inv_general_items(*)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Obtener conteo específico de una ubicación
   */
  static async findByUbicacionAndTipo(ubicacionId, tipoConteo) {
    try {
      const { data, error } = await supabase
        .from(TABLES.CONTEOS)
        .select(`
          *,
          items:inv_general_conteo_items(
            *,
            item:inv_general_items(*)
          )
        `)
        .eq('ubicacion_id', ubicacionId)
        .eq('tipo_conteo', tipoConteo)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Crear un conteo
   */
  static async create(conteoData) {
    try {
      const { data, error } = await supabase
        .from(TABLES.CONTEOS)
        .insert([{
          ...conteoData,
          fecha_inicio: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Actualizar un conteo
   */
  static async update(id, updateData) {
    try {
      const { data, error } = await supabase
        .from(TABLES.CONTEOS)
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
   * Finalizar un conteo
   */
  static async finalizar(id) {
    try {
      const { data, error } = await supabase
        .from(TABLES.CONTEOS)
        .update({
          estado: 'finalizado',
          fecha_fin: new Date().toISOString(),
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
   * Aprobar un conteo
   */
  static async aprobar(id) {
    try {
      const { data, error } = await supabase
        .from(TABLES.CONTEOS)
        .update({
          estado: 'aprobado',
          fecha_aprobacion: new Date().toISOString(),
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
   * Rechazar un conteo
   */
  static async rechazar(id, motivo) {
    try {
      const { data, error } = await supabase
        .from(TABLES.CONTEOS)
        .update({
          estado: 'rechazado',
          fecha_rechazo: new Date().toISOString(),
          motivo_rechazo: motivo,
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
   * Obtener historial de conteos por pasillo
   */
  static async getHistorialByPasillo(pasilloId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.CONTEOS)
        .select(`
          *,
          ubicacion:inv_general_ubicaciones!inner(
            *,
            pasillo_id
          )
        `)
        .eq('ubicacion.pasillo_id', pasilloId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Obtener conteos pendientes de aprobación
   */
  static async getPendientes() {
    try {
      const { data, error } = await supabase
        .from(TABLES.CONTEOS)
        .select(`
          *,
          ubicacion:inv_general_ubicaciones(
            *,
            pasillo:inv_general_pasillos(
              *,
              zona:inv_general_zonas(
                *,
                bodega:inv_general_bodegas(*)
              )
            )
          )
        `)
        .eq('estado', 'finalizado')
        .order('fecha_fin', { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Eliminar un conteo
   */
  static async delete(id) {
    try {
      const { error } = await supabase
        .from(TABLES.CONTEOS)
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }
}

export default ConteoModel;
