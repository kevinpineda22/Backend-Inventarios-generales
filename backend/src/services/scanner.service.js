// =====================================================
// EJEMPLO: SCANNER DE CÓDIGO DE BARRAS PARA INVENTARIO
// =====================================================
// Este archivo muestra cómo implementar el escaneo de códigos
// de barras y obtener la información del producto
// =====================================================

import { supabase } from '../config/supabase.js';

/**
 * Buscar producto por código de barras
 * @param {string} codigoBarras - Código escaneado
 * @param {string} companiaId - ID de la compañía (opcional)
 * @returns {Object} Información del producto
 */
export async function buscarProductoPorCodigoBarras(codigoBarras, companiaId = null) {
  try {
    // Query con JOIN entre codigos e items
    let query = supabase
      .from('inv_general_codigos')
      .select(`
        codigo_barras,
        unidad_medida,
        factor,
        activo,
        inv_general_items (
          id,
          codigo,
          item,
          descripcion,
          grupo
        )
      `)
      .eq('codigo_barras', codigoBarras)
      .eq('activo', true);

    // Filtrar por compañía si se proporciona
    if (companiaId) {
      query = query.eq('compania_id', companiaId);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No se encontró el código de barras
        return {
          success: false,
          message: 'Código de barras no encontrado',
          codigoBarras
        };
      }
      throw error;
    }

    // Verificar que el item también esté activo
    if (!data.inv_general_items || !data.inv_general_items.activo) {
      return {
        success: false,
        message: 'El producto asociado está inactivo',
        codigoBarras
      };
    }

    // Formatear respuesta
    return {
      success: true,
      producto: {
        // Datos del código de barras
        codigoBarras: data.codigo_barras,
        unidadMedida: data.unidad_medida,
        factor: data.factor,
        
        // Datos del item
        itemId: data.inv_general_items.id,
        codigo: data.inv_general_items.codigo,
        item: data.inv_general_items.item,
        descripcion: data.inv_general_items.descripcion,
        grupo: data.inv_general_items.grupo
      }
    };

  } catch (error) {
    console.error('Error al buscar producto:', error);
    return {
      success: false,
      message: 'Error al buscar el producto',
      error: error.message
    };
  }
}

/**
 * Registrar conteo de inventario
 * @param {string} conteoId - ID del conteo actual
 * @param {string} codigoBarras - Código escaneado
 * @param {number} cantidad - Cantidad contada
 * @param {string} ubicacion - Ubicación donde se encontró
 * @returns {Object} Resultado del registro
 */
export async function registrarConteo(conteoId, codigoBarras, cantidad = 1, ubicacion = null) {
  try {
    // 1. Buscar el producto
    const productoResult = await buscarProductoPorCodigoBarras(codigoBarras);
    
    if (!productoResult.success) {
      return productoResult;
    }

    const producto = productoResult.producto;

    // 2. Verificar si ya existe un registro para este código en este conteo
    const { data: existente, error: errorBuscar } = await supabase
      .from('inv_conteo_items')
      .select('id, cantidad')
      .eq('conteo_id', conteoId)
      .eq('codigo_barras', codigoBarras)
      .eq('ubicacion', ubicacion)
      .single();

    let result;

    if (existente) {
      // 3a. Si existe, incrementar la cantidad
      const { data, error } = await supabase
        .from('inv_conteo_items')
        .update({ 
          cantidad: existente.cantidad + cantidad,
          updated_at: new Date().toISOString()
        })
        .eq('id', existente.id)
        .select()
        .single();

      if (error) throw error;
      result = data;

    } else {
      // 3b. Si no existe, crear nuevo registro
      const { data, error } = await supabase
        .from('inv_conteo_items')
        .insert({
          conteo_id: conteoId,
          item_id: producto.itemId,
          codigo_barras: codigoBarras,
          item: producto.item,
          descripcion: producto.descripcion,
          unidad_medida: producto.unidadMedida,
          grupo: producto.grupo,
          cantidad: cantidad,
          factor: producto.factor,
          ubicacion: ubicacion
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return {
      success: true,
      message: 'Conteo registrado exitosamente',
      conteo: result,
      producto: producto
    };

  } catch (error) {
    console.error('Error al registrar conteo:', error);
    return {
      success: false,
      message: 'Error al registrar el conteo',
      error: error.message
    };
  }
}

/**
 * Obtener resumen de conteo por item
 * @param {string} conteoId - ID del conteo
 * @returns {Array} Lista de items con cantidades totales
 */
export async function obtenerResumenConteo(conteoId) {
  try {
    const { data, error } = await supabase
      .from('inv_conteo_items')
      .select(`
        item,
        descripcion,
        grupo,
        SUM(cantidad * factor) as cantidad_total_unidades,
        COUNT(*) as registros,
        array_agg(DISTINCT unidad_medida) as presentaciones
      `)
      .eq('conteo_id', conteoId)
      .group(['item', 'descripcion', 'grupo'])
      .order('item');

    if (error) throw error;

    return {
      success: true,
      resumen: data
    };

  } catch (error) {
    console.error('Error al obtener resumen:', error);
    return {
      success: false,
      message: 'Error al obtener el resumen',
      error: error.message
    };
  }
}

// =====================================================
// EJEMPLO DE USO EN COMPONENTE DE REACT
// =====================================================

/*
// Componente Scanner.jsx
import { useState, useEffect } from 'react';
import { buscarProductoPorCodigoBarras, registrarConteo } from './scannerService';

export default function Scanner({ conteoId, companiaId }) {
  const [codigoBarras, setCodigoBarras] = useState('');
  const [producto, setProducto] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleScan = async (e) => {
    e.preventDefault();
    if (!codigoBarras.trim()) return;

    setLoading(true);
    
    // Buscar producto
    const result = await buscarProductoPorCodigoBarras(codigoBarras, companiaId);
    
    if (result.success) {
      setProducto(result.producto);
      
      // Registrar conteo automáticamente
      const conteoResult = await registrarConteo(
        conteoId, 
        codigoBarras, 
        1,  // cantidad
        null // ubicacion
      );
      
      if (conteoResult.success) {
        alert(`✅ ${result.producto.descripcion} registrado!`);
      }
    } else {
      alert(`❌ ${result.message}`);
    }
    
    setLoading(false);
    setCodigoBarras(''); // Limpiar para siguiente escaneo
  };

  return (
    <div>
      <h2>Escanear Código de Barras</h2>
      
      <form onSubmit={handleScan}>
        <input
          type="text"
          value={codigoBarras}
          onChange={(e) => setCodigoBarras(e.target.value)}
          placeholder="Escanea o escribe el código"
          autoFocus
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Procesando...' : 'Buscar'}
        </button>
      </form>

      {producto && (
        <div className="producto-info">
          <h3>{producto.descripcion}</h3>
          <p>Item: {producto.item}</p>
          <p>Grupo: {producto.grupo}</p>
          <p>Unidad: {producto.unidadMedida}</p>
          <p>Código de barras: {producto.codigoBarras}</p>
        </div>
      )}
    </div>
  );
}
*/

// =====================================================
// EJEMPLO DE USO EN API ROUTE
// =====================================================

/*
// routes/scanner.routes.js
import express from 'express';
import { buscarProductoPorCodigoBarras, registrarConteo } from '../services/scanner.service.js';

const router = express.Router();

// POST /api/scanner/buscar
router.post('/buscar', async (req, res) => {
  const { codigoBarras, companiaId } = req.body;
  
  if (!codigoBarras) {
    return res.status(400).json({ 
      success: false, 
      message: 'Código de barras requerido' 
    });
  }

  const result = await buscarProductoPorCodigoBarras(codigoBarras, companiaId);
  res.json(result);
});

// POST /api/scanner/registrar
router.post('/registrar', async (req, res) => {
  const { conteoId, codigoBarras, cantidad, ubicacion } = req.body;
  
  if (!conteoId || !codigoBarras) {
    return res.status(400).json({ 
      success: false, 
      message: 'conteoId y codigoBarras son requeridos' 
    });
  }

  const result = await registrarConteo(conteoId, codigoBarras, cantidad, ubicacion);
  res.json(result);
});

export default router;
*/

export default {
  buscarProductoPorCodigoBarras,
  registrarConteo,
  obtenerResumenConteo
};
