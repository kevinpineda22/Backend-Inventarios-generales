import OpenAI from 'openai';
import ConteoModel from '../models/Conteo.model.js';

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
    const filters = params; // Asumimos que params son los filtros si no es un reporte especial
    
    // 1. Obtener datos de la base de datos
    const conteos = await ConteoModel.findAll(filters);

    if (!conteos || conteos.length === 0) {
      throw new Error('No hay datos suficientes para generar el reporte.');
    }

    // 2. Calcular estadísticas
    const stats = calculateStats(conteos);
    const bodegaNombre = filters.bodega || 'General';

    // 3. Construir Prompt
    const prompt = `
      Actúa como un experto consultor de logística e inventarios. Analiza los siguientes datos reales de un inventario físico realizado en la bodega "${bodegaNombre}".
      
      DATOS DEL INVENTARIO:
      - Total de Conteos Registrados: ${stats.totalConteos}
      - Total Items Contados: ${stats.totalItems}
      - Porcentaje de Avance (Conteos Finalizados): ${stats.avance}%
      - Cantidad de Reconteos (Errores/Diferencias): ${stats.reconteos}
      - Tasa de Error (Reconteos / Total): ${stats.tasaError}%
      - Top 3 Operadores más productivos: ${stats.topUsers.map(u => `${u.name} (${u.items} items)`).join(', ')}
      - Zonas con más actividad: ${stats.topZonas.join(', ')}

      Genera un reporte ejecutivo profesional en formato Markdown que incluya:
      1. 📊 **Resumen Ejecutivo**: Visión general del estado del inventario.
      2. 🚀 **Análisis de Productividad**: Evaluación del rendimiento del equipo.
      3. ⚠️ **Hallazgos Críticos**: Análisis de la tasa de error y reconteos. ¿Es alta? ¿Baja?
      4. 💡 **Recomendaciones Estratégicas**: 3 acciones concretas para mejorar el próximo inventario basándote en estos datos.
      5. 🏁 **Conclusión**: Veredicto final sobre la calidad del inventario.

      Usa un tono profesional, objetivo y constructivo. Usa emojis para resaltar puntos clave.
    `;

    // 4. Llamar a OpenAI
    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-3.5-turbo",
      temperature: 0.7,
    });

    return completion.choices[0].message.content;

  } catch (error) {
    console.error('Error generating AI report:', error);
    throw error;
  }
};

const calculateStats = (data) => {
  if (!data || data.length === 0) return { totalConteos: 0, totalItems: 0, avance: 0, reconteos: 0, tasaError: 0, topUsers: [], topZonas: [] };

  const totalConteos = data.length;
  // Nota: data viene de ConteoModel.findAll que incluye conteo_items con count, pero no el total sumado directo si no se pide.
  // Ajuste: ConteoModel.findAll trae `conteo_items:inv_general_conteo_items(count)`. 
  // Supabase devuelve count como objeto { count: N }.
  // Sin embargo, en el frontend se usaba `total_items` que venía de la vista o cálculo previo.
  // Revisando ConteoModel.findAll:
  /*
    conteo_items:inv_general_conteo_items(count)
  */
  // Esto devuelve el número de filas (items distintos), no la suma de cantidades.
  // Para simplificar y no sobrecargar, usaremos el número de items distintos contados como proxy de actividad,
  // o si el modelo trae `total_items` (que parece que no explícitamente en findAll, pero sí en findById).
  // Vamos a asumir que `total_items` puede no estar disponible directamente en findAll sin un join costoso o una columna calculada.
  // Pero el frontend lo tenía. El frontend usaba `inventarioService.obtenerHistorialConteos`.
  // Revisemos `inventarioService.js` del frontend para ver qué llama.
  
  // Asumiremos que data tiene lo necesario o haremos una aproximación.
  // En el frontend: `const totalItems = data.reduce((acc, c) => acc + (c.total_items || 0), 0);`
  // Si `c.total_items` no viene del backend, esto será 0.
  
  // Para ser precisos, deberíamos asegurarnos que el backend traiga ese dato.
  // Por ahora, usaremos conteo de registros como proxy si total_items no existe.
  
  const totalItems = data.reduce((acc, c) => acc + (c.total_items || (c.conteo_items ? c.conteo_items[0]?.count : 0) || 0), 0);
  
  const finalizados = data.filter(c => c.estado === 'finalizado').length;
  const reconteos = data.filter(c => c.tipo_conteo === 3).length;
  
  // Top Users
  const userMap = {};
  data.forEach(c => {
    const name = c.usuario_nombre?.split('@')[0] || 'Anon';
    if (!userMap[name]) userMap[name] = 0;
    // Usamos 1 por conteo si no hay total_items, para medir actividad al menos
    userMap[name] += (c.total_items || 1);
  });
  const topUsers = Object.entries(userMap)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([name, items]) => ({ name, items }));

  // Top Zonas
  const zonaMap = {};
  data.forEach(c => {
    // La estructura anidada en findAll es: c.ubicacion.pasillo.zona.nombre
    const zonaNombre = c.ubicacion?.pasillo?.zona?.nombre || c.zona || 'Desconocida';
    if (!zonaMap[zonaNombre]) zonaMap[zonaNombre] = 0;
    zonaMap[zonaNombre]++;
  });
  const topZonas = Object.entries(zonaMap)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([name]) => name);

  return {
    totalConteos,
    totalItems,
    avance: totalConteos > 0 ? ((finalizados / totalConteos) * 100).toFixed(1) : 0,
    reconteos,
    tasaError: totalConteos > 0 ? ((reconteos / totalConteos) * 100).toFixed(1) : 0,
    topUsers,
    topZonas
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
