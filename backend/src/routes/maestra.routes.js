
import express from 'express';
import multer from 'multer';
import { uploadMaestra, upsertItems, upsertCodigos } from '../controllers/maestra.controller.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Endpoint para subir la base de datos maestra
router.post('/upload-maestra', upload.single('file'), uploadMaestra);

// Endpoint para carga masiva de items desde frontend
router.post('/upsert-items', upsertItems);

// Endpoint para carga masiva de códigos de barras desde frontend
router.post('/upsert-codigos', upsertCodigos);

// Endpoint para obtener el estado actual de la base de datos maestra
router.get('/estado-actual', async (req, res) => {
	try {
		// Importar modelos
		const { default: ItemModel } = await import('../models/Item.model.js');
		const { default: CodigoModel } = await import('../models/Codigo.model.js');

		// Obtener todos los items activos usando Supabase
		const { supabase, TABLES } = await import('../config/supabase.js');
		const { data: items, error: itemsError } = await supabase
			.from(TABLES.ITEMS)
			.select('id')
			.eq('activo', true);
		if (itemsError) throw itemsError;

		// Obtener todos los códigos de barras activos usando Supabase
		const codigos = await CodigoModel.findAllActive();

		res.json({
			itemIds: items.map(i => i.id),
			codigoBarras: codigos.map(c => c.codigo_barras)
		});
	} catch (err) {
		console.error('Error en /estado-actual:', err);
		res.status(500).json({ error: 'Error consultando estado actual', details: err.message });
	}
});

export default router;
