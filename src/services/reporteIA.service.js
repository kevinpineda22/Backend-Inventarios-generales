import OpenAI from 'openai';
import ConteoModel from '../models/Conteo.model.js';
import { supabase } from '../config/supabase.js';

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
    const filters = params; 
    
    // 1. Obtener datos de la base de datos
    const conteos = await ConteoModel.findAll(filters);

    if (!conteos || conteos.length === 0) {
      throw new Error('No hay datos suficientes para generar el reporte.');
    }

    // 2. Obtener mapa de nombres reales (Corrección para precisión)
    const userIds = [...new Set(conteos.map(c => c.usuario_id).filter(id => id))];
    const profiles = await ConteoModel.getNombresUsuarios(userIds);
    const namesMap = new Map(profiles.map(p => [p.id, p.nombre]));

    // 3. Calcular estadísticas mejoradas
    const stats = calculateStats(conteos, namesMap);
    const bodegaNombre = filters.bodega || 'General';

    // 4. Construir Prompt
    const prompt = `
      Actúa como un experto consultor de logística e inventarios. Analiza los siguientes datos reales de un inventario físico realizado en la bodega "${bodegaNombre}".
      
      DATOS DEL INVENTARIO (Precisión Alta):
      - Total de Sesiones de Conteo: ${stats.totalConteos}
      - Referencias (SKUs) Auditadas: ${stats.totalItems}
      - Ubicaciones Únicas Intervenidas: ${stats.ubicacionesUnicas}
      - Ubicaciones Finalizadas (Cerradas): ${stats.ubicacionesFinalizadas}
      - Porcentaje de Cierre (Sobre lo iniciado): ${stats.avance}%
      - Velocidad Promedio del Equipo: ${stats.velocidadPromedio} items/minuto
      - Cantidad de Reconteos (Discrepancias Graves): ${stats.reconteos}
      - Tasa de Conflicto (Reconteos / Ubicaciones): ${stats.tasaError}%
      - Top 3 Operadores más activos: ${stats.topUsers.map(u => `${u.name} (${u.items} referencias)`).join(', ')}
      - Zonas con más actividad: ${stats.topZonas.join(', ')}

      Genera un reporte ejecutivo profesional en formato Markdown que incluya:
      1. 📊 **Resumen Ejecutivo**: Visión general del estado del inventario.
      2. 🚀 **Análisis de Productividad**: Evaluación del rendimiento del equipo. ¿La velocidad de ${stats.velocidadPromedio} items/min es adecuada? Menciona a los líderes.
      3. ⚠️ **Hallazgos Críticos**: Análisis de la tasa de conflicto. ¿El proceso es fluido o hay muchas discrepancias?
      4. 💡 **Recomendaciones Estratégicas**: 3 acciones concretas para mejorar la eficiencia.
      5. 🏁 **Conclusión**: Veredicto final sobre la calidad y avance del inventario.

      Usa un tono profesional, objetivo y constructivo. Usa emojis para resaltar puntos clave.
    `;

    // 5. Llamar a OpenAI
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

const calculateStats = (data, namesMap) => {
  if (!data || data.length === 0) return { totalConteos: 0, totalItems: 0, avance: 0, reconteos: 0, tasaError: 0, topUsers: [], topZonas: [] };

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
  const totalItems = data.reduce((acc, c) => acc + (c.total_items || (c.conteo_items ? c.conteo_items[0]?.count : 0) || 0), 0);
  
  // --- NUEVAS MÉTRICAS AVANZADAS ---

  // 1. Clasificación de Diferencias (Solo en reconteos/ajustes)
  // Asumimos que si es tipo 3 (Reconteo) hubo diferencia. 
  // Idealmente necesitaríamos el valor de la diferencia, pero por ahora contaremos la frecuencia.
  const reconteos = data.filter(c => c.tipo_conteo === 3).length;

  // 2. Velocidad Promedio (Items / Minuto)
  let totalMinutos = 0;
  let conteosConTiempo = 0;

  data.forEach(c => {
    if (c.fecha_inicio && c.fecha_fin) {
      const inicio = new Date(c.fecha_inicio);
      const fin = new Date(c.fecha_fin);
      const diffMinutos = (fin - inicio) / 1000 / 60;
      
      // Filtramos tiempos absurdos (ej: < 0.1 min o > 4 horas por un conteo simple)
      if (diffMinutos > 0.5 && diffMinutos < 240) {
        totalMinutos += diffMinutos;
        conteosConTiempo++;
      }
    }
  });
  
  const velocidadPromedio = conteosConTiempo > 0 && totalMinutos > 0
    ? (totalItems / totalMinutos).toFixed(1) 
    : "N/A";

  // 3. Top Users con Nombres Reales
  const userMap = {};
  data.forEach(c => {
    let name = namesMap.get(c.usuario_id);
    if (!name) {
       name = c.correo_empleado?.split('@')[0] || c.usuario_id || 'Desconocido';
    }
    
    if (!userMap[name]) userMap[name] = 0;
    userMap[name] += (c.total_items || (c.conteo_items ? c.conteo_items[0]?.count : 0) || 1);
  });

  const topUsers = Object.entries(userMap)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([name, items]) => ({ name, items }));

  // Top Zonas
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

  return {
    totalConteos,
    totalItems,
    ubicacionesUnicas,
    ubicacionesFinalizadas,
    avance: ubicacionesUnicas > 0 ? ((ubicacionesFinalizadas / ubicacionesUnicas) * 100).toFixed(1) : 0,
    reconteos,
    tasaError: ubicacionesUnicas > 0 ? ((reconteos / ubicacionesUnicas) * 100).toFixed(1) : 0,
    velocidadPromedio, // Nueva métrica
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
