// =====================================================
// RUTAS: REPORTES
// =====================================================

import express from 'express';
import { generateConteoReport } from '../utils/excelHandler.js';
import { generateInventoryReport } from '../services/reporteIA.service.js';
import { successResponse, errorResponse } from '../utils/responses.js';
import ConteoModel from '../models/Conteo.model.js';

const router = express.Router();

/**
 * Generar reporte IA
 * POST /api/reportes/ia
 */
router.post('/ia', async (req, res) => {
  try {
    const { filters } = req.body;
    
    if (!filters || !filters.bodega) {
      return errorResponse(res, 'Se requiere especificar la bodega para el análisis.', 400);
    }

    const report = await generateInventoryReport(filters);
    
    return successResponse(res, { report });
  } catch (error) {
    return errorResponse(res, error.message, 500, error);
  }
});

/**
 * Generar reporte de conteos en Excel
 * POST /api/reportes/conteos
 */
router.post('/conteos', async (req, res) => {
  try {
    const { tipo = 'general', conteoIds } = req.body;

    if (!conteoIds || !Array.isArray(conteoIds) || conteoIds.length === 0) {
      return errorResponse(res, 'Debe proporcionar al menos un ID de conteo', 400);
    }

    // Obtener conteos
    const conteos = await Promise.all(
      conteoIds.map(id => ConteoModel.findById(id))
    );

    // Formatear datos para el reporte
    const conteosFormateados = conteos.filter(c => c).map(conteo => ({
      bodega: conteo.ubicacion?.pasillo?.zona?.bodega?.nombre || '',
      zona: conteo.ubicacion?.pasillo?.zona?.nombre || '',
      pasillo: conteo.ubicacion?.pasillo?.numero || '',
      ubicacion: conteo.ubicacion?.numero || '',
      tipo_conteo: conteo.tipo_conteo,
      estado: conteo.estado,
      fecha_inicio: conteo.fecha_inicio,
      fecha_fin: conteo.fecha_fin,
      total_items: conteo.items?.length || 0,
      items: conteo.items || []
    }));

    // Generar Excel
    const excelResult = generateConteoReport(conteosFormateados, tipo);

    if (!excelResult.success) {
      return errorResponse(res, `Error al generar reporte: ${excelResult.error}`, 500);
    }

    // Enviar archivo
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Reporte_Conteos_${Date.now()}.xlsx`);
    res.send(excelResult.buffer);
  } catch (error) {
    return errorResponse(res, error.message, 500, error);
  }
});

/**
 * Generar reporte de diferencias en Excel
 * POST /api/reportes/diferencias
 */
router.post('/diferencias', async (req, res) => {
  try {
    const { diferencias } = req.body;

    if (!diferencias || !Array.isArray(diferencias)) {
      return errorResponse(res, 'Debe proporcionar el array de diferencias', 400);
    }

    // Generar Excel
    const excelResult = generateConteoReport(diferencias, 'diferencias');

    if (!excelResult.success) {
      return errorResponse(res, `Error al generar reporte: ${excelResult.error}`, 500);
    }

    // Enviar archivo
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Reporte_Diferencias_${Date.now()}.xlsx`);
    res.send(excelResult.buffer);
  } catch (error) {
    return errorResponse(res, error.message, 500, error);
  }
});

export default router;
