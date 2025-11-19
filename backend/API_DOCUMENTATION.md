# 📚 Documentación de la API - Backend Inventario General

## Información General

**Base URL**: `http://localhost:3001/api`

**Formato de Respuesta**: JSON

**Autenticación**: No implementada (agregar según necesidades)

---

## 📦 Respuestas Estándar

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Operación exitosa",
  "data": { ... },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Respuesta de Error

```json
{
  "success": false,
  "message": "Error en la operación",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## 🔍 ITEMS

### 1. Obtener Items por Compañía

**Endpoint**: `GET /api/items/:companiaId`

**Descripción**: Obtiene todos los items de una compañía con filtros opcionales.

**Parámetros URL**:
- `companiaId` (string, requerido): ID de la compañía

**Query Parameters**:
- `item` (string, opcional): Filtrar por nombre de item
- `descripcion` (string, opcional): Filtrar por descripción
- `codigo_barra` (string, opcional): Filtrar por código de barras

**Ejemplo Request**:
```http
GET /api/items/1?item=producto
```

**Ejemplo Response**:
```json
{
  "success": true,
  "message": "15 items encontrados",
  "data": [
    {
      "id": "uuid",
      "item": "PRODUCTO-001",
      "descripcion": "Descripción del producto",
      "codigo_barra": "7891234567890",
      "compania_id": "1",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

### 2. Buscar Item por Código de Barras

**Endpoint**: `GET /api/items/barcode/:codigoBarra/:companiaId`

**Descripción**: Busca un item específico por su código de barras.

**Parámetros URL**:
- `codigoBarra` (string, requerido): Código de barras
- `companiaId` (string, requerido): ID de la compañía

**Ejemplo Request**:
```http
GET /api/items/barcode/7891234567890/1
```

**Ejemplo Response**:
```json
{
  "success": true,
  "message": "Item encontrado",
  "data": {
    "id": "uuid",
    "item": "PRODUCTO-001",
    "descripcion": "Descripción del producto",
    "codigo_barra": "7891234567890",
    "compania_id": "1"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

### 3. Crear Item

**Endpoint**: `POST /api/items`

**Descripción**: Crea un nuevo item.

**Body**:
```json
{
  "item": "PRODUCTO-001",
  "descripcion": "Descripción del producto",
  "codigo_barra": "7891234567890",
  "compania_id": "1"
}
```

**Ejemplo Response**:
```json
{
  "success": true,
  "message": "Item creado exitosamente",
  "data": {
    "id": "uuid",
    "item": "PRODUCTO-001",
    "descripcion": "Descripción del producto",
    "codigo_barra": "7891234567890",
    "compania_id": "1",
    "created_at": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

### 4. Cargar Items desde Excel

**Endpoint**: `POST /api/items/upload`

**Descripción**: Carga masiva de items desde archivo Excel.

**Content-Type**: `multipart/form-data`

**Form Data**:
- `file` (file, requerido): Archivo Excel (.xls, .xlsx, .xlsm)
- `companiaId` (string, requerido): ID de la compañía

**Estructura del Excel**:

| item | descripcion | codigo_barra |
|------|-------------|--------------|
| PROD-001 | Producto 1 | 7891234567890 |
| PROD-002 | Producto 2 | 7891234567891 |

**Ejemplo Request** (JavaScript):
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('companiaId', '1');

const response = await fetch('/api/items/upload', {
  method: 'POST',
  body: formData
});
```

**Ejemplo Response**:
```json
{
  "success": true,
  "message": "150 items cargados exitosamente",
  "data": [ ... ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Códigos de Error**:
- `400`: Archivo inválido, estructura incorrecta, items con errores
- `500`: Error en el servidor

---

## 🏢 ESTRUCTURA

### 1. Obtener Estructura Completa

**Endpoint**: `GET /api/estructura/:companiaId`

**Descripción**: Obtiene toda la jerarquía de bodegas, zonas, pasillos y ubicaciones.

**Ejemplo Response**:
```json
{
  "success": true,
  "message": "Estructura obtenida exitosamente",
  "data": [
    {
      "id": "uuid",
      "nombre": "Bodega Principal",
      "compania_id": "1",
      "zonas": [
        {
          "id": "uuid",
          "nombre": "Zona A",
          "pasillos": [
            {
              "id": "uuid",
              "numero": "1",
              "ubicaciones": [
                {
                  "id": "uuid",
                  "numero": "1",
                  "clave": "1234"
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

### 2. Obtener Navegación Jerárquica

**Endpoint**: `GET /api/estructura/navegacion`

**Descripción**: Obtiene el nivel actual de navegación según los parámetros.

**Query Parameters**:
- `companiaId` (string, requerido): ID de la compañía
- `bodegaId` (string, opcional): ID de bodega
- `zonaId` (string, opcional): ID de zona
- `pasilloId` (string, opcional): ID de pasillo

**Ejemplos**:

**Sin bodega (devuelve bodegas)**:
```http
GET /api/estructura/navegacion?companiaId=1
```

**Con bodega (devuelve zonas)**:
```http
GET /api/estructura/navegacion?companiaId=1&bodegaId=uuid
```

**Con zona (devuelve pasillos)**:
```http
GET /api/estructura/navegacion?companiaId=1&bodegaId=uuid&zonaId=uuid
```

**Con pasillo (devuelve ubicaciones)**:
```http
GET /api/estructura/navegacion?companiaId=1&bodegaId=uuid&zonaId=uuid&pasilloId=uuid
```

---

### 3. Crear Bodega

**Endpoint**: `POST /api/estructura/bodega`

**Body**:
```json
{
  "nombre": "Bodega Principal",
  "compania_id": "1"
}
```

---

### 4. Crear Zona

**Endpoint**: `POST /api/estructura/zona`

**Body**:
```json
{
  "nombre": "Zona A",
  "bodega_id": "uuid"
}
```

---

### 5. Crear Pasillo

**Endpoint**: `POST /api/estructura/pasillo`

**Body**:
```json
{
  "numero": "1",
  "zona_id": "uuid"
}
```

---

### 6. Crear Ubicación

**Endpoint**: `POST /api/estructura/ubicacion`

**Body**:
```json
{
  "numero": "1",
  "clave": "1234",
  "pasillo_id": "uuid"
}
```

**Nota**: Si no se proporciona `clave`, se genera automáticamente.

---

### 7. Crear Múltiples Ubicaciones

**Endpoint**: `POST /api/estructura/ubicaciones-multiple`

**Descripción**: Crea múltiples ubicaciones para un pasillo.

**Body**:
```json
{
  "pasillo_id": "uuid",
  "cantidad": 10
}
```

**Response**: Crea 10 ubicaciones numeradas del 1 al 10, cada una con su clave única.

---

## 📊 CONTEOS

### 1. Iniciar Conteo

**Endpoint**: `POST /api/conteos/iniciar`

**Descripción**: Inicia un nuevo conteo en una ubicación.

**Body**:
```json
{
  "ubicacionId": "uuid",
  "usuarioId": "uuid",
  "tipoConteo": 1,
  "clave": "1234"
}
```

**Parámetros**:
- `ubicacionId`: ID de la ubicación
- `usuarioId`: ID del usuario que realiza el conteo
- `tipoConteo`: 1, 2 o 3 (Conteo #1, #2 o Diferencias)
- `clave`: Clave de seguridad de la ubicación

**Ejemplo Response**:
```json
{
  "success": true,
  "message": "Conteo iniciado exitosamente",
  "data": {
    "id": "uuid",
    "ubicacion_id": "uuid",
    "usuario_id": "uuid",
    "tipo_conteo": 1,
    "estado": "en_progreso",
    "fecha_inicio": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Validaciones**:
- La clave debe ser correcta
- No puede haber otro conteo del mismo tipo en progreso
- El tipo de conteo debe ser 1, 2 o 3

---

### 2. Agregar Item a Conteo

**Endpoint**: `POST /api/conteos/:conteoId/item`

**Descripción**: Agrega un item al conteo actual (puede escanear código de barras).

**Body**:
```json
{
  "codigoBarra": "7891234567890",
  "cantidad": 5,
  "companiaId": "1"
}
```

**Ejemplo Response**:
```json
{
  "success": true,
  "message": "Item agregado al conteo exitosamente",
  "data": {
    "id": "uuid",
    "conteo_id": "uuid",
    "item_id": "uuid",
    "cantidad": 5
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Comportamiento**:
- Si el item ya existe en el conteo, suma la cantidad
- Si no existe, lo crea con la cantidad especificada

---

### 3. Obtener Items de un Conteo

**Endpoint**: `GET /api/conteos/:conteoId/items`

**Descripción**: Obtiene todos los items contados en un conteo.

**Ejemplo Response**:
```json
{
  "success": true,
  "message": "25 items encontrados",
  "data": [
    {
      "id": "uuid",
      "conteo_id": "uuid",
      "item_id": "uuid",
      "cantidad": 5,
      "item": {
        "item": "PRODUCTO-001",
        "descripcion": "Descripción",
        "codigo_barra": "7891234567890"
      }
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

### 4. Finalizar Conteo

**Endpoint**: `POST /api/conteos/:conteoId/finalizar`

**Descripción**: Marca el conteo como finalizado.

**Ejemplo Response**:
```json
{
  "success": true,
  "message": "Conteo finalizado exitosamente",
  "data": {
    "id": "uuid",
    "estado": "finalizado",
    "fecha_fin": "2024-01-01T12:00:00.000Z"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

---

### 5. Aprobar Conteo

**Endpoint**: `POST /api/conteos/:conteoId/aprobar`

**Descripción**: Aprueba un conteo finalizado (solo para admin).

---

### 6. Rechazar Conteo

**Endpoint**: `POST /api/conteos/:conteoId/rechazar`

**Body**:
```json
{
  "motivo": "Inconsistencias encontradas"
}
```

---

### 7. Obtener Conteos Pendientes

**Endpoint**: `GET /api/conteos/pendientes`

**Descripción**: Obtiene todos los conteos pendientes de aprobación.

---

### 8. Calcular Diferencias

**Endpoint**: `GET /api/conteos/diferencias/:ubicacionId`

**Descripción**: Calcula las diferencias entre Conteo #1 y Conteo #2.

**Ejemplo Response**:
```json
{
  "success": true,
  "message": "Diferencias calculadas",
  "data": {
    "conteo1": { ... },
    "conteo2": { ... },
    "diferencias": [
      {
        "item_id": "uuid",
        "item": "PRODUCTO-001",
        "cantidad_conteo1": 10,
        "cantidad_conteo2": 8,
        "diferencia": -2
      }
    ],
    "total_diferencias": 5
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## 📈 REPORTES

### 1. Generar Reporte de Conteos

**Endpoint**: `POST /api/reportes/conteos`

**Descripción**: Genera un archivo Excel con los conteos seleccionados.

**Body**:
```json
{
  "tipo": "general",
  "conteoIds": ["uuid1", "uuid2", "uuid3"]
}
```

**Tipos de Reporte**:
- `general`: Resumen de conteos
- `detallado`: Conteos con todos sus items
- `diferencias`: Solo items con diferencias

**Response**: Archivo Excel descargable

**Headers de Respuesta**:
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename=Reporte_Conteos_1234567890.xlsx
```

---

### 2. Generar Reporte de Diferencias

**Endpoint**: `POST /api/reportes/diferencias`

**Body**:
```json
{
  "diferencias": [
    {
      "item": "PROD-001",
      "descripcion": "Producto 1",
      "codigo_barra": "123456",
      "cantidad_conteo1": 10,
      "cantidad_conteo2": 8,
      "diferencia": -2
    }
  ]
}
```

**Response**: Archivo Excel descargable

---

## 🔒 Rate Limiting

### Límites Generales

- **Ventana**: 15 minutos
- **Máximo de peticiones**: 100 por IP

### Límites Estrictos (Endpoints Críticos)

Aplica a:
- `POST /api/items/upload`

- **Ventana**: 15 minutos
- **Máximo de peticiones**: 10 por IP

**Response cuando se excede el límite**:
```json
{
  "success": false,
  "message": "Demasiadas peticiones desde esta IP, por favor intenta más tarde",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Status Code**: `429 Too Many Requests`

---

## ❌ Códigos de Error

| Código | Descripción |
|--------|-------------|
| 200 | OK - Operación exitosa |
| 201 | Created - Recurso creado |
| 400 | Bad Request - Petición inválida |
| 401 | Unauthorized - No autorizado |
| 403 | Forbidden - Acceso prohibido |
| 404 | Not Found - Recurso no encontrado |
| 409 | Conflict - Conflicto en la operación |
| 429 | Too Many Requests - Límite excedido |
| 500 | Internal Server Error - Error del servidor |

---

## 📝 Notas Importantes

1. **UUIDs**: Todos los IDs son UUIDs v4
2. **Timestamps**: Formato ISO 8601 (UTC)
3. **Encoding**: UTF-8
4. **Validaciones**: Todas las peticiones son validadas antes de procesarse
5. **Logs**: Todas las peticiones se registran en los logs del servidor

---

## 🧪 Testing con Postman/Insomnia

Importa esta colección para probar los endpoints:

```json
{
  "name": "Backend Inventario General",
  "requests": [
    {
      "name": "Health Check",
      "method": "GET",
      "url": "http://localhost:3001/health"
    },
    {
      "name": "Get Items",
      "method": "GET",
      "url": "http://localhost:3001/api/items/1"
    }
  ]
}
```

---

**Documentación actualizada**: Enero 2024
