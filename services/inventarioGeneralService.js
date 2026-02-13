const API_URL = (typeof process !== 'undefined' && process.env.REACT_APP_API_URL) 
  || (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
  || "https://backend-inventarios-generales.vercel.app/api";

export { API_URL };

const inventarioGeneralService = {
  // =====================================================
  // MÉTODOS DE ESTRUCTURA (CREACIÓN Y GESTIÓN)
  // =====================================================
  
  crearBodega: async (data) => {
    const response = await fetch(`${API_URL}/estructura/bodega`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al crear bodega");
    }
    return response.json();
  },

  crearZona: async (data) => {
    const response = await fetch(`${API_URL}/estructura/zona`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al crear zona");
    }
    return response.json();
  },

  crearPasillo: async (data) => {
    const response = await fetch(`${API_URL}/estructura/pasillo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al crear pasillo");
    }
    return response.json();
  },

  crearUbicacion: async (data) => {
    const response = await fetch(`${API_URL}/estructura/ubicacion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al crear ubicación");
    }
    return response.json();
  },

  crearUbicacionesBatch: async (ubicaciones) => {
    const response = await fetch(`${API_URL}/estructura/ubicaciones-multiple`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ubicaciones }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al crear ubicaciones por lote");
    }
    return response.json();
  },

  // Métodos de actualización y eliminación (Legacy/Admin)
  actualizarBodega: async (id, datos) => {
    const response = await fetch(`${API_URL}/estructura/bodega/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
    if (!response.ok) throw new Error("Error al actualizar bodega");
    return await response.json();
  },

  eliminarBodega: async (id) => {
    const response = await fetch(`${API_URL}/estructura/bodega/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Error al eliminar bodega");
    return await response.json();
  },

  actualizarZona: async (id, datos) => {
    const response = await fetch(`${API_URL}/estructura/zona/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
    if (!response.ok) throw new Error("Error al actualizar zona");
    return await response.json();
  },

  eliminarZona: async (id) => {
    const response = await fetch(`${API_URL}/estructura/zona/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Error al eliminar zona");
    return await response.json();
  },

  actualizarPasillo: async (id, datos) => {
    const response = await fetch(`${API_URL}/estructura/pasillo/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
    if (!response.ok) throw new Error("Error al actualizar pasillo");
    return await response.json();
  },

  eliminarPasillo: async (id) => {
    const response = await fetch(`${API_URL}/estructura/pasillo/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Error al eliminar pasillo");
    return await response.json();
  },

  eliminarUbicacion: async (id) => {
    const response = await fetch(`${API_URL}/estructura/ubicacion/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Error al eliminar ubicación");
    return await response.json();
  },

  eliminarUbicacionesBatch: async (ids) => {
    const response = await fetch(`${API_URL}/estructura/ubicaciones-multiple`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!response.ok) throw new Error("Error al eliminar ubicaciones");
    return await response.json();
  },

  // =====================================================
  // MÉTODOS DE CONSULTA DE ESTRUCTURA
  // =====================================================

  obtenerEstructura: async (companiaId) => {
    const response = await fetch(`${API_URL}/estructura/${companiaId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al obtener la estructura");
    }
    return response.json();
  },

  // Alias para compatibilidad
  obtenerEstructuraInventario: async (companiaId) => {
    return inventarioGeneralService.obtenerEstructura(companiaId);
  },

  obtenerBodegas: async (companiaId) => {
    const response = await fetch(
      `${API_URL}/estructura/navegacion?companiaId=${companiaId}`
    );
    if (!response.ok) throw new Error("Error al obtener bodegas");
    const data = await response.json();
    return data.data.bodegas || [];
  },

  obtenerGrupos: async (companiaId) => {
    const response = await fetch(`${API_URL}/items/grupos/${companiaId}`);
    if (!response.ok) throw new Error("Error al obtener grupos");
    const data = await response.json();
    return data.data || [];
  },

  obtenerNavegacion: async (params) => {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`${API_URL}/estructura/navegacion?${query}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al obtener navegación");
    }
    return response.json();
  },

  obtenerEstadoUbicacion: async (ubicacionId) => {
    const response = await fetch(`${API_URL}/ubicaciones/${ubicacionId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al obtener estado de ubicación");
    }
    const data = await response.json();
    return data.data;
  },

  // =====================================================
  // MÉTODOS DE CONTEO (OPERATIVO)
  // =====================================================

  iniciarConteo: async (data) => {
    const response = await fetch(`${API_URL}/conteos/iniciar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al iniciar conteo");
    }
    return response.json();
  },

  registrarConteoItem: async (conteoId, data) => {
    const response = await fetch(`${API_URL}/conteos/${conteoId}/item`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al registrar item");
    }
    return response.json();
  },

  // Alias para compatibilidad
  agregarItemConteo: async (datos) => {
    return inventarioGeneralService.registrarConteoItem(datos.conteo_id || datos.conteoId, {
      codigoBarra: datos.codigo_barra || datos.codigoBarra,
      cantidad: datos.cantidad,
      companiaId: datos.compania_id || datos.companiaId,
      usuarioEmail: datos.usuarioEmail,
      itemId: datos.itemId
    });
  },

  eliminarConteoItem: async (registroId) => {
    const response = await fetch(`${API_URL}/conteos/item/${registroId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al eliminar item del conteo");
    }
    return response.json();
  },

  finalizarConteo: async (conteoId) => {
    const response = await fetch(`${API_URL}/conteos/${conteoId}/finalizar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al finalizar conteo");
    }
    return response.json();
  },

  obtenerItemsConDiferencias: async (ubicacionId) => {
    const response = await fetch(`${API_URL}/conteos/diferencias/${ubicacionId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al obtener diferencias");
    }
    return response.json();
  },

  buscarItemPorCodigoBarra: async (codigoBarra, companiaId) => {
    const response = await fetch(`${API_URL}/items/barcode/${codigoBarra}/${companiaId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      if (response.status === 404) return null;
      const error = await response.json();
      throw new Error(error.message || "Error al buscar item");
    }
    return response.json();
  },

  obtenerItemsConteo: async (conteoId) => {
    const response = await fetch(`${API_URL}/conteos/${conteoId}/items`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al obtener items del conteo");
    }
    return response.json();
  },

  obtenerUbicacionesConDiferenciasPendientes: async (companiaId) => {
    const response = await fetch(`${API_URL}/conteos/diferencias-pendientes?companiaId=${companiaId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al obtener diferencias pendientes");
    }
    const data = await response.json();
    return data.data;
  },

  // =====================================================
  // MÉTODOS DE ADMINISTRACIÓN Y HISTORIAL
  // =====================================================

  obtenerHistorialConteos: async (companiaId, filtros) => {
    const query = new URLSearchParams({ ...filtros, companiaId }).toString();
    const response = await fetch(`${API_URL}/conteos/historial?${query}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al obtener historial");
    }
    const data = await response.json();
    return data.data;
  },

  aprobarConteo: async (conteoId) => {
    const response = await fetch(`${API_URL}/conteos/${conteoId}/aprobar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al aprobar conteo");
    }
    return response.json();
  },

  rechazarConteo: async (conteoId, motivo) => {
    const response = await fetch(`${API_URL}/conteos/${conteoId}/rechazar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al rechazar conteo");
    }
    return response.json();
  },

  obtenerDetalleConteo: async (conteoId) => {
    const response = await fetch(`${API_URL}/conteos/${conteoId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al obtener detalle del conteo");
      }
      const data = await response.json();
      
      // Aplanar estructura para el excel
      const conteo = data.data;
      if (!conteo.items) return [];
      
      return conteo.items.map(item => ({
          bodega: conteo.ubicacion?.pasillo?.zona?.bodega?.nombre || "N/A",
          zona: conteo.ubicacion?.pasillo?.zona?.nombre || "N/A",
          pasillo: conteo.ubicacion?.pasillo?.numero || "N/A",
          ubicacion: conteo.ubicacion?.numero || "N/A",
          item_id: item.item?.id,
          item_codigo: item.item?.item || item.item?.codigo_interno || "N/A",
          descripcion: item.item?.descripcion || "N/A",
          codigo_barra: item.item?.codigo_barra || item.item?.codigo || "N/A",
          cantidad: item.cantidad,
          fecha_conteo: conteo.created_at || conteo.fecha_inicio,
          usuario_nombre: conteo.correo_empleado || conteo.usuario_id || "Usuario"
      }));
  },

  exportarBodega: async (bodegaId) => {
    const response = await fetch(`${API_URL}/conteos/exportar/${bodegaId}`);
    if (!response.ok) throw new Error("Error al exportar datos de bodega");
    const data = await response.json();
    return data.data;
  },

  // =====================================================
  // MÉTODOS DE CIERRE DE INVENTARIO (JERARQUÍA)
  // =====================================================

  cerrarPasillo: async (pasilloId, companiaId) => {
    const response = await fetch(`${API_URL}/inventario/cerrar-pasillo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pasilloId, companiaId }),
    });
    if (!response.ok) throw new Error("Error al cerrar pasillo");
    return response.json();
  },

  cerrarZona: async (zonaId, companiaId) => {
    const response = await fetch(`${API_URL}/inventario/cerrar-zona`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zonaId, companiaId }),
    });
    if (!response.ok) throw new Error("Error al cerrar zona");
    return response.json();
  },

  cerrarBodega: async (bodegaId, companiaId) => {
    const response = await fetch(`${API_URL}/inventario/cerrar-bodega`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bodegaId, companiaId }),
    });
    if (!response.ok) throw new Error("Error al cerrar bodega");
    return response.json();
  },

  obtenerEstadoJerarquia: async (bodegaNombre, companiaId) => {
    const response = await fetch(`${API_URL}/inventario/estado-jerarquia?bodega=${encodeURIComponent(bodegaNombre)}&companiaId=${companiaId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.data;
  },

  guardarAjusteFinal: async (data) => {
    const response = await fetch(`${API_URL}/conteos/ajuste-final`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al guardar ajuste final");
    }
    return response.json();
  },

  
  generarReporteIA: async (filters) => {
    const response = await fetch(`${API_URL}/reportes/ia`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filters }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Error al generar reporte IA");
    }
    const data = await response.json();
    return data.data.report;
  },

  buscarItems: async (query, companiaId) => {
    const url = `${API_URL}/items/search/query?q=${encodeURIComponent(query)}${companiaId ? `&companiaId=${companiaId}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Error al buscar items");
    }
    const data = await response.json();
    return data.data;
  },

  getItemLocations: async (itemId, companiaId) => {
    const response = await fetch(`${API_URL}/conteos/item-locations/${itemId}/${companiaId}`);
    if (!response.ok) throw new Error("Error obteniendo ubicaciones del item");
    const result = await response.json();
    return result.data;
  },
};

// Exportar como inventarioGeneralService (nombre original)
export { inventarioGeneralService };

// Exportar también como inventarioService (alias para compatibilidad)
export const inventarioService = inventarioGeneralService;
