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

    // 4. Construir Prompt
    const prompt = `
      Actúa como un Auditor Senior de Inventarios y Logística. Analiza los siguientes datos del inventario en bodega "${bodegaNombre}".
      
      DATOS CLAVE:
      - 📅 Sesiones: ${stats.totalConteos}
      - 📦 Referencias (SKUs): ${stats.totalItems}
      - 📍 Ubicaciones: ${stats.ubicacionesUnicas} (Finalizadas: ${stats.ubicacionesFinalizadas})
      - 📈 Avance Real: ${stats.avance}%
      
      RENDIMIENTO (Basado en sesiones activas):
      - ⚡ Velocidad Promedio: ${stats.itemsPorHora} items/hora (aprox. ${stats.velocidadPromedio} items/min)
      - ⏱️ Nota: Se han excluido sesiones inactivas o "zombies" para este cálculo.
      - 🏆 Top Operadores: ${stats.topUsers.map(u => `${u.name} (${u.items})`).join(', ')}
      
      CALIDAD Y DISCREPANCIAS:
      - ❌ Total Discrepancias (Reconteos): ${stats.reconteos}
      - 📉 Tasa de Conflicto: ${stats.tasaError}%
      - 🔥 Zonas Críticas (Más errores): ${stats.topErrorZonas.join(', ') || 'Ninguna'}
      
      📍 DETALLE EXACTO DE UBICACIONES CON CONFLICTO (Donde se requirió reconteo):
      ${stats.ubicacionesConflicto.length > 0 ? stats.ubicacionesConflicto.join('\n') : 'No se registraron conflictos.'}

      Genera un reporte Markdown estructurado así:
      1. **Resumen Ejecutivo**: Estado general y veredicto de salud del inventario.
      2. **Productividad y Ritmo**: Analiza la velocidad (${stats.itemsPorHora} items/h). 
         - Benchmark: >600 items/h (Alto), 300-600 (Medio), <300 (Bajo/Requiere Atención).
         - Felicita a los top performers por nombre.
      3. **Calidad y Precisión**: Analiza la tasa de error (${stats.tasaError}%).
         - IMPORTANTE: Lista explícitamente las ubicaciones exactas donde hubo conflictos (Zona > Pasillo > Ubicación) mencionadas arriba, para que el supervisor sepa exactamente dónde ir.
      4. **Recomendaciones de Impacto**: 3 acciones específicas.
      5. **Conclusión**: Cierre profesional.

      Usa nombres reales. Sé claro y directo.
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
  const totalItems = data.reduce((acc, c) => acc + (c.total_items || (c.conteo_items ? c.conteo_items[0]?.count : 0) || 0), 0);
  
  // --- NUEVAS MÉTRICAS AVANZADAS ---

  // 1. Clasificación de Diferencias (Solo en reconteos/ajustes)
  const reconteos = data.filter(c => c.tipo_conteo === 3).length;

  // 2. Velocidad Promedio (Items / Minuto y Hora)
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
    ? (totalItems / totalMinutos).toFixed(1) 
    : "N/A";

  const itemsPorHora = conteosConTiempo > 0 && totalMinutos > 0
    ? ((totalItems / totalMinutos) * 60).toFixed(0)
    : "0";

  // 3. Top Users con Nombres Reales (Búsqueda Dual)
  const userMap = {};
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
       // Si parece un email, lo cortamos. Si no, lo dejamos tal cual
       name = rawName.includes('@') ? rawName.split('@')[0] : rawName;
       // Capitalizar primera letra
       name = name.charAt(0).toUpperCase() + name.slice(1);
    }
    
    if (!userMap[name]) userMap[name] = 0;
    userMap[name] += (c.total_items || (c.conteo_items ? c.conteo_items[0]?.count : 0) || 1);
  });

  const topUsers = Object.entries(userMap)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([name, items]) => ({ name, items }));

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
    .slice(0, 20); // Top 20 conflictos para no saturar

  return {
    totalConteos,
    totalItems,
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
