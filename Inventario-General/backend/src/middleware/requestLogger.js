// =====================================================
// MIDDLEWARE: LOGGER DE PETICIONES
// =====================================================

export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Guardar el método original de res.json
  const originalJson = res.json.bind(res);
  
  // Sobrescribir res.json para capturar la respuesta
  res.json = function(data) {
    const duration = Date.now() - start;
    
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
    
    return originalJson(data);
  };
  
  next();
};

export default requestLogger;
