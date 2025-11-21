
import express from 'express';
import { upload } from '../middleware/uploadHandler.js';
import { uploadMaestra, upsertItems, upsertCodigos } from '../controllers/maestra.controller.js';
import { maestraRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Aplicar rate limiter flexible solo a estas rutas
router.use(maestraRateLimiter);

// Endpoint para subir la base de datos maestra
router.post('/upload-maestra', upload.single('file'), uploadMaestra);

// Endpoint para carga masiva de items desde frontend
router.post('/upsert-items', upsertItems);

// Endpoint para carga masiva de códigos de barras desde frontend
router.post('/upsert-codigos', upsertCodigos);

// Endpoint para desactivar items que no están en el Excel
router.post('/desactivar-items', async (req, res) => {
	try {
		const { items: codigos, compania_id } = req.body;
		
		if (!compania_id) {
			return res.status(400).json({ 
				error: 'compania_id es requerido' 
			});
		}
		
		if (!Array.isArray(codigos) || codigos.length === 0) {
			return res.json({ success: true, message: 'No hay items para desactivar' });
		}

		const { supabase, TABLES } = await import('../config/supabase.js');
		const { error } = await supabase
			.from(TABLES.ITEMS)
			.update({ activo: false })
			.in('codigo', codigos)
			.eq('compania_id', compania_id);

		if (error) throw error;

		res.json({ success: true, count: codigos.length, message: 'Items desactivados' });
	} catch (err) {
		console.error('Error desactivando items:', err);
		res.status(500).json({ error: 'Error desactivando items', details: err.message });
	}
});

// Endpoint para desactivar códigos de barras que no están en el Excel
router.post('/desactivar-codigos', async (req, res) => {
	try {
		const { items: codigosBarras, compania_id } = req.body;
		
		if (!compania_id) {
			return res.status(400).json({ 
				error: 'compania_id es requerido' 
			});
		}
		
		if (!Array.isArray(codigosBarras) || codigosBarras.length === 0) {
			return res.json({ success: true, message: 'No hay códigos para desactivar' });
		}

		const { supabase, TABLES } = await import('../config/supabase.js');
		const { error } = await supabase
			.from(TABLES.CODIGOS)
			.update({ activo: false })
			.in('codigo_barras', codigosBarras)
			.eq('compania_id', compania_id);

		if (error) throw error;

		res.json({ success: true, count: codigosBarras.length, message: 'Códigos desactivados' });
	} catch (err) {
		console.error('Error desactivando códigos:', err);
		res.status(500).json({ error: 'Error desactivando códigos', details: err.message });
	}
});

// Endpoint para subir la base de datos maestra
router.post('/upload-maestra', upload.single('file'), uploadMaestra);

// Endpoint para carga masiva de items desde frontend
router.post('/upsert-items', upsertItems);

// Endpoint para carga masiva de códigos de barras desde frontend
router.post('/upsert-codigos', upsertCodigos);

// Endpoint para obtener el estado actual de la base de datos maestra
router.get('/estado-actual', async (req, res) => {
	try {
		const { compania_id } = req.query;
		
		if (!compania_id) {
			return res.status(400).json({ 
				error: 'compania_id es requerido',
				message: 'Debes especificar la compañía para obtener el estado actual'
			});
		}

		// Importar modelos
		const { default: ItemModel } = await import('../models/Item.model.js');
		const { default: CodigoModel } = await import('../models/Codigo.model.js');

		// Obtener todos los items activos de esta compañía
		const { supabase, TABLES } = await import('../config/supabase.js');
		const { data: items, error: itemsError } = await supabase
			.from(TABLES.ITEMS)
			.select('codigo')
			.eq('activo', true)
			.eq('compania_id', compania_id);
		if (itemsError) throw itemsError;

		// Obtener todos los códigos de barras activos de esta compañía
		const { data: codigos, error: codigosError } = await supabase
			.from(TABLES.CODIGOS)
			.select('codigo_barras')
			.eq('activo', true)
			.eq('compania_id', compania_id);
		if (codigosError) throw codigosError;

		res.json({
			itemCodigos: items.map(i => i.codigo),
			codigoBarras: codigos.map(c => c.codigo_barras)
		});
	} catch (err) {
		console.error('Error en /estado-actual:', err);
		res.status(500).json({ error: 'Error consultando estado actual', details: err.message });
	}
});

export default router;
