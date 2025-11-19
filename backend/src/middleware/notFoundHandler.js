// =====================================================
// MIDDLEWARE: MANEJO DE RUTAS NO ENCONTRADAS
// =====================================================

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString()
  });
};

export default notFoundHandler;
