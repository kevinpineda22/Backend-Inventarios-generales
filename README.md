# 🚀 Backend - Sistema de Inventario General

Backend escalable para Sistema de Inventario General Multicompañía construido con **Node.js**, **Express** y **Supabase**.

## 📋 Tabla de Contenido

- [Características](#características)
- [Tecnologías](#tecnologías)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Ejecutar el Proyecto](#ejecutar-el-proyecto)
- [API Endpoints](#api-endpoints)
- [Base de Datos](#base-de-datos)
- [Despliegue](#despliegue)

## ✨ Características

### Funcionalidades Principales

- ✅ **Gestión de Items**: CRUD completo + carga masiva desde Excel
- ✅ **Estructura Jerárquica**: Bodegas → Zonas → Pasillos → Ubicaciones
- ✅ **Sistema de Conteos**: Conteo #1, #2 y Diferencias
- ✅ **Multicompañía**: Soporte para múltiples empresas
- ✅ **Reportes Excel**: Generación automática de reportes
- ✅ **API RESTful**: Endpoints bien organizados y documentados

### Características Técnicas

- 🔒 **Seguridad**: Helmet, CORS, Rate Limiting
- 📝 **Validaciones**: Express Validator
- 🗃️ **Base de Datos**: Supabase (PostgreSQL)
- 📊 **Logs**: Morgan + Logger personalizado
- ⚡ **Performance**: Compresión de respuestas
- 🔄 **Escalabilidad**: Arquitectura modular MVC

## 🛠️ Tecnologías

| Tecnología | Versión | Descripción |
|-----------|---------|-------------|
| Node.js | 18+ | Runtime JavaScript |
| Express | 4.18+ | Framework web |
| Supabase | 2.39+ | Base de datos PostgreSQL |
| XLSX | 0.18+ | Manejo de archivos Excel |
| Multer | 1.4+ | Carga de archivos |
| Helmet | 7.1+ | Seguridad HTTP |
| Morgan | 1.10+ | Logger HTTP |

## 📁 Estructura del Proyecto

```
backend/
├── server.js                 # Punto de entrada
├── package.json             # Dependencias
├── .env.example            # Variables de entorno (ejemplo)
├── .gitignore              # Archivos ignorados
│
├── src/
│   ├── config/             # Configuraciones
│   │   ├── config.js       # Config general
│   │   └── supabase.js     # Cliente Supabase
│   │
│   ├── models/             # Modelos de datos
│   │   ├── Item.model.js
│   │   ├── Bodega.model.js
│   │   ├── Zona.model.js
│   │   ├── Pasillo.model.js
│   │   ├── Ubicacion.model.js
│   │   ├── Conteo.model.js
│   │   └── ConteoItem.model.js
│   │
│   ├── services/           # Lógica de negocio
│   │   ├── item.service.js
│   │   ├── estructura.service.js
│   │   └── conteo.service.js
│   │
│   ├── controllers/        # Controladores HTTP
│   │   ├── item.controller.js
│   │   ├── estructura.controller.js
│   │   └── conteo.controller.js
│   │
│   ├── routes/             # Rutas API
│   │   ├── items.routes.js
│   │   ├── bodegas.routes.js
│   │   ├── zonas.routes.js
│   │   ├── pasillos.routes.js
│   │   ├── ubicaciones.routes.js
│   │   ├── conteos.routes.js
│   │   ├── estructura.routes.js
│   │   └── reportes.routes.js
│   │
│   ├── middleware/         # Middleware
│   │   ├── errorHandler.js
│   │   ├── notFoundHandler.js
│   │   ├── requestLogger.js
│   │   ├── rateLimiter.js
│   │   ├── validateRequest.js
│   │   └── uploadHandler.js
│   │
│   └── utils/              # Utilidades
│       ├── responses.js
│       ├── validators.js
│       └── excelHandler.js
│
└── uploads/                # Archivos temporales
```

## 🔧 Instalación

### Prerrequisitos

- Node.js 18 o superior
- npm o yarn
- Cuenta de Supabase

### Pasos

1. **Clonar el repositorio**
```bash
git clone <url-del-repositorio>
cd backend
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp .env.example .env
```

Edita el archivo `.env` con tus credenciales.

## ⚙️ Configuración

### Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
# Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-clave-anon-key
SUPABASE_SERVICE_KEY=tu-service-role-key

# Servidor
PORT=3001
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=15
RATE_LIMIT_MAX_REQUESTS=100

# Archivos
MAX_FILE_SIZE=10485760
```

### Configurar Base de Datos

1. Accede a tu proyecto de Supabase
2. Ve a **SQL Editor**
3. Ejecuta el script `setup_database.sql` del frontend

## 🚀 Ejecutar el Proyecto

### Desarrollo

```bash
npm run dev
```

El servidor se iniciará en `http://localhost:3001`

### Producción

```bash
npm start
```

## 📡 API Endpoints

### Health Check

```
GET /health
```

Verifica que el servidor esté funcionando.

### Items

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/items/:companiaId` | Obtener todos los items |
| GET | `/api/items/barcode/:codigo/:companiaId` | Buscar por código de barras |
| GET | `/api/items/detail/:id` | Obtener item por ID |
| POST | `/api/items` | Crear item |
| POST | `/api/items/upload` | Cargar items desde Excel |
| PUT | `/api/items/:id` | Actualizar item |
| DELETE | `/api/items/:id` | Eliminar item |

### Estructura

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/estructura/:companiaId` | Estructura completa |
| GET | `/api/estructura/navegacion` | Navegación jerárquica |
| POST | `/api/estructura/bodega` | Crear bodega |
| POST | `/api/estructura/zona` | Crear zona |
| POST | `/api/estructura/pasillo` | Crear pasillo |
| POST | `/api/estructura/ubicacion` | Crear ubicación |
| POST | `/api/estructura/ubicaciones-multiple` | Crear múltiples ubicaciones |

### Conteos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/conteos/pendientes` | Conteos pendientes |
| GET | `/api/conteos/:id` | Obtener conteo |
| GET | `/api/conteos/ubicacion/:ubicacionId` | Historial por ubicación |
| GET | `/api/conteos/pasillo/:pasilloId` | Historial por pasillo |
| GET | `/api/conteos/diferencias/:ubicacionId` | Calcular diferencias |
| POST | `/api/conteos/iniciar` | Iniciar conteo |
| POST | `/api/conteos/:conteoId/item` | Agregar item |
| POST | `/api/conteos/:conteoId/finalizar` | Finalizar conteo |
| POST | `/api/conteos/:conteoId/aprobar` | Aprobar conteo |
| POST | `/api/conteos/:conteoId/rechazar` | Rechazar conteo |

### Reportes

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/reportes/conteos` | Generar reporte de conteos |
| POST | `/api/reportes/diferencias` | Generar reporte de diferencias |

## 🗄️ Base de Datos

### Tablas Principales

- `inv_general_items` - Productos/Artículos
- `inv_general_bodegas` - Bodegas
- `inv_general_zonas` - Zonas
- `inv_general_pasillos` - Pasillos
- `inv_general_ubicaciones` - Ubicaciones
- `inv_general_conteos` - Conteos
- `inv_general_conteo_items` - Items contados

### Relaciones

```
Bodegas (1) → (N) Zonas
Zonas (1) → (N) Pasillos
Pasillos (1) → (N) Ubicaciones
Ubicaciones (1) → (N) Conteos
Conteos (1) → (N) ConteoItems
ConteoItems (N) → (1) Items
```

## 🌐 Despliegue

### Opciones de Despliegue

1. **Railway** (Recomendado)
2. **Render**
3. **Heroku**
4. **DigitalOcean**
5. **AWS EC2**

### Pasos Generales

1. Configurar variables de entorno en el servicio
2. Conectar repositorio
3. El servicio detectará `package.json` automáticamente
4. Configurar comando de inicio: `npm start`
5. Exponer puerto: `3001`

## 📝 Ejemplos de Uso

### Cargar Items desde Excel

```javascript
const formData = new FormData();
formData.append('file', excelFile);
formData.append('companiaId', '1');

const response = await fetch('http://localhost:3001/api/items/upload', {
  method: 'POST',
  body: formData
});
```

### Iniciar Conteo

```javascript
const response = await fetch('http://localhost:3001/api/conteos/iniciar', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ubicacionId: 'uuid-ubicacion',
    usuarioId: 'uuid-usuario',
    tipoConteo: 1,
    clave: '1234'
  })
});
```

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

MIT License

## 👨‍💻 Soporte

Para soporte, abre un issue en el repositorio o contacta al equipo de desarrollo.

---

**Desarrollado con ❤️ para Gestión de Inventarios**
