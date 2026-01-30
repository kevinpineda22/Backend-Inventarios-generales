import React from 'react';
import '../HistorialConteos.css';

const ComparativaModal = ({ 
    comparisonData, 
    closeComparison, 
    finalSelection, 
    setFinalSelection, 
    manualValues, 
    setManualValues, 
    handleGuardarAjuste, 
    loadingComparison 
}) => {
    const [editMode, setEditMode] = React.useState(false);

    // Calcular si hay items finalizados o estamos en modo "Solo Finalizados"
    const hasFinalData = React.useMemo(() => {
        if (!comparisonData || !comparisonData.items) return false;
        return comparisonData.items.some(i => i.c4 > 0);
    }, [comparisonData]);

    if (!comparisonData) return null;

    return (
        <div className="hc-modal-overlay">
          <div className="hc-modal-content-large">
            <div className="hc-modal-header">
              <h3>
                  Comparativa: {comparisonData.location.zona} - {comparisonData.location.pasillo} - {comparisonData.location.ubicacion}
                  {hasFinalData && <span className="badge-finalizado" style={{marginLeft:'10px', fontSize:'0.7em', background:'#27ae60', color:'white', padding:'2px 6px', borderRadius:'4px'}}>FINALIZADO</span>}
              </h3>
              <div style={{display:'flex', gap:'10px'}}>
                  <button 
                    onClick={() => setEditMode(!editMode)} 
                    className="hc-btn-edit"
                    style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: '1px solid #3498db',
                        background: editMode ? '#3498db' : 'transparent',
                        color: editMode ? 'white' : '#3498db',
                        cursor: 'pointer',
                        fontWeight: '600'
                    }}
                  >
                    {editMode ? '🔓 Edición Activa' : '✏️ Editar Todo'}
                  </button>
                  <button onClick={closeComparison} className="hc-close-btn">×</button>
              </div>
            </div>
            <div className="hc-modal-body">
              {comparisonData.loading ? (
                 <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'300px', gap:'1rem', color:'#64748b'}}>
                    <div className="hc-loading-spinner" style={{width:'40px', height:'40px'}}></div>
                    <p>Analizando discrepancias y cargando items...</p>
                 </div>
              ) : (
              <table className="hc-comparison-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Descripción</th>
                    <th className="hc-text-center">Conteo #1</th>
                    <th className="hc-text-center">Conteo #2</th>
                    <th className="hc-text-center">Diferencia</th>
                    <th className="hc-text-center">Reconteo</th>
                    <th className="hc-text-center">Conteo Final</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.items.map(item => {
                    const diff = item.c1 - item.c2;
                    const selectedSource = finalSelection[item.codigo];
                    let finalValue = '';
                    
                    if (selectedSource === 'c1') finalValue = item.c1;
                    else if (selectedSource === 'c2') finalValue = item.c2;
                    else if (selectedSource === 'c3') finalValue = item.c3;
                    else if (selectedSource === 'manual') finalValue = manualValues[item.codigo] || '';

                    return (
                      <tr key={item.codigo} className={diff !== 0 ? 'hc-diff-row' : ''}>
                        <td>{item.codigo}</td>
                        <td>{item.descripcion}</td>
                        <td className="hc-text-center">
                          {diff === 0 ? (
                            <span style={{color: '#27ae60', fontWeight: 'bold'}}>{item.c1}</span>
                          ) : (
                            <label className="hc-radio-label">
                              <input 
                                type="radio" 
                                name={`final-${item.codigo}`}
                                checked={selectedSource === 'c1'}
                                onChange={() => {
                                  setFinalSelection(prev => ({...prev, [item.codigo]: 'c1'}));
                                  setManualValues(prev => {
                                    const next = {...prev};
                                    delete next[item.codigo];
                                    return next;
                                  });
                                }}
                              />
                              {item.c1}
                            </label>
                          )}
                        </td>
                        <td className="hc-text-center">
                          {diff === 0 ? (
                            <span style={{color: '#27ae60', fontWeight: 'bold'}}>{item.c2}</span>
                          ) : (
                            <label className="hc-radio-label">
                              <input 
                                type="radio" 
                                name={`final-${item.codigo}`}
                                checked={selectedSource === 'c2'}
                                onChange={() => {
                                  setFinalSelection(prev => ({...prev, [item.codigo]: 'c2'}));
                                  setManualValues(prev => {
                                    const next = {...prev};
                                    delete next[item.codigo];
                                    return next;
                                  });
                                }}
                              />
                              {item.c2}
                            </label>
                          )}
                        </td>
                        <td className={`hc-text-center ${diff !== 0 ? 'hc-has-diff' : ''}`}>
                          {diff === 0 ? (
                            <span style={{color: '#27ae60'}}>OK</span>
                          ) : (
                            diff
                          )}
                        </td>
                        <td className="hc-text-center">
                          {item.c3 > 0 ? (
                            <label className="hc-radio-label">
                              <input 
                                type="radio" 
                                name={`final-${item.codigo}`}
                                checked={selectedSource === 'c3'}
                                onChange={() => {
                                  setFinalSelection(prev => ({...prev, [item.codigo]: 'c3'}));
                                  setManualValues(prev => {
                                    const next = {...prev};
                                    delete next[item.codigo];
                                    return next;
                                  });
                                }}
                              />
                              {item.c3}
                            </label>
                          ) : '-'
                          }
                        </td>
                        <td className="hc-text-center">
                          {diff === 0 && !editMode ? (
                             <span style={{fontWeight: 'bold', fontSize: '1.1em', color: '#27ae60'}}>{item.c1}</span>
                          ) : (
                            (() => {
                              // Lógica para mostrar texto verde si el reconteo resuelve la diferencia
                              const matchesC1orC2 = item.c3 > 0 && (item.c3 === item.c1 || item.c3 === item.c2);
                              const hasManualOverride = item.c4 > 0 && item.c4 !== item.c3;
                              
                              // Si NO estamos en modo edición Y coincide con C1 o C2 Y no hay un override manual diferente, mostramos texto verde
                              if (!editMode && matchesC1orC2 && !hasManualOverride) {
                                return (
                                  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'}}>
                                    <span style={{fontWeight: 'bold', fontSize: '1.1em', color: '#27ae60'}}>{item.c3}</span>
                                    <span title="Coincidencia con conteo anterior" style={{cursor: 'help', fontSize: '0.8em'}}>⚡</span>
                                  </div>
                                );
                              }
                              
                              // VALOR POR DEFECTO PARA EL INPUT (Pre-fill)
                              // Si hay ManualValues, usar eso. 
                              // Si no, y hay selección, usar valor de la selección.
                              // Si no, usar diff===0 ? c1 : c3.
                              let displayValue = finalValue;
                              if (editMode && displayValue === '' && manualValues[item.codigo] === undefined) {
                                  // Auto-sugerir el valor actual si empezamos a editar
                                  if (selectedSource === 'c1') displayValue = item.c1;
                                  else if (selectedSource === 'c2') displayValue = item.c2;
                                  else if (selectedSource === 'c3') displayValue = item.c3;
                                  else if (diff === 0) displayValue = item.c1;
                              }

                              return (
                                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'}}>
                                  <input 
                                    type="number"
                                    className="hc-manual-input"
                                    value={displayValue}
                                    placeholder={editMode ? "Nuevo..." : "Manual..."}
                                    style={editMode ? {borderColor: '#3498db', backgroundColor: '#f0f9ff'} : {}}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setFinalSelection(prev => ({...prev, [item.codigo]: 'manual'}));
                                      setManualValues(prev => ({...prev, [item.codigo]: val}));
                                    }}
                                    onClick={() => {
                                      if (selectedSource !== 'manual' || editMode) {
                                         setFinalSelection(prev => ({...prev, [item.codigo]: 'manual'}));
                                         
                                         // Si hacemos click y está vacío (o es inicio de edición), rellenar con el valor lógico
                                         if (!manualValues[item.codigo]) {
                                             let autoVal = displayValue;
                                             if (autoVal === '' || autoVal === undefined) {
                                                 if (item.c3 > 0) autoVal = item.c3;
                                                 else if (diff === 0) autoVal = item.c1;
                                             }
                                             setManualValues(prev => ({...prev, [item.codigo]: autoVal}));
                                         }
                                      }
                                    }}
                                  />
                                </div>
                              );
                            })()
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              )}
            </div>
            <div className="hc-modal-footer" style={{padding: '1.5rem 2rem', borderTop: '1px solid var(--hc-border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem'}}>
              <button onClick={closeComparison} className="hc-btn-cancel" style={{padding: '0.75rem 1.5rem', border: '1px solid var(--hc-border)', background: 'white', borderRadius: '8px', cursor: 'pointer'}}>
                Cancelar
              </button>
              <button 
                onClick={handleGuardarAjuste} 
                className="hc-btn-save" 
                style={{padding: '0.75rem 1.5rem', background: 'var(--hc-primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600'}}
                disabled={loadingComparison}
              >
                {loadingComparison ? 'Guardando...' : '💾 Guardar Ajuste Final'}
              </button>
            </div>
          </div>
        </div>
    );
};

export default ComparativaModal;