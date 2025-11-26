import React, { useEffect, useState } from "react";
import {
  Package,
  MapPin,
  Layers,
  ChevronDown,
  ChevronRight,
  Eye,
  Trash2,
  Pencil,
  Check,
  X,
  Search,
  Building2,
  Plus,
  Copy,
  Grid3X3,
  MoreHorizontal,
} from "lucide-react";
import { inventarioGeneralService } from "../../services/inventarioGeneralService";
import { generateLocationKey } from "../utils/keyGenerator";
import "./HistorialInventario.css";

/* --- COMPONENTES DE UI --- */
const ManagementModal = ({
  isOpen,
  onClose,
  title,
  children,
  onSave,
  loading,
}) => {
  if (!isOpen) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal-container">
        <div className="modal-header">
          <h3>{title}</h3>
          <button onClick={onClose} className="btn-icon-close">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button onClick={onSave} className="btn-primary" disabled={loading}>
            {loading ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </div>
    </div>
  );
};

const EditableField = ({ initialValue, onSave, placeholder, className }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);

  const handleSave = (e) => {
    e.stopPropagation();
    if (value.trim() !== "" && value !== initialValue) onSave(value);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="inline-edit-box" onClick={(e) => e.stopPropagation()}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          className="input-inline"
          placeholder={placeholder}
        />
        <button onClick={handleSave} className="btn-mini-check">
          <Check size={12} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(false);
          }}
          className="btn-mini-x"
        >
          <X size={12} />
        </button>
      </div>
    );
  }
  return (
    <div
      className={`inline-read-box group ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <span>{initialValue}</span>
      <button onClick={() => setIsEditing(true)} className="btn-mini-edit">
        <Pencil size={10} />
      </button>
    </div>
  );
};

const HistorialInventario = ({
  companiaId,
  setCompaniaId,
  companies,
  onSelectBodega,
}) => {
  const [estructura, setEstructura] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedBodegas, setExpandedBodegas] = useState({});
  const [activeBodegaId, setActiveBodegaId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal State
  const [modalConfig, setModalConfig] = useState({
    open: false,
    type: null,
    data: null,
  });
  const [modalInputValue, setModalInputValue] = useState("");
  const [modalLocations, setModalLocations] = useState([]); // Array de objetos {numero, clave}

  const fetchEstructura = async () => {
    if (!companiaId) return;
    setLoading(true);
    try {
      const res = await inventarioGeneralService.obtenerEstructuraInventario(
        companiaId
      );
      setEstructura(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEstructura();
  }, [companiaId]);

  const toggleBodega = (id) =>
    setExpandedBodegas((prev) => ({ ...prev, [id]: !prev[id] }));

  const openModal = (type, parentData, parentContext = {}) => {
    setModalConfig({
      open: true,
      type,
      data: parentData,
      context: parentContext,
    });
    setModalInputValue("");
    if (type === "manage_locations") {
      // Cargar ubicaciones existentes
      setModalLocations(
        parentData.ubicaciones.map((u) => ({
          numero: u.numero,
          clave: u.clave,
        }))
      );
    } else {
      setModalLocations([]);
    }
  };

  const closeModal = () =>
    setModalConfig({ open: false, type: null, data: null });

  // --- HANDLER GUARDADO MODAL ---
  const handleModalSave = async () => {
    const { type, data, context } = modalConfig;
    setLoading(true);
    try {
      if (type === "add_bodega") {
        await inventarioGeneralService.crearBodega({
          nombre: modalInputValue,
          compania_id: companiaId,
        });
      } else if (type === "add_zona") {
        await inventarioGeneralService.crearZona({
          nombre: modalInputValue,
          bodega_id: data.id,
        });
      } else if (type === "add_pasillo") {
        await inventarioGeneralService.crearPasillo({
          numero: modalInputValue,
          zona_id: data.id,
        });
      } else if (type === "manage_locations") {
        // Lógica: Comparar existentes con nuevas
        const existingLocations = data.ubicaciones || [];
        const existingNums = existingLocations.map((u) => u.numero);
        const newNums = modalLocations.map((u) => u.numero);

        // 1. Identificar nuevas para crear
        const toCreate = modalLocations.filter(
          (m) => !existingNums.includes(m.numero)
        );

        // 2. Identificar eliminadas para borrar
        const toDelete = existingLocations.filter(
          (e) => !newNums.includes(e.numero)
        );

        // Ejecutar Creaciones
        if (toCreate.length > 0) {
          const payload = toCreate.map((loc) => ({
            numero: loc.numero,
            clave: loc.clave,
            pasillo_id: data.id,
          }));
          await inventarioGeneralService.crearUbicacionesBatch(payload);
        }

        // Ejecutar Eliminaciones
        if (toDelete.length > 0) {
          const idsToDelete = toDelete.map((loc) => loc.id);
          await inventarioGeneralService.eliminarUbicacionesBatch(idsToDelete);
        }
      }
      await fetchEstructura();
      closeModal();
    } catch (error) {
      console.error(error);
      alert("Error al guardar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Generador de Clave en el Modal de Ubicaciones
  const addModalLocation = (val) => {
    if (!val.trim()) return;
    // Verificar duplicados en el modal
    if (modalLocations.some((l) => l.numero === val)) return;

    const { data, context } = modalConfig; // data es pasillo
    // context debe tener bodega y zona para generar clave
    const key = generateLocationKey(
      context.bodegaName,
      context.zonaName,
      data.numero,
      val
    );
    setModalLocations([...modalLocations, { numero: val, clave: key }]);
  };

  const handleInlineUpdate = async (type, id, val) => {
    try {
      if (type === "bodega")
        await inventarioGeneralService.actualizarBodega(id, { nombre: val });
      if (type === "zona")
        await inventarioGeneralService.actualizarZona(id, { nombre: val });
      if (type === "pasillo")
        await inventarioGeneralService.actualizarPasillo(id, { numero: val });
      fetchEstructura();
    } catch (error) {
      console.error(error);
      alert("Error al actualizar");
    }
  };

  const handleDelete = async (type, id) => {
    if (
      window.confirm(
        `¿Estás seguro de eliminar ${type}? Esta acción no se puede deshacer.`
      )
    ) {
      try {
        if (type === "Bodega")
          await inventarioGeneralService.eliminarBodega(id);
        if (type === "Zona") await inventarioGeneralService.eliminarZona(id);
        if (type === "Pasillo")
          await inventarioGeneralService.eliminarPasillo(id);
        fetchEstructura();
      } catch (error) {
        console.error(error);
        alert("Error al eliminar");
      }
    }
  };

  const copyKey = (key) => {
    navigator.clipboard.writeText(key);
    // Aquí podrías poner un toast
  };

  const filtered = estructura.filter((b) =>
    b.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="historial-layout">
      {/* MODAL DE GESTIÓN */}
      <ManagementModal
        isOpen={modalConfig.open}
        onClose={closeModal}
        loading={loading}
        title={
          modalConfig.type === "add_bodega"
            ? "Nueva Bodega"
            : modalConfig.type === "add_zona"
            ? "Nueva Zona"
            : modalConfig.type === "add_pasillo"
            ? "Nuevo Pasillo"
            : "Gestionar Ubicaciones"
        }
        onSave={handleModalSave}
      >
        {["add_bodega", "add_zona", "add_pasillo"].includes(
          modalConfig.type
        ) && (
          <div className="modal-form-group">
            <label>Nombre</label>
            <input
              className="modal-input-lg"
              value={modalInputValue}
              onChange={(e) => setModalInputValue(e.target.value)}
              placeholder="Escribe el nombre..."
              autoFocus
            />
          </div>
        )}

        {modalConfig.type === "manage_locations" && (
          <div className="locations-manager">
            <div className="manager-info">
              <Layers size={14} /> Pasillo:{" "}
              <strong>{modalConfig.data.numero}</strong>
            </div>
            <div className="locations-input-area">
              <label>Ubicaciones (Existentes y Nuevas)</label>
              <div className="tags-editor">
                {modalLocations.map((loc, idx) => (
                  <div key={idx} className="tag-item-key" title={loc.clave}>
                    <span className="tag-num">{loc.numero}</span>
                    <span className="tag-key">{loc.clave}</span>
                    <button
                      onClick={() =>
                        setModalLocations((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
                <input
                  className="input-add-tag"
                  placeholder="+ Añadir (Enter)"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      addModalLocation(e.target.value);
                      e.target.value = "";
                    }
                  }}
                />
              </div>
              <small>
                Escribe el número (ej: A1) y presiona Enter. La clave se genera
                sola.
              </small>
            </div>
          </div>
        )}
      </ManagementModal>

      {/* BARRA SUPERIOR */}
      <div className="historial-filters">
        <div className="filter-row">
          <div className="select-wrapper">
            <Building2 size={14} className="icon-abs" />
            <select
              value={companiaId}
              onChange={(e) => setCompaniaId(e.target.value)}
            >
              <option value="">-- Empresa --</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          {companiaId && (
            <button
              className="btn-new-bodega"
              onClick={() => openModal("add_bodega")}
            >
              <Plus size={16} /> Bodega
            </button>
          )}
        </div>
        {companiaId && (
          <div className="search-row">
            <Search size={14} className="text-gray-400" />
            <input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* LISTA */}
      <div className="historial-content">
        {!companiaId && (
          <div className="empty-state">
            <Package size={48} />
            Selecciona una empresa
          </div>
        )}

        <div className="cards-stack">
          {filtered.map((bodega) => (
            <div
              key={bodega.id}
              className={`bodega-card ${
                activeBodegaId === bodega.id ? "active" : ""
              }`}
            >
              <div
                className="card-header"
                onClick={() => toggleBodega(bodega.id)}
              >
                <div className="header-main">
                  {expandedBodegas[bodega.id] ? (
                    <ChevronDown size={18} className="text-gray-400" />
                  ) : (
                    <ChevronRight size={18} className="text-gray-400" />
                  )}
                  <Package size={18} className="text-indigo-600" />
                  <EditableField
                    initialValue={bodega.nombre}
                    className="title-lg"
                    onSave={(v) => handleInlineUpdate("bodega", bodega.id, v)}
                  />
                  <span className="badge">
                    {bodega.zonas?.length || 0} Zonas
                  </span>
                </div>
                <div className="header-actions">
                  <button
                    className="btn-action view"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveBodegaId(bodega.id);
                      onSelectBodega(bodega);
                    }}
                  >
                    <Eye size={14} /> Mapa
                  </button>
                  <button
                    className="btn-icon-subtle"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete("Bodega", bodega.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {expandedBodegas[bodega.id] && (
                <div className="card-body">
                  <div className="zones-list">
                    {bodega.zonas?.map((zona) => (
                      <div key={zona.id} className="zone-item">
                        <div className="zone-head">
                          <div className="zh-title">
                            <MapPin size={14} className="text-blue-500" />
                            <EditableField
                              initialValue={zona.nombre}
                              className="title-md"
                              onSave={(v) =>
                                handleInlineUpdate("zona", zona.id, v)
                              }
                            />
                          </div>
                          <div className="zh-actions">
                            <button
                              className="btn-add-tiny"
                              onClick={() =>
                                openModal("add_pasillo", zona, {
                                  bodegaName: bodega.nombre,
                                })
                              }
                            >
                              + Pasillo
                            </button>
                            <button
                              className="btn-del-tiny"
                              onClick={() => handleDelete("Zona", zona.id)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        <div className="aisles-grid">
                          {zona.pasillos?.length > 0 ? (
                            zona.pasillos.map((pasillo) => (
                              <div key={pasillo.id} className="aisle-card">
                                <div className="ac-head">
                                  <div className="ac-title">
                                    <Layers
                                      size={12}
                                      className="text-amber-600"
                                    />
                                    <EditableField
                                      initialValue={pasillo.numero}
                                      className="title-sm"
                                      onSave={(v) =>
                                        handleInlineUpdate(
                                          "pasillo",
                                          pasillo.id,
                                          v
                                        )
                                      }
                                    />
                                  </div>
                                  <button
                                    className="ac-del"
                                    onClick={() =>
                                      handleDelete("Pasillo", pasillo.id)
                                    }
                                  >
                                    ×
                                  </button>
                                </div>
                                <div
                                  className="ac-body"
                                  onClick={() =>
                                    openModal("manage_locations", pasillo, {
                                      bodegaName: bodega.nombre,
                                      zonaName: zona.nombre,
                                    })
                                  }
                                >
                                  <Grid3X3
                                    size={12}
                                    className="text-gray-400"
                                  />
                                  <span>
                                    {pasillo.ubicaciones?.length || 0} Locs
                                  </span>
                                  <MoreHorizontal
                                    size={12}
                                    className="ml-auto text-gray-400"
                                  />
                                </div>

                                {/* PREVIEW DE CLAVES (NUEVO) */}
                                <div className="keys-preview-row">
                                  {pasillo.ubicaciones?.slice(0, 3).map((u) => (
                                    <span
                                      key={u.id}
                                      className="key-micro"
                                      onClick={() => copyKey(u.clave)}
                                      title={`Copiar: ${u.clave}`}
                                    >
                                      {u.clave.split("-")[0]}..
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="empty-zone-msg">Sin pasillos</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    className="btn-add-zone-block"
                    onClick={() => openModal("add_zona", bodega)}
                  >
                    <Plus size={16} /> Zona
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HistorialInventario;
