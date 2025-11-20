// CargaMaestraExcel.jsx
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import './CargaMaestraExcel.css';

/*
  Componente CargaMaestraExcel.jsx
  - Lectura y preview de Excel
  - Validaciones clave (headers, items que inician con 0, duplicados)
  - Construcción de processedData: items + codigos
  - Sincronización por lotes con backend independiente:
      GET  /estado-actual
      POST /upsert-items
      POST /upsert-codigos
      POST /desactivar-items
      POST /desactivar-codigos

  Configura la URL del backend externo con la variable de entorno apropiada:
    - Create React App: REACT_APP_INVENTARIO_API_URL
    - Vite: VITE_INVENTARIO_API_URL (si prefieres, inyecta en index.html)
    - O inyecta en runtime usando window.__REACT_APP_INVENTARIO_API_URL
*/

// Archivo de referencia subido por ti (imagen)
// /mnt/data/e9ca74c1-65f4-42c2-bdb6-bca1545d943f.png

// IIFE seguro para obtener API_BASE_URL sin usar `typeof import` ni provocar parse errors
const API_BASE_URL = (() => {
  // 1) create-react-app (reemplazado en build time)
  if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_INVENTARIO_API_URL) {
    return process.env.REACT_APP_INVENTARIO_API_URL;
  }

  // 2) Variable inyectada en runtime (index.html)
  if (typeof window !== 'undefined' && window.__REACT_APP_INVENTARIO_API_URL) {
    return window.__REACT_APP_INVENTARIO_API_URL;
  }

  // 3) Fallback local para desarrollo
  return 'http://localhost:3001/api/maestra'; // Cambiado a puerto 3001 y endpoint correcto
})();

console.log('[CargaMaestraExcel] API_BASE_URL =', API_BASE_URL);

const BATCH_SIZE = 400;

const simplify = (s) =>
  String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const isBarcodeHeader = (h, allHeaders = []) => {
  const t = simplify(h);
  if (/(^| )barcode( |$)|(^| )ean(13)?( |$)|(^| )gtin(14)?( |$)|(^| )upc( |$)/.test(t)) return true;
  if ((t.includes('codigo') || t.includes('cod')) && t.includes('barra')) return true;
  if (t === 'codigo') {
    const hasItem = allHeaders.some(hh => simplify(hh) === 'item' || simplify(hh) === 'item_id');
    if (hasItem) return true;
  }
  return false;
};

export default function CargaMaestraExcel() {
  const [selectedCompany, setSelectedCompany] = useState('');
  const [excelFile, setExcelFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [processedData, setProcessedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const companies = [
    { id: 'inv_merkahorro', nombre: 'Merkahorro' },
    { id: 'inv_megamayorista', nombre: 'Megamayorista' },
    { id: 'inv_construahorro', nombre: 'Construahorro' },
  ];

  // Lee archivo y devuelve filas JSON + headers (array) + rawSheet (array-of-arrays para preview)
  const readFileToJson = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const arrayBuffer = e.target.result;
          const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array', raw: false });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
          const headers = XLSX.utils.sheet_to_json(ws, { header: 1 })?.[0] || [];
          const rawSheet = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          resolve({ rows, headers, rawSheet });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setExcelFile(file);
    setPreview([]);
    setProcessedData(null);
    setMessage('Procesando archivo...');
    setLoading(true);

    try {
      const { rows, headers, rawSheet } = await readFileToJson(file);

      if (!rows || rows.length === 0) {
        setMessage('El archivo Excel está vacío.');
        setLoading(false);
        return;
      }

      // Preview (primeras 10 filas con encabezados)
      setPreview(rawSheet.slice(0, 10));

      // ----------------- VALIDACIONES -----------------

      // 1) Verificar columna item / item_id / producto
      const itemHeader = headers.find(h => ['item', 'item_id', 'producto', 'producto_id', 'codigo_item'].includes(simplify(h))) ||
        headers.find(h => /item|producto|codigo_item/i.test(h));
      if (!itemHeader) {
        setMessage('No se detectó columna de ITEM (busco "item" o "item_id" o "producto").');
        setLoading(false);
        return;
      }

      // 2) Detección de header de códigos de barras
      const barcodeHeader = headers.find(h => isBarcodeHeader(h, headers)) || null;

      // 3) Items que inician con '0' (error)
      const itemKeyCandidates = headers.filter(h => /^(item|item_id|producto|producto_id|codigo_item)$/i.test(simplify(h)));
      const itemKey = itemKeyCandidates[0] || itemHeader || headers[0];

      const badLeadingZero = [];
      rows.forEach((r, idx) => {
        const val = String(r[itemKey] ?? '').trim();
        if (val && val.startsWith('0')) badLeadingZero.push({ fila: idx + 2, item: val });
      });
      if (badLeadingZero.length > 0) {
        const ejemplos = badLeadingZero.slice(0, 6).map(b => `F${b.fila}:${b.item}`).join(', ');
        setMessage(`Hay ITEMS que inician con '0'. Ejemplos: ${ejemplos}. Corrige el Excel y vuelve a cargar.`);
        Swal.fire('Error', 'Hay ITEMS que inician con "0". Corrige el Excel y vuelve a cargar.', 'error');
        setLoading(false);
        return;
      }

      // 4) Duplicados dentro del Excel (item y código)
      const itemCounts = {};
      const codeCounts = {};
      rows.forEach(r => {
        if (barcodeHeader) {
          const code = String(r[barcodeHeader] ?? '').trim();
          if (code) codeCounts[code] = (codeCounts[code] || 0) + 1;
        }
      });
      const dupCodes = Object.entries(codeCounts).filter(([, c]) => c > 1).map(([code, c]) => ({ code, c }));
      if (dupCodes.length > 0) {
        const msg = `${dupCodes.length} CÓDIGOS duplicados (ej: ${dupCodes.slice(0, 3).map(d => d.code).join(', ')})`;
        setMessage(`Duplicados detectados: ${msg}. Revisa el Excel.`);
        Swal.fire('Errores en Excel', msg, 'error');
        setLoading(false);
        return;
      }

      // ----------------- NORMALIZACIÓN Y PROCESADO -----------------
      const get = (row, possibleKeys) => {
        for (const k of possibleKeys) {
          if (row[k] !== undefined && row[k] !== null) return String(row[k]).trim();
        }
        return '';
      };

      const itemsMap = new Map();
      const codigos = [];

      rows.forEach(r => {
        const id = get(r, ['Item', 'ITEM', 'item', 'item_id', 'ITEM_ID', 'producto', 'producto_id', 'codigo_item']);
        if (!id) return;

        if (!itemsMap.has(id)) {
          // El campo "codigo" debe ser el ID del item, no el código de barras
          itemsMap.set(id, {
            codigo: id,
            item: id,
            descripcion: get(r, ['Desc. item', 'DESC. ITEM', 'descripcion', 'Descripcion', 'DESCRIPCION']) || '',
            grupo: get(r, ['GRUPO', 'Grupo', 'grupo']) || null,
            activo: true,
            compania_id: selectedCompany || null,
            imported_from: excelFile ? excelFile.name : null
          });
        }

        if (barcodeHeader) {
          const code = get(r, [barcodeHeader]);
          if (code) {
            codigos.push({
              codigo_barras: code,
              item_id: id,
              unidad_medida: get(r, ['U.M.', 'UM', 'Unidad', 'unidad']) || 'UND',
              is_active: true,
              empresa_id: selectedCompany || null,
              imported_from: excelFile ? excelFile.name : null
            });
          }
        }
      });

      setProcessedData({ items: Array.from(itemsMap.values()), codigos });
      setMessage(`Procesado: ${itemsMap.size} items · ${codigos.length} códigos. Listo para sincronizar.`);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setMessage(`Error procesando archivo: ${err.message}`);
      setLoading(false);
    }
  };

  // Enviar lotes al backend (POST JSON)
  const sendBatches = async (endpoint, data) => {
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      const res = await fetch(`${API_BASE_URL}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: batch })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || `Error en endpoint ${endpoint}`);
      }
    }
  };

  const handleSync = async () => {
    if (!processedData) {
      Swal.fire('Atención', 'Carga y procesa un archivo Excel válido primero.', 'info');
      return;
    }
    if (!selectedCompany) {
      Swal.fire('Atención', 'Selecciona una compañía antes de sincronizar.', 'info');
      return;
    }

    const confirm = await Swal.fire({
      title: 'Confirmar sincronización',
      html: `Se sincronizarán <b>${processedData.items.length}</b> items y <b>${processedData.codigos.length}</b> códigos con la empresa <b>${selectedCompany}</b>.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, sincronizar'
    });
    if (!confirm.isConfirmed) return;

    setLoading(true);
    setMessage('Obteniendo estado actual de la base de datos...');
    try {
      const stateRes = await fetch(`${API_BASE_URL}/estado-actual`);
      if (!stateRes.ok) throw new Error('No se pudo obtener estado actual');
      const dbState = await stateRes.json();
      const dbItemIds = new Set(dbState.itemIds || []);
      const dbCodigoBarras = new Set(dbState.codigoBarras || []);

      const excelItemIds = new Set(processedData.items.map(i => i.item_id));
      const excelCodigos = new Set(processedData.codigos.map(c => c.codigo_barras));

      const itemsToUpsert = processedData.items;
      const codigosToUpsert = processedData.codigos;
      // Desactivar aquellos que están en DB pero no en Excel
      const itemsToDeactivate = [...dbItemIds].filter(id => !excelItemIds.has(id));
      const codigosToDeactivate = [...dbCodigoBarras].filter(code => !excelCodigos.has(code));

      // Ejecutar upserts y desactivaciones por lotes
      setMessage('Subiendo items por lotes...');
      if (itemsToUpsert.length) await sendBatches('upsert-items', itemsToUpsert);

      setMessage('Subiendo códigos por lotes...');
      if (codigosToUpsert.length) await sendBatches('upsert-codigos', codigosToUpsert);

      setMessage('Desactivando registros obsoletos...');
      if (itemsToDeactivate.length) await sendBatches('desactivar-items', itemsToDeactivate);
      if (codigosToDeactivate.length) await sendBatches('desactivar-codigos', codigosToDeactivate);

      Swal.fire('Éxito', 'Sincronización completada correctamente.', 'success');
      setMessage('Sincronización completada.');
      setProcessedData(null);
      setExcelFile(null);
      setPreview([]);
      // limpia input file
      const input = document.querySelector('input[type=file]');
      if (input) input.value = '';
    } catch (err) {
      console.error(err);
      Swal.fire('Error', `Ocurrió un error: ${err.message}`, 'error');
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="carga-maestra-excel">
      <h2>Carga Maestra Items (inv_general)</h2>

      <div className="cme-form-section">
        <label>Seleccionar Compañía</label>
        <select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}>
          <option value="">-- Seleccione compañía --</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      <div className="cme-form-section">
        <label>Seleccionar archivo Excel (.xlsx/.xls)</label>
        <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} disabled={loading} />
        {excelFile && <div className="cme-file-info">📄 {excelFile.name}</div>}
      </div>

      <div className="cme-form-actions">
        <button onClick={handleSync} disabled={loading || !processedData}>
          {loading ? 'Procesando...' : 'Sincronizar Base Maestra'}
        </button>
      </div>

      {message && (
        <div className={`cme-message ${message.toLowerCase().startsWith('error') || message.startsWith('❌')
            ? 'cme-error'
            : message.toLowerCase().includes('éxito') || message.toLowerCase().includes('completad')
              ? 'cme-success'
              : 'cme-info'
          }`}>
          {message}
        </div>
      )}

      {preview && preview.length > 0 && (
        <div className="cme-preview-section">
          <h4>Vista previa (primeras filas)</h4>
          <div className="cme-table-wrapper">
            <table className="cme-preview-table">
              <thead>
                <tr>{preview[0].map((h, i) => <th key={i}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {preview.slice(1).map((r, ri) => (
                  <tr key={ri}>
                    {r.map((c, ci) => <td key={ci}>{String(c ?? '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {processedData && (
        <div className="cme-processed-stats">
          <p>Items procesados: <b>{processedData.items.length}</b></p>
          <p>Códigos procesados: <b>{processedData.codigos.length}</b></p>
        </div>
      )}
    </div>
  );
}
