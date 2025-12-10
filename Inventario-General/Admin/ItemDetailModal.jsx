import React, { useState, useEffect } from 'react';
import { inventarioGeneralService } from '../../services/inventarioGeneralService';
import './ItemDetailModal.css';

const ItemDetailModal = ({ item, onClose, onNavigate, selectedCompany }) => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (item && selectedCompany) {
      setLoading(true);
      inventarioGeneralService.getItemLocations(item.id, selectedCompany)
        .then(data => {
          setLocations(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [item, selectedCompany]);

  if (!item) return null;

  return (
    <div className="idm-overlay">
      <div className="idm-modal">
        <div className="idm-header">
          <h2>Detalle del Producto</h2>
          <button onClick={onClose} className="idm-close-btn">×</button>
        </div>
        
        <div className="idm-product-info">
          <div className="idm-info-row">
            <strong>Código:</strong> <span>{item.codigo}</span>
          </div>
          <div className="idm-info-row">
            <strong>Descripción:</strong> <span>{item.descripcion}</span>
          </div>
          <div className="idm-info-row">
            <strong>Grupo:</strong> <span>{item.grupo || 'N/A'}</span>
          </div>
        </div>

        <div className="idm-locations-section">
          <h3>Ubicaciones en Inventario</h3>
          {loading ? (
            <div className="idm-loading">Cargando ubicaciones...</div>
          ) : locations.length === 0 ? (
            <div className="idm-empty">Este producto no ha sido contado en ninguna ubicación.</div>
          ) : (
            <div className="idm-table-container">
              <table className="idm-table">
                <thead>
                  <tr>
                    <th>Bodega</th>
                    <th>Zona</th>
                    <th>Pasillo</th>
                    <th>Ubicación</th>
                    <th>Cant.</th>
                    <th>Fecha</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map((loc, idx) => (
                    <tr key={idx}>
                      <td>{loc.bodega}</td>
                      <td>{loc.zona}</td>
                      <td>{loc.pasillo}</td>
                      <td>{loc.ubicacion}</td>
                      <td className="idm-qty">{loc.cantidad}</td>
                      <td>{new Date(loc.fecha).toLocaleDateString()}</td>
                      <td>
                        <button 
                          className="idm-go-btn"
                          onClick={() => onNavigate(loc)}
                        >
                          Ir a ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ItemDetailModal;
