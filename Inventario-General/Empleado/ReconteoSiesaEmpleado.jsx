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
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'clave' | 'recount'
  const [activeUbicacion, setActiveUbicacion] = useState(null);
  const [conteoId, setConteoId] = useState(null);
  const [reconteoItems, setReconteoItems] = useState([]);

  // Editing
  const [editingItemId, setEditingItemId] = useState(null);
  const [qtyInputs, setQtyInputs] = useState({});
  const [savedItems, setSavedItems] = useState(new Set());
  const [savingItem, setSavingItem] = useState(null);

  // Scanner
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const barcodeInputRef = useRef(null);

  // Clave
  const [claveInput, setClaveInput] = useState('');

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

  const handleSelectUbicacion = (ub) => {
    if (ub.estado_general === 'finalizado' || ub.estado_general === 'aprobado') {
      toast.info('Esta ubicación ya está finalizada');
      return;
    }
    setActiveUbicacion(ub);
    setViewMode('clave');
    setClaveInput('');
  };

  // =====================================================
  // VERIFICAR CLAVE
  // =====================================================

  const handleVerificarClave = async () => {
    if (!claveInput.trim()) {
      toast.error('Ingrese la clave de la ubicación');
      return;
    }

    try {
      setLoading(true);

      // Iniciar el reconteo (esto crea el conteo tipo 5 en backend)
      const result = await inventarioService.iniciarReconteoSiesa({
        ubicacionId: activeUbicacion.ubicacion_id,
        usuarioId,
        usuarioEmail,
        clave: claveInput.trim()
      });

      if (result.success) {
        setConteoId(result.data.conteo_id);
        const items = result.data.items || [];
        setReconteoItems(items);

        // Pre-populate qty inputs with existing recount values
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
      }
    } catch (error) {
      console.error('Error:', error);
      // If clave is wrong, the backend should return an error
      toast.error(error.message || 'Error al iniciar reconteo. Verifique la clave.');
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

  const handleBarcodeScan = (code) => {
    if (!code) return;
    const cleanCode = String(code).trim();

    // Find matching item
    const found = reconteoItems.find(item =>
      String(item.item_codigo).trim() === cleanCode
    );

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
  // RENDER: CLAVE VIEW
  // =====================================================

  if (viewMode === 'clave' && activeUbicacion) {
    return (
      <div className="rse-container">
        <div className="rse-header">
          <div>
            <h2>📋 Verificación de Ubicación</h2>
            <div className="rse-header-info">
              <span>{activeUbicacion.zona_nombre} / {activeUbicacion.pasillo_nombre} / {activeUbicacion.ubicacion_nombre}</span>
            </div>
          </div>
          <button className="rse-btn-back" onClick={() => { setViewMode('list'); setActiveUbicacion(null); }}>
            <FaArrowLeft /> Volver
          </button>
        </div>

        <div className="rse-clave-panel">
          <h4>🔐 Ingrese la clave de la ubicación</h4>
          <p>Para verificar que se encuentra físicamente en la ubicación correcta.</p>
          <div>
            <input
              type="text"
              className="rse-clave-input"
              value={claveInput}
              onChange={e => setClaveInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleVerificarClave()}
              placeholder="Clave..."
              autoFocus
            />
            <button className="rse-clave-btn" onClick={handleVerificarClave} disabled={loading}>
              {loading ? '...' : 'Verificar e Iniciar'}
            </button>
          </div>
        </div>
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
              {EscanerBarras && (
                <button
                  className="rse-scanner-btn rse-scanner-btn-camera"
                  onClick={() => setIsScanning(!isScanning)}
                >
                  <FaCamera /> {isScanning ? 'Cerrar' : 'Cámara'}
                </button>
              )}
            </div>

            {isScanning && EscanerBarras && (
              <div style={{ marginTop: '10px', borderRadius: '8px', overflow: 'hidden' }}>
                <EscanerBarras onDetected={stableScanHandler} />
              </div>
            )}
          </div>

          {/* Items list */}
          <div className="rse-items-list">
            {reconteoItems.map(item => {
              const isSaved = savedItems.has(item.id);
              const isEditing = editingItemId === item.id;
              const isSaving = savingItem === item.id;

              return (
                <div
                  key={item.id}
                  id={`rse-item-${item.id}`}
                  className={`rse-item-row ${isSaved ? 'done' : ''}`}
                  onClick={() => !isSaving && setEditingItemId(item.id)}
                >
                  <div className="rse-item-info">
                    <div className="rse-item-code">
                      {isSaved && <FaCheck style={{ color: '#16a34a', marginRight: '6px' }} />}
                      {item.item_codigo}
                    </div>
                    <div className="rse-item-desc">{item.item_descripcion}</div>
                  </div>

                  <div className="rse-item-diff">
                    <div className="rse-item-diff-label">Físico / SIESA</div>
                    <div>
                      <span style={{ fontWeight: 600 }}>{item.cantidad_fisica}</span>
                      <span style={{ color: '#94a3b8', margin: '0 4px' }}>/</span>
                      <span style={{ fontWeight: 600 }}>{item.cantidad_siesa}</span>
                    </div>
                    <div className={`rse-item-diff-value ${item.diferencia > 0 ? 'positive' : 'negative'}`}>
                      {item.diferencia > 0 ? `+${item.diferencia}` : item.diferencia}
                    </div>
                  </div>

                  <div className="rse-qty-group" onClick={e => e.stopPropagation()}>
                    <input
                      type="number"
                      className={`rse-qty-input ${isSaved ? 'saved' : ''}`}
                      placeholder="Qty"
                      value={qtyInputs[item.id] || ''}
                      onChange={e => setQtyInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                      onFocus={() => setEditingItemId(item.id)}
                      onKeyPress={e => e.key === 'Enter' && handleGuardarCantidad(item)}
                      min={0}
                      disabled={isSaving}
                    />
                    <button
                      className={`rse-btn-save-qty ${isSaved ? 'saved' : ''}`}
                      onClick={() => handleGuardarCantidad(item)}
                      disabled={isSaving}
                    >
                      {isSaving ? '...' : isSaved ? '✓' : 'OK'}
                    </button>
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

  return (
    <div className="rse-container">
      <div className="rse-header">
        <div>
          <h2>📋 Reconteos SIESA Asignados</h2>
          <div className="rse-header-info">
            <span>👤 {usuarioNombre || usuarioEmail}</span>
            <span>|</span>
            <span>{ubicaciones.length} ubicaciones · {totalItems} items</span>
          </div>
        </div>
        <button className="rse-btn-back" onClick={onCerrar}>
          <FaArrowLeft /> Volver
        </button>
      </div>

      {ubicaciones.length === 0 ? (
        <div className="rse-empty-state">
          <div className="icon">📭</div>
          <h3>No tiene reconteos asignados</h3>
          <p>El administrador debe asignarle ubicaciones para recontar.</p>
          <button
            onClick={cargarUbicaciones}
            style={{ marginTop: '10px', padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            🔄 Refrescar
          </button>
        </div>
      ) : (
        <div className="rse-ubicacion-list">
          {ubicaciones.map((ub, idx) => {
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
