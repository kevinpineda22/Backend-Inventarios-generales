// =====================================================
// SERVICIO: INVENTARIO CONSOLIDADO
// =====================================================

import InventarioConsolidadoModel from '../models/InventarioConsolidado.model.js';
import ConteoModel from '../models/Conteo.model.js';
import ConteoItemModel from '../models/ConteoItem.model.js';
import UbicacionModel from '../models/Ubicacion.model.js';
import PasilloModel from '../models/Pasillo.model.js';
import ZonaModel from '../models/Zona.model.js';
import BodegaModel from '../models/Bodega.model.js';
import { supabase, supabaseAdmin, TABLES } from '../config/supabase.js';

const client = supabaseAdmin || supabase;

class InventarioConsolidadoService {
  /**
   * Consolidar inventario según nivel jerárquico
   */
  static async consolidarInventario(nivel, referenciaId) {
    try {
      let itemsConsolidados = [];
      let jerarquia = {};

      switch (nivel) {
        case 'ubicacion':
          itemsConsolidados = await this.calcularInventarioUbicacion(referenciaId);
          jerarquia = await this.getJerarquiaUbicacion(referenciaId);
          break;

        case 'pasillo':
          // Primero consolidar todas las ubicaciones del pasillo
          await this.consolidarUbicacionesDePasillo(referenciaId);
          // Luego sumar las consolidaciones
          itemsConsolidados = await this.sumarInventarioHijos('ubicacion', 'pasillo_id', referenciaId);
          jerarquia = await this.getJerarquiaPasillo(referenciaId);
          break;

        case 'zona':
          // Primero consolidar todos los pasillos de la zona
          await this.consolidarPasillosDeZona(referenciaId);
          // Luego sumar las consolidaciones
          itemsConsolidados = await this.sumarInventarioHijos('pasillo', 'zona_id', referenciaId);
          jerarquia = await this.getJerarquiaZona(referenciaId);
          break;

        case 'bodega':
          // Usa la consolidación batch optimizada: 1 query con joins + procesamiento en memoria
          return await this.consolidarBodegaBatch(referenciaId);

        default:
          throw new Error(`Nivel no válido: ${nivel}`);
      }

      // Guardar en tabla consolidada
      if (itemsConsolidados.length > 0) {
        await InventarioConsolidadoModel.upsertBatch(
          itemsConsolidados,
          nivel,
          referenciaId,
          jerarquia
        );
      }

      return {
        success: true,
        items_consolidados: itemsConsolidados.length,
        nivel,
        referencia_id: referenciaId
      };
    } catch (error) {
      throw new Error(`Error al consolidar inventario: ${error.message}`);
    }
  }

  /**
   * Consolidación optimizada de bodega completa.
   * En lugar de miles de queries secuenciales, hace:
   *   1 query con joins → procesa en memoria → 4 upserts (uno por nivel)
   * Reducción: de ~5000 queries a ~5 queries para una bodega mediana.
   */
  static async consolidarBodegaBatch(bodegaId) {
    // ── 1. Traer la bodega para obtener compania_id ──────────────────────────
    const bodega = await BodegaModel.findById(bodegaId);
    const companiaId = bodega.compania_id;

    // ── 2. Query única con paginación (para evitar límite de 1000 filas de Supabase) ────
    let allConteos = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: conteos, error } = await client
        .from(TABLES.CONTEOS)
        .select(`
          tipo_conteo,
          ubicacion_id,
          ubicacion:${TABLES.UBICACIONES}!inner(
            id,
            pasillo:${TABLES.PASILLOS}!inner(
              id,
              zona:${TABLES.ZONAS}!inner(
                id,
                bodega_id
              )
            )
          ),
          items:${TABLES.CONTEO_ITEMS}(
            item_id,
            cantidad
          )
        `)
        .eq('ubicacion.pasillo.zona.bodega_id', bodegaId)
        .eq('ubicacion.activo', true)
        .eq('ubicacion.pasillo.activo', true)
        .eq('ubicacion.pasillo.zona.activo', true)
        .range(from, from + step - 1);

      if (error) throw new Error(`Error al obtener datos de la bodega: ${error.message}`);
      
      if (conteos && conteos.length > 0) {
        allConteos.push(...conteos);
        from += step;
        if (conteos.length < step) hasMore = false;
      } else {
        hasMore = false;
      }
    }

    if (allConteos.length === 0) {
      return { success: true, items_consolidados: 0, nivel: 'bodega', referencia_id: bodegaId };
    }

    // ── 3. Procesar en memoria ───────────────────────────────────────────────
    // Map< ubicacionId, Map< itemId, { q1, q2, q3, q4 } > >
    const porUbicacion = new Map();
    // Para reconstruir jerarquía: ubicacionId → { pasillo_id, zona_id }
    const jerarquiaUbicacion = new Map();

    for (const conteo of allConteos) {
      if (!conteo.items || conteo.items.length === 0) continue;

      const tipo = conteo.tipo_conteo;
      const ubic = conteo.ubicacion;
      const ubicId = ubic.id;
      const pasilloId = ubic.pasillo.id;
      const zonaId = ubic.pasillo.zona.id;

      if (!jerarquiaUbicacion.has(ubicId)) {
        jerarquiaUbicacion.set(ubicId, { pasillo_id: pasilloId, zona_id: zonaId });
      }
      if (!porUbicacion.has(ubicId)) porUbicacion.set(ubicId, new Map());
      const itemsUbic = porUbicacion.get(ubicId);

      for (const row of conteo.items) {
        const itemId = row.item_id;
        const cantidad = Number(row.cantidad) || 0;

        if (!itemsUbic.has(itemId)) itemsUbic.set(itemId, { q1: 0, q2: 0, q3: 0, q4: 0 });
        const counts = itemsUbic.get(itemId);

        if (tipo === 1)      counts.q1 += cantidad;
        else if (tipo === 2) counts.q2 += cantidad;
        else if (tipo === 3) counts.q3 += cantidad;
        else if (tipo === 4) counts.q4 += cantidad;
      }
    }

    // ── 4. Aplicar lógica de prioridad y acumular por nivel ─────────────────
    // nivel ubicacion: Map< ubicId, Map< itemId, cantFinal > >
    // nivel pasillo:   Map< pasilloId, Map< itemId, cantFinal > >
    // nivel zona:      Map< zonaId,    Map< itemId, cantFinal > >
    // nivel bodega:    Map< itemId, cantFinal >
    const acumPasillo = new Map();
    const acumZona = new Map();
    const acumBodega = new Map();

    const recordsUbicacion = [];
    const recordsPasillo = [];
    const recordsZona = [];

    const _acumular = (acumMap, keyId, itemId, cantidad) => {
      if (!acumMap.has(keyId)) acumMap.set(keyId, new Map());
      const m = acumMap.get(keyId);
      m.set(itemId, (m.get(itemId) || 0) + cantidad);
    };

    const _prioridad = (counts) => {
      if (counts.q4 > 0) return counts.q4;
      if (counts.q3 > 0) return counts.q3;
      if (counts.q1 === counts.q2 && counts.q1 > 0) return counts.q1;
      if (counts.q2 > 0) return counts.q2;
      if (counts.q1 > 0) return counts.q1;
      return Math.max(counts.q1, counts.q2, counts.q3, counts.q4);
    };

    for (const [ubicId, itemsMap] of porUbicacion) {
      const { pasillo_id, zona_id } = jerarquiaUbicacion.get(ubicId);

      for (const [itemId, counts] of itemsMap) {
        const cantFinal = _prioridad(counts);
        if (cantFinal <= 0) continue;

        // Registro nivel ubicación
        recordsUbicacion.push({
          nivel: 'ubicacion',
          referencia_id: ubicId,
          item_id: itemId,
          cantidad_total: cantFinal,
          compania_id: parseInt(companiaId),
          bodega_id: bodegaId,
          zona_id: zona_id,
          pasillo_id: pasillo_id,
          ubicacion_id: ubicId
        });

        // Acumular hacia arriba
        _acumular(acumPasillo, pasillo_id, itemId, cantFinal);
        _acumular(acumZona, zona_id, itemId, cantFinal);
        acumBodega.set(itemId, (acumBodega.get(itemId) || 0) + cantFinal);
      }
    }

    // Construir jerarquía de pasillos y zonas (necesitamos sus metadatos)
    // Los tenemos en jerarquiaUbicacion, extraer únicos
    const pasilloMeta = new Map(); // pasilloId → zona_id
    for (const [, { pasillo_id, zona_id }] of jerarquiaUbicacion) {
      if (!pasilloMeta.has(pasillo_id)) pasilloMeta.set(pasillo_id, zona_id);
    }

    for (const [pasilloId, itemsMap] of acumPasillo) {
      const zona_id = pasilloMeta.get(pasilloId);
      for (const [itemId, cantFinal] of itemsMap) {
        recordsPasillo.push({
          nivel: 'pasillo',
          referencia_id: pasilloId,
          item_id: itemId,
          cantidad_total: cantFinal,
          compania_id: parseInt(companiaId),
          bodega_id: bodegaId,
          zona_id: zona_id,
          pasillo_id: pasilloId,
          ubicacion_id: null
        });
      }
    }

    for (const [zonaId, itemsMap] of acumZona) {
      for (const [itemId, cantFinal] of itemsMap) {
        recordsZona.push({
          nivel: 'zona',
          referencia_id: zonaId,
          item_id: itemId,
          cantidad_total: cantFinal,
          compania_id: parseInt(companiaId),
          bodega_id: bodegaId,
          zona_id: zonaId,
          pasillo_id: null,
          ubicacion_id: null
        });
      }
    }

    const recordsBodega = [];
    for (const [itemId, cantFinal] of acumBodega) {
      recordsBodega.push({
        nivel: 'bodega',
        referencia_id: bodegaId,
        item_id: itemId,
        cantidad_total: cantFinal,
        compania_id: parseInt(companiaId),
        bodega_id: bodegaId,
        zona_id: null,
        pasillo_id: null,
        ubicacion_id: null
      });
    }

    // ── 5. Upsert de todos los niveles (4 queries en lugar de miles) ─────────
    const upsertNivel = async (records, nivelNombre) => {
      if (records.length === 0) return;
      // Supabase tiene límite de ~1000 filas por upsert; dividir si es necesario
      const BATCH_SIZE = 500;
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const chunk = records.slice(i, i + BATCH_SIZE);
        const { error: uErr } = await client
          .from('inv_general_inventario_consolidado')
          .upsert(chunk, { onConflict: 'nivel,referencia_id,item_id', ignoreDuplicates: false });
        if (uErr) throw new Error(`Error upsert nivel ${nivelNombre}: ${uErr.message}`);
      }
    };

    await upsertNivel(recordsUbicacion, 'ubicacion');
    await upsertNivel(recordsPasillo, 'pasillo');
    await upsertNivel(recordsZona, 'zona');
    await upsertNivel(recordsBodega, 'bodega');

    const totalItems = recordsBodega.length;
    console.log(`[CONSOLIDACIÓN BATCH] Bodega ${bodegaId}: ${totalItems} items | ` +
      `${recordsUbicacion.length} ubicaciones, ${recordsPasillo.length} pasillos, ` +
      `${recordsZona.length} zonas`);

    return {
      success: true,
      items_consolidados: totalItems,
      nivel: 'bodega',
      referencia_id: bodegaId
    };
  }

  /**
   * Calcular inventario de una ubicación específica
   */
  static async calcularInventarioUbicacion(ubicacionId) {
    try {
      // Obtener conteos de esta ubicación (C1, C2, C3, C4)
      const conteos = await ConteoModel.findByUbicacion(ubicacionId);

      const conteosPorTipo = {
        c1: conteos.find(c => c.tipo_conteo === 1),
        c2: conteos.find(c => c.tipo_conteo === 2),
        c3: conteos.find(c => c.tipo_conteo === 3),
        c4: conteos.find(c => c.tipo_conteo === 4)
      };

      // Obtener items de cada conteo
      const itemsMap = new Map();

      for (const [tipo, conteo] of Object.entries(conteosPorTipo)) {
        if (!conteo) continue;

        const items = await ConteoItemModel.findByConteo(conteo.id);
        items.forEach(item => {
          const key = item.item_id;
          if (!itemsMap.has(key)) {
            itemsMap.set(key, { q1: 0, q2: 0, q3: 0, q4: 0 });
          }

          const data = itemsMap.get(key);
          const qty = Number(item.cantidad);

          if (tipo === 'c1') data.q1 += qty;
          else if (tipo === 'c2') data.q2 += qty;
          else if (tipo === 'c3') data.q3 += qty;
          else if (tipo === 'c4') data.q4 += qty;
        });
      }

      // Aplicar lógica de consenso
      const resultado = [];
      for (const [itemId, counts] of itemsMap) {
        let cantidadFinal = 0;

        // Prioridad: C4 > C3 > Consenso C1=C2 > C2 > C1
        if (counts.q4 > 0) {
          cantidadFinal = counts.q4;
        } else if (counts.q3 > 0) {
          cantidadFinal = counts.q3;
        } else if (counts.q1 === counts.q2 && counts.q1 > 0) {
          cantidadFinal = counts.q1;
        } else if (counts.q2 > 0) {
          cantidadFinal = counts.q2;
        } else {
          cantidadFinal = counts.q1;
        }

        // Safety net: rescatar si hay historial positivo
        if (cantidadFinal === 0) {
          const maxH = Math.max(counts.q1 || 0, counts.q2 || 0, counts.q3 || 0);
          if (maxH > 0) {
            cantidadFinal = maxH;
          }
        }

        if (cantidadFinal > 0) {
          resultado.push({ item_id: itemId, cantidad: cantidadFinal });
        }
      }

      return resultado;
    } catch (error) {
      throw new Error(`Error al calcular inventario de ubicación: ${error.message}`);
    }
  }

  /**
   * Sumar inventario de hijos (ubicaciones de un pasillo, pasillos de una zona, etc.)
   */
  static async sumarInventarioHijos(nivelHijo, campoFiltro, valorFiltro) {
    try {
      return await InventarioConsolidadoModel.sumByParent(nivelHijo, campoFiltro, valorFiltro);
    } catch (error) {
      throw new Error(`Error al sumar inventario de hijos: ${error.message}`);
    }
  }

  /**
   * Consolidar todas las ubicaciones de un pasillo
   */
  static async consolidarUbicacionesDePasillo(pasilloId) {
    const ubicaciones = await UbicacionModel.findByPasillo(pasilloId);
    const errores = [];

    for (const ubicacion of ubicaciones) {
      try {
        const itemsConsolidados = await this.calcularInventarioUbicacion(ubicacion.id);
        const jerarquia = await this.getJerarquiaUbicacion(ubicacion.id);

        if (itemsConsolidados.length > 0) {
          await InventarioConsolidadoModel.upsertBatch(
            itemsConsolidados,
            'ubicacion',
            ubicacion.id,
            jerarquia
          );
        }
      } catch (error) {
        console.error(`Error consolidando ubicación ${ubicacion.id}:`, error);
        errores.push({ id: ubicacion.id, error: error.message });
      }
    }

    if (errores.length > 0) {
      throw new Error(
        `Falló la consolidación de ${errores.length} ubicación(es) en pasillo ${pasilloId}: ` +
        errores.map(e => `[${e.id}: ${e.error}]`).join(', ')
      );
    }
  }

  /**
   * Consolidar todos los pasillos de una zona
   */
  static async consolidarPasillosDeZona(zonaId) {
    const pasillos = await PasilloModel.findByZona(zonaId);
    const errores = [];

    for (const pasillo of pasillos) {
      try {
        // Consolidar ubicaciones del pasillo primero
        await this.consolidarUbicacionesDePasillo(pasillo.id);

        // Luego consolidar el pasillo
        const itemsConsolidados = await this.sumarInventarioHijos('ubicacion', 'pasillo_id', pasillo.id);
        const jerarquia = await this.getJerarquiaPasillo(pasillo.id);

        if (itemsConsolidados.length > 0) {
          await InventarioConsolidadoModel.upsertBatch(
            itemsConsolidados,
            'pasillo',
            pasillo.id,
            jerarquia
          );
        }
      } catch (error) {
        console.error(`Error consolidando pasillo ${pasillo.id}:`, error);
        errores.push({ id: pasillo.id, error: error.message });
      }
    }

    if (errores.length > 0) {
      throw new Error(
        `Falló la consolidación de ${errores.length} pasillo(s) en zona ${zonaId}: ` +
        errores.map(e => `[${e.id}: ${e.error}]`).join(', ')
      );
    }
  }

  /**
   * Consolidar todas las zonas de una bodega
   */
  static async consolidarZonasDeBodega(bodegaId) {
    const zonas = await ZonaModel.findByBodega(bodegaId);
    const errores = [];

    for (const zona of zonas) {
      try {
        // Consolidar pasillos de la zona primero
        await this.consolidarPasillosDeZona(zona.id);

        // Luego consolidar la zona
        const itemsConsolidados = await this.sumarInventarioHijos('pasillo', 'zona_id', zona.id);
        const jerarquia = await this.getJerarquiaZona(zona.id);

        if (itemsConsolidados.length > 0) {
          await InventarioConsolidadoModel.upsertBatch(
            itemsConsolidados,
            'zona',
            zona.id,
            jerarquia
          );
        }
      } catch (error) {
        console.error(`Error consolidando zona ${zona.id} (${zona.nombre}):`, error);
        errores.push({ id: zona.id, nombre: zona.nombre, error: error.message });
      }
    }

    if (errores.length > 0) {
      const detalle = errores.map(e => `Zona "${e.nombre}" [${e.id}]: ${e.error}`).join(' | ');
      throw new Error(
        `Falló la consolidación de ${errores.length} zona(s) en bodega ${bodegaId}: ${detalle}`
      );
    }
  }

  /**
   * Obtener jerarquía completa de una ubicación
   * Usa el join que ya trae UbicacionModel.findById en lugar de 4 queries separadas
   */
  static async getJerarquiaUbicacion(ubicacionId) {
    const ubicacion = await UbicacionModel.findById(ubicacionId);
    const pasillo = ubicacion.pasillo;
    const zona = pasillo.zona;
    const bodega = zona.bodega;

    return {
      compania_id: bodega.compania_id,
      bodega_id: bodega.id,
      zona_id: zona.id,
      pasillo_id: pasillo.id,
      ubicacion_id: ubicacion.id
    };
  }

  /**
   * Obtener jerarquía completa de un pasillo
   * Usa el join que ya trae PasilloModel.findById en lugar de 3 queries separadas
   */
  static async getJerarquiaPasillo(pasilloId) {
    const pasillo = await PasilloModel.findById(pasilloId);
    const zona = pasillo.zona;
    const bodega = zona.bodega;

    return {
      compania_id: bodega.compania_id,
      bodega_id: bodega.id,
      zona_id: zona.id,
      pasillo_id: pasillo.id,
      ubicacion_id: null
    };
  }

  /**
   * Obtener jerarquía completa de una zona
   * Usa el join que ya trae ZonaModel.findById en lugar de 2 queries separadas
   */
  static async getJerarquiaZona(zonaId) {
    const zona = await ZonaModel.findById(zonaId);
    const bodega = zona.bodega;

    return {
      compania_id: bodega.compania_id,
      bodega_id: bodega.id,
      zona_id: zona.id,
      pasillo_id: null,
      ubicacion_id: null
    };
  }

  /**
   * Obtener jerarquía completa de una bodega
   */
  static async getJerarquiaBodega(bodegaId) {
    const bodega = await BodegaModel.findById(bodegaId);

    return {
      compania_id: bodega.compania_id,
      bodega_id: bodega.id,
      zona_id: null,
      pasillo_id: null,
      ubicacion_id: null
    };
  }
}

export default InventarioConsolidadoService;
