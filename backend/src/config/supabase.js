// =====================================================
// CLIENTE DE SUPABASE - CONFIGURACIÓN
// =====================================================

import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

// Verificar que las credenciales existen
if (!config.supabase.url || !config.supabase.anonKey) {
  throw new Error('⚠️ SUPABASE_URL y SUPABASE_ANON_KEY son requeridos en las variables de entorno');
}

// Cliente de Supabase con anon key (para operaciones normales)
export const supabase = createClient(
  config.supabase.url,
  config.supabase.anonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

// Cliente de Supabase con service role key (para operaciones administrativas)
// Este cliente bypasea Row Level Security
export const supabaseAdmin = config.supabase.serviceKey 
  ? createClient(
      config.supabase.url,
      config.supabase.serviceKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    )
  : null;

// Función para verificar la conexión
export const checkConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('inv_general_items')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Error al conectar con Supabase:', error.message);
      return false;
    }
    
    console.log('✅ Conexión con Supabase establecida correctamente');
    return true;
  } catch (error) {
    console.error('❌ Error al verificar conexión con Supabase:', error);
    return false;
  }
};

// Función helper para manejar errores de Supabase
export const handleSupabaseError = (error) => {
  if (!error) return null;
  
  return {
    message: error.message || 'Error en la operación con la base de datos',
    code: error.code || 'SUPABASE_ERROR',
    details: error.details || null,
    hint: error.hint || null
  };
};

// Función helper para construir nombres de tablas con prefijo
export const getTableName = (tableName) => {
  return `${config.database.tablePrefix}${tableName}`;
};

// Nombres de tablas
export const TABLES = {
  ITEMS: getTableName('items'),
  BODEGAS: getTableName('bodegas'),
  ZONAS: getTableName('zonas'),
  PASILLOS: getTableName('pasillos'),
  UBICACIONES: getTableName('ubicaciones'),
  CONTEOS: getTableName('conteos'),
  CONTEO_ITEMS: getTableName('conteo_items')
};

console.log('📦 Cliente de Supabase inicializado');

export default supabase;
