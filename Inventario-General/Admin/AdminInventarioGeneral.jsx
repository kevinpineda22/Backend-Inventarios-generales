import { useState } from 'react';
import CargaMaestraExcel from './CargaMaestraExcel';
import CreacionInventario from './CreacionInventario';
import HistorialConteos from './HistorialConteos';
import './AdminInventarioGeneral.css';

const AdminInventarioGeneral = () => {
  const [activeTab, setActiveTab] = useState('carga');

  const renderContent = () => {
    switch (activeTab) {
      case 'carga':
        return <CargaMaestraExcel />;
      case 'creacion':
        return <CreacionInventario />;
      case 'historial':
        return <HistorialConteos />;
      default:
        return <CargaMaestraExcel />;
    }
  };

  return (
    <div className="inventario-general-admin-container">
      <div className="inventario-general-admin-header">
        <h1>Administración de Inventario General</h1>
      </div>

      <div className="inventario-general-admin-tabs">
        <button
          className={`inventario-general-tab-button ${activeTab === 'carga' ? 'active' : ''}`}
          onClick={() => setActiveTab('carga')}
        >
          Carga Maestra
        </button>
        <button
          className={`inventario-general-tab-button ${activeTab === 'creacion' ? 'active' : ''}`}
          onClick={() => setActiveTab('creacion')}
        >
          Creación de Inventario
        </button>
        <button
          className={`inventario-general-tab-button ${activeTab === 'historial' ? 'active' : ''}`}
          onClick={() => setActiveTab('historial')}
        >
          Historial de Conteos
        </button>
      </div>

      <div className="inventario-general-admin-content">
        {renderContent()}
      </div>
    </div>
  );
};

export default AdminInventarioGeneral;