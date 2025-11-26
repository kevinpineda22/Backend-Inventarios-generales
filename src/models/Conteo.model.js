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
   * Obtener conteo específico de una ubicación (Recuperar el más reciente)
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
        .order('created_at', { ascending: false }) // Traer el más reciente
        .limit(1)
        .maybeSingle(); // Usar maybeSingle para evitar error si hay múltiples o ninguno

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Obtener conteo específico de una ubicación y usuario (Recuperar sesión personal)
   */
  static async findByUbicacionTipoAndUsuario(ubicacionId, tipoConteo, usuarioId) {
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
        .eq('usuario_id', usuarioId) // Filtrar por usuario
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
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
   * Obtener historial de conteos con filtros
   */
  static async findAll(filters = {}) {
    try {
      let query = supabase
        .from(TABLES.CONTEOS)
        .select(`
          *,
          ubicacion:inv_general_ubicaciones!inner(
            *,
            pasillo:inv_general_pasillos!inner(
              *,
              zona:inv_general_zonas!inner(
                *,
                bodega:inv_general_bodegas!inner(*)
              )
            )
          ),
          conteo_items:inv_general_conteo_items(count)
        `)
        .order('created_at', { ascending: false });

      // Aplicar filtros
      if (filters.companiaId) {
        query = query.eq('ubicacion.pasillo.zona.bodega.compania_id', filters.companiaId);
      }
      if (filters.bodega) {
        query = query.ilike('ubicacion.pasillo.zona.bodega.nombre', `%${filters.bodega}%`);
      }
      if (filters.zona) {
        query = query.ilike('ubicacion.pasillo.zona.nombre', `%${filters.zona}%`);
      }
      if (filters.pasillo) {
        query = query.ilike('ubicacion.pasillo.numero', `%${filters.pasillo}%`);
      }
      if (filters.tipoConteo && filters.tipoConteo !== 'todos') {
        query = query.eq('tipo_conteo', filters.tipoConteo);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Obtener todos los conteos con items para exportación
   */
  static async findAllWithItems(filters = {}) {
    try {
      let query = supabase
        .from(TABLES.CONTEOS)
        .select(`
          *,
          ubicacion:inv_general_ubicaciones!inner(
            *,
            pasillo:inv_general_pasillos!inner(
              *,
              zona:inv_general_zonas!inner(
                *,
                bodega:inv_general_bodegas!inner(*)
              )
            )
          ),
          items:inv_general_conteo_items(
            *,
            item:inv_general_items(*)
          )
        `)
        .eq('estado', 'finalizado'); // Solo conteos finalizados

      // Aplicar filtros
      if (filters.bodegaId) {
        query = query.eq('ubicacion.pasillo.zona.bodega.id', filters.bodegaId);
      }

      const { data, error } = await query;

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

  /**
   * Obtener nombres de usuarios desde la tabla profiles
   */
  static async getNombresUsuarios(ids) {
    try {
      if (!ids || ids.length === 0) return [];
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nombre')
        .in('id', ids);

      if (error) throw error;
      return data;
    } catch (error) {
      // Si falla (ej. tabla no existe), retornamos array vacío y no rompemos nada
      console.warn('Error al obtener nombres de usuarios:', error.message);
      return [];
    }
  }
}

export default ConteoModel;
