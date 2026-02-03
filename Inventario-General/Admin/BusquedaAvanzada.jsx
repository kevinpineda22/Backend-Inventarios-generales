import React, { useState, useEffect, useRef } from 'react';
import { inventarioGeneralService } from '../../services/inventarioGeneralService';
import './BusquedaAvanzada.css';

const BusquedaAvanzada = ({ onClose, onNavigate, selectedCompany, selectedBodega }) => {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [locations, setLocations] = useState([]);
    const [loadingLocations, setLoadingLocations] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const searchTimeoutRef = useRef(null);
    const inputRef = useRef(null);

    // Auto-focus input on mount
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    // Search logic
    useEffect(() => {
        if (query.length > 2 && !selectedItem) {
            setIsSearching(true);
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
            
            searchTimeoutRef.current = setTimeout(async () => {
                console.log("Searching for:", query, "Company:", selectedCompany);
                try {
                    const items = await inventarioGeneralService.buscarItems(query, selectedCompany);
                    console.log("Search results:", items);
                    setSuggestions(items || []);
                } catch (error) {
                    console.error("Error fetching suggestions:", error);
                    setSuggestions([]);
                } finally {
                    setIsSearching(false);
                }
            }, 300);
        } else {
            setSuggestions([]);
            setIsSearching(false);
        }
        
        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, [query, selectedItem, selectedCompany]);

    const handleSelect = async (item) => {
        setSelectedItem(item);
        setSuggestions([]);
        setQuery(item.descripcion); // Update input for visual feedback
        
        // Fetch locations
        setLoadingLocations(true);
        try {
            const locs = await inventarioGeneralService.getItemLocations(item.id, selectedCompany);
            
            // Backend ahora se encarga de consolidar y sumar correctamente.
            // Filtrar solo las ubicaciones de la bodega seleccionada
            const filteredLocs = selectedBodega 
                ? (locs || []).filter(loc => loc.bodega === selectedBodega)
                : (locs || []);
            
            setLocations(filteredLocs);
        } catch (e) {
            console.error(e);
            setLocations([]);
        } finally {
            setLoadingLocations(false);
        }
    }

    const clearSearch = () => {
        setQuery('');
        setSelectedItem(null);
        setSuggestions([]);
        setLocations([]);
        if (inputRef.current) inputRef.current.focus();
    }

    const handleNavigateClick = (loc) => {
        onNavigate(loc);
        onClose();
    }

    return (
        <div className="adv-search-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="adv-search-modal">
                <div className="adv-search-header">
                    <div className="adv-search-title">
                        <span>🔍</span> Búsqueda Avanzada de Productos
                    </div>
                    <button className="adv-close-btn" onClick={onClose}>×</button>
                </div>

                <div className="adv-search-body">
                    <div className="adv-input-container">
                        <span className="adv-search-icon">🔎</span>
                        <input 
                            ref={inputRef}
                            type="text" 
                            className="adv-search-input"
                            placeholder="Escribe el nombre, código o descripción del producto..."
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                if (selectedItem) setSelectedItem(null); // Reset selection if typing
                            }}
                        />
                        {query && (
                            <button className="adv-clear-btn" onClick={clearSearch}>✕</button>
                        )}
                    </div>

                    {/* Suggestions List */}
                    {!selectedItem && suggestions.length > 0 && (
                        <ul className="adv-suggestions-list">
                            {suggestions.map((item, idx) => (
                                <li key={idx} className="adv-suggestion-item" onClick={() => handleSelect(item)}>
                                    <div className="adv-item-main">
                                        <span className="adv-item-desc">{item.descripcion}</span>
                                        <span className="adv-item-code">{item.codigo}</span>
                                    </div>
                                    <span className="adv-item-group">{item.grupo || 'General'}</span>
                                </li>
                            ))}
                        </ul>
                    )}

                    {/* Loading State for Search */}
                    {isSearching && <div className="adv-loading">Buscando productos...</div>}

                    {/* No Results State */}
                    {!isSearching && query.length > 2 && suggestions.length === 0 && !selectedItem && (
                        <div className="adv-no-results">No se encontraron coincidencias.</div>
                    )}

                    {/* Selected Item Details */}
                    {selectedItem && (
                        <div className="adv-details-container">
                            <div className="adv-product-header">
                                <div className="adv-ph-item">
                                    <span className="adv-ph-label">Código</span>
                                    <span className="adv-ph-value">{selectedItem.codigo}</span>
                                </div>
                                <div className="adv-ph-item" style={{flex: 1}}>
                                    <span className="adv-ph-label">Descripción</span>
                                    <span className="adv-ph-value">{selectedItem.descripcion}</span>
                                </div>
                            </div>

                            <div className="adv-locations-title">
                                Ubicaciones encontradas ({locations.length})
                            </div>

                            {loadingLocations ? (
                                <div className="adv-loading">Cargando ubicaciones...</div>
                            ) : locations.length === 0 ? (
                                <div className="adv-empty-state">
                                    <span className="adv-empty-icon">📦</span>
                                    <p>Este producto no se ha registrado en ningún conteo activo.</p>
                                </div>
                            ) : (
                                <div className="adv-table-wrapper">
                                    <table className="adv-table">
                                        <thead>
                                            <tr>
                                                <th>Bodega</th>
                                                <th>Zona</th>
                                                <th>Pasillo</th>
                                                <th>Ubicación</th>
                                                <th>Cantidad</th>
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
                                                    <td><span className="adv-qty-badge">{loc.cantidad}</span></td>
                                                    <td>{new Date(loc.fecha).toLocaleDateString()}</td>
                                                    <td>
                                                        <button 
                                                            className="adv-go-btn"
                                                            onClick={() => handleNavigateClick(loc)}
                                                        >
                                                            <span>👉</span> Ir a ver
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BusquedaAvanzada;
