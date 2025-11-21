// services/item.service.js
import Item from '../models/Item.model.js'; // Sequelize model
import { Op } from 'sequelize';

const updateFields = ['item','descripcion','unidad_medida','grupo','activo','compania_id','imported_from','updated_at'];

export const bulkUpsertMaestra = async (rows = [], opts = {}) => {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('No hay filas para procesar');

  const compania_id = opts.compania_id || null;
  // normalizar rows y extraer codigos
  const normalized = rows.map(r => ({
    codigo: String(r.codigo).trim(),
    item: r.item || null,
    descripcion: r.descripcion || null,
    unidad_medida: r.unidad_medida || null,
    grupo: r.grupo || null,
    activo: typeof r.activo === 'boolean' ? r.activo : true,
    compania_id,
    imported_from: r.imported_from || 'excel',
    updated_at: new Date()
  }));

  const codigos = [...new Set(normalized.map(r => r.codigo))];

  // obtener códigos ya existentes
  const existingRows = await Item.findAll({ where: { codigo: { [Op.in]: codigos } }, attributes: ['codigo'] });
  const existingSet = new Set(existingRows.map(r => r.codigo));

  const newRows = normalized.filter(r => !existingSet.has(r.codigo));
  const toUpdate = normalized.filter(r => existingSet.has(r.codigo));

  const transaction = await Item.sequelize.transaction();
  try {
    // insertar nuevos
    if (newRows.length) {
      await Item.bulkCreate(newRows, { transaction });
    }

    // actualizar existentes: usamos bulkCreate + updateOnDuplicate para MySQL/Postgres (Sequelize soporta updateOnDuplicate para MySQL, MariaDB; para Postgres se puede usar 'updateOnDuplicate' plugin o hacer updates por lote)
    if (toUpdate.length) {
      // Para Postgres con Sequelize, updateOnDuplicate no siempre disponible. Como alternativa, hacer individual updates en paralelo.
      const updates = toUpdate.map(r => Item.update(
        {
          item: r.item,
          descripcion: r.descripcion,
          unidad_medida: r.unidad_medida,
          grupo: r.grupo,
          activo: r.activo,
          compania_id: r.compania_id,
          imported_from: r.imported_from,
          updated_at: r.updated_at
        },
        { where: { codigo: r.codigo }, transaction }
      ));
      await Promise.all(updates);
    }

    await transaction.commit();
    return { success: true, processed: normalized.length, inserted: newRows.length, updated: toUpdate.length };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

export default { bulkUpsertMaestra };
