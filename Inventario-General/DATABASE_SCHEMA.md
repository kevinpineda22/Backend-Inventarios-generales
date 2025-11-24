# Estructura de Base de Datos - Inventario General
## Esquema para Supabase PostgreSQL

---

## 📋 TABLAS PRINCIPALES

### 1. `inv_general_items`
Tabla maestra de items/productos de la compañía

```sql
CREATE TABLE inv_general_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item VARCHAR(100) NOT NULL,
  descripcion TEXT NOT NULL,
  codigo_barra VARCHAR(100) NOT NULL,
  compania_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_items_codigo_barra ON inv_general_items(codigo_barra);
CREATE INDEX idx_items_compania ON inv_general_items(compania_id);
CREATE INDEX idx_items_item ON inv_general_items(item);

-- Constraints
ALTER TABLE inv_general_items ADD CONSTRAINT unique_codigo_barra_compania 
  UNIQUE (codigo_barra, compania_id);
```

**Columnas:**
- `id`: Identificador único del item
- `item`: Código del item
- `descripcion`: Descripción del producto
- `codigo_barra`: Código de barras del producto
- `compania_id`: ID de la compañía a la que pertenece
- `created_at`: Fecha de creación
- `updated_at`: Fecha de última actualización

---

### 2. `inv_general_bodegas`
Bodegas de almacenamiento

```sql
CREATE TABLE inv_general_bodegas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(200) NOT NULL,
  compania_id VARCHAR(50) NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_bodegas_compania ON inv_general_bodegas(compania_id);
```

**Columnas:**
- `id`: Identificador único de la bodega
- `nombre`: Nombre de la bodega
- `compania_id`: ID de la compañía
- `activo`: Estado activo/inactivo
- `created_at`: Fecha de creación
- `updated_at`: Fecha de última actualización

---

### 3. `inv_general_zonas`
Zonas dentro de las bodegas

```sql
CREATE TABLE inv_general_zonas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(200) NOT NULL,
  bodega_id UUID NOT NULL REFERENCES inv_general_bodegas(id) ON DELETE CASCADE,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_zonas_bodega ON inv_general_zonas(bodega_id);
```

**Columnas:**
- `id`: Identificador único de la zona
- `nombre`: Nombre de la zona
- `bodega_id`: Referencia a la bodega padre
- `activo`: Estado activo/inactivo
- `created_at`: Fecha de creación
- `updated_at`: Fecha de última actualización

---

### 4. `inv_general_pasillos`
Pasillos dentro de las zonas

```sql
CREATE TABLE inv_general_pasillos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero VARCHAR(50) NOT NULL,
  zona_id UUID NOT NULL REFERENCES inv_general_zonas(id) ON DELETE CASCADE,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_pasillos_zona ON inv_general_pasillos(zona_id);
```

**Columnas:**
- `id`: Identificador único del pasillo
- `numero`: Número del pasillo
- `zona_id`: Referencia a la zona padre
- `activo`: Estado activo/inactivo
- `created_at`: Fecha de creación
- `updated_at`: Fecha de última actualización

---

### 5. `inv_general_ubicaciones`
Ubicaciones específicas dentro de los pasillos

```sql
CREATE TABLE inv_general_ubicaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero VARCHAR(50) NOT NULL,
  clave VARCHAR(20) NOT NULL,
  pasillo_id UUID NOT NULL REFERENCES inv_general_pasillos(id) ON DELETE CASCADE,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_ubicaciones_pasillo ON inv_general_ubicaciones(pasillo_id);
CREATE INDEX idx_ubicaciones_clave ON inv_general_ubicaciones(clave);
```

**Columnas:**
- `id`: Identificador único de la ubicación
- `numero`: Número de la ubicación
- `clave`: Clave única para iniciar conteo (seguridad)
- `pasillo_id`: Referencia al pasillo padre
- `activo`: Estado activo/inactivo
- `created_at`: Fecha de creación
- `updated_at`: Fecha de última actualización

---

### 6. `inv_general_conteos`
Registro de conteos realizados

```sql
CREATE TABLE inv_general_conteos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ubicacion_id UUID NOT NULL REFERENCES inv_general_ubicaciones(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL,
  tipo_conteo INTEGER NOT NULL CHECK (tipo_conteo IN (1, 2, 3)),
  estado VARCHAR(50) DEFAULT 'en_progreso' CHECK (estado IN ('en_progreso', 'finalizado', 'pendiente', 'aprobado', 'rechazado')),
  fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
  fecha_fin TIMESTAMP WITH TIME ZONE,
  fecha_aprobacion TIMESTAMP WITH TIME ZONE,
  fecha_rechazo TIMESTAMP WITH TIME ZONE,
  motivo_rechazo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_conteos_ubicacion ON inv_general_conteos(ubicacion_id);
CREATE INDEX idx_conteos_usuario ON inv_general_conteos(usuario_id);
CREATE INDEX idx_conteos_tipo ON inv_general_conteos(tipo_conteo);
CREATE INDEX idx_conteos_estado ON inv_general_conteos(estado);
CREATE INDEX idx_conteos_fecha_inicio ON inv_general_conteos(fecha_inicio);
```

**Columnas:**
- `id`: Identificador único del conteo
- `ubicacion_id`: Referencia a la ubicación contada
- `usuario_id`: Usuario que realizó el conteo
- `tipo_conteo`: Tipo de conteo (1=Primero, 2=Segundo, 3=Diferencias)
- `estado`: Estado del conteo (en_progreso, finalizado, pendiente, aprobado, rechazado)
- `fecha_inicio`: Fecha y hora de inicio del conteo
- `fecha_fin`: Fecha y hora de finalización del conteo
- `fecha_aprobacion`: Fecha de aprobación (si aplica)
- `fecha_rechazo`: Fecha de rechazo (si aplica)
- `motivo_rechazo`: Motivo del rechazo
- `created_at`: Fecha de creación del registro
- `updated_at`: Fecha de última actualización

---

### 7. `inv_general_conteo_items`
Items contados en cada conteo

```sql
CREATE TABLE inv_general_conteo_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conteo_id UUID NOT NULL REFERENCES inv_general_conteos(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inv_general_items(id) ON DELETE CASCADE,
  cantidad INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_conteo_items_conteo ON inv_general_conteo_items(conteo_id);
CREATE INDEX idx_conteo_items_item ON inv_general_conteo_items(item_id);

-- Constraint para evitar duplicados
ALTER TABLE inv_general_conteo_items ADD CONSTRAINT unique_conteo_item 
  UNIQUE (conteo_id, item_id);
```

**Columnas:**
- `id`: Identificador único del registro
- `conteo_id`: Referencia al conteo
- `item_id`: Referencia al item contado
- `cantidad`: Cantidad contada del item
- `created_at`: Fecha de creación
- `updated_at`: Fecha de última actualización

---

## 🔧 FUNCIONES POSTGRESQL

### Función para obtener items con diferencias

```sql
CREATE OR REPLACE FUNCTION obtener_items_con_diferencias(p_ubicacion_id UUID)
RETURNS TABLE (
  item_id UUID,
  item VARCHAR,
  descripcion TEXT,
  codigo_barra VARCHAR,
  conteo1 INTEGER,
  conteo2 INTEGER,
  diferencia INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH conteo1_data AS (
    SELECT 
      ci.item_id,
      ci.cantidad
    FROM inv_general_conteo_items ci
    JOIN inv_general_conteos c ON ci.conteo_id = c.id
    WHERE c.ubicacion_id = p_ubicacion_id 
      AND c.tipo_conteo = 1
      AND c.estado = 'finalizado'
  ),
  conteo2_data AS (
    SELECT 
      ci.item_id,
      ci.cantidad
    FROM inv_general_conteo_items ci
    JOIN inv_general_conteos c ON ci.conteo_id = c.id
    WHERE c.ubicacion_id = p_ubicacion_id 
      AND c.tipo_conteo = 2
      AND c.estado = 'finalizado'
  )
  SELECT 
    i.id,
    i.item,
    i.descripcion,
    i.codigo_barra,
    COALESCE(c1.cantidad, 0) AS conteo1,
    COALESCE(c2.cantidad, 0) AS conteo2,
    ABS(COALESCE(c1.cantidad, 0) - COALESCE(c2.cantidad, 0)) AS diferencia
  FROM inv_general_items i
  LEFT JOIN conteo1_data c1 ON i.id = c1.item_id
  LEFT JOIN conteo2_data c2 ON i.id = c2.item_id
  WHERE COALESCE(c1.cantidad, 0) != COALESCE(c2.cantidad, 0);
END;
$$ LANGUAGE plpgsql;
```

---

## 🔐 ROW LEVEL SECURITY (RLS)

### Habilitar RLS en todas las tablas

```sql
-- Habilitar RLS
ALTER TABLE inv_general_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_general_bodegas ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_general_zonas ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_general_pasillos ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_general_ubicaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_general_conteos ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_general_conteo_items ENABLE ROW LEVEL SECURITY;

-- Políticas de ejemplo (ajustar según tus necesidades de autenticación)

-- Permitir lectura a usuarios autenticados
CREATE POLICY "Allow authenticated read access" ON inv_general_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON inv_general_bodegas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON inv_general_zonas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON inv_general_pasillos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON inv_general_ubicaciones
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON inv_general_conteos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access" ON inv_general_conteo_items
  FOR SELECT TO authenticated USING (true);

-- Permitir escritura a usuarios autenticados (ajustar según roles)
CREATE POLICY "Allow authenticated insert" ON inv_general_items
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated insert" ON inv_general_bodegas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated insert" ON inv_general_zonas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated insert" ON inv_general_pasillos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated insert" ON inv_general_ubicaciones
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated insert" ON inv_general_conteos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated insert" ON inv_general_conteo_items
  FOR INSERT TO authenticated WITH CHECK (true);

-- Permitir actualización
CREATE POLICY "Allow authenticated update" ON inv_general_conteos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated update" ON inv_general_conteo_items
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Permitir eliminación
CREATE POLICY "Allow authenticated delete" ON inv_general_conteo_items
  FOR DELETE TO authenticated USING (true);
```

---

## 📊 DIAGRAMA DE RELACIONES

```
inv_general_bodegas
  └── inv_general_zonas (1:N)
       └── inv_general_pasillos (1:N)
            └── inv_general_ubicaciones (1:N)
                 └── inv_general_conteos (1:N)
                      └── inv_general_conteo_items (1:N)
                           └── inv_general_items (N:1)
```

**Jerarquía:**
- Una **Bodega** tiene muchas **Zonas**
- Una **Zona** tiene muchos **Pasillos**
- Un **Pasillo** tiene muchas **Ubicaciones**
- Una **Ubicación** tiene muchos **Conteos**
- Un **Conteo** tiene muchos **Items contados**
- Cada **Item contado** referencia a un **Item** de la maestra

---

## 🚀 INSTRUCCIONES DE IMPLEMENTACIÓN EN SUPABASE

### Paso 1: Crear las tablas
1. Accede a tu proyecto en Supabase
2. Ve a la sección **SQL Editor**
3. Copia y ejecuta el código SQL de cada tabla en orden

### Paso 2: Crear índices
Ejecuta las sentencias `CREATE INDEX` de cada tabla

### Paso 3: Crear función
Ejecuta el código de la función `obtener_items_con_diferencias`

### Paso 4: Configurar RLS
Ejecuta las políticas de Row Level Security según tus necesidades de seguridad

### Paso 5: Verificar
Verifica que todas las tablas se crearon correctamente en la sección **Table Editor**

---

## 📝 NOTAS IMPORTANTES

1. **Compañías**: El sistema está diseñado para trabajar con múltiples compañías usando `compania_id`
2. **Claves de ubicación**: Cada ubicación tiene una clave única para iniciar el conteo (seguridad)
3. **Tipos de conteo**: 
   - Tipo 1: Primer conteo
   - Tipo 2: Segundo conteo
   - Tipo 3: Conteo de diferencias
4. **Estados de conteo**:
   - `en_progreso`: Conteo activo
   - `finalizado`: Conteo terminado por el empleado
   - `pendiente`: Esperando aprobación del admin
   - `aprobado`: Aprobado por el admin
   - `rechazado`: Rechazado por el admin
5. **Cascada**: Las eliminaciones en cascada están configuradas para mantener la integridad

---

## 🔄 TRIGGERS RECOMENDADOS

### Actualizar updated_at automáticamente

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a todas las tablas
CREATE TRIGGER update_inv_general_items_updated_at BEFORE UPDATE ON inv_general_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inv_general_bodegas_updated_at BEFORE UPDATE ON inv_general_bodegas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inv_general_zonas_updated_at BEFORE UPDATE ON inv_general_zonas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inv_general_pasillos_updated_at BEFORE UPDATE ON inv_general_pasillos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inv_general_ubicaciones_updated_at BEFORE UPDATE ON inv_general_ubicaciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inv_general_conteos_updated_at BEFORE UPDATE ON inv_general_conteos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inv_general_conteo_items_updated_at BEFORE UPDATE ON inv_general_conteo_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 📧 SOPORTE

Para cualquier duda sobre la estructura de la base de datos o su implementación, consulta la documentación de Supabase: https://supabase.com/docs
