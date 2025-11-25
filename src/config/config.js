// =====================================================
// CONFIGURACIÓN GENERAL DE LA APLICACIÓN
// =====================================================

import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Configuración del servidor
  port: process.env.PORT || 3001,
  env: process.env.NODE_ENV || 'development',
  
  // Configuración de Supabase
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_KEY
  },
  
  // Configuración de CORS
  cors: {
    origin: process.env.CORS_ORIGIN === '*' ? '*' : (process.env.CORS_ORIGIN?.split(',') || [
      'https://merkahorro.com',
      'https://www.merkahorro.com',
      'http://localhost:3000', 
      'http://localhost:5173', 
      'http://localhost:5174', 
      'http://localhost:5175', 
      'http://localhost:5176',
      // Permitir acceso desde red local para pruebas móviles (ajusta según tu IP si es necesario)
      '*' 
    ])
  },
  
  // Configuración de seguridad
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    jwtExpiration: process.env.JWT_EXPIRATION || '24h'
  },
  
  // Configuración de rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '5') * 60 * 1000, // 5 minutos por defecto
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '3000') // 3000 peticiones por ventana
  },
  
  // Configuración de archivos
  files: {
    maxSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB por defecto
    // En producción (Vercel) usar /tmp, en desarrollo usar ./uploads
    uploadDir: process.env.NODE_ENV === 'production' ? '/tmp' : (process.env.UPLOAD_DIR || './uploads')
  },
  
  // Configuración de logs
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  },
  
  // Configuración de base de datos
  database: {
    tablePrefix: process.env.TABLE_PREFIX || 'inv_general_'
  }
};

// Validar configuración requerida
export const validateConfig = () => {
  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Faltan las siguientes variables de entorno: ${missing.join(', ')}`);
  }
  
  console.log('✅ Configuración validada correctamente');
};

export default config;
