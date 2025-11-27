import React, { useMemo } from 'react';
import './FiltrosInventarioGeneral.css';

const FiltrosInventarioGeneral = ({ filtros, setFiltros, viewMode, structure, conteos, selectedBodega }) => {
  // Si no estamos en modo lista, no mostramos los filtros
  if (viewMode !== 'list') return null;

  const handleChange = (field, value) => {
    setFiltros(prev => ({ ...prev, [field]: value }));
  };

  // Calcular opciones disponibles
  const options = useMemo(() => {
    let zonas = [];
    let pasillos = [];

    if (structure) {
      // Usar estructura jerárquica si está disponible
      zonas = structure.map(z => z.nombre).sort();
      
      if (filtros.zona) {
        // Si hay zona seleccionada, filtrar pasillos de esa zona
        const zonaObj = structure.find(z => z.nombre === filtros.zona);
        if (zonaObj) {
          pasillos = zonaObj.pasillos.map(p => p.numero).sort();
        }
      } else {
        // Si no, mostrar todos los pasillos de la bodega
        const allPasillos = new Set();
        structure.forEach(z => {
          z.pasillos.forEach(p => allPasillos.add(p.numero));
        });
        pasillos = [...allPasillos].sort();
      }
    } else if (conteos && selectedBodega) {
      // Fallback: Usar datos de conteos si no hay estructura cargada
      const filteredConteos = conteos.filter(c => c.bodega === selectedBodega);
      
      const uniqueZonas = new Set(filteredConteos.map(c => c.zona));
      zonas = [...uniqueZonas].sort();

      if (filtros.zona) {
        const uniquePasillos = new Set(
          filteredConteos
            .filter(c => c.zona === filtros.zona)
            .map(c => c.pasillo)
        );
        pasillos = [...uniquePasillos].sort();
      } else {
        const uniquePasillos = new Set(filteredConteos.map(c => c.pasillo));
        pasillos = [...uniquePasillos].sort();
      }
    }

    return { zonas, pasillos };
  }, [structure, conteos, selectedBodega, filtros.zona]);

  return (
    <div className="fig-filters-container">
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
    </div>
  );
};

export default FiltrosInventarioGeneral;
