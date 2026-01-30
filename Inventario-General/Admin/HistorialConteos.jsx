import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import './HistorialConteos.css';
import { inventarioGeneralService as inventarioService, API_URL } from '../../services/inventarioGeneralService';
import { supabase } from '../../supabaseClient';
import Swal from 'sweetalert2';
import DashboardInventarioGeneral from './DashboardInventarioGeneral';
import FiltrosInventarioGeneral from './FiltrosInventarioGeneral';
import ComparativaModal from './Components/ComparativaModal';
import DetalleConteoModal from './Components/DetalleConteoModal';
import { ScrollText } from 'lucide-react';

const HistorialConteos = () => {
  const [selectedCompany, setSelectedCompany] = useState('');
  const [conteos, setConteos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Nuevo estado para la vista de panel
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'dashboard'
  const [selectedBodega, setSelectedBodega] = useState(null);
  const [listaBodegas, setListaBodegas] = useState([]); // Nueva lista de bodegas
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
      // Cargar lista de bodegas disponibles para esta empresa
      const fetchBodegas = async () => {
        try {
          const bodegas = await inventarioService.obtenerBodegas(selectedCompany);
          // Asegurar que sea un array de strings o mapear si son objetos
          const bodegasNombres = bodegas.map(b => typeof b === 'object' ? b.nombre : b);
          setListaBodegas(bodegasNombres);
        } catch (error) {
          console.error("Error cargando bodegas", error);
          setListaBodegas([]);
        }
      };
      fetchBodegas();

      setSelectedBodega(null); // Reset bodega selection on company change
      setViewMode('list'); // Reset view mode
      
      // Cargar historial general pasando null explícitamente para evitar usar el estado anterior
      cargarHistorial(true, null);
      
      // Polling para actualización en tiempo real (cada 60 segundos)
      interval = setInterval(() => {
        cargarHistorial(false, null);
      }, 60000);
    } else {
      setListaBodegas([]);
      setConteos([]);
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

  const handleCerrarNivel = async (tipo, id, nombre = '') => {
    const configs = {
      pasillo: {
        title: '¿Cerrar Pasillo?',
        text: 'Esta acción bloqueará el ingreso de nuevos conteos en este pasillo. ¿Está seguro?',
        success: 'El pasillo ha sido cerrado correctamente.',
        action: (id, cia) => inventarioService.cerrarPasillo(id, cia)
      },
      zona: {
        title: '¿Cerrar Zona?',
        text: 'Se cerrará la zona completa. Asegúrese de que todos los pasillos estén listos.',
        success: 'La zona ha sido cerrada correctamente.',
        action: (id, cia) => inventarioService.cerrarZona(id, cia)
      },
      bodega: {
        title: '¿Cerrar Bodega?',
        text: 'Esta acción finalizará el inventario de toda la bodega. No se podrán realizar más cambios.',
        success: 'El inventario de la bodega ha sido finalizado.',
        action: (id, cia) => inventarioService.cerrarBodega(id, cia)
      }
    };

    const config = configs[tipo];
    if (!config) return;

    const result = await Swal.fire({
      title: config.title,
      text: config.text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: `Sí, cerrar ${tipo}`,
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    try {
      await config.action(id, selectedCompany);
      cargarEstadoJerarquia();
      Swal.fire({
        title: '¡Cerrado!',
        text: config.success,
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (error) {
      Swal.fire('Error', `Error al cerrar ${tipo}: ` + error.message, 'error');
    }
  };

  // Estado para búsqueda avanzada de productos
  // const [filteredLocations, setFilteredLocations] = useState(null); // Removed in favor of backend filter
  // const [isSearching, setIsSearching] = useState(false); // Removed

  // Efecto para recargar cuando cambia la bodega seleccionada (para obtener historial completo de esa bodega)
  useEffect(() => {
    if (selectedBodega) {
      cargarHistorial(true);
    }
  }, [selectedBodega]);

  const cargarHistorial = async (showLoading = true, bodegaOverride = undefined) => {
    try {
      if (showLoading) setLoading(true);
      
      const queryFilters = {};
      if (filtros.producto) queryFilters.producto = filtros.producto;
      
      // Determinar qué bodega usar: el override (si se pasa) o el estado actual
      // Si bodegaOverride es null, significa explícitamente "sin bodega"
      const bodegaToUse = bodegaOverride !== undefined ? bodegaOverride : selectedBodega;

      if (bodegaToUse) queryFilters.bodega = bodegaToUse;

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


  // Extraer bodegas únicas (YA NO SE USA, se usa listaBodegas cargada del servicio)
  // const bodegas = useMemo(() => [...new Set(conteos.map(c => c.bodega))].sort(), [conteos]);

  // Agrupar conteos por Jerarquía: Zona -> Pasillo -> Ubicaciones
  const hierarchicalLocations = useMemo(() => {
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

        // AQUI APLICAMOS EL FILTRO DE PENDIENTES
        if (filtros.soloPendientes) {
            pasillo.ubicaciones = pasillo.ubicaciones.filter(loc => !loc.final);
        }

        pasillo.ubicaciones.sort((a, b) => a.ubicacion.localeCompare(b.ubicacion, undefined, { numeric: true }));
        return pasillo;
      });
      
      // Limpiar pasillos que quedaron vacíos tras el filtro de usuario
      if (filtros.usuario || filtros.soloPendientes) {
          zona.pasillos = zona.pasillos.filter(p => p.ubicaciones.length > 0);
      }
      
      return zona;
    }).filter(z => z.pasillos.length > 0); // Limpiar zonas vacías
  }, [conteos, selectedBodega, hierarchyStatus, filtros]);

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

  // Helper para guardar ajuste (reutilizable)
  const executeSaveAdjustment = async (ubicacionId, itemsToSave, user, silent = false) => {
    try {
      await inventarioService.guardarAjusteFinal({
        ubicacionId,
        usuarioId: user.id,
        usuarioEmail: user.email || 'admin@sistema.com',
        items: itemsToSave
      });

      if (!silent) {
        Swal.fire({
          title: '¡Guardado!',
          text: 'Ajuste final guardado exitosamente.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        // Notificación discreta para procesos automáticos
        const Toast = Swal.mixin({
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 2000,
          timerProgressBar: true
        });
        Toast.fire({
          icon: 'success',
          title: 'Ajuste guardado automáticamente'
        });
      }
      return true;
    } catch (error) {
      console.error("Error al guardar ajuste:", error);
      if (!silent) {
        Swal.fire({
          title: 'Error',
          text: 'Error al guardar ajuste: ' + error.message,
          icon: 'error',
          confirmButtonText: 'Cerrar'
        });
      }
      return false;
    }
  };

  // Helper para obtener datos de comparativa y analizar estado
  const fetchAndAnalyzeComparison = async (locationGroup) => {
    // 1. Intentar optimización
    const ubicacionId = locationGroup.c1?.ubicacion_id || locationGroup.c2?.ubicacion_id || locationGroup.diff?.ubicacion_id;
    let items = [];
    let locationData = locationGroup;

    // Fetch data
    try {
      if (ubicacionId) {
        const result = await inventarioService.obtenerComparativa(ubicacionId);
        if (result.success) {
          items = result.data.items.map(i => ({
             ...i,
             id: i.item_id,
             barra: i.codigo_barra
          })); // Normalizar estructura
          locationData = result.data.location;
        }
      } else {
        // Fallback lógica antigua (fetch individual)
        // ... (Simplificado para este ejemplo, asumimos que la optimización funciona o se implementa fallback completo si falla)
         throw new Error("ID de ubicación no encontrado, fallback requerido");
      }
    } catch (e) {
       // Fallback manual fetch if needed
       const c1Id = locationGroup.c1?.id;
       const c2Id = locationGroup.c2?.id;
       const c3Id = locationGroup.diff?.id;
       const c4Id = locationGroup.final?.id;

       const [itemsC1, itemsC2, itemsC3, itemsC4] = await Promise.all([
        c1Id ? inventarioService.obtenerDetalleConteo(c1Id) : Promise.resolve([]),
        c2Id ? inventarioService.obtenerDetalleConteo(c2Id) : Promise.resolve([]),
        c3Id ? inventarioService.obtenerDetalleConteo(c3Id) : Promise.resolve([]),
        c4Id ? inventarioService.obtenerDetalleConteo(c4Id) : Promise.resolve([])
      ]);

      const itemMap = {};
      const normalize = (val) => String(val).trim();
      const processItem = (item, type) => {
        const key = normalize(item.item_codigo);
        if (!itemMap[key]) {
          itemMap[key] = {
            id: item.item_id,
            codigo: item.item_codigo,
            descripcion: item.descripcion,
            barra: item.codigo_barra,
            c1: 0, c2: 0, c3: 0, c4: 0
          };
        }
        itemMap[key][type] += Number(item.cantidad) || 0;
      };

      itemsC1.forEach(i => processItem(i, 'c1'));
      itemsC2.forEach(i => processItem(i, 'c2'));
      itemsC3.forEach(i => processItem(i, 'c3'));
      itemsC4.forEach(i => processItem(i, 'c4'));
      items = Object.values(itemMap);
    }

    // Analizar resolución
    const initialSelection = {};
    const initialManualValues = {};
    let allResolved = true;
    const itemsToSave = [];

    items.forEach(item => {
       // Si ya tiene C4 (ajuste final), tomamos ese valor
       // Check for both .c4 (backend format) and .final (frontend format)
       if (locationData.c4 || locationData.final) {
          initialSelection[item.codigo] = 'manual';
          initialManualValues[item.codigo] = item.c4 || 0;
          return;
       }

       const diff = item.c1 - item.c2;
       let resolvedVal = null;

       if (diff === 0) {
         initialSelection[item.codigo] = 'c1';
         resolvedVal = item.c1;
       } else {
         if (item.c3 > 0 && (item.c3 === item.c1 || item.c3 === item.c2)) {
           initialSelection[item.codigo] = 'c3';
           resolvedVal = item.c3;
         } else {
           allResolved = false; // Conflicto no resuelto
         }
       }

       if (resolvedVal !== null) {
          itemsToSave.push({
             itemId: item.id,
             codigo: item.barra || item.codigo,
             cantidad: resolvedVal,
             companiaId: selectedCompany
          });
       }
    });

    return {
       items,
       locationData,
       initialSelection,
       initialManualValues,
       allResolved,
       itemsToSave,
       ubicacionId
    };
  };

  const handleCompare = async (locationGroup, autoSaveIfPossible = true) => {
    // 1. Abrir Modal Inmediatamente (UX optimista)
    // Solo si no es una llamada puramente automática donde no se espera UI
    if (!autoSaveIfPossible) {
        setComparisonData({
            location: locationGroup,
            items: [],
            loading: true
        });
        setFinalSelection({});
        setManualValues({});
    }

    try {
      setLoadingComparison(true);
      
      const analysis = await fetchAndAnalyzeComparison(locationGroup);
      const { items, locationData, initialSelection, initialManualValues, allResolved, itemsToSave, ubicacionId } = analysis;

      // Lógica de Auto-Guardado
      // Si todo está resuelto, NO hay ajuste final previo, y el flag está activo
      if (allResolved && !locationData.c4 && autoSaveIfPossible && itemsToSave.length > 0) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
             const saved = await executeSaveAdjustment(ubicacionId, itemsToSave, user, true);
             if (saved) {
                cargarHistorial(false); // Refrescar lista
                setLoadingComparison(false);
                if (!autoSaveIfPossible) setComparisonData(null); // Cerrar si se abrió
                return; 
             }
          }
      }

      // Si no se auto-guardó, mostramos los datos en el modal (o actualizamos el loading)
      setFinalSelection(initialSelection);
      setManualValues(initialManualValues);
      setComparisonData({ location: locationData, items, loading: false });

    } catch (error) {
      setMessage({ type: 'error', text: 'Error al cargar comparativa: ' + error.message });
      setComparisonData(null); // Cerrar en error
    } finally {
      setLoadingComparison(false);
    }
  };

  const handleGuardarTodoAutomatico = async () => {
    const result = await Swal.fire({
      title: '¿Resolver y Guardar Todo?',
      html: `Se buscarán ubicaciones con conteos completos (1 y 2) y <b>sin diferencias</b> (o diferencias ya resueltas por Conteos 3).<br/><br/>
             Las ubicaciones con conflictos pendientes se mantendrán para revisión manual.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, procesar automáticamente',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    setLoadingComparison(true);
    let guardados = 0;
    let omitidos = 0;
    
    // Aplanar lista de ubicaciones candidatas
    const candidates = [];
    hierarchicalLocations.forEach(zona => {
        if (zona.pasillos) {
            zona.pasillos.forEach(pasillo => {
                const locations = pasillo.ubicaciones || [];
                locations.forEach(loc => {
                    // Solo procesar si tiene conteos base (c1/c2) y NO tiene final (c4)
                    if ((loc.c1 || loc.c2) && !loc.final) {
                        candidates.push(loc);
                    }
                });
            });
        }
    });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesión expirada");

      // Mostrar indicador de carga
      Swal.fire({
        title: 'Procesando Auto-Guardado',
        html: `Analizando ${candidates.length} ubicaciones candidatas...<br>Por favor espere.`,
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      for (const loc of candidates) {
          try {
              const analysis = await fetchAndAnalyzeComparison(loc);
              if (analysis.allResolved && analysis.itemsToSave.length > 0) {
                  // Pasar silent=true para no mostrar alertas individuales
                  await executeSaveAdjustment(analysis.ubicacionId, analysis.itemsToSave, user, true);
                  guardados++;
              } else {
                  omitidos++;
              }
          } catch (e) {
              console.warn("Error procesando ubicación auto:", loc, e);
              omitidos++;
          }
      }

      Swal.fire({
        title: 'Proceso completado',
        text: `Se guardaron ${guardados} ubicaciones automáticamente. Quedan ${omitidos} pendientes de revisión manual.`,
        icon: 'success'
      });
      
      cargarHistorial(false);

    } catch (error) {
       Swal.fire('Error', error.message, 'error');
    } finally {
       setLoadingComparison(false);
    }
  };

  const handleVerDetalleConteo = async (conteo, numeroConteo) => {
    if (!conteo) return;
    
    // Optimistic UI: Abrir modal inmediatamente con estado de carga
    setSingleDetail({
      conteo: conteo,
      numero: numeroConteo,
      items: [],
      loading: true
    });

    try {
      // No activamos global loading para evitar parpadeos de fondo
      // setLoading(true); 
      const items = await inventarioService.obtenerDetalleConteo(conteo.id);
      setSingleDetail(prev => ({
        ...prev,
        items: items,
        loading: false
      }));
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al cargar detalle: ' + error.message });
      setSingleDetail(null); // Cerrar si falla
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
      
      // Prioridad 1: Valor Manual Explícito (Modo Edición)
      if (manualValues[item.codigo] !== undefined && finalSelection[item.codigo] === 'manual') {
          finalQty = Number(manualValues[item.codigo]);
      }
      // Prioridad 2: Coincidencia (Sin diferencias)
      else if (diff === 0) {
        finalQty = item.c1; 
      } 
      // Prioridad 3: Selección de Diferencias
      else {
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
      const ubicacionId = comparisonData.location.c1?.ubicacion_id || comparisonData.location.c2?.ubicacion_id;
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('Usuario no identificado');

      const success = await executeSaveAdjustment(ubicacionId, itemsToSave, user, false);
      
      if (success) {
        closeComparison();
        cargarHistorial(false);
      }

    } catch (error) {
      Swal.fire('Error', error.message, 'error');
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

  const renderConteoBox = (conteo, numero) => {
    if (!conteo) return (
      <div className="hc-conteo-box">
        <span className="hc-conteo-label">Conteo #{numero}</span>
        <span style={{color:'#cbd5e1', fontSize:'0.8rem'}}>Pendiente</span>
      </div>
    );

    return (
      <div className={`hc-conteo-box active`}>
        <span className="hc-conteo-label">Conteo #{numero}</span>
        <div style={{display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'5px'}}>
          <span className="hc-user-avatar">👤</span>
          <span className="hc-user-name" title={conteo.usuario_nombre}>
            {userMap[conteo.usuario_nombre] || conteo.usuario_nombre?.split('@')[0]}
          </span>
        </div>
        <span className="hc-mini-status-badge" style={{backgroundColor: getStatusColor(conteo.estado)}}>
          {conteo.estado === 'en_progreso' ? 'En Proceso' : 'Finalizado'}
        </span>
        <button 
          className="hc-btn-items"
          onClick={() => handleVerDetalleConteo(conteo, numero)}
        >
          Ver Items ({getConteoQty(conteo)})
        </button>
      </div>
    );
  };

  const handleCambioBodega = (bodega) => {
    if (selectedBodega === bodega) return;
    
    // Limpieza inmediata para UX robusto (evita ver datos de bodega anterior)
    setConteos([]);
    setHierarchyStatus(null);
    setLoading(true);
    
    setSelectedBodega(bodega);
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
          {loading && !listaBodegas.length ? (
            <div className="hc-loading-text">Cargando...</div>
          ) : listaBodegas.length > 0 ? (
            listaBodegas.map(bodega => (
              <div 
                key={bodega}
                className={`hc-bodega-item ${selectedBodega === bodega ? 'active' : ''}`}
                onClick={() => handleCambioBodega(bodega)}
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
                    className="hc-btn-toggle-view"
                    onClick={handleGuardarTodoAutomatico}
                    title="Guardar automáticamente todo lo resuelto"
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #16a34a',
                      background: '#dcfce7',
                      color: '#15803d',
                      cursor: 'pointer',
                      marginRight: '10px',
                      fontWeight: 600
                    }}
                  >
                    🚀 Guardar Auto
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
                      if (bodegaId) handleCerrarNivel('bodega', bodegaId);
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
                  ) : hierarchicalLocations.length === 0 ? (
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
                    hierarchicalLocations.map(zona => {
                    const isZonaClosed = hierarchyStatus?.zonas?.[zona.id] === 'cerrado';
                    const allPasillosClosed = zona.pasillos.every(p => hierarchyStatus?.pasillos?.[p.id] === 'cerrado');

                    return (
                      <div key={zona.nombre} className="hc-zona-section">
                        <div className="hc-zona-header">
                          <h3>📍 Zona: {zona.nombre}</h3>
                          <button 
                            className={`hc-btn-close-level ${isZonaClosed ? 'closed' : ''}`}
                            onClick={() => handleCerrarNivel('zona', zona.id)}
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
                                    onClick={() => handleCerrarNivel('pasillo', pasillo.id)}
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
                                              {/* Conteo 1 & 2 */}
                                              {renderConteoBox(loc.c1, 1)}
                                              {renderConteoBox(loc.c2, 2)}
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
                                              onClick={() => handleCompare(loc, false)}
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
      <ComparativaModal 
        comparisonData={comparisonData}
        closeComparison={closeComparison}
        finalSelection={finalSelection}
        setFinalSelection={setFinalSelection}
        manualValues={manualValues}
        setManualValues={setManualValues}
        handleGuardarAjuste={handleGuardarAjuste}
        loadingComparison={loadingComparison}
      />

      {/* Single Detail Modal */}
      <DetalleConteoModal 
        singleDetail={singleDetail}
        closeSingleDetail={closeSingleDetail}
        refreshDetail={refreshDetail}
      />

      {/* Bitácora Panel Removed */}
    </div>
  );
};

export default HistorialConteos;
