import OpenAI from 'openai';
import ConteoModel from '../models/Conteo.model.js';
import { supabase, supabaseAdmin } from '../config/supabase.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
              nombre: u.user_metadata?.nombre || u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0]
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
          // Mapa por ID (Soporte para user_id o id)
          const uid = p.user_id || p.id;
          if (uid) namesMap.set(uid, p.nombre);
          // Mapa por Correo
          if (p.correo) {
            namesMap.set(p.correo.toLowerCase(), p.nombre); // Normalizar a minúsculas
            // Mapa por "Username" (parte antes del @) para coincidir con logins cortos
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
      sampleConteos: conteos, // Enviamos todos, la función recortará
      ubicacionesConflicto: stats.ubicacionesConflicto // Pasamos los conflictos detectados previamente
    });

    // 5. Llamar a OpenAI
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "Eres un Auditor Senior de Inventarios. Tu salida debe ser EXCLUSIVAMENTE un objeto JSON válido. No incluyas markdown ```json``` ni texto adicional antes o después." },
        { role: "user", content: prompt }
      ],
      model: "gpt-3.5-turbo",
      temperature: 0.5,
      max_tokens: 3000,
      response_format: { type: "json_object" } // Forzar modo JSON si usas modelos recientes, si no, el prompt basta
    });

    return completion.choices[0].message.content;

  } catch (error) {
    console.error('Error generating AI report:', error);
    throw error;
  }
};

// --- NUEVA FUNCIÓN DE PROMPT AVANZADO ---
const buildInventoryPrompt = ({ bodegaNombre = 'General', stats = {}, sampleConteos = [], ubicacionesConflicto = [] }) => {
  // Normaliza campos de stats
  const s = {
    totalConteos: stats.totalConteos ?? 0,
    totalUnidadesFisicas: stats.totalUnidadesFisicas ?? 0, // Total Unidades Físicas
    esfuerzoTotalItems: stats.esfuerzoTotalItems ?? 0,
    ubicacionesUnicas: stats.ubicacionesUnicas ?? 0,
    ubicacionesFinalizadas: stats.ubicacionesFinalizadas ?? 0,
    avance: stats.avance ?? 0,
    velocidadPromedio: stats.velocidadPromedio ?? "N/A",
    itemsPorHora: stats.itemsPorHora ?? "0",
    reconteos: stats.reconteos ?? 0,
    tasaDiscrepancia: stats.tasaError ?? 0,
    topUsers: (stats.topUsers || []).map(u => `${u.name} (${u.items})`),
    topZonasReconteo: stats.topErrorZonas || [],
    topPasillosReconteo: stats.topErrorPasillos || []
  };

  // Formatea hasta 10 filas de muestra como objetos legibles para la IA
  // Seleccionamos preferiblemente filas con problemas (tipo_conteo 3) para que la IA vea ejemplos de errores
  const errorSamples = sampleConteos.filter(c => c.tipo_conteo === 3).slice(0, 5);
  const normalSamples = sampleConteos.filter(c => c.tipo_conteo !== 3).slice(0, 5);
  const mixedSamples = [...errorSamples, ...normalSamples];

  const sampleLines = mixedSamples.map(c => {
    const pasillo = c.ubicacion?.pasillo?.numero ?? c.pasillo ?? 'N/A';
    const zona = c.ubicacion?.pasillo?.zona?.nombre ?? c.zona ?? 'N/A';
    const ubicacion = c.ubicacion?.nombre ?? c.ubicacion?.numero ?? 'N/A';
    const itemsCount = c.total_items ?? (c.conteo_items?.[0]?.count ?? 0);
    const usuario = c.usuario_nombre || c.correo_empleado || 'Anon';
    const tipoTexto = c.tipo_conteo === 3 ? 'Discrepancia (Requiere Reconteo)' : 'Conteo Normal';
    
    return `- { Zona: "${zona}", Pasillo: "${pasillo}", Ubicacion: "${ubicacion}", Cantidad_Registrada: ${itemsCount}, Tipo: "${tipoTexto}", Usuario: "${usuario}" }`;
  }).join('\n');

  return `
Analiza los datos del inventario de la bodega "${bodegaNombre}".
A continuación recibes métricas resumidas y una muestra de registros reales.

MÉTRICAS GLOBALES:
- Sesiones Totales: ${s.totalConteos}
- 📦 TOTAL UNIDADES FÍSICAS (Inventario Real): ${s.totalUnidadesFisicas}
- Esfuerzo Operativo (total items contados en todas las pasadas): ${s.esfuerzoTotalItems}
- Ubicaciones Únicas: ${s.ubicacionesUnicas} (Finalizadas: ${s.ubicacionesFinalizadas})
- Avance Global: ${s.avance} %
- Velocidad Promedio: ${s.itemsPorHora} items/h (aprox ${s.velocidadPromedio} items/min)
- Total Discrepancias (Reconteos generados): ${s.reconteos}
- Tasa de Discrepancia: ${s.tasaDiscrepancia} % (Porcentaje de ubicaciones que requirieron 3er conteo por no coincidir C1 vs C2)
- Top Operadores: ${s.topUsers.join(', ') || 'N/A'}
- Zonas con más Discrepancias: ${s.topZonasReconteo.join(', ') || 'Ninguna'}
- Pasillos con más Discrepancias: ${s.topPasillosReconteo.join(', ') || 'Ninguno'}

UBICACIONES CONFLICTIVAS DETECTADAS (Lista Completa):
${ubicacionesConflicto.length > 0 ? ubicacionesConflicto.join('\n') : 'Ninguna reportada.'}

REGISTROS DE MUESTRA (Estructura real de datos):
${sampleLines || '- No hay filas de muestra -'}

INSTRUCCIONES DE SALIDA (FORMATO JSON):
Genera un objeto JSON con la siguiente estructura exacta:
{
  "resumenEjecutivo": "Texto en markdown del resumen ejecutivo...",
  "kpis": {
    "totalUnidades": ${s.totalUnidadesFisicas},
    "esfuerzoOperativo": ${s.esfuerzoTotalItems},
    "tasaDiscrepancia": ${s.tasaDiscrepancia},
    "velocidad": ${s.itemsPorHora}
  },
  "analisisProductividad": "Texto en markdown del análisis de productividad...",
  "hallazgos": [
    "Hallazgo 1...",
    "Hallazgo 2..."
  ],
  "acciones": [
    { "actor": "Nombre", "accion": "Acción...", "impacto": "Impacto esperado..." }
  ],
  "anomalias": [
    {
      "ubicacion": "Zona > Pasillo > Ubic",
      "situacion": "Descripción...",
      "cantidad": 0,
      "accion": "Recomendación..."
    }
  ],
  "conclusion": "Texto breve de conclusión..."
}

IMPORTANTE:
1. En "resumenEjecutivo", explica claramente la diferencia entre "Esfuerzo Operativo" (Total de conteos/scans realizados) y "Unidades Físicas" (Cantidad real final). Si el esfuerzo es mucho mayor, explica que esto implica ineficiencia por múltiples reconteos.
2. En "hallazgos", usa siempre el término "Reconteos" en lugar de "errores" y menciona que el objetivo es minimizarlos.
3. En "analisisProductividad", menciona explícitamente cuántos items contó cada operador destacado (ej: "Juan (500 items)").
4. En "anomalias", genera una tarjeta para CADA una de las ubicaciones listadas en "UBICACIONES CONFLICTIVAS DETECTADAS". No omitas ninguna.
   - IMPORTANTE: NO recomiendes "hacer un tercer conteo" o "reconteo". La recomendación debe ser "Verificar discrepancia encontrada para confirmar stock final" o "Validar físicamente la diferencia".
5. El contenido de los campos de texto (resumenEjecutivo, analisisProductividad) debe usar formato Markdown para negritas y listas.
6. Sé profesional y constructivo.
`.trim();
};

const calculateStats = (data, namesMap) => {
  if (!data || data.length === 0) return { totalConteos: 0, totalItems: 0, avance: 0, reconteos: 0, tasaError: 0, topUsers: [], topZonas: [], topErrorZonas: [], itemsPorHora: 0 };

  const totalConteos = data.length;
  
  // Calcular ubicaciones únicas
  const ubicacionesSet = new Set(data.map(c => c.ubicacion_id));
  const ubicacionesUnicas = ubicacionesSet.size;

  // Ubicaciones finalizadas
  const ubicacionesFinalizadasSet = new Set(
    data.filter(c => c.estado === 'finalizado').map(c => c.ubicacion_id)
  );
  const ubicacionesFinalizadas = ubicacionesFinalizadasSet.size;

  // Total items
  // const totalItems = data.reduce((acc, c) => acc + (c.total_items || (c.conteo_items ? c.conteo_items[0]?.count : 0) || 0), 0);
  
  // --- NUEVAS MÉTRICAS AVANZADAS ---

  // 1. Stock Real vs Esfuerzo Operativo
  // Esfuerzo: Todo lo que se contó (incluyendo errores y reconteos)
  const esfuerzoTotalItems = data.reduce((acc, c) => acc + (c.total_items || (c.conteo_items ? c.conteo_items[0]?.count : 0) || 0), 0);
  
  // Stock: Lo que realmente hay (Último estado válido de cada ubicación)
  const ubicacionMap = new Map();
  data.forEach(c => {
      // Si es conteo final (4) tiene prioridad absoluta. Si no, usamos el más reciente.
      const current = ubicacionMap.get(c.ubicacion_id);
      const cantidad = (c.total_items || (c.conteo_items ? c.conteo_items[0]?.count : 0) || 0);
      
      if (!current) {
          ubicacionMap.set(c.ubicacion_id, { tipo: c.tipo_conteo, cantidad, fecha: new Date(c.created_at) });
      } else {
          // Si el actual ya es final (4), no lo sobreescribimos a menos que este tambien sea 4 y mas nuevo (raro)
          if (current.tipo === 4) return;
          
          // Si este es 4, sobreescribimos
          if (c.tipo_conteo === 4) {
              ubicacionMap.set(c.ubicacion_id, { tipo: c.tipo_conteo, cantidad, fecha: new Date(c.created_at) });
          } 
          // Si ninguno es 4, nos quedamos con el más reciente
          else if (new Date(c.created_at) > current.fecha) {
              ubicacionMap.set(c.ubicacion_id, { tipo: c.tipo_conteo, cantidad, fecha: new Date(c.created_at) });
          }
      }
  });
  
  // Suma total de items (unidades físicas)
  const totalUnidadesFisicas = Array.from(ubicacionMap.values()).reduce((acc, val) => acc + val.cantidad, 0);

  // Suma total de productos únicos (SKUs distintos contados)
  // Nota: Esto requiere que 'data' traiga información de items. 
  // Si 'data' es solo conteos, necesitamos iterar sobre los items dentro de cada conteo si estuvieran disponibles.
  // Como 'findAll' trae 'conteo_items(count)', solo sabemos la cantidad de filas (SKUs distintos por conteo).
  // Para un estimado rápido de "Referencias Únicas", sumamos el 'count' de conteo_items de los conteos válidos.
  const referenciasUnicasEstimadas = Array.from(ubicacionMap.values()).reduce((acc, val) => {
      // Aquí asumimos que 'cantidad' es unidades totales. 
      // Si queremos SKUs distintos, necesitamos acceder al conteo original.
      // Como simplificación, usaremos el dato que ya tenemos o lo dejaremos como métrica separada si el backend lo soporta.
      return acc; // Placeholder si no tenemos el dato exacto de SKUs únicos globales
  }, 0);
  
  // Mejor aproximación con los datos actuales:
  // Si queremos saber "Total Unidades Físicas" -> stockEstimadoItems (Ya lo tenemos)
  // Si queremos saber "Total Referencias (SKUs)" -> Necesitamos extraer todos los item_id distintos.
  
  // Vamos a recolectar todos los items de los conteos seleccionados como "válidos" en el mapa
  // (Esto es costoso si no tenemos los items cargados, pero intentaremos con lo que hay)
  
  // 2. Clasificación de Diferencias (Solo en reconteos/ajustes)
  const reconteos = data.filter(c => c.tipo_conteo === 3).length;

  // 3. Velocidad Promedio (Items / Minuto y Hora)
  let totalMinutos = 0;
  let conteosConTiempo = 0;

  data.forEach(c => {
    if (c.fecha_inicio && c.fecha_fin) {
      const inicio = new Date(c.fecha_inicio);
      const fin = new Date(c.fecha_fin);
      const diffMinutos = (fin - inicio) / 1000 / 60;
      const itemsEnConteo = (c.total_items || (c.conteo_items ? c.conteo_items[0]?.count : 0) || 0);
      
      // Filtramos tiempos absurdos Y sesiones "zombies" (mucho tiempo, pocos items)
      // Regla: Si duró más de 30 min y se contaron menos de 10 items, probablemente se dejó abierta.
      const esZombie = diffMinutos > 30 && itemsEnConteo < 10;

      if (diffMinutos > 0.1 && diffMinutos < 240 && !esZombie) {
        totalMinutos += diffMinutos;
        conteosConTiempo++;
      }
    }
  });
  
  const velocidadPromedio = conteosConTiempo > 0 && totalMinutos > 0
    ? (esfuerzoTotalItems / totalMinutos).toFixed(1) 
    : "N/A";

  const itemsPorHora = conteosConTiempo > 0 && totalMinutos > 0
    ? ((esfuerzoTotalItems / totalMinutos) * 60).toFixed(0)
    : "0";

  // 4. Top Users con Nombres Reales (Búsqueda Dual) y Precisión
  const userStats = {}; // { name: { items: 0, matches: 0, comparisons: 0 } }

  data.forEach(c => {
    // Normalizar claves de búsqueda
    const userId = c.usuario_id;
    const userEmail = (c.correo_empleado || '').toLowerCase();
    const userName = (c.usuario_nombre || '').toLowerCase();

    // Intentar buscar por ID, luego por Correo, luego por Username
    let name = namesMap.get(userId) || 
               namesMap.get(userEmail) || 
               namesMap.get(userName);
    
    if (!name) {
       const rawName = c.usuario_nombre || c.correo_empleado || c.usuario_id || 'Desconocido';
       name = rawName.includes('@') ? rawName.split('@')[0] : rawName;
       name = name.charAt(0).toUpperCase() + name.slice(1);
    }
    
    if (!userStats[name]) userStats[name] = { items: 0, matches: 0, comparisons: 0 };
    
    const countVal = (c.total_items || (c.conteo_items ? c.conteo_items[0]?.count : 0) || 0);
    userStats[name].items += countVal;

    // Accuracy Check (Only for Type 1 and 2)
    if ((c.tipo_conteo === 1 || c.tipo_conteo === 2) && ubicacionMap.has(c.ubicacion_id)) {
        userStats[name].comparisons++;
        // Check if their count matches the final determined stock
        if (ubicacionMap.get(c.ubicacion_id).cantidad === countVal) {
            userStats[name].matches++;
        }
    }
  });

  const topUsers = Object.entries(userStats)
    .sort(([,a], [,b]) => b.matches - a.matches) // Sort by number of correct matches
    .slice(0, 3)
    .map(([name, s]) => {
        const acc = s.comparisons > 0 ? ((s.matches / s.comparisons) * 100).toFixed(0) : 0;
        return { name, items: `${s.items} items, ${acc}% Acierto (${s.matches} ok)` };
    });

  // Top Zonas (Actividad)
  const zonaMap = {};
  data.forEach(c => {
    const zonaNombre = c.ubicacion?.pasillo?.zona?.nombre || c.zona || 'Desconocida';
    if (!zonaMap[zonaNombre]) zonaMap[zonaNombre] = 0;
    zonaMap[zonaNombre]++;
  });
  const topZonas = Object.entries(zonaMap)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([name]) => name);

  // Top Zonas de Error (Donde hubo reconteos)
  const errorZonaMap = {};
  data.filter(c => c.tipo_conteo === 3).forEach(c => {
    const zonaNombre = c.ubicacion?.pasillo?.zona?.nombre || 'Desconocida';
    if (!errorZonaMap[zonaNombre]) errorZonaMap[zonaNombre] = 0;
    errorZonaMap[zonaNombre]++;
  });
  const topErrorZonas = Object.entries(errorZonaMap)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([name]) => name);

  // Analisis de Errores por Pasillo (Más granular que Zona)
  const errorPasilloMap = {};
  data.filter(c => c.tipo_conteo === 3).forEach(c => {
      const pasillo = c.ubicacion?.pasillo?.numero || c.pasillo || 'Desconocido';
      const zona = c.ubicacion?.pasillo?.zona?.nombre || 'Desconocida';
      const key = `${zona} - Pasillo ${pasillo}`;
      if (!errorPasilloMap[key]) errorPasilloMap[key] = 0;
      errorPasilloMap[key]++;
  });
  const topErrorPasillos = Object.entries(errorPasilloMap)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([k, v]) => `${k} (${v} errores)`);

  // Lista detallada de ubicaciones con conflicto
  const ubicacionesConflicto = data
    .filter(c => c.tipo_conteo === 3)
    .map(c => {
       const u = c.ubicacion;
       const zona = u?.pasillo?.zona?.nombre || c.zona || 'Zona ?';
       const pasillo = u?.pasillo?.numero || c.pasillo || '?';
       const ubic = u?.nombre || u?.numero || c.ubicacion || '?';
       return `- ${zona} > Pasillo ${pasillo} > Ubicación ${ubic}`;
    })
    .slice(0, 100); // Aumentado a 100 para incluir más detalles

  return {
    totalConteos,
    totalUnidadesFisicas,
    esfuerzoTotalItems,
    ubicacionesUnicas,
    ubicacionesFinalizadas,
    avance: ubicacionesUnicas > 0 ? ((ubicacionesFinalizadas / ubicacionesUnicas) * 100).toFixed(1) : 0,
    reconteos,
    tasaError: ubicacionesUnicas > 0 ? ((reconteos / ubicacionesUnicas) * 100).toFixed(1) : 0,
    velocidadPromedio,
    itemsPorHora,
    topUsers,
    topZonas,
    topErrorZonas,
    topErrorPasillos,
    ubicacionesConflicto // Nueva lista detallada
  };
};


const generateOperatorReport = async (data) => {
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
  });

  return completion.choices[0].message.content;
};
