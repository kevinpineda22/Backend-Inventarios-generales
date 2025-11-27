import React, { useState, useMemo, useEffect } from 'react';
import { Sparkles, X, Bot, User, Warehouse, BarChart3, AlertTriangle, CheckCircle, TrendingUp, Package, Clock, Users } from 'lucide-react';
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
                  <div className="ia-kpi-grid">
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
                      <span className="ia-kpi-label"><AlertTriangle size={14} /> Tasa de Reconteos</span>
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
                  </div>

                  {/* RESUMEN EJECUTIVO */}
                  <div className="ia-section">
                    <h3 className="ia-section-title"><Sparkles size={18} /> Resumen Ejecutivo</h3>
                    <ReactMarkdown>{reportData.resumenEjecutivo}</ReactMarkdown>
                  </div>

                  {/* ANOMALIAS (GRID) */}
                  {reportData.anomalias?.length > 0 && (
                    <div className="ia-section">
                      <h3 className="ia-section-title" style={{color: '#ef4444'}}><AlertTriangle size={18} /> Anomalías Detectadas</h3>
                      <div className="ia-card-grid">
                        {reportData.anomalias.map((anomalia, idx) => (
                          <div key={idx} className="ia-anomaly-card">
                            <div className="ia-anomaly-header">
                              <span>{anomalia.ubicacion}</span>
                            </div>
                            <div className="ia-anomaly-body">
                              <strong>Situación:</strong> {anomalia.situacion}
                            </div>
                            <div className="ia-anomaly-action">
                              Recomendación: {anomalia.accion}
                            </div>
                          </div>
                        ))}
                      </div>
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
