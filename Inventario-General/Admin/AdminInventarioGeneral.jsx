import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { Sparkles } from "lucide-react";
import CargaMaestraExcel from "./CargaMaestraExcel";
import CreacionInventario from "./CreacionInventario";
import HistorialConteos from "./HistorialConteos";
import ExportarInventarioExcel from "./ExportarInventarioExcel";
import GeneradorReporteIA from "./GeneradorReporteIA";
import "./AdminInventarioGeneral.css";

const AdminInventarioGeneral = () => {
  const [activeTab, setActiveTab] = useState("carga");
  const [showAIReport, setShowAIReport] = useState(false);
  const navigate = useNavigate();

  const renderContent = () => {
    switch (activeTab) {
      case "carga":
        return <CargaMaestraExcel />;
      case "creacion":
        return <CreacionInventario />;
      case "historial":
        return <HistorialConteos />;
      case "exportar":
        return <ExportarInventarioExcel />;
      default:
        return <CargaMaestraExcel />;
    }
  };

  const tabs = [
    { id: "carga", label: "Carga Maestra" },
    { id: "creacion", label: "Creación de Inventario" },
    { id: "historial", label: "Historial de Conteos" },
    { id: "exportar", label: "Exportar Inventario" },
  ];

  return (
    <div className="inventario-general-admin-container">
      <button
        className="admin-back-button"
        onClick={() => navigate(-1)}
        title="Volver"
      >
        <FaArrowLeft />
      </button>

      <div className="inventario-general-admin-header">
        <h1>Administración de Inventario General</h1>
      </div>

      <div className="inventario-general-admin-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`inventario-general-tab-button ${
              activeTab === tab.id ? "active" : ""
            }`}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="active-tab-indicator"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="inventario-general-admin-content">{renderContent()}</div>

      {/* Floating Action Button for AI Analysis */}
      <button 
        className="hc-fab-ai"
        onClick={() => setShowAIReport(true)}
        title="Analizar con IA"
        style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
          color: 'white',
          border: 'none',
          borderRadius: '50px',
          padding: '1rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.4)',
          cursor: 'pointer',
          zIndex: 1000,
          fontWeight: '600',
          fontSize: '1rem'
        }}
      >
        <Sparkles size={24} />
        <span className="hc-fab-text">Analizar IA</span>
      </button>

      <GeneradorReporteIA 
        isOpen={showAIReport} 
        onClose={() => setShowAIReport(false)} 
        // No pasamos conteos ni bodegas, para que active el modo autónomo
      />
    </div>
  );
};

export default AdminInventarioGeneral;
