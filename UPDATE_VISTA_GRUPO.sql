-- =====================================================
-- ACTUALIZAR VISTA: v_inventario_consolidado_completo
-- Agregar campo item_grupo para filtro de categorías
-- =====================================================

-- Eliminar vista existente
DROP VIEW IF EXISTS public.v_inventario_consolidado_completo;

-- Recrear vista con campo item_grupo
CREATE VIEW public.v_inventario_consolidado_completo AS
SELECT
  c.id AS consolidado_id,
  c.nivel,
  i.item AS item_sku,
  c.cantidad_total,
  i.descripcion AS item_nombre,
  i.grupo AS item_grupo, -- ✅ NUEVO CAMPO AGREGADO
  u.numero AS ubicacion,
  p.numero AS pasillo,
  z.nombre AS zona,
  b.nombre AS bodega,
  (
    SELECT
      cod.codigo_barras
    FROM
      inv_general_codigos cod
    WHERE
      cod.item_id = c.item_id
      AND cod.activo = true
    LIMIT 1
  ) AS item_codigo_barras,
  c.updated_at AS ultima_actualizacion,
  c.item_id,
  c.bodega_id,
  c.zona_id,
  c.pasillo_id,
  c.ubicacion_id,
  c.compania_id
FROM
  inv_general_inventario_consolidado c
  LEFT JOIN inv_general_items i ON c.item_id = i.id
  LEFT JOIN inv_general_bodegas b ON c.bodega_id = b.id
  LEFT JOIN inv_general_zonas z ON c.zona_id = z.id
  LEFT JOIN inv_general_pasillos p ON c.pasillo_id = p.id
  LEFT JOIN inv_general_ubicaciones u ON c.ubicacion_id = u.id;

-- Verificar que la vista se creó correctamente
SELECT 
    column_name, 
    data_type 
FROM 
    information_schema.columns 
WHERE 
    table_name = 'v_inventario_consolidado_completo' 
ORDER BY 
    ordinal_position;

-- Probar la vista con un query de ejemplo
SELECT 
    item_sku,
    item_nombre,
    item_grupo,
    bodega,
    cantidad_total
FROM 
    v_inventario_consolidado_completo
WHERE 
    nivel = 'ubicacion'
LIMIT 10;
