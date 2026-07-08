# Sistema de Consolidación de Inventario

## Arquitectura General

```
Conteos (C1, C2, C3, C4)
       │
       ▼
InventarioConsolidadoService
  └─ calcularInventarioUbicacion()   ← por ubicación individual
  └─ consolidarBodegaBatch()         ← bodega completa (optimizado)
       │
       ▼
inv_general_inventario_consolidado   ← tabla física
       │
       ▼
v_inventario_consolidado_completo    ← vista SQL con joins
       │
       ▼
GET /api/conteos/exportar/:bodegaId  ← endpoint export
  └─ Paginación keyset por consolidado_id
  └─ Agrupación por item_sku + suma
  └─ Frontend genera Excel (.xlsx)
```

## Modelo de Datos

### Tablas involucradas

| Tabla | Rol |
|---|---|
| `inv_general_conteos` | Cabecera de conteo (ubicacion_id, tipo_conteo, estado) |
| `inv_general_conteo_items` | Items contados (conteo_id, item_id, cantidad) |
| `inv_general_inventario_consolidado` | Resultado consolidado (nivel, referencia_id, item_id, cantidad_total) |
| `v_inventario_consolidado_completo` | Vista que JOINea items, bodegas, zonas, pasillos, ubicaciones |

### Tipos de Conteo

| Tipo | Nombre | Descripción |
|---|---|---|
| 1 | C1 - Conteo 1 | Conteo inicial |
| 2 | C2 - Conteo 2 | Segundo conteo (cifra ciega) |
| 3 | C3 - Reconteo | Tercer conteo (solo diferencias C1≠C2) |
| 4 | C4 - Ajuste Final | Ajuste manual del admin (sobrescribe todo) |

## Lógica de Prioridad (`_prioridad`)

Es el corazón del sistema. Decide qué cantidad usar cuando existen múltiples conteos para el mismo item en la misma ubicación.

### Orden de prioridad

```
C4 > 0        → Usa Ajuste Final (el admin puso un valor real)  ✅
C4 = 0        → Si C1/C2/C3 tienen historia positiva:
                 Recupera en orden: C3 (reconteo) > C2 > C1
                 (Asume que el 0 fue accidental)
C4 = 0        → Si NO hay historia positiva:
                 Respeta el 0 (el admin realmente lo puso en 0)
C3 > 0        → Usa Reconteo (es el más preciso)
C1 = C2 > 0   → Usa Consenso
C2 > 0        → Usa Conteo 2 (último conteo regular)
C1 > 0        → Usa Conteo 1
Nada > 0      → 0 (item no incluido en consolidación)
```

### Código (3 lugares, deben mantenerse sincronizados)

| Archivo | Línea | Función |
|---|---|---|
| `src/services/inventario-consolidado.service.js` | ~253 | `_prioridad()` — usada por `consolidarBodegaBatch` |
| `src/services/inventario-consolidado.service.js` | ~427 | `calcularInventarioUbicacion()` — consolidación individual |
| `src/services/conteo.service.js` | ~89 | `getItemLocations()` — vista de ubicaciones por item |

**⚠️ Si cambia la lógica de prioridad, cambiar en los 3 lugares.**

### Historial de Fixes

| Fecha | Bug | Fix |
|---|---|---|
| 2026-07-08 | `_prioridad` devolvía C4=0 aunque C1/C2 tuvieran 5076 | Safety net: si C4=0 con historia, recupera de C3/C2/C1 |
| 2026-07-08 | Safety net original no consideraba C3 | Mejora: también recupera de C3 (reconteo) antes que C2/C1 |

## Consolidación

### ¿Cuándo se ejecuta?

1. **Automáticamente** al cerrar pasillo/zona/bodega (flujo jerarquía)
2. **Manual** vía endpoint `POST /api/inventario/reconsolidar-bodega`
3. **Botón "Re-consolidar Bodega"** en la pantalla de Exportar Excel

### ¿Qué hace `consolidarBodegaBatch`?

1. Trae TODOS los conteos finalizados de la bodega (pagina por id)
2. Trae TODOS los conteo_items relacionados (pagina por id)
3. Agrupa en memoria por (ubicacion, item)
4. Aplica `_prioridad()` para resolver la cantidad final
5. Acumula jerárquicamente: ubicación → pasillo → zona → bodega
6. Hace UPSERT en `inv_general_inventario_consolidado` para los 4 niveles

**Esto garantiza que TODOS los items aparezcan en el export**, sin importar cuántos sean, porque:
- Paginación keyset (sin `OFFSET`) → no salta filas
- La paginación fue **verificada con 2265 filas** (3 páginas de 1000) sin pérdidas
- El límite práctico es el que imponga Supabase (muy alto)

### Verificación de paginación

La paginación usa `gt(consolidado_id, lastId)` con `order(ascending)` sobre la PK de la tabla consolidada. Esto es keyset pagination y NO tiene los problemas de `OFFSET` (no salta filas aunque se inserten/muen nuevas entre páginas).

## Exportación a Excel

### Backend → `GET /api/conteos/exportar/:bodegaId`

1. Lee la bodega para obtener `compania_id` (seguridad: solo exporta datos de su compañía)
2. Pagina `v_inventario_consolidado_completo` donde `nivel = 'ubicacion'` y `bodega_id = :id`
3. Agrupa por `item_sku` y suma `cantidad_total`
4. Devuelve: `{ success, data: [{ item, descripcion, bodega, conteo_cantidad, item_grupo }], bodega, message }`

### Frontend → `ExportarInventarioExcel.jsx`

1. Llama al endpoint
2. Si hay áreas abiertas, advierte pero permite exportar
3. Agrupa por item (redundante, el backend ya agrupa)
4. Filtra `cantidad > 0` (items con 0 no se incluyen en Excel)
5. Genera `.xlsx` con columnas: NRO_INVENTARIO_BODEGA, ITEM, BODEGA, CANT_11ENT_PUNTO_4DECIMALES

## Troubleshooting

### Síntoma: Un item aparece con menos cantidad de la esperada

**Causas probables:**
1. **C4=0 fantasma**: Existe un Ajuste Final (C4) con cantidad 0 que tiene historia positiva atrás.
   - **Solución**: El safety net debería resolverlo automáticamente. Si no, re-consolidar.
   - **Verificar**: `SELECT item_id, cantidad FROM inv_general_conteo_items WHERE conteo_id IN (SELECT id FROM inv_general_conteos WHERE tipo_conteo=4) AND item_id = :itemId;`

2. **Consolidación desactualizada**: Se agregaron conteos después del último cierre.
   - **Solución**: Re-consolidar vía botón en UI o endpoint.

3. **Falta de paginación**: Items que están más allá de la página 1000.
   - **Verificar**: Contar filas en el view vs. lo que devuelve el export.
   - **Solución**: Ya implementamos keyset pagination. Verificar que funcione.

4. **Conteo no finalizado**: El conteo está en estado `en_progreso`.
   - **Solución**: Finalizar el conteo primero.

### Síntoma: El Excel no se genera o sale vacío

**Causas probables:**
1. No hay datos consolidados para la bodega (nunca se consolidó)
2. Error de red al paginar (el endpoint falla, no da datos parciales)

### Síntoma: La suma total de unidades no es la esperada

1. Verificar si hay items con C3 que se están usando en lugar de C1/C2 (el reconteo es más preciso)
2. Los decimales ahora están habilitados (`,`) — algunas cantidades pueden tener fracciones

## Comandos útiles (SQL)

```sql
-- Ver items con C4=0 que tienen historia en C1/C2 (el bug que corregimos)
SELECT ci.item_id, i.item, i.descripcion
FROM inv_general_conteo_items ci
JOIN inv_general_conteos c ON ci.conteo_id = c.id
JOIN inv_general_items i ON ci.item_id = i.id
WHERE c.tipo_conteo = 4 AND ci.cantidad = 0
AND EXISTS (
  SELECT 1 FROM inv_general_conteo_items ci2
  JOIN inv_general_conteos c2 ON ci2.conteo_id = c2.id
  WHERE ci2.item_id = ci.item_id
  AND c2.tipo_conteo IN (1, 2)
  AND ci2.cantidad > 0
);

-- Ver total de filas en el view por bodega
SELECT count(*) FROM v_inventario_consolidado_completo
WHERE bodega_id = 'be29a5e0-217d-43e5-80d6-65d8cf7d6406'
AND nivel = 'ubicacion';

-- Ver items de una ubicación específica en el consolidado
SELECT * FROM v_inventario_consolidado_completo
WHERE bodega_id = 'be29a5e0-217d-43e5-80d6-65d8cf7d6406'
AND item_sku = '40027'
AND nivel = 'ubicacion'
ORDER BY ubicacion;
```

## Flujo recomendado para inventarios nuevos

1. Cerrar pasillos (consolida ubicaciones)
2. Cerrar zonas (consolida pasillos)
3. Cerrar bodega (consolida zonas)
4. **Verificar** exportando el Excel
5. Si algo está descuadrado → **Re-consolidar Bodega** y re-exportar
6. Recién ahí dar el inventario por terminado
