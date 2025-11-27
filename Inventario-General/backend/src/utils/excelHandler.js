// =====================================================
// UTILIDAD: MANEJO DE ARCHIVOS EXCEL
// =====================================================

import * as XLSX from 'xlsx';
import { validateExcelItem } from './validators.js';

/**
 * Leer archivo Excel y convertir a JSON
 */
export const readExcelFile = (filePath) => {
  try {
    const workbook = XLSX.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    return {
      success: true,
      data: jsonData,
      sheetName: firstSheetName
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Leer archivo Excel desde buffer
 */
export const readExcelBuffer = (buffer) => {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    return {
      success: true,
      data: jsonData,
      sheetName: firstSheetName
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Validar estructura de Excel para carga maestra
 */
export const validateExcelStructure = (data) => {
  if (!Array.isArray(data) || data.length === 0) {
    return {
      isValid: false,
      errors: ['El archivo está vacío o no tiene datos válidos']
    };
  }

  const requiredColumns = ['item', 'descripcion', 'codigo_barra'];
  const firstRow = data[0];
  const columns = Object.keys(firstRow).map(col => col.toLowerCase());

  const missingColumns = requiredColumns.filter(
    col => !columns.some(c => c.includes(col.toLowerCase()))
  );

  if (missingColumns.length > 0) {
    return {
      isValid: false,
      errors: [`Faltan las siguientes columnas: ${missingColumns.join(', ')}`]
    };
  }

  return {
    isValid: true,
    errors: []
  };
};

/**
 * Normalizar datos del Excel
 */
export const normalizeExcelData = (data, companiaId) => {
  return data.map(row => {
    // Mapear diferentes posibles nombres de columnas
    const item = row.item || row.Item || row.ITEM || '';
    const descripcion = row.descripcion || row.Descripcion || row.DESCRIPCION || row.description || '';
    const codigoBarra = row.codigo_barra || row.Codigo_Barra || row.CODIGO_BARRA || 
                        row['Código de Barra'] || row.barcode || '';

    return {
      item: String(item).trim(),
      descripcion: String(descripcion).trim(),
      codigo_barra: String(codigoBarra).trim(),
      compania_id: companiaId
    };
  });
};

/**
 * Validar items del Excel
 */
export const validateExcelItems = (items) => {
  const results = {
    valid: [],
    invalid: []
  };

  items.forEach((item, index) => {
    const validation = validateExcelItem(item);
    
    if (validation.isValid) {
      results.valid.push(item);
    } else {
      results.invalid.push({
        row: index + 2, // +2 porque: +1 por el header, +1 porque los índices empiezan en 0
        item,
        errors: validation.errors
      });
    }
  });

  return results;
};

/**
 * Generar archivo Excel desde datos
 */
export const generateExcelFile = (data, sheetName = 'Datos') => {
  try {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    // Generar buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    return {
      success: true,
      buffer
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Generar Excel de reporte de conteos
 */
export const generateConteoReport = (conteos, tipo = 'general') => {
  try {
    let data = [];

    if (tipo === 'general') {
      // Reporte general con resumen
      data = conteos.map(conteo => ({
        'Bodega': conteo.bodega || '',
        'Zona': conteo.zona || '',
        'Pasillo': conteo.pasillo || '',
        'Ubicación': conteo.ubicacion || '',
        'Tipo Conteo': `Conteo #${conteo.tipo_conteo}`,
        'Estado': conteo.estado || '',
        'Fecha Inicio': conteo.fecha_inicio ? new Date(conteo.fecha_inicio).toLocaleString() : '',
        'Fecha Fin': conteo.fecha_fin ? new Date(conteo.fecha_fin).toLocaleString() : '',
        'Total Items': conteo.total_items || 0
      }));
    } else if (tipo === 'detallado') {
      // Reporte detallado con items
      data = conteos.flatMap(conteo => 
        (conteo.items || []).map(item => ({
          'Bodega': conteo.bodega || '',
          'Zona': conteo.zona || '',
          'Pasillo': conteo.pasillo || '',
          'Ubicación': conteo.ubicacion || '',
          'Tipo Conteo': `Conteo #${conteo.tipo_conteo}`,
          'Item': item.item || '',
          'Descripción': item.descripcion || '',
          'Código Barra': item.codigo_barra || '',
          'Cantidad': item.cantidad || 0
        }))
      );
    } else if (tipo === 'diferencias') {
      // Reporte de diferencias entre conteos
      data = conteos.map(diff => ({
        'Item': diff.item || '',
        'Descripción': diff.descripcion || '',
        'Código Barra': diff.codigo_barra || '',
        'Conteo 1': diff.cantidad_conteo1 || 0,
        'Conteo 2': diff.cantidad_conteo2 || 0,
        'Diferencia': diff.diferencia || 0,
        'Estado': diff.diferencia === 0 ? 'Sin diferencia' : 'Con diferencia'
      }));
    }

    return generateExcelFile(data, `Reporte_${tipo}`);
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  readExcelFile,
  readExcelBuffer,
  validateExcelStructure,
  normalizeExcelData,
  validateExcelItems,
  generateExcelFile,
  generateConteoReport
};
