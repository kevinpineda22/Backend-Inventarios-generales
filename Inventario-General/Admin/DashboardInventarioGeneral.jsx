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

    // 1. General KPIs
    const totalConteos = conteos.length;
    const conteosFinalizados = conteos.filter(c => c.estado === 'finalizado').length;
    const conteosEnProgreso = conteos.filter(c => c.estado === 'en_progreso').length;
    
    // Calculate differences (Type 3 is Reconteo, implying a diff existed)
    // Or check if we have diff info. In the main list we might not have diff value directly unless we process it.
    // But we know Type 3 exists.
    const conteosConDiferencia = conteos.filter(c => c.tipo_conteo === 3).length; 
    
    // Total Items Counted (Sum of total_items)
    const totalItemsContados = conteos.reduce((acc, curr) => acc + (curr.total_items || 0), 0);

    // 2. Progress by Zone
    const zonas = [...new Set(conteos.map(c => c.zona))];
    const progressByZona = zonas.map(zona => {
      const countsInZona = conteos.filter(c => c.zona === zona);
      const finished = countsInZona.filter(c => c.estado === 'finalizado').length;
      return {
        zona,
        total: countsInZona.length,
        finished,
        percentage: countsInZona.length ? (finished / countsInZona.length) * 100 : 0
      };
    }).sort((a, b) => b.percentage - a.percentage); // Sort by completion

    // 3. Operator Ranking
    const operatorStats = {};
    conteos.forEach(c => {
      if (!c.usuario_nombre) return;
      const name = c.usuario_nombre.split('@')[0]; // Simple name
      if (!operatorStats[name]) {
        operatorStats[name] = { name, counts: 0, items: 0 };
      }
      operatorStats[name].counts += 1;
      operatorStats[name].items += (c.total_items || 0);
    });
    
    const ranking = Object.values(operatorStats)
      .sort((a, b) => b.items - a.items)
      .slice(0, 5); // Top 5

    // 4. Global Progress (based on hierarchyStatus if available)
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
      conteosFinalizados,
      conteosEnProgreso,
      conteosConDiferencia,
      totalItemsContados,
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
            <h3>Total Conteos</h3>
            <p className="value">{stats.totalConteos}</p>
            <p className="subtext">Registros totales</p>
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
            <h3>Items Contados</h3>
            <p className="value">{stats.totalItemsContados.toLocaleString()}</p>
            <p className="subtext">Unidades totales</p>
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
