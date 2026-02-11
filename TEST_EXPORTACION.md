# 🧪 TEST DE VALIDACIÓN - Exportación con Filtro de Compañía

## Objetivo
Verificar que el nuevo filtro de `compania_id` NO cambie los resultados de exportación

---

## 📝 PRUEBA RÁPIDA (5 minutos)

### Opción 1: Comparar en Supabase (MÁS RÁPIDO)

**Paso 1:** En Supabase SQL Editor, ejecutar:

```sql
-- Consulta ANTIGUA (sin filtro de compañía)
SELECT item_sku, item_nombre, cantidad_total, compania_id
FROM v_inventario_consolidado_completo
WHERE bodega_id = 'TU_BODEGA_ID_AQUI'  -- Reemplazar con ID real
  AND nivel = 'ubicacion'
ORDER BY item_sku;

-- Guardar el COUNT de resultados
```

**Paso 2:** Obtener el `compania_id` de esa bodega:

```sql
SELECT compania_id 
FROM inv_general_bodegas 
WHERE id = 'TU_BODEGA_ID_AQUI';
```

**Paso 3:** Consulta NUEVA (con filtro de compañía):

```sql
-- Consulta NUEVA (con filtro adicional)
SELECT item_sku, item_nombre, cantidad_total, compania_id
FROM v_inventario_consolidado_completo
WHERE bodega_id = 'TU_BODEGA_ID_AQUI'
  AND compania_id = 'COMPANIA_ID_DE_LA_BODEGA'  -- Del paso 2
  AND nivel = 'ubicacion'
ORDER BY item_sku;

-- Comparar el COUNT con el Paso 1
```

**✅ RESULTADO ESPERADO:**
- Ambas consultas deben retornar **EXACTAMENTE LA MISMA CANTIDAD** de filas
- Los `item_sku` deben ser idénticos
- Si son iguales → **El cambio es 100% seguro**

---

### Opción 2: Test en Código (Si prefieres probar en tu app)

**Temporal:** Modifica `exportarBodega` para comparar:

```javascript
static async exportarBodega(bodegaId) {
  try {
    console.log(`[EXPORT TEST] Bodega: ${bodegaId}`);
    
    const bodega = await BodegaModel.findById(bodegaId);
    const companiaId = bodega.compania_id;
    
    // CONSULTA SIN FILTRO (tu lógica actual)
    const { data: dataOld } = await supabase
      .from('v_inventario_consolidado_completo')
      .select('item_sku, item_nombre, cantidad_total')
      .eq('bodega_id', bodegaId)
      .eq('nivel', 'ubicacion');
    
    // CONSULTA CON FILTRO (nueva lógica)
    const { data: dataNew } = await supabase
      .from('v_inventario_consolidado_completo')
      .select('item_sku, item_nombre, cantidad_total')
      .eq('bodega_id', bodegaId)
      .eq('compania_id', companiaId)
      .eq('nivel', 'ubicacion');
    
    // COMPARAR
    console.log(`[TEST] Sin filtro: ${dataOld.length} items`);
    console.log(`[TEST] Con filtro: ${dataNew.length} items`);
    
    if (dataOld.length === dataNew.length) {
      console.log('✅ SEGURO: Ambos retornan la misma cantidad');
    } else {
      console.warn('⚠️ ATENCIÓN: Hay diferencia en resultados');
      console.warn('Esto significa que hay items con compania_id incorrecto');
    }
    
    // Retornar la versión con filtro (segura)
    return {
      success: true,
      data: dataNew,
      message: 'OK'
    };
  } catch (error) {
    throw new Error(`Error: ${error.message}`);
  }
}
```

**Ejecuta una exportación y revisa los logs.** Si dice "✅ SEGURO", puedes usar la versión nueva sin miedo.

---

## 🔄 PLAN B: Cómo Revertir (30 segundos)

Si por alguna razón algo sale mal, revierte fácilmente:

```javascript
// En src/services/conteo.service.js, línea ~829
// Simplemente quita esta línea:
.eq('compania_id', companiaId) // ← Comentar o eliminar

// Y queda como antes:
const { data, error } = await supabase
  .from('v_inventario_consolidado_completo')
  .select('item_sku, item_nombre, bodega, cantidad_total')
  .eq('bodega_id', bodegaId)
  // .eq('compania_id', companiaId) ← Comentada
  .eq('nivel', 'ubicacion');
```

---

## 📊 ANÁLISIS DE RIESGO

| Escenario | Riesgo | Impacto |
|-----------|--------|---------|
| **Datos bien configurados** (lo normal) | 🟢 NULO | Sin cambios, funciona igual |
| **Items con compania_id incorrecto** | 🟡 POSITIVO | Ahora SÍ filtra correctamente (mejora) |
| **Vista sin compania_id** | 🔴 ERROR | Error SQL (pero lo detectas inmediatamente) |

**Tu vista SÍ tiene `compania_id`** (lo verificamos), entonces estás en el escenario 🟢 o 🟡 (ambos buenos).

---

## ✅ RECOMENDACIÓN FINAL

**Opción A (Conservador):**
1. Hacer el test en SQL (Paso 1, 2, 3 arriba)
2. Si los counts son iguales → Aplicar el cambio con confianza
3. Monitorear primera exportación en producción

**Opción B (Confiado):**
- Aplicar directamente el cambio
- Es un filtro adicional de seguridad, no debería cambiar nada
- Si hay algún problema, lo notas inmediatamente y reviertes en 30 segundos

**Opción C (Cauteloso):**
- No aplicar el cambio ahora
- Esperar a que tengas tiempo para testing
- El sistema funciona sin esto, solo es un extra de seguridad

---

## 💡 MI RECOMENDACIÓN

**Haz el test SQL primero** (son 2 minutos). Si los resultados son idénticos, aplica el cambio. Es una mejora de seguridad que no afecta funcionamiento actual.

Si no tienes tiempo ahora, **no es urgente**. Tu sistema funciona bien sin esto. Es solo una protección adicional para el futuro.

**¿Quieres que te ayude a revertir los cambios por ahora?**
