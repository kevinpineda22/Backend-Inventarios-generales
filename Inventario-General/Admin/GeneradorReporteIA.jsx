import React, { useState, useMemo, useEffect } from 'react';
import { Sparkles, X, Bot, User, Warehouse, BarChart3, AlertTriangle, CheckCircle, TrendingUp, Package, Clock, Users, Download, ChevronLeft, ChevronRight, Activity } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import './GeneradorReporteIA.css';
import { inventarioGeneralService as inventarioService } from '../../services/inventarioGeneralService';
import { supabase } from '../../supabaseClient';

const GeneradorReporteIA = ({ isOpen, onClose, conteos: initialConteos = [], bodegas: initialBodegas = [] }) => {
  const [reportData, setReportData] = useState(null); // Puede ser string (markdown) o objeto (JSON)
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('input'); // 'input' | 'loading' | 'result'
  const [mode, setMode] = useState('bodega'); // 'bodega' | 'operador'
  
  // Estado para manejo autónomo de datos (si no se pasan props)
  const [internalConteos, setInternalConteos] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [loadingData, setLoadingData] = useState(false);

  const [selectedBodega, setSelectedBodega] = useState('');
  const [selectedOperator, setSelectedOperator] = useState('');
  const [showJson, setShowJson] = useState(false);
  
  // Paginación de Anomalías
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  
  // Mapa de usuarios (Correo -> Nombre)
  const [userMap, setUserMap] = useState({});
  const [profilesList, setProfilesList] = useState([]); // Nuevo estado para lista cruda

  // Cargar perfiles de usuario al iniciar
  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const { data, error } = await supabase.from('profiles').select('user_id, correo, nombre');
        if (!error && data) {
          setProfilesList(data); // Guardar lista completa para enviarla al backend
          const map = {};
          data.forEach(p => {
            if (p.correo) map[p.correo] = p.nombre;
          });
          setUserMap(map);
        }
      } catch (e) {
        console.warn("No se pudo cargar mapa de usuarios", e);
      }
    };
    fetchProfiles();
  }, []);

  // Determinar si estamos en modo autónomo (sin datos iniciales)
  const isStandalone = initialConteos.length === 0;
  const conteos = isStandalone ? internalConteos : initialConteos;

  const companies = [
    { id: '1', nombre: 'Merkahorro' },
    { id: '2', nombre: 'Megamayorista' },
    { id: '3', nombre: 'Construahorro' },
  ];

  // Cargar datos si se selecciona una compañía en modo autónomo
  useEffect(() => {
    if (isStandalone && selectedCompany) {
      const fetchData = async () => {
        setLoadingData(true);
        try {
          const data = await inventarioService.obtenerHistorialConteos(selectedCompany, {});
          setInternalConteos(data);
        } catch (error) {
          console.error('Error fetching data for AI report:', error);
        } finally {
          setLoadingData(false);
        }
      };
      fetchData();
    }
  }, [selectedCompany, isStandalone]);

  // Extraer lista de bodegas únicas
  const bodegas = useMemo(() => {
    if (!isStandalone) return initialBodegas;
    return [...new Set(conteos.map(c => c.bodega))].sort();
  }, [conteos, initialBodegas, isStandalone]);

  // Extraer lista de operadores únicos de los conteos
  const operators = useMemo(() => {
    const ops = new Set();
    conteos.forEach(c => {
      if (c.usuario_nombre) {
        // Si estamos en modo operador y hay una bodega seleccionada, filtrar
        if (mode === 'operador' && selectedBodega && c.bodega !== selectedBodega) {
          return;
        }
        ops.add(c.usuario_nombre);
      }
    });
    return Array.from(ops).sort();
  }, [conteos, selectedBodega, mode]);

  // Paginación Logic
  const anomalies = reportData?.anomalias || [];
  const totalPages = Math.ceil(anomalies.length / itemsPerPage);
  const currentAnomalies = anomalies.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleExportAnomalies = () => {
    if (!anomalies.length) return;
    const csvContent = "data:text/csv;charset=utf-8," 
        + "Ubicacion,Producto,Situacion,Accion\n"
        + anomalies.map(a => `"${a.ubicacion}","${a.producto || ''}","${a.situacion}","${a.accion}"`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "anomalias_inventario.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  const calculateOperatorStatsAsync = async (operatorName, bodegaFilter) => {
    // Filtrar conteos del operador (C1 o C2)
    const operatorCounts = conteos.filter(c => 
      c.usuario_nombre === operatorName && 
      (c.tipo_conteo === 1 || c.tipo_conteo === 2) &&
      (!bodegaFilter || c.bodega === bodegaFilter)
    );

    let totalItemsCounted = 0;
    let matches = 0;
    const errorLocations = [];

    // Procesar comparaciones en paralelo para mayor precisión (consultando items reales)
    const comparisons = await Promise.all(operatorCounts.map(async (opCount) => {
      // Buscar el conteo final para esta misma ubicación
      const finalCount = conteos.find(c => 
        c.tipo_conteo === 4 && // Conteo Final
        c.bodega === opCount.bodega &&
        c.zona === opCount.zona &&
        c.pasillo === opCount.pasillo &&
        c.ubicacion === opCount.ubicacion
      );

      if (!finalCount) return { status: 'no-final' };

      try {
        // Obtener detalles para comparación precisa de cantidades
        const [opItems, finalItems] = await Promise.all([
          inventarioService.obtenerDetalleConteo(opCount.id),
          inventarioService.obtenerDetalleConteo(finalCount.id)
        ]);

        // Calcular suma total de cantidades (no solo filas)
        const opTotal = opItems.reduce((sum, item) => sum + Number(item.cantidad), 0);
        const finalTotal = finalItems.reduce((sum, item) => sum + Number(item.cantidad), 0);

        return {
          status: 'compared',
          opCount,
          opTotal,
          finalTotal
        };
      } catch (err) {
        console.error("Error comparando detalles:", err);
        return { status: 'error' };
      }
    }));

    comparisons.forEach(res => {
      if (res.status === 'compared') {
        totalItemsCounted += res.opTotal;
        
        if (res.opTotal === res.finalTotal) {
          matches++;
        } else {
          errorLocations.push({
            location: `${res.opCount.zona}-${res.opCount.pasillo}-${res.opCount.ubicacion}`,
            counted: res.opTotal,
            real: res.finalTotal,
            item: 'Total Unidades'
          });
        }
      }
    });

    const totalComparisons = matches + errorLocations.length;
    const accuracyRate = totalComparisons > 0 ? ((matches / totalComparisons) * 100).toFixed(1) : 0;

    return {
      operatorName,
      totalLocations: operatorCounts.length,
      totalItemsCounted,
      accuracyRate,
      errorLocations
    };
  };

  const generateReport = async () => {
    if (mode === 'bodega' && !selectedBodega) {
      alert('Por favor selecciona una bodega');
      return;
    }
    if (mode === 'operador' && !selectedOperator) {
      alert('Por favor selecciona un operador');
      return;
    }

    setLoading(true);
    setStep('loading');

    try {
      let reportContent;

      if (mode === 'bodega') {
        reportContent = await inventarioService.generarReporteIA({
          bodega: selectedBodega,
          profiles: profilesList // Enviar perfiles al backend
        });
      } else {
        // Modo Operador: Calcular estadísticas PRECISAS (Async)
        const stats = await calculateOperatorStatsAsync(selectedOperator, selectedBodega);
        
        if (stats.totalLocations === 0) {
          throw new Error('No hay suficientes datos de conteo para este operador en la bodega seleccionada.');
        }

        reportContent = await inventarioService.generarReporteIA({
          reportType: 'operator',
          analysisData: stats,
          bodega: selectedBodega, // Enviar bodega si se seleccionó
          profiles: profilesList // Enviar perfiles al backend
        });
      }

      // Intentar parsear JSON para el nuevo dashboard visual
      try {
        const parsed = JSON.parse(reportContent);
        setReportData(parsed);
      } catch (e) {
        // Si falla (o es el reporte de operador que aun es texto plano), usar como string
        setReportData(reportContent);
      }
      
      setStep('result');

    } catch (error) {
      alert('Error al generar reporte: ' + error.message);
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ia-report-modal">
      <div className="ia-report-content">
        <div className="ia-report-header">
          <h3>
            <Sparkles size={24} color="#c084fc" />
            Analista IA de Inventario
          </h3>
          <button onClick={onClose} style={{background:'none', border:'none', color:'white', cursor:'pointer'}}>
            <X size={24} />
          </button>
        </div>

        <div className="ia-report-body">
          {step === 'input' && (
            <div className="ia-input-container">
              <div className="ia-mode-selector">
                <button 
                  className={`ia-mode-btn ${mode === 'bodega' ? 'active' : ''}`}
                  onClick={() => setMode('bodega')}
                >
                  <Warehouse size={20} />
                  Reporte de Bodega
                </button>
                <button 
                  className={`ia-mode-btn ${mode === 'operador' ? 'active' : ''}`}
                  onClick={() => setMode('operador')}
                >
                  <User size={20} />
                  Desempeño Operador
                </button>
              </div>

              <div className="ia-form-section">
                <Bot size={48} color="#6366f1" style={{marginBottom: '1rem'}} />
                <h2>Configurar Análisis</h2>

                {isStandalone && (
                  <div style={{width: '100%', marginBottom: '1rem'}}>
                    <label style={{display: 'block', textAlign: 'left', marginBottom: '5px', fontSize: '0.9rem', color: '#64748b'}}>1. Seleccionar Compañía</label>
                    <select 
                      className="ia-select"
                      value={selectedCompany}
                      onChange={(e) => {
                        setSelectedCompany(e.target.value);
                        setSelectedBodega('');
                        setSelectedOperator('');
                      }}
                      style={{marginBottom: '0.5rem'}}
                    >
                      <option value="">-- Seleccionar --</option>
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                    {loadingData && <span style={{fontSize: '0.8rem', color: '#6366f1'}}>Cargando datos...</span>}
                  </div>
                )}
                
                {mode === 'bodega' ? (
                  <>
                    <p className="ia-description">
                      Analiza el estado general, avance y hallazgos críticos de una bodega completa.
                    </p>
                    <select 
                      className="ia-select"
                      value={selectedBodega}
                      onChange={(e) => setSelectedBodega(e.target.value)}
                      disabled={isStandalone && !selectedCompany}
                    >
                      <option value="">-- Seleccionar Bodega --</option>
                      {bodegas.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </>
                ) : (
                  <>
                    <p className="ia-description">
                      Evalúa la precisión, velocidad y errores de un operador específico comparando con el conteo final.
                    </p>
                    
                    <select 
                      className="ia-select"
                      value={selectedBodega}
                      onChange={(e) => setSelectedBodega(e.target.value)}
                      disabled={isStandalone && !selectedCompany}
                    >
                      <option value="">-- Todas las Bodegas --</option>
                      {bodegas.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>

                    <select 
                      className="ia-select"
                      value={selectedOperator}
                      onChange={(e) => setSelectedOperator(e.target.value)}
                      disabled={isStandalone && !selectedCompany}
                    >
                      <option value="">-- Seleccionar Operador --</option>
                      {operators.map(op => (
                        <option key={op} value={op}>
                          {userMap[op] || op.split('@')[0]}
                        </option>
                      ))}
                    </select>
                  </>
                )}

                <button 
                  className="ia-btn-generate"
                  onClick={generateReport}
                  disabled={(mode === 'bodega' ? !selectedBodega : !selectedOperator) || (isStandalone && !selectedCompany)}
                >
                  <Sparkles size={18} />
                  Generar Análisis
                </button>
              </div>
            </div>
          )}

          {step === 'loading' && (
            <div className="ia-loading">
              <div className="ia-spinner"></div>
              <h3>Analizando datos...</h3>
              <p>{mode === 'bodega' 
                ? `Procesando métricas de ${selectedBodega}` 
                : `Auditando conteos de ${userMap[selectedOperator] || selectedOperator?.split('@')[0]}`
              }</p>
            </div>
          )}

          {step === 'result' && (
            <div className="ia-markdown-content">
              {typeof reportData === 'string' ? (
                <ReactMarkdown>{reportData}</ReactMarkdown>
              ) : (
                <div className="ia-dashboard">
                  {/* KPI GRID */}
                  <div className="ia-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                    <div className="ia-kpi-card">
                      <span className="ia-kpi-label"><Package size={14} /> Total Unidades</span>
                      <span className="ia-kpi-value">{reportData.kpis?.totalUnidades}</span>
                      <span className="ia-kpi-sub">Inventario Físico Real</span>
                    </div>
                    <div className="ia-kpi-card">
                      <span className="ia-kpi-label"><TrendingUp size={14} /> Esfuerzo Operativo</span>
                      <span className="ia-kpi-value">{reportData.kpis?.esfuerzoOperativo}</span>
                      <span className="ia-kpi-sub">Items contados (incl. reconteos)</span>
                    </div>
                    <div className="ia-kpi-card">
                      <span className="ia-kpi-label"><AlertTriangle size={14} /> Tasa de Error</span>
                      <span className="ia-kpi-value" style={{color: reportData.kpis?.tasaDiscrepancia > 10 ? '#ef4444' : '#10b981'}}>
                        {reportData.kpis?.tasaDiscrepancia}%
                      </span>
                      <span className="ia-kpi-sub">Ubicaciones con diferencias</span>
                    </div>
                    <div className="ia-kpi-card">
                      <span className="ia-kpi-label"><Clock size={14} /> Velocidad</span>
                      <span className="ia-kpi-value">{reportData.kpis?.velocidad}</span>
                      <span className="ia-kpi-sub">Items / Hora</span>
                    </div>
                    {/* NUEVOS KPIs */}
                    <div className="ia-kpi-card">
                      <span className="ia-kpi-label"><CheckCircle size={14} /> Efectividad T1</span>
                      <span className="ia-kpi-value">{reportData.kpis?.efectividadConteo1}%</span>
                      <span className="ia-kpi-sub">Reconteos = Conteo 1</span>
                    </div>
                    <div className="ia-kpi-card">
                      <span className="ia-kpi-label"><CheckCircle size={14} /> Efectividad T2</span>
                      <span className="ia-kpi-value">{reportData.kpis?.efectividadConteo2}%</span>
                      <span className="ia-kpi-sub">Reconteos = Conteo 2</span>
                    </div>
                    <div className="ia-kpi-card">
                      <span className="ia-kpi-label"><AlertTriangle size={14} /> Prom. Diferencia</span>
                      <span className="ia-kpi-value">{reportData.kpis?.promedioDiferencias}</span>
                      <span className="ia-kpi-sub">Unidades por ubicación</span>
                    </div>
                    <div className="ia-kpi-card">
                      <span className="ia-kpi-label"><Activity size={14} /> Confidence Score</span>
                      <span className="ia-kpi-value">{reportData.kpis?.confidenceScore}/100</span>
                      <span className="ia-kpi-sub">Calidad del Inventario</span>
                    </div>
                  </div>

                  {/* RESUMEN EJECUTIVO */}
                  <div className="ia-section">
                    <h3 className="ia-section-title"><Sparkles size={18} /> Resumen Ejecutivo</h3>
                    <ReactMarkdown>{reportData.resumenEjecutivo}</ReactMarkdown>
                  </div>

                  {/* ANOMALIAS (GRID) */}
                  {reportData.anomalias?.length > 0 && (
                    <div className="ia-section">
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                        <h3 className="ia-section-title" style={{color: '#ef4444', margin: 0}}><AlertTriangle size={18} /> Anomalías Detectadas</h3>
                        <button onClick={handleExportAnomalies} className="ia-btn-export" title="Descargar CSV">
                          <Download size={16} /> Exportar
                        </button>
                      </div>
                      
                      <div className="ia-card-grid">
                        {currentAnomalies.map((anomalia, idx) => (
                          <div key={idx} className="ia-anomaly-card">
                            <div className="ia-anomaly-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                              <span>{anomalia.ubicacion}</span>
                              {anomalia.prioridad && (
                                <span style={{
                                  fontSize: '0.7rem', 
                                  padding: '2px 6px', 
                                  borderRadius: '4px', 
                                  background: anomalia.prioridad === 'alta' ? '#fee2e2' : '#fef3c7',
                                  color: anomalia.prioridad === 'alta' ? '#b91c1c' : '#b45309',
                                  textTransform: 'uppercase',
                                  fontWeight: 'bold'
                                }}>
                                  {anomalia.prioridad}
                                </span>
                              )}
                            </div>
                            {anomalia.producto && (
                              <div className="ia-anomaly-product" style={{fontSize: '0.85rem', color: '#6366f1', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px'}}>
                                <Package size={12} /> {anomalia.producto}
                              </div>
                            )}
                            <div className="ia-anomaly-body">
                              <strong>Situación:</strong> {anomalia.situacion}
                            </div>
                            <div className="ia-anomaly-action">
                              Recomendación: {anomalia.accion}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <div className="ia-pagination" style={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem'}}>
                          <button 
                            disabled={currentPage === 1} 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className="ia-page-btn"
                            style={{background: 'white', border: '1px solid #e2e8f0', padding: '0.5rem', borderRadius: '8px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1}}
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <span className="ia-page-info" style={{fontSize: '0.9rem', color: '#64748b'}}>
                            Página {currentPage} de {totalPages}
                          </span>
                          <button 
                            disabled={currentPage === totalPages} 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            className="ia-page-btn"
                            style={{background: 'white', border: '1px solid #e2e8f0', padding: '0.5rem', borderRadius: '8px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1}}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ACCIONES (LIST) */}
                  {reportData.acciones?.length > 0 && (
                    <div className="ia-section">
                      <h3 className="ia-section-title" style={{color: '#10b981'}}><CheckCircle size={18} /> Plan de Acción Inmediato</h3>
                      <div className="ia-action-list">
                        {reportData.acciones.map((accion, idx) => (
                          <div key={idx} className="ia-action-item">
                            <div className="ia-action-actor">{accion.actor}</div>
                            <div className="ia-action-desc">{accion.accion}</div>
                            <div className="ia-action-impact">Impacto: {accion.impacto}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ITEMS CON MAYOR RECONTEO (NUEVO) */}
                  {reportData.topRecountedItems?.length > 0 && (
                    <div className="ia-section">
                      <h3 className="ia-section-title"><Package size={18} /> Items con Mayor Reconteo</h3>
                      <div className="ia-card-grid">
                        {reportData.topRecountedItems.map((item, idx) => (
                          <div key={idx} className="ia-anomaly-card" style={{borderLeft: '4px solid #f59e0b'}}>
                            <div className="ia-anomaly-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                              <span style={{fontWeight: 'bold', color: '#1e293b'}}>{item.name}</span>
                              <span style={{
                                fontSize: '0.8rem', 
                                padding: '2px 8px', 
                                borderRadius: '12px', 
                                background: '#fef3c7',
                                color: '#b45309',
                                fontWeight: 'bold'
                              }}>
                                {item.count} reconteos
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TENDENCIA DIARIA (NUEVO) */}
                  {reportData.reconteos_per_day?.length > 0 && (
                    <div className="ia-section">
                      <h3 className="ia-section-title"><BarChart3 size={18} /> Tendencia de Reconteos</h3>
                      <div style={{display: 'flex', alignItems: 'flex-end', height: '100px', gap: '8px', padding: '10px 0'}}>
                        {reportData.reconteos_per_day.map((d, i) => {
                          const max = Math.max(...reportData.reconteos_per_day.map(x => x.count));
                          const height = (d.count / max) * 80 + 10; // Min 10% height
                          return (
                            <div key={i} style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px'}}>
                              <div style={{width: '100%', height: `${height}%`, background: '#6366f1', borderRadius: '4px 4px 0 0', opacity: 0.8}}></div>
                              <span style={{fontSize: '0.7rem', color: '#64748b'}}>{d.date.slice(5)}</span>
                              <span style={{fontSize: '0.7rem', fontWeight: 'bold'}}>{d.count}</span>
                            </div>
                          );
                        })}
                      </div>
                      {reportData.trend_comment && (
                        <p style={{fontSize: '0.85rem', color: '#64748b', marginTop: '0.5rem', fontStyle: 'italic'}}>
                          Tendencia: {reportData.trend_comment}
                        </p>
                      )}
                    </div>
                  )}

                  {/* PRODUCTIVIDAD */}
                  <div className="ia-section">
                    <h3 className="ia-section-title"><Users size={18} /> Análisis de Productividad</h3>
                    <ReactMarkdown>{reportData.analisisProductividad}</ReactMarkdown>
                  </div>
                  
                  {/* CONCLUSION */}
                  <div className="ia-section" style={{marginTop: '1rem', padding: '1rem', background: '#f1f5f9', borderRadius: '8px'}}>
                    <strong>Conclusión Técnica:</strong> {reportData.conclusion}
                  </div>

                </div>
              )}

              <div style={{marginTop: '2rem', textAlign: 'center'}}>
                <button 
                  className="ia-btn-generate" 
                  onClick={() => setStep('input')}
                  style={{background: '#e2e8f0', color: '#475569', margin: '0 auto'}}
                >
                  Generar Nuevo Análisis
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GeneradorReporteIA;
