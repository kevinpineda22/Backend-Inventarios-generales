-- =====================================================
-- ÍNDICES Y CONSTRAINTS CRÍTICOS PARA PRODUCCIÓN
-- Sistema de Inventario General
-- Fecha: Febrero 11, 2026
-- =====================================================
-- INSTRUCCIONES: Ejecutar en Supabase SQL Editor
-- Estos índices mejoran rendimiento y garantizan integridad de datos
-- =====================================================

-- =====================================================
-- 1. INDICES DE RENDIMIENTO
-- =====================================================

-- 1.1 Búsquedas frecuentes en conteos (muy importante)
CREATE INDEX IF NOT EXISTS idx_conteos_ubicacion_tipo 
ON inv_general_conteos(ubicacion_id, tipo_conteo)
WHERE estado != 'cancelado';
COMMENT ON INDEX idx_conteos_ubicacion_tipo IS 'Acelera búsqueda de conteos por ubicación y tipo';

-- 1.2 Items de un conteo (consulta constante)
CREATE INDEX IF NOT EXISTS idx_conteo_items_conteo_id 
ON inv_general_conteo_items(conteo_id);
COMMENT ON INDEX idx_conteo_items_conteo_id IS 'Acelera obtención de items de un conteo';

-- 1.3 Items por item_id (para consolidación)
CREATE INDEX IF NOT EXISTS idx_conteo_items_item_id 
ON inv_general_conteo_items(item_id);
COMMENT ON INDEX idx_conteo_items_item_id IS 'Acelera búsqueda de conteos de un item específico';

-- 1.4 Búsquedas de items por compañía y código
CREATE INDEX IF NOT EXISTS idx_items_compania_codigo 
ON inv_general_items(compania_id, codigo);
COMMENT ON INDEX idx_items_compania_codigo IS 'Acelera búsqueda de items por código dentro de compañía';

-- 1.5 Búsquedas de códigos de barras
CREATE INDEX IF NOT EXISTS idx_codigos_compania_barras 
ON inv_general_codigos(compania_id, codigo_barras)
WHERE activo = true;
COMMENT ON INDEX idx_codigos_compania_barras IS 'Acelera escaneo de códigos de barras';

-- 1.6 Historial por compañía
CREATE INDEX IF NOT EXISTS idx_conteos_compania_estado
ON inv_general_conteos(compania_id, estado, fecha_inicio DESC);
COMMENT ON INDEX idx_conteos_compania_estado IS 'Acelera consulta de historial por compañía';

-- 1.7 Ubicaciones por jerarquía
CREATE INDEX IF NOT EXISTS idx_ubicaciones_pasillo 
ON inv_general_ubicaciones(pasillo_id, activo);
COMMENT ON INDEX idx_ubicaciones_pasillo IS 'Acelera navegación por estructura jerárquica';

CREATE INDEX IF NOT EXISTS idx_pasillos_zona 
ON inv_general_pasillos(zona_id, activo);
COMMENT ON INDEX idx_pasillos_zona IS 'Acelera navegación por zonas';

CREATE INDEX IF NOT EXISTS idx_zonas_bodega 
ON inv_general_zonas(bodega_id, activo);
COMMENT ON INDEX idx_zonas_bodega IS 'Acelera navegación por bodegas';

-- =====================================================
-- 2. CONSTRAINTS DE INTEGRIDAD (CRÍTICOS)
-- =====================================================

-- 2.1 CRÍTICO: Evita duplicados de items en la misma compañía
-- NOTA: Verificar primero si ya existe antes de crear
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_item_codigo_compania'
    ) THEN
        ALTER TABLE inv_general_items 
        ADD CONSTRAINT unique_item_codigo_compania 
        UNIQUE (codigo, compania_id);
        
        RAISE NOTICE 'Constraint unique_item_codigo_compania creado exitosamente';
    ELSE
        RAISE NOTICE 'Constraint unique_item_codigo_compania ya existe';
    END IF;
END $$;

-- 2.2 CRÍTICO: Evita múltiples conteos del mismo tipo en una ubicación
-- (Solo puede haber UN conteo tipo 1, UN tipo 2, etc. por ubicación)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_conteo_ubicacion_tipo'
    ) THEN
        CREATE UNIQUE INDEX idx_conteos_unique_ubicacion_tipo 
        ON inv_general_conteos(ubicacion_id, tipo_conteo) 
        WHERE estado != 'cancelado';
        
        ALTER TABLE inv_general_conteos 
        ADD CONSTRAINT unique_conteo_ubicacion_tipo 
        UNIQUE USING INDEX idx_conteos_unique_ubicacion_tipo;
        
        RAISE NOTICE 'Constraint unique_conteo_ubicacion_tipo creado exitosamente';
    ELSE
        RAISE NOTICE 'Constraint unique_conteo_ubicacion_tipo ya existe';
    END IF;
END $$;

-- 2.3 Unicidad en códigos de barras por compañía
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_codigo_barras_compania'
    ) THEN
        ALTER TABLE inv_general_codigos 
        ADD CONSTRAINT unique_codigo_barras_compania 
        UNIQUE (codigo_barras, compania_id);
        
        RAISE NOTICE 'Constraint unique_codigo_barras_compania creado exitosamente';
    ELSE
        RAISE NOTICE 'Constraint unique_codigo_barras_compania ya existe';
    END IF;
END $$;

-- =====================================================
-- 3. INDICES PARA CONSOLIDACIÓN
-- =====================================================

-- 3.1 Vista de consolidación
CREATE INDEX IF NOT EXISTS idx_consolidado_bodega_compania
ON inv_general_inventario_consolidado(bodega_id, compania_id, nivel);
COMMENT ON INDEX idx_consolidado_bodega_compania IS 'Acelera exportación consolidada por bodega';

CREATE INDEX IF NOT EXISTS idx_consolidado_item_compania
ON inv_general_inventario_consolidado(item_id, compania_id);
COMMENT ON INDEX idx_consolidado_item_compania IS 'Acelera búsqueda de items consolidados';

-- =====================================================
-- 4. VALIDACIÓN DE INTEGRIDAD REFERENCIAL
-- =====================================================

-- Verificar que todas las FKs existen
DO $$
DECLARE
    fk_count INTEGER;
BEGIN
    -- Verificar FKs críticas
    SELECT COUNT(*) INTO fk_count
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
    AND table_schema = 'public'
    AND table_name LIKE 'inv_general_%';
    
    RAISE NOTICE 'Total de Foreign Keys encontradas: %', fk_count;
    
    IF fk_count < 10 THEN
        RAISE WARNING 'Se esperaban al menos 10 FKs. Revisar integridad referencial.';
    ELSE
        RAISE NOTICE 'Integridad referencial OK';
    END IF;
END $$;

-- =====================================================
-- 5. ANÁLISIS DE RENDIMIENTO
-- =====================================================

-- Ver estadísticas de uso de índices (ejecutar después de algunos días)
-- DESCOMENTA para ejecutar:
/*
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND tablename LIKE 'inv_general_%'
ORDER BY idx_scan DESC;
*/

-- Ver tablas más grandes (para monitoreo de crecimiento)
-- DESCOMENTA para ejecutar:
/*
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
AND tablename LIKE 'inv_general_%'
ORDER BY size_bytes DESC;
*/

-- =====================================================
-- 6. TRIGGERS DE AUDITORÍA (OPCIONAL PERO RECOMENDADO)
-- =====================================================

-- Trigger para mantener updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a tablas críticas si no existe
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE 'inv_general_%'
        AND EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = t 
            AND column_name = 'updated_at'
        )
    LOOP
        IF NOT EXISTS (
            SELECT 1 
            FROM pg_trigger 
            WHERE tgname = 'update_' || t || '_updated_at'
        ) THEN
            EXECUTE format('
                CREATE TRIGGER update_%I_updated_at
                BEFORE UPDATE ON %I
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column()
            ', t, t);
            
            RAISE NOTICE 'Trigger created for table: %', t;
        END IF;
    END LOOP;
END $$;

-- =====================================================
-- 7. PERMISOS Y SEGURIDAD (RLS)
-- =====================================================

-- Verificar que RLS esté habilitado en tablas críticas
DO $$
DECLARE
    tbl TEXT;
    rls_enabled BOOLEAN;
BEGIN
    FOR tbl IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename LIKE 'inv_general_%'
    LOOP
        SELECT relrowsecurity INTO rls_enabled
        FROM pg_class
        WHERE relname = tbl;
        
        IF rls_enabled THEN
            RAISE NOTICE 'RLS habilitado en: %', tbl;
        ELSE
            RAISE WARNING 'RLS NO habilitado en: % (considerar habilitarlo para seguridad)', tbl;
        END IF;
    END LOOP;
END $$;

-- =====================================================
-- RESUMEN
-- =====================================================
-- ÍNDICES CREADOS: 9 índices de rendimiento
-- CONSTRAINTS: 3 constraints de unicidad críticos
-- TRIGGERS: Updated_at automático en todas las tablas
-- SEGURIDAD: Verificación de RLS
-- 
-- PRÓXIMOS PASOS:
-- 1. Ejecutar este script en Supabase SQL Editor
-- 2. Verificar que no haya errores
-- 3. Monitorear rendimiento después de 24-48 horas
-- 4. Si hay queries lentas, usar EXPLAIN ANALYZE para optimizar
-- =====================================================

SELECT 'Script de índices ejecutado correctamente ✅' AS resultado;
