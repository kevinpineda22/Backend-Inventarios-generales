import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import { 
  Download, 
  FileSpreadsheet, 
  Building2, 
  Warehouse, 
  Hash,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { inventarioGeneralService } from '../../services/inventarioGeneralService';
import './ExportarInventarioExcel.css';

const ExportarInventarioExcel = () => {
  const [selectedCompany, setSelectedCompany] = useState('');
  const [bodegas, setBodegas] = useState([]);
  const [selectedBodega, setSelectedBodega] = useState('');
  const [consecutivo, setConsecutivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingBodegas, setLoadingBodegas] = useState(false);
  const [hierarchyStatus, setHierarchyStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

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

  // Cargar estado de jerarquía cuando cambia la bodega
  useEffect(() => {
    if (selectedBodega && selectedCompany) {
      checkHierarchyStatus();
    } else {
      setHierarchyStatus(null);
    }
  }, [selectedBodega, selectedCompany]);

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

  const checkHierarchyStatus = async () => {
    setLoadingStatus(true);
    try {
      const bodegaNombre = bodegas.find(b => b.id === selectedBodega)?.nombre;
      if (!bodegaNombre) return;

      const status = await inventarioGeneralService.obtenerEstadoJerarquia(bodegaNombre, selectedCompany);
      setHierarchyStatus(status);
    } catch (error) {
      console.error("Error checking hierarchy status:", error);
    } finally {
      setLoadingStatus(false);
    }
  };

  const getOpenAreas = () => {
    if (!hierarchyStatus?.estructura) return { zonas: 0, pasillos: 0 };
    
    let openZonas = 0;
    let openPasillos = 0;

    hierarchyStatus.estructura.forEach(z => {
      if (z.estado !== 'cerrado') openZonas++;
      z.pasillos.forEach(p => {
        if (p.estado !== 'cerrado') openPasillos++;
      });
    });

    return { zonas: openZonas, pasillos: openPasillos };
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

    // Validar áreas abiertas
    const openAreas = getOpenAreas();
    if (openAreas.zonas > 0 || openAreas.pasillos > 0) {
      const result = await Swal.fire({
        title: '⚠️ Áreas Abiertas Detectadas',
        html: `
          <p>Se han detectado áreas que aún no han sido cerradas:</p>
          <ul style="text-align: left; margin-bottom: 15px;">
            ${openAreas.zonas > 0 ? `<li><strong>${openAreas.zonas}</strong> Zonas abiertas</li>` : ''}
            ${openAreas.pasillos > 0 ? `<li><strong>${openAreas.pasillos}</strong> Pasillos abiertos</li>` : ''}
          </ul>
          <p>Se recomienda exportar solo cuando todo el inventario esté cerrado.</p>
          <p>¿Desea continuar de todos modos?</p>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, exportar de todos modos',
        cancelButtonText: 'Cancelar'
      });

      if (!result.isConfirmed) return;
    }

    setLoading(true);
    try {
      // 1. Obtener datos del backend
      const rawData = await inventarioGeneralService.exportarBodega(selectedBodega);

      if (!rawData || rawData.length === 0) {
        Swal.fire('Info', 'No hay datos finalizados para exportar en esta bodega', 'info');
        setLoading(false);
        return;
      }

      // El backend ya devuelve los datos consolidados (priorizando Ajuste > Reconteo > C2 > C1)
      // No es necesario filtrar por tipo_conteo ya que el endpoint devuelve una lista plana de items
      const data = rawData;

      // 2. Agrupar y Sumar por Item (Lógica de consolidación)
      const itemMap = {};

      data.forEach(item => {
        const key = item.item; // Usamos el código del item como clave única
        if (!itemMap[key]) {
          itemMap[key] = {
            item: item.item,
            bodega: item.bodega,
            cantidad: 0
          };
        }
        // Sumar cantidad (asegurando que sea número)
        itemMap[key].cantidad += parseFloat(item.conteo_cantidad) || 0;
      });

      // 3. Formatear datos según requerimiento
      const formatQuantity = (quantity) => {
        const num = parseFloat(quantity) || 0;
        return num.toFixed(4);
      };

      const excelRows = Object.values(itemMap)
        .filter(row => row.cantidad > 0)
        .map(row => ({
          NRO_INVENTARIO_BODEGA: consecutivo,
          ITEM: row.item ?? "",
          BODEGA: row.bodega ?? "",
          CANT_11ENT_PUNTO_4DECIMALES: formatQuantity(row.cantidad),
        }));

      // 4. Generar Excel
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
          {hierarchyStatus && (
            <div style={{ marginTop: '5px', fontSize: '0.85rem' }}>
              {(() => {
                const open = getOpenAreas();
                if (open.zonas === 0 && open.pasillos === 0) {
                  return <span style={{ color: '#27ae60', display: 'flex', alignItems: 'center', gap: '5px' }}>✅ Bodega completamente cerrada</span>;
                } else {
                  return (
                    <span style={{ color: '#e67e22', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <AlertTriangle size={14} /> 
                      Pendiente: {open.zonas} Zonas / {open.pasillos} Pasillos abiertos
                    </span>
                  );
                }
              })()}
            </div>
          )}
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
        <div className="btn-export-container">
          <button 
            className={`btn-export ${selectedBodega && consecutivo ? 'ready' : ''}`}
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
      </div>

      <div className="export-info">
        <strong>Nota:</strong> Se generará el archivo de inventario consolidado. El sistema selecciona automáticamente el registro definitivo para cada ubicación (priorizando Ajustes Finales y Reconteos validados) y agrupa las cantidades por código de item.
      </div>
    </div>
  );
};

export default ExportarInventarioExcel;
