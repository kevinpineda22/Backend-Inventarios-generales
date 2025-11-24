// CargaMaestraExcel.jsx
import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertCircle, 
  Database, 
  Building2, 
  RefreshCw, 
  X,
  FileText,
  ArrowRight,
  Trash2
} from 'lucide-react';
import './CargaMaestraExcel.css';
import { API_URL } from '../../services/inventarioService';

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

  // 3) Fallback usando la URL de producción del servicio
  return `${API_URL}/maestra`;
})();

console.log('[CargaMaestraExcel] API_BASE_URL =', API_BASE_URL);

const BATCH_SIZE = 400;

const simplify = (s) =>
  String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const isBarcodeHeader = (h, allHeaders = []) => {
  const t = simplify(h);
  // Patrones claros de código de barras
  if (/(^| )barcode( |$)|(^| )ean(13)?( |$)|(^| )gtin(14)?( |$)|(^| )upc( |$)/.test(t)) return true;
  if ((t.includes('codigo') || t.includes('cod')) && t.includes('barra')) return true;
  
  // NO considerar "Código" como código de barras si hay columna "Item"
  // La columna "Código" generalmente es el código del producto/item
  if (t === 'codigo') {
    const hasItem = allHeaders.some(hh => simplify(hh) === 'item' || simplify(hh) === 'item_id');
    if (hasItem) return false; // Si hay columna Item, Código NO es código de barras
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
  const [uploadStep, setUploadStep] = useState(1); // 1: Company, 2: File, 3: Review & Sync

  const companies = [
    { id: '1', nombre: 'Merkahorro', color: '#10b981', logo: '/icono.ico' },
    { id: '2', nombre: 'Megamayorista', color: '#f59e0b', logo: '/iconoMegamayoristas.jpg' },
    { id: '3', nombre: 'Construahorro', color: '#3b82f6', logo: '/iconoConstruahorroFondoBlanco.png' },
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

  const processFile = async (file) => {
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

      // 1) Verificar columnas obligatorias: Item y Codigo (código de barras)
      const codigoHeader = headers.find(h => ['codigo', 'código', 'codigo_barras', 'codigo de barras'].includes(simplify(h)));
      const itemHeader = headers.find(h => ['item', 'item_id'].includes(simplify(h)));
      
      if (!itemHeader) {
        setMessage('No se detectó columna ITEM (requerida).');
        setLoading(false);
        return;
      }
      
      if (!codigoHeader) {
        setMessage('No se detectó columna CODIGO (código de barras, requerida).');
        setLoading(false);
        return;
      }

      // 2) Ya no necesitamos detección de barcodeHeader porque "Codigo" ES el código de barras
      const barcodeHeader = null;

      // 3) Validar que Items no inicien con '0' (códigos de barras SÍ pueden)
      const itemKey = itemHeader;
      const codigoKey = codigoHeader;

      const badLeadingZero = [];
      rows.forEach((r, idx) => {
        const itemVal = String(r[itemKey] ?? '').trim();
        
        // Solo validar que ITEM no inicie con 0
        // Los códigos de barras SÍ pueden iniciar con 0
        if (itemVal && itemVal.startsWith('0')) {
          badLeadingZero.push({ fila: idx + 2, valor: itemVal });
        }
      });
      if (badLeadingZero.length > 0) {
        const ejemplos = badLeadingZero.slice(0, 6).map(b => `F${b.fila}:${b.valor}`).join(', ');
        setMessage(`Hay ITEMS que inician con '0'. Ejemplos: ${ejemplos}. Corrige el Excel y vuelve a cargar.`);
        Swal.fire('Error', 'Hay ITEMS que inician con "0". Los códigos de barras sí pueden iniciar con 0, pero los ITEMS no.', 'error');
        setLoading(false);
        return;
      }

      // 4) Duplicados dentro del Excel
      const itemCounts = {};
      const codeCounts = {};
      rows.forEach(r => {
        const itemVal = String(r[itemKey] ?? '').trim();
        const codigoVal = String(r[codigoKey] ?? '').trim();
        
        // No validamos duplicados de items porque SE ESPERA que se repitan
        // Un mismo item puede tener múltiples códigos de barras
        
        if (codigoVal) codeCounts[codigoVal] = (codeCounts[codigoVal] || 0) + 1;
      });
      
      // Solo validamos duplicados de códigos de barras
      const dupCodes = Object.entries(codeCounts).filter(([, c]) => c > 1).map(([code, c]) => ({ code, c }));
      if (dupCodes.length > 0) {
        const msg = `${dupCodes.length} CÓDIGOS DE BARRAS duplicados (ej: ${dupCodes.slice(0, 3).map(d => d.code).join(', ')})`;
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
        const codigoBarras = get(r, ['Codigo', 'CODIGO', 'codigo', 'Código', 'CÓDIGO', 'codigo_barras', 'Codigo de barras']);
        const item = get(r, ['Item', 'ITEM', 'item', 'item_id', 'ITEM_ID']);
        
        if (!item || !codigoBarras) return; // Ambos son obligatorios
        
        // ITEMS: Agregar solo si no existe (varios códigos de barras pueden tener el mismo item)
        if (!itemsMap.has(item)) {
          const estadoRaw = get(r, ['Estado item', 'ESTADO ITEM', 'estado_item', 'estado', 'activo', 'Estado']);
          const activo = !estadoRaw || simplify(estadoRaw) === 'activo' || estadoRaw === '1' || estadoRaw === 'true';
          
          itemsMap.set(item, {
            codigo: item,  // El codigo en la tabla items es el número del item (40013)
            item: item,
            descripcion: get(r, ['Desc. item', 'DESC. ITEM', 'descripcion', 'Descripcion', 'DESCRIPCION']) || '',
            grupo: get(r, ['GRUPO', 'Grupo', 'grupo']) || null,
            activo: activo,
            compania_id: selectedCompany,
            imported_from: file.name || 'excel_upload'
          });
        }

        // CODIGOS DE BARRAS: Siempre agregar (cada fila del Excel es un código único)
        const estadoRaw = get(r, ['Estado item', 'ESTADO ITEM', 'estado_item', 'estado', 'activo', 'Estado']);
        const activo = !estadoRaw || simplify(estadoRaw) === 'activo' || estadoRaw === '1' || estadoRaw === 'true';
        
        codigos.push({
          codigo_barras: codigoBarras,
          item_codigo: item,  // El backend resuelve esto al UUID del item
          unidad_medida: get(r, ['U.M.', 'UM', 'Unidad', 'unidad', 'unidad_medida']) || 'UND',
          factor: parseFloat(get(r, ['Factor', 'factor', 'FACTOR'])) || 1,
          activo: activo,
          compania_id: selectedCompany,
          imported_from: file.name || 'excel_upload'
        });
      });

      setProcessedData({ items: Array.from(itemsMap.values()), codigos });
      setMessage(`Procesado: ${itemsMap.size} items · ${codigos.length} códigos. Listo para sincronizar.`);
      setUploadStep(3); // Move to review step
      setLoading(false);
    } catch (err) {
      console.error(err);
      setMessage(`Error procesando archivo: ${err.message}`);
      setLoading(false);
    }
  };

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles?.length > 0) {
      processFile(acceptedFiles[0]);
    }
  }, [selectedCompany]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false,
    disabled: loading || !selectedCompany
  });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
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
      confirmButtonText: 'Sí, sincronizar',
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#ef4444'
    });
    if (!confirm.isConfirmed) return;

    setLoading(true);
    setMessage('Obteniendo estado actual de la base de datos...');
    try {
      const stateRes = await fetch(`${API_BASE_URL}/estado-actual?compania_id=${selectedCompany}`);
      if (!stateRes.ok) throw new Error('No se pudo obtener estado actual');
      const dbState = await stateRes.json();
      const dbItemCodigos = new Set(dbState.itemCodigos || []); // Codigos de items (no UUIDs)
      const dbCodigoBarras = new Set(dbState.codigoBarras || []);

      const excelItemCodigos = new Set(processedData.items.map(i => i.codigo));
      const excelCodigos = new Set(processedData.codigos.map(c => c.codigo_barras));

      const itemsToUpsert = processedData.items;
      const codigosToUpsert = processedData.codigos;
      // Desactivar aquellos que están en DB pero no en Excel
      const itemsToDeactivate = [...dbItemCodigos].filter(codigo => !excelItemCodigos.has(codigo));
      const codigosToDeactivate = [...dbCodigoBarras].filter(code => !excelCodigos.has(code));

      // Ejecutar upserts y desactivaciones por lotes
      setMessage('Subiendo items por lotes...');
      if (itemsToUpsert.length) await sendBatches('upsert-items', itemsToUpsert);

      setMessage('Subiendo códigos por lotes...');
      if (codigosToUpsert.length) await sendBatches('upsert-codigos', codigosToUpsert);

      setMessage('Desactivando registros obsoletos...');
      if (itemsToDeactivate.length) {
        await fetch(`${API_BASE_URL}/desactivar-items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: itemsToDeactivate, compania_id: selectedCompany })
        });
      }
      if (codigosToDeactivate.length) {
        await fetch(`${API_BASE_URL}/desactivar-codigos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: codigosToDeactivate, compania_id: selectedCompany })
        });
      }

      Swal.fire('Éxito', 'Sincronización completada correctamente.', 'success');
      setMessage('Sincronización completada.');
      setProcessedData(null);
      setExcelFile(null);
      setPreview([]);
      setUploadStep(1); // Reset to start
    } catch (err) {
      console.error(err);
      Swal.fire('Error', `Ocurrió un error: ${err.message}`, 'error');
      setMessage(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetProcess = () => {
    setExcelFile(null);
    setPreview([]);
    setProcessedData(null);
    setMessage('');
    setUploadStep(1);
  };

  return (
    <div className="carga-maestra-container">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="carga-maestra-card"
      >
        <div className="cme-header">
          <div className="cme-icon-wrapper">
            <Database size={32} color="#3b82f6" />
          </div>
          <div>
            <h2>Carga Maestra de Inventario</h2>
            <p>Sincroniza items y códigos de barras desde Excel</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="cme-steps">
          <div className={`cme-step ${uploadStep >= 1 ? 'active' : ''}`}>
            <div className="step-number">1</div>
            <span>Compañía</span>
          </div>
          <div className="cme-step-line"></div>
          <div className={`cme-step ${uploadStep >= 2 ? 'active' : ''}`}>
            <div className="step-number">2</div>
            <span>Archivo</span>
          </div>
          <div className="cme-step-line"></div>
          <div className={`cme-step ${uploadStep >= 3 ? 'active' : ''}`}>
            <div className="step-number">3</div>
            <span>Revisar y Sincronizar</span>
          </div>
        </div>

        <div className="cme-content">
          <AnimatePresence mode="wait">
            {/* STEP 1: SELECT COMPANY */}
            {uploadStep === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="cme-step-content"
              >
                <h3>Selecciona la Compañía</h3>
                <div className="company-grid">
                  {companies.map(c => (
                    <div 
                      key={c.id} 
                      className={`company-card ${selectedCompany === c.id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedCompany(c.id);
                        setUploadStep(2);
                      }}
                    >
                      {c.logo ? (
                        <img src={c.logo} alt={c.nombre} className="company-logo" />
                      ) : (
                        <Building2 size={32} color={selectedCompany === c.id ? '#3b82f6' : c.color} />
                      )}
                      <span>{c.nombre}</span>
                      {selectedCompany === c.id && <CheckCircle size={20} className="check-icon" />}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 2: UPLOAD FILE */}
            {uploadStep === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="cme-step-content"
              >
                <div className="step-header">
                  <h3>Sube tu archivo Excel</h3>
                  <button className="btn-text" onClick={() => setUploadStep(1)}>Cambiar compañía</button>
                </div>
                
                <div 
                  {...getRootProps()} 
                  className={`dropzone-area ${isDragActive ? 'active' : ''} ${loading ? 'disabled' : ''}`}
                >
                  <input {...getInputProps()} />
                  <div className="dropzone-content">
                    <div className="icon-circle">
                      <Upload size={32} />
                    </div>
                    {loading ? (
                      <div className="loading-state">
                        <RefreshCw className="spin" size={32} />
                        <p>Procesando archivo...</p>
                      </div>
                    ) : (
                      <>
                        <p className="primary-text">Arrastra tu archivo aquí o haz clic para buscar</p>
                        <p className="secondary-text">Soporta archivos .xlsx y .xls</p>
                      </>
                    )}
                  </div>
                </div>
                
                {message && message.includes('Error') && (
                  <div className="error-message">
                    <AlertCircle size={20} />
                    <span>{message}</span>
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 3: PREVIEW & SYNC */}
            {uploadStep === 3 && processedData && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="cme-step-content"
              >
                <div className="step-header">
                  <h3>Resumen de Carga</h3>
                  <div className="header-actions">
                    <span className="company-badge">
                      {companies.find(c => c.id === selectedCompany)?.nombre}
                    </span>
                    <button className="btn-icon" onClick={resetProcess} title="Cancelar">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-icon items">
                      <FileText size={24} />
                    </div>
                    <div className="stat-info">
                      <span className="stat-value">{processedData.items.length}</span>
                      <span className="stat-label">Items Únicos</span>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon codes">
                      <FileSpreadsheet size={24} />
                    </div>
                    <div className="stat-info">
                      <span className="stat-value">{processedData.codigos.length}</span>
                      <span className="stat-label">Códigos de Barra</span>
                    </div>
                  </div>
                </div>

                {preview.length > 0 && (
                  <div className="preview-container">
                    <h4>Vista Previa</h4>
                    <div className="table-scroll">
                      <table className="preview-table">
                        <thead>
                          <tr>{preview[0].map((h, i) => <th key={i}>{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {preview.slice(1, 6).map((r, ri) => (
                            <tr key={ri}>
                              {r.map((c, ci) => <td key={ci}>{String(c ?? '')}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="preview-footer">Mostrando primeras 5 filas de {preview.length - 1}</p>
                  </div>
                )}

                <div className="action-footer">
                  <button className="btn-secondary" onClick={() => setUploadStep(2)}>
                    Atrás
                  </button>
                  <button 
                    className="btn-primary" 
                    onClick={handleSync} 
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="spin" size={18} /> Sincronizando...
                      </>
                    ) : (
                      <>
                        <RefreshCw size={18} /> Sincronizar Base Maestra
                      </>
                    )}
                  </button>
                </div>
                
                {message && (
                  <div className={`status-message ${message.toLowerCase().includes('éxito') ? 'success' : 'info'}`}>
                    {message.toLowerCase().includes('éxito') ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    {message}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
