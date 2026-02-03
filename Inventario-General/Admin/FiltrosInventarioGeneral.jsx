import React, { useMemo, useState } from 'react';
import BusquedaAvanzada from './BusquedaAvanzada';
import './FiltrosInventarioGeneral.css';

const FiltrosInventarioGeneral = ({ filtros, setFiltros, viewMode, structure, conteos, selectedBodega, selectedCompany, userMap }) => {
  // Si no estamos en modo lista, no mostramos los filtros
  if (viewMode !== 'list') return null;

  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);

  const handleNavigate = (location) => {
    // Actualizar filtros para ir a la ubicación seleccionada
    setFiltros(prev => ({
        ...prev,
        zona: location.zona,
        pasillo: location.pasillo,
        // Opcional: limpiar filtro de usuario para ver todo el pasillo
        usuario: '' 
    }));
  };

  const handleChange = (field, value) => {
    setFiltros(prev => ({ ...prev, [field]: value }));
  };

  // Calcular opciones disponibles
  const options = useMemo(() => {
    let zonas = [];
    let pasillos = [];
    let usuarios = [];

    // 1. Obtener conteos de la bodega actual
    const conteosBodega = conteos ? conteos.filter(c => c.bodega === selectedBodega) : [];

    // 2. Obtener usuarios únicos
    const uniqueUsers = new Set();
    conteosBodega.forEach(c => {
        if (c.usuario_nombre) uniqueUsers.add(c.usuario_nombre);
        else if (c.correo_empleado) uniqueUsers.add(c.correo_empleado);
        else if (c.usuario_id) uniqueUsers.add(c.usuario_id);
    });
    usuarios = [...uniqueUsers].sort();

    // 3. Filtrar conteos para calcular zonas/pasillos
    let sourceData = conteosBodega;
    if (filtros.usuario) {
        sourceData = conteosBodega.filter(c => 
            c.usuario_nombre === filtros.usuario || 
            c.correo_empleado === filtros.usuario || 
            c.usuario_id === filtros.usuario
        );
    }

    if (filtros.usuario || !structure) {
        // Usar datos de conteos (filtrados por usuario si aplica)
        const uniqueZonas = new Set(sourceData.map(c => c.zona));
        zonas = [...uniqueZonas].sort();

        if (filtros.zona) {
            const uniquePasillos = new Set(
                sourceData
                .filter(c => c.zona === filtros.zona)
                .map(c => c.pasillo)
            );
            pasillos = [...uniquePasillos].sort();
        } else {
            const uniquePasillos = new Set(sourceData.map(c => c.pasillo));
            pasillos = [...uniquePasillos].sort();
        }
    } else {
        // Usar estructura jerárquica si está disponible y NO hay usuario seleccionado
        zonas = structure.map(z => z.nombre).sort();
        
        if (filtros.zona) {
            const zonaObj = structure.find(z => z.nombre === filtros.zona);
            if (zonaObj) {
            pasillos = zonaObj.pasillos.map(p => p.numero).sort();
            }
        } else {
            const allPasillos = new Set();
            structure.forEach(z => {
            z.pasillos.forEach(p => allPasillos.add(p.numero));
            });
            pasillos = [...allPasillos].sort();
        }
    }

    return { zonas, pasillos, usuarios };
  }, [structure, conteos, selectedBodega, filtros.zona, filtros.usuario]);

  return (
    <div className="fig-filters-container">
      <button 
        className="fig-adv-search-btn"
        onClick={() => setShowAdvancedSearch(true)}
      >
        <span className="fig-icon-btn">🔍</span> Búsqueda Avanzada
      </button>

      <button
        className={`fig-toggle-btn ${filtros.soloPendientes ? 'active' : ''}`}
        onClick={() => handleChange('soloPendientes', !filtros.soloPendientes)}
        title="Muestra ubicaciones con diferencias sin resolver o conteos en progreso"
      >
        ⚠️ Pendientes
      </button>

      <div className="fig-input-wrapper">
        <span className="fig-icon">👤</span>
        <select 
          value={filtros.usuario || ''}
          onChange={e => handleChange('usuario', e.target.value)}
          className="fig-input fig-select"
        >
          <option value="">Todos los Usuarios</option>
          {options.usuarios.map(u => (
            <option key={u} value={u}>
                {userMap && userMap[u] ? userMap[u] : u}
            </option>
          ))}
        </select>
      </div>

      <div className="fig-input-wrapper">
        <span className="fig-icon">📍</span>
        <select 
          value={filtros.zona}
          onChange={e => handleChange('zona', e.target.value)}
          className="fig-input fig-select"
        >
          <option value="">Todas las Zonas</option>
          {options.zonas.map(z => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>
      </div>
      <div className="fig-input-wrapper">
        <span className="fig-icon">🛣️</span>
        <select 
          value={filtros.pasillo}
          onChange={e => handleChange('pasillo', e.target.value)}
          className="fig-input fig-select"
        >
          <option value="">Todos los Pasillos</option>
          {options.pasillos.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {showAdvancedSearch && (
        <BusquedaAvanzada 
            onClose={() => setShowAdvancedSearch(false)} 
            onNavigate={handleNavigate}
            selectedCompany={selectedCompany}
            selectedBodega={selectedBodega}
        />
      )}
    </div>
  );
};

export default FiltrosInventarioGeneral;
