// =====================================================
// MODELO: RECONTEO SIESA
// =====================================================

import { supabase, handleSupabaseError } from '../config/supabase.js';

const TABLE = 'inv_general_reconteo_siesa';
const VIEW = 'v_reconteo_siesa_completo';

export class ReconteoSiesaModel {

  /**
   * Insertar múltiples registros de reconteo (batch)
   */
  static async insertBatch(records) {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .insert(records)
        .select();
      if (error) throw error;
      return data;
    } catch (error) { throw handleSupabaseError(error); }
  }

  /**
   * Buscar reconteos por lote
   */
  static async findByLote(loteId) {
    try {
      const { data, error } = await supabase
        .from(VIEW)
        .select('*')
        .eq('lote_id', loteId)
        .order('zona_nombre', { ascending: true })
        .order('pasillo_nombre', { ascending: true })
        .order('ubicacion_nombre', { ascending: true });
      if (error) throw error;
      return data;
    } catch (error) { throw handleSupabaseError(error); }
  }

  /**
   * Buscar reconteos por bodega (con filtros opcionales)
   */
  static async findByBodega(bodegaId, filters = {}) {
    try {
      let query = supabase
        .from(VIEW)
        .select('*')
        .eq('bodega_id', bodegaId);

      if (filters.estado) query = query.eq('estado', filters.estado);
      if (filters.asignado_a) query = query.eq('asignado_a', filters.asignado_a);
      if (filters.zona_id) query = query.eq('zona_id', filters.zona_id);
      if (filters.pasillo_id) query = query.eq('pasillo_id', filters.pasillo_id);
      if (filters.ubicacion_id) query = query.eq('ubicacion_id', filters.ubicacion_id);
      if (filters.lote_id) query = query.eq('lote_id', filters.lote_id);

      query = query
        .order('zona_nombre', { ascending: true })
        .order('pasillo_nombre', { ascending: true })
        .order('ubicacion_nombre', { ascending: true });

      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (error) { throw handleSupabaseError(error); }
  }

  /**
   * Buscar reconteos asignados a un empleado
   */
  static async findByEmpleado(correoEmpleado, filters = {}) {
    try {
      let query = supabase
        .from(VIEW)
        .select('*')
        .eq('asignado_a', correoEmpleado);

      if (filters.estado) query = query.eq('estado', filters.estado);
      if (filters.compania_id) query = query.eq('compania_id', filters.compania_id);
      if (filters.bodega_id) query = query.eq('bodega_id', filters.bodega_id);

      query = query
        .order('estado', { ascending: true })
        .order('zona_nombre', { ascending: true })
        .order('pasillo_nombre', { ascending: true })
        .order('ubicacion_nombre', { ascending: true });

      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (error) { throw handleSupabaseError(error); }
  }

  /**
   * Buscar un reconteo por ID
   */
  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from(VIEW)
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    } catch (error) { throw handleSupabaseError(error); }
  }

  /**
   * Buscar reconteos por ubicación e item
   */
  static async findByUbicacionAndItem(ubicacionId, itemId) {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .eq('ubicacion_id', ubicacionId)
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (error) { throw handleSupabaseError(error); }
  }

  /**
   * Buscar reconteos por ubicación
   */
  static async findByUbicacion(ubicacionId, filters = {}) {
    try {
      let query = supabase
        .from(VIEW)
        .select('*')
        .eq('ubicacion_id', ubicacionId);

      if (filters.estado) query = query.eq('estado', filters.estado);
      if (filters.lote_id) query = query.eq('lote_id', filters.lote_id);

      query = query.order('item_sku', { ascending: true });

      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (error) { throw handleSupabaseError(error); }
  }

  /**
   * Actualizar un reconteo
   */
  static async update(id, updateData) {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) { throw handleSupabaseError(error); }
  }

  /**
   * Actualizar múltiples reconteos por IDs
   */
  static async updateBatch(ids, updateData) {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .in('id', ids)
        .select();
      if (error) throw error;
      return data;
    } catch (error) { throw handleSupabaseError(error); }
  }

  /**
   * Obtener lotes únicos por bodega
   */
  static async getLotesByBodega(bodegaId) {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('lote_id, fecha_comparacion, compania_id')
        .eq('bodega_id', bodegaId)
        .not('lote_id', 'is', null)
        .order('fecha_comparacion', { ascending: false });
      if (error) throw error;

      // Deduplicar por lote_id
      const lotesMap = new Map();
      data.forEach(r => {
        if (!lotesMap.has(r.lote_id)) {
          lotesMap.set(r.lote_id, r);
        }
      });
      return Array.from(lotesMap.values());
    } catch (error) { throw handleSupabaseError(error); }
  }

  /**
   * Obtener resumen de estados por bodega
   */
  static async getResumenByBodega(bodegaId) {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('estado, id')
        .eq('bodega_id', bodegaId);
      if (error) throw error;

      const resumen = {
        total: data.length,
        pendiente: 0,
        asignado: 0,
        en_progreso: 0,
        finalizado: 0,
        aprobado: 0,
        rechazado: 0
      };
      data.forEach(r => {
        if (resumen[r.estado] !== undefined) resumen[r.estado]++;
      });
      return resumen;
    } catch (error) { throw handleSupabaseError(error); }
  }

  /**
   * Eliminar reconteos por lote
   */
  static async deleteByLote(loteId) {
    try {
      const { error } = await supabase
        .from(TABLE)
        .delete()
        .eq('lote_id', loteId);
      if (error) throw error;
      return true;
    } catch (error) { throw handleSupabaseError(error); }
  }

  /**
   * Obtener todos los empleados con reconteos asignados para una bodega
   */
  static async getEmpleadosAsignados(bodegaId) {
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select('asignado_a')
        .eq('bodega_id', bodegaId)
        .not('asignado_a', 'is', null);
      if (error) throw error;

      return [...new Set(data.map(r => r.asignado_a).filter(Boolean))];
    } catch (error) { throw handleSupabaseError(error); }
  }
}

export default ReconteoSiesaModel;
