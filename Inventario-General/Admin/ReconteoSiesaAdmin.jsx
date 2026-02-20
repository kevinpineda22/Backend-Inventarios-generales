import { useState, useEffect, useCallback } from 'react';
import './ReconteoSiesaAdmin.css';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { inventarioGeneralService } from '../../services/inventarioGeneralService';
import { getAllInventario, getSiesaStockBatch, getSiesaBodegas } from '../../services/SiesaComparisonService';

const STEPS = [
  { id: 1, label: 'Generar Reconteos' },
  { id: 2, label: 'Asignar a Empleados' },
  { id: 3, label: 'Aprobar / Rechazar' }
];

const ReconteoSiesaAdmin = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');

  // === STEP 1 - Generar ===
  const [selectedCompany, setSelectedCompany] = useState('');
  const [siesaBodegasOptions, setSiesaBodegasOptions] = useState([]);
  const [selectedSiesaBodega, setSelectedSiesaBodega] = useState('');
  const [bodegas, setBodegas] = useState([]);
  const [selectedBodega, setSelectedBodega] = useState('');
  const [fechaCorte, setFechaCorte] = useState(new Date().toISOString().slice(0, 10).replace(/-/g, ''));
  const [comparacionData, setComparacionData] = useState(null);
  const [stats, setStats] = useState({ match: 0, diff: 0, missingSiesa: 0 });
  const [filterText, setFilterText] = useState('');
  const [filterState, setFilterState] = useState('diff'); // Default: solo diferencias
  const [selectAll, setSelectAll] = useState(true);
  const [selectedItems, setSelectedItems] = useState(new Set());

  // === STEP 2 - Asignar ===
  const [reconteos, setReconteos] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [asignacionEmail, setAsignacionEmail] = useState('');
  const [selectedUbicaciones, setSelectedUbicaciones] = useState(new Set());
  const [expandedZonas, setExpandedZonas] = useState(new Set());
  const [filterEstado, setFilterEstado] = useState('');
  const [loteActivo, setLoteActivo] = useState('');
  const [lotes, setLotes] = useState([]);

  // === STEP 3 - Aprobar ===
  const [reconteosFinalzados, setReconteosFinalzados] = useState([]);

  const companies = [
    { id: '1', nombre: 'Merkahorro', ciaSiesa: '1' },
    { id: '2', nombre: 'Megamayorista', ciaSiesa: '2' },
  ];

  // =====================================================
  // EFFECTS
  // =====================================================

  useEffect(() => {
    if (selectedCompany) {
      loadBodegas(selectedCompany);
      loadSiesaBodegas(selectedCompany);
    }
  }, [selectedCompany]);

  useEffect(() => {
    if (selectedBodega && currentStep >= 2) {
      cargarDatosStep2();
    }
  }, [selectedBodega, currentStep]);

  // Al cambiar a step 3, cargar finalizados
  useEffect(() => {
    if (selectedBodega && currentStep === 3) {
      cargarFinalizados();
    }
  }, [currentStep, selectedBodega]);

  // Select all logic
  useEffect(() => {
    if (comparacionData) {
      const diffItems = comparacionData.filter(i => i.estado === 'diff');
      if (selectAll) {
        setSelectedItems(new Set(diffItems.map(i => i.codigo)));
      } else {
        setSelectedItems(new Set());
      }
    }
  }, [selectAll, comparacionData]);

  // =====================================================
  // LOADERS
  // =====================================================

  const loadBodegas = async (companiaId) => {
    try {
      const data = await inventarioGeneralService.obtenerBodegas(companiaId);
      setBodegas(data);
    } catch (error) {
      console.error('Error cargando bodegas:', error);
    }
  };

  const loadSiesaBodegas = async (cId) => {
    setSiesaBodegasOptions([]);
    try {
      const data = await getSiesaBodegas(cId);
      const options = data.map(b => {
        const id = String(b.f150_id || b.Id || b.id || b.Codigo || b.codigo || '').trim();
        const label = b.f150_descripcion || b.Descripcion || b.descripcion || b.Nombre || b.nombre || 'Sin Descripción';
        return { id, label: `${id} - ${label}` };
      }).filter(o => o.id !== '' && o.id !== 'undefined');

      const uniqueOptions = [];
      const seenIds = new Set();
      options.forEach(opt => {
        if (!seenIds.has(opt.id)) {
          seenIds.add(opt.id);
          uniqueOptions.push(opt);
        }
      });
      setSiesaBodegasOptions(uniqueOptions);
    } catch (e) {
      console.error('Error cargando bodegas Siesa', e);
    }
  };

  const cargarDatosStep2 = async () => {
    try {
      setLoading(true);
      const [reconteoData, resumenData] = await Promise.all([
        inventarioGeneralService.obtenerReconteosSiesa(selectedBodega, { lote_id: loteActivo || undefined }),
        inventarioGeneralService.obtenerResumenReconteoSiesa(selectedBodega)
      ]);
      setReconteos(reconteoData || []);
      if (resumenData) {
        setResumen(resumenData);
        setLotes(resumenData.lotes || []);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error('Error al cargar reconteos');
    } finally {
      setLoading(false);
    }
  };

  const cargarFinalizados = async () => {
    try {
      setLoading(true);
      const data = await inventarioGeneralService.obtenerReconteosSiesa(selectedBodega, { estado: 'finalizado' });
      setReconteosFinalzados(data || []);
    } catch (error) {
      console.error('Error cargando finalizados:', error);
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // STEP 1: GENERAR - Comparación SIESA
  // =====================================================

  const handleComparar = async () => {
    if (!selectedBodega) return Swal.fire('Error', 'Seleccione una bodega local', 'error');
    if (!selectedSiesaBodega) return Swal.fire('Error', 'Seleccione una bodega SIESA', 'error');

    setLoading(true);
    setComparacionData(null);
    setProgress('Iniciando comparación...');

    try {
      // 1. Obtener inventario físico (consolidado)
      setProgress('Obteniendo inventario físico...');
      const rawLocalData = await inventarioGeneralService.exportarBodega(selectedBodega);
      if (!rawLocalData || rawLocalData.length === 0) {
        throw new Error('No hay datos de inventario finalizado para esta bodega.');
      }

      // Agrupar por código
      const localMap = {};
      rawLocalData.forEach(item => {
        const codigo = String(item.item).trim();
        const cant = parseFloat(item.conteo_cantidad) || 0;
        if (!localMap[codigo]) {
          localMap[codigo] = { descripcion: item.descripcion || '', cantidad: 0 };
        }
        localMap[codigo].cantidad += cant;
        if (item.descripcion && item.descripcion.length > localMap[codigo].descripcion.length) {
          localMap[codigo].descripcion = item.descripcion;
        }
      });

      // 2. Obtener inventario SIESA
      const itemsToFetch = Object.keys(localMap);
      setProgress(`Consultando ${itemsToFetch.length} items en SIESA...`);

      const siesaData = await getSiesaStockBatch(
        itemsToFetch,
        (done, total) => setProgress(`Verificando item ${done} de ${total}...`),
        selectedCompany,
        selectedSiesaBodega
      );

      // 3. Cruzar y comparar
      setProgress('Cruzando información...');
      const getProp = (obj, keyPart) => {
        const key = Object.keys(obj).find(k => k.toLowerCase().includes(keyPart.toLowerCase()));
        return key ? obj[key] : undefined;
      };

      const siesaMap = {};
      siesaData.forEach(row => {
        const itemCode = String(row.f120_id || getProp(row, 'referencia') || getProp(row, 'id_item') || '').trim();
        const exist1 = parseFloat(row.f400_cant_existencia_1 || getProp(row, 'existencia') || 0);
        const pos1 = parseFloat(row.f400_cant_pos_1 || 0);
        const stock = exist1 - pos1;
        if (!itemCode) return;
        if (!siesaMap[itemCode]) siesaMap[itemCode] = { cantidad: 0, descripcion: row.f120_descripcion || '' };
        siesaMap[itemCode].cantidad += stock;
      });

      const report = [];
      let cMatch = 0, cDiff = 0, cMissingSiesa = 0;

      Object.keys(localMap).forEach(code => {
        const localInfo = localMap[code];
        const siesaInfo = siesaMap[code];
        const cantLocal = localInfo.cantidad;
        const cantSiesa = siesaInfo ? siesaInfo.cantidad : 0;
        const diff = cantLocal - cantSiesa;
        let estado = 'match';
        if (!siesaInfo) estado = 'missing_siesa';
        else if (diff !== 0) estado = 'diff';
        if (estado === 'match') cMatch++;
        if (estado === 'diff') cDiff++;
        if (estado === 'missing_siesa') cMissingSiesa++;

        report.push({
          codigo: code,
          descripcion: localInfo.descripcion || (siesaInfo?.descripcion || 'Sin Descripción'),
          conteo: cantLocal,
          siesa: cantSiesa,
          diff,
          estado
        });
      });

      setStats({ match: cMatch, diff: cDiff, missingSiesa: cMissingSiesa });
      setComparacionData(report);
      setSelectAll(true);
      toast.success(`Comparación completada: ${cDiff} diferencias encontradas`);
    } catch (error) {
      console.error(error);
      Swal.fire('Error', error.message, 'error');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const handleGenerarReconteos = async () => {
    const diffItems = comparacionData.filter(i => selectedItems.has(i.codigo) && i.estado === 'diff');
    if (diffItems.length === 0) {
      return Swal.fire('Aviso', 'No hay items con diferencia seleccionados', 'warning');
    }

    const bodegaNombre = bodegas.find(b => b.id === selectedBodega)?.nombre || '';

    const { isConfirmed } = await Swal.fire({
      title: 'Generar Reconteos',
      html: `Se generarán reconteos para <strong>${diffItems.length}</strong> items con diferencia.<br>El sistema localizará cada item en su ubicación exacta.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Generar',
      cancelButtonText: 'Cancelar'
    });

    if (!isConfirmed) return;

    try {
      setLoading(true);
      setProgress('Generando reconteos...');

      const result = await inventarioGeneralService.generarReconteosSiesa({
        companiaId: selectedCompany,
        bodegaId: selectedBodega,
        bodegaNombre,
        itemsDiferencia: diffItems
      });

      if (result.success) {
        Swal.fire({
          title: 'Reconteos Generados',
          html: `
            <p>${result.message}</p>
            <p><strong>Lote:</strong> ${result.data.lote_id}</p>
            <p><strong>Total registros:</strong> ${result.data.total_reconteos}</p>
            <p><strong>Ubicaciones:</strong> ${result.data.ubicaciones_afectadas}</p>
            ${result.data.items_sin_ubicacion?.length > 0 ? `<p style="color: #f59e0b;">⚠️ ${result.data.items_sin_ubicacion.length} items sin ubicación encontrada</p>` : ''}
          `,
          icon: 'success'
        });
        setCurrentStep(2);
        cargarDatosStep2();
      } else {
        Swal.fire('Error', result.message, 'error');
      }
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const toggleItemSelection = (codigo) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(codigo)) next.delete(codigo);
      else next.add(codigo);
      return next;
    });
  };

  const getFilteredComparacion = () => {
    if (!comparacionData) return [];
    let data = [...comparacionData];
    if (filterState !== 'all') {
      data = data.filter(item => item.estado === filterState);
    }
    if (filterText) {
      const lower = filterText.toLowerCase();
      data = data.filter(item =>
        String(item.codigo).toLowerCase().includes(lower) ||
        String(item.descripcion).toLowerCase().includes(lower)
      );
    }
    // Sort by absolute difference descending
    data.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    return data;
  };

  // =====================================================
  // STEP 2: ASIGNAR
  // =====================================================

  // Agrupar reconteos por zona > pasillo > ubicación
  const getReconteosAgrupados = useCallback(() => {
    let data = [...reconteos];
    if (filterEstado) {
      data = data.filter(r => r.estado === filterEstado);
    }

    const zonaMap = new Map();
    data.forEach(r => {
      const zKey = r.zona_id || 'sin_zona';
      if (!zonaMap.has(zKey)) {
        zonaMap.set(zKey, {
          zona_id: r.zona_id,
          zona_nombre: r.zona_nombre || 'Sin zona',
          pasillos: new Map()
        });
      }
      const zona = zonaMap.get(zKey);
      const pKey = r.pasillo_id || 'sin_pasillo';
      if (!zona.pasillos.has(pKey)) {
        zona.pasillos.set(pKey, {
          pasillo_id: r.pasillo_id,
          pasillo_nombre: r.pasillo_nombre || 'Sin pasillo',
          ubicaciones: new Map()
        });
      }
      const pasillo = zona.pasillos.get(pKey);
      const uKey = r.ubicacion_id || 'sin_ubicacion';
      if (!pasillo.ubicaciones.has(uKey)) {
        pasillo.ubicaciones.set(uKey, {
          ubicacion_id: r.ubicacion_id,
          ubicacion_nombre: r.ubicacion_nombre || 'Sin ubicación',
          items: [],
          estado: r.estado,
          asignado_a: r.asignado_a
        });
      }
      const ub = pasillo.ubicaciones.get(uKey);
      ub.items.push(r);
      // Update estado (worst-case)
      if (r.estado === 'pendiente') ub.estado = 'pendiente';
    });

    return zonaMap;
  }, [reconteos, filterEstado]);

  const handleAsignarUbicacion = async (ubicacionId) => {
    if (!asignacionEmail.trim()) {
      return toast.error('Ingrese el correo del empleado');
    }
    try {
      setLoading(true);
      const result = await inventarioGeneralService.asignarUbicacionReconteoSiesa(
        ubicacionId, asignacionEmail.trim(), loteActivo || undefined
      );
      if (result.success) {
        toast.success(result.message);
        cargarDatosStep2();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAsignarSeleccionadas = async () => {
    if (selectedUbicaciones.size === 0) return toast.error('Seleccione al menos una ubicación');
    if (!asignacionEmail.trim()) return toast.error('Ingrese el correo del empleado');

    const { isConfirmed } = await Swal.fire({
      title: 'Asignar Ubicaciones',
      html: `Se asignarán <strong>${selectedUbicaciones.size}</strong> ubicaciones a <strong>${asignacionEmail}</strong>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Asignar'
    });
    if (!isConfirmed) return;

    try {
      setLoading(true);
      let asignados = 0;
      for (const ubId of selectedUbicaciones) {
        try {
          await inventarioGeneralService.asignarUbicacionReconteoSiesa(
            ubId, asignacionEmail.trim(), loteActivo || undefined
          );
          asignados++;
        } catch (e) {
          console.error(`Error asignando ${ubId}:`, e);
        }
      }
      toast.success(`${asignados} ubicaciones asignadas`);
      setSelectedUbicaciones(new Set());
      cargarDatosStep2();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleZona = (zonaId) => {
    setExpandedZonas(prev => {
      const next = new Set(prev);
      if (next.has(zonaId)) next.delete(zonaId);
      else next.add(zonaId);
      return next;
    });
  };

  const toggleUbicacionSelection = (ubicacionId) => {
    setSelectedUbicaciones(prev => {
      const next = new Set(prev);
      if (next.has(ubicacionId)) next.delete(ubicacionId);
      else next.add(ubicacionId);
      return next;
    });
  };

  const handleEliminarLote = async (loteId) => {
    const { isConfirmed } = await Swal.fire({
      title: '¿Eliminar Lote?',
      html: `Se eliminarán TODOS los reconteos del lote <strong>${loteId}</strong>. Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      confirmButtonColor: '#ef4444'
    });
    if (!isConfirmed) return;

    try {
      setLoading(true);
      await inventarioGeneralService.eliminarLoteReconteoSiesa(loteId);
      toast.success('Lote eliminado');
      cargarDatosStep2();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // STEP 3: APROBAR / RECHAZAR
  // =====================================================

  const handleAprobar = async (reconteoIds) => {
    const { isConfirmed } = await Swal.fire({
      title: 'Aprobar Reconteos',
      html: `Se aprobarán <strong>${reconteoIds.length}</strong> reconteos y se re-consolidará el inventario.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Aprobar',
      confirmButtonColor: '#16a34a'
    });
    if (!isConfirmed) return;

    try {
      setLoading(true);
      setProgress('Aprobando y re-consolidando...');
      const result = await inventarioGeneralService.aprobarReconteosSiesa(reconteoIds);
      if (result.success) {
        Swal.fire('Aprobado', result.message, 'success');
        cargarFinalizados();
        if (selectedBodega) cargarDatosStep2();
      }
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const handleRechazar = async (reconteoIds) => {
    const { value: motivo } = await Swal.fire({
      title: 'Rechazar Reconteos',
      input: 'textarea',
      inputLabel: 'Motivo del rechazo',
      inputPlaceholder: 'Explique por qué se rechazan estos reconteos...',
      showCancelButton: true,
      confirmButtonText: 'Rechazar',
      confirmButtonColor: '#ef4444'
    });

    if (motivo === undefined) return; // Cancelled

    try {
      setLoading(true);
      const result = await inventarioGeneralService.rechazarReconteosSiesa(reconteoIds, motivo || '');
      if (result.success) {
        toast.success(result.message);
        cargarFinalizados();
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAprobarTodos = async () => {
    const ids = reconteosFinalzados.map(r => r.id);
    if (ids.length === 0) return toast.error('No hay reconteos finalizados para aprobar');
    await handleAprobar(ids);
  };

  // Agrupar finalizados por ubicación para la vista de aprobación
  const getFinalizadosAgrupados = () => {
    const ubicMap = new Map();
    reconteosFinalzados.forEach(r => {
      const key = r.ubicacion_id;
      if (!ubicMap.has(key)) {
        ubicMap.set(key, {
          ubicacion_id: r.ubicacion_id,
          ubicacion_nombre: r.ubicacion_nombre || 'Sin ubicación',
          pasillo_nombre: r.pasillo_nombre || '',
          zona_nombre: r.zona_nombre || '',
          bodega_nombre: r.bodega_nombre || '',
          asignado_a: r.asignado_a || '',
          items: []
        });
      }
      ubicMap.get(key).items.push(r);
    });
    return Array.from(ubicMap.values());
  };

  // =====================================================
  // RENDER: BADGE
  // =====================================================

  const renderBadge = (estado) => {
    const labels = {
      pendiente: '⏳ Pendiente',
      asignado: '👤 Asignado',
      en_progreso: '🔄 En Progreso',
      finalizado: '✅ Finalizado',
      aprobado: '✔ Aprobado',
      rechazado: '❌ Rechazado'
    };
    return <span className={`rsa-badge rsa-badge-${estado}`}>{labels[estado] || estado}</span>;
  };

  // =====================================================
  // RENDER: STEP 1
  // =====================================================

  const renderStep1 = () => (
    <div>
      <div className="rsa-panel">
        <div className="rsa-panel-header">
          <h3>🔍 Comparar Inventario Físico vs SIESA</h3>
        </div>

        <div className="rsa-controls">
          <div className="rsa-control-group">
            <label>Compañía *</label>
            <select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}>
              <option value="">-- Seleccionar --</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          <div className="rsa-control-group">
            <label>Bodega SIESA *</label>
            <select value={selectedSiesaBodega} onChange={e => setSelectedSiesaBodega(e.target.value)}>
              <option value="">-- Seleccionar --</option>
              {siesaBodegasOptions.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </div>

          <div className="rsa-control-group">
            <label>Bodega Local *</label>
            <select value={selectedBodega} onChange={e => setSelectedBodega(e.target.value)}>
              <option value="">-- Seleccionar --</option>
              {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
          </div>

          <div className="rsa-control-group">
            <label>Fecha Corte SIESA</label>
            <input
              type="text"
              value={fechaCorte}
              onChange={e => setFechaCorte(e.target.value)}
              placeholder="YYYYMMDD"
              maxLength={8}
            />
          </div>

          <div className="rsa-control-group" style={{ justifyContent: 'flex-end' }}>
            <button className="rsa-btn rsa-btn-primary" onClick={handleComparar} disabled={loading}>
              {loading ? '⏳ Comparando...' : '🔄 Ejecutar Comparación'}
            </button>
          </div>
        </div>

        {loading && progress && <div className="rsa-loading"><div className="rsa-spinner"></div><p>{progress}</p></div>}
      </div>

      {comparacionData && (
        <>
          {/* Stats */}
          <div className="rsa-summary">
            <div className={`rsa-stat-card success ${filterState === 'match' ? 'highlight' : ''}`}
              onClick={() => setFilterState(filterState === 'match' ? 'diff' : 'match')} style={{ cursor: 'pointer' }}>
              <div className="label">Coinciden</div>
              <div className="value">{stats.match}</div>
            </div>
            <div className={`rsa-stat-card danger ${filterState === 'diff' ? 'highlight' : ''}`}
              onClick={() => setFilterState(filterState === 'diff' ? 'all' : 'diff')} style={{ cursor: 'pointer' }}>
              <div className="label">Diferencias</div>
              <div className="value">{stats.diff}</div>
            </div>
            <div className={`rsa-stat-card warning ${filterState === 'missing_siesa' ? 'highlight' : ''}`}
              onClick={() => setFilterState(filterState === 'missing_siesa' ? 'all' : 'missing_siesa')} style={{ cursor: 'pointer' }}>
              <div className="label">Solo en Conteo</div>
              <div className="value">{stats.missingSiesa}</div>
            </div>
          </div>

          {/* Results table */}
          <div className="rsa-panel">
            <div className="rsa-panel-header">
              <h3>Resultados de Comparación ({getFilteredComparacion().length})</h3>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Buscar código o descripción..."
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                  style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                />
                {filterState === 'diff' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={selectAll} onChange={e => setSelectAll(e.target.checked)} className="rsa-checkbox" />
                    Seleccionar todos
                  </label>
                )}
              </div>
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="rsa-items-table">
                <thead>
                  <tr>
                    {filterState === 'diff' && <th style={{ width: '40px' }}></th>}
                    <th>Código</th>
                    <th>Descripción</th>
                    <th>Conteo Físico</th>
                    <th>Stock SIESA</th>
                    <th>Diferencia</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredComparacion().slice(0, 200).map((row, idx) => (
                    <tr key={idx}>
                      {filterState === 'diff' && (
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedItems.has(row.codigo)}
                            onChange={() => toggleItemSelection(row.codigo)}
                            className="rsa-checkbox"
                          />
                        </td>
                      )}
                      <td style={{ fontWeight: 600 }}>{row.codigo}</td>
                      <td>{row.descripcion}</td>
                      <td>{row.conteo}</td>
                      <td>{row.siesa}</td>
                      <td className={row.diff === 0 ? 'rsa-diff-zero' : row.diff > 0 ? 'rsa-diff-positive' : 'rsa-diff-negative'}>
                        {row.diff > 0 ? `+${row.diff}` : row.diff}
                      </td>
                      <td>
                        {row.estado === 'match' && <span className="rsa-badge rsa-badge-aprobado">OK</span>}
                        {row.estado === 'diff' && <span className="rsa-badge rsa-badge-pendiente">Diferencia</span>}
                        {row.estado === 'missing_siesa' && <span className="rsa-badge rsa-badge-rechazado">No en SIESA</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {getFilteredComparacion().length > 200 && (
                <div style={{ textAlign: 'center', padding: '10px', color: '#94a3b8' }}>
                  Mostrando 200 de {getFilteredComparacion().length} registros
                </div>
              )}
            </div>

            {filterState === 'diff' && selectedItems.size > 0 && (
              <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center' }}>
                <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{selectedItems.size} items seleccionados</span>
                <button className="rsa-btn rsa-btn-success" onClick={handleGenerarReconteos} disabled={loading}>
                  📋 Generar Reconteos
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  // =====================================================
  // RENDER: STEP 2
  // =====================================================

  const renderStep2 = () => {
    if (!selectedBodega) {
      return (
        <div className="rsa-panel">
          <div className="rsa-empty-state">
            <div className="icon">📦</div>
            <h3>Seleccione una bodega primero</h3>
            <p>Vuelva al Paso 1 para seleccionar compañía y bodega, o seleccione abajo:</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '16px', flexWrap: 'wrap' }}>
              <select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
                <option value="">Compañía</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <select value={selectedBodega} onChange={e => setSelectedBodega(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db' }}>
                <option value="">Bodega</option>
                {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>
            </div>
          </div>
        </div>
      );
    }

    const agrupados = getReconteosAgrupados();

    return (
      <div>
        {/* Resumen */}
        {resumen && (
          <div className="rsa-summary">
            <div className="rsa-stat-card">
              <div className="label">Total Reconteos</div>
              <div className="value">{resumen.total || 0}</div>
            </div>
            <div className="rsa-stat-card warning">
              <div className="label">Pendientes</div>
              <div className="value">{resumen.pendientes || 0}</div>
            </div>
            <div className="rsa-stat-card highlight">
              <div className="label">Asignados</div>
              <div className="value">{resumen.asignados || 0}</div>
            </div>
            <div className="rsa-stat-card">
              <div className="label">En Progreso</div>
              <div className="value">{resumen.en_progreso || 0}</div>
            </div>
            <div className="rsa-stat-card success">
              <div className="label">Finalizados</div>
              <div className="value">{resumen.finalizados || 0}</div>
            </div>
            <div className="rsa-stat-card success">
              <div className="label">Aprobados</div>
              <div className="value">{resumen.aprobados || 0}</div>
            </div>
          </div>
        )}

        {/* Filtros y asignación */}
        <div className="rsa-panel" style={{ marginBottom: '16px' }}>
          <div className="rsa-panel-header">
            <h3>🏗️ Asignar Reconteos por Ubicación</h3>
            <button className="rsa-btn rsa-btn-outline rsa-btn-sm" onClick={cargarDatosStep2} disabled={loading}>
              🔄 Refrescar
            </button>
          </div>

          <div className="rsa-filter-bar">
            <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="asignado">Asignados</option>
              <option value="en_progreso">En Progreso</option>
              <option value="finalizado">Finalizados</option>
            </select>

            {lotes.length > 0 && (
              <select value={loteActivo} onChange={e => { setLoteActivo(e.target.value); }}>
                <option value="">Todos los lotes</option>
                {lotes.map(l => (
                  <option key={l.lote_id} value={l.lote_id}>{l.lote_id} ({l.total})</option>
                ))}
              </select>
            )}
          </div>

          {/* Asignación masiva */}
          <div className="rsa-assign-row">
            <input
              type="email"
              placeholder="Correo del empleado para asignar..."
              value={asignacionEmail}
              onChange={e => setAsignacionEmail(e.target.value)}
            />
            <button
              className="rsa-btn rsa-btn-primary rsa-btn-sm"
              onClick={handleAsignarSeleccionadas}
              disabled={loading || selectedUbicaciones.size === 0}
            >
              Asignar {selectedUbicaciones.size > 0 ? `(${selectedUbicaciones.size})` : ''} seleccionadas
            </button>
          </div>
        </div>

        {/* Lotes management */}
        {lotes.length > 0 && (
          <div className="rsa-panel" style={{ marginBottom: '16px' }}>
            <div className="rsa-panel-header">
              <h3>📦 Lotes Generados</h3>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {lotes.map(l => (
                <div key={l.lote_id} style={{
                  padding: '10px 16px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: loteActivo === l.lote_id ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer'
                }} onClick={() => setLoteActivo(loteActivo === l.lote_id ? '' : l.lote_id)}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{l.lote_id}</span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{l.total} items</span>
                  <button
                    className="rsa-btn rsa-btn-danger rsa-btn-sm"
                    onClick={(e) => { e.stopPropagation(); handleEliminarLote(l.lote_id); }}
                    style={{ padding: '2px 8px', fontSize: '0.7rem' }}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empleados asignados */}
        {resumen?.empleados_asignados?.length > 0 && (
          <div className="rsa-panel" style={{ marginBottom: '16px' }}>
            <div className="rsa-panel-header">
              <h3>👥 Empleados Asignados</h3>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {resumen.empleados_asignados.map((emp, idx) => (
                <div key={idx} style={{
                  padding: '8px 14px',
                  background: '#eff6ff',
                  borderRadius: '8px',
                  border: '1px solid #bfdbfe',
                  fontSize: '0.85rem'
                }}>
                  <strong>{emp.asignado_a}</strong>
                  <span style={{ marginLeft: '8px', color: '#3b82f6' }}>{emp.total} items</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Zonas con ubicaciones */}
        {loading ? (
          <div className="rsa-loading"><div className="rsa-spinner"></div><p>Cargando reconteos...</p></div>
        ) : agrupados.size === 0 ? (
          <div className="rsa-panel">
            <div className="rsa-empty-state">
              <div className="icon">📋</div>
              <h3>No hay reconteos generados</h3>
              <p>Vuelva al Paso 1 para comparar con SIESA y generar reconteos.</p>
            </div>
          </div>
        ) : (
          Array.from(agrupados.values()).map(zona => (
            <div className="rsa-zona-section" key={zona.zona_id}>
              <div className="rsa-zona-header" onClick={() => toggleZona(zona.zona_id)}>
                <h4>📍 {zona.zona_nombre}</h4>
                <span>{expandedZonas.has(zona.zona_id) ? '▼' : '▶'}</span>
              </div>

              {expandedZonas.has(zona.zona_id) && (
                <div className="rsa-zona-body">
                  {Array.from(zona.pasillos.values()).map(pasillo => (
                    <div key={pasillo.pasillo_id} style={{ marginBottom: '8px' }}>
                      <div style={{ padding: '6px 10px', background: '#f1f5f9', borderRadius: '6px', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                        🚶 {pasillo.pasillo_nombre}
                      </div>
                      {Array.from(pasillo.ubicaciones.values()).map(ub => (
                        <div className="rsa-ubicacion-card" key={ub.ubicacion_id}>
                          <div className="rsa-ubicacion-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <input
                                type="checkbox"
                                checked={selectedUbicaciones.has(ub.ubicacion_id)}
                                onChange={() => toggleUbicacionSelection(ub.ubicacion_id)}
                                className="rsa-checkbox"
                                disabled={ub.estado !== 'pendiente'}
                              />
                              <span className="rsa-ubicacion-path">
                                {zona.zona_nombre} <span>/</span> {pasillo.pasillo_nombre} <span>/</span> {ub.ubicacion_nombre}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {renderBadge(ub.estado)}
                              {ub.asignado_a && <span style={{ fontSize: '0.8rem', color: '#64748b' }}>👤 {ub.asignado_a}</span>}
                              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{ub.items.length} items</span>
                              {ub.estado === 'pendiente' && (
                                <button
                                  className="rsa-btn rsa-btn-primary rsa-btn-sm"
                                  onClick={() => handleAsignarUbicacion(ub.ubicacion_id)}
                                  disabled={loading || !asignacionEmail.trim()}
                                  title="Asignar esta ubicación"
                                >
                                  👤 Asignar
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Items table */}
                          <table className="rsa-items-table">
                            <thead>
                              <tr>
                                <th>Código</th>
                                <th>Descripción</th>
                                <th>Físico</th>
                                <th>SIESA</th>
                                <th>Diff</th>
                                <th>Reconteo</th>
                                <th>Estado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ub.items.map(item => (
                                <tr key={item.id}>
                                  <td style={{ fontWeight: 600 }}>{item.item_codigo}</td>
                                  <td>{item.item_descripcion}</td>
                                  <td>{item.cantidad_fisica}</td>
                                  <td>{item.cantidad_siesa}</td>
                                  <td className={item.diferencia === 0 ? 'rsa-diff-zero' : item.diferencia > 0 ? 'rsa-diff-positive' : 'rsa-diff-negative'}>
                                    {item.diferencia > 0 ? `+${item.diferencia}` : item.diferencia}
                                  </td>
                                  <td style={{ fontWeight: 700 }}>
                                    {item.cantidad_reconteo !== null && item.cantidad_reconteo !== undefined ? item.cantidad_reconteo : '-'}
                                  </td>
                                  <td>{renderBadge(item.estado)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    );
  };

  // =====================================================
  // RENDER: STEP 3
  // =====================================================

  const renderStep3 = () => {
    if (!selectedBodega) {
      return (
        <div className="rsa-panel">
          <div className="rsa-empty-state">
            <div className="icon">📦</div>
            <h3>Seleccione una bodega para ver reconteos finalizados</h3>
          </div>
        </div>
      );
    }

    const agrupados = getFinalizadosAgrupados();

    return (
      <div>
        <div className="rsa-panel">
          <div className="rsa-panel-header">
            <h3>✅ Aprobar / Rechazar Reconteos Finalizados</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="rsa-btn rsa-btn-outline rsa-btn-sm" onClick={cargarFinalizados} disabled={loading}>
                🔄 Refrescar
              </button>
              {reconteosFinalzados.length > 0 && (
                <button className="rsa-btn rsa-btn-success rsa-btn-sm" onClick={handleAprobarTodos} disabled={loading}>
                  ✅ Aprobar Todos ({reconteosFinalzados.length})
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="rsa-loading"><div className="rsa-spinner"></div><p>Cargando...</p></div>
          ) : agrupados.length === 0 ? (
            <div className="rsa-empty-state">
              <div className="icon">⏳</div>
              <h3>No hay reconteos finalizados pendientes de aprobación</h3>
              <p>Los empleados deben completar sus reconteos primero.</p>
            </div>
          ) : (
            agrupados.map(ub => (
              <div className="rsa-approval-card" key={ub.ubicacion_id}>
                <div className="rsa-approval-header">
                  <div>
                    <span className="rsa-ubicacion-path">
                      {ub.zona_nombre} <span>/ </span>{ub.pasillo_nombre} <span>/ </span>{ub.ubicacion_nombre}
                    </span>
                    {ub.asignado_a && <span style={{ marginLeft: '12px', fontSize: '0.8rem', color: '#64748b' }}>👤 {ub.asignado_a}</span>}
                  </div>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{ub.items.length} items</span>
                </div>

                <table className="rsa-items-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Descripción</th>
                      <th>Anterior</th>
                      <th>SIESA</th>
                      <th>Diff Original</th>
                      <th>Reconteo</th>
                      <th>Nueva Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ub.items.map(item => {
                      const newDiff = (item.cantidad_reconteo || 0) - (item.cantidad_siesa || 0);
                      return (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 600 }}>{item.item_codigo}</td>
                          <td>{item.item_descripcion}</td>
                          <td>{item.cantidad_fisica}</td>
                          <td>{item.cantidad_siesa}</td>
                          <td className={item.diferencia > 0 ? 'rsa-diff-positive' : 'rsa-diff-negative'}>
                            {item.diferencia > 0 ? `+${item.diferencia}` : item.diferencia}
                          </td>
                          <td style={{ fontWeight: 700, color: '#2563eb' }}>
                            {item.cantidad_reconteo ?? '-'}
                          </td>
                          <td className={newDiff === 0 ? 'rsa-diff-zero' : newDiff > 0 ? 'rsa-diff-positive' : 'rsa-diff-negative'}>
                            {newDiff > 0 ? `+${newDiff}` : newDiff}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="rsa-approval-actions">
                  <button
                    className="rsa-btn rsa-btn-danger rsa-btn-sm"
                    onClick={() => handleRechazar(ub.items.map(i => i.id))}
                    disabled={loading}
                  >
                    ❌ Rechazar
                  </button>
                  <button
                    className="rsa-btn rsa-btn-success rsa-btn-sm"
                    onClick={() => handleAprobar(ub.items.map(i => i.id))}
                    disabled={loading}
                  >
                    ✅ Aprobar y Re-consolidar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  // =====================================================
  // MAIN RENDER
  // =====================================================

  return (
    <div className="rsa-container">
      {/* Stepper */}
      <div className="rsa-stepper">
        {STEPS.map((step, idx) => (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center' }}>
            <button
              className={`rsa-step ${currentStep === step.id ? 'active' : ''} ${currentStep > step.id ? 'completed' : ''}`}
              onClick={() => setCurrentStep(step.id)}
            >
              <span className="rsa-step-number">
                {currentStep > step.id ? '✓' : step.id}
              </span>
              {step.label}
            </button>
            {idx < STEPS.length - 1 && (
              <div className={`rsa-step-connector ${currentStep > step.id ? 'active' : ''}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {currentStep === 3 && renderStep3()}

      {loading && progress && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px',
          background: '#1e293b', color: 'white', padding: '12px 20px',
          borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          zIndex: 1000, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <div className="rsa-spinner" style={{ width: '20px', height: '20px', borderWidth: '3px' }}></div>
          {progress}
        </div>
      )}
    </div>
  );
};

export default ReconteoSiesaAdmin;
