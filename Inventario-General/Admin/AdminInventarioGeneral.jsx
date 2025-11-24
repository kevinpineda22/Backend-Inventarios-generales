import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import CargaMaestraExcel from "./CargaMaestraExcel";
import CreacionInventario from "./CreacionInventario";
import HistorialConteos from "./HistorialConteos";
import ExportarInventarioExcel from "./ExportarInventarioExcel";
import "./AdminInventarioGeneral.css";

const AdminInventarioGeneral = () => {
  const [activeTab, setActiveTab] = useState("carga");
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
    </div>
  );
};

export default AdminInventarioGeneral;
