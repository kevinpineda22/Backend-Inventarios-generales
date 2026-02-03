import { useState, useEffect, useRef, useCallback } from 'react';
import './PanelReconteoDiferencias.css';
import { inventarioGeneralService as inventarioService } from '../../services/inventarioGeneralService';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { FaCheckCircle, FaEdit, FaBoxOpen, FaCamera } from 'react-icons/fa'; // Agregar icono camara
import EscanerBarras from '../../pages/DesarrolloSurtido_API/EscanerBarras';

const PanelReconteoDiferencias = ({ companiaId, usuarioId, usuarioNombre, usuarioEmail, onCerrar, filtros }) => {
  const [allUbicaciones, setAllUbicaciones] = useState([]); // Todas las ubicaciones sin filtrar
  const [ubicaciones, setUbicaciones] = useState([]); // Ubicaciones mostradas
  const [loading, setLoading] = useState(true);
  
  // Estados de filtros internos
  const [filterBodega, setFilterBodega] = useState(filtros?.bodega || "");
  const [filterZona, setFilterZona] = useState(filtros?.zona || "");
  const [filterPasillo, setFilterPasillo] = useState(filtros?.pasillo || "");
  const [filterItem, setFilterItem] = useState(""); // Filtro por item (codigo/nombre)

  // Listas para los selectores de filtro (derivadas de los datos)
  const [bodegasOptions, setBodegasOptions] = useState([]);
  const [zonasOptions, setZonasOptions] = useState([]);
  const [pasillosOptions, setPasillosOptions] = useState([]);
  
  // Estados para la vista de reconteo (PDA View)
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'recount'
  const [activeRecount, setActiveRecount] = useState(null); // Datos de la ubicación seleccionada
  const [conteoId, setConteoId] = useState(null); // ID de la sesión de conteo (Conteo 3)
  const [recountedItems, setRecountedItems] = useState([]); // Items ya contados en esta sesión (del backend)
  
  // Estados para el Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null); // Item seleccionado para editar
  const [qtyInput, setQtyInput] = useState('');
  const inputRef = useRef(null);
  
  // Estado para el input de scanner (PDA)
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeInputRef = useRef(null);
  // Estado para Scanner de Camara
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    cargarUbicaciones();
  }, [companiaId]);

  // Foco automático al input del modal y al scanner cuando se cambia de vista
  useEffect(() => {
    if (modalOpen && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 100);
    } else if (viewMode === 'recount' && !modalOpen && barcodeInputRef.current) {
      // Enfocar input de scanner si estamos en modo reconteo y sin modal abierto
      setTimeout(() => barcodeInputRef.current.focus(), 100);
    }
  }, [modalOpen, viewMode]);

  const cargarUbicaciones = async () => {
    try {
      setLoading(true);
      const data = await inventarioService.obtenerUbicacionesConDiferenciasPendientes(companiaId);
      const rawData = data || [];
      setAllUbicaciones(rawData);
      
      // Extraer opciones únicas para los filtros
      const uniqueBodegas = [];
      const uniqueZonas = [];
      const uniquePasillos = [];
      const bodegaMap = new Map();
      const zonaMap = new Map();
      const pasilloMap = new Map();

      rawData.forEach(u => {
        const b = u.ubicacion.pasillo?.zona?.bodega;
        const z = u.ubicacion.pasillo?.zona;
        const p = u.ubicacion.pasillo;

        if (b && !bodegaMap.has(b.id)) {
          bodegaMap.set(b.id, true);
          uniqueBodegas.push(b);
        }
        if (z && !zonaMap.has(z.id)) {
          zonaMap.set(z.id, true);
          uniqueZonas.push(z);
        }
        if (p && !pasilloMap.has(p.id)) {
          pasilloMap.set(p.id, true);
          uniquePasillos.push(p);
        }
      });

      setBodegasOptions(uniqueBodegas);
      setZonasOptions(uniqueZonas);
      setPasillosOptions(uniquePasillos);

    } catch (error) {
      console.error('Error al cargar diferencias:', error);
      toast.error('Error al cargar ubicaciones con diferencias');
    } finally {
      setLoading(false);
    }
  };

  // Efecto para aplicar filtros
  useEffect(() => {
    let filtered = allUbicaciones;

    if (filterBodega) {
      filtered = filtered.filter(u => String(u.ubicacion.pasillo?.zona?.bodega?.id) === String(filterBodega));
    }
    if (filterZona) {
      filtered = filtered.filter(u => String(u.ubicacion.pasillo?.zona?.id) === String(filterZona));
    }
    if (filterPasillo) {
      filtered = filtered.filter(u => String(u.ubicacion.pasillo?.id) === String(filterPasillo));
    }
    
    if (filterItem && filterItem.trim() !== '') {
      const term = filterItem.toLowerCase().trim();
      filtered = filtered.filter(u => 
        u.diferencias.some(diff => {
          const desc = diff.item?.descripcion?.toLowerCase() || '';
          const code = (diff.item?.codigo || diff.item?.codigo_barra || '').toLowerCase();
          return desc.includes(term) || code.includes(term);
        })
      );
    }

    setUbicaciones(filtered);
  }, [allUbicaciones, filterBodega, filterZona, filterPasillo, filterItem]);

  const handleStartRecount = async (data) => {
    try {
      setLoading(true);
      
      // 1. Iniciar Conteo (Tipo 3)
      // Usamos la clave de la ubicación si está disponible, o manejamos el error
      if (!data.ubicacion.clave) {
        toast.error("Error: La ubicación no tiene clave configurada.");
        setLoading(false);
        return;
      }

      const response = await inventarioService.iniciarConteo({
        ubicacionId: data.ubicacion.id,
        usuarioId: usuarioId,
        tipoConteo: 3, // Siempre es 3 para reconteo
        clave: data.ubicacion.clave,
        usuarioEmail: usuarioEmail
      });

      if (!response.success) {
        toast.error(response.message);
        setLoading(false);
        return;
      }

      const conteoData = response.data;
      setConteoId(conteoData.id);
      setActiveRecount(data); // Guardamos toda la data (incluyendo diferencias)
      
      // 2. Cargar items ya contados (Recuperación de sesión)
      let itemsPrevios = [];
      if (conteoData.items && Array.isArray(conteoData.items)) {
        itemsPrevios = conteoData.items;
      } else {
        // Si no vienen en el login, los pedimos
        const itemsResp = await inventarioService.obtenerItemsConteo(conteoData.id);
        if (itemsResp.success) {
          itemsPrevios = itemsResp.data;
        }
      }
      setRecountedItems(itemsPrevios);
      
      setViewMode('recount');
    } catch (error) {
      console.error('Error al iniciar reconteo:', error);
      toast.error('Error al iniciar la sesión de reconteo');
    } finally {
      setLoading(false);
    }
  };

  // Manejo de Scanner Manual y de Camara Unificado
  const handleBarcodeProcess = async (code) => {
    try {
        // 1. Validación básica
        if (!code) {
            toast.warning("Lectura vacía detectada");
            return;
        }
        
        // Limpiamos el código
        const normalizedCode = String(code).trim().toUpperCase();
        console.log("Procesando código:", normalizedCode);
        
        // Validar Estado
        if (!activeRecount || !activeRecount.diferencias) {
            console.error("Estado inválido:", activeRecount);
            alert("Error crítico: No hay datos de diferencias cargados. Por favor recarga la página.");
            return;
        }

        // 2. Intento de Búsqueda Local (Optimista)
        // Debug: Log para ver qué códigos tiene el frontend
        console.log("Intentando búsqueda local para " + normalizedCode);

        let foundDiff = activeRecount.diferencias.find(diff => {
            // Recopilar todos los códigos posibles de este item
            const candidates = [];
            if (diff.item?.codigo) candidates.push(String(diff.item.codigo).trim().toUpperCase());
            if (diff.item?.codigo_barra) candidates.push(String(diff.item.codigo_barra).trim().toUpperCase());
            if (diff.item?.codigo_barras) candidates.push(String(diff.item.codigo_barras).trim().toUpperCase()); // Por si acaso
            
            // Support for multiple barcodes (joined table)
            if (diff.item?.codigos && Array.isArray(diff.item.codigos)) {
                diff.item.codigos.forEach(c => {
                    if (c.codigo_barras) candidates.push(String(c.codigo_barras).trim().toUpperCase());
                });
            }

            return candidates.some(itemCode => {
                // A. Coincidencia exacta
                if (itemCode === normalizedCode) return true;
                
                // B. UPC vs EAN13 (Ceros al inicio)
                if (normalizedCode.length > itemCode.length && normalizedCode.endsWith(itemCode) && Number(normalizedCode) === Number(itemCode)) return true;
                if (itemCode.length > normalizedCode.length && itemCode.endsWith(normalizedCode) && Number(itemCode) === Number(normalizedCode)) return true;

                return false;
            });
        });

        // 3. Si no se encuentra localmente, buscar en el Backend (Fallback Robusto)
        if (!foundDiff) {
            console.log("No encontrado localmente, consultando al servidor...");
            /* No activamos loading global para no interrumpir flujo, pero podríamos usar un toast de 'Buscando...' */
            
            try {
                const response = await inventarioService.buscarItemPorCodigoBarra(normalizedCode, companiaId);
                
                if (response.success && response.data) {
                    const backendItem = response.data;
                    console.log("Encontrado en backend:", backendItem);
                    
                    // IMPORTANTE: Buscamos si el item recuperado del backend corresponde a alguna de las diferencias
                    // La coincidencia se hace por ID de item, que es único e inmutable
                     foundDiff = activeRecount.diferencias.find(d => 
                        String(d.item_id) === String(backendItem.id) || 
                        String(d.item?.id) === String(backendItem.id)
                    );
                    
                    if (!foundDiff) {
                        // El item existe en la BD pero no está en la lista de diferencias para esta ubicación
                        Swal.fire({
                            icon: 'error',
                            title: 'Producto No Corresponde',
                            html: `El código escaneado <b>(${normalizedCode})</b> corresponde a "<b>${backendItem.descripcion}</b>", <br/>pero este producto NO está en la lista de diferencias.`,
                            confirmButtonColor: '#e74c3c'
                        }).then(() => {
                            if (barcodeInputRef.current) barcodeInputRef.current.focus();
                        });
                        
                        setBarcodeInput('');
                        return;
                    }
                }
            } catch (serverError) {
                console.error("Error buscando en servidor:", serverError);
                // Continuamos al bloque final para reportar error si no se halló nada
            }
        }

        if (foundDiff) {
            // CASO EXITO
            handleItemClick(foundDiff);
            setBarcodeInput('');
        } else {
            // CASO FALLO
            console.warn(`Código ${code} no encontrado.`);
            
            Swal.fire({
                icon: 'error',
                title: 'Código No Reconocido',
                html: `El código escaneado <b>(${normalizedCode})</b> no pertenece a ninguno de los productos de la lista <br/>ni se encontró en la base de datos.`,
                confirmButtonColor: '#e74c3c'
            }).then(() => {
                if (barcodeInputRef.current) barcodeInputRef.current.focus();
            });

            setBarcodeInput('');
        }
    } catch (err) {
        console.error("Error en handleBarcodeProcess:", err);
        alert("Ocurrió un error al procesar el código: " + err.message);
    }
  };

  // --- STABLE SCAN HANDLER FOR CAMERA ---
  // Mantiene una referencia estable para no reinicializar la cámara en cada render
  const handleBarcodeProcessRef = useRef(handleBarcodeProcess);
  
  // Actualizamos la ref cada vez que cambia el metodo principal
  useEffect(() => {
    handleBarcodeProcessRef.current = handleBarcodeProcess;
  }, [allUbicaciones, activeRecount, recountedItems]); // Agregamos dependencias explícitas porsiaca

  const handleStableScan = useCallback((code) => {
    console.log("Cámara detectó:", code);
    if (handleBarcodeProcessRef.current) {
      handleBarcodeProcessRef.current(code);
    }
  }, []); 
  // --------------------------------------

  const handleBarcodeScan = (e) => {
    e.preventDefault();
    handleBarcodeProcess(barcodeInput);
  };

  const handleItemClick = (diffItem) => {
    try {
        console.log("Abriendo modal para:", diffItem);
        // Buscar si ya tenemos un conteo para este item
        // diffItem viene de la lista de diferencias (item maestro)
        // recountedItems viene del backend (conteo_items)
        
        // Calcular cantidad actual registrada
        // Aseguramos que recountedItems sea un array
        const safeRecounted = Array.isArray(recountedItems) ? recountedItems : [];
        
        const currentRecords = safeRecounted.filter(r => {
        // 1. Match por ID
        const rId = r.item_id || r.producto_id || r.id_item || (r.item && r.item.id);
        if (String(rId) === String(diffItem.item_id)) return true;

        // 2. Match por Código de Barras (Fallback por si los IDs difieren)
        const diffBarcode = diffItem.item?.codigo || diffItem.item?.codigo_barra;
        const rBarcode = r.item?.codigo || r.item?.codigo_barra;
        if (diffBarcode && rBarcode && String(diffBarcode) === String(rBarcode)) return true;

        return false;
        });
        const currentQty = currentRecords.reduce((sum, r) => sum + Number(r.cantidad), 0);

        setSelectedItem({
        ...diffItem,
        currentQty,
        currentRecords // Guardamos referencia para poder borrarlos si se sobrescribe
        });
        setQtyInput(currentQty > 0 ? String(currentQty) : '');
        setModalOpen(true);
    } catch (error) {
        console.error("Error abriendo modal:", error);
        alert("Error al intentar abrir el item: " + error.message);
    }
  };

  const handleSaveQuantity = async () => {
    if (loading) return; // Prevenir doble ejecución

    if (!qtyInput || isNaN(qtyInput)) {
      toast.warning('Ingrese una cantidad válida');
      return;
    }

    const nuevaCantidad = parseFloat(qtyInput);
    if (nuevaCantidad < 0) {
      toast.warning('La cantidad no puede ser negativa');
      return;
    }

    try {
      setLoading(true);

      // ESTRATEGIA: "Set Quantity" (Sobrescribir)
      // 1. Eliminar registros previos de este item en esta sesión
      if (selectedItem.currentRecords && selectedItem.currentRecords.length > 0) {
        // Eliminar uno por uno (idealmente el backend tendría deleteByItem, pero usamos lo que hay)
        // Usamos Promise.all para velocidad
        await Promise.all(selectedItem.currentRecords.map(r => inventarioService.eliminarConteoItem(r.id)));
      }

      // 2. Agregar nuevo registro si la cantidad > 0
      if (nuevaCantidad > 0) {
        // Necesitamos el código de barras. El objeto diffItem tiene 'item' que es el objeto maestro.
        // Buscamos el código en item.codigo o item.codigo_barra
        const barcode = selectedItem.item.codigo || selectedItem.item.codigo_barra;
        // ✅ Obtener ID real del item para evitar fallos de búsqueda por código de barras
        const itemId = selectedItem.item_id || selectedItem.item?.id;
        
        if (!barcode) {
          console.error("Item sin código:", selectedItem);
          throw new Error("El item no tiene código de barras asociado en la base de datos");
        }

        const response = await inventarioService.registrarConteoItem(conteoId, {
          codigoBarra: barcode,
          cantidad: nuevaCantidad,
          companiaId: companiaId,
          usuarioEmail: usuarioEmail,
          itemId: itemId // ✅ Enviar ID real
        });

        if (!response.success) {
          throw new Error(response.message || 'El servidor rechazó el registro');
        }
      }

      toast.success('Cantidad actualizada');
      
      // 3. Recargar items del conteo para actualizar la vista
      // Pequeño delay para asegurar consistencia en BD
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const itemsResp = await inventarioService.obtenerItemsConteo(conteoId);
      if (itemsResp.success) {
        console.log('Items recargados:', itemsResp.data);
        setRecountedItems(itemsResp.data);
      }

      setModalOpen(false);
    } catch (error) {
      console.error('Error al guardar cantidad:', error);
      toast.error('Error al guardar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFinishRecount = async () => {
    const result = await Swal.fire({
      title: '¿Finalizar Reconteo?',
      text: "Se cerrará la sesión de conteo para esta ubicación.",
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, finalizar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#27ae60'
    });

    if (!result.isConfirmed) return;

    try {
      setLoading(true);
      await inventarioService.finalizarConteo(conteoId);
      toast.success('Reconteo finalizado correctamente');
      
      // Volver a la lista
      setViewMode('list');
      setActiveRecount(null);
      setConteoId(null);
      setRecountedItems([]);
      
      // Recargar lista de ubicaciones
      cargarUbicaciones();
    } catch (error) {
      console.error('Error al finalizar:', error);
      toast.error('Error al finalizar el reconteo');
    } finally {
      setLoading(false);
    }
  };

  // --- RENDERIZADO ---

  // 1. VISTA DE LISTA (Panel Principal)
  if (viewMode === 'list') {
    return (
      <div className="reconteo-container">
        <div className="reconteo-header">
          <div>
            <h2>⚠️ Recontar Diferencias</h2>
        
          </div>
          <button onClick={onCerrar} className="btn-back">
            Volver al Panel
          </button>
        </div>

        {/* Filtros de Ubicación */}
        <div className="reconteo-filtros" style={{ 
          display: 'flex', 
          gap: '15px', 
          padding: '15px', 
          backgroundColor: 'white', 
          borderRadius: '8px', 
          marginBottom: '20px', 
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
          flexWrap: 'wrap',
          alignItems: 'flex-end'
        }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: '#2c3e50', fontSize: '0.9rem' }}>Bodega</label>
            <select 
              value={filterBodega} 
              onChange={(e) => { setFilterBodega(e.target.value); setFilterZona(""); setFilterPasillo(""); }}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '0.95rem' }}
            >
              <option value="">Todas las Bodegas</option>
              {bodegasOptions.map(b => (
                <option key={b.id} value={b.id}>{b.nombre}</option>
              ))}
            </select>
          </div>
          
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: '#2c3e50', fontSize: '0.9rem' }}>Zona</label>
            <select 
              value={filterZona} 
              onChange={(e) => { setFilterZona(e.target.value); setFilterPasillo(""); }}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '0.95rem' }}
            >
              <option value="">Todas las Zonas</option>
              {zonasOptions
                .filter(z => !filterBodega || String(z.bodega?.id) === String(filterBodega))
                .map(z => (
                <option key={z.id} value={z.id}>{z.nombre}</option>
              ))}
            </select>
          </div>

          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: '#2c3e50', fontSize: '0.9rem' }}>Pasillo</label>
            <select 
              value={filterPasillo} 
              onChange={(e) => setFilterPasillo(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '0.95rem' }}
            >
              <option value="">Todos los Pasillos</option>
              {pasillosOptions
                .filter(p => (!filterBodega || String(p.zona?.bodega?.id) === String(filterBodega)) && (!filterZona || String(p.zona?.id) === String(filterZona)))
                .map(p => (
                <option key={p.id} value={p.id}>Pasillo {p.numero}</option>
              ))}
            </select>
          </div>

          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', color: '#2c3e50', fontSize: '0.9rem' }}>Buscar Item</label>
            <input 
              type="text"
              placeholder="Código o nombre..."
              value={filterItem} 
              onChange={(e) => setFilterItem(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '0.95rem' }}
            />
          </div>

          <button 
            onClick={() => { setFilterBodega(""); setFilterZona(""); setFilterPasillo(""); setFilterItem(""); }}
            style={{ 
              padding: '8px 15px', 
              backgroundColor: '#95a5a6', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer', 
              fontWeight: '600',
              height: '36px'
            }}
          >
            Limpiar Filtros
          </button>
        </div>

        {loading ? (
          <div className="loading-container">Cargando ubicaciones...</div>
        ) : (
          <div className="reconteo-list">
            {ubicaciones.length > 0 ? (
              ubicaciones.map((item, idx) => (
                <div key={idx} className="reconteo-card">
                  <div className="card-header">
                    <span className="card-badge">{item.total_diferencias} Items con Diferencia</span>
                  </div>
                  <div className="card-body">
                    <h3>Ubicación: {item.ubicacion.numero}</h3>
                    <p>
                      {item.ubicacion.pasillo?.zona?.bodega?.nombre} / 
                      {item.ubicacion.pasillo?.zona?.nombre} / 
                      Pasillo {item.ubicacion.pasillo?.numero}
                    </p>
                    
                    <div className="diff-summary">
                      {item.diferencias.slice(0, 3).map((diff, i) => (
                        <div key={i} className="diff-item">
                          <span>{diff.item?.descripcion?.substring(0, 25)}...</span>
                          {/* <strong>Diff: {Math.abs(diff.diferencia)}</strong> */}
                        </div>
                      ))}
                      {item.diferencias.length > 3 && (
                        <div style={{textAlign:'center', fontSize:'0.8rem', color:'#666'}}>
                          + {item.diferencias.length - 3} más...
                        </div>
                      )}
                    </div>

                    <button 
                      className="btn-recontar"
                      onClick={() => handleStartRecount(item)}
                    >
                      📝 Iniciar Reconteo (3ro)
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <h3>✅ Todo en orden</h3>
                <p>No hay ubicaciones con diferencias pendientes de reconteo.</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // 2. VISTA DE RECONTEO (PDA View)
  if (viewMode === 'recount' && activeRecount) {
    return (
      <div className="recount-view">
        <div className="recount-view-header">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <h3>Reconteo: {activeRecount.ubicacion.numero}</h3>
            <button 
              onClick={() => setViewMode('list')} 
              style={{background:'transparent', border:'1px solid white', color:'white', borderRadius:'4px', padding:'4px 8px'}}
            >
              Salir
            </button>
          </div>
          <p>
            {activeRecount.ubicacion.pasillo?.zona?.bodega?.nombre} - {activeRecount.ubicacion.pasillo?.zona?.nombre}
          </p>
        </div>

        {/* --- BARRA DE ESCANEO (PDA / Manual) --- */}
        <div className="scan-bar-container" style={{ padding: '10px', background: '#34495e', display: 'flex', gap: '10px' }}>
            <form onSubmit={handleBarcodeScan} style={{ flex: 1, display: 'flex' }}>
                <input
                    ref={barcodeInputRef}
                    type="text"
                    className="pda-scan-input"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '4px',
                        border: 'none',
                        fontSize: '1rem'
                    }}
                    autoComplete="off"
                />
                
                <button 
                    type="button" 
                    onClick={() => setIsScanning(true)}
                    style={{
                        marginLeft: '5px',
                        padding: '0 12px',
                        borderRadius: '4px',
                        border: '1px solid #fff',
                        background: 'transparent',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <FaCamera size={18} />
                </button>

                <button type="submit" className="btn-scan-submit" style={{
                    marginLeft: '5px',
                    padding: '0 15px',
                    borderRadius: '4px',
                    border: 'none',
                    background: '#27ae60',
                    color: 'white',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                }}>
                    OK
                </button>
            </form>
        </div>

        {/* --- COMPONENTE DE ESCANER DE CAMARA --- */}
        <EscanerBarras 
            isScanning={isScanning} 
            setIsScanning={setIsScanning} 
            onScan={handleStableScan} 
        />

        <div className="recount-items-list">
          {activeRecount.diferencias.map((diff, idx) => {
            // Verificar estado de este item
            // Usamos String() para asegurar comparación correcta entre tipos (number vs string)
            const records = recountedItems.filter(r => {
              // 1. Match por ID
              const rId = r.item_id || r.producto_id || r.id_item || (r.item && r.item.id);
              if (String(rId) === String(diff.item_id)) return true;

              // 2. Match por Código de Barras (Fallback)
              const diffBarcode = diff.item?.codigo || diff.item?.codigo_barra;
              const rBarcode = r.item?.codigo || r.item?.codigo_barra;
              if (diffBarcode && rBarcode && String(diffBarcode) === String(rBarcode)) return true;

              return false;
            });
            const qty = records.reduce((sum, r) => sum + Number(r.cantidad), 0);
            const isCounted = records.length > 0;

            // Debug log para ver por qué no hace match
            if (idx === 0) console.log('Render Check:', { 
                diffId: diff.item_id, 
                diffBarcode: diff.item?.codigo || diff.item?.codigo_barra,
                recountedCount: recountedItems.length,
                matchFound: isCounted,
                firstRecountItem: recountedItems[0] ? JSON.stringify(recountedItems[0]) : 'N/A'
            });

            return (
              <div 
                key={idx} 
                className={`recount-item-row ${isCounted ? 'completed' : ''}`}
                onClick={() => {
                   // Bloqueo de click manual
                   toast.info("⚠️ Debe escanear el producto para registrar el conteo.");
                }}
                style={{ opacity: isCounted ? 0.7 : 1, cursor: 'not-allowed' }}
              >
                <div className="recount-item-info">
                  <span className="item-desc">{diff.item?.descripcion}</span>
                  <span className="item-code">{diff.item?.codigo || diff.item?.codigo_barra}</span>
                </div>
                
                <div className="recount-status">
                  {isCounted ? (
                    <div style={{textAlign:'right'}}>
                      <span style={{display:'block', fontSize:'1.2rem', fontWeight:'bold', color:'#27ae60'}}>
                        {qty}
                      </span>
                      <small style={{fontSize:'0.7rem', color:'#27ae60'}}>REGISTRADO</small>
                    </div>
                  ) : (
                    <FaEdit color="#bdc3c7" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="recount-footer">
          <button className="btn-finish" onClick={handleFinishRecount}>
            Finalizar Reconteo
          </button>
        </div>

        {/* MODAL DE CANTIDAD */}
        {modalOpen && selectedItem && (
          <div className="modal-overlay" onClick={() => !loading && setModalOpen(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-title">
                <FaBoxOpen style={{marginRight:'8px'}} />
                {selectedItem.item?.descripcion}
              </div>
              
              <div className="qty-input-group">
                <label style={{display:'block', marginBottom:'8px', color:'#7f8c8d'}}>
                  Cantidad Encontrada (Real):
                </label>
                <input
                  ref={inputRef}
                  type="number"
                  inputMode="decimal"
                  className="qty-input"
                  value={qtyInput}
                  onChange={(e) => setQtyInput(e.target.value)}
                  onKeyDown={(e) => (e.key === 'Enter' && !loading) && handleSaveQuantity()}
                  placeholder="0"
                  disabled={loading}
                />
              </div>

              <div className="modal-actions">
                <button 
                  className="btn-cancel" 
                  onClick={() => setModalOpen(false)}
                  disabled={loading}
                  style={{ opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
                >
                  Cancelar
                </button>
                <button 
                  className="btn-save" 
                  onClick={handleSaveQuantity}
                  disabled={loading}
                  style={{ 
                    opacity: loading ? 0.7 : 1, 
                    cursor: loading ? 'wait' : 'pointer',
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    justifyContent: 'center'
                  }}
                >
                  {loading && <div style={{
                    width: '16px', 
                    height: '16px', 
                    border: '2px solid white', 
                    borderTop: '2px solid transparent', 
                    borderRadius: '50%', 
                    animation: 'spin 1s linear infinite'
                  }}/>}
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default PanelReconteoDiferencias;

