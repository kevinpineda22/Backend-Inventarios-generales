import { getInventario, buildUrl, buildPaginacion, fetchGeneric } from './ConexionApi';

const DESC_BODEGAS = "API_v2_Bodegas"; // Endpoint para bodegas

// Helper recursivo para obtener propiedades ignorando mayúsculas/minúsculas
const getProp = (obj, keyPart) => {
    if (!obj) return undefined;
    const key = Object.keys(obj).find(k => k.toLowerCase().includes(keyPart.toLowerCase()));
    return key ? obj[key] : undefined;
};

/**
 * Obtiene el maestro de bodegas desde SIESA.
 * @param {string} companiaId - ID de la compañia para filtrar (opcional).
 */
export async function getSiesaBodegas(companiaId = null) {
    try {
        console.log(`[SiesaService] Consultando Bodegas (Cia: ${companiaId || 'Todas'})...`);
        
        const params = {
            idCompania: "7375",
            descripcion: DESC_BODEGAS,
            paginacion: buildPaginacion(1, 49) 
        };

        if (companiaId) {
            params.parametros = `f150_id_cia=${companiaId}`;
        }

        const url = buildUrl("siesa", params);
        
        const res = await fetchGeneric(url);
        
        // Verificación extra por si devuelve alerta
        if (res.datos && res.datos.length > 0 && res.datos[0].alerta) {
            console.warn("[SiesaService] Alerta recibida:", res.datos[0].alerta);
            return []; // O podríamos reintentar con menos
        }

        return res.datos || [];
    } catch (error) {
        console.error('[SiesaService] Error obteniendo bodegas:', error);
        return [];
    }
}

/**
 * Consulta el stock de SIESA para una lista de items utilizando la lógica de 'parametros'.
 * @param {Array} items - Lista de códigos (f120_id) a consultar.
 * @param {Function} onProgress - Callback para notificar progreso (completed, total).
 * @param {string} companiaId - ID de la compañía (1=Merkahorro, 2=Megamayorista).
 * @param {string} bodegaId - ID de la bodega (f150_id) para filtrar. Opcional.
 * @returns {Promise<Array>} - Array con los datos encontrados en SIESA.
 */
export async function getSiesaStockBatch(items = [], onProgress, companiaId = '1', bodegaId = null) {
  console.log(`[SiesaService] Iniciando batch para ${items.length} items. CIA: ${companiaId}, Bodega: ${bodegaId || 'TODAS'}`);
  
  const results = [];
  // AUMENTADO DE 5 A 49 (Limite seguro navegador/api)
  const CONCURRENCY_LIMIT = 49; 
  let completed = 0;

  // Función para procesar un item individual
  const processItem = async (codigo) => {
    try {
      const filtros = { parametros: `f120_id=${codigo}` };
      
      const res = await getInventario({ 
        page: 1, 
        size: 100, 
        filtros: filtros
      });

      const datos = res.datos || [];
      
      if (datos.length > 0) {
        // 1. Validar ID Match
        const primerItem = datos[0];
        const idEncontrado = String(primerItem.f120_id || primerItem.RowID || primerItem.IdItem || '').trim();
        
        let matchData = [];
        if (String(idEncontrado) === String(codigo)) {
            matchData = datos;
        } else {
             matchData = datos.filter(d => String(d.f120_id) === String(codigo));
        }

        // 2. FILTROS (Compañía y Bodega)
        const filtered = matchData.filter(d => {
            const rowCia = String(d.f120_id_cia || '').trim();
            const rowBodega = String(d.f150_id || '').trim();

            const matchCia = (rowCia === String(companiaId));
            const matchBodega = (!bodegaId) || (rowBodega === String(bodegaId));
            
            return matchCia && matchBodega;
        });

        if (filtered.length > 0) {
            return filtered;
        }
      }
      
      return [];
    } catch (error) {
      console.warn(`[SiesaService] Error consultando item ${codigo}:`, error);
      return [];
    }
  };

  // Ejecución por lotes
  for (let i = 0; i < items.length; i += CONCURRENCY_LIMIT) {
    const chunk = items.slice(i, i + CONCURRENCY_LIMIT);
    const chunkPromises = chunk.map(codigo => processItem(codigo));
    const chunkResults = await Promise.all(chunkPromises);

    chunkResults.forEach(data => {
      if (Array.isArray(data)) results.push(...data);
    });

    completed += chunk.length;
    if (onProgress) onProgress(completed, items.length);
  }

  console.log(`[SiesaService] Finalizado. ${results.length} registros obtenidos.`);
  return results;
}

/**
 * Descarga TODO el inventario (Stock) paginado.
 * Equivalente a la lógica "Full" pero aislada en este servicio.
 */
export async function getAllInventario({ size = 100, signal, filtros = {}, onProgress } = {}) {
  console.log('[SiesaService] getAllInventario: Fetching full stock...');
  const pageSize = size > 100 ? 100 : size; 
  let allData = [];
  let currPage = 1;
  let keepFetching = true;
  
  while (keepFetching) {
    try {
      // Notificamos progreso (Página, Total acumulado)
      if (onProgress) onProgress(currPage, allData.length);

      const res = await getInventario({ 
        page: currPage, 
        size: pageSize, 
        signal,
        filtros
      });
      const pageData = res.datos || [];
      
      if (pageData.length > 0) {
        // Filtrar alertas si las hay
        const validItems = pageData.filter(item => !item.alerta);
        allData = [...allData, ...validItems];

        // Lógica de paginación
        if (currPage >= res.totalPaginas && res.totalPaginas > 0) {
            keepFetching = false;
        } else if (pageData.length < pageSize) {
            keepFetching = false;
        } else {
             currPage++;
        }
      } else {
        keepFetching = false; 
      }

      // Límite de seguridad
      if (currPage > 500) { 
        console.warn("[SiesaService] Límite de seguridad alcanzado (500 páginas)");
        keepFetching = false; 
      }

    } catch (error) {
      if (error.name === 'AbortError') throw error;
      console.error(`[SiesaService] Error fetching inventory page ${currPage}:`, error);
      keepFetching = false; 
    }
  }

  console.log(`[SiesaService] Total Inventario SIESA descargado: ${allData.length} registros`);
  return allData;
}

