# Guía de Consolidación de Inventario

## ✅ Implementación Completada - Opción 1

Se ha implementado el sistema de consolidación de inventario que captura automáticamente los totales cuando se cierra un **pasillo**, **zona** o **bodega**.

---

## 📋 ¿Qué hace la consolidación?

Cuando cierras un pasillo/zona/bodega, el sistema automáticamente:

1. **Calcula** los totales de inventario en ese momento
2. **Guarda** una fotografía (snapshot) en `inv_general_inventario_consolidado`
3. **Aplica lógica de consenso** para determinar la cantidad final:
   - **C4 (Ajuste Final)** → Tiene prioridad máxima
   - **C3 (Reconteo)** → Segunda prioridad
   - **C1 = C2** → Consenso entre primer y segundo conteo
   - **C2** → Si no hay consenso, usa el segundo conteo
   - **C1** → Si solo existe primer conteo

4. **Suma jerárquicamente**:
   - **Ubicación**: Suma todos los conteos de esa ubicación por item
   - **Pasillo**: Suma todas las ubicaciones cerradas del pasillo
   - **Zona**: Suma todos los pasillos cerrados de la zona
   - **Bodega**: Suma todas las zonas cerradas de la bodega

---

## 🔍 Cómo verificar que funciona

### 1. Antes de cerrar un pasillo

Anota el pasillo que vas a cerrar. Por ejemplo: **Pasillo 1 de Zona A**.

### 2. Cierra el pasillo desde el frontend

Ve a **HistorialConteos** y cierra el pasillo normalmente.

### 3. Verifica en la base de datos

Ejecuta esta consulta en Supabase:

```sql
SELECT 
  ic.*,
  i.nombre as producto,
  i.item_code,
  p.numero as pasillo_numero,
  z.nombre as zona_nombre,
  b.nombre as bodega_nombre
FROM inv_general_inventario_consolidado ic
LEFT JOIN inv_general_items i ON ic.item_id = i.id
LEFT JOIN inv_general_pasillos p ON ic.pasillo_id = p.id
LEFT JOIN inv_general_zonas z ON ic.zona_id = z.id
LEFT JOIN inv_general_bodegas b ON ic.bodega_id = b.id
WHERE ic.nivel = 'pasillo'
ORDER BY ic.created_at DESC
LIMIT 20;
```

**Deberías ver:**
- Registros nuevos con `nivel = 'pasillo'`
- `cantidad_total` con el total calculado de cada producto
- `pasillo_id` del pasillo que cerraste
- `zona_id`, `bodega_id` llenos (herencia jerárquica)
- `created_at` con la fecha actual

---

## 📊 Consultas útiles

### Ver consolidación de todos los niveles

```sql
SELECT 
  nivel,
  COUNT(*) as registros,
  SUM(cantidad_total) as total_unidades
FROM inv_general_inventario_consolidado
GROUP BY nivel
ORDER BY 
  CASE 
    WHEN nivel = 'ubicacion' THEN 1
    WHEN nivel = 'pasillo' THEN 2
    WHEN nivel = 'zona' THEN 3
    WHEN nivel = 'bodega' THEN 4
  END;
```

### Ver consolidación de un pasillo específico

```sql
SELECT 
  ic.*,
  i.nombre as producto,
  i.item_code
FROM inv_general_inventario_consolidado ic
LEFT JOIN inv_general_items i ON ic.item_id = i.id
WHERE ic.nivel = 'pasillo'
  AND ic.pasillo_id = 'ID_DEL_PASILLO'
ORDER BY ic.cantidad_total DESC;
```

### Ver consolidación de una zona específica

```sql
SELECT 
  ic.*,
  i.nombre as producto,
  i.item_code
FROM inv_general_inventario_consolidado ic
LEFT JOIN inv_general_items i ON ic.item_id = i.id
WHERE ic.nivel = 'zona'
  AND ic.zona_id = 'ID_DE_LA_ZONA'
ORDER BY ic.cantidad_total DESC;
```

### Ver consolidación de bodega completa

```sql
SELECT 
  ic.*,
  i.nombre as producto,
  i.item_code,
  b.nombre as bodega
FROM inv_general_inventario_consolidado ic
LEFT JOIN inv_general_items i ON ic.item_id = i.id
LEFT JOIN inv_general_bodegas b ON ic.bodega_id = b.id
WHERE ic.nivel = 'bodega'
  AND ic.bodega_id = 'ID_DE_LA_BODEGA'
ORDER BY ic.cantidad_total DESC;
```

---

## 🔧 Logs del sistema

Cuando cierres un pasillo/zona/bodega, verás en la consola del backend:

```
[CONSOLIDACIÓN] Consolidando pasillo abc123-def456-...
[CONSOLIDACIÓN] Pasillo abc123-def456-... consolidado exitosamente
```

Si hay un error:
```
[ERROR CONSOLIDACIÓN] Error al consolidar pasillo abc123-def456-...: [detalles del error]
```

**Nota importante:** Si falla la consolidación, el cierre del pasillo/zona/bodega **sí se realiza**. La consolidación es un proceso adicional que no bloquea las operaciones principales.

---

## 🚀 Beneficios

1. **Performance mejorada**: Los reportes consultan `inv_general_inventario_consolidado` en lugar de recalcular millones de registros
2. **Auditoría completa**: Tienes snapshots exactos de cada momento de cierre
3. **Trazabilidad**: Sabes exactamente qué cantidad había cuando se cerró cada nivel
4. **Escalabilidad**: La tabla consolidada crece linealmente, no exponencialmente

---

## ⚠️ Importante

- ✅ **Solo aplica a cierres nuevos** (a partir de ahora)
- ❌ **NO consolida inventarios históricos** (opción 1 elegida)
- ✅ **No afecta el funcionamiento actual** del sistema
- ✅ **Es transparente** para el usuario final

---

## 🔄 Si necesitas consolidar datos históricos (Opcional)

En el futuro, si decides consolidar datos históricos, podrías ejecutar:

```sql
-- ADVERTENCIA: Esto puede tardar mucho tiempo en bodegas grandes
-- Ejecutar en horarios de bajo tráfico

SELECT consolidar_inventarios_historicos('ID_DE_LA_BODEGA');
```

*Nota: Esta función aún no está implementada. Se implementaría como Opción 2 si lo necesitas.*

---

## 📞 Soporte

Si encuentras algún problema:

1. Revisa los logs del backend buscando `[CONSOLIDACIÓN]` o `[ERROR CONSOLIDACIÓN]`
2. Verifica que la tabla `inv_general_inventario_consolidado` existe
3. Confirma que los campos `companiaId` están siendo enviados desde el frontend

---

## 🎯 Próximos pasos

1. **Prueba cerrando un pasillo pequeño** para validar
2. **Verifica los datos consolidados** con las consultas de arriba
3. **Modifica tus reportes** para usar `inv_general_inventario_consolidado` cuando esté disponible
4. **Monitorea el crecimiento** de la tabla para planificar particionado futuro si es necesario
