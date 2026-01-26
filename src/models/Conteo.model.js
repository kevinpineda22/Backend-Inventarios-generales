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
   * Obtener solo cabeceras de conteos (sin items) para análisis rápido
   */
  static async findHeadersByCompany(companiaId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.CONTEOS)
        .select(`
          id,
          tipo_conteo,
          estado,
          ubicacion_id,
          created_at,
          ubicacion:inv_general_ubicaciones!inner(
            id,
            numero,
            clave,
            pasillo:inv_general_pasillos!inner(
              id,
              numero,
              zona:inv_general_zonas!inner(
                id,
                nombre,
                bodega:inv_general_bodegas!inner(
                  id,
                  nombre,
                  compania_id
                )
              )
            )
          )
        `)
        .eq('estado', 'finalizado')
        .eq('ubicacion.pasillo.zona.bodega.compania_id', companiaId);

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
      let selectQuery = `
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
          )
      `;

      // Si hay filtro de producto, necesitamos hacer inner join con items para filtrar
      if (filters.producto) {
        selectQuery += `, conteo_items:inv_general_conteo_items!inner(*, item:inv_general_items!inner(descripcion, codigo))`;
      } else {
        selectQuery += `, conteo_items:inv_general_conteo_items(*, item:inv_general_items(descripcion, codigo))`;
      }

      let query = supabase
        .from(TABLES.CONTEOS)
        .select(selectQuery)
        .order('created_at', { ascending: false });

      // Aplicar filtros
      if (filters.companiaId) {
        query = query.eq('ubicacion.pasillo.zona.bodega.compania_id', filters.companiaId);
      }
      if (filters.bodega) {
        query = query.eq('ubicacion.pasillo.zona.bodega.nombre', filters.bodega);
      }
      if (filters.zona) {
        query = query.ilike('ubicacion.pasillo.zona.nombre', `%${filters.zona}%`);
      }
      if (filters.pasillo) {
        query = query.eq('ubicacion.pasillo.numero', filters.pasillo);
      }
      if (filters.producto) {
        // Filtro por producto (descripcion o codigo)
        // Nota: Supabase no soporta OR entre columnas de tablas relacionadas facilmente en un solo paso
        // Pero podemos usar el filtro en la tabla relacionada 'item'
        const term = `%${filters.producto}%`;
        // Esto filtra los items que coinciden, y como usamos !inner, solo trae los conteos que tienen esos items
        query = query.or(`descripcion.ilike.${term},codigo.ilike.${term}`, { foreignTable: 'conteo_items.item' });
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
        .select('user_id, nombre, correo')
        .in('user_id', ids);

      if (error) throw error;
      
      // Mapear user_id a id para mantener compatibilidad con el resto del código que espera 'id'
      return data.map(p => ({
        id: p.user_id,
        nombre: p.nombre,
        correo: p.correo
      }));
    } catch (error) {
      // Si falla (ej. tabla no existe), retornamos array vacío y no rompemos nada
      console.warn('Error al obtener nombres de usuarios:', error.message);
      return [];
    }
  }

  /**
   * Obtener perfiles por correo (Fallback para cuando no hay ID)
   */
  static async getPerfilesPorCorreo(correos) {
    try {
      if (!correos || correos.length === 0) return [];
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nombre, correo')
        .in('correo', correos);

      if (error) throw error;
      return data;
    } catch (error) {
      console.warn('Error al obtener perfiles por correo:', error.message);
      return [];
    }
  }
}

export default ConteoModel;
