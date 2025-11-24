import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import './HistorialConteos.css';
import { inventarioService } from '../../services/inventarioService';
import { supabase } from '../../supabaseClient';
import Swal from 'sweetalert2';
import DashboardInventarioGeneral from './DashboardInventarioGeneral';

const HistorialConteos = () => {
  const [selectedCompany, setSelectedCompany] = useState('');
  const [conteos, setConteos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Nuevo estado para la vista de panel
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'dashboard'
  const [selectedBodega, setSelectedBodega] = useState(null);
  const [filtros, setFiltros] = useState({
    zona: '',
    pasillo: '',
  });
  
  // Estado para comparación
  const [comparisonData, setComparisonData] = useState(null);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [finalSelection, setFinalSelection] = useState({}); // { [itemCode]: 'c1' | 'c2' | 'c3' | 'manual' }
  const [manualValues, setManualValues] = useState({}); // { [itemCode]: number }
  
  // Estado para detalle individual
  const [singleDetail, setSingleDetail] = useState(null);

  // Efecto para actualizar el detalle en tiempo real si está abierto y en progreso
  useEffect(() => {
    let interval;
    if (singleDetail && singleDetail.conteo.estado === 'en_progreso') {
      interval = setInterval(() => {
        refreshDetail(singleDetail.conteo.id);
      }, 30000);
    }
    return () => clearInterval(interval);
  }, [singleDetail]);

  // Efecto para sincronizar el estado del conteo en el modal con la lista principal
  useEffect(() => {
    if (singleDetail) {
      const updatedConteo = conteos.find(c => c.id === singleDetail.conteo.id);
      if (updatedConteo && updatedConteo.estado !== singleDetail.conteo.estado) {
        setSingleDetail(prev => ({ ...prev, conteo: updatedConteo }));
      }
      // También actualizar si cambia el total de items para reflejarlo si es necesario
      if (updatedConteo && updatedConteo.total_items !== singleDetail.conteo.total_items) {
         setSingleDetail(prev => ({ ...prev, conteo: updatedConteo }));
      }
    }
  }, [conteos]);

  const refreshDetail = async (conteoId) => {
    try {
      const items = await inventarioService.obtenerDetalleConteo(conteoId);
      setSingleDetail(prev => prev ? { ...prev, items } : null);
    } catch (error) {
      console.error('Error refreshing detail:', error);
    }
  };

  const companies = [
    { id: '1', nombre: 'Merkahorro' },
    { id: '2', nombre: 'Megamayorista' },
    { id: '3', nombre: 'Construahorro' },
  ];

  // Estado para jerarquía y cierre
  const [hierarchyStatus, setHierarchyStatus] = useState(null); // { zonas: {}, pasillos: {} }

  useEffect(() => {
    let interval;
    if (selectedCompany) {
      cargarHistorial(true);
      setSelectedBodega(null); // Reset bodega selection on company change
      setViewMode('list'); // Reset view mode
      
      // Polling para actualización en tiempo real (cada 60 segundos)
      interval = setInterval(() => {
        cargarHistorial(false);
      }, 60000);
    }
    return () => clearInterval(interval);
  }, [selectedCompany]);

  // Cargar estado de jerarquía cuando cambia la bodega
  useEffect(() => {
    if (selectedBodega && selectedCompany) {
      cargarEstadoJerarquia();
    }
  }, [selectedBodega, selectedCompany]);

  const cargarEstadoJerarquia = async () => {
    try {
      const status = await inventarioService.obtenerEstadoJerarquia(selectedBodega, selectedCompany);
      if (status) {
        setHierarchyStatus(status);
      } else {
        // Fallback si no hay backend: inicializar todo como abierto
        setHierarchyStatus({ zonas: {}, pasillos: {}, bodega: 'abierto' });
      }
    } catch (error) {
      console.error("Error cargando jerarquía", error);
      setHierarchyStatus({ zonas: {}, pasillos: {}, bodega: 'abierto' });
    }
  };

  const handleCerrarPasillo = async (pasilloId) => {
    if (!window.confirm(`¿Seguro que desea cerrar este Pasillo?`)) return;
    try {
      await inventarioService.cerrarPasillo(pasilloId, selectedCompany);
      // Actualizar estado local optimista o recargar
      cargarEstadoJerarquia();
      alert('Pasillo cerrado correctamente');
    } catch (error) {
      alert('Error al cerrar pasillo: ' + error.message);
    }
  };

  const handleCerrarZona = async (zonaId) => {
    if (!window.confirm(`¿Seguro que desea cerrar esta Zona?`)) return;
    try {
      await inventarioService.cerrarZona(zonaId, selectedCompany);
      cargarEstadoJerarquia();
      alert('Zona cerrada correctamente');
    } catch (error) {
      alert('Error al cerrar zona: ' + error.message);
    }
  };

  const handleCerrarBodega = async (bodegaId) => {
    if (!window.confirm(`¿Seguro que desea cerrar la Bodega?`)) return;
    try {
      await inventarioService.cerrarBodega(bodegaId, selectedCompany);
      cargarEstadoJerarquia();
      alert('Bodega cerrada correctamente');
    } catch (error) {
      alert('Error al cerrar bodega: ' + error.message);
    }
  };

  const cargarHistorial = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      // Fetch ALL counts for the company to enable comparison
      const data = await inventarioService.obtenerHistorialConteos(selectedCompany, {});
      setConteos(data);
    } catch (error) {
      console.error('Error al cargar historial:', error);
      if (showLoading) setMessage({ type: 'error', text: 'Error al cargar el historial de conteos' });
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Extraer bodegas únicas
  const bodegas = [...new Set(conteos.map(c => c.bodega))].sort();

  // Agrupar conteos por Jerarquía: Zona -> Pasillo -> Ubicaciones
  const getHierarchicalLocations = () => {
    if (!selectedBodega) return [];

    // Si tenemos la estructura completa desde el backend, la usamos como base
    let zonasMap = {};

    if (hierarchyStatus?.estructura) {
      hierarchyStatus.estructura.forEach(zona => {
        zonasMap[zona.nombre] = {
          nombre: zona.nombre,
          id: zona.id,
          pasillos: {}
        };
        
        zona.pasillos.forEach(pasillo => {
          zonasMap[zona.nombre].pasillos[pasillo.numero] = {
            numero: pasillo.numero,
            id: pasillo.id,
            ubicaciones: []
          };
        });
      });
    }

    const filtered = conteos.filter(c => 
      c.bodega === selectedBodega &&
      (!filtros.zona || c.zona.toLowerCase().includes(filtros.zona.toLowerCase())) &&
      (!filtros.pasillo || c.pasillo.toLowerCase().includes(filtros.pasillo.toLowerCase()))
    );

    filtered.forEach(c => {
      // Si la zona no existe en el mapa (porque no vino en estructura o es nueva), la creamos
      if (!zonasMap[c.zona]) {
        zonasMap[c.zona] = {
          nombre: c.zona,
          id: c.zona_id, 
          pasillos: {}
        };
      }
      
      // Si el pasillo no existe, lo creamos
      if (!zonasMap[c.zona].pasillos[c.pasillo]) {
        zonasMap[c.zona].pasillos[c.pasillo] = {
          numero: c.pasillo,
          id: c.pasillo_id,
          ubicaciones: []
        };
      }

      // 3. Agrupar Ubicaciones (lógica existente de c1, c2, diff)
      let locEntry = zonasMap[c.zona].pasillos[c.pasillo].ubicaciones.find(u => u.ubicacion === c.ubicacion);
      
      if (!locEntry) {
        locEntry = {
          key: `${c.zona}-${c.pasillo}-${c.ubicacion}`,
          zona: c.zona,
          pasillo: c.pasillo,
          ubicacion: c.ubicacion,
          c1: null, c2: null, diff: null
        };
        zonasMap[c.zona].pasillos[c.pasillo].ubicaciones.push(locEntry);
      }

      if (c.tipo_conteo === 1) locEntry.c1 = c;
      if (c.tipo_conteo === 2) locEntry.c2 = c;
      if (c.tipo_conteo === 3) locEntry.diff = c;
      if (c.tipo_conteo === 4) locEntry.final = c;
    });

    // Filtrar zonas y pasillos vacíos si hay filtros activos
    let result = Object.values(zonasMap);
    
    if (filtros.zona) {
      result = result.filter(z => z.nombre.toLowerCase().includes(filtros.zona.toLowerCase()));
    }

    return result.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(zona => {
      let pasillos = Object.values(zona.pasillos);
      
      if (filtros.pasillo) {
        pasillos = pasillos.filter(p => p.numero.toLowerCase().includes(filtros.pasillo.toLowerCase()));
      }

      zona.pasillos = pasillos.sort((a, b) => a.numero.localeCompare(b.numero)).map(pasillo => {
        pasillo.ubicaciones.sort((a, b) => a.ubicacion.localeCompare(b.ubicacion));
        return pasillo;
      });
      return zona;
    });
  };

  // Calcular estadísticas para el dashboard
  const getDashboardStats = () => {
    if (!hierarchyStatus?.estructura) return null;
    
    let totalZonas = 0;
    let zonasCerradas = 0;
    let totalPasillos = 0;
    let pasillosCerrados = 0;

    hierarchyStatus.estructura.forEach(z => {
      totalZonas++;
      if (z.estado === 'cerrado') zonasCerradas++;
      
      z.pasillos.forEach(p => {
        totalPasillos++;
        if (p.estado === 'cerrado') pasillosCerrados++;
      });
    });

    return { totalZonas, zonasCerradas, totalPasillos, pasillosCerrados };
  };

  const handleCompare = async (locationGroup) => {
    try {
      setLoadingComparison(true);
      const c1Id = locationGroup.c1?.id;
      const c2Id = locationGroup.c2?.id;
      const c3Id = locationGroup.diff?.id; // ID del Reconteo (Conteo 3)
      const c4Id = locationGroup.final?.id; // ID del Ajuste Final (Conteo 4)

      const [itemsC1, itemsC2, itemsC3, itemsC4] = await Promise.all([
        c1Id ? inventarioService.obtenerDetalleConteo(c1Id) : Promise.resolve([]),
        c2Id ? inventarioService.obtenerDetalleConteo(c2Id) : Promise.resolve([]),
        c3Id ? inventarioService.obtenerDetalleConteo(c3Id) : Promise.resolve([]),
        c4Id ? inventarioService.obtenerDetalleConteo(c4Id) : Promise.resolve([])
      ]);

      // Merge items by item_codigo
      const itemMap = {};
      const normalize = (val) => String(val).trim();
      
      const processItem = (item, type) => {
        const key = normalize(item.item_codigo);
        if (!itemMap[key]) {
          itemMap[key] = {
            id: item.item_id, // Guardar ID real del item
            codigo: item.item_codigo,
            descripcion: item.descripcion,
            barra: item.codigo_barra,
            c1: 0,
            c2: 0,
            c3: 0, // Inicializar reconteo
            c4: 0  // Inicializar ajuste final
          };
        }
        itemMap[key][type] += Number(item.cantidad) || 0;
      };

      itemsC1.forEach(item => processItem(item, 'c1'));
      itemsC2.forEach(item => processItem(item, 'c2'));
      itemsC3.forEach(item => processItem(item, 'c3'));
      itemsC4.forEach(item => processItem(item, 'c4'));

      // Inicializar selecciones automáticas
      const initialSelection = {};
      const initialManualValues = {};

      Object.values(itemMap).forEach(item => {
        // Si ya existe un ajuste final (C4), le damos prioridad absoluta para mostrarlo
        if (c4Id) {
          initialSelection[item.codigo] = 'manual';
          initialManualValues[item.codigo] = item.c4;
        } else {
          // Lógica normal si no hay ajuste final guardado
          const diff = item.c1 - item.c2;
          if (diff === 0) {
            initialSelection[item.codigo] = 'c1'; // Si coinciden, seleccionar C1 por defecto
          } else if (item.c3 > 0) {
            initialSelection[item.codigo] = 'c3'; // Si hay diferencia y existe reconteo, sugerir reconteo
          }
        }
      });

      setFinalSelection(initialSelection);
      setManualValues(initialManualValues);
      setComparisonData({
        location: locationGroup,
        items: Object.values(itemMap)
      });

    } catch (error) {
      setMessage({ type: 'error', text: 'Error al cargar comparativa: ' + error.message });
    } finally {
      setLoadingComparison(false);
    }
  };

  const handleVerDetalleConteo = async (conteo, numeroConteo) => {
    if (!conteo) return;
    try {
      setLoading(true);
      const items = await inventarioService.obtenerDetalleConteo(conteo.id);
      setSingleDetail({
        conteo: conteo,
        numero: numeroConteo,
        items: items
      });
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al cargar detalle: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const closeComparison = () => {
    setComparisonData(null);
    setFinalSelection({});
    setManualValues({});
  };
  const closeSingleDetail = () => setSingleDetail(null);

  const handleGuardarAjuste = async () => {
    if (!comparisonData || !comparisonData.items) return;

    // Validar que todos los items con diferencias tengan una selección
    const itemsToSave = [];
    let missingSelection = false;

    for (const item of comparisonData.items) {
      const diff = item.c1 - item.c2;
      let finalQty = 0;
      
      if (diff === 0) {
        finalQty = item.c1; // Si no hay diferencia, tomamos C1 (que es igual a C2)
      } else {
        const selection = finalSelection[item.codigo];
        if (!selection) {
          missingSelection = true;
          break;
        }
        
        if (selection === 'c1') finalQty = item.c1;
        else if (selection === 'c2') finalQty = item.c2;
        else if (selection === 'c3') finalQty = item.c3;
        else if (selection === 'manual') finalQty = Number(manualValues[item.codigo]);
      }

      itemsToSave.push({
        itemId: item.id, // Enviar ID real para evitar errores de búsqueda
        codigo: item.barra || item.codigo, 
        cantidad: finalQty,
        companiaId: selectedCompany 
      });
    }

    if (missingSelection) {
      Swal.fire({
        title: 'Atención',
        text: 'Por favor, resuelva todas las diferencias seleccionando una opción o ingresando un valor manual.',
        icon: 'warning',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    const result = await Swal.fire({
      title: '¿Guardar Ajuste Final?',
      text: "Esto creará un registro definitivo para esta ubicación y no se podrá deshacer.",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#27ae60',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, guardar ajuste',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      setLoadingComparison(true);
      
      // Obtener ID de ubicación de alguno de los conteos base
      const ubicacionId = comparisonData.location.c1?.ubicacion_id || comparisonData.location.c2?.ubicacion_id;
      
      if (!ubicacionId) {
        throw new Error('No se pudo identificar el ID de la ubicación');
      }

      // Obtener usuario actual de Supabase
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || !user.id) {
        throw new Error('No se ha identificado el usuario actual. Por favor inicie sesión nuevamente.');
      }

      await inventarioService.guardarAjusteFinal({
        ubicacionId,
        usuarioId: user.id,
        usuarioEmail: user.email || 'admin@sistema.com',
        items: itemsToSave
      });

      Swal.fire({
        title: '¡Guardado!',
        text: 'Ajuste final guardado exitosamente.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
      
      closeComparison();
      cargarHistorial(false); // Recargar para ver si hay cambios (aunque el ajuste es un nuevo registro)

    } catch (error) {
      Swal.fire({
        title: 'Error',
        text: 'Error al guardar ajuste: ' + error.message,
        icon: 'error',
        confirmButtonText: 'Cerrar'
      });
    } finally {
      setLoadingComparison(false);
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'finalizado': return '#2ecc71';
      case 'en_progreso': return '#f1c40f';
      case 'aprobado': return '#3498db';
      case 'rechazado': return '#e74c3c';
      default: return '#95a5a6';
    }
  };

  const getLocationStatus = (loc) => {
    if (loc.c1?.estado === 'finalizado' && loc.c2?.estado === 'finalizado') {
      return { label: 'FINALIZADO', class: 'hc-status-finished' };
    }
    return { label: '', class: '' };
  };

  const stats = getDashboardStats();

  return (
    <div className="hc-layout">
      {/* Sidebar */}
      <div className="hc-sidebar">
        <div className="hc-sidebar-header">
          <h3>🏢 Bodegas</h3>
          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="hc-company-select"
          >
            <option value="">Seleccionar Compañía</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
        
        <div className="hc-bodega-list">
          {loading ? (
            <div className="hc-loading-text">Cargando...</div>
          ) : bodegas.length > 0 ? (
            bodegas.map(bodega => (
              <div 
                key={bodega}
                className={`hc-bodega-item ${selectedBodega === bodega ? 'active' : ''}`}
                onClick={() => setSelectedBodega(bodega)}
              >
                <span>📦</span> {bodega}
              </div>
            ))
          ) : (
            <div className="hc-empty-text">Sin datos</div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="hc-main">
        {message.text && (
          <div className={`hc-admin-message ${message.type}`} style={{margin: '1rem 2rem'}}>
            {message.text}
            <button onClick={() => setMessage({type:'', text:''})} style={{float:'right', background:'none', border:'none', cursor:'pointer'}}>×</button>
          </div>
        )}

        {!selectedBodega ? (
          <div className="hc-empty-state-main">
            <div className="hc-icon-box">📊</div>
            <h2>Panel de Control de Inventario</h2>
            <p>Selecciona una bodega del menú lateral para gestionar el cierre y ver el progreso.</p>
          </div>
        ) : (
          <>
            <div className="hc-main-header">
              <div className="hc-header-title">
                <h2>{selectedBodega}</h2>
                <p className="hc-subtitle">Gestión integral de inventario y cierres</p>
              </div>
              
              <div className="hc-header-actions">
                 <div className="hc-filters-row">
                  {viewMode === 'list' && (
                    <>
                      <input 
                        type="text" 
                        placeholder="🔍 Buscar Zona..." 
                        value={filtros.zona}
                        onChange={e => setFiltros({...filtros, zona: e.target.value})}
                      />
                      <input 
                        type="text" 
                        placeholder="🔍 Buscar Pasillo..." 
                        value={filtros.pasillo}
                        onChange={e => setFiltros({...filtros, pasillo: e.target.value})}
                      />
                    </>
                  )}
                </div>

                <button 
                  className={`hc-btn-toggle-view ${viewMode === 'dashboard' ? 'active' : ''}`}
                  onClick={() => setViewMode(viewMode === 'list' ? 'dashboard' : 'list')}
                  title={viewMode === 'list' ? "Ver Dashboard" : "Ver Lista"}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    background: viewMode === 'dashboard' ? '#e2e8f0' : 'white',
                    cursor: 'pointer',
                    marginRight: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  {viewMode === 'list' ? '📊 Dashboard' : '📋 Lista'}
                </button>

                <button 
                  onClick={() => cargarHistorial(true)} 
                  className="hc-btn-refresh" 
                  title="Actualizar datos"
                >
                  ↻
                </button>

                 <button 
                  className={`hc-btn-close-level bodega ${hierarchyStatus?.bodega === 'cerrado' ? 'closed' : ''}`}
                  onClick={() => {
                    const bodegaId = conteos.find(c => c.bodega === selectedBodega)?.bodega_id || hierarchyStatus?.bodegaId;
                    if (bodegaId) handleCerrarBodega(bodegaId);
                  }}
                  disabled={hierarchyStatus?.bodega === 'cerrado' || !hierarchyStatus}
                  title="Cerrar Bodega completa"
                >
                  {hierarchyStatus?.bodega === 'cerrado' ? '🔒 Bodega Cerrada' : '🔒 Cerrar Bodega'}
                </button>
              </div>
            </div>

            {viewMode === 'dashboard' ? (
              <DashboardInventarioGeneral 
                conteos={conteos.filter(c => c.bodega === selectedBodega)} 
                hierarchyStatus={hierarchyStatus}
              />
            ) : (
              <>
                {/* Dashboard Summary */}
                {stats && (
                  <div className="hc-dashboard-summary">
                    <div className="hc-stat-card">
                      <span className="hc-stat-label">Progreso Zonas</span>
                      <span className="hc-stat-value" style={{color: 'var(--hc-primary)'}}>
                        {stats.zonasCerradas} <span style={{fontSize:'1rem', color:'var(--hc-text-muted)'}}>/ {stats.totalZonas}</span>
                      </span>
                    </div>
                    <div className="hc-stat-card">
                      <span className="hc-stat-label">Progreso Pasillos</span>
                      <span className="hc-stat-value" style={{color: 'var(--hc-info)'}}>
                        {stats.pasillosCerrados} <span style={{fontSize:'1rem', color:'var(--hc-text-muted)'}}>/ {stats.totalPasillos}</span>
                      </span>
                    </div>
                    <div className="hc-stat-card">
                      <span className="hc-stat-label">Estado General</span>
                      <span className="hc-stat-value" style={{color: hierarchyStatus?.bodega === 'cerrado' ? 'var(--hc-danger)' : 'var(--hc-success)'}}>
                        {hierarchyStatus?.bodega === 'cerrado' ? 'CERRADO' : 'ABIERTO'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="hc-hierarchy-container">
                  {getHierarchicalLocations().map(zona => {
                    const isZonaClosed = hierarchyStatus?.zonas?.[zona.id] === 'cerrado';
                    const allPasillosClosed = zona.pasillos.every(p => hierarchyStatus?.pasillos?.[p.id] === 'cerrado');

                    return (
                      <div key={zona.nombre} className="hc-zona-section">
                        <div className="hc-zona-header">
                          <h3>📍 Zona: {zona.nombre}</h3>
                          <button 
                            className={`hc-btn-close-level ${isZonaClosed ? 'closed' : ''}`}
                            onClick={() => handleCerrarZona(zona.id)}
                            disabled={isZonaClosed || !allPasillosClosed}
                            title={!allPasillosClosed ? "Debe cerrar todos los pasillos primero" : "Cerrar Zona"}
                          >
                            {isZonaClosed ? '🔒 Zona Cerrada' : '🔓 Cerrar Zona'}
                          </button>
                        </div>

                        <div className="hc-pasillos-list">
                          {zona.pasillos.map(pasillo => {
                            const isPasilloClosed = hierarchyStatus?.pasillos?.[pasillo.id] === 'cerrado';
                            
                            return (
                              <div key={pasillo.numero} className="hc-pasillo-section">
                                <div className="hc-pasillo-header">
                                  <h4>Pasillo {pasillo.numero}</h4>
                                  <button 
                                    className={`hc-btn-close-level ${isPasilloClosed ? 'closed' : ''}`}
                                    onClick={() => handleCerrarPasillo(pasillo.id)}
                                    disabled={isPasilloClosed}
                                  >
                                    {isPasilloClosed ? '🔒 Cerrado' : '🔓 Cerrar Pasillo'}
                                  </button>
                                </div>

                                <div className="hc-locations-grid">
                                  {pasillo.ubicaciones.length > 0 ? (
                                    pasillo.ubicaciones.map(loc => {
                                      const status = getLocationStatus(loc);
                                      return (
                                        <div key={loc.key} className={`hc-location-card ${status.class}`}>
                                          <div className="hc-card-header">
                                            <span className="hc-location-badge">Ubicación: {loc.ubicacion}</span>
                                            {status.label && <span className={`hc-status-badge-card ${status.class}`}>{status.label}</span>}
                                          </div>
                                          
                                          <div className="hc-card-body">
                                            <div className="hc-conteo-grid">
                                              {/* Conteo 1 */}
                                              <div className={`hc-conteo-box ${loc.c1 ? 'active' : ''}`}>
                                                <span className="hc-conteo-label">Conteo #1</span>
                                                {loc.c1 ? (
                                                  <>
                                                    <div style={{display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'5px'}}>
                                                      <span className="hc-user-avatar">👤</span>
                                                      <span className="hc-user-name" title={loc.c1.usuario_nombre}>
                                                        {loc.c1.usuario_nombre?.split('@')[0]}
                                                      </span>
                                                    </div>
                                                    <span className="hc-mini-status-badge" style={{backgroundColor: getStatusColor(loc.c1.estado)}}>
                                                      {loc.c1.estado === 'en_progreso' ? 'En Proceso' : 'Finalizado'}
                                                    </span>
                                                    <button 
                                                      className="hc-btn-items"
                                                      onClick={() => handleVerDetalleConteo(loc.c1, 1)}
                                                    >
                                                      Ver Items ({loc.c1.total_items || 0})
                                                    </button>
                                                  </>
                                                ) : (
                                                  <span style={{color:'#cbd5e1', fontSize:'0.8rem'}}>Pendiente</span>
                                                )}
                                              </div>

                                              {/* Conteo 2 */}
                                              <div className={`hc-conteo-box ${loc.c2 ? 'active' : ''}`}>
                                                <span className="hc-conteo-label">Conteo #2</span>
                                                {loc.c2 ? (
                                                  <>
                                                    <div style={{display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'5px'}}>
                                                      <span className="hc-user-avatar">👤</span>
                                                      <span className="hc-user-name" title={loc.c2.usuario_nombre}>
                                                        {loc.c2.usuario_nombre?.split('@')[0]}
                                                      </span>
                                                    </div>
                                                    <span className="hc-mini-status-badge" style={{backgroundColor: getStatusColor(loc.c2.estado)}}>
                                                      {loc.c2.estado === 'en_progreso' ? 'En Proceso' : 'Finalizado'}
                                                    </span>
                                                    <button 
                                                      className="hc-btn-items"
                                                      onClick={() => handleVerDetalleConteo(loc.c2, 2)}
                                                    >
                                                      Ver Items ({loc.c2.total_items || 0})
                                                    </button>
                                                  </>
                                                ) : (
                                                  <span style={{color:'#cbd5e1', fontSize:'0.8rem'}}>Pendiente</span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                          
                                          <div className="hc-card-footer">
                                            <button 
                                              className="hc-btn-compare"
                                              onClick={() => handleCompare(loc)}
                                              disabled={!loc.c1 && !loc.c2}
                                            >
                                              <span>⚖️</span> Ver Comparativa
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <div style={{gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', color: 'var(--hc-text-muted)', background: '#f8fafc', borderRadius: '8px', border: '1px dashed var(--hc-border)'}}>
                                      No hay conteos registrados en este pasillo aún.
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Comparison Modal */}
      {comparisonData && (
        <div className="hc-modal-overlay">
          <div className="hc-modal-content-large">
            <div className="hc-modal-header">
              <h3>Comparativa: {comparisonData.location.zona} - {comparisonData.location.pasillo} - {comparisonData.location.ubicacion}</h3>
              <button onClick={closeComparison} className="hc-close-btn">×</button>
            </div>
            <div className="hc-modal-body">
              <table className="hc-comparison-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Descripción</th>
                    <th className="hc-text-center">Conteo #1</th>
                    <th className="hc-text-center">Conteo #2</th>
                    <th className="hc-text-center">Diferencia</th>
                    <th className="hc-text-center">Reconteo</th>
                    <th className="hc-text-center">Conteo Final</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.items.map(item => {
                    const diff = item.c1 - item.c2;
                    const selectedSource = finalSelection[item.codigo];
                    let finalValue = '';
                    
                    if (selectedSource === 'c1') finalValue = item.c1;
                    else if (selectedSource === 'c2') finalValue = item.c2;
                    else if (selectedSource === 'c3') finalValue = item.c3;
                    else if (selectedSource === 'manual') finalValue = manualValues[item.codigo] || '';

                    return (
                      <tr key={item.codigo} className={diff !== 0 ? 'hc-diff-row' : ''}>
                        <td>{item.codigo}</td>
                        <td>{item.descripcion}</td>
                        <td className="hc-text-center">
                          {diff === 0 ? (
                            <span style={{color: '#27ae60', fontWeight: 'bold'}}>{item.c1}</span>
                          ) : (
                            <label className="hc-radio-label">
                              <input 
                                type="radio" 
                                name={`final-${item.codigo}`}
                                checked={selectedSource === 'c1'}
                                onChange={() => {
                                  setFinalSelection(prev => ({...prev, [item.codigo]: 'c1'}));
                                  setManualValues(prev => {
                                    const next = {...prev};
                                    delete next[item.codigo];
                                    return next;
                                  });
                                }}
                              />
                              {item.c1}
                            </label>
                          )}
                        </td>
                        <td className="hc-text-center">
                          {diff === 0 ? (
                            <span style={{color: '#27ae60', fontWeight: 'bold'}}>{item.c2}</span>
                          ) : (
                            <label className="hc-radio-label">
                              <input 
                                type="radio" 
                                name={`final-${item.codigo}`}
                                checked={selectedSource === 'c2'}
                                onChange={() => {
                                  setFinalSelection(prev => ({...prev, [item.codigo]: 'c2'}));
                                  setManualValues(prev => {
                                    const next = {...prev};
                                    delete next[item.codigo];
                                    return next;
                                  });
                                }}
                              />
                              {item.c2}
                            </label>
                          )}
                        </td>
                        <td className={`hc-text-center ${diff !== 0 ? 'hc-has-diff' : ''}`}>
                          {diff === 0 ? (
                            <span style={{color: '#27ae60'}}>OK</span>
                          ) : (
                            diff
                          )}
                        </td>
                        <td className="hc-text-center">
                          {item.c3 > 0 ? (
                            <label className="hc-radio-label">
                              <input 
                                type="radio" 
                                name={`final-${item.codigo}`}
                                checked={selectedSource === 'c3'}
                                onChange={() => {
                                  setFinalSelection(prev => ({...prev, [item.codigo]: 'c3'}));
                                  setManualValues(prev => {
                                    const next = {...prev};
                                    delete next[item.codigo];
                                    return next;
                                  });
                                }}
                              />
                              {item.c3}
                            </label>
                          ) : '-'
                          }
                        </td>
                        <td className="hc-text-center">
                          {diff === 0 ? (
                             <span style={{fontWeight: 'bold', fontSize: '1.1em', color: '#27ae60'}}>{item.c1}</span>
                          ) : (
                            <input 
                              type="number"
                              className="hc-manual-input"
                              value={finalValue}
                              placeholder="Manual..."
                              onChange={(e) => {
                                const val = e.target.value;
                                setFinalSelection(prev => ({...prev, [item.codigo]: 'manual'}));
                                setManualValues(prev => ({...prev, [item.codigo]: val}));
                              }}
                              onClick={() => {
                                if (selectedSource !== 'manual') {
                                   setFinalSelection(prev => ({...prev, [item.codigo]: 'manual'}));
                                   // Pre-fill with current selection if exists, else empty
                                   if (finalValue !== '') {
                                      setManualValues(prev => ({...prev, [item.codigo]: finalValue}));
                                   }
                                }
                              }}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="hc-modal-footer" style={{padding: '1.5rem 2rem', borderTop: '1px solid var(--hc-border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem'}}>
              <button onClick={closeComparison} className="hc-btn-cancel" style={{padding: '0.75rem 1.5rem', border: '1px solid var(--hc-border)', background: 'white', borderRadius: '8px', cursor: 'pointer'}}>
                Cancelar
              </button>
              <button 
                onClick={handleGuardarAjuste} 
                className="hc-btn-save" 
                style={{padding: '0.75rem 1.5rem', background: 'var(--hc-primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600'}}
                disabled={loadingComparison}
              >
                {loadingComparison ? 'Guardando...' : '💾 Guardar Ajuste Final'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Detail Modal */}
      {singleDetail && (
        <div className="hc-modal-overlay">
          <div className="hc-modal-content-large">
            <div className="hc-modal-header">
              <h3>Detalle Conteo #{singleDetail.numero} - {singleDetail.conteo.estado === 'en_progreso' ? '(En Proceso)' : '(Finalizado)'}</h3>
              <div style={{display: 'flex', gap: '10px'}}>
                <button 
                  onClick={() => refreshDetail(singleDetail.conteo.id)} 
                  className="hc-modal-action-btn"
                  title="Actualizar detalle"
                >
                  🔄
                </button>
                <button onClick={closeSingleDetail} className="hc-close-btn">×</button>
              </div>
            </div>
            <div className="hc-modal-body">
              <div className="hc-detail-info-box">
                <div className="hc-detail-info-item">
                  <span className="hc-detail-label">Usuario Responsable</span>
                  <span className="hc-detail-value">{singleDetail.conteo.usuario_nombre}</span>
                </div>
                <div className="hc-detail-info-item">
                  <span className="hc-detail-label">Fecha de Inicio</span>
                  <span className="hc-detail-value">{new Date(singleDetail.conteo.fecha_inicio).toLocaleString()}</span>
                </div>
                <div className="hc-detail-info-item">
                  <span className="hc-detail-label">Total Items</span>
                  <span className="hc-detail-value">{singleDetail.items.length}</span>
                </div>
              </div>
              <table className="hc-comparison-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Descripción</th>
                    <th>Código Barra</th>
                    <th className="hc-text-center">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {singleDetail.items.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.item_codigo}</td>
                      <td>{item.descripcion}</td>
                      <td>{item.codigo_barra}</td>
                      <td className="hc-text-center"><strong>{item.cantidad}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistorialConteos;