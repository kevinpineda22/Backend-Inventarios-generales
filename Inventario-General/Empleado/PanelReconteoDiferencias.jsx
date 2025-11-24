import { useState, useEffect, useRef } from 'react';
import './PanelReconteoDiferencias.css';
import { inventarioService } from '../../services/inventarioService';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { FaCheckCircle, FaEdit, FaBoxOpen } from 'react-icons/fa';

const PanelReconteoDiferencias = ({ companiaId, usuarioId, usuarioNombre, usuarioEmail, onCerrar }) => {
  const [ubicaciones, setUbicaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  
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

  useEffect(() => {
    cargarUbicaciones();
  }, [companiaId]);

  // Foco automático al input del modal
  useEffect(() => {
    if (modalOpen && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 100);
    }
  }, [modalOpen]);

  const cargarUbicaciones = async () => {
    try {
      setLoading(true);
      const data = await inventarioService.obtenerUbicacionesConDiferenciasPendientes(companiaId);
      setUbicaciones(data || []);
    } catch (error) {
      console.error('Error al cargar diferencias:', error);
      toast.error('Error al cargar ubicaciones con diferencias');
    } finally {
      setLoading(false);
    }
  };

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

  const handleItemClick = (diffItem) => {
    // Buscar si ya tenemos un conteo para este item
    // diffItem viene de la lista de diferencias (item maestro)
    // recountedItems viene del backend (conteo_items)
    
    // Calcular cantidad actual registrada
    const currentRecords = recountedItems.filter(r => {
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
  };

  const handleSaveQuantity = async () => {
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
            <p style={{margin:0, color:'#666'}}>Ubicaciones con discrepancias entre Conteo 1 y 2</p>
          </div>
          <button onClick={onCerrar} className="btn-back">
            Volver al Panel
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
                          <strong>Diff: {Math.abs(diff.diferencia)}</strong>
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
                onClick={() => handleItemClick(diff)}
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
          <div className="modal-overlay" onClick={() => setModalOpen(false)}>
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
                  className="qty-input"
                  value={qtyInput}
                  onChange={(e) => setQtyInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveQuantity()}
                  placeholder="0"
                />
              </div>

              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setModalOpen(false)}>
                  Cancelar
                </button>
                <button className="btn-save" onClick={handleSaveQuantity}>
                  Guardar
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

