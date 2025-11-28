// =====================================================
// SERVICIO: CONTEOS
// =====================================================

import ConteoModel from '../models/Conteo.model.js';
import ConteoItemModel from '../models/ConteoItem.model.js';
import UbicacionModel from '../models/Ubicacion.model.js';
import ItemModel from '../models/Item.model.js';
import CodigoModel from '../models/Codigo.model.js';

class ConteoService {
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
          usuario_nombre: displayName, // Usar nombre real si existe
          estado: c.estado,
          // Corregido: Calcular total sumando las cantidades de los items, o usar el total_items de la BD si no hay items cargados
          total_items: c.conteo_items && c.conteo_items.length > 0 
            ? c.conteo_items.reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0) 
            : (c.total_items || 0)
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
   */
  static async getUbicacionesConDiferencias(companiaId) {
    try {
      // 1. Obtener todos los conteos finalizados de la compañía
      const conteos = await ConteoModel.findAll({ companiaId });
      
      // 2. Agrupar por ubicación
      const ubicacionesMap = new Map();
      
      conteos.forEach(c => {
        // Solo nos interesan conteos finalizados
        if (c.estado !== 'finalizado') return;

        const ubicacionId = c.ubicacion_id;
        if (!ubicacionesMap.has(ubicacionId)) {
          ubicacionesMap.set(ubicacionId, {
            ubicacion: c.ubicacion, // Info de ubicación
            c1: null,
            c2: null,
            c3: null
          });
        }
        
        const entry = ubicacionesMap.get(ubicacionId);
        if (c.tipo_conteo === 1) entry.c1 = c;
        if (c.tipo_conteo === 2) entry.c2 = c;
        if (c.tipo_conteo === 3) entry.c3 = c;
      });

      // 3. Filtrar candidatos: Tienen C1 y C2, pero NO C3
      const candidatos = [];
      for (const [id, data] of ubicacionesMap) {
        if (data.c1 && data.c2 && !data.c3) {
          candidatos.push(data);
        }
      }

      // 4. Calcular diferencias para los candidatos
      // Esto puede ser lento si hay muchos, pero es necesario para saber la diferencia real
      const resultados = [];
      
      for (const candidato of candidatos) {
        // Llamamos a calcularDiferencias (que ya trae los items y calcula)
        const diffResult = await this.calcularDiferencias(candidato.ubicacion.id);
        
        if (diffResult.success && diffResult.data.total_diferencias > 0) {
          resultados.push({
            ubicacion: candidato.ubicacion,
            diferencias: diffResult.data.diferencias,
            total_diferencias: diffResult.data.total_diferencias,
            conteo1: candidato.c1,
            conteo2: candidato.c2
          });
        }
      }

      return {
        success: true,
        data: resultados,
        count: resultados.length
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
   * Exportar datos de bodega para Excel
   */
  static async exportarBodega(bodegaId) {
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

      // 2. Seleccionar el conteo válido por ubicación (El de mayor jerarquía)
      // Jerarquía: 4 (Ajuste) > 3 (Reconteo) > 2 (Segundo) > 1 (Primero)
      const ubicacionesMap = new Map();

      conteos.forEach(conteo => {
        const ubicacionId = conteo.ubicacion_id;
        
        if (!ubicacionesMap.has(ubicacionId)) {
          ubicacionesMap.set(ubicacionId, conteo);
        } else {
          const current = ubicacionesMap.get(ubicacionId);
          // Si el nuevo tiene mayor tipo_conteo, reemplaza al anterior
          if (conteo.tipo_conteo > current.tipo_conteo) {
            ubicacionesMap.set(ubicacionId, conteo);
          }
          // Si tienen el mismo tipo (raro en finalizados validos, pero posible por error), 
          // tomamos el más reciente
          else if (conteo.tipo_conteo === current.tipo_conteo) {
            if (new Date(conteo.created_at) > new Date(current.created_at)) {
              ubicacionesMap.set(ubicacionId, conteo);
            }
          }
        }
      });

      // 3. Agregar items de los conteos ganadores
      const itemsMap = new Map();
      const conteosFinales = Array.from(ubicacionesMap.values());
      let bodegaNombre = '';

      conteosFinales.forEach(conteo => {
        if (!bodegaNombre && conteo.ubicacion?.pasillo?.zona?.bodega?.nombre) {
          bodegaNombre = conteo.ubicacion.pasillo.zona.bodega.nombre;
        }

        if (conteo.items && Array.isArray(conteo.items)) {
          conteo.items.forEach(conteoItem => {
            const itemKey = conteoItem.item?.codigo || conteoItem.item_id; // Agrupar por código o ID
            
            if (!itemsMap.has(itemKey)) {
              itemsMap.set(itemKey, {
                item: conteoItem.item?.codigo || 'S/C',
                descripcion: conteoItem.item?.descripcion || 'Sin Descripción',
                bodega: bodegaNombre,
                conteo_cantidad: 0
              });
            }
            
            const entry = itemsMap.get(itemKey);
            entry.conteo_cantidad += parseFloat(conteoItem.cantidad || 0);
          });
        }
      });

      // 4. Convertir a array
      const resultado = Array.from(itemsMap.values());

      return {
        success: true,
        data: resultado,
        bodega: bodegaNombre,
        message: `Datos exportados correctamente. ${resultado.length} items únicos.`
      };

    } catch (error) {
      throw new Error(`Error al exportar datos de bodega: ${error.message}`);
    }
  }
}

export default ConteoService;
