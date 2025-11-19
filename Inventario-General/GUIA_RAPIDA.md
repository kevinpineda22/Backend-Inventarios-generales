# 🚀 Guía Rápida de Implementación - Inventario General

## ✅ Pasos para Poner en Funcionamiento

### 📋 Checklist de Implementación

- [ ] Paso 1: Configurar Base de Datos
- [ ] Paso 2: Verificar Dependencias
- [ ] Paso 3: Configurar Rutas
- [ ] Paso 4: Probar Sistema

---

## 🗄️ PASO 1: Configurar Base de Datos en Supabase

### 1.1 Acceder a Supabase
1. Ve a https://supabase.com
2. Accede a tu proyecto
3. Navega a **SQL Editor** en el menú lateral

### 1.2 Ejecutar Script SQL
1. Copia todo el contenido del archivo `setup_database.sql`
2. Pégalo en el SQL Editor
3. Haz clic en **"Run"** para ejecutar
4. Espera a que se complete (verás un mensaje de éxito)

### 1.3 Verificar Creación
1. Ve a **Table Editor**
2. Deberías ver 7 nuevas tablas que empiezan con `inv_general_`:
   - ✅ `inv_general_items`
   - ✅ `inv_general_bodegas`
   - ✅ `inv_general_zonas`
   - ✅ `inv_general_pasillos`
   - ✅ `inv_general_ubicaciones`
   - ✅ `inv_general_conteos`
   - ✅ `inv_general_conteo_items`

---

## 📦 PASO 2: Verificar Dependencias

La librería `xlsx` ya está instalada en tu proyecto ✅

Si necesitas reinstalar dependencias:
```bash
npm install
```

---

## 🛣️ PASO 3: Configurar Rutas en tu Aplicación

### 3.1 Para Panel de Administrador

Abre tu archivo de rutas (probablemente en `src/routes/` o `src/data/masterRoutes.js`) y agrega:

```javascript
import { AdminInventarioGeneral } from '../Inventario-General';

// En tu configuración de rutas, agrega:
{
  path: '/inventario-general/admin',
  element: <AdminInventarioGeneral />,
  // Configura permisos según tu sistema
}
```

### 3.2 Para Panel de Empleado

```javascript
import { EmpleadoInventarioGeneral } from '../Inventario-General';

// En tu configuración de rutas, agrega:
{
  path: '/inventario-general/empleado',
  element: <EmpleadoInventarioGeneral 
    usuarioId={usuarioActual.id}
    usuarioNombre={usuarioActual.nombre}
  />,
  // Configura permisos según tu sistema
}
```

### 3.3 Ejemplo Completo con React Router

```javascript
import { 
  AdminInventarioGeneral, 
  EmpleadoInventarioGeneral 
} from '../Inventario-General';

const routes = [
  // ... tus rutas existentes
  {
    path: '/inventario-general',
    children: [
      {
        path: 'admin',
        element: <AdminInventarioGeneral />
      },
      {
        path: 'empleado',
        element: <EmpleadoInventarioGeneral 
          usuarioId={usuarioId}
          usuarioNombre={usuarioNombre}
        />
      }
    ]
  }
];
```

---

## 🧪 PASO 4: Probar el Sistema

### 4.1 Prueba del Panel Admin

1. **Accede al Panel Admin**
   ```
   http://localhost:5173/inventario-general/admin
   ```

2. **Prueba la Carga Maestra**
   - Ve a la pestaña "Carga Maestra"
   - Selecciona "Makro Colombia" (o cualquier compañía)
   - Descarga este Excel de ejemplo y súbelo:

   | item | descripcion | codigo_barra |
   |------|-------------|--------------|
   | ITEM001 | Producto Test 1 | 1234567890123 |
   | ITEM002 | Producto Test 2 | 1234567890124 |
   | ITEM003 | Producto Test 3 | 1234567890125 |

   - Haz clic en "Cargar Datos a la Base de Datos"
   - Deberías ver el mensaje de éxito ✅

3. **Prueba la Creación de Inventario**
   - Ve a "Creación de Inventario"
   - Crea una bodega: "Bodega Principal"
   - Para esa bodega, crea una zona: "Zona A"
   - Para esa zona, crea un pasillo: "1"
   - Para ese pasillo, crea ubicaciones: "1", "2", "3"
   - Observa la clave generada automáticamente para cada ubicación

4. **Verifica la Estructura**
   - Deberías ver un árbol visual con tu estructura
   - Anota la clave de una ubicación (ej: "A3B5C7D2")

### 4.2 Prueba del Panel Empleado

1. **Accede al Panel Empleado**
   ```
   http://localhost:5173/inventario-general/empleado
   ```

2. **Selecciona la Estructura**
   - Compañía: "Makro Colombia"
   - Bodega: "Bodega Principal"
   - Zona: "Zona A"
   - Pasillo: "1"
   - Ubicación: Haz clic en "#1"

3. **Inicia el Conteo**
   - Ingresa la clave que anotaste (ej: "A3B5C7D2")
   - Haz clic en "Iniciar Conteo"

4. **Escanea Items**
   - Ingresa código de barra: `1234567890123`
   - Cantidad: `5`
   - Haz clic en "Agregar" o presiona Enter
   - Repite con los otros códigos de barra

5. **Finaliza el Conteo**
   - Haz clic en "Finalizar Conteo y Cerrar Ubicación"
   - Deberías volver a la selección de ubicaciones

### 4.3 Prueba el Historial (Admin)

1. **Vuelve al Panel Admin**
2. **Ve a "Historial de Conteos"**
3. **Selecciona la compañía**
4. **Deberías ver**:
   - El conteo que acabas de hacer
   - Tipo: "Conteo #1"
   - Estado: "Finalizado"
   - Número de items contados

5. **Prueba las Acciones**:
   - Haz clic en "✓ Aprobar" (cambiará a estado Aprobado)
   - Haz clic en "📥 Descargar" (descargará un Excel)

---

## 🔄 Flujo Completo de Prueba

### Escenario: Conteo Completo con 3 Tipos

1. **Admin: Preparación**
   - Cargar items desde Excel
   - Crear: Bodega → Zona → Pasillo → Ubicación

2. **Empleado: Conteo #1**
   - Seleccionar ubicación
   - Ingresar clave
   - Escanear items con cantidades
   - Finalizar

3. **Empleado: Conteo #2**
   - Seleccionar la misma ubicación
   - Ingresar clave
   - Escanear items (cantidades diferentes a propósito)
   - Finalizar

4. **Empleado: Conteo de Diferencias**
   - Se habilitará automáticamente
   - El sistema mostrará items con diferencias
   - Recontar solo esos items
   - Finalizar

5. **Admin: Aprobación**
   - Ver los 3 conteos en el historial
   - Aprobar o rechazar según sea necesario
   - Descargar reportes en Excel

---

## 🐛 Solución Rápida de Problemas

### ❌ Error: "Network Error" o "Failed to fetch"

**Causa**: Problema de conexión con Supabase

**Solución**:
1. Verifica tu archivo `.env`:
   ```
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-anon-key
   ```
2. Verifica que las variables estén correctas
3. Reinicia el servidor: `npm run dev`

---

### ❌ Error: "relation inv_general_items does not exist"

**Causa**: Las tablas no se crearon en Supabase

**Solución**:
1. Ve a Supabase SQL Editor
2. Ejecuta el script `setup_database.sql` completo
3. Verifica en Table Editor que las tablas existan

---

### ❌ Error: "Item no encontrado en la base de datos"

**Causa**: No se cargaron items desde el Excel

**Solución**:
1. Ve a Panel Admin → Carga Maestra
2. Sube un archivo Excel con items
3. Verifica en Supabase Table Editor que los items se insertaron

---

### ❌ Error: "Clave incorrecta"

**Causa**: La clave ingresada no coincide

**Solución**:
1. Ve a Supabase Table Editor
2. Abre la tabla `inv_general_ubicaciones`
3. Busca tu ubicación y copia la clave exacta
4. Ingrésala en el panel de empleado (respeta mayúsculas)

---

### ❌ No se muestra nada en "Creación de Inventario"

**Causa**: No seleccionaste una compañía

**Solución**:
1. Selecciona una compañía del dropdown
2. Si no hay, modifica el array `companies` en el componente

---

## 📞 Obtener Más Ayuda

Si después de seguir esta guía sigues teniendo problemas:

1. Revisa el archivo `README.md` para más detalles
2. Revisa el archivo `DATABASE_SCHEMA.md` para la estructura de BD
3. Abre la consola del navegador (F12) para ver errores específicos
4. Verifica los logs de Supabase en la sección "Logs"

---

## ✨ ¡Sistema Listo!

Si completaste todos los pasos sin errores, tu sistema de Inventario General está funcionando correctamente.

**Próximos Pasos Sugeridos**:
- Configura los roles y permisos según tu sistema de autenticación
- Personaliza las compañías en el array `companies`
- Ajusta los estilos CSS según tu marca
- Agrega validaciones adicionales si lo necesitas
- Configura notificaciones para aprobaciones

---

## 📊 Resumen de Archivos Creados

```
src/Inventario-General/
├── Admin/
│   ├── AdminInventarioGeneral.jsx ✅
│   ├── AdminInventarioGeneral.css ✅
│   ├── CargaMaestraExcel.jsx ✅
│   ├── CargaMaestraExcel.css ✅
│   ├── CreacionInventario.jsx ✅
│   ├── CreacionInventario.css ✅
│   ├── HistorialConteos.jsx ✅
│   └── HistorialConteos.css ✅
├── Empleado/
│   ├── EmpleadoInventarioGeneral.jsx ✅
│   ├── EmpleadoInventarioGeneral.css ✅
│   ├── ConteoPorUbicacion.jsx ✅
│   └── ConteoPorUbicacion.css ✅
├── DATABASE_SCHEMA.md ✅
├── README.md ✅
├── GUIA_RAPIDA.md ✅ (este archivo)
├── setup_database.sql ✅
└── index.js ✅

src/services/
└── inventarioGeneralService.js ✅
```

**Total: 18 archivos creados** 🎉
