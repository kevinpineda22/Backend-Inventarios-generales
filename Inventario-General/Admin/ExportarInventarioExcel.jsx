import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import { 
  Download, 
  FileSpreadsheet, 
  Building2, 
  Warehouse, 
  Hash,
  RefreshCw
} from 'lucide-react';
import { inventarioGeneralService } from '../services/inventarioGeneralService';
import './ExportarInventarioExcel.css';

const ExportarInventarioExcel = () => {
  const [selectedCompany, setSelectedCompany] = useState('');
  const [bodegas, setBodegas] = useState([]);
  const [selectedBodega, setSelectedBodega] = useState('');
  const [consecutivo, setConsecutivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingBodegas, setLoadingBodegas] = useState(false);

  const companies = [
    { id: '1', nombre: 'Merkahorro', color: '#10b981' },
    { id: '2', nombre: 'Megamayorista', color: '#f59e0b' },
    { id: '3', nombre: 'Construahorro', color: '#3b82f6' },
  ];

  // Cargar bodegas cuando cambia la compañía
  useEffect(() => {
    if (selectedCompany) {
      loadBodegas(selectedCompany);
    } else {
      setBodegas([]);
      setSelectedBodega('');
    }
  }, [selectedCompany]);

  const loadBodegas = async (companiaId) => {
    setLoadingBodegas(true);
    try {
      const data = await inventarioGeneralService.obtenerBodegas(companiaId);
      setBodegas(data);
    } catch (error) {
      console.error(error);
      Swal.fire('Error', 'No se pudieron cargar las bodegas', 'error');
    } finally {
      setLoadingBodegas(false);
    }
  };

  const handleExport = async () => {
    if (!selectedBodega) {
      Swal.fire('Atención', 'Seleccione una bodega', 'warning');
      return;
    }
    if (!consecutivo) {
      Swal.fire('Atención', 'Ingrese el número de consecutivo', 'warning');
      return;
    }

    setLoading(true);
    try {
      // 1. Obtener datos del backend
      const data = await inventarioGeneralService.exportarBodega(selectedBodega);

      if (!data || data.length === 0) {
        Swal.fire('Info', 'No hay datos finalizados para exportar en esta bodega', 'info');
        setLoading(false);
        return;
      }

      // 2. Formatear datos según requerimiento
      const formatQuantity = (quantity) => {
        const num = parseFloat(quantity) || 0;
        return num.toFixed(4);
      };

      const excelRows = data.map(item => ({
        NRO_INVENTARIO_BODEGA: consecutivo,
        ITEM: item.item ?? "",
        BODEGA: item.bodega ?? "",
        CANT_11ENT_PUNTO_4DECIMALES: formatQuantity(item.conteo_cantidad),
      }));

      // 3. Generar Excel
      const ws = XLSX.utils.json_to_sheet(excelRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Físico");
      
      const bodegaName = bodegas.find(b => b.id === selectedBodega)?.nombre || 'Bodega';
      const fileName = `inventario_${bodegaName.replace(/\s+/g, '_')}_consecutivo_${consecutivo}.xlsx`;
      
      XLSX.writeFile(wb, fileName);

      Swal.fire('Éxito', 'Archivo generado correctamente', 'success');

    } catch (error) {
      console.error(error);
      Swal.fire('Error', `Error al exportar: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="export-container">
      <div className="export-header">
        <h2>
          <FileSpreadsheet size={24} color="#27ae60" />
          Exportar Inventario a Excel
        </h2>
        <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '5px' }}>
          Genere el archivo plano de inventario físico agrupado por items para cargar al sistema ERP.
        </p>
      </div>

      <div className="export-form">
        {/* Selección de Compañía */}
        <div className="form-group">
          <label>Compañía</label>
          <div style={{ position: 'relative' }}>
            <select 
              className="form-control"
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">-- Seleccione Compañía --</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
            <Building2 size={18} style={{ position: 'absolute', right: '10px', top: '12px', color: '#95a5a6', pointerEvents: 'none' }} />
          </div>
        </div>

        {/* Selección de Bodega */}
        <div className="form-group">
          <label>Bodega</label>
          <div style={{ position: 'relative' }}>
            <select 
              className="form-control"
              value={selectedBodega}
              onChange={(e) => setSelectedBodega(e.target.value)}
              disabled={!selectedCompany || loadingBodegas}
              style={{ width: '100%' }}
            >
              <option value="">-- Seleccione Bodega --</option>
              {bodegas.map(b => (
                <option key={b.id} value={b.id}>{b.nombre}</option>
              ))}
            </select>
            {loadingBodegas ? (
              <RefreshCw className="spin" size={18} style={{ position: 'absolute', right: '10px', top: '12px', color: '#3498db' }} />
            ) : (
              <Warehouse size={18} style={{ position: 'absolute', right: '10px', top: '12px', color: '#95a5a6', pointerEvents: 'none' }} />
            )}
          </div>
        </div>

        {/* Input Consecutivo */}
        <div className="form-group">
          <label>Nro. Consecutivo (ERP)</label>
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              className="form-control"
              value={consecutivo}
              onChange={(e) => setConsecutivo(e.target.value)}
              placeholder="Ej: 10054"
              style={{ width: '100%', paddingRight: '35px' }}
            />
            <Hash size={18} style={{ position: 'absolute', right: '10px', top: '12px', color: '#95a5a6', pointerEvents: 'none' }} />
          </div>
        </div>

        {/* Botón Exportar */}
        <button 
          className="btn-export" 
          onClick={handleExport}
          disabled={loading || !selectedBodega || !consecutivo}
        >
          {loading ? (
            <>
              <RefreshCw className="spin" size={18} /> Generando...
            </>
          ) : (
            <>
              <Download size={18} /> Exportar Excel
            </>
          )}
        </button>
      </div>

      <div className="export-info">
        <strong>Nota:</strong> Se exportarán únicamente los items de conteos <strong>FINALIZADOS</strong>. 
        Si existen múltiples conteos para una misma ubicación, se tomará el de mayor jerarquía (Ajuste {'>'} Reconteo {'>'} Segundo {'>'} Primero).
        Las cantidades se agruparán por código de item.
      </div>
    </div>
  );
};

export default ExportarInventarioExcel;
