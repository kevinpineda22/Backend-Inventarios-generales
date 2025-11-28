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

    // 4. Construir Prompt Avanzado
    const prompt = buildInventoryPrompt({
      bodegaNombre,
      stats,
      sampleConteos: conteos,
      ubicacionesConflicto: stats.ubicacionesConflicto
    });

    // 5. Llamar a OpenAI (pedimos JSON estricto desde system message y temperature 0.0)
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "Eres un Auditor Senior de Inventarios. TU SALIDA DEBE SER EXCLUSIVAMENTE UN JSON VALIDO (UN SOLO OBJETO). No incluyas texto adicional, ni markdown, ni explicaciones. Usa sólo los datos proporcionados."
        },
        { role: "user", content: prompt }
      ],
      model: "gpt-3.5-turbo",
      temperature: 0.0,
      max_tokens: 3500,
    });

    const raw = completion.choices?.[0]?.message?.content;
    // Intentar parseo seguro
    const parsed = parseJSONFromText(raw);
    if (parsed) return parsed;

    // Si no pudimos parsear, devolvemos el raw para debugging (o lanzar error)
    // Pero preferimos devolver un objeto con raw para que frontend no rompa
    return { __raw: raw, warning: 'No se pudo parsear JSON. Revisa respuesta del modelo.' };

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
  // Stats now include confidenceScore and reconteosTrend
  const s = {
    totalConteos: stats.totalConteos ?? 0,
    totalUnidadesFisicas: stats.totalUnidadesFisicas ?? 0,
    totalSKUsFisicos: stats.totalSKUsFisicos ?? 0,
    esfuerzoTotalItems: stats.esfuerzoTotalItems ?? 0,
    esfuerzoTotalRows: stats.esfuerzoTotalRows ?? 0,
    ubicacionesUnicas: stats.ubicacionesUnicas ?? 0,
    avance: stats.avance ?? 0,
    itemsPorHora: stats.itemsPorHora ?? 0,
    reconteos: stats.reconteos ?? 0,
    tasaDiscrepancia: stats.tasaError ?? 0,
    anomaliesTop10: stats.anomaliesTop10 || [],
    operatorsCorrectTop: stats.operatorsCorrectTop || [],
    operatorsReconTop: stats.operatorsReconTop || [],
    reconteosPerDay: stats.reconteosPerDay || [],
    confidenceScore: stats.confidenceScore ?? null,
    reconteosTrend: stats.reconteosTrend ?? 'N/D'
  };

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

ESTADÍSTICAS CLAVE:
- totalConteos (Sesiones): ${s.totalConteos}
- totalUnidadesFisicas (Volumen Total de Unidades): ${s.totalUnidadesFisicas}
- totalItemsContados (Referencias/SKUs Escaneados): ${s.totalSKUsFisicos}
- esfuerzoOperativo (Total de líneas/registros procesados): ${s.esfuerzoTotalRows}
- ubicacionesUnicas: ${s.ubicacionesUnicas}
- avance: ${s.avance} %
- velocidadPromedio: ${s.itemsPorHora} registros/hora
- reconteos totales: ${s.reconteos}
- tasaDiscrepancia: ${s.tasaDiscrepancia} %
- confidenceScore: ${s.confidenceScore}
- reconteosTrend: ${s.reconteosTrend}

MUESTRAS (máx 10):
${sampleLines || '- No hay muestras -'}

ANOMALIES_TOP10 (ya priorizadas por el sistema):
${(s.anomaliesTop10 || []).map(a => `- ${a.ubicacion} | Producto: ${a.producto} | last:${a.reported_last} | prev:${a.reported_prev} | diff%:${a.diff_percent} | reconteos:${a.reconteos} | prioridad:${a.prioridad}`).join('\n')}

OPERADORES (Top precisión y Top reconteos):
${(s.operatorsCorrectTop || []).map(o => `- ${o.name}: ${o.matches}/${o.comparisons} ok (${o.accuracyPct ?? 'N/D'}%)`).join('\n')}
${(s.operatorsReconTop || []).map(o => `- ${o.name}: ${o.reconteosCaused} reconteos`).join('\n')}

RECONTEOS POR DÍA (serie): ${JSON.stringify(s.reconteosPerDay)}

--- SALIDA REQUERIDA: JSON único ---
Genera exactamente un objeto JSON con la estructura (rellena datos y textos en Markdown donde corresponda):

{
  "resumenEjecutivo": "Markdown: 4-6 párrafos. Debe ser descriptivo: (1) descripción del estado actual (cifras clave) (2) causas probables (ej: falta conteo final, ubicaciones sin ID, sesiones abiertas) (3) impacto (unidades y tiempo) (4) prioridades (qué auditar primero).",
  "kpis": {
    "totalUnidades": ${s.totalUnidadesFisicas},
    "totalItems": ${s.totalSKUsFisicos},
    "esfuerzoOperativo": ${s.esfuerzoTotalRows},
    "tasaDiscrepancia": ${s.tasaDiscrepancia},
    "velocidad": ${s.itemsPorHora},
    "confidenceScore": ${s.confidenceScore}
  },
  "analisisProductividad": "Markdown: listar operadores destacados con items, comparisons, matches y % acierto. Incluir breve comentario sobre reconteosTrend: ${s.reconteosTrend}.",
  "hallazgos": [
    "Hallazgo 1 (quantificado)",
    "Hallazgo 2"
  ],
  "anomalias": [
    {
      "ubicacion": "Zona > Pasillo > Ub",
      "producto": "Nombre del producto (si disponible)",
      "situacion": "Descripción breve (ej: 'Diferencia de -12 u. tras 4 reconteos')",
      "accion": "Verificar discrepancia encontrada para confirmar stock final",
      "prioridad": "alta"
    }
  ],
  "acciones": [
    { "actor": "Nombre", "accion": "Qué hacer", "impacto": "Impacto esperado (ej: 'Recuperar 500 unidades')", "prioridad": "alta" }
  ],
  "operators": {
    "top_correct": [{ "name":"X", "items":420, "comparisons":50, "matches":49, "accuracyPct":98 }],
    "top_reconteos": [{ "name":"Y", "reconteosCaused":12 }]
  },
  "reconteos_per_day": ${JSON.stringify(s.reconteosPerDay)},
  "trend_comment": "Breve comentario (sube/baja/estable) basado en la serie de reconteos",
  "sql_checks": [
    "SELECT ... último conteo por ubicacion ...",
    "SELECT ... reconteos por usuario ..."
  ],
  "conclusion": "Markdown: 1-2 párrafos priorizando la acción principal"
}

IMPORTANTE:
- El campo "resumenEjecutivo" debe mencionar **números exactos** (ej: \"Se detectaron 24 reconteos que afectan 18 ubicaciones, representando 60% de las ubicaciones analizadas\").
- En "anomalias_top10" NO recomiendes otro reconteo; recomienda \"Verificar discrepancia encontrada para confirmar stock final\" o \"Validar físicamente\".
- En "operators", incluye la lista COMPLETA de operadores disponibles en los datos (hasta 50), no los resumas.
- El "trend_comment" debe usar la serie reconteos_per_day y decir si está 'Aumentando', 'Disminuyendo' o 'Estable', con valores numéricos si aplica.
- Usa 'totalItemsContados' (SKUs) como 'Items Contados' en el texto, y 'totalUnidadesFisicas' como 'Total Unidades'.
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
    reconteosPerDay: [], confidenceScore: 0, reconteosTrend: null
  };

  const totalConteos = data.length;

  // Ubicaciones únicas y finalizadas
  const ubicacionesSet = new Set(data.map(c => c.ubicacion_id));
  const ubicacionesUnicas = ubicacionesSet.size;
  const ubicacionesFinalizadasSet = new Set(
    data.filter(c => c.estado === 'finalizado').map(c => c.ubicacion_id)
  );
  const ubicacionesFinalizadas = ubicacionesFinalizadasSet.size;

  // Esfuerzo total (suma de items contados en todas las pasadas)
  // Priorizamos la suma de conteo_items. Si no existe, usamos total_items (pero con cuidado)
  const getQty = (c) => {
      if (c.conteo_items && c.conteo_items.length > 0) {
          return c.conteo_items.reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0);
      }
      // Si total_items es muy pequeño (< 10) y no hay items, sospechamos que es row count.
      // Pero si no tenemos otra info, lo usamos.
      return Number(c.total_items || 0);
  };

  const getRows = (c) => {
      if (c.conteo_items && c.conteo_items.length > 0) {
          return c.conteo_items.length;
      }
      return c.total_items ? 1 : 0;
  };

  const esfuerzoTotalItems = data.reduce((acc, c) => acc + getQty(c), 0);
  const esfuerzoTotalRows = data.reduce((acc, c) => acc + getRows(c), 0);

  // Construir historial por ubicación
  const locationMap = new Map(); // uid -> { records: [], reconteoCount }
  data.forEach(c => {
    const uid = c.ubicacion_id || `${c.bodega}::${c.zona}::${c.pasillo}::${c.ubicacion}`;
    const qty = getQty(c);
    const date = new Date(c.created_at || c.createdAt || Date.now());
    const rec = { qty, tipo: c.tipo_conteo, date, userId: c.usuario_id, userName: c.usuario_nombre || c.correo_empleado || null, raw: c };
    if (!locationMap.has(uid)) locationMap.set(uid, { records: [], reconteoCount: 0 });
    locationMap.get(uid).records.push(rec);
    if (c.tipo_conteo === 3) locationMap.get(uid).reconteoCount++;
  });

  // Ordenar y extraer diffs
  let totalUnidadesFisicas = 0;
  let totalSKUsFisicos = 0;
  const anomalies = [];
  for (const [uid, info] of locationMap.entries()) {
    info.records.sort((a,b) => a.date - b.date);
    const last = info.records[info.records.length - 1];
    const prev = info.records.length >= 2 ? info.records[info.records.length - 2] : null;
    info.last = last; info.prev = prev;
    totalUnidadesFisicas += (last?.qty || 0);
    
    // Calcular SKUs (filas) del último conteo
    const lastRows = last?.raw?.conteo_items?.length || (last?.raw?.total_items ? 1 : 0);
    totalSKUsFisicos += lastRows;

    const diffAbs = (last?.qty ?? 0) - (prev?.qty ?? null);
    const diffPercent = (prev && prev.qty !== 0) ? Number(((diffAbs / prev.qty) * 100).toFixed(1)) : null;

    // Filtrar anomalías: Si la diferencia es 0, NO es una anomalía activa (ya se estabilizó o coincidió)
    if (diffAbs === 0) continue;

    // Si la ubicación ya fue finalizada, no la reportamos como anomalía pendiente
    if (ubicacionesFinalizadasSet.has(uid)) continue;

    const zona = last?.raw?.ubicacion?.pasillo?.zona?.nombre || last?.raw?.zona || 'Zona ?';
    const pasillo = last?.raw?.ubicacion?.pasillo?.numero || last?.raw?.pasillo || '?';
    const ubicLabel = last?.raw?.ubicacion?.nombre || last?.raw?.ubicacion?.numero || 'S/N';
    
    const firstItem = last?.raw?.conteo_items?.[0]?.item?.descripcion || 'Producto desconocido';
    const totalItemsInLoc = last?.raw?.conteo_items?.length || 0;
    const producto = totalItemsInLoc > 1 ? `${firstItem} (+${totalItemsInLoc - 1} otros)` : firstItem;

    anomalies.push({
      ubicacion_id: uid,
      ubicacion: `${zona} > Pasillo ${pasillo} > Ubicación ${ubicLabel}`,
      producto,
      reported_last: last?.qty ?? 0,
      reported_prev: prev?.qty ?? null,
      diff_abs: diffAbs,
      diff_percent: diffPercent,
      reconteos: info.reconteoCount,
      last_date: last?.date?.toISOString?.() ?? null,
      last_user: last?.userName ?? null
    });
  }

  // Priorizar anomalías: reconteos desc, abs(diff%) desc, abs(diff_abs) desc
  const anomaliesSorted = anomalies.sort((a,b) => {
    if (b.reconteos !== a.reconteos) return b.reconteos - a.reconteos;
    const aPct = Math.abs(a.diff_percent ?? 0), bPct = Math.abs(b.diff_percent ?? 0);
    if (bPct !== aPct) return bPct - aPct;
    return Math.abs(b.diff_abs ?? 0) - Math.abs(a.diff_abs ?? 0);
  });
  const anomaliesTop10 = anomaliesSorted.slice(0, 10).map(a => {
    // prioridad heurística
    const prioridad = a.reconteos >= 3 || Math.abs(a.diff_percent ?? 0) >= 50 ? 'alta'
                    : Math.abs(a.diff_percent ?? 0) >= 20 ? 'media' : 'baja';
    return { ...a, prioridad };
  });

  // Reconteos (counts)
  const reconteos = data.filter(c => c.tipo_conteo === 3).length;
  const reconteosUnicosPorUbicacion = new Set(data.filter(c => c.tipo_conteo === 3).map(c => c.ubicacion_id)).size;

  // Velocidad (items/min and items/h)
  // CORRECCIÓN: Usar 'rows' (registros escaneados) para velocidad, no unidades totales.
  // Y sumar solo los items de los conteos que tienen tiempo válido.
  let totalMinutos = 0, conteosConTiempo = 0;
  let rowsForSpeed = 0;

  data.forEach(c => {
    if (c.fecha_inicio && c.fecha_fin) {
      const diffMinutos = (new Date(c.fecha_fin) - new Date(c.fecha_inicio)) / 1000 / 60;
      const rowsEnConteo = getRows(c);
      
      // Filtrar tiempos absurdos o zombies (ej: > 30 min para < 5 items)
      const esZombie = diffMinutos > 30 && rowsEnConteo < 5;
      
      if (diffMinutos > 0.1 && diffMinutos < 300 && !esZombie) {
        totalMinutos += diffMinutos; 
        conteosConTiempo++;
        rowsForSpeed += rowsEnConteo;
      }
    }
  });

  // Velocidad en Registros por Minuto/Hora
  const velocidadPromedio = (conteosConTiempo > 0 && totalMinutos > 0) ? Number((rowsForSpeed / totalMinutos).toFixed(1)) : null;
  const itemsPorHora = (conteosConTiempo > 0 && totalMinutos > 0) ? Number(((rowsForSpeed / totalMinutos) * 60).toFixed(0)) : 0;

  // Estadísticas por operador
  const userStats = {};
  
  // Helper para normalizar nombres
  const getNormalizedName = (c) => {
    const userId = c.usuario_id;
    const userEmail = (c.correo_empleado || '').toLowerCase();
    const userNameKey = (c.usuario_nombre || '').toLowerCase();
    let name = namesMap.get(userId) || namesMap.get(userEmail) || namesMap.get(userNameKey);
    if (!name) {
      const raw = c.usuario_nombre || c.correo_empleado || c.usuario_id || 'Desconocido';
      name = raw.includes('@') ? raw.split('@')[0] : raw;
      name = name.charAt(0).toUpperCase() + name.slice(1);
    }
    return name;
  };

  data.forEach(c => {
    const name = getNormalizedName(c);
    if (!userStats[name]) userStats[name] = { items: 0, comparisons: 0, matches: 0, reconteosCaused: 0 };
    const val = Number(c.total_items || c.conteo_items?.reduce((a, b) => a + (Number(b.cantidad) || 0), 0) || 0);
    userStats[name].items += val;
    if ((c.tipo_conteo === 1 || c.tipo_conteo === 2) && locationMap.has(c.ubicacion_id)) {
      userStats[name].comparisons++;
      const finalQty = locationMap.get(c.ubicacion_id).last?.qty ?? null;
      if (finalQty !== null && finalQty === val) userStats[name].matches++;
    }
    // NOTA: Ya no sumamos reconteosCaused aquí simplemente por ser tipo 3.
    // Se calculará analizando quién falló en la comparación.
  });

  // Análisis de Culpabilidad de Reconteos (Quién causó el reconteo)
  for (const [uid, info] of locationMap.entries()) {
    const records = info.records; // Ya están ordenados por fecha
    
    // Buscar si hubo un reconteo (tipo 3)
    const t3 = records.find(r => r.tipo === 3);
    if (!t3) continue;

    // Buscar los conteos previos (tipo 1 y 2) más recientes antes del reconteo
    // Asumimos que records está ordenado ascendente por fecha
    const t1 = records.filter(r => r.tipo === 1 && r.date < t3.date).pop();
    const t2 = records.filter(r => r.tipo === 2 && r.date < t3.date).pop();

    if (t1 && t2) {
      const q1 = t1.qty;
      const q2 = t2.qty;
      const q3 = t3.qty;

      // Si q1 != q2, hubo discrepancia que causó el reconteo.
      // Si q3 coincide con q1, entonces q2 estaba mal -> Culpa de T2
      // Si q3 coincide con q2, entonces q1 estaba mal -> Culpa de T1
      // Si q3 es diferente a ambos, ambos fallaron -> Culpa compartida (o del sistema)

      const name1 = getNormalizedName(t1.raw);
      const name2 = getNormalizedName(t2.raw);

      // Asegurar que existan en stats (deberían, por el loop anterior)
      if (!userStats[name1]) userStats[name1] = { items: 0, comparisons: 0, matches: 0, reconteosCaused: 0 };
      if (!userStats[name2]) userStats[name2] = { items: 0, comparisons: 0, matches: 0, reconteosCaused: 0 };

      if (q3 === q1 && q3 !== q2) {
        userStats[name2].reconteosCaused++; // T2 falló
      } else if (q3 === q2 && q3 !== q1) {
        userStats[name1].reconteosCaused++; // T1 falló
      } else {
        // Ninguno coincidió exactamente con el reconteo.
        // Asignamos la culpa al que estuvo MÁS LEJOS del valor real (q3).
        const diff1 = Math.abs(q3 - q1);
        const diff2 = Math.abs(q3 - q2);

        if (diff1 < diff2) {
          // T1 estuvo más cerca, culpamos a T2
          userStats[name2].reconteosCaused++;
        } else if (diff2 < diff1) {
          // T2 estuvo más cerca, culpamos a T1
          userStats[name1].reconteosCaused++;
        } else {
          // Ambos estuvieron igual de lejos (o igual de mal), culpamos a ambos
          userStats[name1].reconteosCaused++;
          userStats[name2].reconteosCaused++;
        }
      }
    }
  }

  const operatorsCorrectTop = Object.entries(userStats)
    .map(([name, s]) => {
      const accuracyPct = s.comparisons > 0 ? Number(((s.matches / s.comparisons) * 100).toFixed(0)) : null;
      return { name, items: s.items, comparisons: s.comparisons, matches: s.matches, accuracyPct, reconteosCaused: s.reconteosCaused };
    })
    // .filter(u => u.comparisons > 0) // Eliminamos filtro estricto para mostrar más operadores si hay pocos datos
    .sort((a,b) => (b.matches - a.matches) || (b.accuracyPct - a.accuracyPct))
    .slice(0, 50); // Aumentamos slice a 50 para mostrar todos los operadores posibles

  const operatorsReconTop = Object.entries(userStats)
    .map(([name, s]) => ({ name, reconteosCaused: s.reconteosCaused, items: s.items }))
    .sort((a,b) => b.reconteosCaused - a.reconteosCaused)
    .slice(0, 50); // Aumentamos slice a 50

  // Top zonas / pasillos (actividad y errores)
  const zonaMap = {}; const errorZonaMap = {}; const errorPasilloMap = {};
  data.forEach(c => {
    const zonaNombre = c.ubicacion?.pasillo?.zona?.nombre || c.zona || 'Desconocida';
    zonaMap[zonaNombre] = (zonaMap[zonaNombre]||0) + 1;
    if (c.tipo_conteo === 3) {
      errorZonaMap[zonaNombre] = (errorZonaMap[zonaNombre]||0) + 1;
      const pasillo = c.ubicacion?.pasillo?.numero || c.pasillo || 'Desconocido';
      const key = `${zonaNombre} - Pasillo ${pasillo}`;
      errorPasilloMap[key] = (errorPasilloMap[key]||0) + 1;
    }
  });
  const topZonas = Object.entries(zonaMap).sort(([,a],[,b]) => b-a).slice(0,3).map(([n])=>n);
  const topErrorZonas = Object.entries(errorZonaMap).sort(([,a],[,b])=>b-a).slice(0,3).map(([n])=>n);
  const topErrorPasillos = Object.entries(errorPasilloMap).sort(([,a],[,b])=>b-a).slice(0,5).map(([k,v])=>`${k} (${v} errores)`);

  // Ubicaciones conflicto list (texto)
  const ubicacionesConflicto = anomaliesSorted.map(a => `- ${a.ubicacion}`).slice(0, 100);

  // Reconteos por día
  const reconteosPerDayMap = {};
  data.filter(c => c.tipo_conteo === 3).forEach(c => {
    const d = new Date(c.created_at || c.createdAt || Date.now());
    const key = d.toISOString().slice(0,10);
    reconteosPerDayMap[key] = (reconteosPerDayMap[key] || 0) + 1;
  });
  const reconteosPerDay = Object.keys(reconteosPerDayMap).sort().map(date => ({ date, count: reconteosPerDayMap[date] }));

  // --- Confidence score (simple heuristic) ---
  // componentes: % ubicaciones con conteo final, % sesiones con tiempo válido, inverso de tasa de reconteos
  const pctFinalizados = ubicacionesUnicas > 0 ? (ubicacionesFinalizadas / ubicacionesUnicas) : 0; // 0..1
  const pctSessionsWithTime = totalConteos > 0 ? (data.filter(c => c.fecha_inicio && c.fecha_fin).length / totalConteos) : 0;
  const reconteosFactor = reconteosUnicosPorUbicacion / Math.max(1, ubicacionesUnicas); // 0.. maybe >1
  // normalizar reconteosFactor a 0..1 (cappear)
  const reconteosNorm = Math.min(1, reconteosFactor * 1.5);
  const confidenceScore = Math.round(((pctFinalizados * 0.5) + (pctSessionsWithTime * 0.3) + ((1 - reconteosNorm) * 0.2)) * 100);

  // --- Trend comment for reconteos (simple slope over last 7 points)
  let reconteosTrend = 'Insuficientes datos';
  if (reconteosPerDay.length >= 3) {
    // compute slope of counts over dates (simple linear regression on index)
    const y = reconteosPerDay.map((r,i) => r.count);
    const n = y.length;
    const meanY = y.reduce((a,b) => a+b,0)/n;
    const meanX = (n-1)/2;
    let num = 0, den = 0;
    for (let i=0;i<n;i++){ num += (i-meanX)*(y[i]-meanY); den += (i-meanX)*(i-meanX); }
    const slope = den === 0 ? 0 : num/den;
    if (slope > 0.2) reconteosTrend = 'Aumentando';
    else if (slope < -0.2) reconteosTrend = 'Disminuyendo';
    else reconteosTrend = 'Estable';
  }

  return {
    totalConteos,
    totalUnidadesFisicas,
    totalSKUsFisicos,
    esfuerzoTotalItems,
    esfuerzoTotalRows,
    ubicacionesUnicas,
    ubicacionesFinalizadas,
    avance: Number(((ubicacionesFinalizadas / Math.max(1, ubicacionesUnicas)) * 100).toFixed(1)),
    reconteos,
    reconteosUnicosPorUbicacion,
    tasaError: Number(((reconteosUnicosPorUbicacion / Math.max(1, ubicacionesUnicas)) * 100).toFixed(1)),
    velocidadPromedio,
    itemsPorHora,
    topUsers: operatorsCorrectTop,
    topZonas,
    topErrorZonas,
    topErrorPasillos,
    ubicacionesConflicto,
    anomaliesTop10,
    operatorsCorrectTop,
    operatorsReconTop,
    reconteosPerDay,
    rawSamples: data.slice(0, 20),
    confidenceScore,
    reconteosTrend
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
