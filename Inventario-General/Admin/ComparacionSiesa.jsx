import { useState, useEffect } from 'react';
import './ComparacionSiesa.css';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { inventarioGeneralService } from '../../services/inventarioGeneralService';
import { getAllInventario, getSiesaStockBatch, getSiesaBodegas } from '../../services/SiesaComparisonService';

const ComparacionSiesa = () => {
    const [loading, setLoading] = useState(false);
    const [comparacionData, setComparacionData] = useState(null);
    const [stats, setStats] = useState({ match: 0, diff: 0, missingSiesa: 0, missingCount: 0 });
    const [progress, setProgress] = useState("");

    // Filtros
    const [selectedCompany, setSelectedCompany] = useState(''); 
    
    // Filtro Bodega SIESA
    const [siesaBodegasOptions, setSiesaBodegasOptions] = useState([]);
    const [selectedSiesaBodega, setSelectedSiesaBodega] = useState('');

    // Filtro Categoría/Grupo
    const [gruposOptions, setGruposOptions] = useState([]);
    const [selectedGrupo, setSelectedGrupo] = useState('');

    const [bodegas, setBodegas] = useState([]);
    const [selectedBodega, setSelectedBodega] = useState('');
    const [fechaCorte, setFechaCorte] = useState(new Date().toISOString().slice(0, 10).replace(/-/g, '')); // YYYYMMDD
    // Eliminado state 'mode' ya que sera siempre parcial por defecto/optimizacion

    // Filtros Locales (Result Table)
    const [filterText, setFilterText] = useState('');
    const [filterState, setFilterState] = useState('all'); // all, match, diff, missing_siesa, missing_sys
    const [sortConfig, setSortConfig] = useState({ key: 'diff', direction: 'desc' }); // 'asc' or 'desc'
    const [visibleLimit, setVisibleLimit] = useState(100); // Pagination control

    useEffect(() => {
        if (selectedCompany) {
            loadSiesaBodegas(selectedCompany);
            loadGrupos(selectedCompany);
        }
    }, [selectedCompany]);

    /* ... omitted code ... */

    // Procesar datos para la tabla (Sorts & Filters)
    const getProcessedData = () => {
        if (!comparacionData) return [];
        
        let processed = [...comparacionData];

        // 1. Filtrar por texto
        if (filterText) {
            const lower = filterText.toLowerCase();
            processed = processed.filter(item => 
                String(item.codigo).toLowerCase().includes(lower) ||
                String(item.descripcion).toLowerCase().includes(lower)
            );
        }

        // 2. Filtrar por Estado (Badges)
        if (filterState !== 'all') {
            processed = processed.filter(item => item.estado === filterState);
        }

        // 3. Ordenar
        if (sortConfig.key) {
            processed.sort((a, b) => {
                let valA = a[sortConfig.key];
                let valB = b[sortConfig.key];

                // Si es diff, usamos valor absoluto para 'magnitud' de error si se quiere
                // Pero comunmente es valor real. El usuario pidió "mayor a menor diferencia".
                
                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();
                
                // Manejo especial para valores numéricos absolutos si se desea ordenar por 'importancia' de la diferencia
                if (sortConfig.key === 'diff_abs') {
                    valA = Math.abs(a.diff);
                    valB = Math.abs(b.diff);
                }

                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return processed;
    };

    // Handler para sort
    const handleSort = (key) => {
        let direction = 'desc'; // Default desc for numbers usually
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const loadSiesaBodegas = async (cId) => {
        setSiesaBodegasOptions([]); // Limpiar anteriores
        try {
            const data = await getSiesaBodegas(cId);
            console.log("Bodegas Siesa Raw Response:", data); // DEBUG
            
            const options = data.map(b => {
                // Mapeo exhaustivo de posibles nombres de columna
                const id = String(
                    b.f150_id || 
                    b.Id || b.id || 
                    b.Codigo || b.codigo || 
                    b.id_bodega || b.IdBodega || 
                    b.RowID || 
                    ''
                ).trim();

                const label = 
                    b.f150_descripcion || 
                    b.Descripcion || b.descripcion || 
                    b.Nombre || b.nombre || 
                    'Sin Descripción';

                return {
                    id: id,
                    label: `${id} - ${label}`
                };
            }).filter(o => o.id !== '' && o.id !== 'undefined');

            // Eliminar duplicados por ID
            const uniqueOptions = [];
            const seenIds = new Set();
            
            options.forEach(opt => {
                if (!seenIds.has(opt.id)) {
                    seenIds.add(opt.id);
                    uniqueOptions.push(opt);
                }
            });

            console.log("Opciones de Bodega Procesadas (Unique):", uniqueOptions);
            setSiesaBodegasOptions(uniqueOptions);
        } catch (e) {
            console.error("Error cargando bodegas Siesa", e);
        }
    };

    const loadGrupos = async (cId) => {
        setGruposOptions([]); // Limpiar anteriores
        try {
            const grupos = await inventarioGeneralService.obtenerGrupos(cId);
            console.log("Grupos/Categorías cargados:", grupos);
            setGruposOptions(grupos);
        } catch (e) {
            console.error("Error cargando grupos", e);
        }
    };


    
    // Lista de Compañias
    const companies = [
        { id: '1', nombre: 'Merkahorro', ciaSiesa: '1' }, 
        { id: '2', nombre: 'Megamayorista', ciaSiesa: '2' }, 
    ];

    useEffect(() => {
        // Cargar bodegas LOCALES
        if (selectedCompany) {
            loadBodegas(selectedCompany);
        }
    }, [selectedCompany]);

    const loadBodegas = async (companiaId) => {
        try {
            const data = await inventarioGeneralService.obtenerBodegas(companiaId);
            setBodegas(data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleComparar = async () => {
        if (!selectedBodega) {
            return Swal.fire('Error', 'Seleccione una bodega para comparar', 'error');
        }

        setLoading(true);
        setComparacionData(null);
        setProgress("Iniciando...");

        try {
            // 1. Obtener Inventario Físico (Local)
            setProgress("Obteniendo inventario físico finalizado...");
            const rawLocalData = await inventarioGeneralService.exportarBodega(selectedBodega);
            
            if (!rawLocalData || rawLocalData.length === 0) {
                throw new Error("No hay datos de inventario finalizado para esta bodega.");
            }

            // Filtrar por grupo si está seleccionado
            let filteredLocalData = rawLocalData;
            if (selectedGrupo) {
                filteredLocalData = rawLocalData.filter(item => item.item_grupo === selectedGrupo || item.grupo === selectedGrupo);
                console.log(`[FILTRO] De ${rawLocalData.length} items, ${filteredLocalData.length} pertenecen al grupo "${selectedGrupo}"`);
            }

            // Agrupar Local por Código Item
            const localMap = {};
            filteredLocalData.forEach(item => {
                const codigo = String(item.item).trim();
                const cant = parseFloat(item.conteo_cantidad) || 0;
                if (!localMap[codigo]) {
                    localMap[codigo] = { 
                        descripcion: item.descripcion || '', 
                        cantidad: 0 
                    };
                }
                localMap[codigo].cantidad += cant;
                // Guardar la descripción más completa que encontremos
                if (item.descripcion && item.descripcion.length > localMap[codigo].descripcion.length) {
                    localMap[codigo].descripcion = item.descripcion;
                }
            });

            // 2. Obtener Inventario SIESA (Estrategia Optimizada)
            let siesaData = [];
            const itemsToFetch = Object.keys(localMap);
            const totalItems = itemsToFetch.length;

            if (totalItems === 0) {
                throw new Error("No hay items contados para comparar.");
            }

            // ESTRATEGIA: Auditoría Parcial por Lotes (Batch)
            // Es la estrategia más eficiente cuando se comparan solo los items contados (ej. 100-5000)
            // en lugar de descargar la base de datos completa de SIESA (15,000+ registros).
            
            setProgress(`Consultando ${totalItems} items en SIESA (Modo Batch)...`);
            
            try {
                siesaData = await getSiesaStockBatch(
                    itemsToFetch, 
                    (done, total) => setProgress(`Verificando item ${done} de ${total}...`),
                    selectedCompany,     // Filtro CIA
                    selectedSiesaBodega  // Filtro Bodega (Optimización)
                );
            } catch (err) {
                console.error("Error en batch Siesa:", err);
                throw new Error("Falló la consulta de items a SIESA. " + err.message);
            }

            // 3. Procesar y Comparar (Lógica Parcial: Solo lo que existe en Local)
            setProgress("Cruzando información...");
            const report = [];
            let cMatch = 0, cDiff = 0, cMissingSiesa = 0, cMissingCount = 0;

            // Indexar Siesa para búsqueda rápida O(1)
            const siesaMap = {};
            
            // Helper para claves insensitivas
            const getProp = (obj, keyPart) => {
                const key = Object.keys(obj).find(k => k.toLowerCase().includes(keyPart.toLowerCase()));
                return key ? obj[key] : undefined;
            };

            siesaData.forEach(row => {
                const itemCode = String(row.f120_id || getProp(row, 'referencia') || getProp(row, 'id_item') || '').trim();
                const exist1 = parseFloat(row.f400_cant_existencia_1 || getProp(row, 'existencia') || 0);
                const pos1 = parseFloat(row.f400_cant_pos_1 || 0); 
                const stock = exist1 - pos1;
                const desc = row.f120_descripcion || getProp(row, 'descripcion') || '';

                // Filtros de Seguridad (Aunque la API ya debió filtrar)
                const rowCia = String(row.f120_id_cia || '').trim();
                if (selectedCompany && rowCia && rowCia !== String(selectedCompany)) return; 

                const rowBodega = String(row.f150_id || row.IdBodega || '').trim();
                if (selectedSiesaBodega && rowBodega && rowBodega !== String(selectedSiesaBodega)) return;

                if (!itemCode) return;

                if (!siesaMap[itemCode]) {
                    siesaMap[itemCode] = { cantidad: 0, descripcion: desc };
                }
                siesaMap[itemCode].cantidad += stock;
            });

            // Comparación: Solo iteramos sobre Local Map (Auditoria Parcial)
            // Esto cumple el requisito "Solo items contados"
            Object.keys(localMap).forEach(code => {
                const localInfo = localMap[code];
                const siesaInfo = siesaMap[code];
                
                const cantLocal = localInfo.cantidad;
                const cantSiesa = siesaInfo ? siesaInfo.cantidad : 0;
                const diff = cantLocal - cantSiesa;

                let estado = 'match';
                if (!siesaInfo) estado = 'missing_siesa';
                else if (diff !== 0) estado = 'diff';

                if (estado === 'match') cMatch++;
                if (estado === 'diff') cDiff++;
                if (estado === 'missing_siesa') cMissingSiesa++;

                report.push({
                    codigo: code,
                    descripcion: localInfo.descripcion || (siesaInfo?.descripcion || 'Sin Descripción'),
                    conteo: cantLocal,
                    siesa: cantSiesa,
                    diff: diff,
                    estado: estado
                });
            });

            // NOTA: 'missing_sys' (En Siesa pero no en conteo) se omite en este modo por defecto.
            
            setStats({ match: cMatch, diff: cDiff, missingSiesa: cMissingSiesa, missingCount: 0 });
            setComparacionData(report);
            setVisibleLimit(100); // Resetear paginación
            toast.success("Comparación completada (Solo items contados)");

        } catch (error) {
            console.error(error);
            Swal.fire('Error', error.message, 'error');
        } finally {
            setLoading(false);
            setProgress("");
        }
    };

    return (
        <div className="comp-siesa-container">
            <div className="comp-siesa-header">
                <h2>📊 Comparación de Inventario vs SIESA (ERP)</h2>
                <p>Verificación en tiempo real del inventario físico contado contra el teórico en SIESA.</p>
            </div>

            <div className="comp-siesa-controls">
                <div className="comp-siesa-control-group">
                    <label>Compañía:</label>
                    <select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}>
                        <option value="">-- Seleccionar Compañía --</option>
                        {companies.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                </div>

                <div className="comp-siesa-control-group">
                    <label>Bodega (Siesa):</label>
                    <select value={selectedSiesaBodega} onChange={e => setSelectedSiesaBodega(e.target.value)}>
                        <option value="">-- Todas / Sin Filtro --</option>
                        {siesaBodegasOptions.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                    </select>
                </div>

                <div className="comp-siesa-control-group">
                    <label>Categoría/Grupo:</label>
                    <select value={selectedGrupo} onChange={e => setSelectedGrupo(e.target.value)}>
                        <option value="">-- Todas las categorías --</option>
                        {gruposOptions.map((g, idx) => <option key={idx} value={g}>{g}</option>)}
                    </select>
                </div>

                <div className="comp-siesa-control-group">
                    <label>Bodega (Local):</label>
                    <select value={selectedBodega} onChange={e => setSelectedBodega(e.target.value)}>
                        <option value="">-- Seleccionar Bodega --</option>
                        {bodegas.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                    </select>
                </div>
                
                <div className="comp-siesa-control-group highlight-date">
                    <label>📅 Fecha Corte Siesa:</label>
                    <input 
                        type="text" 
                        value={fechaCorte} 
                        onChange={e => setFechaCorte(e.target.value)}
                        placeholder="YYYYMMDD"
                        maxLength={8}
                    />
                    <small className="comp-siesa-hint">Formato: AAAA MM DD (Ej: 20260127)</small>
                </div>
                
                <button 
                    className="comp-siesa-btn-comparar" 
                    onClick={handleComparar}
                    disabled={loading}
                >
                    {loading ? 'Procesando...' : '🔄 Ejecutar Comparación'}
                </button>
            </div>

            {loading && <div className="comp-siesa-progress">{progress}</div>}

            {comparacionData && (
                <div className="comp-siesa-results">
                    {/* Tarjetas de Estadísticas */}
                    <div className="comp-siesa-stats-row">
                        <div className="comp-siesa-stat-card match" onClick={() => setFilterState(filterState === 'match' ? 'all' : 'match')} style={{cursor: 'pointer', border: filterState === 'match' ? '2px solid #3b82f6' : 'none'}}>
                            <h3>✅ Coinciden</h3>
                            <div className="value">{stats.match}</div>
                        </div>
                        <div className="comp-siesa-stat-card diff" onClick={() => setFilterState(filterState === 'diff' ? 'all' : 'diff')} style={{cursor: 'pointer', border: filterState === 'diff' ? '2px solid #ef4444' : 'none'}}>
                            <h3>⚠️ Diferencias</h3>
                            <div className="value">{stats.diff}</div>
                        </div>
                        <div className="comp-siesa-stat-card missing" onClick={() => setFilterState(filterState === 'missing_siesa' ? 'all' : 'missing_siesa')} style={{cursor: 'pointer', border: filterState === 'missing_siesa' ? '2px solid #f59e0b' : 'none'}}>
                            <h3>❓ Solo en Conteo</h3>
                            <div className="value">{stats.missingSiesa}</div>
                        </div>
                    </div>

                    {/* Toolbar de Filtros de Tabla */}
                    <div className="comp-siesa-table-tools" style={{ display: 'flex', gap: '15px', marginBottom: '15px', padding: '15px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', flexWrap: 'wrap' }}>
                         <div className="tool-group" style={{ flex: 1, minWidth: '200px' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>🔍 Buscar por Código o Descripción:</label>
                            <input 
                                type="text" 
                                placeholder="Escribe para buscar..." 
                                value={filterText}
                                onChange={e => setFilterText(e.target.value)}
                                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                            />
                         </div>
                         
                         <div className="tool-group" style={{ minWidth: '200px' }}>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px', color: '#6b7280' }}>🌪️ Ordenar Por:</label>
                            <select 
                                value={sortConfig.key} 
                                onChange={e => handleSort(e.target.value)}
                                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                            >
                                <option value="diff">Diferencia (Real)</option>
                                <option value="diff_abs">Magnitud Diferencia (Absoluto)</option>
                                <option value="conteo">Mayor Conteo Fisico</option>
                                <option value="siesa">Mayor Stock Siesa</option>
                                <option value="codigo">Código</option>
                            </select>
                         </div>

                         <div className="tool-group" style={{ display: 'flex', alignItems: 'end' }}>
                             <button 
                                onClick={() => setSortConfig(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }))}
                                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer' }}
                                title="Cambiar dirección del ordenamiento"
                             >
                                 {sortConfig.direction === 'asc' ? '⬆️ Ascendente' : '⬇️ Descendente'}
                             </button>
                         </div>
                    </div>

                    <div className="comp-siesa-table-container">
                        <table className="comp-siesa-table">
                            <thead>
                                <tr>
                                    <th onClick={() => handleSort('codigo')} style={{ cursor: 'pointer' }}>Código {sortConfig.key === 'codigo' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                    <th>Descripción</th>
                                    <th onClick={() => handleSort('conteo')} style={{ cursor: 'pointer' }}>Conteo Físico {sortConfig.key === 'conteo' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                    <th onClick={() => handleSort('siesa')} style={{ cursor: 'pointer' }}>Stock SIESA {sortConfig.key === 'siesa' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                    <th onClick={() => handleSort('diff')} style={{ cursor: 'pointer' }}>Diferencia {sortConfig.key === 'diff' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {getProcessedData().slice(0, visibleLimit).map((row, idx) => ( 
                                    <tr key={idx} className={`row-${row.estado}`}>
                                        <td>{row.codigo}</td>
                                        <td>{row.descripcion}</td>
                                        <td>{row.conteo}</td>
                                        <td>{row.siesa}</td>
                                        <td style={{
                                            fontWeight: 'bold',
                                            color: row.diff === 0 ? 'green' : row.diff < 0 ? 'red' : 'orange'
                                        }}>
                                            {row.diff > 0 ? `+${row.diff}` : row.diff}
                                        </td>
                                        <td>
                                            {row.estado === 'match' && <span className="comp-siesa-badge match">OK</span>}
                                            {row.estado === 'diff' && <span className="comp-siesa-badge diff">Diferencia</span>}
                                            {row.estado === 'missing_siesa' && <span className="comp-siesa-badge warn">No en SIESA</span>}
                                            {row.estado === 'missing_sys' && <span className="comp-siesa-badge sys">Solo Siesa</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        
                        {getProcessedData().length > visibleLimit ? (
                             <div className="comp-siesa-load-more" style={{ textAlign: 'center', padding: '20px' }}>
                                <p style={{ marginBottom: '10px', color: '#6b7280' }}>Mostrando {visibleLimit} de {getProcessedData().length} registros.</p>
                                <button 
                                    onClick={() => setVisibleLimit(prev => prev + 500)}
                                    style={{
                                        padding: '10px 20px',
                                        background: 'white',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        color: '#374151',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                    }}
                                >
                                    ⬇️ Cargar 500 más
                                </button>
                             </div>
                        ) : (
                            <div className="comp-siesa-table-footer-msg" style={{ textAlign: 'center', padding: '15px', color: '#9ca3af', fontStyle: 'italic' }}>
                                Fin de los resultados ({getProcessedData().length} registros).
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ComparacionSiesa;