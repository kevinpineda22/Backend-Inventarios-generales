-- =====================================================
-- SCRIPT: AGREGAR COLUMNA ESTADO A ESTRUCTURA
-- Descripción: Agrega la columna 'estado' a Bodegas, Zonas y Pasillos
-- para manejar el cierre de inventario.
-- =====================================================

-- 1. Agregar columna estado a BODEGAS
ALTER TABLE inv_general_bodegas 
ADD COLUMN IF NOT EXISTS estado VARCHAR(50) DEFAULT 'abierto';

-- 2. Agregar columna estado a ZONAS
ALTER TABLE inv_general_zonas 
ADD COLUMN IF NOT EXISTS estado VARCHAR(50) DEFAULT 'abierto';

-- 3. Agregar columna estado a PASILLOS
ALTER TABLE inv_general_pasillos 
ADD COLUMN IF NOT EXISTS estado VARCHAR(50) DEFAULT 'abierto';

-- 4. Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_bodegas_estado ON inv_general_bodegas(estado);
CREATE INDEX IF NOT EXISTS idx_zonas_estado ON inv_general_zonas(estado);
CREATE INDEX IF NOT EXISTS idx_pasillos_estado ON inv_general_pasillos(estado);

-- 5. Comentarios
COMMENT ON COLUMN inv_general_bodegas.estado IS 'Estado del inventario: abierto, cerrado';
COMMENT ON COLUMN inv_general_zonas.estado IS 'Estado del inventario: abierto, cerrado';
COMMENT ON COLUMN inv_general_pasillos.estado IS 'Estado del inventario: abierto, cerrado';
