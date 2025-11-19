# 📦 Sistema de Inventario General

Sistema completo de gestión de inventarios con roles de Administrador y Empleado, diseñado para funcionar con múltiples compañías.

---

## 🌟 Características Principales

### Rol Administrador
- **Carga Maestra de Items**: Importar items desde Excel
- **Creación de Estructura**: Crear jerarquía Bodega → Zona → Pasillo → Ubicaciones
- **Historial de Conteos**: Revisar, aprobar/rechazar y descargar conteos
- **Multi-compañía**: Soporte para diferentes compañías

### Rol Empleado
- **Selección de Ubicación**: Navegar por la estructura creada
- **Sistema de Conteos**: 3 tipos de conteo (Conteo #1, #2 y Diferencias)
- **Escaneo de Items**: Ingreso por código de barras
- **Control por Clave**: Seguridad mediante claves por ubicación

---

## 📁 Estructura de Archivos Creados

```
src/
├── Inventario-General/
│   ├── Admin/
│   │   ├── AdminInventarioGeneral.jsx        # Componente principal admin
│   │   ├── AdminInventarioGeneral.css
│   │   ├── CargaMaestraExcel.jsx              # Carga de Excel
│   │   ├── CargaMaestraExcel.css
│   │   ├── CreacionInventario.jsx             # Crear estructura
│   │   ├── CreacionInventario.css
│   │   ├── HistorialConteos.jsx               # Historial y aprobaciones
│   │   └── HistorialConteos.css
│   ├── Empleado/
│   │   ├── EmpleadoInventarioGeneral.jsx      # Panel empleado
│   │   ├── EmpleadoInventarioGeneral.css
│   │   ├── ConteoPorUbicacion.jsx             # Realizar conteos
│   │   └── ConteoPorUbicacion.css
│   ├── DATABASE_SCHEMA.md                     # Esquema de base de datos
│   └── README.md                              # Este archivo
├── services/
│   └── inventarioGeneralService.js            # Servicio backend
```

---

## 🚀 Instalación y Configuración

### 1. Instalar Dependencias

Asegúrate de tener instalada la librería para leer Excel:

```bash
npm install xlsx
```

### 2. Configurar Base de Datos en Supabase

Sigue las instrucciones en `DATABASE_SCHEMA.md` para:
- Crear todas las tablas necesarias
- Configurar índices
- Crear funciones
- Configurar Row Level Security (RLS)

### 3. Importar Componentes en tu Aplicación

#### Para el Panel de Admin:

```jsx
import AdminInventarioGeneral from './Inventario-General/Admin/AdminInventarioGeneral';

function App() {
  return (
    <div>
      <AdminInventarioGeneral />
    </div>
  );
}
```

#### Para el Panel de Empleado:

```jsx
import EmpleadoInventarioGeneral from './Inventario-General/Empleado/EmpleadoInventarioGeneral';

function App() {
  const usuarioId = "uuid-del-usuario";
  const usuarioNombre = "Juan Pérez";
  
  return (
    <div>
      <EmpleadoInventarioGeneral 
        usuarioId={usuarioId}
        usuarioNombre={usuarioNombre}
      />
    </div>
  );
}
```

---

## 📖 Guía de Uso

### Flujo de Trabajo Completo

#### Paso 1: Configuración Inicial (Admin)

1. **Cargar Items desde Excel**
   - Ir a la pestaña "Carga Maestra"
   - Seleccionar la compañía
   - Subir archivo Excel con columnas: `item`, `descripcion`, `codigo_barra`
   - El sistema carga los items a la base de datos

2. **Crear Estructura de Inventario**
   - Ir a "Creación de Inventario"
   - Crear Bodegas
   - Para cada bodega, crear Zonas
   - Para cada zona, crear Pasillos
   - Para cada pasillo, crear Ubicaciones (se genera clave automáticamente)

#### Paso 2: Conteo por Empleado

3. **Primer Conteo (Conteo #1)**
   - Seleccionar compañía
   - Seleccionar: Bodega → Zona → Pasillo → Ubicación
   - Ingresar la clave de la ubicación
   - Escanear o ingresar códigos de barra
   - Ingresar cantidades
   - Finalizar y cerrar ubicación

4. **Segundo Conteo (Conteo #2)**
   - La ubicación ahora permite Conteo #2
   - Repetir el proceso de conteo
   - Finalizar y cerrar

5. **Conteo de Diferencias**
   - Si hay diferencias entre Conteo #1 y #2, se habilita
   - El sistema muestra qué items tienen diferencias
   - Recontar solo esos items
   - Finalizar

#### Paso 3: Revisión y Aprobación (Admin)

6. **Historial de Conteos**
   - Ir a "Historial de Conteos"
   - Ver todos los conteos realizados
   - Filtrar por bodega, zona, pasillo, tipo
   - Aprobar o rechazar conteos
   - Descargar en Excel

---

## 🔑 Conceptos Clave

### Jerarquía de Ubicaciones
```
Bodega
  └── Zona
       └── Pasillo
            └── Ubicación (con clave)
```

### Tipos de Conteo

| Tipo | Nombre | Descripción |
|------|--------|-------------|
| 1 | Conteo #1 | Primer conteo inicial de la ubicación |
| 2 | Conteo #2 | Segundo conteo para verificación |
| 3 | Conteo Diferencias | Reconteo de items con diferencias |

### Estados de Conteo

| Estado | Descripción |
|--------|-------------|
| `en_progreso` | Conteo activo |
| `finalizado` | Conteo completado por empleado |
| `pendiente` | Esperando revisión |
| `aprobado` | Aprobado por admin |
| `rechazado` | Rechazado por admin |

---

## 🎨 Características Visuales

- **Interfaz intuitiva** con navegación por pestañas
- **Colores diferenciados** por nivel de jerarquía
- **Vista de árbol** para estructura de inventario
- **Tabla responsive** para historial
- **Badges de estado** para identificar conteos rápidamente
- **Mensajes de confirmación** para acciones importantes

---

## 📊 Formato del Archivo Excel

El archivo Excel para carga maestra debe tener estas columnas:

| Columna | Tipo | Descripción | Ejemplo |
|---------|------|-------------|---------|
| `item` | Texto | Código del item | "ITEM001" |
| `descripcion` | Texto | Descripción del producto | "Leche entera 1L" |
| `codigo_barra` | Texto | Código de barras | "7891234567890" |

**Ejemplo de archivo Excel:**

| item | descripcion | codigo_barra |
|------|-------------|--------------|
| ITEM001 | Leche entera 1L | 7891234567890 |
| ITEM002 | Pan integral 500g | 7891234567891 |
| ITEM003 | Arroz blanco 1kg | 7891234567892 |

---

## 🛡️ Seguridad

- **Claves por ubicación**: Cada ubicación tiene una clave única
- **Row Level Security**: Configurado en Supabase
- **Validaciones**: Control de datos en frontend y backend
- **Autenticación**: Integrado con sistema de usuarios

---

## 🔧 Configuración Avanzada

### Modificar Lista de Compañías

En cada componente, encontrarás este array:

```jsx
const companies = [
  { id: '1', nombre: 'Makro Colombia' },
  { id: '2', nombre: 'Makro Perú' },
  { id: '3', nombre: 'Makro Chile' },
];
```

Modifica este array según tus compañías.

### Personalizar Estados

En `inventarioGeneralService.js` puedes modificar la lógica de estados según necesites.

---

## 📱 Responsive Design

El sistema está diseñado para funcionar en:
- 💻 Escritorio
- 📱 Tablets
- 📱 Dispositivos móviles (para empleados en campo)

---

## 🐛 Solución de Problemas

### Error: "Item no encontrado en la base de datos"
- Verifica que hayas cargado el archivo Excel primero
- Confirma que el código de barra existe en la tabla `inv_general_items`

### Error: "Clave incorrecta"
- Verifica la clave en la base de datos (tabla `inv_general_ubicaciones`)
- Las claves se generan automáticamente al crear ubicaciones

### No se muestra la estructura
- Confirma que seleccionaste una compañía
- Verifica que hayas creado bodegas para esa compañía

---

## 📈 Próximas Mejoras Sugeridas

- [ ] Reportes estadísticos de inventario
- [ ] Exportación a PDF
- [ ] Notificaciones push para aprobaciones
- [ ] Búsqueda avanzada de items
- [ ] Historial de cambios por item
- [ ] Dashboard con gráficas
- [ ] Modo offline para empleados
- [ ] Escaneo con cámara (QR/Barcode)

---

## 📞 Contacto y Soporte

Para preguntas o soporte sobre este sistema, contacta al equipo de desarrollo.

---

## 📄 Licencia

Este sistema fue desarrollado para uso interno de la compañía.
