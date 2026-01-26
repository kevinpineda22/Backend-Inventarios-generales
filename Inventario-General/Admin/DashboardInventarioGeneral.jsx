import React, { useMemo } from 'react';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend, 
  ArcElement,
  PointElement,
  LineElement
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { 
  LayoutDashboard, 
  AlertTriangle, 
  CheckCircle2, 
  Users, 
  TrendingUp,
  Package
} from 'lucide-react';
import './DashboardInventarioGeneral.css';

// Register ChartJS components
ChartJS.register(
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend, 
  ArcElement,
  PointElement,
  LineElement
);

const DashboardInventarioGeneral = ({ conteos, hierarchyStatus }) => {
  
  // --- Calculations ---
  const stats = useMemo(() => {
    if (!conteos || conteos.length === 0) return null;

    // Helper to get quantity (Units)
    const getQty = (c) => {
      // Align exactly with AI Report logic:
      // 1. Try to sum detailed items
      if (c.conteo_items && c.conteo_items.length > 0) {
        return c.conteo_items.reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0);
      }
      // 2. Fallback to row count (total_items)
      return Number(c.total_items || 0);
    };

    // Helper for Strict SKU Comparison (Matches AI Report Logic)
    const hasDifference = (c1, c2) => {
      // 1. If detailed items are available, compare SKUs
      if (c1.conteo_items && c2.conteo_items) {
        const map1 = new Map();
        c1.conteo_items.forEach(i => map1.set(String(i.item_id || i.codigo || 'unk'), Number(i.cantidad)));
        
        const map2 = new Map();
        c2.conteo_items.forEach(i => map2.set(String(i.item_id || i.codigo || 'unk'), Number(i.cantidad)));

        const allKeys = new Set([...map1.keys(), ...map2.keys()]);
        for (const key of allKeys) {
          if ((map1.get(key) || 0) !== (map2.get(key) || 0)) return true; // Diff found
        }
        return false; // Exact match
      }
      
      // 2. Fallback: Compare totals
      return getQty(c1) !== getQty(c2);
    };

    // 1. Group by Location to find "Real Truth" & Calculate Metrics
    const locationMap = new Map();
    conteos.forEach(c => {
      // EXCLUDE INVALID STATES for "Real Inventory"
      // We exclude 'rechazado' (invalid) and 'en_progreso' (not yet verified/finalized).
      // This ensures we only sum CONFIRMED inventory (Finalizado or Aprobado).
      if (c.estado === 'rechazado' || c.estado === 'en_progreso') return;

      const uid = c.ubicacion_id || `${c.bodega}::${c.zona}::${c.pasillo}::${c.ubicacion}`;
      if (!locationMap.has(uid)) locationMap.set(uid, []);
      locationMap.get(uid).push(c);
    });

    let totalUnidadesReal = 0;
    let locationsWithDiff = 0;
    let matchesT1T2 = 0;
    let totalComparisonsT1T2 = 0;

    locationMap.forEach((records) => {
      // Sort by date, then by type (to match AI Report logic exactly)
      // We capture 'now' once to ensure stability for records with missing dates
      const now = new Date(); 
      
      records.sort((a, b) => {
        // Use the captured 'now' so all missing dates are treated as equal
        const da = (a.created_at || a.createdAt) ? new Date(a.created_at || a.createdAt) : now;
        const db = (b.created_at || b.createdAt) ? new Date(b.created_at || b.createdAt) : now;
        
        const timeDiff = da - db;
        if (timeDiff !== 0) return timeDiff;
        
        // If dates are equal (or both missing), sort by Type
        return (a.tipo_conteo || 0) - (b.tipo_conteo || 0);
      });

      const last = records[records.length - 1];
      const prev = records.length >= 2 ? records[records.length - 2] : null;

      // Sum Real Inventory (Last valid count)
      totalUnidadesReal += getQty(last);

      // Error Rate (Last vs Prev) - Uses STRICT comparison (SKU level)
      if (prev) {
        if (hasDifference(last, prev)) {
          locationsWithDiff++;
        }
      }

      // T1 vs T2 Match - Uses LENIENT comparison (Total Qty only) to match AI Report
      const t1 = records.find(r => r.tipo_conteo === 1);
      const t2 = records.find(r => r.tipo_conteo === 2);
      if (t1 && t2) {
        totalComparisonsT1T2++;
        // AI Report uses simple quantity comparison for this specific metric
        if (getQty(t1) === getQty(t2)) {
          matchesT1T2++;
        }
      }
    });

    // 2. General KPIs
    const totalConteos = conteos.length; // Esfuerzo Operativo
    const totalUbicaciones = locationMap.size;
    const tasaError = totalUbicaciones > 0 ? ((locationsWithDiff / totalUbicaciones) * 100).toFixed(1) : 0;
    const coincidencia = totalComparisonsT1T2 > 0 ? ((matchesT1T2 / totalComparisonsT1T2) * 100).toFixed(1) : 0;
    
    const conteosFinalizados = conteos.filter(c => c.estado === 'finalizado').length;
    const conteosEnProgreso = conteos.filter(c => c.estado === 'en_progreso').length;
    const conteosConDiferencia = conteos.filter(c => c.tipo_conteo === 3).length; 

    // 3. Progress by Zone
    const zonas = [...new Set(conteos.map(c => c.zona))];
    const progressByZona = zonas.map(zona => {
      const countsInZona = conteos.filter(c => c.zona === zona);
      // Unique locations in this zone
      const locsInZona = new Set(countsInZona.map(c => c.ubicacion_id || `${c.bodega}::${c.zona}::${c.pasillo}::${c.ubicacion}`));
      const finishedLocs = new Set(countsInZona.filter(c => c.estado === 'finalizado').map(c => c.ubicacion_id || `${c.bodega}::${c.zona}::${c.pasillo}::${c.ubicacion}`));
      
      return {
        zona,
        total: locsInZona.size,
        finished: finishedLocs.size,
        percentage: locsInZona.size ? (finishedLocs.size / locsInZona.size) * 100 : 0
      };
    }).sort((a, b) => b.percentage - a.percentage);

    // 4. Operator Ranking (Excluding Type 4 - Adjustments)
    const operatorStats = {};
    conteos.forEach(c => {
      if (c.tipo_conteo === 4) return; // Exclude adjustments
      if (!c.usuario_nombre) return;
      const name = c.usuario_nombre.split('@')[0];
      if (!operatorStats[name]) {
        operatorStats[name] = { name, counts: 0, items: 0 };
      }
      operatorStats[name].counts += 1;
      // Use getQty to sum UNITS, or c.total_items for SKUs?
      // User asked for "Productos (SKUs)" in AI report, but Dashboard says "Total Items".
      // If we want consistency with "Inventario Real" (Units), we should use getQty.
      // But if we want consistency with AI Report Operator Table (SKUs), we use total_items.
      // Given the discrepancy complaint was about "Inventario Real", I will fix that one primarily.
      // For operators, I'll stick to SKUs (total_items) as requested before, but label it clearly if needed.
      // Actually, let's use SKUs for operators as requested in the previous turn ("Productos (SKUs)").
      operatorStats[name].items += (c.total_items || 0); 
    });
    
    const ranking = Object.values(operatorStats)
      .sort((a, b) => b.items - a.items)
      .slice(0, 5);

    // 5. Global Progress
    let globalProgress = 0;
    if (hierarchyStatus?.estructura) {
      let totalPasillos = 0;
      let closedPasillos = 0;
      hierarchyStatus.estructura.forEach(z => {
        z.pasillos.forEach(p => {
          totalPasillos++;
          if (p.estado === 'cerrado') closedPasillos++;
        });
      });
      globalProgress = totalPasillos > 0 ? (closedPasillos / totalPasillos) * 100 : 0;
    }

    return {
      totalConteos,
      totalUnidadesReal,
      tasaError,
      coincidencia,
      conteosFinalizados,
      conteosEnProgreso,
      conteosConDiferencia,
      progressByZona,
      ranking,
      globalProgress
    };
  }, [conteos, hierarchyStatus]);

  if (!stats) {
    return (
      <div className="dig-container" style={{display:'flex', justifyContent:'center', alignItems:'center', height:'400px'}}>
        <p>No hay datos suficientes para generar el dashboard.</p>
      </div>
    );
  }

  // --- Chart Data Configurations ---

  const barChartData = {
    labels: stats.progressByZona.slice(0, 10).map(z => z.zona), // Top 10 zones
    datasets: [
      {
        label: 'Conteos Finalizados',
        data: stats.progressByZona.slice(0, 10).map(z => z.finished),
        backgroundColor: 'rgba(46, 204, 113, 0.7)',
        borderColor: 'rgba(46, 204, 113, 1)',
        borderWidth: 1,
      },
      {
        label: 'Total Asignados',
        data: stats.progressByZona.slice(0, 10).map(z => z.total),
        backgroundColor: 'rgba(52, 152, 219, 0.3)',
        borderColor: 'rgba(52, 152, 219, 1)',
        borderWidth: 1,
      },
    ],
  };

  const doughnutData = {
    labels: ['Finalizados', 'En Progreso', 'Con Diferencias (Reconteos)'],
    datasets: [
      {
        data: [stats.conteosFinalizados, stats.conteosEnProgreso, stats.conteosConDiferencia],
        backgroundColor: [
          'rgba(46, 204, 113, 0.8)',
          'rgba(241, 196, 15, 0.8)',
          'rgba(231, 76, 60, 0.8)',
        ],
        borderColor: [
          'rgba(46, 204, 113, 1)',
          'rgba(241, 196, 15, 1)',
          'rgba(231, 76, 60, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
    },
  };

  return (
    <div className="dig-container">
      <div className="dig-header" style={{marginBottom: '20px'}}>
        <h2 style={{color: '#2c3e50', margin: 0}}>📊 Dashboard General de Inventario</h2>
        <p style={{color: '#7f8c8d', margin: '5px 0 0'}}>Vista general de métricas y rendimiento</p>
      </div>

      {/* KPI Grid */}
      <div className="dig-kpi-grid">
        <div className="dig-kpi-card">
          <div className="dig-kpi-icon blue">
            <LayoutDashboard size={24} />
          </div>
          <div className="dig-kpi-content">
            <h3>Esfuerzo Operativo</h3>
            <p className="value">{stats.totalConteos}</p>
            <p className="subtext">Total conteos realizados</p>
          </div>
        </div>

        <div className="dig-kpi-card">
          <div className="dig-kpi-icon green">
            <CheckCircle2 size={24} />
          </div>
          <div className="dig-kpi-content">
            <h3>Avance Global</h3>
            <p className="value">{stats.globalProgress.toFixed(1)}%</p>
            <p className="subtext">Pasillos cerrados</p>
          </div>
        </div>

        <div className="dig-kpi-card">
          <div className="dig-kpi-icon orange">
            <Package size={24} />
          </div>
          <div className="dig-kpi-content">
            <h3>Inventario Real</h3>
            <p className="value">{stats.totalUnidadesReal.toLocaleString()}</p>
            <p className="subtext">Unidades Físicas (Último Conteo)</p>
          </div>
        </div>

        <div className="dig-kpi-card">
          <div className="dig-kpi-icon red">
            <AlertTriangle size={24} />
          </div>
          <div className="dig-kpi-content">
            <h3>Tasa de Error</h3>
            <p className="value">{stats.tasaError}%</p>
            <p className="subtext">Ubicaciones con diferencias</p>
          </div>
        </div>

        <div className="dig-kpi-card">
          <div className="dig-kpi-icon blue">
            <TrendingUp size={24} />
          </div>
          <div className="dig-kpi-content">
            <h3>Coincidencia T1/T2</h3>
            <p className="value">{stats.coincidencia}%</p>
            <p className="subtext">Conteo 1 = Conteo 2</p>
          </div>
        </div>

        <div className="dig-kpi-card">
          <div className="dig-kpi-icon red">
            <AlertTriangle size={24} />
          </div>
          <div className="dig-kpi-content">
            <h3>Reconteos</h3>
            <p className="value">{stats.conteosConDiferencia}</p>
            <p className="subtext">Conteos tipo 3 generados</p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="dig-charts-grid">
        <div className="dig-chart-card">
          <div className="dig-chart-header">
            <h3 className="dig-chart-title">Progreso por Zona (Top 10)</h3>
          </div>
          <div className="dig-chart-body">
            <Bar data={barChartData} options={chartOptions} />
          </div>
        </div>

        <div className="dig-chart-card">
          <div className="dig-chart-header">
            <h3 className="dig-chart-title">Estado de Conteos</h3>
          </div>
          <div className="dig-chart-body">
            <Doughnut data={doughnutData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Ranking Section */}
      <div className="dig-chart-card" style={{height: 'auto'}}>
        <div className="dig-chart-header">
          <h3 className="dig-chart-title">🏆 Top Operadores (Por Items Contados)</h3>
        </div>
        <div className="dig-chart-body">
          <table className="dig-ranking-table">
            <thead>
              <tr>
                <th style={{width: '50px'}}>#</th>
                <th>Operador</th>
                <th>Conteos Realizados</th>
                <th>Total Items</th>
                <th>Eficiencia Promedio</th>
              </tr>
            </thead>
            <tbody>
              {stats.ranking.map((user, index) => (
                <tr key={user.name}>
                  <td>
                    <div className={`dig-rank-badge top-${index + 1}`}>{index + 1}</div>
                  </td>
                  <td>
                    <div className="dig-user-info">
                      <div className="dig-user-avatar">{user.name.charAt(0).toUpperCase()}</div>
                      <span>{user.name}</span>
                    </div>
                  </td>
                  <td>{user.counts}</td>
                  <td style={{fontWeight: 'bold'}}>{user.items.toLocaleString()}</td>
                  <td>
                    {Math.round(user.items / user.counts)} items/conteo
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardInventarioGeneral;
