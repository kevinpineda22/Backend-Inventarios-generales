// =====================================================
// SERVICIO: RECONTEO SIESA
// =====================================================

import ReconteoSiesaModel from '../models/ReconteoSiesa.model.js';
import ConteoModel from '../models/Conteo.model.js';
import ConteoItemModel from '../models/ConteoItem.model.js';
import InventarioConsolidadoService from './inventario-consolidado.service.js';
import { supabase } from '../config/supabase.js';

class ReconteoSiesaService {

  /**
   * Generar reconteos a partir de datos de comparación SIESA.
   * Recibe los items con diferencia YA calculados en frontend (formato ComparacionSiesa)
   * y los cruza con el inventario consolidado para encontrar ubicaciones exactas.
   */
  static async generarReconteos({ companiaId, bodegaId, bodegaNombre, itemsDiferencia }) {
    try {
      if (!itemsDiferencia || itemsDiferencia.length === 0) {
        return { success: false, message: 'No hay items con diferencia para generar reconteos' };
      }

      // Generar ID de lote único
      const fecha = new Date();
      const loteId = `RS-${fecha.getFullYear()}${String(fecha.getMonth() + 1).padStart(2, '0')}${String(fecha.getDate()).padStart(2, '0')}-${String(fecha.getHours()).padStart(2, '0')}${String(fecha.getMinutes()).padStart(2, '0')}${String(fecha.getSeconds()).padStart(2, '0')}`;

      // Obtener los códigos de items con diferencia
      const codigosConDiff = itemsDiferencia.map(i => String(i.codigo).trim());

      // Buscar en inventario consolidado a nivel ubicación para esta bodega
      // para encontrar la ubicación exacta de cada item
      const { data: consolidado, error: consError } = await supabase
        .from('v_inventario_consolidado_completo')
        .select('*')
        .eq('bodega_id', bodegaId)
        .eq('compania_id', companiaId)
        .eq('nivel', 'ubicacion')
        .in('item_sku', codigosConDiff);

      if (consError) throw consError;

      // Crear mapa de diferencias por código
      const diffMap = {};
      itemsDiferencia.forEach(i => {
        diffMap[String(i.codigo).trim()] = {
          conteo: Number(i.conteo) || 0,
          siesa: Number(i.siesa) || 0,
          diferencia: Number(i.diff) || 0,
          descripcion: i.descripcion || ''
        };
      });

      // Crear registros de reconteo — uno por cada (item, ubicación)
      const registros = [];
      const itemsSinUbicacion = [];

      consolidado.forEach(row => {
        const codigo = String(row.item_sku).trim();
        const diffInfo = diffMap[codigo];
        if (!diffInfo) return;

        registros.push({
          compania_id: companiaId,
          bodega_id: bodegaId,
          zona_id: row.zona_id,
          pasillo_id: row.pasillo_id,
          ubicacion_id: row.ubicacion_id,
          item_id: row.item_id,
          item_codigo: codigo,
          item_descripcion: diffInfo.descripcion || row.item_nombre,
          cantidad_fisica: Number(row.cantidad_total) || 0,
          cantidad_siesa: diffInfo.siesa,
          diferencia: (Number(row.cantidad_total) || 0) - diffInfo.siesa,
          estado: 'pendiente',
          lote_id: loteId,
          bodega_nombre: row.bodega || bodegaNombre,
          zona_nombre: row.zona || '',
          pasillo_nombre: row.pasillo || '',
          ubicacion_nombre: row.ubicacion || '',
          fecha_comparacion: fecha.toISOString()
        });
      });

      // Detectar items con diferencia que no se encontraron en consolidado
      const codigosEncontrados = new Set(consolidado.map(r => String(r.item_sku).trim()));
      codigosConDiff.forEach(codigo => {
        if (!codigosEncontrados.has(codigo)) {
          itemsSinUbicacion.push(codigo);
        }
      });

      if (registros.length === 0) {
        return {
          success: false,
          message: 'No se encontraron ubicaciones para los items con diferencia. Verifique que el inventario esté consolidado.',
          items_sin_ubicacion: itemsSinUbicacion
        };
      }

      // Insertar en batch
      const insertados = await ReconteoSiesaModel.insertBatch(registros);

      return {
        success: true,
        message: `Se generaron ${insertados.length} reconteos en ${new Set(registros.map(r => r.ubicacion_id)).size} ubicaciones`,
        data: {
          lote_id: loteId,
          total_reconteos: insertados.length,
          ubicaciones_afectadas: new Set(registros.map(r => r.ubicacion_id)).size,
          items_sin_ubicacion: itemsSinUbicacion
        }
      };
    } catch (error) {
      throw new Error(`Error al generar reconteos SIESA: ${error.message}`);
    }
  }

  /**
   * Obtener reconteos por bodega con filtros
   */
  static async obtenerReconteos(bodegaId, filters = {}) {
    try {
      const data = await ReconteoSiesaModel.findByBodega(bodegaId, filters);
      return { success: true, data, count: data.length };
    } catch (error) {
      throw new Error(`Error al obtener reconteos: ${error.message}`);
    }
  }

  /**
   * Obtener reconteos asignados a un empleado
   */
  static async obtenerReconteosEmpleado(correoEmpleado, filters = {}) {
    try {
      const data = await ReconteoSiesaModel.findByEmpleado(correoEmpleado, filters);

      // Agrupar por ubicación para la UI del empleado
      const ubicacionesMap = new Map();
      data.forEach(r => {
        const key = r.ubicacion_id;
        if (!ubicacionesMap.has(key)) {
          ubicacionesMap.set(key, {
            ubicacion_id: r.ubicacion_id,
            ubicacion_nombre: r.ubicacion_nombre,
            pasillo_nombre: r.pasillo_nombre,
            zona_nombre: r.zona_nombre,
            bodega_nombre: r.bodega_nombre,
            bodega_id: r.bodega_id,
            compania_id: r.compania_id,
            items: [],
            total_items: 0,
            items_completados: 0,
            estado_general: 'pendiente'
          });
        }
        const ub = ubicacionesMap.get(key);
        ub.items.push(r);
        ub.total_items++;
        if (r.estado === 'finalizado' || r.estado === 'aprobado') ub.items_completados++;
      });

      // Determinar estado general de cada ubicación
      ubicacionesMap.forEach(ub => {
        const estados = ub.items.map(i => i.estado);
        if (estados.every(e => e === 'aprobado')) ub.estado_general = 'aprobado';
        else if (estados.every(e => e === 'finalizado' || e === 'aprobado')) ub.estado_general = 'finalizado';
        else if (estados.some(e => e === 'en_progreso')) ub.estado_general = 'en_progreso';
        else if (estados.some(e => e === 'asignado')) ub.estado_general = 'asignado';
        else ub.estado_general = 'pendiente';
      });

      return {
        success: true,
        data: Array.from(ubicacionesMap.values()),
        total_ubicaciones: ubicacionesMap.size,
        total_items: data.length
      };
    } catch (error) {
      throw new Error(`Error al obtener reconteos del empleado: ${error.message}`);
    }
  }

  /**
   * Asignar reconteos a un empleado (por IDs de reconteo)
   */
  static async asignarReconteos(reconteoIds, correoEmpleado) {
    try {
      if (!reconteoIds || reconteoIds.length === 0) {
        return { success: false, message: 'No se proporcionaron IDs de reconteo' };
      }

      const updated = await ReconteoSiesaModel.updateBatch(reconteoIds, {
        asignado_a: correoEmpleado,
        estado: 'asignado',
        fecha_asignacion: new Date().toISOString()
      });

      return {
        success: true,
        message: `${updated.length} reconteos asignados a ${correoEmpleado}`,
        data: updated
      };
    } catch (error) {
      throw new Error(`Error al asignar reconteos: ${error.message}`);
    }
  }

  /**
   * Asignar todos los reconteos de una ubicación a un empleado
   */
  static async asignarUbicacion(ubicacionId, correoEmpleado, loteId = null) {
    try {
      const filters = { estado: 'pendiente' };
      if (loteId) filters.lote_id = loteId;

      const items = await ReconteoSiesaModel.findByUbicacion(ubicacionId, filters);
      if (items.length === 0) {
        return { success: false, message: 'No hay reconteos pendientes en esta ubicación' };
      }

      const ids = items.map(i => i.id);
      return await this.asignarReconteos(ids, correoEmpleado);
    } catch (error) {
      throw new Error(`Error al asignar ubicación: ${error.message}`);
    }
  }

  /**
   * Iniciar reconteo de una ubicación (empleado empieza a contar)
   */
  static async iniciarReconteoUbicacion(ubicacionId, usuarioId, usuarioEmail) {
    try {
      // Buscar items asignados a este empleado en esta ubicación
      const items = await ReconteoSiesaModel.findByUbicacion(ubicacionId, { estado: 'asignado' });
      const misItems = items.filter(i => i.asignado_a === usuarioEmail);

      if (misItems.length === 0) {
        return { success: false, message: 'No tienes reconteos asignados en esta ubicación' };
      }

      // Crear conteo tipo 5
      const conteo = await ConteoModel.create({
        ubicacion_id: ubicacionId,
        usuario_id: usuarioId,
        tipo_conteo: 5,
        estado: 'en_progreso',
        correo_empleado: usuarioEmail
      });

      // Marcar items como en_progreso y asociar al conteo
      const ids = misItems.map(i => i.id);
      await ReconteoSiesaModel.updateBatch(ids, {
        estado: 'en_progreso',
        conteo_id: conteo.id
      });

      return {
        success: true,
        message: 'Reconteo iniciado',
        data: {
          conteo_id: conteo.id,
          items: misItems,
          total_items: misItems.length
        }
      };
    } catch (error) {
      throw new Error(`Error al iniciar reconteo: ${error.message}`);
    }
  }

  /**
   * Registrar cantidad de reconteo para un item específico
   */
  static async registrarCantidadReconteo(reconteoId, cantidad, conteoId, itemId, usuarioEmail) {
    try {
      // Actualizar el reconteo SIESA
      const updated = await ReconteoSiesaModel.update(reconteoId, {
        cantidad_reconteo: cantidad,
        fecha_reconteo: new Date().toISOString()
      });

      // Si hay un conteo_id, también registrar en conteo_items para la consolidación
      if (conteoId && itemId) {
        // Eliminar registros previos de este item en este conteo (estrategia "set qty")
        const { data: existentes } = await supabase
          .from('inv_general_conteo_items')
          .select('id')
          .eq('conteo_id', conteoId)
          .eq('item_id', itemId);

        if (existentes && existentes.length > 0) {
          for (const ex of existentes) {
            await ConteoItemModel.delete(ex.id);
          }
        }

        // Insertar nuevo registro con la cantidad del reconteo
        await ConteoItemModel.create({
          conteo_id: conteoId,
          item_id: itemId,
          cantidad: cantidad,
          usuario_email: usuarioEmail
        });
      }

      return {
        success: true,
        message: 'Cantidad registrada',
        data: updated
      };
    } catch (error) {
      throw new Error(`Error al registrar cantidad: ${error.message}`);
    }
  }

  /**
   * Finalizar reconteo de una ubicación
   */
  static async finalizarReconteoUbicacion(ubicacionId, conteoId) {
    try {
      // Obtener items en progreso de esta ubicación
      const items = await ReconteoSiesaModel.findByUbicacion(ubicacionId, { estado: 'en_progreso' });

      // Verificar que todos tienen cantidad_reconteo
      const sinContar = items.filter(i => i.cantidad_reconteo === null || i.cantidad_reconteo === undefined);
      if (sinContar.length > 0) {
        return {
          success: false,
          message: `Faltan ${sinContar.length} items por recontar`,
          items_pendientes: sinContar.map(i => i.item_codigo)
        };
      }

      // Finalizar el conteo tipo 5
      if (conteoId) {
        await ConteoModel.finalizar(conteoId);
      }

      // Marcar reconteos como finalizados
      const ids = items.map(i => i.id);
      await ReconteoSiesaModel.updateBatch(ids, {
        estado: 'finalizado'
      });

      return {
        success: true,
        message: `Reconteo finalizado con ${items.length} items`,
        data: { items_finalizados: items.length }
      };
    } catch (error) {
      throw new Error(`Error al finalizar reconteo: ${error.message}`);
    }
  }

  /**
   * Aprobar reconteos y re-consolidar inventario
   */
  static async aprobarReconteos(reconteoIds) {
    try {
      if (!reconteoIds || reconteoIds.length === 0) {
        return { success: false, message: 'No se proporcionaron IDs' };
      }

      // Obtener los reconteos a aprobar
      const reconteos = [];
      for (const id of reconteoIds) {
        const r = await ReconteoSiesaModel.findById(id);
        if (r && r.estado === 'finalizado') reconteos.push(r);
      }

      if (reconteos.length === 0) {
        return { success: false, message: 'No hay reconteos finalizados para aprobar' };
      }

      // Aprobar reconteos
      await ReconteoSiesaModel.updateBatch(
        reconteos.map(r => r.id),
        {
          estado: 'aprobado',
          fecha_aprobacion: new Date().toISOString()
        }
      );

      // Re-consolidar las ubicaciones afectadas
      const ubicacionesAfectadas = [...new Set(reconteos.map(r => r.ubicacion_id))];
      const reconsolidadas = [];

      for (const ubicacionId of ubicacionesAfectadas) {
        try {
          await InventarioConsolidadoService.consolidarInventario('ubicacion', ubicacionId);
          reconsolidadas.push(ubicacionId);
        } catch (e) {
          console.error(`Error reconsolidando ubicación ${ubicacionId}:`, e);
        }
      }

      // Re-consolidar pasillos, zonas y bodegas afectados
      const pasillosAfectados = [...new Set(reconteos.map(r => r.pasillo_id).filter(Boolean))];
      for (const pasilloId of pasillosAfectados) {
        try {
          const itemsConsolidados = await InventarioConsolidadoService.sumarInventarioHijos('ubicacion', 'pasillo_id', pasilloId);
          const jerarquia = await InventarioConsolidadoService.getJerarquiaPasillo(pasilloId);
          if (itemsConsolidados.length > 0) {
            const { default: InventarioConsolidadoModel } = await import('../models/InventarioConsolidado.model.js');
            await InventarioConsolidadoModel.upsertBatch(itemsConsolidados, 'pasillo', pasilloId, jerarquia);
          }
        } catch (e) {
          console.error(`Error reconsolidando pasillo ${pasilloId}:`, e);
        }
      }

      const zonasAfectadas = [...new Set(reconteos.map(r => r.zona_id).filter(Boolean))];
      for (const zonaId of zonasAfectadas) {
        try {
          const itemsConsolidados = await InventarioConsolidadoService.sumarInventarioHijos('pasillo', 'zona_id', zonaId);
          const jerarquia = await InventarioConsolidadoService.getJerarquiaZona(zonaId);
          if (itemsConsolidados.length > 0) {
            const { default: InventarioConsolidadoModel } = await import('../models/InventarioConsolidado.model.js');
            await InventarioConsolidadoModel.upsertBatch(itemsConsolidados, 'zona', zonaId, jerarquia);
          }
        } catch (e) {
          console.error(`Error reconsolidando zona ${zonaId}:`, e);
        }
      }

      const bodegasAfectadas = [...new Set(reconteos.map(r => r.bodega_id).filter(Boolean))];
      for (const bodegaId of bodegasAfectadas) {
        try {
          const itemsConsolidados = await InventarioConsolidadoService.sumarInventarioHijos('zona', 'bodega_id', bodegaId);
          const jerarquia = await InventarioConsolidadoService.getJerarquiaBodega(bodegaId);
          if (itemsConsolidados.length > 0) {
            const { default: InventarioConsolidadoModel } = await import('../models/InventarioConsolidado.model.js');
            await InventarioConsolidadoModel.upsertBatch(itemsConsolidados, 'bodega', bodegaId, jerarquia);
          }
        } catch (e) {
          console.error(`Error reconsolidando bodega ${bodegaId}:`, e);
        }
      }

      return {
        success: true,
        message: `${reconteos.length} reconteos aprobados y ${reconsolidadas.length} ubicaciones re-consolidadas`,
        data: {
          aprobados: reconteos.length,
          ubicaciones_reconsolidadas: reconsolidadas.length
        }
      };
    } catch (error) {
      throw new Error(`Error al aprobar reconteos: ${error.message}`);
    }
  }

  /**
   * Rechazar reconteos (volver a pendiente para re-asignar)
   */
  static async rechazarReconteos(reconteoIds, motivo = '') {
    try {
      await ReconteoSiesaModel.updateBatch(reconteoIds, {
        estado: 'rechazado',
        notas: motivo
      });

      return {
        success: true,
        message: `${reconteoIds.length} reconteos rechazados`
      };
    } catch (error) {
      throw new Error(`Error al rechazar reconteos: ${error.message}`);
    }
  }

  /**
   * Obtener resumen de reconteos por bodega
   */
  static async obtenerResumen(bodegaId) {
    try {
      const resumen = await ReconteoSiesaModel.getResumenByBodega(bodegaId);
      const lotes = await ReconteoSiesaModel.getLotesByBodega(bodegaId);
      const empleados = await ReconteoSiesaModel.getEmpleadosAsignados(bodegaId);

      return {
        success: true,
        data: {
          ...resumen,
          lotes,
          empleados_asignados: empleados
        }
      };
    } catch (error) {
      throw new Error(`Error al obtener resumen: ${error.message}`);
    }
  }

  /**
   * Eliminar un lote completo de reconteos
   */
  static async eliminarLote(loteId) {
    try {
      await ReconteoSiesaModel.deleteByLote(loteId);
      return {
        success: true,
        message: `Lote ${loteId} eliminado`
      };
    } catch (error) {
      throw new Error(`Error al eliminar lote: ${error.message}`);
    }
  }
}

export default ReconteoSiesaService;
