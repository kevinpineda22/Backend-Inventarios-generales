import { useState, useEffect } from 'react';
import './CreacionInventario.css';

const CreacionInventario = () => {
  const [selectedCompany, setSelectedCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Estado del Formulario "Batch"
  const [bodegaNombre, setBodegaNombre] = useState('');
  const [zonas, setZonas] = useState(['']); // Array para múltiples zonas
  const [pasilloNombre, setPasilloNombre] = useState(''); // Un solo pasillo
  const [ubicaciones, setUbicaciones] = useState(['']); // Array para múltiples ubicaciones

  const companies = [
    { id: '1', nombre: 'Merkahorro' },
    { id: '2', nombre: 'Megamayorista' },
    { id: '3', nombre: 'Construahorro' },
  ];

  // --- Manejo de Inputs Dinámicos ---

  // ZONAS
  const handleZonaChange = (index, value) => {
    const newZonas = [...zonas];
    newZonas[index] = value;
    setZonas(newZonas);
  };

  const addZonaField = () => {
    setZonas([...zonas, '']);
  };

  const removeZonaField = (index) => {
    if (zonas.length > 1) {
      const newZonas = zonas.filter((_, i) => i !== index);
      setZonas(newZonas);
    }
  };

  // UBICACIONES
  const handleUbicacionChange = (index, value) => {
    const newUbicaciones = [...ubicaciones];
    newUbicaciones[index] = value;
    setUbicaciones(newUbicaciones);
  };

  const addUbicacionField = () => {
    setUbicaciones([...ubicaciones, '']);
  };

  const removeUbicacionField = (index) => {
    if (ubicaciones.length > 1) {
      const newUbicaciones = ubicaciones.filter((_, i) => i !== index);
      setUbicaciones(newUbicaciones);
    }
  };

  // --- Generación de Clave Segura ---
  const generarClaveSegura = (bodega, zona, pasillo, ubicacion) => {
    // Primera letra de cada nivel + 4 números aleatorios para seguridad
    const letraB = bodega.charAt(0).toUpperCase() || 'X';
    const letraZ = zona.charAt(0).toUpperCase() || 'X';
    const letraP = pasillo.charAt(0).toUpperCase() || 'X';
    const letraU = ubicacion.charAt(0).toUpperCase() || 'X';
    const random = Math.floor(1000 + Math.random() * 9000); // 4 dígitos aleatorios
    
    return `${letraB}${letraZ}${letraP}${letraU}-${random}`;
  };

  // --- Guardado Completo ---
  const handleGuardarTodo = async () => {
    // 1. Validaciones Básicas
    if (!selectedCompany) {
      setMessage({ type: 'error', text: 'Selecciona una compañía' });
      return;
    }
    if (!bodegaNombre.trim()) {
      setMessage({ type: 'error', text: 'El nombre de la bodega es obligatorio' });
      return;
    }
    if (zonas.some(z => !z.trim())) {
      setMessage({ type: 'error', text: 'Todas las zonas deben tener nombre' });
      return;
    }
    if (!pasilloNombre.trim()) {
      setMessage({ type: 'error', text: 'El nombre del pasillo es obligatorio' });
      return;
    }
    if (ubicaciones.some(u => !u.trim())) {
      setMessage({ type: 'error', text: 'Todas las ubicaciones deben tener nombre/número' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // 2. Crear Bodega
      const bodegaRes = await inventarioGeneralService.crearBodega({
        nombre: bodegaNombre,
        compania_id: selectedCompany
      });
      const bodegaId = bodegaRes.id || bodegaRes.data.id; // Ajustar según respuesta del backend

      // 3. Iterar sobre Zonas
      for (const zonaNombre of zonas) {
        // Crear Zona vinculada a Bodega
        const zonaRes = await inventarioGeneralService.crearZona({
          nombre: zonaNombre,
          bodega_id: bodegaId
        });
        const zonaId = zonaRes.id || zonaRes.data.id;

        // Crear Pasillo vinculado a Zona (El mismo nombre de pasillo para cada zona creada en este lote)
        const pasilloRes = await inventarioGeneralService.crearPasillo({
          numero: pasilloNombre,
          zona_id: zonaId
        });
        const pasilloId = pasilloRes.id || pasilloRes.data.id;

        // 4. Iterar sobre Ubicaciones
        const promesasUbicaciones = ubicaciones.map(async (ubicacionNombre) => {
          const claveGenerada = generarClaveSegura(bodegaNombre, zonaNombre, pasilloNombre, ubicacionNombre);
          
          return inventarioGeneralService.crearUbicacion({
            numero: ubicacionNombre,
            pasillo_id: pasilloId,
            clave: claveGenerada
          });
        });

        await Promise.all(promesasUbicaciones);
      }

      setMessage({ type: 'success', text: '¡Estructura completa guardada exitosamente!' });
      
      // Resetear formulario
      setBodegaNombre('');
      setZonas(['']);
      setPasilloNombre('');
      setUbicaciones(['']);

    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Error al guardar la estructura: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inventario-general-creacion-container">
      <div className="inventario-general-header">
        <h2>Creación de Estructura de Inventario</h2>
        <p className="inventario-general-subtitle">
          Define la jerarquía completa. Se generarán claves de seguridad automáticamente.
        </p>
      </div>

      <div className="inventario-general-form-group">
        <label>Seleccionar Compañía:</label>
        <select
          value={selectedCompany}
          onChange={(e) => setSelectedCompany(e.target.value)}
          className="inventario-general-select-input"
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
        <div className="inventario-general-batch-form">
          
          {/* SECCIÓN 1: BODEGA */}
          <div className="inventario-general-section-card">
            <div className="inventario-general-card-header">1. Bodega</div>
            <input
              type="text"
              placeholder="Nombre de la Bodega (Ej: Bodega Central)"
              value={bodegaNombre}
              onChange={(e) => setBodegaNombre(e.target.value)}
              className="inventario-general-input-field"
            />
          </div>

          {/* SECCIÓN 2: ZONAS (Dinámicas) */}
          <div className="inventario-general-section-card">
            <div className="inventario-general-card-header">
              2. Zonas
              <small> (Puedes agregar múltiples zonas para esta bodega)</small>
            </div>
            {zonas.map((zona, index) => (
              <div key={index} className="inventario-general-dynamic-row">
                <input
                  type="text"
                  placeholder={`Nombre Zona ${index + 1} (Ej: Norte, Sur, A, B)`}
                  value={zona}
                  onChange={(e) => handleZonaChange(index, e.target.value)}
                  className="inventario-general-input-field"
                />
                {zonas.length > 1 && (
                  <button onClick={() => removeZonaField(index)} className="inventario-general-btn-remove">×</button>
                )}
              </div>
            ))}
            <button onClick={addZonaField} className="inventario-general-btn-add">+ Agregar otra Zona</button>
          </div>

          {/* SECCIÓN 3: PASILLO (Único por lote) */}
          <div className="inventario-general-section-card">
            <div className="inventario-general-card-header">
              3. Pasillo
              <small> (Se creará este pasillo dentro de cada zona listada arriba)</small>
            </div>
            <input
              type="text"
              placeholder="Nombre/Número del Pasillo (Ej: Pasillo 1)"
              value={pasilloNombre}
              onChange={(e) => setPasilloNombre(e.target.value)}
              className="inventario-general-input-field"
            />
          </div>

          {/* SECCIÓN 4: UBICACIONES (Dinámicas) */}
          <div className="inventario-general-section-card">
            <div className="inventario-general-card-header">
              4. Ubicaciones
              <small> (Se crearán estas ubicaciones dentro del pasillo)</small>
            </div>
            <div className="inventario-general-locations-grid">
              {ubicaciones.map((ubicacion, index) => (
                <div key={index} className="inventario-general-dynamic-row">
                  <input
                    type="text"
                    placeholder={`Ubicación ${index + 1}`}
                    value={ubicacion}
                    onChange={(e) => handleUbicacionChange(index, e.target.value)}
                    className="inventario-general-input-field"
                  />
                  {ubicaciones.length > 1 && (
                    <button onClick={() => removeUbicacionField(index)} className="inventario-general-btn-remove">×</button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addUbicacionField} className="inventario-general-btn-add">+ Agregar otra Ubicación</button>
          </div>

          {/* ACCIÓN FINAL */}
          <div className="inventario-general-actions">
            <button 
              onClick={handleGuardarTodo} 
              className="inventario-general-btn-save"
              disabled={loading}
            >
              {loading ? 'Guardando Estructura...' : '💾 GUARDAR ESTRUCTURA COMPLETA'}
            </button>
          </div>

        </div>
      )}

      {message.text && (
        <div className={`inventario-general-message ${message.type}`}>
          {message.text}
        </div>
      )}
    </div>
  );
};

export default CreacionInventario;