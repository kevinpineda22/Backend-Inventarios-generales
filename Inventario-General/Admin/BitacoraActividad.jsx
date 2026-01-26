import React, { useMemo } from 'react';
import { ScrollText, X, Clock, User, MapPin } from 'lucide-react';
import './BitacoraActividad.css';

const BitacoraActividad = ({ isOpen, onClose, conteos }) => {
  
  const activities = useMemo(() => {
    if (!conteos) return [];

    const events = [];

    conteos.forEach(c => {
      // Evento de Inicio
      if (c.fecha_inicio) {
        events.push({
          id: `${c.id}-start`,
          type: 'start',
          timestamp: new Date(c.fecha_inicio),
          title: `Inicio de Conteo #${c.tipo_conteo}`,
          desc: `Ubicación: ${c.zona} - ${c.pasillo} - ${c.ubicacion}`,
          user: c.usuario_nombre,
          location: `${c.zona} / ${c.pasillo}`
        });
      }

      // Evento de Finalización
      if (c.estado === 'finalizado' && c.fecha_fin) {
        let title = `Fin de Conteo #${c.tipo_conteo}`;
        let type = 'finish';
        
        if (c.tipo_conteo === 3) {
          title = 'Reconteo Finalizado';
          type = 'alert';
        } else if (c.tipo_conteo === 4) {
          title = 'Ajuste Final Generado';
          type = 'auto';
        }

        events.push({
          id: `${c.id}-end`,
          type: type,
          timestamp: new Date(c.fecha_fin),
          title: title,
          desc: `Total items: ${c.total_items || 0}`,
          user: c.usuario_nombre,
          location: `${c.zona} / ${c.pasillo}`
        });
      }
    });

    // Ordenar por fecha descendente (más reciente primero)
    return events.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50); // Limitar a 50 eventos
  }, [conteos]);

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date) => {
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return 'Hoy';
    }
    return date.toLocaleDateString();
  };

  return (
    <>
      <div className={`bitacora-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <div className={`bitacora-panel ${isOpen ? 'open' : ''}`}>
        <div className="bitacora-header">
          <h3>
            <ScrollText size={20} color="#2563eb" />
            Bitácora en Vivo
          </h3>
          <button className="bitacora-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="bitacora-content">
          {activities.length === 0 ? (
            <div className="bitacora-empty">
              No hay actividad registrada recientemente.
            </div>
          ) : (
            <div className="bitacora-timeline">
              {activities.map((act, idx) => {
                const showDateHeader = idx === 0 || 
                  activities[idx-1].timestamp.toDateString() !== act.timestamp.toDateString();

                return (
                  <React.Fragment key={act.id}>
                    {showDateHeader && (
                      <div style={{
                        fontSize: '0.8rem', 
                        fontWeight: 'bold', 
                        color: '#94a3b8', 
                        margin: '1rem 0 0.5rem -1.5rem',
                        background: '#f1f5f9',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        width: 'fit-content'
                      }}>
                        {formatDate(act.timestamp)}
                      </div>
                    )}
                    <div className="bitacora-item">
                      <div className={`bitacora-dot ${act.type}`} />
                      <div className="bitacora-time">
                        <Clock size={12} style={{marginRight:4, verticalAlign:'text-top'}}/>
                        {formatTime(act.timestamp)}
                      </div>
                      <div className="bitacora-card">
                        <div className="bitacora-title">{act.title}</div>
                        <div className="bitacora-desc">
                          <MapPin size={12} style={{marginRight:4, color:'#94a3b8'}}/>
                          {act.desc}
                        </div>
                        {act.user && (
                          <div className="bitacora-user">
                            <User size={12} />
                            {act.user.split('@')[0]}
                          </div>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default BitacoraActividad;
