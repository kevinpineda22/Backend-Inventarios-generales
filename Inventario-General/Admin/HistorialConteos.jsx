import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import './HistorialConteos.css';
import { inventarioGeneralService as inventarioService } from '../../services/inventarioGeneralService';
import { supabase } from '../../supabaseClient';
import Swal from 'sweetalert2';
import DashboardInventarioGeneral from './DashboardInventarioGeneral';
import FiltrosInventarioGeneral from './FiltrosInventarioGeneral';
import BitacoraActividad from './BitacoraActividad';
import { ScrollText } from 'lucide-react';

const HistorialConteos = () => {
  const [selectedCompany, setSelectedCompany] = useState('');
  const [conteos, setConteos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showBitacora, setShowBitacora] = useState(false);
  
  // Nuevo estado para la vista de panel
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'dashboard'
  const [selectedBodega, setSelectedBodega] = useState(null);
  const [filtros, setFiltros] = useState({
    zona: '',
    pasillo: '',
    usuario: '',
    producto: '',
  });
  
  // Estado para comparación
  const [comparisonData, setComparisonData] = useState(null);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [finalSelection, setFinalSelection] = useState({}); // { [itemCode]: 'c1' | 'c2' | 'c3' | 'manual' }
  const [manualValues, setManualValues] = useState({}); // { [itemCode]: number }
  
  // Estado para detalle individual
  const [singleDetail, setSingleDetail] = useState(null);
  
  // Mapa de usuarios (Email -> Nombre) para corrección visual en frontend
  const [userMap, setUserMap] = useState({});

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        // Intentar obtener correo y nombre de profiles para mapear
        const { data, error } = await supabase.from('profiles').select('correo, nombre');
        if (!error && data) {
          const map = {};
          data.forEach(p => {
            if (p.correo) map[p.correo] = p.nombre;
          });
          setUserMap(map);
        }
      } catch (e) {
        console.warn("No se pudo cargar mapa de usuarios por correo", e);
      }
    };
    fetchProfiles();
  }, []);

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
    const result = await Swal.fire({
      title: '¿Cerrar Pasillo?',
      text: "Esta acción bloqueará el ingreso de nuevos conteos en este pasillo. ¿Está seguro?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, cerrar pasillo',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    try {
      await inventarioService.cerrarPasillo(pasilloId, selectedCompany);
      // Actualizar estado local optimista o recargar
      cargarEstadoJerarquia();
      Swal.fire({
        title: '¡Cerrado!',
        text: 'El pasillo ha sido cerrado correctamente.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (error) {
      Swal.fire('Error', 'Error al cerrar pasillo: ' + error.message, 'error');
    }
  };

  const handleCerrarZona = async (zonaId) => {
    const result = await Swal.fire({
      title: '¿Cerrar Zona?',
      text: "Se cerrará la zona completa. Asegúrese de que todos los pasillos estén listos.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, cerrar zona',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    try {
      await inventarioService.cerrarZona(zonaId, selectedCompany);
      cargarEstadoJerarquia();
      Swal.fire({
        title: '¡Cerrada!',
        text: 'La zona ha sido cerrada correctamente.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (error) {
      Swal.fire('Error', 'Error al cerrar zona: ' + error.message, 'error');
    }
  };

  const handleCerrarBodega = async (bodegaId) => {
    const result = await Swal.fire({
      title: '¿Cerrar Bodega?',
      text: "Esta acción finalizará el inventario de toda la bodega. No se podrán realizar más cambios.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, cerrar bodega',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    try {
      await inventarioService.cerrarBodega(bodegaId, selectedCompany);
      cargarEstadoJerarquia();
      Swal.fire({
        title: '¡Bodega Cerrada!',
        text: 'El inventario de la bodega ha sido finalizado.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error) {
      Swal.fire('Error', 'Error al cerrar bodega: ' + error.message, 'error');
    }
  };

  // Estado para búsqueda avanzada de productos
  // const [filteredLocations, setFilteredLocations] = useState(null); // Removed in favor of backend filter
  // const [isSearching, setIsSearching] = useState(false); // Removed

  const cargarHistorial = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      // Fetch ALL counts for the company to enable comparison
      // Pass product filter to backend
      const queryFilters = {};
      if (filtros.producto) queryFilters.producto = filtros.producto;

      const data = await inventarioService.obtenerHistorialConteos(selectedCompany, queryFilters);
      setConteos(data);
    } catch (error) {
      console.error('Error al cargar historial:', error);
      if (showLoading) setMessage({ type: 'error', text: 'Error al cargar el historial de conteos' });
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Efecto para recargar cuando cambia el filtro de producto (Debounced)
  useEffect(() => {
      if (!selectedCompany) return;
      
      const timer = setTimeout(() => {
          cargarHistorial(false);
      }, 800);
      
      return () => clearTimeout(timer);
  }, [filtros.producto]);


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

    // 1. Filtrar conteos por ubicación (Bodega, Zona, Pasillo)
    // NO filtramos por usuario aquí para no perder el contexto de la ubicación completa
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

    return result.sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true })).map(zona => {
      let pasillos = Object.values(zona.pasillos);
      
      if (filtros.pasillo) {
        pasillos = pasillos.filter(p => p.numero.toLowerCase().includes(filtros.pasillo.toLowerCase()));
      }

      zona.pasillos = pasillos.sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true })).map(pasillo => {
        // AQUI APLICAMOS EL FILTRO DE USUARIO:
        // Solo mostramos ubicaciones donde el usuario seleccionado participó en ALGUNO de los conteos
        if (filtros.usuario) {
            pasillo.ubicaciones = pasillo.ubicaciones.filter(loc => {
                const user = filtros.usuario;
                const inC1 = loc.c1 && (loc.c1.usuario_nombre === user || loc.c1.correo_empleado === user || loc.c1.usuario_id === user);
                const inC2 = loc.c2 && (loc.c2.usuario_nombre === user || loc.c2.correo_empleado === user || loc.c2.usuario_id === user);
                const inDiff = loc.diff && (loc.diff.usuario_nombre === user || loc.diff.correo_empleado === user || loc.diff.usuario_id === user);
                const inFinal = loc.final && (loc.final.usuario_nombre === user || loc.final.correo_empleado === user || loc.final.usuario_id === user);
                
                return inC1 || inC2 || inDiff || inFinal;
            });
        }

        pasillo.ubicaciones.sort((a, b) => a.ubicacion.localeCompare(b.ubicacion, undefined, { numeric: true }));
        return pasillo;
      });
      
      // Limpiar pasillos que quedaron vacíos tras el filtro de usuario
      if (filtros.usuario) {
          zona.pasillos = zona.pasillos.filter(p => p.ubicaciones.length > 0);
      }
      
      return zona;
    }).filter(z => z.pasillos.length > 0); // Limpiar zonas vacías
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
          } else {
            // Si hay diferencia, verificamos si el Reconteo (C3) coincide con C1 o C2
            if (item.c3 > 0 && (item.c3 === item.c1 || item.c3 === item.c2)) {
              initialSelection[item.codigo] = 'c3';
            }
          }
          // Si hay diferencia y el reconteo no coincide, NO seleccionamos nada por defecto
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
        else if (selection === 'manual' ) finalQty = Number(manualValues[item.codigo]);
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
    if (loc.final) {
      return { label: 'FINALIZADO', class: 'hc-status-finished' };
    }
    if (loc.c1?.estado === 'finalizado' && loc.c2?.estado === 'finalizado') {
      return { label: 'POR VALIDAR', class: 'hc-status-pending-validation' };
    }
    return { label: '', class: '' };
  };

  // Helper para calcular cantidad real de items (prioriza array conteo_items)
  const getConteoQty = (conteo) => {
    if (!conteo) return 0;
    if (conteo.conteo_items && conteo.conteo_items.length > 0) {
      return conteo.conteo_items.reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0);
    }
    return conteo.total_items || 0;
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
            <div className="hc-sticky-header-wrapper">
              <div className="hc-main-header">
                <div className="hc-header-title">
                  <h2>{selectedBodega}</h2>
                  <p className="hc-subtitle">Gestión integral de inventario y cierres</p>
                </div>
                
                <div className="hc-header-actions">
                  <button 
                    className="hc-btn-toggle-view"
                    onClick={() => setShowBitacora(true)}
                    title="Ver Bitácora de Actividad"
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      background: 'white',
                      cursor: 'pointer',
                      marginRight: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      color: '#2563eb'
                    }}
                  >
                    <ScrollText size={18} />
                    Bitácora
                  </button>

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

              {/* Barra de Filtros y Búsqueda (Nueva Ubicación) */}
              <div className="hc-toolbar-container">
                  <FiltrosInventarioGeneral 
                    filtros={filtros} 
                    setFiltros={setFiltros} 
                    viewMode={viewMode}
                    structure={hierarchyStatus?.estructura}
                    conteos={conteos}
                    selectedBodega={selectedBodega}
                    selectedCompany={selectedCompany}
                    userMap={userMap}
                  />
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
                  {loading ? (
                      <div style={{padding: '2rem', textAlign: 'center', color: '#64748b'}}>
                          <div className="hc-loading-spinner" style={{margin: '0 auto 1rem'}}></div>
                          <p>Cargando datos...</p>
                      </div>
                  ) : getHierarchicalLocations().length === 0 ? (
                    <div style={{
                      padding: '3rem',
                      textAlign: 'center',
                      color: 'var(--hc-text-muted)',
                      background: 'white',
                      borderRadius: '12px',
                      boxShadow: 'var(--hc-shadow-sm)',
                      marginTop: '1rem'
                    }}>
                      <div style={{fontSize: '3rem', marginBottom: '1rem'}}>🔍</div>
                      <h3>No se encontraron resultados</h3>
                      <p>No hay conteos que coincidan con los filtros seleccionados.</p>
                      {(filtros.usuario || filtros.producto) && <p style={{fontSize: '0.9rem', marginTop: '0.5rem'}}>Intenta cambiar los criterios de búsqueda.</p>}
                    </div>
                  ) : (
                    getHierarchicalLocations().map(zona => {
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
                                                        {userMap[loc.c1.usuario_nombre] || loc.c1.usuario_nombre?.split('@')[0]}
                                                      </span>
                                                    </div>
                                                    <span className="hc-mini-status-badge" style={{backgroundColor: getStatusColor(loc.c1.estado)}}>
                                                      {loc.c1.estado === 'en_progreso' ? 'En Proceso' : 'Finalizado'}
                                                    </span>
                                                    <button 
                                                      className="hc-btn-items"
                                                      onClick={() => handleVerDetalleConteo(loc.c1, 1)}
                                                    >
                                                      Ver Items ({getConteoQty(loc.c1)})
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
                                                        {userMap[loc.c2.usuario_nombre] || loc.c2.usuario_nombre?.split('@')[0]}
                                                      </span>
                                                    </div>
                                                    <span className="hc-mini-status-badge" style={{backgroundColor: getStatusColor(loc.c2.estado)}}>
                                                      {loc.c2.estado === 'en_progreso' ? 'En Proceso' : 'Finalizado'}
                                                    </span>
                                                    <button 
                                                      className="hc-btn-items"
                                                      onClick={() => handleVerDetalleConteo(loc.c2, 2)}
                                                    >
                                                      Ver Items ({getConteoQty(loc.c2)})
                                                    </button>
                                                  </>
                                                ) : (
                                                  <span style={{color:'#cbd5e1', fontSize:'0.8rem'}}>Pendiente</span>
                                                )}
                                              </div>
                                            </div>

                                            {loc.diff && (
                                              <div className="hc-reconteo-info" style={{marginTop: '10px', padding: '8px', background: '#fff7ed', borderRadius: '6px', border: '1px solid #ffedd5'}}>
                                                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                                      <span style={{fontWeight:'bold', color:'#c2410c', fontSize:'0.85rem'}}>⚠️ Reconteo</span>
                                                      <div style={{display:'flex', alignItems:'center', gap:'5px'}}>
                                                          <span className="hc-user-avatar" style={{fontSize:'0.8rem'}}>👤</span>
                                                          <span className="hc-user-name" style={{fontSize:'0.8rem'}} title={loc.diff.usuario_nombre}>
                                                              {userMap[loc.diff.usuario_nombre] || loc.diff.usuario_nombre?.split('@')[0]}
                                                          </span>
                                                          <button 
                                                            className="hc-btn-items"
                                                            style={{padding:'2px 6px', fontSize:'0.75rem', marginLeft:'5px'}}
                                                            onClick={() => handleVerDetalleConteo(loc.diff, 3)}
                                                          >
                                                            Ver ({getConteoQty(loc.diff)})
                                                          </button>
                                                      </div>
                                                  </div>
                                              </div>
                                            )}
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
                  })
                  )}
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
                            (() => {
                              // Lógica para mostrar texto verde si el reconteo resuelve la diferencia
                              const matchesC1orC2 = item.c3 > 0 && (item.c3 === item.c1 || item.c3 === item.c2);
                              const hasManualOverride = item.c4 > 0 && item.c4 !== item.c3;
                              
                              // Si coincide con C1 o C2 y no hay un override manual diferente, mostramos texto verde
                              if (matchesC1orC2 && !hasManualOverride) {
                                return (
                                  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'}}>
                                    <span style={{fontWeight: 'bold', fontSize: '1.1em', color: '#27ae60'}}>{item.c3}</span>
                                    <span title="Coincidencia con conteo anterior" style={{cursor: 'help', fontSize: '0.8em'}}>⚡</span>
                                  </div>
                                );
                              }

                              return (
                                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'}}>
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
                                         if (finalValue !== '') {
                                            setManualValues(prev => ({...prev, [item.codigo]: finalValue}));
                                         }
                                      }
                                    }}
                                  />
                                </div>
                              );
                            })()
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

      {/* Bitácora Panel */}
      <BitacoraActividad 
        isOpen={showBitacora} 
        onClose={() => setShowBitacora(false)} 
        conteos={conteos.filter(c => c.bodega === selectedBodega)} 
      />
    </div>
  );
};

export default HistorialConteos;
