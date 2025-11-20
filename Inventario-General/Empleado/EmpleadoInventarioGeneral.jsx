import { useState, useEffect } from 'react';
import ConteoPorUbicacion from './ConteoPorUbicacion';
import './EmpleadoInventarioGeneral.css';

const EmpleadoInventarioGeneral = ({ usuarioId, usuarioNombre }) => {
  const [selectedCompany, setSelectedCompany] = useState('');
  const [estructura, setEstructura] = useState({
    bodegas: [],
    zonas: [],
    pasillos: [],
    ubicaciones: []
  });
  
  const [seleccion, setSeleccion] = useState({
    bodega: '',
    zona: '',
    pasillo: '',
    ubicacion: ''
  });

  const [mostrarConteo, setMostrarConteo] = useState(false);
  const [ubicacionActual, setUbicacionActual] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const companies = [
    { id: '1', nombre: 'Merkahorro' },
    { id: '2', nombre: 'Megamayorista' },
    { id: '3', nombre: 'Construahorro' },
  ];

  useEffect(() => {
    if (selectedCompany) {
      cargarEstructura();
    }
  }, [selectedCompany]);

  useEffect(() => {
    if (seleccion.bodega) {
      cargarZonas();
    }
  }, [seleccion.bodega]);

  useEffect(() => {
    if (seleccion.zona) {
      cargarPasillos();
    }
  }, [seleccion.zona]);

  useEffect(() => {
    if (seleccion.pasillo) {
      cargarUbicaciones();
    }
  }, [seleccion.pasillo]);

  const cargarEstructura = async () => {
    try {
      setLoading(true);
      const data = await inventarioGeneralService.obtenerEstructuraInventario(selectedCompany);
      setEstructura({ ...estructura, bodegas: data });
    } catch (error) {
      console.error('Error al cargar estructura:', error);
      setMessage({ type: 'error', text: 'Error al cargar la estructura' });
    } finally {
      setLoading(false);
    }
  };

  const cargarZonas = () => {
    const bodega = estructura.bodegas.find(b => b.id === seleccion.bodega);
    setEstructura({ ...estructura, zonas: bodega?.zonas || [] });
    setSeleccion({ ...seleccion, zona: '', pasillo: '', ubicacion: '' });
  };

  const cargarPasillos = () => {
    const zona = estructura.zonas.find(z => z.id === seleccion.zona);
    setEstructura({ ...estructura, pasillos: zona?.pasillos || [] });
    setSeleccion({ ...seleccion, pasillo: '', ubicacion: '' });
  };

  const cargarUbicaciones = () => {
    const pasillo = estructura.pasillos.find(p => p.id === seleccion.pasillo);
    setEstructura({ ...estructura, ubicaciones: pasillo?.ubicaciones || [] });
    setSeleccion({ ...seleccion, ubicacion: '' });
  };

  const handleSeleccionarUbicacion = async (ubicacionId) => {
    try {
      setLoading(true);
      const ubicacion = estructura.ubicaciones.find(u => u.id === ubicacionId);
      
      // Verificar el estado de la ubicación y qué tipo de conteo debe realizar
      const estadoUbicacion = await inventarioGeneralService.obtenerEstadoUbicacion(ubicacionId);
      
      setUbicacionActual({
        ...ubicacion,
        ...estadoUbicacion,
        bodega: estructura.bodegas.find(b => b.id === seleccion.bodega)?.nombre,
        zona: estructura.zonas.find(z => z.id === seleccion.zona)?.nombre,
        pasillo: estructura.pasillos.find(p => p.id === seleccion.pasillo)?.numero
      });
      
      setSeleccion({ ...seleccion, ubicacion: ubicacionId });
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: 'Error al seleccionar ubicación' });
    } finally {
      setLoading(false);
    }
  };

  const handleIniciarConteo = (clave) => {
    if (!ubicacionActual) {
      setMessage({ type: 'error', text: 'No hay ubicación seleccionada' });
      return;
    }

    if (clave !== ubicacionActual.clave) {
      setMessage({ type: 'error', text: 'Clave incorrecta' });
      return;
    }

    setMostrarConteo(true);
    setMessage({ type: '', text: '' });
  };

  const handleCerrarConteo = () => {
    setMostrarConteo(false);
    setUbicacionActual(null);
    setSeleccion({ ...seleccion, ubicacion: '' });
    cargarUbicaciones(); // Recargar para actualizar estados
  };

  if (mostrarConteo && ubicacionActual) {
    return (
      <ConteoPorUbicacion
        ubicacion={ubicacionActual}
        usuarioId={usuarioId}
        usuarioNombre={usuarioNombre}
        onCerrar={handleCerrarConteo}
      />
    );
  }

  return (
    <div className="empleado-inventario-general">
      <div className="empleado-header">
        <h1>Panel de Conteo - Empleado</h1>
        <p className="user-info">Usuario: <strong>{usuarioNombre}</strong></p>
      </div>

      {/* Selección de Compañía */}
      <div className="form-section">
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
      </div>

      {selectedCompany && (
        <div className="seleccion-grid">
          {/* Selección de Bodega */}
          <div className="seleccion-card">
            <h3>1. Bodega</h3>
            <select
              value={seleccion.bodega}
              onChange={(e) => setSeleccion({ ...seleccion, bodega: e.target.value })}
              className="select-input"
            >
              <option value="">-- Selecciona bodega --</option>
              {estructura.bodegas.map((bodega) => (
                <option key={bodega.id} value={bodega.id}>
                  {bodega.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Selección de Zona */}
          <div className="seleccion-card">
            <h3>2. Zona</h3>
            <select
              value={seleccion.zona}
              onChange={(e) => setSeleccion({ ...seleccion, zona: e.target.value })}
              className="select-input"
              disabled={!seleccion.bodega}
            >
              <option value="">-- Selecciona zona --</option>
              {estructura.zonas.map((zona) => (
                <option key={zona.id} value={zona.id}>
                  {zona.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Selección de Pasillo */}
          <div className="seleccion-card">
            <h3>3. Pasillo</h3>
            <select
              value={seleccion.pasillo}
              onChange={(e) => setSeleccion({ ...seleccion, pasillo: e.target.value })}
              className="select-input"
              disabled={!seleccion.zona}
            >
              <option value="">-- Selecciona pasillo --</option>
              {estructura.pasillos.map((pasillo) => (
                <option key={pasillo.id} value={pasillo.id}>
                  Pasillo {pasillo.numero}
                </option>
              ))}
            </select>
          </div>

          {/* Selección de Ubicación */}
          <div className="seleccion-card">
            <h3>4. Ubicación</h3>
            <div className="ubicaciones-grid">
              {seleccion.pasillo && estructura.ubicaciones.length > 0 ? (
                estructura.ubicaciones.map((ubicacion) => (
                  <button
                    key={ubicacion.id}
                    onClick={() => handleSeleccionarUbicacion(ubicacion.id)}
                    className={`ubicacion-btn ${seleccion.ubicacion === ubicacion.id ? 'selected' : ''} ${ubicacion.estado || ''}`}
                    disabled={loading}
                  >
                    <div className="ubicacion-numero">#{ubicacion.numero}</div>
                    <div className="ubicacion-estado">
                      {ubicacion.conteo_actual === 3 ? '✓ Completo' : 
                       ubicacion.conteo_actual === 2 ? 'Conteo #2' :
                       ubicacion.conteo_actual === 1 ? 'Conteo #1' : 'Disponible'}
                    </div>
                  </button>
                ))
              ) : (
                <p className="no-ubicaciones">Selecciona un pasillo para ver ubicaciones</p>
              )}
            </div>
          </div>
        </div>
      )}

      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Panel de clave para iniciar conteo */}
      {ubicacionActual && !mostrarConteo && (
        <div className="clave-panel">
          <h3>Ubicación Seleccionada: #{ubicacionActual.numero}</h3>
          <p>Tipo de Conteo: <strong>{
            ubicacionActual.conteo_actual === 0 ? 'Conteo #1' :
            ubicacionActual.conteo_actual === 1 ? 'Conteo #2' :
            'Conteo de Diferencias'
          }</strong></p>
          <div className="clave-input-group">
            <input
              type="text"
              placeholder="Ingresa la clave de la ubicación"
              id="clave-input"
              className="clave-input"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleIniciarConteo(e.target.value);
                }
              }}
            />
            <button
              onClick={() => {
                const clave = document.getElementById('clave-input').value;
                handleIniciarConteo(clave);
              }}
              className="btn-iniciar"
            >
              Iniciar Conteo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmpleadoInventarioGeneral;
