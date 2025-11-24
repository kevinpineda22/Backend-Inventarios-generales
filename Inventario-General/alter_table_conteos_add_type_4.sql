-- =====================================================
-- MIGRACIÓN: Permitir tipo_conteo = 4 (Ajuste Final)
-- =====================================================

-- 1. Eliminar el constraint existente
ALTER TABLE inv_general_conteos 
DROP CONSTRAINT IF EXISTS inv_general_conteos_tipo_conteo_check;

-- 2. Agregar el nuevo constraint incluyendo el valor 4
ALTER TABLE inv_general_conteos 
ADD CONSTRAINT inv_general_conteos_tipo_conteo_check 
CHECK (tipo_conteo IN (1, 2, 3, 4));

-- 3. Comentario explicativo
COMMENT ON COLUMN inv_general_conteos.tipo_conteo IS '1=Conteo1, 2=Conteo2, 3=Reconteo, 4=AjusteFinal';
