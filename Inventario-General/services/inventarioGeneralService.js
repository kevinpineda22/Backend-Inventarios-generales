const API_URL = "https://backend-inventarios-generales.vercel.app/api";

export const inventarioGeneralService = {
  // --- ESTRUCTURA ---
  obtenerEstructuraInventario: async (companiaId) => {
    const response = await fetch(`${API_URL}/estructura/${companiaId}`);
    if (!response.ok) throw new Error("Error al obtener estructura");
    return await response.json();
  },

  obtenerBodegas: async (companiaId) => {
    const response = await fetch(
      `${API_URL}/estructura/navegacion?companiaId=${companiaId}`
    );
    if (!response.ok) throw new Error("Error al obtener bodegas");
    const data = await response.json();
    return data.data.bodegas || [];
  },

  crearBodega: async (datos) => {
    const response = await fetch(`${API_URL}/estructura/bodega`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
    if (!response.ok) throw new Error("Error al crear bodega");
    return await response.json();
  },

  crearZona: async (datos) => {
    const response = await fetch(`${API_URL}/estructura/zona`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
    if (!response.ok) throw new Error("Error al crear zona");
    return await response.json();
  },

  crearPasillo: async (datos) => {
    const response = await fetch(`${API_URL}/estructura/pasillo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
    if (!response.ok) throw new Error("Error al crear pasillo");
    return await response.json();
  },

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

  crearUbicacionesBatch: async (ubicaciones) => {
    const response = await fetch(`${API_URL}/estructura/ubicaciones-multiple`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ubicaciones }),
    });
    if (!response.ok) throw new Error("Error al crear ubicaciones");
    return await response.json();
  },

  obtenerEstadoUbicacion: async (ubicacionId) => {
    const response = await fetch(
      `${API_URL}/ubicaciones/${ubicacionId}/estado`
    );
    if (!response.ok) throw new Error("Error al obtener estado de ubicación");
    return await response.json();
  },

  // --- ITEMS / MAESTRA ---
  buscarItemPorCodigoBarra: async (codigoBarra, companiaId) => {
    // GET /items/barcode/:codigoBarra/:companiaId
    const response = await fetch(
      `${API_URL}/items/barcode/${codigoBarra}/${companiaId}`
    );
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error("Error al buscar item");
    }
    const data = await response.json();
    return data.data; // Asumiendo que el backend devuelve { success: true, data: { ... } }
  },

  // --- CONTEOS ---
  iniciarConteo: async (datos) => {
    // POST /conteos/iniciar
    const response = await fetch(`${API_URL}/conteos/iniciar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
    if (!response.ok) throw new Error("Error al iniciar conteo");
    const data = await response.json();
    return data.data;
  },

  agregarItemConteo: async (datos) => {
    // POST /conteos/:conteoId/item
    // datos: { conteoId, codigoBarra, cantidad, companiaId }
    const response = await fetch(`${API_URL}/conteos/${datos.conteo_id}/item`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigoBarra: datos.codigo_barra, // El backend espera codigoBarra
        cantidad: datos.cantidad,
        companiaId: datos.compania_id,
      }),
    });
    if (!response.ok) throw new Error("Error al agregar item");
    const data = await response.json();
    return data.data;
  },

  obtenerItemsConteo: async (conteoId) => {
    // GET /conteos/:conteoId/items
    const response = await fetch(`${API_URL}/conteos/${conteoId}/items`);
    if (!response.ok) throw new Error("Error al obtener items del conteo");
    const data = await response.json();
    return data.data;
  },

  finalizarConteo: async (conteoId) => {
    // POST /conteos/:conteoId/finalizar
    const response = await fetch(`${API_URL}/conteos/${conteoId}/finalizar`, {
      method: "POST",
    });
    if (!response.ok) throw new Error("Error al finalizar conteo");
    return await response.json();
  },

  // --- DIFERENCIAS ---
  obtenerItemsConDiferencias: async (ubicacionId) => {
    // GET /conteos/diferencias/:ubicacionId
    const response = await fetch(
      `${API_URL}/conteos/diferencias/${ubicacionId}`
    );
    if (!response.ok) throw new Error("Error al obtener diferencias");
    const data = await response.json();
    return data.data;
  },

  // --- HISTORIAL CONTEOS (ADMIN) ---
  obtenerHistorialConteos: async (companiaId, filtros) => {
    // Por ahora usamos el endpoint de pendientes ya que no hay uno de historial completo
    // TODO: Implementar endpoint de historial completo en backend
    const response = await fetch(`${API_URL}/conteos/pendientes`);
    if (!response.ok) throw new Error("Error al obtener historial de conteos");
    const data = await response.json();
    // El backend devuelve { success: true, data: [...] }
    return data.data || [];
  },

  aprobarConteo: async (conteoId) => {
    const response = await fetch(`${API_URL}/conteos/${conteoId}/aprobar`, {
      method: "POST",
    });
    if (!response.ok) throw new Error("Error al aprobar conteo");
    return await response.json();
  },

  rechazarConteo: async (conteoId, motivo) => {
    const response = await fetch(`${API_URL}/conteos/${conteoId}/rechazar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo }),
    });
    if (!response.ok) throw new Error("Error al rechazar conteo");
    return await response.json();
  },

  obtenerDetalleConteo: async (conteoId) => {
    const response = await fetch(`${API_URL}/conteos/${conteoId}`);
    if (!response.ok) throw new Error("Error al obtener detalle del conteo");
    const data = await response.json();
    // El endpoint getById devuelve el conteo con sus items
    // Pero HistorialConteos espera un array de items aplanado para el excel
    // Vamos a devolver los items del conteo
    const conteo = data.data;
    if (conteo && conteo.items) {
      return conteo.items.map((item) => ({
        bodega: conteo.ubicacion?.pasillo?.zona?.bodega?.nombre || "N/A",
        zona: conteo.ubicacion?.pasillo?.zona?.nombre || "N/A",
        pasillo: conteo.ubicacion?.pasillo?.numero || "N/A",
        ubicacion: conteo.ubicacion?.numero || "N/A",
        item_codigo: item.item?.codigo_interno || "N/A",
        descripcion: item.item?.descripcion || "N/A",
        codigo_barra: item.item?.codigo_barra || "N/A",
        cantidad: item.cantidad,
        fecha_conteo: conteo.fecha_inicio,
        usuario_nombre: "Usuario", // No tenemos el nombre del usuario en el modelo actual
      }));
    }
    return [];
  },

  exportarBodega: async (bodegaId) => {
    const response = await fetch(`${API_URL}/conteos/exportar/${bodegaId}`);
    if (!response.ok) throw new Error("Error al exportar datos de bodega");
    const data = await response.json();
    return data.data;
  },
};
