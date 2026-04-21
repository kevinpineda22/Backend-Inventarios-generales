import { useState, useEffect, useRef, useCallback } from 'react';
import './ReconteoSiesaEmpleado.css';
import { inventarioGeneralService as inventarioService } from '../../services/inventarioGeneralService';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { FaArrowLeft, FaCamera, FaCheck } from 'react-icons/fa';
import EscanerBarras from '../../pages/DesarrolloSurtido_API/EscanerBarras';

const ReconteoSiesaEmpleado = ({ usuarioId, usuarioNombre, usuarioEmail, onCerrar }) => {
  const [loading, setLoading] = useState(true);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [totalItems, setTotalItems] = useState(0);

  // Vista activa
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'recount'
  const [activeUbicacion, setActiveUbicacion] = useState(null);
  const [conteoId, setConteoId] = useState(null);
  const [reconteoItems, setReconteoItems] = useState([]);

  // Filtro de Fecha (Para no mostrar todo el historial de corrido)
  const getTodayISO = () => {
    const tzOffset = new Date().getTimezoneOffset() * 60000;
    return new Date(Date.now() - tzOffset).toISOString().split('T')[0];
  };
  const [filterDate, setFilterDate] = useState(getTodayISO());

  // Editing
  const [editingItemId, setEditingItemId] = useState(null);
  const [qtyInputs, setQtyInputs] = useState({});
  const [savedItems, setSavedItems] = useState(new Set());
  const [savingItem, setSavingItem] = useState(null);

  // Scanner
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const barcodeInputRef = useRef(null);

  // Stable scan handler ref
  const handleScanRef = useRef(null);

  useEffect(() => {
    cargarUbicaciones();
  }, [usuarioEmail]);

  useEffect(() => {
    handleScanRef.current = handleBarcodeScan;
  });

  const stableScanHandler = useCallback((code) => {
    if (handleScanRef.current) handleScanRef.current(code);
  }, []);

  const cargarUbicaciones = async () => {
    try {
      setLoading(true);
      const result = await inventarioService.obtenerReconteosSiesaEmpleado(usuarioEmail);
      if (result) {
        setUbicaciones(result.data || result || []);
        setTotalItems(result.total_items || 0);
      }
    } catch (error) {
      console.error('Error cargando ubicaciones:', error);
      toast.error('Error al cargar reconteos asignados');
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // SELECCIONAR UBICACIÓN
  // =====================================================

  const handleSelectUbicacion = async (ub) => {
    if (ub.estado_general === 'finalizado' || ub.estado_general === 'aprobado') {
      toast.info('Esta ubicación ya está finalizada');
      return;
    }
    setActiveUbicacion(ub);
    // Iniciar reconteo directamente sin pedir clave
    try {
      setLoading(true);
      const result = await inventarioService.iniciarReconteoSiesa({
        ubicacionId: ub.ubicacion_id,
        usuarioId,
        usuarioEmail
      });
      if (result.success) {
        setConteoId(result.data.conteo_id);
        const items = result.data.items || [];
        setReconteoItems(items);
        const preQty = {};
        const preSaved = new Set();
        items.forEach(item => {
          if (item.cantidad_reconteo !== null && item.cantidad_reconteo !== undefined) {
            preQty[item.id] = String(item.cantidad_reconteo);
            preSaved.add(item.id);
          }
        });
        setQtyInputs(preQty);
        setSavedItems(preSaved);
        setViewMode('recount');
        toast.success('Reconteo iniciado');
      } else {
        toast.error(result.message || 'Error al iniciar reconteo');
        setActiveUbicacion(null);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Error al iniciar reconteo');
      setActiveUbicacion(null);
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // GUARDAR CANTIDAD
  // =====================================================

  const handleGuardarCantidad = async (item) => {
    const qty = qtyInputs[item.id];
    if (qty === undefined || qty === '') {
      toast.error('Ingrese una cantidad');
      return;
    }

    const cantidad = parseInt(qty, 10);
    if (isNaN(cantidad) || cantidad < 0) {
      toast.error('Cantidad inválida');
      return;
    }

    try {
      setSavingItem(item.id);
      await inventarioService.registrarCantidadReconteoSiesa(item.id, {
        cantidad,
        conteoId,
        itemId: item.item_id,
        usuarioEmail
      });

      setSavedItems(prev => new Set(prev).add(item.id));
      setEditingItemId(null);
      toast.success(`${item.item_codigo}: cantidad ${cantidad} guardada`);
    } catch (error) {
      toast.error(error.message || 'Error al guardar');
    } finally {
      setSavingItem(null);
    }
  };

  // =====================================================
  // SCANNER
  // =====================================================

  const handleBarcodeScan = async (code) => {
    if (!code) return;
    const cleanCode = String(code).trim();

    // 1. Buscar por item_codigo (SKU directo)
    let found = reconteoItems.find(item =>
      String(item.item_codigo).trim() === cleanCode
    );

    // 2. Si no coincide por SKU, buscar por código de barras en el backend
    if (!found && reconteoItems.length > 0) {
      try {
        const companiaId = reconteoItems[0].compania_id;
        if (companiaId) {
          const result = await inventarioService.buscarItemPorCodigoBarra(cleanCode, companiaId);
          if (result && result.success && result.data) {
            const itemData = result.data;
            // Intentar coincidir por item_id o por codigo del item encontrado
            found = reconteoItems.find(item =>
              item.item_id === itemData.id ||
              String(item.item_codigo).trim() === String(itemData.codigo || itemData.item || '').trim()
            );
          }
        }
      } catch (err) {
        // Si falla la búsqueda por barcode, continuamos con el resultado "no encontrado"
        console.warn('Error buscando por código de barras:', err);
      }
    }

    if (found) {
      setEditingItemId(found.id);
      toast.info(`Item encontrado: ${found.item_codigo}`);
      // Scroll to item
      setTimeout(() => {
        const el = document.getElementById(`rse-item-${found.id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    } else {
      toast.warning(`Código "${cleanCode}" no encontrado en los items a recontar`);
    }

    setBarcodeInput('');
  };

  const handleBarcodeKeyDown = (e) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      handleBarcodeScan(barcodeInput);
    }
  };

  // =====================================================
  // FINALIZAR
  // =====================================================

  const handleFinalizar = async () => {
    const sinContar = reconteoItems.filter(item => !savedItems.has(item.id));
    if (sinContar.length > 0) {
      const { isConfirmed } = await Swal.fire({
        title: 'Items sin recontar',
        html: `Hay <strong>${sinContar.length}</strong> items que aún no han sido recontados:<br><br>${sinContar.slice(0, 5).map(i => `• ${i.item_codigo}`).join('<br>')}${sinContar.length > 5 ? '<br>...' : ''}<br><br>¿Desea finalizar de todas formas?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Finalizar igual',
        cancelButtonText: 'Seguir contando'
      });
      if (!isConfirmed) return;
    }

    try {
      setLoading(true);
      const result = await inventarioService.finalizarReconteoSiesa({
        ubicacionId: activeUbicacion.ubicacion_id,
        conteoId
      });

      if (result.success) {
        Swal.fire('Finalizado', 'El reconteo de esta ubicación ha sido completado.', 'success');
        setViewMode('list');
        setActiveUbicacion(null);
        setConteoId(null);
        setReconteoItems([]);
        setSavedItems(new Set());
        setQtyInputs({});
        cargarUbicaciones();
      } else {
        Swal.fire('Error', result.message, 'error');
      }
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // HELPER
  // =====================================================

  const getProgress = () => {
    if (reconteoItems.length === 0) return 0;
    return Math.round((savedItems.size / reconteoItems.length) * 100);
  };

  const getUbicacionProgress = (ub) => {
    if (ub.total_items === 0) return 0;
    return Math.round((ub.items_completados / ub.total_items) * 100);
  };

  // =====================================================
  // RENDER: LIST VIEW
  // =====================================================

  if (loading && viewMode === 'list') {
    return (
      <div className="rse-container">
        <div className="rse-header">
          <div>
            <h2>📋 Reconteos SIESA</h2>
            <div className="rse-header-info">
              <span>👤 {usuarioNombre || usuarioEmail}</span>
            </div>
          </div>
          <button className="rse-btn-back" onClick={onCerrar}>
            <FaArrowLeft /> Volver
          </button>
        </div>
        <div className="rse-loading"><div className="rse-spinner"></div><p>Cargando reconteos asignados...</p></div>
      </div>
    );
  }

  // =====================================================
  // RENDER: RECOUNT VIEW
  // =====================================================

  if (viewMode === 'recount' && activeUbicacion) {
    const progress = getProgress();

    return (
      <div className="rse-container">
        <div className="rse-header">
          <div>
            <h2>🔄 Reconteo SIESA</h2>
            <div className="rse-header-info">
              <span>{activeUbicacion.zona_nombre} / {activeUbicacion.pasillo_nombre} / {activeUbicacion.ubicacion_nombre}</span>
            </div>
          </div>
          <button className="rse-btn-back" onClick={() => {
            Swal.fire({
              title: '¿Salir del reconteo?',
              text: 'El progreso guardado se mantendrá.',
              icon: 'question',
              showCancelButton: true,
              confirmButtonText: 'Salir',
              cancelButtonText: 'Continuar'
            }).then(r => {
              if (r.isConfirmed) {
                setViewMode('list');
                setActiveUbicacion(null);
                setConteoId(null);
                cargarUbicaciones();
              }
            });
          }}>
            <FaArrowLeft /> Salir
          </button>
        </div>

        <div className="rse-recount-panel">
          {/* Progress */}
          <div className="rse-progress-container">
            <div className="rse-progress-bar">
              <div className="rse-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="rse-progress-label">
              <span>{savedItems.size} de {reconteoItems.length} items</span>
              <span>{progress}%</span>
            </div>
          </div>

          {/* Scanner */}
          <div className="rse-scanner-section">
            <div className="rse-scanner-input-group">
              <input
                ref={barcodeInputRef}
                type="text"
                className="rse-scanner-input"
                placeholder="Escanee o escriba el código del item..."
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                onKeyDown={handleBarcodeKeyDown}
                autoFocus
              />
              <button
                className="rse-scanner-btn rse-scanner-btn-camera"
                onClick={() => setIsScanning(!isScanning)}
              >
                <FaCamera /> {isScanning ? 'Cerrar' : 'Cámara'}
              </button>
            </div>
          </div>

          {/* Componente de escáner de cámara */}
          <EscanerBarras
            isScanning={isScanning}
            setIsScanning={setIsScanning}
            onScan={stableScanHandler}
          />

          {/* Items list */}
          <div className="rse-items-list">
            {reconteoItems.map(item => {
              const isSaved = savedItems.has(item.id);
              const isActive = editingItemId === item.id;
              const isSaving = savingItem === item.id;
              const isUnlocked = isActive || isSaved;

              return (
                <div
                  key={item.id}
                  id={`rse-item-${item.id}`}
                  className={`rse-item-row ${isSaved ? 'done' : ''} ${isActive ? 'active' : ''}`}
                >
                  <div className="rse-item-info">
                    <div className="rse-item-desc" style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                      {isSaved && <FaCheck style={{ color: '#16a34a', marginRight: '6px' }} />}
                      {item.item_descripcion || 'Sin descripción'}
                    </div>
                    <div className="rse-item-code" style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Código: {item.item_codigo}
                    </div>
                  </div>

                  <div className="rse-qty-group" onClick={e => e.stopPropagation()}>
                    {!isUnlocked ? (
                      <span style={{ fontSize: '0.78rem', color: '#94a3b8', textAlign: 'center' }}>🔒 Escanee el item</span>
                    ) : (
                      <>
                        <input
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          className={`rse-qty-input ${isSaved ? 'saved' : ''}`}
                          placeholder="Cantidad"
                          value={qtyInputs[item.id] || ''}
                          onChange={e => setQtyInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                          onKeyPress={e => e.key === 'Enter' && handleGuardarCantidad(item)}
                          min={0}
                          disabled={isSaving}
                          autoFocus={isActive && !isSaved}
                        />
                        <button
                          className={`rse-btn-save-qty ${isSaved ? 'saved' : ''}`}
                          onClick={() => handleGuardarCantidad(item)}
                          disabled={isSaving}
                        >
                          {isSaving ? '...' : isSaved ? '✓' : 'OK'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Finalize */}
          <div className="rse-finalize-section">
            <span style={{ fontSize: '0.9rem', color: '#374151' }}>
              {savedItems.size === reconteoItems.length
                ? '✅ Todos los items han sido recontados'
                : `⏳ Faltan ${reconteoItems.length - savedItems.size} items`}
            </span>
            <button
              className="rse-btn-finalize"
              onClick={handleFinalizar}
              disabled={loading}
            >
              {loading ? '⏳ Finalizando...' : '📤 Finalizar Reconteo'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =====================================================
  // RENDER: DEFAULT LIST
  // =====================================================

  const filteredUbicaciones = ubicaciones.filter(ub => {
    if (!filterDate) return true;
    // Si la ubicación tiene fecha base desde el backend la utilizamos (más preciso para no mezclar conteos viejos con nuevos en la misma ubicación)
    if (ub.fecha_asignacion) {
      return ub.fecha_asignacion === filterDate;
    }
    const itemDate = ub.items?.[0]?.created_at;
    if (itemDate) {
      // Comparar solo la parte de la fecha YYYY-MM-DD
      return itemDate.split('T')[0] === filterDate;
    }
    return false;
  });

  return (
    <div className="rse-container">
      <div className="rse-header">
        <div>
          <h2>📋 Reconteos SIESA Asignados</h2>
          <div className="rse-header-info">
            <span>👤 {usuarioNombre || usuarioEmail}</span>
            <span>|</span>
            <span>{filteredUbicaciones.length} ubicaciones filtradas</span>
          </div>
        </div>
        <button className="rse-btn-back" onClick={onCerrar}>
          <FaArrowLeft /> Volver
        </button>
      </div>

      <div className="rse-filters" style={{ margin: '15px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <label style={{ fontWeight: 'bold', color: '#475569', fontSize: '0.9rem' }}>Filtro de fecha:</label>
        <input 
          type="date"
          className="rse-date-filter"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
        />
        <button 
          className="rse-btn-clear" 
          onClick={() => setFilterDate('')}
          style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#e2e8f0', color: '#475569', cursor: 'pointer' }}
          title="Ver todo el historial"
        >
          Ver Todos
        </button>
        {filterDate !== getTodayISO() && (
           <button 
             onClick={() => setFilterDate(getTodayISO())}
             style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #bbf7d0', background: '#dcfce3', color: '#166534', cursor: 'pointer', fontSize: '0.85rem' }}
           >
             Ir a Hoy
           </button>
        )}
      </div>

      {filteredUbicaciones.length === 0 ? (
        <div className="rse-empty-state">
          <div className="icon">📭</div>
          <h3>No tiene reconteos para esta fecha</h3>
          <p>Intente limpiar el filtro para ver fechas anteriores o pedir nuevas asignaciones.</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '10px' }}>
            <button
              onClick={() => setFilterDate('')}
              style={{ padding: '8px 16px', background: '#64748b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              🗓 Ver Todo
            </button>
            <button
              onClick={cargarUbicaciones}
              style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              🔄 Refrescar
            </button>
          </div>
        </div>
      ) : (
        <div className="rse-ubicacion-list">
          {filteredUbicaciones.map((ub, idx) => {
            const prog = getUbicacionProgress(ub);
            const isFinished = ub.estado_general === 'finalizado' || ub.estado_general === 'aprobado';

            return (
              <div
                key={ub.ubicacion_id || idx}
                className={`rse-ubicacion-card ${isFinished ? '' : 'active'}`}
                onClick={() => handleSelectUbicacion(ub)}
                style={{ cursor: isFinished ? 'default' : 'pointer' }}
              >
                <div className="rse-ubicacion-top">
                  <div className="rse-ubicacion-info">
                    <span className="rse-ubicacion-path">
                      {ub.zona_nombre} / {ub.pasillo_nombre}
                    </span>
                    <span className="rse-ubicacion-name">
                      📍 {ub.ubicacion_nombre}
                    </span>
                  </div>

                  <div className="rse-ubicacion-meta">
                    <span className="rse-ubicacion-count">
                      {ub.items_completados}/{ub.total_items} items
                    </span>
                    <div className="rse-progress-mini">
                      <div className="rse-progress-mini-fill" style={{ width: `${prog}%` }} />
                    </div>
                    <span className={`rse-badge rse-badge-${ub.estado_general}`}>
                      {ub.estado_general === 'asignado' && '👤 Asignado'}
                      {ub.estado_general === 'en_progreso' && '🔄 En progreso'}
                      {ub.estado_general === 'finalizado' && '✅ Finalizado'}
                      {ub.estado_general === 'aprobado' && '✔ Aprobado'}
                      {ub.estado_general === 'pendiente' && '⏳ Pendiente'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ReconteoSiesaEmpleado;
