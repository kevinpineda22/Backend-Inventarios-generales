import React from 'react';
import '../HistorialConteos.css';

const DetalleConteoModal = ({ singleDetail, closeSingleDetail, refreshDetail }) => {
    if (!singleDetail) return null;

    return (
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
                  <span className="hc-detail-value">{singleDetail.loading ? '...' : singleDetail.items.length}</span>
                </div>
              </div>
              
              {singleDetail.loading ? (
                <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'200px', gap:'1rem', color:'#64748b'}}>
                  <div className="hc-loading-spinner" style={{width:'40px', height:'40px'}}></div>
                  <p>Cargando detalles del conteo...</p>
                </div>
              ) : (
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
              )}
            </div>
          </div>
        </div>
    );
};

export default DetalleConteoModal;