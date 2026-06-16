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
   * Buscar todos los items que compartan un código de barras
   */
  static async findAllByBarcode(codigoBarra, companiaId) {
    try {
      // Búsqueda robusta por 'codigo' o 'codigo_barra'
      const { data, error } = await supabase
        .from(TABLES.ITEMS)
        .select('id')
        .or(`codigo.eq.${codigoBarra},codigo_barra.eq.${codigoBarra}`) // OR syntax
        .eq('compania_id', companiaId);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.warn("Error en findAllByBarcode, intentando fallback simple:", error.message);
      // Fallback si falla el OR por columnas inexistentes
      try {
         const { data } = await supabase
         .from(TABLES.ITEMS)
         .select('id')
         .eq('codigo', codigoBarra)
         .eq('compania_id', companiaId);
         return data || [];
      } catch (e) {
         return [];
      }
    }
  }

  /**
   * Buscar item por código de item exacto (columna 'item')
   */
  static async findByItemCode(itemCode, companiaId) {
    try {
      const { data, error } = await supabase
        .from(TABLES.ITEMS)
        .select('*')
        .eq('item', itemCode)
        .eq('compania_id', companiaId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
       // Si no existe la columna, retornamos null
       if (error.message && error.message.includes('does not exist')) return null;
       throw handleSupabaseError(error);
    }
  }

  /**
   * Buscar items por término (descripción o código)
   */
  static async search(term, companiaId) {
    try {
      // Normalizar: sin esto, una cadena vacía o con espacios busca cualquier cosa
      const clean = (term || '').trim();
      if (!clean) return [];

      // Escapar los caracteres que rompen el filtro .or() de PostgREST (, ( ))
      const safe = clean.replace(/[,()]/g, ' ').trim();
      if (!safe) return [];

      // Helper para construir la consulta base con el filtro de compañía
      const base = () => {
        let q = supabase.from(TABLES.ITEMS).select('id, item, codigo, descripcion, grupo');
        if (companiaId) q = q.eq('compania_id', companiaId);
        return q;
      };

      // Búsqueda por NIVELES para que las coincidencias relevantes NUNCA se pierdan
      // por el .limit() del nivel "contiene" (que con términos cortos coincide con
      // cientos de filas y, sin orden estable, dejaba fuera el item exacto):
      //   1) Exacto en item o codigo  → siempre incluido (resultado mínimo)
      //   2) Empieza con el término   → alta relevancia
      //   3) Contiene el término      → red amplia (item, codigo o descripcion)
      const [exactRes, prefixRes, containsRes] = await Promise.all([
        base().or(`item.eq.${safe},codigo.eq.${safe}`),
        base().or(`item.ilike.${safe}%,codigo.ilike.${safe}%`).limit(50),
        base().or(`item.ilike.%${safe}%,codigo.ilike.%${safe}%,descripcion.ilike.%${safe}%`).limit(80),
      ]);

      for (const r of [exactRes, prefixRes, containsRes]) {
        if (r.error) throw r.error;
      }

      // Unir y deduplicar por id (el orden de inserción ya respeta la relevancia)
      const byId = new Map();
      for (const row of [...(exactRes.data || []), ...(prefixRes.data || []), ...(containsRes.data || [])]) {
        if (!byId.has(row.id)) byId.set(row.id, row);
      }
      const data = Array.from(byId.values());

      // Ordenar por relevancia en JavaScript
      // Prioridad: 1) Coincidencia exacta (item o código), 2) empieza con el término
      // (item/código), 3) descripción empieza con el término, 4) código más corto
      const termLower = safe.toLowerCase();
      const sortedData = data.sort((a, b) => {
        const aCode = (a.codigo || a.item || '').toLowerCase();
        const bCode = (b.codigo || b.item || '').toLowerCase();
        const aItem = (a.item || '').toLowerCase();
        const bItem = (b.item || '').toLowerCase();
        const aDesc = (a.descripcion || '').toLowerCase();
        const bDesc = (b.descripcion || '').toLowerCase();

        // Coincidencia exacta de código o SKU → máxima prioridad
        const aExact = aCode === termLower || aItem === termLower;
        const bExact = bCode === termLower || bItem === termLower;
        if (aExact && !bExact) return -1;
        if (bExact && !aExact) return 1;

        // Código/SKU empieza con el término
        const aStarts = aCode.startsWith(termLower) || aItem.startsWith(termLower);
        const bStarts = bCode.startsWith(termLower) || bItem.startsWith(termLower);
        if (aStarts && !bStarts) return -1;
        if (bStarts && !aStarts) return 1;

        // Descripción empieza con el término
        const aStartsDesc = aDesc.startsWith(termLower);
        const bStartsDesc = bDesc.startsWith(termLower);
        if (aStartsDesc && !bStartsDesc) return -1;
        if (bStartsDesc && !aStartsDesc) return 1;

        // Código más corto primero (suele ser el más relevante)
        return aCode.length - bCode.length;
      });

      return sortedData.slice(0, 10); // top 10 más relevantes
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

  /**
   * Obtener grupos únicos de items de una compañía
   */
  static async findGruposByCompany(companiaId) {
    try {
      // NOTA: Se aumenta el límite para garantizar traer todas las categorías
      // ya que por defecto Supabase limita a 1000 filas.
      const { data, error } = await supabase
        .from(TABLES.ITEMS)
        .select('grupo')
        .eq('compania_id', companiaId)
        .not('grupo', 'is', null)
        .limit(100000); // Límite alto para cubrir todo el maestro de items

      if (error) throw error;
      
      // Obtener valores únicos en memoria (Javscript Set)
      const uniqueGrupos = [...new Set(data.map(item => item.grupo).filter(g => g && g.trim() !== ''))];
      
      // Ordenar alfabéticamente para presentación
      uniqueGrupos.sort((a, b) => a.localeCompare(b));
      
      return uniqueGrupos;
    } catch (error) {
      throw handleSupabaseError(error);
    }
  }
}

export default ItemModel;
