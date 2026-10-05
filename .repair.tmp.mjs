// One-off repair: re-point barcodes (inv_general_codigos.item_id) to the item of
// their own company. Plan/backup generated beforehand: [{ id, codigo_barras,
// compania_id, item_id_anterior, item_id_nuevo, f120 }].
// Usage: node ./.repair.tmp.mjs <backup.json>   (delete this file afterwards)
import 'dotenv/config';
import fs from 'fs';

const { supabase } = await import('./src/config/supabase.js');

const BACKUP = process.argv[2];
if (!BACKUP) {
  console.error('Usage: node ./.repair.tmp.mjs <backup.json>');
  process.exit(1);
}

const plan = JSON.parse(fs.readFileSync(BACKUP, 'utf8'));
// Small batches: the read puts every id in the URL (~37 chars each) and 500 ids
// (~18 KB) made the server drop the connection ("fetch failed").
const LOTE = 150;
let actualizadas = 0;
let yaReparadas = 0;
let cambiadasPorOtro = 0;

console.log(`Plan: ${plan.length} filas`);

for (let i = 0; i < plan.length; i += LOTE) {
  const lote = plan.slice(i, i + LOTE);

  // Only touch rows that still hold the value recorded in the backup
  const { data: actuales, error: readError } = await supabase
    .from('inv_general_codigos')
    .select('id, item_id')
    .in('id', lote.map(p => p.id));
  if (readError) {
    console.error(`Lote ${i}: error leyendo: ${readError.message}`);
    process.exit(1);
  }
  const actualPorId = new Map(actuales.map(r => [r.id, r.item_id]));

  const aActualizar = [];
  for (const p of lote) {
    const actual = actualPorId.get(p.id);
    if (actual === p.item_id_nuevo) yaReparadas++;
    else if (actual !== p.item_id_anterior) cambiadasPorOtro++;
    else aActualizar.push({ id: p.id, codigo_barras: p.codigo_barras, compania_id: p.compania_id, item_id: p.item_id_nuevo });
  }

  if (aActualizar.length > 0) {
    const { error } = await supabase
      .from('inv_general_codigos')
      .upsert(aActualizar, { onConflict: 'id' });
    if (error) {
      console.error(`Lote ${i}: error actualizando: ${error.message}`);
      process.exit(1);
    }
    actualizadas += aActualizar.length;
  }

  if ((i / LOTE) % 70 === 0) console.log(`  ${Math.min(i + LOTE, plan.length)}/${plan.length}`);
}

console.log(`Listo. Actualizadas: ${actualizadas} | ya reparadas: ${yaReparadas} | omitidas (cambiadas por otro proceso): ${cambiadasPorOtro}`);
process.exit(0);
