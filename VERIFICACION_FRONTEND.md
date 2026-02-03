# ⚠️ Verificación Requerida en el Frontend

## Problema Detectado

El sistema de consolidación está **completamente implementado en el backend**, pero necesitas verificar que el **servicio frontend** esté enviando el parámetro `companiaId` correctamente.

---

## 🔍 ¿Qué verificar?

### Ubicación del archivo de servicio

Basado en el import en `HistorialConteos.jsx`:
```javascript
import { inventarioGeneralService as inventarioService } from '../../services/inventarioGeneralService';
```

El archivo debería estar en:
```
Backend-Inventarios-generales/services/inventarioGeneralService.js
```

---

## ✅ Verificación de los Métodos

Necesitas asegurarte de que estos **3 métodos** envíen el `companiaId` en el body:

### 1. cerrarPasillo

**Debe enviar:**
```javascript
cerrarPasillo: async (pasilloId, companiaId) => {
  const response = await axios.post(`${API_URL}/inventario/cerrar-pasillo`, {
    pasilloId,
    companiaId  // ⚠️ ESTE PARÁMETRO ES CRÍTICO
  });
  return response.data;
}
```

**El backend espera:**
```javascript
const { pasilloId, companiaId } = req.body;
```

---

### 2. cerrarZona

**Debe enviar:**
```javascript
cerrarZona: async (zonaId, companiaId) => {
  const response = await axios.post(`${API_URL}/inventario/cerrar-zona`, {
    zonaId,
    companiaId  // ⚠️ ESTE PARÁMETRO ES CRÍTICO
  });
  return response.data;
}
```

**El backend espera:**
```javascript
const { zonaId, companiaId } = req.body;
```

---

### 3. cerrarBodega

**Debe enviar:**
```javascript
cerrarBodega: async (bodegaId, companiaId) => {
  const response = await axios.post(`${API_URL}/inventario/cerrar-bodega`, {
    bodegaId,
    companiaId  // ⚠️ ESTE PARÁMETRO ES CRÍTICO
  });
  return response.data;
}
```

**El backend espera:**
```javascript
const { bodegaId, companiaId } = req.body;
```

---

## ✅ Verificación en HistorialConteos.jsx

En `HistorialConteos.jsx` línea 166-179, ya estás pasando ambos parámetros correctamente:

```javascript
const configs = {
  pasillo: {
    action: (id, cia) => inventarioService.cerrarPasillo(id, cia)  // ✅ Pasando companiaId
  },
  zona: {
    action: (id, cia) => inventarioService.cerrarZona(id, cia)     // ✅ Pasando companiaId
  },
  bodega: {
    action: (id, cia) => inventarioService.cerrarBodega(id, cia)   // ✅ Pasando companiaId
  }
};
```

Y se llama con `selectedCompany`:
```javascript
await config.action(id, selectedCompany);
```

**✅ El componente React está bien - pasa ambos parámetros correctamente.**

---

## ⚠️ Lo que DEBES hacer

### Paso 1: Localizar el archivo de servicio

1. Busca el archivo `inventarioGeneralService.js` en tu proyecto
2. Puede estar en una de estas ubicaciones:
   - `services/inventarioGeneralService.js`
   - `Inventario-General/services/inventarioGeneralService.js`
   - Otro directorio según la estructura de tu proyecto

### Paso 2: Verificar los métodos

Abre el archivo y busca estos 3 métodos:
- `cerrarPasillo`
- `cerrarZona`
- `cerrarBodega`

### Paso 3: Confirmar que envían companiaId

**SI ya lo envían:**
```javascript
cerrarPasillo: async (pasilloId, companiaId) => {
  return axios.post('/api/inventario/cerrar-pasillo', { pasilloId, companiaId });
}
```
✅ **NO NECESITAS HACER NADA** - El sistema funcionará automáticamente.

---

**SI NO lo envían (solo envían el ID):**
```javascript
// ❌ ESTO NO FUNCIONARÁ
cerrarPasillo: async (pasilloId) => {
  return axios.post('/api/inventario/cerrar-pasillo', { pasilloId });
}
```

**Debes modificarlos a:**
```javascript
// ✅ CORRECTO
cerrarPasillo: async (pasilloId, companiaId) => {
  return axios.post('/api/inventario/cerrar-pasillo', { pasilloId, companiaId });
}
```

---

## 🧪 Cómo probar que funciona

1. **Cierra un pasillo** desde HistorialConteos
2. **Revisa la consola del navegador** (F12):
   - Debería mostrar el POST a `/api/inventario/cerrar-pasillo`
   - El payload debe incluir: `{ pasilloId: "...", companiaId: "2" }`

3. **Revisa la consola del backend** (Node.js):
   - Debería mostrar: `[CONSOLIDACIÓN] Consolidando pasillo abc-123-...`
   - Seguido de: `[CONSOLIDACIÓN] Pasillo abc-123-... consolidado exitosamente`

4. **Verifica en Supabase**:
```sql
SELECT * FROM inv_general_inventario_consolidado
WHERE nivel = 'pasillo'
ORDER BY created_at DESC
LIMIT 5;
```

---

## 📝 Ejemplo completo del servicio (si necesitas crearlo)

Si el archivo no existe o está incompleto, aquí está el código completo:

```javascript
import axios from 'axios';

export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

export const inventarioGeneralService = {
  
  // ... otros métodos ...

  cerrarPasillo: async (pasilloId, companiaId) => {
    try {
      const response = await axios.post(`${API_URL}/inventario/cerrar-pasillo`, {
        pasilloId,
        companiaId
      });
      return response.data;
    } catch (error) {
      console.error('Error cerrando pasillo:', error);
      throw error;
    }
  },

  cerrarZona: async (zonaId, companiaId) => {
    try {
      const response = await axios.post(`${API_URL}/inventario/cerrar-zona`, {
        zonaId,
        companiaId
      });
      return response.data;
    } catch (error) {
      console.error('Error cerrando zona:', error);
      throw error;
    }
  },

  cerrarBodega: async (bodegaId, companiaId) => {
    try {
      const response = await axios.post(`${API_URL}/inventario/cerrar-bodega`, {
        bodegaId,
        companiaId
      });
      return response.data;
    } catch (error) {
      console.error('Error cerrando bodega:', error);
      throw error;
    }
  },

  obtenerEstadoJerarquia: async (bodega, companiaId) => {
    try {
      const response = await axios.get(`${API_URL}/inventario/estado-jerarquia`, {
        params: { bodega, companiaId }
      });
      return response.data?.data || null;
    } catch (error) {
      console.error('Error obteniendo jerarquía:', error);
      return null;
    }
  }
};
```

---

## 🎯 Resumen

### ¿Necesitas hacer algo en el frontend?

**Depende:**

✅ **SI** el servicio ya envía `companiaId` → **NO NECESITAS HACER NADA**

⚠️ **SI** el servicio NO envía `companiaId` → **Modificar los 3 métodos** (cerrarPasillo, cerrarZona, cerrarBodega)

---

## 🔍 Cómo saberlo

Ejecuta esto en la consola del navegador cuando estés en HistorialConteos:

```javascript
// Inspeccionar la firma del método
console.log(inventarioService.cerrarPasillo.toString());
```

Si muestra:
```javascript
async (pasilloId, companiaId) => { ... }
```
✅ **Está bien**

Si muestra:
```javascript
async (pasilloId) => { ... }
```
❌ **Necesitas agregarlo**

---

## 📞 Siguiente paso

1. **Encuentra** el archivo `inventarioGeneralService.js`
2. **Comparte** el contenido de los métodos cerrarPasillo, cerrarZona, cerrarBodega
3. **Te confirmo** si necesitas modificar algo o si ya funciona

**¿Necesitas que te ayude a buscarlo o modificarlo?**
