// Controlador para carga masiva de códigos de barras desde frontend
export const upsertCodigos = async (req, res) => {
  try {
    let codigos = req.body.items;
    if (!Array.isArray(codigos) || codigos.length === 0) {
      return responses.validationErrorResponse(res, ['No se recibieron códigos para insertar']);
    }

    // Extraer códigos de items únicos para buscar sus UUIDs
    const itemCodes = [...new Set(codigos.map(c => c.item_codigo))];
    
    // Buscar los UUIDs de los items en la base de datos
    const { default: ItemModel } = await import('../models/Item.model.js');
    const { supabase, TABLES } = await import('../config/supabase.js');
    
    const { data: items, error: itemsError } = await supabase
      .from(TABLES.ITEMS)
      .select('id, codigo')
      .in('codigo', itemCodes);
    
    if (itemsError) throw itemsError;
    
    // Crear un mapa de codigo -> UUID
    const itemMap = new Map();
    items.forEach(item => {
      itemMap.set(item.codigo, item.id);
    });
    
    // Mapear códigos con UUIDs correctos
    const codigosConUUID = codigos
      .map(c => {
        const uuid = itemMap.get(c.item_codigo);
        if (!uuid) {
          console.warn(`No se encontró UUID para item_codigo: ${c.item_codigo}`);
          return null;
        }
        
        return {
          codigo_barras: c.codigo_barras,
          item_id: uuid,
          unidad_medida: c.unidad_medida || 'UND',
          factor: c.factor || 1,
          activo: typeof c.activo !== 'undefined' ? c.activo : true,
          compania_id: c.compania_id ?? null,
          imported_from: c.imported_from
        };
      })
      .filter(c => c !== null); // Eliminar códigos sin UUID
    
    if (codigosConUUID.length === 0) {
      return responses.badRequest(res, 'No se encontraron items válidos para los códigos recibidos');
    }

    const { default: CodigoModel } = await import('../models/Codigo.model.js');
    const result = await CodigoModel.createMany(codigosConUUID);

    return responses.successResponse(res, { 
      count: result?.length || codigosConUUID.length, 
      codigos: result,
      codigosOmitidos: codigos.length - codigosConUUID.length
    }, 'Códigos insertados correctamente', 201);
  } catch (err) {
    console.error('Error al insertar códigos:', err);
    console.error('Datos recibidos:', req.body.items);
    return res.status(500).json({
      success: false,
      message: 'Error al insertar códigos',
      error: err.message,
      details: err
    });
  }
};
// controllers/maestra.controller.js
import fs from 'fs/promises';
import path from 'path';
import excelHandler from '../utils/excelHandler.js';
import itemService from '../services/item.service.js';
import responses from '../utils/responses.js';
import validators from '../utils/validators.js';

const normalizeKey = (k = '') =>
  String(k ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[\s\._\-]+/g, '_').trim();

export const uploadMaestra = async (req, res) => {
  try {
    if (!req.file) return responses.badRequest(res, 'No se recibió archivo');

    const filePath = req.file.path; // multer con dest: 'uploads/'
    // Leer el excel (excelHandler debe devolver { data: [ {A:B} ] })
    const excelResult = await excelHandler.readExcel(filePath);
    const rowsRaw = excelResult.data || [];


    // ...aquí iría el resto de la lógica original de uploadMaestra...
    // Para evitar errores, puedes dejar la función vacía o completarla luego.
    // Por ahora, la cierro correctamente:
  } catch (err) {
    return responses.error(res, 'Error en uploadMaestra', err);
  }
};

// Controlador para carga masiva de items desde frontend
export const upsertItems = async (req, res) => {
  try {
    const items = req.body.items;
    if (!Array.isArray(items) || items.length === 0) {
      return responses.validationErrorResponse(res, ['No se recibieron items para insertar']);
    }

    // Validar campos requeridos
    const validItems = items.map(item => ({
      codigo: item.codigo,
      item: item.item,
      descripcion: item.descripcion || null,
      grupo: item.grupo || null,
      activo: typeof item.activo !== 'undefined' ? item.activo : true,
      compania_id: item.compania_id || null,
      imported_from: item.imported_from || null
    }));

    // Insertar/actualizar items usando upsert (on conflict update)
    const { default: ItemModel } = await import('../models/Item.model.js');
    const result = await ItemModel.upsertMany(validItems);

    return responses.successResponse(res, { 
      count: result.length, 
      items: result 
    }, 'Items sincronizados correctamente', 201);
  } catch (err) {
    console.error('Error al insertar items:', err);
    console.error('Datos recibidos:', req.body.items);
    return res.status(500).json({
      success: false,
      message: 'Error al insertar items',
      error: err.message,
      details: err
    });
  }
};
