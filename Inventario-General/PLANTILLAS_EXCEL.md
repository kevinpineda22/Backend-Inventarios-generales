# 📄 Plantillas de Excel para Inventario General

## Formato de Archivo Excel para Carga Maestra

El archivo Excel debe contener **exactamente estas 3 columnas**:

### Columnas Requeridas

| Columna | Tipo | Descripción | Ejemplo |
|---------|------|-------------|---------|
| `item` | Texto | Código interno del item | PROD001, ART-123, SKU-456 |
| `descripcion` | Texto | Descripción completa del producto | Leche entera 1L Marca X |
| `codigo_barra` | Texto/Número | Código de barras del producto | 7891234567890 |

---

## 📥 Plantilla de Excel (Copiar a Excel)

### Plantilla Básica (10 items)

```
item	descripcion	codigo_barra
PROD001	Leche entera 1 litro	7891234567890
PROD002	Pan integral 500g	7891234567891
PROD003	Arroz blanco 1kg	7891234567892
PROD004	Aceite vegetal 900ml	7891234567893
PROD005	Azúcar refinada 1kg	7891234567894
PROD006	Sal de mesa 1kg	7891234567895
PROD007	Frijoles negros 500g	7891234567896
PROD008	Pasta spaguetti 500g	7891234567897
PROD009	Tomate en lata 400g	7891234567898
PROD010	Atún en lata 170g	7891234567899
```

### Plantilla Extendida (20 items - Supermercado)

```
item	descripcion	codigo_barra
ALM001	Leche entera 1L Colanta	7702001000001
ALM002	Leche deslactosada 1L Alpina	7702001000002
ALM003	Pan tajado integral 500g Bimbo	7702001000003
ALM004	Pan tajado blanco 500g Bimbo	7702001000004
ALM005	Arroz Diana 1kg	7702001000005
ALM006	Arroz Supremo 5kg	7702001000006
ALM007	Aceite Gourmet 900ml	7702001000007
ALM008	Aceite Girasol 3000ml	7702001000008
ALM009	Azúcar Manuelita 1kg	7702001000009
ALM010	Azúcar Incauca 5kg	7702001000010
BEB001	Coca Cola 2L	7702001000011
BEB002	Coca Cola Zero 2L	7702001000012
BEB003	Jugo Hit Mora 1L	7702001000013
BEB004	Jugo Hit Mango 1L	7702001000014
BEB005	Agua Cristal 600ml	7702001000015
ASE001	Jabón Protex 110g	7702001000016
ASE002	Shampoo Head & Shoulders 400ml	7702001000017
ASE003	Crema dental Colgate 150ml	7702001000018
ASE004	Papel higiénico Familia 4 rollos	7702001000019
ASE005	Detergente Ariel 1kg	7702001000020
```

### Plantilla para Ferretería (15 items)

```
item	descripcion	codigo_barra
FER001	Tornillo 1/4 x 1 pulg acero	7702002000001
FER002	Tornillo 3/8 x 2 pulg acero	7702002000002
FER003	Tuerca 1/4 hexagonal	7702002000003
FER004	Tuerca 3/8 hexagonal	7702002000004
FER005	Cable eléctrico 12 AWG x metro	7702002000005
FER006	Cable eléctrico 14 AWG x metro	7702002000006
FER007	Interruptor simple 15A	7702002000007
FER008	Interruptor doble 15A	7702002000008
FER009	Toma corriente 15A	7702002000009
FER010	Cinta aislante negra 3M	7702002000010
FER011	Silicona transparente 300ml	7702002000011
FER012	Llave de paso 1/2 pulg	7702002000012
FER013	Codo PVC 1/2 pulg 90°	7702002000013
FER014	Tee PVC 1/2 pulg	7702002000014
FER015	Cemento gris 1kg	7702002000015
```

---

## 🎯 Instrucciones para Crear el Archivo Excel

### Método 1: Copiar y Pegar

1. Abre Microsoft Excel o Google Sheets
2. Copia una de las plantillas de arriba (con las pestañas)
3. Pégala en la hoja de cálculo
4. Asegúrate que se separe en 3 columnas
5. Guarda como `.xlsx`

### Método 2: Crear Manualmente

1. Abre Excel
2. En la fila 1, escribe los encabezados:
   - Celda A1: `item`
   - Celda B1: `descripcion`
   - Celda C1: `codigo_barra`
3. Llena los datos desde la fila 2 en adelante
4. Guarda como `.xlsx`

---

## ✅ Validaciones del Sistema

El sistema validará automáticamente:

- ✔️ Que el archivo sea `.xlsx` o `.xls`
- ✔️ Que existan las 3 columnas requeridas
- ✔️ Que no haya filas vacías en las columnas
- ✔️ Que se haya seleccionado una compañía

---

## 📊 Ejemplo Visual de Estructura

```
┌──────────┬────────────────────────────┬──────────────────┐
│  item    │  descripcion               │  codigo_barra    │
├──────────┼────────────────────────────┼──────────────────┤
│ PROD001  │ Leche entera 1L            │ 7891234567890    │
│ PROD002  │ Pan integral 500g          │ 7891234567891    │
│ PROD003  │ Arroz blanco 1kg           │ 7891234567892    │
│ ...      │ ...                        │ ...              │
└──────────┴────────────────────────────┴──────────────────┘
```

---

## 🔢 Tipos de Códigos de Barra Soportados

El sistema soporta cualquier tipo de código de barra:

- **EAN-13** (13 dígitos): `7891234567890`
- **EAN-8** (8 dígitos): `12345678`
- **UPC-A** (12 dígitos): `123456789012`
- **Code 39**: `ABC-123`
- **Code 128**: `ITEM-001-XYZ`
- **Códigos Personalizados**: Cualquier alfanumérico

---

## 💡 Tips y Recomendaciones

### ✨ Buenas Prácticas

1. **Códigos de Item Únicos**: Usa un formato consistente (ej: `PROD001`, `PROD002`)
2. **Descripciones Claras**: Incluye marca, tamaño y características
3. **Códigos de Barra Sin Espacios**: Evita espacios en blanco
4. **Sin Caracteres Especiales**: Evita `#`, `@`, `%` en códigos de item
5. **Capitalización Consistente**: Decide si usas mayúsculas o minúsculas

### ⚠️ Errores Comunes a Evitar

- ❌ Cambiar los nombres de las columnas
- ❌ Dejar celdas vacías en columnas obligatorias
- ❌ Usar caracteres especiales en códigos de barra
- ❌ Duplicar códigos de barra en el mismo archivo
- ❌ Guardar en formato `.csv` (usar `.xlsx`)

### 🔄 Actualizaciones de Items

Si necesitas actualizar items existentes:

1. La combinación `codigo_barra` + `compania_id` es única
2. Si subes un código de barra que ya existe, puede haber error
3. Recomendación: Elimina y vuelve a cargar, o actualiza manualmente en Supabase

---

## 📋 Checklist Pre-Carga

Antes de cargar tu archivo Excel, verifica:

- [ ] Archivo guardado como `.xlsx`
- [ ] Columnas: `item`, `descripcion`, `codigo_barra`
- [ ] No hay filas vacías
- [ ] Códigos de barra sin espacios
- [ ] Descripciones completas y claras
- [ ] Códigos de item únicos
- [ ] Has seleccionado la compañía correcta

---

## 🎓 Ejemplo de Flujo Completo

### Escenario: Ferretería "La Construcción"

1. **Preparar Excel**:
   - Usar plantilla de ferretería
   - Agregar 100 productos
   - Revisar que todos tengan código de barra

2. **Cargar en el Sistema**:
   - Admin → Carga Maestra
   - Seleccionar: "Makro Colombia"
   - Subir archivo: `items_ferreteria.xlsx`
   - Ver mensaje: "Se cargaron exitosamente 100 items"

3. **Verificar en Supabase**:
   - Table Editor → `inv_general_items`
   - Filtrar por `compania_id = 1`
   - Confirmar 100 registros insertados

4. **Usar en Conteos**:
   - Los empleados pueden escanear estos códigos
   - El sistema los encontrará automáticamente
   - Aparecerán con su descripción completa

---

## 📥 Descargar Plantilla Lista para Usar

No puedes descargar desde aquí, pero puedes:

1. Copiar una plantilla de arriba
2. Pegarla en Excel
3. Modificar según tus productos
4. Guardar como `.xlsx`

O crear tu propia plantilla desde cero siguiendo la estructura.

---

## 🆘 Soporte

Si tienes problemas con el formato del Excel:

1. Verifica que las columnas estén exactas
2. Asegúrate de guardar en formato `.xlsx`
3. Prueba con una plantilla pequeña primero (5-10 items)
4. Revisa la consola del navegador para errores específicos

---

## ✅ Validación Exitosa

Sabrás que tu Excel está correcto cuando:

- ✅ Se muestra una vista previa de los datos
- ✅ El botón "Cargar Datos" está habilitado
- ✅ Después de cargar, ves mensaje de éxito verde
- ✅ Los items aparecen en la base de datos de Supabase

---

**¡Tu archivo Excel está listo para cargar en el sistema!** 🎉
