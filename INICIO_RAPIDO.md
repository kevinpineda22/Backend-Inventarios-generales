# ⚡ Guía Rápida de Inicio - Backend

## 🚀 Inicio en 5 Pasos (5 minutos)

### 1️⃣ Instalar Dependencias
```bash
cd backend
npm install
```

### 2️⃣ Configurar Variables de Entorno
```bash
cp .env.example .env
```

Edita `.env` con tus credenciales de Supabase:
```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-anon-key-aqui
SUPABASE_SERVICE_KEY=tu-service-role-key-aqui
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
```

### 3️⃣ Configurar Base de Datos
1. Ve a tu proyecto de Supabase
2. Abre **SQL Editor**
3. Ejecuta el script `setup_database.sql` (está en la carpeta Inventario-General)

### 4️⃣ Iniciar Servidor
```bash
npm run dev
```

### 5️⃣ Verificar
Abre tu navegador en: `http://localhost:3001/health`

Deberías ver:
```json
{
  "success": true,
  "message": "Backend Inventario General funcionando correctamente",
  "timestamp": "2024-11-19T...",
  "environment": "development",
  "version": "1.0.0"
}
```

---

## 📡 Endpoints Principales

### Health Check
```
GET http://localhost:3001/health
```

### Items
```
GET http://localhost:3001/api/items/1
POST http://localhost:3001/api/items
POST http://localhost:3001/api/items/upload
```

### Estructura
```
GET http://localhost:3001/api/estructura/1
POST http://localhost:3001/api/estructura/bodega
POST http://localhost:3001/api/estructura/zona
```

### Conteos
```
POST http://localhost:3001/api/conteos/iniciar
GET http://localhost:3001/api/conteos/pendientes
POST http://localhost:3001/api/conteos/:id/finalizar
```

---

## 🔗 Conectar con Frontend

En tu frontend, actualiza la URL del API:

```javascript
// En supabaseClient.js o donde tengas la configuración
const API_URL = 'http://localhost:3001/api';

// Luego los endpoints se llaman así:
fetch(`${API_URL}/items/1`)
fetch(`${API_URL}/conteos/iniciar`)
```

---

## 🧪 Probar Endpoints

### Usando cURL

```bash
# Health check
curl http://localhost:3001/health

# Obtener items
curl http://localhost:3001/api/items/1

# Crear bodega
curl -X POST http://localhost:3001/api/estructura/bodega \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Bodega Principal","compania_id":"1"}'
```

### Usando Thunder Client (VS Code)
1. Instala extensión Thunder Client
2. Crea una nueva request
3. URL: `http://localhost:3001/health`
4. Click en **Send**

---

## 📚 Documentación

- **API Completa**: Ver `API_DOCUMENTATION.md`
- **Despliegue**: Ver `DEPLOYMENT.md`
- **General**: Ver `README.md`
- **Resumen**: Ver `RESUMEN_BACKEND.md`

---

## 🐛 Problemas Comunes

### Puerto ya en uso
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID [número] /F

# Linux/Mac
lsof -ti:3001 | xargs kill -9
```

### Error de Supabase
- Verifica que las URLs y keys sean correctas
- Verifica que hayas ejecutado el script SQL

### CORS Error
- Asegúrate que `CORS_ORIGIN` incluya la URL de tu frontend

---

## 🎯 Siguiente Paso

Ya puedes usar el backend! 

Prueba cargar items desde Excel o crear la estructura de tu inventario.

**¿Listo para producción?** Ver `DEPLOYMENT.md`
