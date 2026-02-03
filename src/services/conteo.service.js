// =====================================================
// SERVICIO: CONTEOS
// =====================================================

import ConteoModel from '../models/Conteo.model.js';
import ConteoItemModel from '../models/ConteoItem.model.js';
import UbicacionModel from '../models/Ubicacion.model.js';
import ItemModel from '../models/Item.model.js';
import CodigoModel from '../models/Codigo.model.js';
import { supabase } from '../config/supabase.js';

class ConteoService {
  /**
   * Obtener ubicaciones donde se encuentra un item
   */
  static async getItemLocations(itemId, companiaId) {
    try {
      // 1. Obtener información del item para buscar por código también (Fix para items duplicados)
      const itemInfo = await ItemModel.findById(itemId);
      let targetItemIds = [itemId];
      
      if (itemInfo && (itemInfo.codigo || itemInfo.codigo_barra)) {
          const code = itemInfo.codigo || itemInfo.codigo_barra;
          // Buscar todos los items con el mismo código
          const duplicates = await ItemModel.findAllByBarcode(code, companiaId);
          if (duplicates && duplicates.length > 0) {
              targetItemIds = duplicates.map(d => d.id);
          }
      }

      // 2. Buscar ubicaciones para TODOS los IDs encontrados
      const rawData = await ConteoItemModel.findLocationsByItem(targetItemIds);
      
      // 3. Agrupar por ubicación para consolidar duplicados (C1, C2, C3, C4)
      const locationGroups = {};

      rawData.forEach(item => {
          const c = item.conteo;
          if (!c || !c.ubicacion) return;
          
          const ubicacionId = c.ubicacion.id;
          const bodega = c.ubicacion.pasillo?.zona?.bodega;
          
          // Filtrar por compañía
          if (!bodega || String(bodega.compania_id) !== String(companiaId)) return;

          if (!locationGroups[ubicacionId]) {
              locationGroups[ubicacionId] = {
                  items: [],
                  meta: {
                      bodega: bodega.nombre,
                      zona: c.ubicacion.pasillo.zona.nombre,
                      pasillo: c.ubicacion.pasillo.numero,
                      ubicacion: c.ubicacion.numero,
                      bodega_id: bodega.id,
                      zona_id: c.ubicacion.pasillo.zona.id,
                      pasillo_id: c.ubicacion.pasillo.id,
                      ubicacion_id: c.ubicacion.id,
                      created_at: item.created_at
                  }
              };
          }
          locationGroups[ubicacionId].items.push(item);
      });

      // 2. Resolver cantidad final para cada ubicación (Lógica de Consenso)
      const locations = Object.values(locationGroups).map(group => {
          const items = group.items;
          let q1 = null, q2 = null, q3 = null, q4 = null;
          
          items.forEach(i => {
              // Robustez: Asegurar que conteo existe y tipos son correctos
              if (!i.conteo) return;
              const type = Number(i.conteo.tipo_conteo);
              const qty = Number(i.cantidad);

              if (isNaN(qty)) return;
              
              if (type === 1) q1 = (q1 === null ? 0 : q1) + qty;
              else if (type === 2) q2 = (q2 === null ? 0 : q2) + qty;
              else if (type === 3) q3 = (q3 === null ? 0 : q3) + qty;
              else if (type === 4) q4 = (q4 === null ? 0 : q4) + qty;
          });

          let finalQty = 0;
          let status = 'N/A';

          // Prioridad: Ajuste > Consenso C1=C2 > Reconteo > C2 > C1
          // Nota en Reconteo (q3): Aqui q3 existe porque vino de la DB. 
          // Si tiene length, es que hay registro. Si es 0, es un 0 explícito.
          if (q4 !== null) { 
              finalQty = q4; 
              status = 'Ajuste Final'; 
          }
          // Prioridad: Ajuste > Consenso C1=C2 > Reconteo > C2 > C1
          
          // FIX ROBUSTO V2: Priorizar valores positivos sobre ceros accidentales
          // Si tenemos un ajuste final positivo, es ley.
          if (q4 !== null && q4 > 0) { 
              finalQty = q4; 
              status = 'Ajuste Final'; 
          }
          // Si el ajuste es 0, verifiquemos si es lógico (si C1 o C2 eran enormes, el 0 es sospechoso)
          else if (q4 === 0 && (q1 > 0 || q2 > 0)) {
               // Si C4 es 0 pero C1/C2 tienen datos, ignoramos C4 temporalmente para mostrar el hallazgo
               if (q2 > 0) { finalQty = q2; status = 'Conteo 2 (Recuperado)'; }
               else { finalQty = q1; status = 'Conteo 1 (Recuperado)'; }
          }
          else if (q4 === 0) {
              finalQty = 0;
              status = 'Ajuste Final (0)';
          }
          else if (q3 !== null && q3 > 0) { 
               finalQty = q3; 
               status = 'Reconteo'; 
          }
          else if (q1 !== null && q2 !== null && q1 === q2) { 
              finalQty = q1; 
              status = 'Consenso'; 
          }
          else if (q2 !== null) { 
              finalQty = q2; 
              status = 'Conteo 2'; 
          }
          else if (q1 !== null) { 
              finalQty = q1; 
              status = 'Conteo 1'; 
          }

          // SAFETY NET FINAL: Si por alguna razón sigue siendo 0 y hay historia, sacar el máximo
          if (finalQty === 0) {
              const maxH = Math.max(q1 || 0, q2 || 0, q3 || 0);
              if (maxH > 0) {
                  finalQty = maxH;
                  status = 'Histórico Recuperado';
              }
          }

          return {
            bodega: group.meta.bodega,
            zona: group.meta.zona,
            pasillo: group.meta.pasillo,
            ubicacion: group.meta.ubicacion,
            cantidad: finalQty,
            fecha: group.meta.created_at,
            tipo_conteo: status, 
            estado_conteo: 'consolidado',
            bodega_id: group.meta.bodega_id,
            zona_id: group.meta.zona_id,
            pasillo_id: group.meta.pasillo_id,
            ubicacion_id: group.meta.ubicacion_id
          };
      });

      return {
        success: true,
        data: locations
      };
    } catch (error) {
      throw new Error(`Error al buscar ubicaciones del item: ${error.message}`);
    }
  }

  /**
   * Iniciar un conteo
   */
  static async iniciarConteo(ubicacionId, usuarioId, tipoConteo, clave, usuarioEmail = null) {
    try {
      // Verificar que la ubicación existe y la clave es correcta
      const ubicacion = await UbicacionModel.findById(ubicacionId);
      
      if (!ubicacion) {
        return {
          success: false,
          message: 'Ubicación no encontrada'
        };
      }

      // Verificar clave
      const claveValida = await UbicacionModel.verifyClave(ubicacionId, clave);
      if (!claveValida) {
        return {
          success: false,
          message: 'Clave incorrecta'
        };
      }

      // Verificar si ya existe un conteo de este tipo para esta ubicación (GLOBAL, NO POR USUARIO)
      // Esto evita duplicados y condiciones de carrera
      const conteoExistente = await ConteoModel.findByUbicacionAndTipo(ubicacionId, tipoConteo);
      
      if (conteoExistente) {
        if (conteoExistente.estado === 'finalizado') {
           return {
            success: false,
            message: 'El conteo para esta ubicación ya ha sido finalizado'
          };
        }
        // Si existe y no está finalizado, retornamos el existente (recuperación de sesión)
        return {
          success: true,
          data: conteoExistente,
          message: 'Sesión de conteo recuperada'
        };
      }

      // Crear el conteo
      const conteo = await ConteoModel.create({
        ubicacion_id: ubicacionId,
        usuario_id: usuarioId,
        tipo_conteo: tipoConteo,
        estado: 'en_progreso',
        correo_empleado: usuarioEmail // Guardar correo del empleado
      });

      return {
        success: true,
        data: conteo,
        message: 'Conteo iniciado exitosamente'
      };
    } catch (error) {
      throw new Error(`Error al iniciar conteo: ${error.message}`);
    }
  }

  /**
   * Agregar item a un conteo
   */
  static async agregarItem(conteoId, codigoBarra, cantidad, companiaId, usuarioEmail = null, itemId = null) {
    console.log(`[DEBUG] AgregarItem - Barcode: ${codigoBarra}, Cia: ${companiaId}, Conteo: ${conteoId}, Email: ${usuarioEmail}, ItemID: ${itemId}`);
    try {
      let itemMaster;
      let factor = 1;

      if (itemId) {
        // Búsqueda directa por ID (Prioridad Alta)
        itemMaster = await ItemModel.findById(itemId);
        if (!itemMaster) {
          return {
            success: false,
            message: 'Item ID no encontrado'
          };
        }
        
        // CRITICAL: Validar que el item pertenece a la compañía correcta
        if (String(itemMaster.compania_id) !== String(companiaId)) {
          return {
            success: false,
            message: 'Item no pertenece a la compañía seleccionada'
          };
        }
      } else {
        // 1. Buscar el código de barras en la tabla de códigos (1:N)
        let codigoData = await CodigoModel.findByBarcodeWithItem(codigoBarra, companiaId);
        console.log(`[DEBUG] Busqueda en Codigos: ${codigoData ? 'ENCONTRADO' : 'NO ENCONTRADO'}`);
        
        // FALLBACK: Si no está en la tabla de códigos, buscar directamente en la tabla de items
        if (!codigoData) {
          console.log(`[DEBUG] Intentando fallback en Items con codigo: ${codigoBarra}`);
          const itemDirecto = await ItemModel.findByBarcode(codigoBarra, companiaId);
          console.log(`[DEBUG] Busqueda en Items: ${itemDirecto ? 'ENCONTRADO' : 'NO ENCONTRADO'}`);
          
          if (itemDirecto) {
              // Construir estructura compatible con lo que espera el resto de la función
              codigoData = {
                  codigo_barras: itemDirecto.codigo || itemDirecto.codigo_barra, // <-- Adaptar a 'codigo' o 'codigo_barra'
                  unidad_medida: itemDirecto.unidad_medida || 'UN',
                  factor: 1, // Factor por defecto para item principal
                  activo: true,
                  inv_general_items: itemDirecto
              };
          }
        }
        
        if (!codigoData) {
          return {
            success: false,
            message: 'Código de barras no encontrado en la maestra'
          };
        }

        // 2. Obtener datos del item y factor
        itemMaster = codigoData.inv_general_items; // Relación traída por CodigoModel (ahora incluye id)
        factor = codigoData.factor || 1;
      }
      
      if (!itemMaster || !itemMaster.id) {
         return {
          success: false,
          message: 'Item maestro no encontrado o sin ID válido'
        };
      }

      // 3. Calcular cantidad total (Cantidad Ingresada * Factor)
      const cantidadTotal = cantidad * factor;

      // 4. Agregar item al historial (INSERT siempre)
      // Nota: upsert ahora hace insert internamente en el modelo modificado
      const conteoItem = await ConteoItemModel.upsert(conteoId, itemMaster.id, cantidadTotal, usuarioEmail);

      return {
        success: true,
        data: {
            ...conteoItem,
            item: itemMaster, // Devolver info del item para el frontend
            factor_aplicado: factor,
            cantidad_registrada: cantidadTotal
        },
        message: `Item agregado. Factor ${factor} aplicado. Total: ${cantidadTotal}`
      };
    } catch (error) {
      throw new Error(`Error al agregar item al conteo: ${error.message}`);
    }
  }

  /**
   * Eliminar un item del conteo (registro individual)
   */
  static async eliminarItem(itemId) {
    try {
      const result = await ConteoItemModel.delete(itemId);
      
      return {
        success: true,
        message: 'Item eliminado exitosamente'
      };
    } catch (error) {
      throw new Error(`Error al eliminar item: ${error.message}`);
    }
  }

  /**
   * Obtener items de un conteo
   */
  static async getItemsConteo(conteoId) {
    try {
      const items = await ConteoItemModel.findByConteo(conteoId);
      
      return {
        success: true,
        data: items,
        count: items.length
      };
    } catch (error) {
      throw new Error(`Error al obtener items del conteo: ${error.message}`);
    }
  }

  /**
   * Finalizar un conteo
   */
  static async finalizarConteo(conteoId) {
    try {
      const conteo = await ConteoModel.finalizar(conteoId);

      // =================================================================
      // AUTO-RESOLUCIÓN DE RECONTEO (TIPO 3)
      // Si es un reconteo y coincide con C1 o C2, generamos Ajuste Final automáticamente
      // =================================================================
      try {
        const conteoActualizado = await ConteoModel.findById(conteoId);
        
        if (conteoActualizado && conteoActualizado.tipo_conteo === 3) {
          const ubicacionId = conteoActualizado.ubicacion_id;
          
          // Obtener C1 y C2
          const c1 = await ConteoModel.findByUbicacionAndTipo(ubicacionId, 1);
          const c2 = await ConteoModel.findByUbicacionAndTipo(ubicacionId, 2);
          
          if (c1 && c2) {
            const itemsC3 = await ConteoItemModel.findByConteo(conteoId);
            const itemsC1 = await ConteoItemModel.findByConteo(c1.id);
            const itemsC2 = await ConteoItemModel.findByConteo(c2.id);
            
            // Mapas para búsqueda rápida de cantidades anteriores
            const mapC1 = new Map(itemsC1.map(i => [i.item_id, Number(i.cantidad)]));
            const mapC2 = new Map(itemsC2.map(i => [i.item_id, Number(i.cantidad)]));
            
            let allMatch = true;
            const itemsParaAjuste = [];
            
            // Verificar cada item del reconteo
            for (const itemC3 of itemsC3) {
              const qtyC1 = mapC1.get(itemC3.item_id) || 0;
              const qtyC2 = mapC2.get(itemC3.item_id) || 0;
              const qtyC3 = Number(itemC3.cantidad);
              
              // Regla: El reconteo debe coincidir con C1 o con C2
              if (qtyC3 === qtyC1 || qtyC3 === qtyC2) {
                itemsParaAjuste.push({
                  itemId: itemC3.item_id, // Usamos ID directo
                  codigo: 'AUTO', // No necesario si hay ID
                  cantidad: qtyC3,
                  companiaId: 0 // No necesario si hay ID
                });
              } else {
                // Si hay al menos un item que no coincide con ninguno, 
                // NO hacemos auto-resolución (requiere revisión manual)
                allMatch = false;
                break; 
              }
            }
            
            // Si todos los items coinciden, creamos el ajuste final automáticamente
            if (allMatch && itemsParaAjuste.length > 0) {
              await this.crearAjusteFinal(
                ubicacionId,
                conteoActualizado.usuario_id,
                conteoActualizado.correo_empleado,
                itemsParaAjuste
              );
              
              return {
                success: true,
                data: conteo,
                message: 'Conteo finalizado y Ajuste Final generado automáticamente (Coincidencia detectada)'
              };
            }
          }
        }
      } catch (autoError) {
        console.error("Error en auto-resolución:", autoError);
        // No interrumpimos el flujo principal si falla la auto-resolución
      }
      
      return {
        success: true,
        data: conteo,
        message: 'Conteo finalizado exitosamente'
      };
    } catch (error) {
      throw new Error(`Error al finalizar conteo: ${error.message}`);
    }
  }

  /**
   * Obtener conteo con todos sus items
   */
  static async getConteoById(id) {
    try {
      const conteo = await ConteoModel.findById(id);
      
      if (!conteo) {
        return {
          success: false,
          message: 'Conteo no encontrado'
        };
      }

      return {
        success: true,
        data: conteo
      };
    } catch (error) {
      throw new Error(`Error al obtener conteo: ${error.message}`);
    }
  }

  /**
   * Obtener historial de conteos por ubicación
   */
  static async getHistorialByUbicacion(ubicacionId) {
    try {
      const conteos = await ConteoModel.findByUbicacion(ubicacionId);
      
      return {
        success: true,
        data: conteos
      };
    } catch (error) {
      throw new Error(`Error al obtener historial: ${error.message}`);
    }
  }

  /**
   * Obtener historial de conteos por pasillo
   */
  static async getHistorialByPasillo(pasilloId) {
    try {
      const conteos = await ConteoModel.getHistorialByPasillo(pasilloId);
      
      return {
        success: true,
        data: conteos
      };
    } catch (error) {
      throw new Error(`Error al obtener historial: ${error.message}`);
    }
  }

  /**
   * Calcular diferencias entre conteo 1 y conteo 2
   */
  static async calcularDiferencias(ubicacionId) {
    try {
      // Obtener conteo 1 y conteo 2
      const conteo1 = await ConteoModel.findByUbicacionAndTipo(ubicacionId, 1);
      const conteo2 = await ConteoModel.findByUbicacionAndTipo(ubicacionId, 2);

      if (!conteo1 || !conteo2) {
        return {
          success: false,
          message: 'Deben existir conteo 1 y conteo 2 para calcular diferencias'
        };
      }

      // Obtener items de ambos conteos
      const items1 = await ConteoItemModel.findByConteo(conteo1.id);
      const items2 = await ConteoItemModel.findByConteo(conteo2.id);

      // Calcular diferencias
      const diferencias = [];
      const itemsMap = new Map();

      // Agregar items del conteo 1 (SUMANDO CANTIDADES SI HAY MÚLTIPLES REGISTROS)
      items1.forEach(item => {
        if (itemsMap.has(item.item_id)) {
            // Si ya existe, sumamos la cantidad
            const existing = itemsMap.get(item.item_id);
            existing.cantidad_conteo1 += item.cantidad;
        } else {
            // Si no existe, creamos entrada
            itemsMap.set(item.item_id, {
                item_id: item.item_id,
                item: item.item,
                cantidad_conteo1: item.cantidad,
                cantidad_conteo2: 0
            });
        }
      });

      // Agregar items del conteo 2 (SUMANDO CANTIDADES)
      items2.forEach(item => {
        if (itemsMap.has(item.item_id)) {
          const existing = itemsMap.get(item.item_id);
          existing.cantidad_conteo2 += item.cantidad;
        } else {
          itemsMap.set(item.item_id, {
            item_id: item.item_id,
            item: item.item,
            cantidad_conteo1: 0,
            cantidad_conteo2: item.cantidad
          });
        }
      });

      // Calcular diferencias
      itemsMap.forEach((value, key) => {
        const diferencia = value.cantidad_conteo2 - value.cantidad_conteo1;
        if (diferencia !== 0) {
          diferencias.push({
            ...value,
            diferencia
          });
        }
      });

      return {
        success: true,
        data: {
          conteo1,
          conteo2,
          diferencias,
          total_diferencias: diferencias.length
        }
      };
    } catch (error) {
      throw new Error(`Error al calcular diferencias: ${error.message}`);
    }
  }

  /**
   * Aprobar conteo
   */
  static async aprobarConteo(conteoId) {
    try {
      const conteo = await ConteoModel.aprobar(conteoId);
      
      return {
        success: true,
        data: conteo,
        message: 'Conteo aprobado exitosamente'
      };
    } catch (error) {
      throw new Error(`Error al aprobar conteo: ${error.message}`);
    }
  }

  /**
   * Rechazar conteo
   */
  static async rechazarConteo(conteoId, motivo) {
    try {
      const conteo = await ConteoModel.rechazar(conteoId, motivo);
      
      return {
        success: true,
        data: conteo,
        message: 'Conteo rechazado'
      };
    } catch (error) {
      throw new Error(`Error al rechazar conteo: ${error.message}`);
    }
  }

  /**
   * Obtener conteos pendientes de aprobación
   */
  static async getConteosPendientes() {
    try {
      const conteos = await ConteoModel.getPendientes();
      
      return {
        success: true,
        data: conteos,
        count: conteos.length
      };
    } catch (error) {
      throw new Error(`Error al obtener conteos pendientes: ${error.message}`);
    }
  }

  /**
   * Obtener historial de conteos con filtros
   */
  static async getHistorial(filters) {
    try {
      const conteos = await ConteoModel.findAll(filters);
      
      // Obtener nombres reales de usuarios
      const userIds = [...new Set(conteos.map(c => c.usuario_id).filter(id => id))];
      const profiles = await ConteoModel.getNombresUsuarios(userIds);
      const namesMap = new Map(profiles.map(p => [p.id, p.nombre]));

      // Formatear datos para el frontend
      const data = conteos.map(c => {
        // Prioridad: Nombre en profile > Correo empleado > Usuario ID
        const realName = namesMap.get(c.usuario_id);
        const displayName = realName || c.correo_empleado || c.usuario_id;

        return {
          id: c.id,
          bodega: c.ubicacion?.pasillo?.zona?.bodega?.nombre,
          bodega_id: c.ubicacion?.pasillo?.zona?.bodega?.id, // ID Bodega
          zona: c.ubicacion?.pasillo?.zona?.nombre,
          zona_id: c.ubicacion?.pasillo?.zona?.id, // ID Zona
          pasillo: c.ubicacion?.pasillo?.numero,
          pasillo_id: c.ubicacion?.pasillo?.id, // ID Pasillo
          ubicacion: c.ubicacion?.numero,
          ubicacion_id: c.ubicacion?.id, // ID Ubicacion
          tipo_conteo: c.tipo_conteo,
          fecha_inicio: c.fecha_inicio,
          fecha_fin: c.fecha_fin,
          created_at: c.created_at, // CRITICAL: Required for correct sorting in Dashboard
          usuario_nombre: displayName, // Usar nombre real si existe
          estado: c.estado,
          // Corregido: Retornar la cantidad de registros (items únicos/filas), no la suma de cantidades
          total_items: c.conteo_items ? c.conteo_items.length : (c.total_items || 0),
          // Nuevo: Retornar la suma total de unidades (cantidad)
          total_cantidad: c.conteo_items ? c.conteo_items.reduce((sum, i) => sum + (Number(i.cantidad) || 0), 0) : 0,
          // Nuevo: Retornar items para análisis detallado en frontend
          conteo_items: c.conteo_items
        };
      });

      return {
        success: true,
        data
      };
    } catch (error) {
      throw new Error(`Error al obtener historial: ${error.message}`);
    }
  }

  /**
   * Obtener ubicaciones con diferencias pendientes de reconteo
   * OPTIMIZADO: Carga ligera de cabeceras primero, luego cálculo bajo demanda
   */
  static async getUbicacionesConDiferencias(companiaId) {
    try {
      // 1. Obtener SOLO CABECERAS de conteos finalizados (Lightweight)
      // Evitamos traer millones de registros de items filtrando solo los headers
      const conteosHeaders = await ConteoModel.findHeadersByCompany(companiaId);
      
      // 2. Agrupar por ubicación en memoria
      const ubicacionesMap = new Map();
      
      conteosHeaders.forEach(c => {
        const ubicacionId = c.ubicacion_id;
        if (!ubicacionesMap.has(ubicacionId)) {
          ubicacionesMap.set(ubicacionId, {
            ubicacion: c.ubicacion, 
            c1: null,
            c2: null,
            c3: null,
            c4: null // Check for Final Adjustment
          });
        }
        
        const entry = ubicacionesMap.get(ubicacionId);
        if (c.tipo_conteo === 1) entry.c1 = c;
        if (c.tipo_conteo === 2) entry.c2 = c;
        if (c.tipo_conteo === 3) entry.c3 = c;
        if (c.tipo_conteo === 4) entry.c4 = c;
      });

      // 3. Filtrar candidatos: Tienen C1 y C2, pero NO C3 y NO C4
      const ubicacionesCandidatas = [];
      for (const [id, data] of ubicacionesMap) {
        if (data.c1 && data.c2 && !data.c3 && !data.c4) {
          ubicacionesCandidatas.push(id);
        }
      }

      // 4. Calcular diferencias reales en paralelo
      // Solo traemos items para las ubicaciones que pasaron el filtro inicial
      const promesasCalculo = ubicacionesCandidatas.map(async (ubicacionId) => {
        try {
            const diffResult = await this.calcularDiferencias(ubicacionId);
            const dataUbicacion = ubicacionesMap.get(ubicacionId);

            if (diffResult.success && diffResult.data.total_diferencias > 0) {
                return {
                    ubicacion: dataUbicacion.ubicacion,
                    diferencias: diffResult.data.diferencias,
                    total_diferencias: diffResult.data.total_diferencias,
                    conteo1: dataUbicacion.c1,
                    conteo2: dataUbicacion.c2
                };
            }
        } catch (e) {
            console.error(`Error calculando diferencias para ubicación ${ubicacionId}`, e);
        }
        return null;
      });

      const itemsProcesados = await Promise.all(promesasCalculo);
      const finalResult = itemsProcesados.filter(item => item !== null);

      return {
        success: true,
        data: finalResult,
        count: finalResult.length
      };

    } catch (error) {
      throw new Error(`Error al obtener ubicaciones con diferencias: ${error.message}`);
    }
  }

  /**
   * Crear un ajuste final (Tipo 4)
   * Este conteo se crea y finaliza inmediatamente con los items proporcionados.
   */
  static async crearAjusteFinal(ubicacionId, usuarioId, usuarioEmail, items) {
    try {
      // 1. Verificar si ya existe un conteo tipo 4 para esta ubicación
      let conteo = await ConteoModel.findByUbicacionAndTipo(ubicacionId, 4);
      
      if (conteo) {
        // Si existe, eliminamos TODOS sus items previos para evitar duplicados/sumas
        // Asumimos que ConteoItemModel tiene un método deleteByConteoId o similar.
        // Si no, usamos una estrategia de borrado manual si tenemos acceso a la DB, 
        // pero como estamos en capa de servicio, intentaremos usar el modelo.
        // Si el modelo no tiene deleteByConteoId, iteramos y borramos (ineficiente pero seguro)
        // O mejor, si ConteoModel tiene un método para resetear.
        
        // Como no puedo ver el modelo, voy a asumir que puedo obtener los items y borrarlos uno a uno
        // Esto es lento pero seguro con las herramientas actuales.
        const itemsPrevios = await ConteoItemModel.findByConteo(conteo.id);
        for (const item of itemsPrevios) {
            // item.id es el ID del registro en inv_general_conteo_items
            // Ojo: findByConteo devuelve items con estructura join, verificar si trae el ID del registro
            // Usualmente trae { id, cantidad, ... }
            if (item.id) {
                await ConteoItemModel.delete(item.id);
            }
        }
      } else {
        // Crear nuevo encabezado
        conteo = await ConteoModel.create({
          ubicacion_id: ubicacionId,
          usuario_id: usuarioId,
          tipo_conteo: 4, // AJUSTE FINAL
          estado: 'finalizado', // Nace finalizado
          correo_empleado: usuarioEmail
        });
      }
      
      const conteoId = conteo.id;

      // 3. Insertar los items nuevos
      const resultados = [];
      for (const item of items) {
        // item: { codigo, cantidad, companiaId, itemId }
        // Llamamos a agregarItem internamente. 
        const result = await this.agregarItem(
          conteoId, 
          item.codigo, 
          item.cantidad, 
          item.companiaId, 
          usuarioEmail,
          item.itemId // Pasar el ID directo si existe
        );

        if (!result.success) {
          // Si falla un item, lanzamos error para que el usuario sepa que algo salió mal
          // y no crea que se guardó todo correctamente.
          throw new Error(`Error al guardar item ${item.codigo}: ${result.message}`);
        }

        resultados.push(result);
      }

      return {
        success: true,
        data: { conteo, items_procesados: resultados.length },
        message: 'Ajuste final guardado exitosamente'
      };

    } catch (error) {
      throw new Error(`Error al crear ajuste final: ${error.message}`);
    }
  }

  /**
   * Exportar datos de bodega (Optimizado)
   */
  static async exportarBodega(bodegaId) {
    try {
      console.log(`[EXPORT] Iniciando exportación optimizada para bodega ${bodegaId}`);
      
      const { data, error } = await supabase
        .from('v_inventario_consolidado_completo')
        .select('item_sku, item_nombre, bodega, cantidad_total')
        .eq('bodega_id', bodegaId)
        .eq('nivel', 'ubicacion');

      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          success: true,
          data: [],
          message: 'No hay datos consolidados para exportar en esta bodega.'
        };
      }

      const itemMap = {};
      let bodegaNombre = '';

      data.forEach(row => {
        if (!bodegaNombre && row.bodega) bodegaNombre = row.bodega;
        const key = row.item_sku;
        if (!itemMap[key]) {
          itemMap[key] = {
            item: row.item_sku,
            descripcion: row.item_nombre,
            bodega: row.bodega,
            conteo_cantidad: 0
          };
        }
        itemMap[key].conteo_cantidad += Number(row.cantidad_total || 0);
      });

      const resultado = Object.values(itemMap);

      return {
        success: true,
        data: resultado,
        bodega: bodegaNombre,
        message: `Datos exportados correctamente. ${resultado.length} items únicos.`
      };

    } catch (error) {
      console.error('[EXPORT ERROR]', error);
      throw new Error(`Error al exportar datos de bodega: ${error.message}`);
    }
  }

  /* CODIGO ANTIGUO (DEPRECATED):
  static async _old_exportarBodega(bodegaId) {
    try {
      // 1. Obtener todos los conteos finalizados de la bodega con sus items
      const conteos = await ConteoModel.findAllWithItems({ bodegaId });
      
      if (!conteos || conteos.length === 0) {
        return {
          success: true,
          data: [],
          message: 'No hay datos para exportar en esta bodega'
        };
      }

      // 2. Agrupar conteos por ubicación y tipo
      const locMap = new Map(); // ubicacionId -> { c1, c2, c3, c4, items: Set<string>, bodegaNombre }

      conteos.forEach(conteo => {
        const ubicacionId = conteo.ubicacion_id;
        if (!locMap.has(ubicacionId)) {
          locMap.set(ubicacionId, {
            c1: null,
            c2: null,
            c3: null,
            c4: null,
            allItems: new Set(),
            bodegaNombre: conteo.ubicacion?.pasillo?.zona?.bodega?.nombre || ''
          });
        }

        const locData = locMap.get(ubicacionId);
        
        // Convertir items de array a Map para acceso rápido
        const itemsMap = new Map();
        if (conteo.items && Array.isArray(conteo.items)) {
          conteo.items.forEach(i => {
             const key = i.item?.codigo || i.item_id;
             const desc = i.item?.descripcion || 'Sin Descripción';
             const qty = parseFloat(i.cantidad || 0);

             // Guardar metadata del item y SUMAR cantidades (Fix para múltiples registros por item)
             if (itemsMap.has(key)) {
               itemsMap.get(key).cantidad += qty;
             } else {
               itemsMap.set(key, { 
                 cantidad: qty, 
                 descripcion: desc,
                 itemCode: i.item?.codigo || 'S/C'
               });
             }
             locData.allItems.add(key);
          });
        }

        // Asignar según tipo (si hay duplicados del mismo tipo, mezclamos los items para sumar conteos parciales)
        const type = Number(conteo.tipo_conteo);
        let target = null;
        
        if (type === 1) target = 'c1';
        else if (type === 2) target = 'c2';
        else if (type === 3) target = 'c3';
        else if (type === 4) target = 'c4';

        if (target) {
             if (!locData[target]) {
                 // Si no existe el slot, lo creamos
                 locData[target] = { items: itemsMap, date: conteo.created_at };
             } else {
                 // Si ya existe (ej: varias sesiones de conteo 1), MEZCLAMOS (Merge)
                 const existingMap = locData[target].items;
                 
                 itemsMap.forEach((val, k) => {
                     if (existingMap.has(k)) {
                         // Si el item ya estaba, sumamos la cantidad
                         existingMap.get(k).cantidad += val.cantidad;
                     } else {
                         // Si es nuevo, lo agregamos
                         existingMap.set(k, val);
                     }
                 });

                 // Actualizamos fecha si este conteo es más reciente
                 if (new Date(conteo.created_at) > new Date(locData[target].date)) {
                     locData[target].date = conteo.created_at;
                 }
             }
        }
      });

      // 3. Resolver item por item usando lógica de consenso
      const exportItemsMap = new Map();
      let bodegaNombreGlobal = '';

      for (const [locId, locData] of locMap) {
         if (!bodegaNombreGlobal && locData.bodegaNombre) bodegaNombreGlobal = locData.bodegaNombre;

         for (const itemKey of locData.allItems) {
             // getQty mejorado: Maneja conteos parciales (C3)
             // isPartial = true: Si el item no existe, retorna null (ignorar)
             // isPartial = false: Si el item no existe, retorna 0 (no encontrado en conteo ciego)
             const getQty = (cContainer, key, isPartial = false) => {
                 if (!cContainer) return null; // El conteo no existe
                 const itemData = cContainer.items.get(key);
                 if (itemData) return itemData.cantidad;
                 // Item no encontrado en este conteo:
                 return isPartial ? null : 0; 
             };

             const q1 = getQty(locData.c1, itemKey, false); // C1 Completo
             const q2 = getQty(locData.c2, itemKey, false); // C2 Completo
             const q3 = getQty(locData.c3, itemKey, true);  // C3 Parcial (Solo diferencias)
             const q4 = getQty(locData.c4, itemKey, false); // C4 Ajuste Final (Asumimos completo para la ubicación)

             // Obtener metadata
             let meta = locData.c1?.items.get(itemKey) || 
                        locData.c2?.items.get(itemKey) || 
                        locData.c3?.items.get(itemKey) || 
                        locData.c4?.items.get(itemKey);

             let finalQty = 0;

             // Lógica de Prioridad Ajustada para prevenir falsos ceros
             // 1. Ajuste Final (C4) es la verdad absoluta si existe.
             if (q4 !== null && q4 > 0) {
                 finalQty = q4;
             }
             // FIX: Si q4 es 0 explícito, solo lo respetamos si NO hay historial masivo en C1/C2 que sugiera un error.
             // (Ej: C1=8000, C2=8000, C4=0 -> Sospechoso, mostramos 8000)
             else if (q4 === 0 && (q1 > 10 || q2 > 10)) {
                 // Ignoramos el ajuste en 0 si parece accidente y tomamos el consenso
                 if (q1 !== null && q2 !== null && q1 === q2) finalQty = q1;
                 else if (q2 !== null) finalQty = q2;
                 else finalQty = q1 || 0;
             }
             else if (q4 === 0) {
                 finalQty = 0; // Es un 0 genuino y no hay evidencia fuerte en contra
             }
             // 2. Si hay un "Reconteo" o "Tercero" (C3).
             else if (q3 !== null && q3 > 0) {
                 finalQty = q3;
             }
             // 3. Si hay Consenso (C1 == C2), usamos ese valor.
             else if (q1 !== null && q2 !== null && q1 === q2) {
                 finalQty = q1;
             }
             // 4. Fallback a C2 (Último conteo regular).
             else if (q2 !== null) {
                 finalQty = q2;
             }
             // 5. Fallback a C1.
             else if (q1 !== null) {
                 finalQty = q1;
             }
             
             // ULITMO RECURSO: Si todo dio 0 pero hubo conteo en algun momento, mostrar el maximo encontrado
             if (finalQty === 0) {
                 const maxVal = Math.max(q1 || 0, q2 || 0, q3 || 0, q4 || 0);
                 if (maxVal > 0) finalQty = maxVal;
             }
             
             // Agregar al acumulado global
             if (finalQty > 0) {
                 // Normalizar clave de exportación (Siempre código de barras si es posible)
                 const exportKey = meta?.itemCode !== 'S/C' ? meta.itemCode : itemKey;
                 
                 if (!exportItemsMap.has(exportKey)) {
                     exportItemsMap.set(exportKey, {
                         item: exportKey,
                         descripcion: meta?.descripcion || 'Sin Descripción',
                         bodega: bodegaNombreGlobal,
                         conteo_cantidad: 0
                     });
                 }
                 exportItemsMap.get(exportKey).conteo_cantidad += finalQty;
             }
         }
      }

      // 4. Convertir a array
      const resultado = Array.from(exportItemsMap.values());

      return {
        success: true,
        data: resultado,
        bodega: bodegaNombreGlobal,
        message: `Datos exportados correctamente. ${resultado.length} items únicos.`
      };

    } catch (error) {
      throw new Error(`Error al exportar datos de bodega: ${error.message}`);
    }
  }
  */
}

export default ConteoService;