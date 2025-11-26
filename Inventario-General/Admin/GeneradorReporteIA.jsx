import React, { useState, useMemo, useEffect } from 'react';
import { Sparkles, X, Bot, User, Warehouse, BarChart3 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import './GeneradorReporteIA.css';
import { inventarioGeneralService as inventarioService } from '../../services/inventarioGeneralService';
import { supabase } from '../../supabaseClient';

const GeneradorReporteIA = ({ isOpen, onClose, conteos: initialConteos = [], bodegas: initialBodegas = [] }) => {
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('input'); // 'input' | 'loading' | 'result'
  const [mode, setMode] = useState('bodega'); // 'bodega' | 'operador'
  
  // Estado para manejo autónomo de datos (si no se pasan props)
  const [internalConteos, setInternalConteos] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [loadingData, setLoadingData] = useState(false);

  const [selectedBodega, setSelectedBodega] = useState('');
  const [selectedOperator, setSelectedOperator] = useState('');
  
  // Mapa de usuarios (Correo -> Nombre)
  const [userMap, setUserMap] = useState({});
  const [profilesList, setProfilesList] = useState([]); // Nuevo estado para lista cruda

  // Cargar perfiles de usuario al iniciar
  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const { data, error } = await supabase.from('profiles').select('id, correo, nombre');
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

      setReport(reportContent);
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
              <ReactMarkdown>{report}</ReactMarkdown>
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
