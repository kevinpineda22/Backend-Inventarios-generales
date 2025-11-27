// =====================================================
// SERVICIO: ITEMS (PRODUCTOS/ARTÍCULOS)
// =====================================================

import ItemModel from '../models/Item.model.js';
import CodigoModel from '../models/Codigo.model.js';
import { 
  normalizeExcelData, 
  validateExcelStructure, 
  validateExcelItems 
} from '../utils/excelHandler.js';

export class ItemService {
  /**
   * Obtener todos los items de una compañía
   */
  static async getByCompany(companiaId, filters = {}) {
    try {
      const items = await ItemModel.findByCompany(companiaId, filters);
      return {
        success: true,
        data: items,
        count: items.length
      };
    } catch (error) {
      throw new Error(`Error al obtener items: ${error.message}`);
    }
  }

  /**
   * Buscar item por código de barras
   */
  static async getByBarcode(codigoBarra, companiaId) {
    try {
      // Usar CodigoModel para buscar por código de barras y traer el item relacionado
      const codigoData = await CodigoModel.findByBarcodeWithItem(codigoBarra, companiaId);
      
      if (!codigoData) {
        return {
          success: false,
          message: 'Item no encontrado'
        };
      }

      // Formatear la respuesta para que el frontend la entienda fácilmente
      const item = {
        ...codigoData.inv_general_items, // id, item, descripcion, grupo
        unidad_medida: codigoData.unidad_medida,
        factor_empaque: codigoData.factor,
        codigo_barra_scanned: codigoData.codigo_barras
      };

      return {
        success: true,
        data: item
      };
    } catch (error) {
      throw new Error(`Error al buscar item: ${error.message}`);
    }
  }

  /**
   * Obtener item por ID
   */
  static async getById(id) {
    try {
      const item = await ItemModel.findById(id);
      
      if (!item) {
        return {
          success: false,
          message: 'Item no encontrado'
        };
      }

      return {
        success: true,
        data: item
      };
    } catch (error) {
      throw new Error(`Error al obtener item: ${error.message}`);
    }
  }

  /**
   * Crear un item
   */
  static async create(itemData) {
    try {
      const item = await ItemModel.create(itemData);
      
      return {
        success: true,
        data: item,
        message: 'Item creado exitosamente'
      };
    } catch (error) {
      throw new Error(`Error al crear item: ${error.message}`);
    }
  }

  /**
   * Cargar items desde Excel
   */
  static async uploadFromExcel(excelData, companiaId) {
    try {
      // Validar estructura del Excel
      const structureValidation = validateExcelStructure(excelData);
      if (!structureValidation.isValid) {
        return {
          success: false,
          errors: structureValidation.errors
        };
      }

      // Normalizar datos
      const normalizedData = normalizeExcelData(excelData, companiaId);

      // Validar items
      const validation = validateExcelItems(normalizedData);

      if (validation.invalid.length > 0) {
        return {
          success: false,
          message: 'Algunos items tienen errores de validación',
          valid: validation.valid.length,
          invalid: validation.invalid.length,
          errors: validation.invalid
        };
      }

      // Insertar items válidos
      const items = await ItemModel.createMany(validation.valid);

      return {
        success: true,
        message: `${items.length} items cargados exitosamente`,
        data: items,
        count: items.length
      };
    } catch (error) {
      throw new Error(`Error al cargar items desde Excel: ${error.message}`);
    }
  }

  /**
   * Actualizar un item
   */
  static async update(id, updateData) {
    try {
      const item = await ItemModel.update(id, updateData);
      
      return {
        success: true,
        data: item,
        message: 'Item actualizado exitosamente'
      };
    } catch (error) {
      throw new Error(`Error al actualizar item: ${error.message}`);
    }
  }

  /**
   * Eliminar un item
   */
  static async delete(id) {
    try {
      await ItemModel.delete(id);
      
      return {
        success: true,
        message: 'Item eliminado exitosamente'
      };
    } catch (error) {
      throw new Error(`Error al eliminar item: ${error.message}`);
    }
  }

  /**
   * Eliminar todos los items de una compañía
   */
  static async deleteByCompany(companiaId) {
    try {
      await ItemModel.deleteByCompany(companiaId);
      
      return {
        success: true,
        message: 'Todos los items de la compañía han sido eliminados'
      };
    } catch (error) {
      throw new Error(`Error al eliminar items: ${error.message}`);
    }
  }
}

export default ItemService;
