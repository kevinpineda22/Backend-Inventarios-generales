// Modelo para la tabla inv_general_codigos
// =====================================================
// MODELO: CODIGOS DE BARRAS (inv_general_codigos)
// =====================================================

import { supabase, TABLES, handleSupabaseError } from '../config/supabase.js';

export class CodigoModel {
  /**
   * Obtener todos los códigos de barras activos
   */
  static async findAllActive() {
    try {
      const { data, error } = await supabase
        .from(TABLES.CODIGOS)
        .select('codigo_barras')
        .eq('activo', true);
      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Obtener todos los códigos de barras
   */
  static async findAll() {
    try {
      const { data, error } = await supabase
        .from(TABLES.CODIGOS)
        .select('*');
      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Insertar o actualizar múltiples códigos de barras
   */
  static async createMany(codigos) {
    try {
      const { data, error } = await supabase
        .from(TABLES.CODIGOS)
        .upsert(codigos, { 
          onConflict: 'codigo_barras, compania_id',  // Clave compuesta para unicidad por compañía
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
   * Buscar producto por código de barras (con JOIN a items)
   */
  static async findByBarcodeWithItem(codigoBarras, companiaId = null) {
    try {
      // Intentar con 'codigo_barras' (plural)
      let query = supabase
        .from(TABLES.CODIGOS)
        .select(`
          codigo_barras,
          unidad_medida,
          factor,
          activo,
          inv_general_items (
            *
          )
        `)
        .eq('codigo_barras', codigoBarras)
        .eq('activo', true);

      if (companiaId) {
        query = query.eq('compania_id', companiaId);
      }

      const { data, error } = await query.single();
      
      if (error) {
        // Si el error es que la columna no existe, intentar con 'codigo_barra' (singular)
        if (error.message && error.message.includes('does not exist')) {
             let query2 = supabase
            .from(TABLES.CODIGOS)
            .select(`
              codigo_barra,
              unidad_medida,
              factor,
              activo,
              inv_general_items (
                *
              )
            `)
            .eq('codigo_barra', codigoBarras)
            .eq('activo', true);

          if (companiaId) {
            query2 = query2.eq('compania_id', companiaId);
          }
          
          const { data: data2, error: error2 } = await query2.single();
          if (error2 && error2.code !== 'PGRST116') throw error2;
          
          // Normalizar respuesta si se encontró con singular
          if (data2) {
              data2.codigo_barras = data2.codigo_barra;
          }
          return data2;
        }
        
        if (error.code !== 'PGRST116') throw error;
      }
      
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }
}

export default CodigoModel;
