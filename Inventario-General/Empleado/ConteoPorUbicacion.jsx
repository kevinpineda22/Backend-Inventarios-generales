import { useState, useEffect } from 'react';
import './ConteoPorUbicacion.css';

const ConteoPorUbicacion = ({ ubicacion, usuarioId, usuarioNombre, onCerrar }) => {
  const [items, setItems] = useState([]);
  const [conteoActual, setConteoActual] = useState([]);
  const [codigoBarraInput, setCodigoBarraInput] = useState('');
  const [cantidadInput, setCantidadInput] = useState('1');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [conteoIniciado, setConteoIniciado] = useState(false);
  const [conteoId, setConteoId] = useState(null);

  useEffect(() => {
    iniciarNuevoConteo();
  }, []);

  const iniciarNuevoConteo = async () => {
    try {
      setLoading(true);
      const nuevoConteo = await inventarioGeneralService.iniciarConteo({
        ubicacion_id: ubicacion.id,
        usuario_id: usuarioId,
        tipo_conteo: ubicacion.conteo_actual + 1 // 1, 2, o 3
      });
      
      setConteoId(nuevoConteo.id);
      setConteoIniciado(true);
      
      // Si es conteo de diferencias, cargar items con diferencias
      if (ubicacion.conteo_actual === 2) {
        cargarItemsConDiferencias();
      }
    } catch (error) {
      console.error('Error al iniciar conteo:', error);
      setMessage({ type: 'error', text: 'Error al iniciar el conteo' });
    } finally {
      setLoading(false);
    }
  };

  const cargarItemsConDiferencias = async () => {
    try {
      const itemsDiferencias = await inventarioGeneralService.obtenerItemsConDiferencias(ubicacion.id);
      setItems(itemsDiferencias);
    } catch (error) {
      console.error('Error al cargar items con diferencias:', error);
    }
  };

  const handleAgregarItem = async () => {
    if (!codigoBarraInput.trim()) {
      setMessage({ type: 'error', text: 'Escanea o ingresa un código de barra' });
      return;
    }

    if (!cantidadInput || parseInt(cantidadInput) <= 0) {
      setMessage({ type: 'error', text: 'Ingresa una cantidad válida' });
      return;
    }

    try {
      setLoading(true);
      
      // Buscar item en la base de datos
      const item = await inventarioGeneralService.buscarItemPorCodigoBarra(codigoBarraInput);
      
      if (!item) {
        setMessage({ type: 'error', text: 'Item no encontrado en la base de datos' });
        setLoading(false);
        return;
      }

      // Verificar si ya existe en el conteo actual
      const itemExistente = conteoActual.find(i => i.codigo_barra === codigoBarraInput);
      
      if (itemExistente) {
        // Actualizar cantidad
        const nuevaCantidad = itemExistente.cantidad + parseInt(cantidadInput);
        await inventarioGeneralService.actualizarItemConteo(
          conteoId,
          item.id,
          nuevaCantidad
        );
        
        setConteoActual(conteoActual.map(i => 
          i.codigo_barra === codigoBarraInput 
            ? { ...i, cantidad: nuevaCantidad }
            : i
        ));
      } else {
        // Agregar nuevo item
        await inventarioGeneralService.agregarItemConteo({
          conteo_id: conteoId,
          item_id: item.id,
          cantidad: parseInt(cantidadInput)
        });
        
        setConteoActual([
          ...conteoActual,
          {
            ...item,
            cantidad: parseInt(cantidadInput)
          }
        ]);
      }

      setMessage({ type: 'success', text: `✓ ${item.descripcion} agregado` });
      
      // Limpiar inputs
      setCodigoBarraInput('');
      setCantidadInput('1');
      
      // Limpiar mensaje después de 2 segundos
      setTimeout(() => setMessage({ type: '', text: '' }), 2000);
    } catch (error) {
      console.error('Error al agregar item:', error);
      setMessage({ type: 'error', text: 'Error al agregar el item' });
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarItem = async (itemId) => {
    if (!window.confirm('¿Eliminar este item del conteo?')) return;

    try {
      setLoading(true);
      await inventarioGeneralService.eliminarItemConteo(conteoId, itemId);
      setConteoActual(conteoActual.filter(i => i.id !== itemId));
      setMessage({ type: 'success', text: 'Item eliminado' });
    } catch (error) {
      console.error('Error al eliminar item:', error);
      setMessage({ type: 'error', text: 'Error al eliminar el item' });
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizarConteo = async () => {
    if (conteoActual.length === 0) {
      if (!window.confirm('No has contado ningún item. ¿Finalizar con conteo vacío?')) {
        return;
      }
    }

    try {
      setLoading(true);
      await inventarioGeneralService.finalizarConteo(conteoId);
      setMessage({ type: 'success', text: 'Conteo finalizado exitosamente' });
      
      setTimeout(() => {
        onCerrar();
      }, 1500);
    } catch (error) {
      console.error('Error al finalizar conteo:', error);
      setMessage({ type: 'error', text: 'Error al finalizar el conteo' });
      setLoading(false);
    }
  };

  const getTipoConteoLabel = () => {
    switch(ubicacion.conteo_actual) {
      case 0: return 'Conteo #1';
      case 1: return 'Conteo #2';
      case 2: return 'Conteo de Diferencias';
      default: return 'Conteo';
    }
  };

  return (
    <div className="conteo-por-ubicacion">
      <div className="conteo-header">
        <div className="conteo-info">
          <h2>{getTipoConteoLabel()}</h2>
          <p className="ubicacion-detalle">
            {ubicacion.bodega} / {ubicacion.zona} / Pasillo {ubicacion.pasillo} / Ubicación #{ubicacion.numero}
          </p>
          <p className="usuario-info">Contador: <strong>{usuarioNombre}</strong></p>
        </div>
        <button onClick={onCerrar} className="btn-back" disabled={loading}>
          ← Volver
        </button>
      </div>

      {/* Formulario de escaneo */}
      <div className="scanner-section">
        <div className="scanner-form">
          <div className="input-group">
            <label>Código de Barra:</label>
            <input
              type="text"
              value={codigoBarraInput}
              onChange={(e) => setCodigoBarraInput(e.target.value)}
              placeholder="Escanea o escribe el código"
              className="scanner-input"
              autoFocus
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAgregarItem();
                }
              }}
              disabled={loading}
            />
          </div>
          
          <div className="input-group">
            <label>Cantidad:</label>
            <input
              type="number"
              value={cantidadInput}
              onChange={(e) => setCantidadInput(e.target.value)}
              min="1"
              className="cantidad-input"
              disabled={loading}
            />
          </div>

          <button 
            onClick={handleAgregarItem} 
            className="btn-agregar"
            disabled={loading}
          >
            ➕ Agregar
          </button>
        </div>

        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}
      </div>

      {/* Items con diferencias (solo para conteo 3) */}
      {ubicacion.conteo_actual === 2 && items.length > 0 && (
        <div className="diferencias-section">
          <h3>⚠️ Items con Diferencias que deben ser recontados:</h3>
          <div className="diferencias-list">
            {items.map((item, idx) => (
              <div key={idx} className="diferencia-item">
                <span className="item-descripcion">{item.descripcion}</span>
                <span className="item-codigo">{item.codigo_barra}</span>
                <span className="diferencia-info">
                  Conteo 1: {item.conteo1} | Conteo 2: {item.conteo2}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de items contados */}
      <div className="conteo-list-section">
        <div className="section-header">
          <h3>Items Contados ({conteoActual.length})</h3>
          <div className="total-items">
            Total Unidades: <strong>{conteoActual.reduce((sum, item) => sum + item.cantidad, 0)}</strong>
          </div>
        </div>

        {conteoActual.length === 0 ? (
          <div className="empty-state">
            <p>No hay items contados aún</p>
            <p className="hint">Escanea o ingresa un código de barra para comenzar</p>
          </div>
        ) : (
          <div className="items-table-container">
            <table className="items-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item</th>
                  <th>Descripción</th>
                  <th>Código Barra</th>
                  <th>Cantidad</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {conteoActual.map((item, idx) => (
                  <tr key={item.id}>
                    <td>{idx + 1}</td>
                    <td>{item.item}</td>
                    <td>{item.descripcion}</td>
                    <td>{item.codigo_barra}</td>
                    <td className="cantidad-cell">{item.cantidad}</td>
                    <td>
                      <button
                        onClick={() => handleEliminarItem(item.id)}
                        className="btn-delete"
                        disabled={loading}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Botón de finalizar */}
      <div className="footer-actions">
        <button 
          onClick={handleFinalizarConteo}
          className="btn-finalizar"
          disabled={loading}
        >
          {loading ? 'Finalizando...' : 'Finalizar Conteo y Cerrar Ubicación'}
        </button>
      </div>
    </div>
  );
};

export default ConteoPorUbicacion;
