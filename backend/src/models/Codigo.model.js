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
        .upsert(codigos, { onConflict: ['codigo_barras'] });
      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }
}

export default CodigoModel;
