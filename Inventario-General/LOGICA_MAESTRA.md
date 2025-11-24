# 📦 LÓGICA DE BASE DE DATOS MAESTRA - SISTEMA DE INVENTARIO

## 🎯 Objetivo del Sistema

Permitir el escaneo de códigos de barras durante el conteo de inventario y obtener automáticamente la información del producto (item, descripción, unidad de medida, grupo).

---

## 🗂️ Estructura de Datos

### **Concepto Clave: Relación Item ↔ Códigos de Barras**

```
UN ITEM puede tener MÚLTIPLES CÓDIGOS DE BARRAS
CADA CÓDIGO DE BARRAS es ÚNICO y pertenece a UN SOLO ITEM
```

### **Ejemplo Real: Cerveza Pilsen**

```
ITEM: 40013 (CERVEZA PILSEN)
│
├── Código de barras: 77020510240013 → UND (Unidad individual)
├── Código de barras: 77020510640013 → P6 (Paquete de 6)
└── Código de barras: 77020512440013 → CAJA (Caja de 24)
```

**Cada presentación tiene su propio código de barras único**, pero todas pertenecen al mismo item.

---

## 📊 Tablas de Base de Datos

### **1. inv_general_items (Tabla de Productos)**

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `id` | UUID | Identificador único interno | `a1b2c3d4-...` |
| `codigo` | VARCHAR(100) | **Código del item (ÚNICO)** | `40013` |
| `item` | VARCHAR(200) | Número del item | `40013` |
| `descripcion` | TEXT | Descripción del producto | `CERVEZA PILSEN` |
| `grupo` | VARCHAR(100) | Categoría/grupo | `15 - CERVEZA` |
| `activo` | BOOLEAN | Estado del item | `true` |
| `compania_id` | VARCHAR(50) | Empresa | `inv_merkahorro` |

**Constraint:** `codigo` es UNIQUE (no se puede repetir)

### **2. inv_general_codigos (Tabla de Códigos de Barras)**

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `id` | UUID | Identificador único interno | `e5f6g7h8-...` |
| `codigo_barras` | VARCHAR(100) | **Código de barras (ÚNICO)** | `77020510640013` |
| `item_id` | UUID | **FK a inv_general_items.id** | `a1b2c3d4-...` |
| `unidad_medida` | VARCHAR(50) | Tipo de empaque | `P6` |
| `factor` | NUMERIC | Unidades en el empaque | `6` |
| `activo` | BOOLEAN | Estado del código | `true` |
| `compania_id` | VARCHAR(50) | Empresa | `inv_merkahorro` |

**Constraints:**
- `codigo_barras` es UNIQUE (no se puede repetir)
- `item_id` es FOREIGN KEY a `inv_general_items(id)`

---

## 📝 Reglas de Validación

### ✅ **Permitido:**
- Un item puede repetirse en múltiples filas del Excel (diferentes códigos de barras)
- Ejemplo:
  ```
  Código          | Item  | Desc. item         | U.M.
  ----------------|-------|--------------------|---------
  77020510240013  | 40013 | CERVEZA PILSEN UND | UND
  77020510640013  | 40013 | CERVEZA PILSEN P6  | P6
  ```

### ❌ **NO Permitido:**
- Códigos de barras duplicados
  ```
  Código          | Item  | Error
  ----------------|-------|------------------
  77020510240013  | 40013 | OK
  77020510240013  | 40015 | ❌ Código repetido
  ```

- Items o códigos que inicien con '0'
  ```
  Código          | Item  | Error
  ----------------|-------|------------------
  07702051024001  | 40013 | ❌ Inicia con 0
  77020510240013  | 04013 | ❌ Inicia con 0
  ```

---

## 🔄 Flujo de Carga de Excel

### **Paso 1: Frontend lee el Excel**

```javascript
// Estructura esperada del Excel
Código          | Item  | Desc. item         | U.M.    | GRUPO        | Estado item
----------------|-------|--------------------|---------|--------------|--------------
77020510240013  | 40013 | CERVEZA PILSEN UND | UND     | 15 - CERVEZA | Activo
77020510640013  | 40013 | CERVEZA PILSEN P6  | P6      | 15 - CERVEZA | Activo
77020040140007  | 40007 | REFRESCO P6        | P6      | 31 - GASEOSA | Activo
```

### **Paso 2: Frontend procesa y agrupa**

```javascript
// ITEMS (se agrupan por item, eliminando duplicados)
items = [
  { codigo: "40013", item: "40013", descripcion: "CERVEZA PILSEN", grupo: "15 - CERVEZA" },
  { codigo: "40007", item: "40007", descripcion: "REFRESCO", grupo: "31 - GASEOSA" }
]

// CODIGOS (cada fila del Excel genera un código)
codigos = [
  { codigo_barras: "77020510240013", item_codigo: "40013", unidad_medida: "UND", factor: 1 },
  { codigo_barras: "77020510640013", item_codigo: "40013", unidad_medida: "P6", factor: 6 },
  { codigo_barras: "77020040140007", item_codigo: "40007", unidad_medida: "P6", factor: 6 }
]
```

### **Paso 3: Backend sincroniza**

1. **POST /api/maestra/upsert-items**
   - Inserta/actualiza items
   - Usa `codigo` como clave única
   - Retorna los UUIDs generados

2. **POST /api/maestra/upsert-codigos**
   - Busca el UUID del item usando `item_codigo`
   - Inserta/actualiza códigos de barras
   - Asocia `codigo_barras` → `item_id` (UUID)

3. **POST /api/maestra/desactivar-items** (opcional)
   - Desactiva items que están en BD pero no en el Excel

4. **POST /api/maestra/desactivar-codigos** (opcional)
   - Desactiva códigos que están en BD pero no en el Excel

---

## 🔍 Flujo de Escaneo en Inventario

### **Escenario: Scanner lee código de barras**

```javascript
// 1. Scanner lee: 77020510640013

// 2. Query SQL:
SELECT 
  c.codigo_barras,
  c.unidad_medida,
  c.factor,
  i.codigo,
  i.item,
  i.descripcion,
  i.grupo
FROM inv_general_codigos c
INNER JOIN inv_general_items i ON c.item_id = i.id
WHERE c.codigo_barras = '77020510640013'
  AND c.activo = true
  AND i.activo = true;

// 3. Resultado:
{
  codigo_barras: "77020510640013",
  unidad_medida: "P6",
  factor: 6,
  codigo: "40013",
  item: "40013",
  descripcion: "CERVEZA PILSEN",
  grupo: "15 - CERVEZA"
}

// 4. Registrar en tabla de conteo:
INSERT INTO inv_conteo_items (conteo_id, item_id, codigo_barras, cantidad, ...)
VALUES (...);
```

---

## 🎯 Ventajas de esta Arquitectura

✅ **Flexibilidad**: Un producto puede tener múltiples presentaciones  
✅ **Normalización**: No se duplica información del producto  
✅ **Trazabilidad**: Sabes exactamente qué empaque se escaneó  
✅ **Escalabilidad**: Fácil agregar nuevos códigos a productos existentes  
✅ **Integridad**: Foreign keys garantizan consistencia de datos  

---

## 📋 Checklist de Implementación

- [x] Esquema de base de datos (SQL)
- [x] Frontend: Validación de Excel
- [x] Frontend: Procesamiento de datos
- [x] Backend: Endpoints de sincronización
- [x] Backend: Resolución de UUIDs
- [x] Backend: Upsert de items
- [x] Backend: Upsert de códigos
- [x] Backend: Desactivación de obsoletos
- [ ] Testing con datos reales
- [ ] Implementar scanner de inventario
- [ ] Tabla de conteo de inventario

---

## 🚀 Próximos Pasos

1. **Ejecutar el script SQL** (`SCHEMA_MAESTRA.sql`) en tu base de datos
2. **Probar la carga de Excel** con datos reales
3. **Implementar el scanner** usando `findByBarcodeWithItem` del modelo Codigo
4. **Crear tabla de conteo** para registrar los escaneos

---

## 💡 Notas Importantes

- El campo `codigo` en `inv_general_items` es el identificador del item (40013)
- El campo `codigo_barras` en `inv_general_codigos` es lo que se escanea (77020510640013)
- **NO son lo mismo**, aunque en algunos casos puedan coincidir
- El backend resuelve automáticamente `item_codigo` → `item_id` (UUID)
- Todos los upserts son idempotentes (puedes ejecutarlos múltiples veces)

---

**Autor:** Sistema de Inventario MerkaPage  
**Fecha:** Noviembre 2025  
**Versión:** 1.0
