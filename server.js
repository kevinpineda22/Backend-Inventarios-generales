// =====================================================
// SERVIDOR PRINCIPAL - BACKEND INVENTARIO GENERAL
// =====================================================

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

// Importar configuración
import { config } from "./src/config/config.js";

// Importar middleware
import { errorHandler } from "./src/middleware/errorHandler.js";
import { notFoundHandler } from "./src/middleware/notFoundHandler.js";
import { requestLogger } from "./src/middleware/requestLogger.js";
import { rateLimiter } from "./src/middleware/rateLimiter.js";

// Importar rutas
import itemsRoutes from "./src/routes/items.routes.js";
import bodegasRoutes from "./src/routes/bodegas.routes.js";
import zonasRoutes from "./src/routes/zonas.routes.js";
import pasillosRoutes from "./src/routes/pasillos.routes.js";
import ubicacionesRoutes from "./src/routes/ubicaciones.routes.js";
import conteosRoutes from "./src/routes/conteos.routes.js";
import estructuraRoutes from "./src/routes/estructura.routes.js";
import reportesRoutes from "./src/routes/reportes.routes.js";
import maestraRoutes from "./src/routes/maestra.routes.js";

// Configurar __dirname para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar variables de entorno
dotenv.config();

// Crear aplicación Express
const app = express();

// =====================================================
// CONFIGURACIÓN DE MIDDLEWARE GLOBAL
// =====================================================

// Seguridad
app.use(helmet());

// CORS
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Compresión de respuestas
app.use(compression());

// Parser de JSON y URL encoded
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logger de peticiones HTTP
if (config.env === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Logger de peticiones personalizado
app.use(requestLogger);

// Rate limiting (excluir rutas de maestra)
app.use((req, res, next) => {
  if (req.path.startsWith("/api/maestra")) {
    return next(); // Saltar rate limiter para rutas de maestra
  }
  rateLimiter(req, res, next);
});

// Directorio para archivos subidos
import os from "os";
const isProduction = process.env.NODE_ENV === "production";
const uploadDir = isProduction ? os.tmpdir() : join(__dirname, "uploads");

if (!isProduction && !fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// =====================================================
// RUTAS DE LA API
// =====================================================

// Ruta de health check
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend Inventario General funcionando correctamente",
    timestamp: new Date().toISOString(),
    environment: config.env,
    version: "1.0.0",
  });
});

// Ruta principal
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API Backend Inventario General",
    version: "1.0.0",
    documentation: "/api/docs",
    endpoints: {
      items: "/api/items",
      bodegas: "/api/bodegas",
      zonas: "/api/zonas",
      pasillos: "/api/pasillos",
      ubicaciones: "/api/ubicaciones",
      conteos: "/api/conteos",
      estructura: "/api/estructura",
      reportes: "/api/reportes",
    },
  });
});

// Montar rutas de la API
app.use("/api/items", itemsRoutes);
app.use("/api/bodegas", bodegasRoutes);
app.use("/api/zonas", zonasRoutes);
app.use("/api/pasillos", pasillosRoutes);
app.use("/api/ubicaciones", ubicacionesRoutes);
app.use("/api/conteos", conteosRoutes);
app.use("/api/estructura", estructuraRoutes);
app.use("/api/reportes", reportesRoutes);
app.use("/api/maestra", maestraRoutes);

// =====================================================
// MANEJO DE ERRORES
// =====================================================

// Manejar rutas no encontradas
app.use(notFoundHandler);

// Manejador de errores global
app.use(errorHandler);

// =====================================================
// INICIAR SERVIDOR
// =====================================================

const PORT = config.port || 3001;

// Solo iniciar el servidor si no estamos en producción (Vercel maneja el servidor en producción)
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log("=====================================================");
    console.log("🚀 BACKEND INVENTARIO GENERAL");
    console.log("=====================================================");
    console.log(`✅ Servidor corriendo en puerto: ${PORT}`);
    console.log(`✅ Entorno: ${config.env}`);
    console.log(`✅ URL: http://localhost:${PORT}`);
    console.log(`✅ Health Check: http://localhost:${PORT}/health`);
    console.log("=====================================================");
    console.log("📡 Endpoints disponibles:");
    console.log(`   - Items:       http://localhost:${PORT}/api/items`);
    console.log(`   - Bodegas:     http://localhost:${PORT}/api/bodegas`);
    console.log(`   - Zonas:       http://localhost:${PORT}/api/zonas`);
    console.log(`   - Pasillos:    http://localhost:${PORT}/api/pasillos`);
    console.log(`   - Ubicaciones: http://localhost:${PORT}/api/ubicaciones`);
    console.log(`   - Conteos:     http://localhost:${PORT}/api/conteos`);
    console.log(`   - Estructura:  http://localhost:${PORT}/api/estructura`);
    console.log(`   - Reportes:    http://localhost:${PORT}/api/reportes`);
    console.log("=====================================================");
  });
}

// Manejo de errores no capturados
process.on("unhandledRejection", (err) => {
  console.error("❌ Error no manejado:", err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Excepción no capturada:", err);
  process.exit(1);
});

export default app;
