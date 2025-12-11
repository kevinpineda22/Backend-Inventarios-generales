import OpenAI from 'openai';
import ConteoModel from '../models/Conteo.model.js';
import { supabase, supabaseAdmin } from '../config/supabase.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * generateInventoryReport
 * ----------------------
 * Genera un reporte de inventario (intenta devolver JSON estructurado).
 * Reemplaza la lógica existente en tu archivo por esta función completa
 * (incluye helpers: buildInventoryPrompt, calculateStats, parseJSONFromText).
 */
export const generateInventoryReport = async (params) => {
  try {
    // Si se proporcionan datos de análisis pre-calculados (ej: reporte de operador desde frontend)
    if (params.reportType === 'operator' && params.analysisData) {
      return await generateOperatorReport(params.analysisData);
    }

    // Flujo normal: Reporte de Bodega (Backend fetch)
    // Extraemos 'profiles' si viene del frontend, el resto son filtros
    const { profiles: frontendProfiles, ...filters } = params;

    // 1. Obtener datos de la base de datos
    const conteos = await ConteoModel.findAll(filters);

    if (!conteos || conteos.length === 0) {
      throw new Error('No hay datos suficientes para generar el reporte.');
    }

    // 2. Obtener mapa de nombres reales (Estrategia Robusta: Frontend + Backend Backup)
    let allProfiles = frontendProfiles || [];

    // Si no vinieron del frontend, intentamos cargar desde backend
    if (!allProfiles.length) {
      // A. Intentar tabla 'profiles' (Public)
      try {
        const dbClient = supabaseAdmin || supabase;
        const { data } = await dbClient.from('profiles').select('user_id, nombre, correo');
        if (data && data.length > 0) allProfiles = data;
      } catch (err) {
        console.warn("Error cargando perfiles en backend (tabla profiles):", err.message);
      }

      // B. Si falla o está vacía, intentar Supabase Auth (Admin API)
      if ((!allProfiles || allProfiles.length === 0) && supabaseAdmin) {
        try {
          const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
          if (users && !error) {
            allProfiles = users.map(u => ({
              id: u.id,
              correo: u.email,
              nombre: u.user_metadata?.nombre || u.user_metadata?.full_name || u.user_metadata?.name || (u.email ? u.email.split('@')[0] : u.id)
            }));
          }
        } catch (err) {
          console.warn("Error cargando usuarios desde Auth Admin:", err.message);
        }
      }
    }

    const namesMap = new Map();
    if (allProfiles && allProfiles.length > 0) {
      allProfiles.forEach(p => {
        if (p.nombre) {
          const uid = p.user_id || p.id;
          if (uid) namesMap.set(uid, p.nombre);
          if (p.correo) {
            namesMap.set(p.correo.toLowerCase(), p.nombre);
            const username = p.correo.split('@')[0].toLowerCase();
            namesMap.set(username, p.nombre);
          }
        }
      });
    }

    // 3. Calcular estadísticas mejoradas
    const stats = calculateStats(conteos, namesMap);
    const bodegaNombre = filters.bodega || 'General';

    // --- ESTRATEGIA HÍBRIDA: Datos Estáticos + Análisis IA ---
    // Construimos el objeto base con los datos duros calculados (garantiza que los números siempre estén)
    const staticReportData = {
      kpis: {
        totalUnidades: stats.totalUnidadesFisicas,
        totalItems: stats.totalSKUsFisicos,
        esfuerzoOperativo: stats.esfuerzoTotalRows,
        tasaDiscrepancia: stats.errorRate,
        promedioDiferencias: stats.avgDiffPerLocation,
        tasaError: stats.errorRate,
        efectividadConteo1: stats.pctMatchT1,
        efectividadConteo2: stats.pctMatchT2,
        coincidenciaT1T2: stats.pctMatchT1vsT2,
        totalReconteos: stats.reconteos,
        velocidad: stats.itemsPorHora,
        confidenceScore: stats.confidenceScore
      },
      tablas: {
        colaboradores: stats.collaboratorTable,
        zonas: stats.zoneTable
      },
      operators: {
        top_correct: stats.operatorsCorrectTop,
        top_reconteos: stats.operatorsReconTop
      },
      topRecountedItems: stats.topRecountedItems,
      reconteos_per_day: stats.reconteosPerDay,
      trend_comment: stats.reconteosTrend,
      // Anomalías base (sin texto enriquecido aún)
      anomalias: stats.anomaliesTop10.map(a => ({
        ubicacion: a.ubicacion,
        producto: a.producto,
        prioridad: a.prioridad,
        situacion: `Diferencia de ${a.diff_abs} unidades (${a.diff_percent}%) tras ${a.reconteos} reconteos.`,
        accion: "Verificar físicamente."
      }))
    };

    // 4. Construir Prompt Avanzado (Solo pedimos el análisis cualitativo)
    const prompt = buildInventoryPrompt({
      bodegaNombre,
      stats,
      sampleConteos: conteos,
      ubicacionesConflicto: stats.ubicacionesConflicto
    });

    // 5. Llamar a OpenAI
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "Eres un Auditor Senior de Inventarios. TU SALIDA DEBE SER EXCLUSIVAMENTE UN JSON VALIDO (UN SOLO OBJETO). No incluyas texto adicional. Genera análisis detallados y profesionales."
        },
        { role: "user", content: prompt }
      ],
      model: "gpt-3.5-turbo",
      temperature: 0.5, // Un poco más creativo para el texto
      max_tokens: 2500,
    });

    const raw = completion.choices?.[0]?.message?.content;
    const aiResponse = parseJSONFromText(raw) || {};

    // 6. Fusionar Datos Estáticos con Análisis IA
    // Priorizamos los datos estáticos para los números, y usamos la IA para textos y listas enriquecidas
    const finalReport = {
      ...staticReportData,
      resumenEjecutivo: aiResponse.resumenEjecutivo || "No se pudo generar el resumen ejecutivo.",
      analisisProductividad: aiResponse.analisisProductividad || "No se pudo generar el análisis de productividad.",
      conclusion: aiResponse.conclusion || "No se pudo generar la conclusión.",
      hallazgos: aiResponse.hallazgos || [],
      acciones: aiResponse.acciones || [],
      // Si la IA devolvió anomalías enriquecidas, intentamos usarlas, si no, nos quedamos con las estáticas
      anomalias: (aiResponse.anomalias && aiResponse.anomalias.length > 0) ? aiResponse.anomalias : staticReportData.anomalias
    };

    return finalReport;

  } catch (error) {
    console.error('Error generating AI report:', error);
    throw error;
  }
};

/* ------------------ HELPERS & PROMPT BUILDERS ------------------ */

/**
 * parseJSONFromText
 * - Intenta parsear un texto que puede tener JSON puro o un bloque delimitado <<<JSON>>>...<<<ENDJSON>>>
 * - Devuelve null si no pudo parsear.
 */
const parseJSONFromText = (text) => {
  if (!text || typeof text !== 'string') return null;

  // 1) Intento directo
  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj === 'object') return obj;
  } catch (e) {
    // continue
  }

  // 2) Buscar bloque delimitado <<<JSON>>> ... <<<ENDJSON>>>
  const delimMatch = text.match(/<<<JSON>>>([\s\S]*?)<<<ENDJSON>>>/);
  if (delimMatch) {
    try {
      const obj = JSON.parse(delimMatch[1]);
      if (obj && typeof obj === 'object') return obj;
    } catch (e) {
      // continue
    }
  }

  // 3) Buscar primer "{" y último "}" y intentar parsear esa porción (protección básica)
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    const maybe = text.slice(first, last + 1);
    try {
      const obj = JSON.parse(maybe);
      if (obj && typeof obj === 'object') return obj;
    } catch (e) {
      // no parseable
    }
  }

  return null;
};

/**
 * buildInventoryPrompt
 * - Construye el prompt que se enviará al modelo solicitando el JSON con la estructura
 *   y pidiendo el resumen ejecutivo más descriptivo y profesional.
 */
const buildInventoryPrompt = ({ bodegaNombre = 'General', stats = {}, sampleConteos = [], ubicacionesConflicto = [] }) => {
  const s = stats;

  const sampleLines = (sampleConteos || []).slice(0,10).map(c => {
    const pasillo = c.ubicacion?.pasillo?.numero ?? c.pasillo ?? 'N/A';
    const zona = c.ubicacion?.pasillo?.zona?.nombre ?? c.zona ?? 'N/A';
    const ubicacion = c.ubicacion?.nombre ?? c.ubicacion?.numero ?? c.ubicacion_id ?? 'N/A';
    const itemsCount = c.total_items ?? c.conteo_items?.reduce((a, b) => a + (Number(b.cantidad) || 0), 0) ?? 0;
    const itemName = c.conteo_items?.[0]?.item?.descripcion || 'N/D';
    const usuario = c.usuario_nombre || c.correo_empleado || 'N/D';
    const tipoTexto = c.tipo_conteo === 3 ? 'Discrepancia (Reconteo)' : 'Conteo Normal';
    return `- { zona: "${zona}", pasillo: "${pasillo}", ubicacion: "${ubicacion}", producto: "${itemName}", items: ${itemsCount}, tipo: "${tipoTexto}", usuario: "${usuario}", fecha: "${c.created_at ?? c.createdAt ?? ''}" }`;
  }).join('\n');

  return `
Analiza exhaustivamente los datos de la bodega "${bodegaNombre}" y entrega UN SOLO OBJETO JSON válido con los campos requeridos. Usa únicamente los datos entregados.

NUEVOS INDICADORES DE GESTIÓN (KPIs):
1. Promedio de ubicaciones por colaborador: ${s.avgLocationsPerCollab}
2. Tasa de cumplimiento (Avance Global): ${s.avance}%
3. Promedio de diferencias por ubicación (en unidades): ${s.avgDiffPerLocation}
4. Porcentaje de errores/diferencias (Ubicaciones con error / Total): ${s.errorRate}%
5. Porcentaje de reconteos que coincidieron con Conteo 1: ${s.pctMatchT1}%
6. Porcentaje de reconteos que coincidieron con Conteo 2: ${s.pctMatchT2}%
7. Tasa de efectividad del 1er conteo sobre el 2do: ${s.effectivenessRatio} (Ratio T1/T2)
8. Cantidad de items (unidades) con diferencias: ${s.totalDiffAbs}
9. Total Reconteos realizados: ${s.reconteos}
10. Tiempo promedio por zona: Ver tabla abajo.

TABLA DE COLABORADORES (Cumplimiento, Items, Participación):
${s.collaboratorTable.map(c => `- ${c.colaborador}: ${c.ubicaciones} ubicaciones | ${c.items} items | ${c.participacion}% participacion`).join('\n')}

TABLA DE TIEMPOS POR ZONA:
${s.zoneTable.map(z => `- ${z.zona}: ${z.tiempoPromedio}`).join('\n')}

ESTADÍSTICAS GENERALES:
- Total Unidades Físicas: ${s.totalUnidadesFisicas}
- Total SKUs/Referencias: ${s.totalSKUsFisicos}
- Esfuerzo Operativo (Líneas): ${s.esfuerzoTotalRows}
- Velocidad Promedio: ${s.itemsPorHora} items/h
- Confidence Score: ${s.confidenceScore}

ANOMALIES_TOP10 (Priorizadas):
${(s.anomaliesTop10 || []).map(a => `- ${a.ubicacion} | Prod: ${a.producto} | Diff: ${a.diff_abs} | Reconteos: ${a.reconteos}`).join('\n')}

--- INSTRUCCIONES DE GENERACIÓN ---
Debes generar un JSON con contenido analítico real y detallado.
1. "resumenEjecutivo": Genera 4-6 párrafos en Markdown. Analiza las cifras clave, causas probables de diferencias y prioridades.
2. "analisisProductividad": Analiza el desempeño de los colaboradores basándote en las tablas proporcionadas.
3. "conclusion": Escribe una conclusión técnica sólida.
4. "anomalias": Genera una lista de anomalías enriquecida con "situacion" y "accion" basada en la lista de "ANOMALIES_TOP10" proporcionada arriba.

IMPORTANTE: Los campos de texto NO pueden estar vacíos. NO uses los textos de ejemplo, genera tu propio análisis.

--- SALIDA REQUERIDA: JSON único ---
{
  "resumenEjecutivo": "",
  "analisisProductividad": "",
  "hallazgos": [
    "Hallazgo 1",
    "Hallazgo 2"
  ],
  "anomalias": [
    {
      "ubicacion": "Zona...",
      "producto": "Nombre...",
      "prioridad": "alta",
      "situacion": "Descripción detallada del problema...",
      "accion": "Acción correctiva recomendada..."
    }
  ],
  "acciones": [
    { "actor": "Nombre", "accion": "Acción", "impacto": "Impacto", "prioridad": "alta" }
  ],
  "conclusion": ""
}
`.trim();
};


/* ------------------ calculateStats (mejorada) ------------------ */

/**
 * calculateStats
 * - Analiza los conteos y devuelve un objeto con métricas extendidas:
 *   - anomaliesTop10 (prioritizadas)
 *   - operatorsCorrectTop (top por matches con conteo final)
 *   - operatorsReconTop (top por reconteos causados)
 *   - reconteosPerDay (serie para graficar)
 */
// ---------- Reemplazar o actualizar calculateStats ----------
const calculateStats = (data, namesMap) => {
  if (!data || data.length === 0) return {
    totalConteos: 0, totalUnidadesFisicas: 0, esfuerzoTotalItems: 0, ubicacionesUnicas: 0,
    ubicacionesFinalizadas: 0, avance: 0, reconteos: 0, tasaError: 0, velocidadPromedio: null,
    itemsPorHora: 0, topUsers: [], topZonas: [], topErrorZonas: [], topErrorPasillos: [],
    ubicacionesConflicto: [], anomaliesTop10: [], operatorsCorrectTop: [], operatorsReconTop: [],
    reconteosPerDay: [], confidenceScore: 0, reconteosTrend: null,
    // New defaults
    avgLocationsPerCollab: 0, avgDiffPerLocation: 0, errorRate: 0, pctMatchT1: 0, pctMatchT2: 0, pctMatchT1vsT2: 0,
    effectivenessRatio: 0, totalDiffAbs: 0, collaboratorTable: [], zoneTable: []
  };

  const totalConteos = data.length;

  // 1. Ubicaciones y Avance
  const ubicacionesSet = new Set(data.map(c => c.ubicacion_id));
  const ubicacionesUnicas = ubicacionesSet.size;
  const ubicacionesFinalizadasSet = new Set(
    data.filter(c => c.estado === 'finalizado').map(c => c.ubicacion_id)
  );
  const ubicacionesFinalizadas = ubicacionesFinalizadasSet.size;
  const avance = ubicacionesUnicas > 0 ? Number(((ubicacionesFinalizadas / ubicacionesUnicas) * 100).toFixed(1)) : 0;

  // 2. Helpers de Cantidad
  const getQty = (c) => {
      if (c.conteo_items && c.conteo_items.length > 0) {
          return c.conteo_items.reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0);
      }
      return Number(c.total_items || 0);
  };
  const getRows = (c) => {
      if (c.conteo_items && c.conteo_items.length > 0) return c.conteo_items.length;
      return c.total_items ? 1 : 0;
  };

  // 3. Agrupación por Ubicación (Core Logic)
  const locationMap = new Map(); 
  const itemRecountMap = {}; // Mapa para contar reconteos por item

  data.forEach(c => {
    // FILTER: Exclude invalid states to ensure "Real Inventory" is accurate and matches Dashboard
    if (c.estado === 'rechazado' || c.estado === 'en_progreso') return;

    const uid = c.ubicacion_id || `${c.bodega}::${c.zona}::${c.pasillo}::${c.ubicacion}`;
    const qty = getQty(c);
    const date = new Date(c.created_at || c.createdAt || Date.now());
    const rec = { qty, tipo: c.tipo_conteo, date, userId: c.usuario_id, userName: c.usuario_nombre || c.correo_empleado || null, raw: c };
    if (!locationMap.has(uid)) locationMap.set(uid, { records: [], reconteoCount: 0, zona: c.zona || c.ubicacion?.pasillo?.zona?.nombre || 'General' });
    locationMap.get(uid).records.push(rec);
    
    if (c.tipo_conteo === 3) {
      locationMap.get(uid).reconteoCount++;
      // NOTA: El conteo de items por reconteo se mueve al loop principal (paso 4)
      // para evitar duplicados y tener acceso al contexto de la ubicación.
    }
  });

  // 4. Procesamiento de Ubicaciones (Diffs, Anomalies, Matches)
  let totalUnidadesFisicas = 0;
  let totalSKUsFisicos = 0;
  let totalDiffAbs = 0;
  let locationsWithDiff = 0;
  let recountMatchesT1 = 0;
  let recountMatchesT2 = 0;
  let matchesT1T2 = 0; // Coincidencias directas T1 vs T2
  let totalComparisonsT1T2 = 0;
  let totalRecountsAnalyzed = 0;
  const anomalies = [];

  for (const [uid, info] of locationMap.entries()) {
    info.records.sort((a,b) => (a.date - b.date) || (a.tipo - b.tipo));
    const last = info.records[info.records.length - 1];
    const prev = info.records.length >= 2 ? info.records[info.records.length - 2] : null;
    
    totalUnidadesFisicas += (last?.qty || 0);
    totalSKUsFisicos += (last?.raw?.conteo_items?.length || (last?.raw?.total_items ? 1 : 0));

    // --- LÓGICA DE RECONTEOS POR ITEM (MEJORADA) ---
    // Iterar sobre los registros de esta ubicación para encontrar reconteos (Tipo 3)
    info.records.forEach(r => {
        if (r.tipo === 3) {
            const itemsInRecount = new Set(); // Para evitar contar el mismo item varias veces en un solo reconteo
            
            if (r.raw.conteo_items && r.raw.conteo_items.length > 0) {
                r.raw.conteo_items.forEach(item => {
                    const itemName = item.item?.descripcion || item.descripcion || 'Item Desconocido';
                    itemsInRecount.add(itemName);
                });
            } else {
                // Si el reconteo no tiene items (es solo total), intentamos inferir los items del conteo anterior (T1 o T2)
                // Buscamos el registro anterior a este reconteo
                const prevRecord = info.records.find(pr => pr.date < r.date && (pr.tipo === 1 || pr.tipo === 2));
                if (prevRecord && prevRecord.raw.conteo_items && prevRecord.raw.conteo_items.length > 0) {
                    prevRecord.raw.conteo_items.forEach(item => {
                        const itemName = item.item?.descripcion || item.descripcion || 'Item Desconocido';
                        itemsInRecount.add(itemName);
                    });
                } else {
                    // Si no hay contexto previo, se marca como general
                    itemsInRecount.add('Item General / Sin Detalle');
                }
            }

            // Sumar al mapa global (solo una vez por reconteo)
            itemsInRecount.forEach(itemName => {
                if (!itemRecountMap[itemName]) itemRecountMap[itemName] = 0;
                itemRecountMap[itemName]++;
            });
        }
    });
    // -----------------------------------------------

    // Diferencias & Anomalías
    let productsWithDiff = 0;
    if (prev) {
        // Nueva lógica: Contar cuántos PRODUCTOS (SKUs) tienen diferencia, no unidades totales
        const itemsLast = last.raw.conteo_items || [];
        const itemsPrev = prev.raw.conteo_items || [];

        if (itemsLast.length === 0 && itemsPrev.length === 0) {
             // Fallback: si no hay detalle, comparamos total
             if ((last.qty || 0) !== (prev.qty || 0)) productsWithDiff = 1;
        } else {
             const mapLast = new Map();
             itemsLast.forEach(i => mapLast.set(String(i.item_id || i.codigo || 'unk'), Number(i.cantidad)));
             const mapPrev = new Map();
             itemsPrev.forEach(i => mapPrev.set(String(i.item_id || i.codigo || 'unk'), Number(i.cantidad)));
             
             const allKeys = new Set([...mapLast.keys(), ...mapPrev.keys()]);
             for (const key of allKeys) {
                 if ((mapLast.get(key) || 0) !== (mapPrev.get(key) || 0)) productsWithDiff++;
             }
        }

        totalDiffAbs += productsWithDiff;
        if (productsWithDiff > 0) locationsWithDiff++;
    }

    // Análisis de Reconteos (T3/T4 vs T1/T2) y Coincidencia T1 vs T2
    const t1 = info.records.find(r => r.tipo === 1);
    const t2 = info.records.find(r => r.tipo === 2);

    // Coincidencia T1 vs T2
    if (t1 && t2) {
        totalComparisonsT1T2++;
        if (Number(t1.qty) === Number(t2.qty)) matchesT1T2++;
    }

    if (info.reconteoCount > 0) {
        // Buscar la "Verdad": Preferir Tipo 4 (Final), sino el último Tipo 3 (Reconteo)
        // Como info.records está ordenado por fecha (asc), iteramos desde el final.
        let finalTruth = null;
        for (let i = info.records.length - 1; i >= 0; i--) {
            const r = info.records[i];
            if (r.tipo === 4 || r.tipo === 3) {
                finalTruth = r;
                break;
            }
        }
        
        if (finalTruth && (t1 || t2)) {
            totalRecountsAnalyzed++;
            const truthQty = Number(finalTruth.qty);
            
            if (t1 && Number(t1.qty) === truthQty) recountMatchesT1++;
            if (t2 && Number(t2.qty) === truthQty) recountMatchesT2++;
        }
    }

    // Anomalías
    const diffAbs = (last?.qty ?? 0) - (prev?.qty ?? 0);
    // Usar productsWithDiff para detectar anomalías incluso si la diferencia neta es 0 (cruce de referencias)
    if (productsWithDiff > 0 || diffAbs !== 0) {
        const diffPercent = (prev && prev.qty !== 0) ? Number(((diffAbs / prev.qty) * 100).toFixed(1)) : null;
        anomalies.push({
            ubicacion: `${info.zona} > Ub ${last?.raw?.ubicacion?.nombre || 'S/N'}`,
            producto: last?.raw?.conteo_items?.[0]?.item?.descripcion || 'Varios',
            diff_abs: diffAbs, // Mantenemos diff neta para referencia
            products_diff: productsWithDiff, // Nuevo campo
            diff_percent: diffPercent,
            reconteos: info.reconteoCount,
            prioridad: (Math.abs(diffAbs) > 10 || productsWithDiff > 2) ? 'alta' : 'media',
            situacion: productsWithDiff > 0 
              ? `Diferencias en ${productsWithDiff} productos (Neto: ${diffAbs} uds).`
              : `Diferencia de ${diffAbs} unidades.`
        });
    }
  }

  // 5. KPIs Derivados
  const avgDiffPerLocation = ubicacionesUnicas > 0 ? Number((totalDiffAbs / ubicacionesUnicas).toFixed(2)) : 0;
  const errorRate = ubicacionesUnicas > 0 ? Number(((locationsWithDiff / ubicacionesUnicas) * 100).toFixed(1)) : 0;
  const pctMatchT1 = totalRecountsAnalyzed > 0 ? Number(((recountMatchesT1 / totalRecountsAnalyzed) * 100).toFixed(1)) : 0;
  const pctMatchT2 = totalRecountsAnalyzed > 0 ? Number(((recountMatchesT2 / totalRecountsAnalyzed) * 100).toFixed(1)) : 0;
  const pctMatchT1vsT2 = totalComparisonsT1T2 > 0 ? Number(((matchesT1T2 / totalComparisonsT1T2) * 100).toFixed(1)) : 0;
  const effectivenessRatio = pctMatchT2 > 0 ? Number((pctMatchT1 / pctMatchT2).toFixed(2)) : (pctMatchT1 > 0 ? 100 : 0);

  // 6. Estadísticas por Colaborador (Precisión y Participación)
  const collabStats = {};
  
  // Helper para obtener mapa de items (SKU -> Cantidad)
  const getItemMap = (c) => {
      const map = new Map();
      if (c.raw && c.raw.conteo_items && c.raw.conteo_items.length > 0) {
          c.raw.conteo_items.forEach(i => {
              // Usar item_id o codigo como clave única
              const key = String(i.item_id || i.codigo || i.descripcion || 'unk');
              map.set(key, Number(i.cantidad));
          });
      } else {
          // Fallback si no hay detalle: Usar "TOTAL" como único item
          map.set('__TOTAL__', Number(c.qty));
      }
      return map;
  };

  // Primera pasada: Recolectar datos básicos (Volumen en SKUs)
  data.forEach(c => {
      // EXCLUIR TIPO 4 (Ajustes/Finalizaciones) del conteo de participación
      // Estos son roles administrativos, no de conteo físico primario.
      if (c.tipo_conteo === 4) return;

      const name = c.usuario_nombre || c.correo_empleado || 'Desconocido';
      if (!collabStats[name]) collabStats[name] = { 
          ubicaciones: new Set(), 
          items: 0, // Ahora representa SKUs/Registros
          verifiedSkus: 0, 
          correctSkus: 0 
      };
      collabStats[name].ubicaciones.add(c.ubicacion_id);
      // Cambiado: Sumar filas (SKUs) en lugar de cantidades (Unidades)
      collabStats[name].items += getRows(c);
  });

  // Segunda pasada: Calcular precisión (SKU Match Rate) usando locationMap
  for (const [uid, info] of locationMap.entries()) {
      // Determinar la verdad final de esta ubicación
      let finalTruth = null;
      for (let i = info.records.length - 1; i >= 0; i--) {
          const r = info.records[i];
          if (r.tipo === 4 || r.tipo === 3) {
              finalTruth = r;
              break;
          }
      }

      if (finalTruth) {
          const truthMap = getItemMap(finalTruth);
          
          // Evaluar a todos los que contaron en esta ubicación
          info.records.forEach(r => {
              // Evaluamos T1, T2 y T3 (Reconteos) contra la verdad final
              // Si el usuario hizo un reconteo (T3) y ese reconteo ES la verdad final,
              // entonces su precisión es 100% (se compara consigo mismo, lo cual es correcto: su conteo prevaleció).
              if (r.tipo === 1 || r.tipo === 2 || r.tipo === 3) {
                  const name = r.userName || 'Desconocido';
                  
                  // Solo procesar si el usuario existe en collabStats (es decir, no fue filtrado en la primera pasada)
                  if (collabStats[name]) {
                      const userMap = getItemMap(r);
                      
                      // Iterar sobre lo que contó el usuario
                      for (const [sku, qty] of userMap.entries()) {
                          collabStats[name].verifiedSkus++;
                          // Verificar si coincide con la verdad
                          if (truthMap.has(sku) && truthMap.get(sku) === qty) {
                              collabStats[name].correctSkus++;
                          }
                      }
                  }
              }
          });
      }
  }

  const collaboratorTable = Object.entries(collabStats).map(([name, s]) => ({
      colaborador: name,
      ubicaciones: s.ubicaciones.size,
      items: s.items, // Total SKUs contados
      participacion: ubicacionesUnicas > 0 ? Number(((s.ubicaciones.size / ubicacionesUnicas) * 100).toFixed(1)) : 0,
      // Precisión basada en SKUs verificados
      precision: s.verifiedSkus > 0 ? Number(((s.correctSkus / s.verifiedSkus) * 100).toFixed(1)) : 0,
      evaluados: s.verifiedSkus
  })).sort((a,b) => b.items - a.items); // Ordenar por volumen de SKUs

  const avgLocationsPerCollab = collaboratorTable.length > 0 
      ? Math.round(collaboratorTable.reduce((sum, c) => sum + c.ubicaciones, 0) / collaboratorTable.length) 
      : 0;

  // 7. Tiempos por Zona
  const zoneStats = {};
  data.forEach(c => {
      if (c.fecha_inicio && c.fecha_fin) {
          const zona = c.zona || c.ubicacion?.pasillo?.zona?.nombre || 'General';
          const mins = (new Date(c.fecha_fin) - new Date(c.fecha_inicio)) / 1000 / 60;
          if (mins > 0 && mins < 120) {
              if (!zoneStats[zona]) zoneStats[zona] = { totalMins: 0, count: 0 };
              zoneStats[zona].totalMins += mins;
              zoneStats[zona].count++;
          }
      }
  });

  const zoneTable = Object.entries(zoneStats).map(([zona, s]) => ({
      zona,
      tiempoPromedio: s.count > 0 ? `${Math.round(s.totalMins / s.count)} min` : 'N/D'
  }));

  // 8. Velocidad Global
  let totalMinutos = 0, conteosConTiempo = 0, rowsForSpeed = 0;
  data.forEach(c => {
      if (c.fecha_inicio && c.fecha_fin) {
          const mins = (new Date(c.fecha_fin) - new Date(c.fecha_inicio)) / 1000 / 60;
          if (mins > 0.1 && mins < 300) {
              totalMinutos += mins;
              conteosConTiempo++;
              rowsForSpeed += getRows(c);
          }
      }
  });
  const itemsPorHora = (conteosConTiempo > 0 && totalMinutos > 0) ? Number(((rowsForSpeed / totalMinutos) * 60).toFixed(0)) : 0;

  // 9. Anomalies Top 10
  const anomaliesTop10 = anomalies.sort((a,b) => b.diff_abs - a.diff_abs).slice(0, 10);

  // Calcular Confidence Score dinámico
  // Base 100, resta por tasa de error y baja efectividad
  let calculatedScore = 100;
  calculatedScore -= (errorRate * 0.5); // Si errorRate es 60%, resta 30 pts -> 70
  if (effectivenessRatio < 50) calculatedScore -= 10; // Penalización por baja efectividad
  if (avgDiffPerLocation > 100) calculatedScore -= 10; // Penalización por altas diferencias
  const confidenceScore = Math.max(0, Math.round(calculatedScore));
  
  // 10. Tendencia de Reconteos (Robust & Timezone Aware)
  const reconteosPerDayMap = {};
  const processedRecountIds = new Set(); // Evitar duplicados si la data viene sucia

  data.filter(c => c.tipo_conteo === 3).forEach(c => {
      // Validación de unicidad
      if (c.id && processedRecountIds.has(c.id)) return;
      if (c.id) processedRecountIds.add(c.id);

      const rawDate = c.created_at || c.createdAt;
      if (!rawDate) return;
      const dateObj = new Date(rawDate);
      if (isNaN(dateObj.getTime())) return;
      
      // Usar fecha local (Colombia/Perú UTC-5) para evitar que conteos de la noche pasen al día siguiente
      // Si no se puede determinar, se usa ISO pero ajustado manualmente a -5h como fallback seguro para Latam
      let d;
      try {
          d = dateObj.toLocaleDateString('es-CO', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' });
          // Formato es-CO suele ser DD/MM/YYYY, lo invertimos a YYYY-MM-DD para ordenar
          const parts = d.split('/');
          if (parts.length === 3) d = `${parts[2]}-${parts[1]}-${parts[0]}`;
          else d = dateObj.toISOString().slice(0,10);
      } catch (e) {
          // Fallback manual a UTC-5
          const adjustedDate = new Date(dateObj.getTime() - (5 * 60 * 60 * 1000));
          d = adjustedDate.toISOString().slice(0,10);
      }

      reconteosPerDayMap[d] = (reconteosPerDayMap[d] || 0) + 1;
  });
  const reconteosPerDay = Object.keys(reconteosPerDayMap).sort().map(date => ({ date, count: reconteosPerDayMap[date] }));

  // Calcular Tendencia (Regresión Lineal Simple)
  let reconteosTrend = 'Estable ➡️';
  if (reconteosPerDay.length >= 2) {
      const counts = reconteosPerDay.map(d => d.count);
      const n = counts.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
      for (let i = 0; i < n; i++) {
          sumX += i;
          sumY += counts[i];
          sumXY += i * counts[i];
          sumXX += i * i;
      }
      const denominator = (n * sumXX - sumX * sumX);
      if (denominator !== 0) {
        const slope = (n * sumXY - sumX * sumY) / denominator;
        if (slope > 0.5) reconteosTrend = 'Creciente ⚠️';
        else if (slope < -0.5) reconteosTrend = 'Decreciente ✅';
      }
  }

  // 11. Top Items Recounted
  const topRecountedItems = Object.entries(itemRecountMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalConteos,
    totalUnidadesFisicas,
    totalSKUsFisicos,
    esfuerzoTotalRows: data.length, // Simplificado
    ubicacionesUnicas,
    avance,
    reconteos: data.filter(c => c.tipo_conteo === 3).length,
    itemsPorHora,
    confidenceScore,
    anomaliesTop10,
    reconteosPerDay,
    reconteosTrend,
    // New KPIs
    avgLocationsPerCollab,
    avgDiffPerLocation,
    errorRate,
    pctMatchT1,
    pctMatchT2,
    pctMatchT1vsT2,
    effectivenessRatio,
    totalDiffAbs,
    collaboratorTable,
    zoneTable,
    topRecountedItems
  };
};

/* ------------------ generateOperatorReport (mantener) ------------------ */
export const generateOperatorReport = async (data) => {
  const { operatorName, totalLocations, accuracyRate, errorLocations, totalItemsCounted } = data;

  const prompt = `
    Actúa como un supervisor de auditoría de inventario. Analiza el desempeño del operador "${operatorName}" basado en los siguientes datos:

    DATOS DEL OPERADOR:
    - Ubicaciones Contadas: ${totalLocations}
    - Total Items Contados: ${totalItemsCounted}
    - Tasa de Precisión (Coincidencia con Conteo Final): ${accuracyRate}%
    - Cantidad de Errores Detectados: ${errorLocations.length}

    DETALLE DE ERRORES (Muestra de discrepancias):
    ${errorLocations.slice(0, 5).map(e => `- En ${e.location}: Contó ${e.counted}, Real era ${e.real} (Item: ${e.item})`).join('\n')}

    Genera un reporte de retroalimentación constructiva en Markdown que incluya:
    1. 👤 **Evaluación de Desempeño**: Resumen de su fiabilidad y velocidad.
    2. 🎯 **Análisis de Precisión**: ¿Es confiable? ¿Tiende a contar de más o de menos?
    3. 🛑 **Áreas de Mejora**: Basado en los errores, ¿qué debe corregir? (Atención al detalle, conteo de packs, etc).
    4. ✅ **Conclusión**: ¿Se recomienda mantenerlo en conteos críticos?

    Sé directo, profesional y motivador pero firme con los errores.
  `;

  const completion = await openai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "gpt-3.5-turbo",
    temperature: 0.7,
    max_tokens: 1200
  });

  return completion.choices[0].message.content;
};