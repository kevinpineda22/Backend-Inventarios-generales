import { useState, useEffect } from 'react';
import './ComparacionSiesa.css';
import { toast } from 'react-toastify';
// Import services if needed, e.g., inventarioGeneralService
import { inventarioGeneralService } from '../../services/inventarioGeneralService';

const ComparacionSiesa = () => {
    const [loading, setLoading] = useState(false);
    const [comparacionData, setComparacionData] = useState(null);
    const [stats, setStats] = useState({ match: 0, diff: 0, missingSiesa: 0, missingCount: 0 });

    // Estado para filtros o configuracion de la conexion
    const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'disconnected', 'connected', 'error'

    const handleComparar = async () => {
        setLoading(true);
        try {
            // AQUI IRIA LA LLAMADA AL SERVICIO QUE HACE LA COMPARACION
            // Por ahora simulamos una demora
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // TODO: Implementar llamada real a: inventarioService.compararConSiesa()
            
            // Mock Data
            const mockData = [
                { codigo: '1001', descripcion: 'Coca Cola 1.5L', conteo: 50, siesa: 50, diff: 0, estado: 'match' },
                { codigo: '1002', descripcion: 'Arroz Diana 1kg', conteo: 100, siesa: 120, diff: -20, estado: 'diff' },
                { codigo: '1003', descripcion: 'Aceite Gourmet', conteo: 30, siesa: 0, diff: 30, estado: 'missing_siesa' },
                // ... más datos
            ];
            
            setComparacionData(mockData);
            setStats({
                match: 1,
                diff: 1,
                missingSiesa: 1,
                missingCount: 0
            });
            
            toast.success("Comparación realizada correctamente");

        } catch (error) {
            console.error(error);
            toast.error("Error al conectar con SIESA");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="comparacion-siesa-container">
            <div className="cs-header">
                <h2>📊 Comparación de Inventario vs SIESA (ERP)</h2>
                <p>Verificación en tiempo real del inventario físico contado contra el teórico en SIESA.</p>
            </div>

            <div className="cs-controls">
                <div className="cs-status-card">
                    <span className="api-status-label">Estado de Conexión:</span>
                    <span className={`api-status-indicator ${connectionStatus}`}>
                        {connectionStatus === 'connected' ? '🟢 Conectado' : '🔴 Desconectado (Simulado)'}
                    </span>
                </div>
                
                <button 
                    className="btn-comparar" 
                    onClick={handleComparar}
                    disabled={loading}
                >
                    {loading ? 'Procesando...' : '🔄 Ejecutar Comparación'}
                </button>
            </div>

            {comparacionData && (
                <div className="cs-results">
                    <div className="cs-stats-row">
                        <div className="stat-card match">
                            <h3>✅ Coinciden</h3>
                            <div className="value">{stats.match}</div>
                        </div>
                        <div className="stat-card diff">
                            <h3>⚠️ Diferencias</h3>
                            <div className="value">{stats.diff}</div>
                        </div>
                        <div className="stat-card missing">
                            <h3>❓ Solo en Conteo</h3>
                            <div className="value">{stats.missingSiesa}</div>
                        </div>
                        <div className="stat-card missing-sys">
                            <h3>📉 Solo en SIESA</h3>
                            <div className="value">{stats.missingCount}</div>
                        </div>
                    </div>

                    <div className="cs-table-container">
                        <table className="cs-table">
                            <thead>
                                <tr>
                                    <th>Código</th>
                                    <th>Descripción</th>
                                    <th>Conteo Físico</th>
                                    <th>Stock SIESA</th>
                                    <th>Diferencia</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {comparacionData.map((row, idx) => (
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
                                            {row.estado === 'match' && <span className="badge match">OK</span>}
                                            {row.estado === 'diff' && <span className="badge diff">Diferencia</span>}
                                            {row.estado === 'missing_siesa' && <span className="badge warn">No en SIESA</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ComparacionSiesa;