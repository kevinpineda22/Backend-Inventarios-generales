import { useState, useEffect } from 'react';
import { inventarioGeneralService } from '../../../services/inventarioGeneralService';
import './CreacionInventario.css';

const CreacionInventario = () => {
  const [selectedCompany, setSelectedCompany] = useState('');
  const [bodegas, setBodegas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Estado para la creación
  const [nuevaBodega, setNuevaBodega] = useState('');
  const [bodegaSeleccionada, setBodegaSeleccionada] = useState('');
  const [nuevaZona, setNuevaZona] = useState('');
  const [zonaSeleccionada, setZonaSeleccionada] = useState('');
  const [nuevoPasillo, setNuevoPasillo] = useState('');
  const [pasilloSeleccionado, setPasilloSeleccionado] = useState('');
  const [nuevaUbicacion, setNuevaUbicacion] = useState('');

  const companies = [
    { id: '1', nombre: 'Makro Colombia' },
    { id: '2', nombre: 'Makro Perú' },
    { id: '3', nombre: 'Makro Chile' },
  ];

  useEffect(() => {
    if (selectedCompany) {
      cargarEstructura();
    }
  }, [selectedCompany]);

  const cargarEstructura = async () => {
    try {
      setLoading(true);
      const data = await inventarioGeneralService.obtenerEstructuraInventario(selectedCompany);
      setBodegas(data);
    } catch (error) {
      console.error('Error al cargar estructura:', error);
      setMessage({ type: 'error', text: 'Error al cargar la estructura del inventario' });
    } finally {
      setLoading(false);
    }
  };

  const handleCrearBodega = async () => {
    if (!nuevaBodega.trim()) {
      setMessage({ type: 'error', text: 'Ingresa un nombre para la bodega' });
      return;
    }

    try {
      setLoading(true);
      await inventarioGeneralService.crearBodega({
        nombre: nuevaBodega,
        compania_id: selectedCompany
      });
      setMessage({ type: 'success', text: 'Bodega creada exitosamente' });
      setNuevaBodega('');
      cargarEstructura();
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al crear la bodega: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCrearZona = async () => {
    if (!bodegaSeleccionada) {
      setMessage({ type: 'error', text: 'Selecciona una bodega primero' });
      return;
    }
    if (!nuevaZona.trim()) {
      setMessage({ type: 'error', text: 'Ingresa un nombre para la zona' });
      return;
    }

    try {
      setLoading(true);
      await inventarioGeneralService.crearZona({
        nombre: nuevaZona,
        bodega_id: bodegaSeleccionada
      });
      setMessage({ type: 'success', text: 'Zona creada exitosamente' });
      setNuevaZona('');
      cargarEstructura();
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al crear la zona: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCrearPasillo = async () => {
    if (!zonaSeleccionada) {
      setMessage({ type: 'error', text: 'Selecciona una zona primero' });
      return;
    }
    if (!nuevoPasillo.trim()) {
      setMessage({ type: 'error', text: 'Ingresa un número para el pasillo' });
      return;
    }

    try {
      setLoading(true);
      await inventarioGeneralService.crearPasillo({
        numero: nuevoPasillo,
        zona_id: zonaSeleccionada
      });
      setMessage({ type: 'success', text: 'Pasillo creado exitosamente' });
      setNuevoPasillo('');
      cargarEstructura();
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al crear el pasillo: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCrearUbicacion = async () => {
    if (!pasilloSeleccionado) {
      setMessage({ type: 'error', text: 'Selecciona un pasillo primero' });
      return;
    }
    if (!nuevaUbicacion.trim()) {
      setMessage({ type: 'error', text: 'Ingresa un número para la ubicación' });
      return;
    }

    try {
      setLoading(true);
      await inventarioGeneralService.crearUbicacion({
        numero: nuevaUbicacion,
        pasillo_id: pasilloSeleccionado,
        clave: Math.random().toString(36).substring(2, 10).toUpperCase() // Genera clave aleatoria
      });
      setMessage({ type: 'success', text: 'Ubicación creada exitosamente' });
      setNuevaUbicacion('');
      cargarEstructura();
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al crear la ubicación: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  const obtenerZonasDeBodega = () => {
    const bodega = bodegas.find(b => b.id === bodegaSeleccionada);
    return bodega ? bodega.zonas : [];
  };

  const obtenerPasillosDeZona = () => {
    const bodega = bodegas.find(b => b.id === bodegaSeleccionada);
    if (!bodega) return [];
    const zona = bodega.zonas?.find(z => z.id === zonaSeleccionada);
    return zona ? zona.pasillos : [];
  };

  const obtenerUbicacionesDePasillo = () => {
    const bodega = bodegas.find(b => b.id === bodegaSeleccionada);
    if (!bodega) return [];
    const zona = bodega.zonas?.find(z => z.id === zonaSeleccionada);
    if (!zona) return [];
    const pasillo = zona.pasillos?.find(p => p.id === pasilloSeleccionado);
    return pasillo ? pasillo.ubicaciones : [];
  };

  return (
    <div className="creacion-inventario">
      <h2>Creación de Estructura de Inventario</h2>
      <p className="subtitle">
        Crea la jerarquía: Bodega → Zona → Pasillo → Ubicaciones
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

      {selectedCompany && (
        <div className="creation-grid">
          {/* Crear Bodega */}
          <div className="creation-card">
            <h3>1. Crear Bodega</h3>
            <input
              type="text"
              placeholder="Nombre de la bodega"
              value={nuevaBodega}
              onChange={(e) => setNuevaBodega(e.target.value)}
              className="input-field"
            />
            <button onClick={handleCrearBodega} className="btn-create" disabled={loading}>
              Crear Bodega
            </button>
          </div>

          {/* Crear Zona */}
          <div className="creation-card">
            <h3>2. Crear Zona</h3>
            <select
              value={bodegaSeleccionada}
              onChange={(e) => setBodegaSeleccionada(e.target.value)}
              className="select-input"
            >
              <option value="">-- Selecciona una bodega --</option>
              {bodegas.map((bodega) => (
                <option key={bodega.id} value={bodega.id}>
                  {bodega.nombre}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Nombre de la zona"
              value={nuevaZona}
              onChange={(e) => setNuevaZona(e.target.value)}
              className="input-field"
              disabled={!bodegaSeleccionada}
            />
            <button 
              onClick={handleCrearZona} 
              className="btn-create" 
              disabled={loading || !bodegaSeleccionada}
            >
              Crear Zona
            </button>
          </div>

          {/* Crear Pasillo */}
          <div className="creation-card">
            <h3>3. Crear Pasillo</h3>
            <select
              value={zonaSeleccionada}
              onChange={(e) => setZonaSeleccionada(e.target.value)}
              className="select-input"
              disabled={!bodegaSeleccionada}
            >
              <option value="">-- Selecciona una zona --</option>
              {obtenerZonasDeBodega().map((zona) => (
                <option key={zona.id} value={zona.id}>
                  {zona.nombre}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Número del pasillo"
              value={nuevoPasillo}
              onChange={(e) => setNuevoPasillo(e.target.value)}
              className="input-field"
              disabled={!zonaSeleccionada}
            />
            <button 
              onClick={handleCrearPasillo} 
              className="btn-create" 
              disabled={loading || !zonaSeleccionada}
            >
              Crear Pasillo
            </button>
          </div>

          {/* Crear Ubicación */}
          <div className="creation-card">
            <h3>4. Crear Ubicación</h3>
            <select
              value={pasilloSeleccionado}
              onChange={(e) => setPasilloSeleccionado(e.target.value)}
              className="select-input"
              disabled={!zonaSeleccionada}
            >
              <option value="">-- Selecciona un pasillo --</option>
              {obtenerPasillosDeZona().map((pasillo) => (
                <option key={pasillo.id} value={pasillo.id}>
                  Pasillo {pasillo.numero}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Número de la ubicación"
              value={nuevaUbicacion}
              onChange={(e) => setNuevaUbicacion(e.target.value)}
              className="input-field"
              disabled={!pasilloSeleccionado}
            />
            <button 
              onClick={handleCrearUbicacion} 
              className="btn-create" 
              disabled={loading || !pasilloSeleccionado}
            >
              Crear Ubicación
            </button>
          </div>
        </div>
      )}

      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Vista previa de la estructura */}
      {selectedCompany && bodegas.length > 0 && (
        <div className="estructura-preview">
          <h3>Estructura Actual</h3>
          <div className="tree-view">
            {bodegas.map((bodega) => (
              <div key={bodega.id} className="tree-node">
                <div className="tree-item bodega">
                  📦 <strong>{bodega.nombre}</strong>
                </div>
                {bodega.zonas && bodega.zonas.length > 0 && (
                  <div className="tree-children">
                    {bodega.zonas.map((zona) => (
                      <div key={zona.id} className="tree-node">
                        <div className="tree-item zona">
                          📍 {zona.nombre}
                        </div>
                        {zona.pasillos && zona.pasillos.length > 0 && (
                          <div className="tree-children">
                            {zona.pasillos.map((pasillo) => (
                              <div key={pasillo.id} className="tree-node">
                                <div className="tree-item pasillo">
                                  🛤️ Pasillo {pasillo.numero}
                                </div>
                                {pasillo.ubicaciones && pasillo.ubicaciones.length > 0 && (
                                  <div className="tree-children">
                                    {pasillo.ubicaciones.map((ubicacion) => (
                                      <div key={ubicacion.id} className="tree-item ubicacion">
                                        📌 Ubicación {ubicacion.numero} (Clave: {ubicacion.clave})
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CreacionInventario;
