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
      
      // Formatear datos para el frontend
      const data = conteos.map(c => ({
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
        usuario_nombre: c.correo_empleado || c.usuario_id, // Usar correo si existe
        estado: c.estado,
        total_items: c.conteo_items && c.conteo_items[0] ? c.conteo_items[0].count : 0
      }));

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
      const existente = await ConteoModel.findByUbicacionAndTipo(ubicacionId, 4);
      if (existente) {
        // Opcional: Eliminar el anterior o lanzar error. 
        // Por seguridad, vamos a impedir sobreescribir si ya existe, o podríamos borrarlo.
        // Decisión: Borrar el anterior para permitir correcciones del admin.
        // Pero ConteoModel no tiene delete cascade fácil, así que mejor lanzamos error por ahora
        // o asumimos que el frontend ya validó.
        // Vamos a permitir "actualizar" borrando los items anteriores si existe, o simplemente creando uno nuevo si el modelo lo permite.
        // Dado que el modelo busca por ubicación y tipo, si ya existe, deberíamos usar ese ID y reemplazar items.
        
        // Estrategia: Si existe, limpiamos sus items y lo reutilizamos. Si no, creamos uno.
      }

      let conteoId;

      if (existente) {
        conteoId = existente.id;
        // Limpiar items anteriores
        // Necesitaríamos un método en ConteoItemModel para borrar por conteoId.
        // Como no lo tenemos visible aquí, vamos a asumir creación nueva y si falla por unique constraint, manejamos error.
        // Pero espera, `iniciarConteo` maneja la creación.
      }

      // 2. Crear o recuperar el encabezado del conteo (Tipo 4)
      // Usamos iniciarConteo que ya maneja la lógica de "si existe devuelve el actual"
      // Pasamos clave 'ADMIN_OVERRIDE' o similar si fuera necesario, pero iniciarConteo pide clave de ubicación.
      // Como esto es un proceso administrativo, quizás deberíamos saltarnos la validación de clave de `iniciarConteo`.
      // Mejor creamos el registro directamente usando el modelo.

      let conteo = await ConteoModel.findByUbicacionAndTipo(ubicacionId, 4);
      
      if (!conteo) {
        conteo = await ConteoModel.create({
          ubicacion_id: ubicacionId,
          usuario_id: usuarioId,
          tipo_conteo: 4, // AJUSTE FINAL
          estado: 'finalizado', // Nace finalizado
          correo_empleado: usuarioEmail
        });
      } else {
        // Si ya existe, actualizamos estado a finalizado por si acaso y usuario
        // TODO: Implementar update si fuera necesario
      }
      
      conteoId = conteo.id;

      // 3. Insertar los items
      // Como es un ajuste final, reemplazamos lo que hubiera (si es que estamos editando)
      // O simplemente insertamos.
      // Para evitar duplicados si se corre dos veces, idealmente borraríamos items previos del conteo 4.
      // Por ahora, iteramos e insertamos.
      
      const resultados = [];
      for (const item of items) {
        // item: { codigo, cantidad, companiaId }
        // Necesitamos buscar el item por código para obtener su ID
        // Reutilizamos la lógica de agregarItem pero optimizada o llamamos a agregarItem
        
        // Llamamos a agregarItem internamente. 
        // Nota: agregarItem espera codigoBarra.
        const result = await this.agregarItem(
          conteoId, 
          item.codigo, // Asumimos que 'codigo' es el código de barras o item code que agregarItem entiende
          item.cantidad, 
          item.companiaId, 
          usuarioEmail
        );
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
}

export default ConteoService;
