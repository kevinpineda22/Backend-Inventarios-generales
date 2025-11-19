import { useState, useEffect } from 'react';
import { inventarioGeneralService } from '../../../services/inventarioGeneralService';
import * as XLSX from 'xlsx';
import './HistorialConteos.css';

const HistorialConteos = () => {
  const [selectedCompany, setSelectedCompany] = useState('');
  const [conteos, setConteos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [filtros, setFiltros] = useState({
    bodega: '',
    zona: '',
    pasillo: '',
    tipoConteo: 'todos'
  });

  const companies = [
    { id: '1', nombre: 'Makro Colombia' },
    { id: '2', nombre: 'Makro Perú' },
    { id: '3', nombre: 'Makro Chile' },
  ];

  useEffect(() => {
    if (selectedCompany) {
      cargarHistorial();
    }
  }, [selectedCompany, filtros]);

  const cargarHistorial = async () => {
    try {
      setLoading(true);
      const data = await inventarioGeneralService.obtenerHistorialConteos(selectedCompany, filtros);
      setConteos(data);
    } catch (error) {
      console.error('Error al cargar historial:', error);
      setMessage({ type: 'error', text: 'Error al cargar el historial de conteos' });
    } finally {
      setLoading(false);
    }
  };

  const handleAprobarConteo = async (conteoId) => {
    if (!window.confirm('¿Estás seguro de aprobar este conteo?')) {
      return;
    }

    try {
      setLoading(true);
      await inventarioGeneralService.aprobarConteo(conteoId);
      setMessage({ type: 'success', text: 'Conteo aprobado exitosamente' });
      cargarHistorial();
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al aprobar el conteo: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRechazarConteo = async (conteoId) => {
    const motivo = window.prompt('Ingresa el motivo del rechazo:');
    if (!motivo) return;

    try {
      setLoading(true);
      await inventarioGeneralService.rechazarConteo(conteoId, motivo);
      setMessage({ type: 'success', text: 'Conteo rechazado' });
      cargarHistorial();
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al rechazar el conteo: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDescargarExcel = async (conteoId, tipoConteo) => {
    try {
      setLoading(true);
      const data = await inventarioGeneralService.obtenerDetalleConteo(conteoId);

      // Preparar datos para Excel
      const excelData = data.map(item => ({
        'Bodega': item.bodega,
        'Zona': item.zona,
        'Pasillo': item.pasillo,
        'Ubicación': item.ubicacion,
        'Item': item.item_codigo,
        'Descripción': item.descripcion,
        'Código de Barra': item.codigo_barra,
        'Cantidad Contada': item.cantidad,
        'Fecha': new Date(item.fecha_conteo).toLocaleString(),
        'Usuario': item.usuario_nombre,
        'Tipo Conteo': tipoConteo
      }));

      // Crear libro de Excel
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Conteo');

      // Descargar archivo
      const fileName = `Conteo_${tipoConteo}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      setMessage({ type: 'success', text: 'Archivo descargado exitosamente' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al descargar: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const getTipoConteoLabel = (tipo) => {
    switch(tipo) {
      case 1: return 'Conteo #1';
      case 2: return 'Conteo #2';
      case 3: return 'Conteo Diferencias';
      default: return 'Desconocido';
    }
  };

  const getEstadoBadge = (estado) => {
    const badges = {
      'pendiente': { class: 'badge-pending', text: 'Pendiente' },
      'aprobado': { class: 'badge-approved', text: 'Aprobado' },
      'rechazado': { class: 'badge-rejected', text: 'Rechazado' }
    };
    const badge = badges[estado] || badges['pendiente'];
    return <span className={`badge ${badge.class}`}>{badge.text}</span>;
  };

  return (
    <div className="historial-conteos">
      <h2>Historial de Conteos</h2>
      <p className="subtitle">
        Revisa, aprueba y descarga los conteos realizados por los empleados
      </p>

      {/* Selección de Compañía */}
      <div className="form-group">
        <label>Seleccionar Compañía:</label>
        <select
          value={selectedCompany}
          onChange={(e) => setSelectedCompany(e.target.value)}
          className="select-input"
        >
          <option value="">-- Selecciona una compañía --</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* Filtros */}
      {selectedCompany && (
        <div className="filtros-section">
          <h3>Filtros</h3>
          <div className="filtros-grid">
            <input
              type="text"
              placeholder="Bodega"
              value={filtros.bodega}
              onChange={(e) => setFiltros({...filtros, bodega: e.target.value})}
              className="input-field"
            />
            <input
              type="text"
              placeholder="Zona"
              value={filtros.zona}
              onChange={(e) => setFiltros({...filtros, zona: e.target.value})}
              className="input-field"
            />
            <input
              type="text"
              placeholder="Pasillo"
              value={filtros.pasillo}
              onChange={(e) => setFiltros({...filtros, pasillo: e.target.value})}
              className="input-field"
            />
            <select
              value={filtros.tipoConteo}
              onChange={(e) => setFiltros({...filtros, tipoConteo: e.target.value})}
              className="select-input"
            >
              <option value="todos">Todos los tipos</option>
              <option value="1">Conteo #1</option>
              <option value="2">Conteo #2</option>
              <option value="3">Conteo Diferencias</option>
            </select>
          </div>
        </div>
      )}

      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Tabla de Conteos */}
      {selectedCompany && (
        <div className="conteos-table-container">
          {loading ? (
            <div className="loading-spinner">Cargando conteos...</div>
          ) : conteos.length === 0 ? (
            <div className="no-data">No hay conteos registrados</div>
          ) : (
            <table className="conteos-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Bodega</th>
                  <th>Zona</th>
                  <th>Pasillo</th>
                  <th>Ubicación</th>
                  <th>Tipo Conteo</th>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Items Contados</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {conteos.map((conteo) => (
                  <tr key={conteo.id}>
                    <td>{conteo.id}</td>
                    <td>{conteo.bodega}</td>
                    <td>{conteo.zona}</td>
                    <td>{conteo.pasillo}</td>
                    <td>{conteo.ubicacion}</td>
                    <td>
                      <span className="tipo-conteo-badge">
                        {getTipoConteoLabel(conteo.tipo_conteo)}
                      </span>
                    </td>
                    <td>{new Date(conteo.fecha_inicio).toLocaleDateString()}</td>
                    <td>{conteo.usuario_nombre}</td>
                    <td>{conteo.total_items}</td>
                    <td>{getEstadoBadge(conteo.estado)}</td>
                    <td>
                      <div className="action-buttons">
                        {conteo.estado === 'pendiente' && (
                          <>
                            <button
                              onClick={() => handleAprobarConteo(conteo.id)}
                              className="btn-approve"
                              disabled={loading}
                            >
                              ✓ Aprobar
                            </button>
                            <button
                              onClick={() => handleRechazarConteo(conteo.id)}
                              className="btn-reject"
                              disabled={loading}
                            >
                              ✗ Rechazar
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDescargarExcel(conteo.id, getTipoConteoLabel(conteo.tipo_conteo))}
                          className="btn-download"
                          disabled={loading}
                        >
                          📥 Descargar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default HistorialConteos;
