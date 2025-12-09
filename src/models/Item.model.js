// =====================================================
// MODELO: ITEMS (PRODUCTOS/ARTÍCULOS)
// =====================================================

import { supabase, TABLES, handleSupabaseError } from '../config/supabase.js';

export class ItemModel {
  /**
   * Obtener todos los items de una compañía
   */
  static async findByCompany(companiaId, filters = {}) {
    try {
      let query = supabase
        .from(TABLES.ITEMS)
        .select('*')
        .eq('compania_id', companiaId);

      // Filtros opcionales
      if (filters.item) {
        query = query.ilike('item', `%${filters.item}%`);
      }
      if (filters.descripcion) {
        query = query.ilike('descripcion', `%${filters.descripcion}%`);
      }
      if (filters.codigo_barra) {
        query = query.eq('codigo_barra', filters.codigo_barra);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Buscar item por código de barras
   */
  static async findByBarcode(codigoBarra, companiaId) {
    try {
      // Intento 1: Buscar por 'codigo' (que es el identificador del item, a veces usado como barcode principal)
      const { data, error } = await supabase
        .from(TABLES.ITEMS)
        .select('*')
        .eq('codigo', codigoBarra)
        .eq('compania_id', companiaId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (data) return data;

      // Intento 2: Si no se encuentra por 'codigo', intentar por 'codigo_barra' (legacy)
      // Solo si la primera consulta no devolvió datos pero tampoco error fatal
      const { data: data2, error: error2 } = await supabase
        .from(TABLES.ITEMS)
        .select('*')
        .eq('codigo_barra', codigoBarra)
        .eq('compania_id', companiaId)
        .single();

      if (error2 && error2.code !== 'PGRST116') {
          // Si falla porque la columna no existe, ignoramos este error y retornamos null (no encontrado)
          if (error2.message && error2.message.includes('does not exist')) {
              return null;
          }
          throw error2;
      }
      
      return data2;

    } catch (error) {
       // Si el error es "column does not exist" en el primer intento, probamos el segundo directamente
       if (error.message && error.message.includes('does not exist')) {
           try {
                const { data: data3, error: error3 } = await supabase
                .from(TABLES.ITEMS)
                .select('*')
                .eq('codigo_barra', codigoBarra)
                .eq('compania_id', companiaId)
                .single();
                
                if (error3 && error3.code !== 'PGRST116') throw error3;
                return data3;
           } catch (e) {
               // Si ambos fallan, retornamos null o lanzamos error
               if (e.message && e.message.includes('does not exist')) {
                   console.warn('Columnas codigo y codigo_barra no existen en inv_general_items');
                   return null;
               }
               throw handleSupabaseError(e);
           }
       }
       throw handleSupabaseError(error);
    }
  }

  /**
   * Buscar items por término (descripción o código)
   */
  static async search(term, companiaId) {
    try {
      let query = supabase
        .from(TABLES.ITEMS)
        .select('id, codigo, descripcion, codigo_barra');
        
      if (companiaId) {
        query = query.eq('compania_id', companiaId);
      }
        
      query = query.or(`descripcion.ilike.%${term}%,codigo.ilike.%${term}%,codigo_barra.ilike.%${term}%`)
        .limit(10); // Limitar resultados para sugerencias

      const { data, error } = await query;

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Obtener item por ID
   */
  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from(TABLES.ITEMS)
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Crear un item
   */
  static async create(itemData) {
    try {
      const { data, error } = await supabase
        .from(TABLES.ITEMS)
        .insert([itemData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Crear múltiples items (carga masiva)
   */
  static async createMany(itemsData) {
    try {
      const { data, error } = await supabase
        .from(TABLES.ITEMS)
        .insert(itemsData)
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Upsert múltiples items (insertar o actualizar si existe)
   */
  static async upsertMany(itemsData) {
    try {
      const { data, error } = await supabase
        .from(TABLES.ITEMS)
        .upsert(itemsData, { 
          onConflict: 'codigo, compania_id',  // Clave compuesta para unicidad por compañía
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
   * Actualizar un item
   */
  static async update(id, updateData) {
    try {
      const { data, error } = await supabase
        .from(TABLES.ITEMS)
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
   * Eliminar un item
   */
  static async delete(id) {
    try {
      const { error } = await supabase
        .from(TABLES.ITEMS)
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Eliminar todos los items de una compañía
   */
  static async deleteByCompany(companiaId) {
    try {
      const { error } = await supabase
        .from(TABLES.ITEMS)
        .delete()
        .eq('compania_id', companiaId);

      if (error) throw error;
      return true;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }

  /**
   * Contar items de una compañía
   */
  static async countByCompany(companiaId) {
    try {
      const { count, error } = await supabase
        .from(TABLES.ITEMS)
        .select('*', { count: 'exact', head: true })
        .eq('compania_id', companiaId);

      if (error) throw error;
      return count;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }
}

export default ItemModel;
