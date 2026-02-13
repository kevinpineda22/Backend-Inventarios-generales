// src/services/ConexionApi.js

// Configuración de Entorno
// En DEV: Usamos el proxy de Vite (/connekta) que redirige a Siesa.
// En PROD: Usamos el backend de Python como "Proxy Seguro" para no exponer las llaves.
const USE_SECURE_PROXY = !import.meta.env.DEV;

const BASE_URL = import.meta.env.DEV
  ? "/connekta"
  : (import.meta.env.VITE_BACKEND_URL || "").trim();

// Variables requeridas por la API
const CIA = import.meta.env.VITE_CONNEKTA_COMPANIA;
// Las llaves solo se usan en el frontend en modo DEV. En PROD deben estar en el backend.
const CONNI_KEY = import.meta.env.VITE_CONNEKTA_KEY;
const CONNI_TOKEN = import.meta.env.VITE_CONNEKTA_TOKEN;
const COMPANY_ID = 7375; // Para terceros y cargos (funciona con 7375)

// --- NUEVAS CONSULTAS ---
const DESC_PRECIOS = "API_v2_ItemsPrecios";
const DESC_INVENTARIO = "API_v2_Inventarios_InvFecha";

// La API quiere "paginacion=numPag=1|tamPag=20"
export const buildPaginacion = (page = 1, size = 20) => `numPag=${page}|tamPag=${size}`;

// Helper para construir la URL correcta según el tipo de servicio
// type: 'connekta' | 'siesa'
export function buildUrl(type, params) {
  const qs = new URLSearchParams(params).toString();

  if (USE_SECURE_PROXY) {
    // MODO PRODUCCIÓN: Apuntamos al backend de Python
    // El backend debe tener un endpoint /siesa-proxy que reciba estos parámetros
    // y haga la petición real a Siesa inyectando las llaves.
    return `${BASE_URL}/siesa-proxy?endpoint_type=${type}&${qs}`;
  }

  // MODO DESARROLLO: Usamos el proxy de Vite
  if (type === "siesa") {
    // Endpoint para consultas estándar de Siesa
    return `${BASE_URL}/api/siesa/v3/ejecutarconsultaestandar?${qs}`;
  }
  // Default to connekta (Endpoint original)
  return `${BASE_URL}/api/connekta/v3/ejecutarconsulta?${qs}`;
}

// Fetch con reintentos y manejo correcto de AbortError
async function fetchWithRetry(url, options = {}, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;

      // Reintentos solo para 429/5xx
      if (![429, 500, 502, 503, 504].includes(res.status) || attempt === retries) {
        let msg = `${res.status} ${res.statusText}`;
        try {
          msg += `: ${await res.text()}`;
        } catch {}
        throw new Error(msg);
      }
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt))); // 0.5s, 1s, 2s
    } catch (e) {
      if (e.name === "AbortError") throw e;
      if (attempt === retries) throw e;
    }
  }
}

// Helper genérico para procesar la respuesta
export async function fetchGeneric(url, signal) {
  const headers = {};

  // SEGURIDAD: Solo enviamos las llaves desde el frontend si estamos en modo DEV (Vite Proxy).
  // En producción, el backend de Python es quien debe tener las llaves y agregarlas a la petición.
  if (!USE_SECURE_PROXY) {
    headers.conniKey = CONNI_KEY;
    headers.conniToken = CONNI_TOKEN;
  }

  const res = await fetchWithRetry(
    url,
    {
      method: "GET",
      headers,
      signal,
    },
    2
  );

  const json = await res.json();

  if (json?.codigo !== 0) {
    throw new Error(json?.mensaje || "Error en la API");
  }

  const det = json.detalle ?? {};
  // Siesa devuelve los datos en 'Table' para consultas estándar
  const datos = det.Datos ?? det.Table ?? json.Datos ?? [];

  if (datos.length === 0) {
    console.warn(`[fetchGeneric] Respuesta vacía para URL: ${url}`, json);
  }

  return {
    datos,
    // Si la API no devuelve metadatos de paginación, devolvemos valores por defecto seguros
    // Buscamos variaciones comunes de nombres de propiedades
    pagina: Number(det["página_actual"] ?? det["pagina_actual"] ?? det["page"] ?? det["Page"] ?? 0), 
    totalPaginas: Number(det["total_páginas"] ?? det["total_paginas"] ?? det["totalPages"] ?? det["TotalPages"] ?? 0),
    totalRegistros: Number(det["total_registros"] ?? det["totalRegistros"] ?? det["TotalRegistros"] ?? det["totalRecords"] ?? 0),
    tamañoPagina: Number(det["tamaño_página"] ?? det["tamano_pagina"] ?? det["pageSize"] ?? det["PageSize"] ?? 0),
  };
}

// --- NUEVAS FUNCIONES DE CONSULTA ---

// 1. Precios (Siesa)
export async function getPreciosPage({ page = 1, size = 100, signal, filtros = {} } = {}) {
  // Usamos 7375 explícitamente y la descripción correcta
  const url = buildUrl("siesa", {
    idCompania: "7375", 
    descripcion: DESC_PRECIOS,
    paginacion: buildPaginacion(page, size),
    ...filtros
  });
  return fetchGeneric(url, signal);
}

// 2. Inventario (Connekta)
export async function getInventario({ page = 1, size = 100, signal, filtros = {} } = {}) {
  const url = buildUrl("siesa", {
    idCompania: "7375",
    descripcion: DESC_INVENTARIO,
    paginacion: buildPaginacion(page, size),
    ...filtros
  });
  return fetchGeneric(url, signal);
}

// Helper para encontrar una propiedad ignorando mayúsculas/minúsculas
function getCaseInsensitiveProp(obj, propName) {
  const key = Object.keys(obj).find((k) => k.toLowerCase() === propName.toLowerCase());
  return key ? obj[key] : undefined;
}

const toStr = (v) => String(v ?? "").trim();

// --- FUNCIÓN UNIFICADA (Modificada: Carga TODOS los Precios con detección de duplicados) ---
// Descarga todas las páginas y se queda con el precio MÁS RECIENTE (mayor RowID).
export async function getUnifiedInventory({ page = 1, size = 100, signal, filtros = {}, onProgress } = {}) {
  console.log(`getUnifiedInventory (Fetching ALL Smart): CIA=${CIA}`);
  
  // IMPORTANTE: La API de Siesa (Precios) tiene un límite estricto de 100 registros por página.
  const pageSize = size > 100 ? 100 : size; 
  
  // Usamos un MAP para guardar solamente la versión más reciente de cada item+lista
  // Clave: ID_ITEM + ID_LISTA
  const itemsMap = new Map();
  
  let currPage = 1;
  let keepFetching = true;
  
  while (keepFetching) {
    try {
      const res = await getPreciosPage({ 
        page: currPage, 
        size: pageSize, 
        signal,
        filtros
      });
      const pageData = res.datos || [];
      
      let itemsProcessedInPage = 0;
      const newItemsBatch = []; // Para notificar al onProgress si es necesario

      if (pageData.length > 0) {
        
        for (const item of pageData) {
          if (item.alerta) {
            console.warn("Alerta recibida de la API:", item.alerta);
            continue;
          }

          const id = getCaseInsensitiveProp(item, "f120_id") ?? getCaseInsensitiveProp(item, "f120_rowid");
          const lista = getCaseInsensitiveProp(item, "f126_id_lista_precio");
          const unidad = toStr(getCaseInsensitiveProp(item, "f126_id_unidad_medida")); // Agregar Unidad
          
          if (!id) continue;

          // Clave única (Ahora incluye UNIDAD para diferenciar UND de P2, Caja, etc.)
          const uniqueKey = `${id}-${lista}-${unidad}`;
          
          // Determinamos cuál es más reciente usando el RowID del precio (f126_rowid)
          // Si f126_rowid no existe, asumimos 0 y confiamos en el orden de llegada si es necesario, pero rowid debería estar.
          const currentRowId = Number(getCaseInsensitiveProp(item, "f126_rowid") ?? 0);

          let shouldUpdate = false;

          if (itemsMap.has(uniqueKey)) {
             const existingItem = itemsMap.get(uniqueKey);
             const existingRowId = Number(getCaseInsensitiveProp(existingItem, "f126_rowid") ?? 0);
             
             // Si el nuevo tiene un RowID mayor, es una versión más reciente (ej: actualización de precio)
             if (currentRowId > existingRowId) {
                shouldUpdate = true;
             }
          } else {
             shouldUpdate = true;
          }

          if (shouldUpdate) {
            itemsMap.set(uniqueKey, item);
            newItemsBatch.push(item);
          }
          
          itemsProcessedInPage++;
        }

        // Si hay callback de progreso y encontramos nuevos/mejorados items
        if (onProgress && newItemsBatch.length > 0) {
            const mappedBatch = newItemsBatch.map((p) => ({
                f120_referencia: toStr(getCaseInsensitiveProp(p, "f120_referencia")),
                f120_descripcion: toStr(getCaseInsensitiveProp(p, "f120_descripcion")),
                f126_id_lista_precio: toStr(getCaseInsensitiveProp(p, "f126_id_lista_precio")),
                f126_id_unidad_medida: toStr(getCaseInsensitiveProp(p, "f126_id_unidad_medida")).trim(),
                f126_precio: Number(getCaseInsensitiveProp(p, "f126_precio") ?? 0),
                ...p
            }));
            onProgress(mappedBatch);
        }

        // Lógica de paginación: Si trajimos menos del pageSize, es la última página
        if (pageData.length < pageSize) {
             keepFetching = false;
        } else {
             currPage++;
        }

      } else {
        keepFetching = false; // No hay datos en esta página
      }

      // Límite de seguridad aumentado a 300 páginas (30,000 registros históricos aprox)
      if (currPage > 300) {
        console.warn("Límite de seguridad alcanzado (300 páginas)");
        keepFetching = false;
      }

    } catch (error) {
      if (error.name === 'AbortError') throw error;
      console.error(`Error fetching page ${currPage}:`, error);
      keepFetching = false;
    }
  }

  // Convertimos el Map a array
  const allData = Array.from(itemsMap.values());
  console.log(`Total registros únicos consolidados (últimos precios): ${allData.length}`);

  // Mejora en el mapeo final de getUnifiedInventory
  const mappedData = allData.map((p) => {
    return {
      f120_referencia: toStr(getCaseInsensitiveProp(p, "f120_referencia")),
      f120_descripcion: toStr(getCaseInsensitiveProp(p, "f120_descripcion")),
      f126_id_lista_precio: toStr(getCaseInsensitiveProp(p, "f126_id_lista_precio")),
      f126_id_unidad_medida: toStr(getCaseInsensitiveProp(p, "f126_id_unidad_medida")).trim(),
      f126_precio: Number(getCaseInsensitiveProp(p, "f126_precio") ?? 0),
      ...p
    };
  });


  return {
    datos: mappedData,
    pagina: 1,
    totalPaginas: 1, 
    totalRegistros: mappedData.length,
    tamañoPagina: mappedData.length
  };
}
