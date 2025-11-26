import React, { useState, useEffect } from "react";
import ReactFlow, {
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  Handle,
  Position,
  MiniMap,
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";
import {
  MapPin,
  Layers,
  History,
  LayoutDashboard,
  Building2,
  CornerDownRight,
  Settings2,
  Grid3X3,
  Plus,
  Trash2,
  PlusCircle,
  MousePointer2,
  Eye,
} from "lucide-react";
import "./CreacionInventario.css";
import { inventarioGeneralService } from "../../services/inventarioGeneralService";
import { generateLocationKey } from "../utils/keyGenerator";
import HistorialInventario from "./HistorialInventario";

/* --- CONFIGURACIÓN DEL LAYOUT --- */
const nodeWidth = 280;
const nodeHeight = 140;

const getLayoutedElements = (nodes, edges) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: "TB", ranksep: 80, nodesep: 50 });

  nodes.forEach((node) => {
    const height = node.type === "pasilloNode" ? node.data.height || 160 : 80;
    dagreGraph.setNode(node.id, { width: nodeWidth, height: height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };
    return node;
  });

  return { nodes: layoutedNodes, edges };
};

/* --- NODO PERSONALIZADO --- */
const PasilloCustomNode = ({ data }) => {
  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="custom-node-pasillo">
      <Handle type="target" position={Position.Top} className="handle-custom" />
      <div className="node-header">
        <div className="node-title">
          <Layers size={14} />
          <span>{data.label}</span>
        </div>
        <span className="badge-count">{data.ubicaciones.length} Ubic.</span>
      </div>
      <div className="node-body">
        <div className="grid-preview">
          {data.ubicaciones.slice(0, 8).map((u, i) => (
            <div
              key={i}
              className="grid-cell"
              title={
                typeof u === "string"
                  ? u
                  : `${u.numero}\nClave: ${u.clave}\n(Click para copiar)`
              }
              onClick={() =>
                typeof u !== "string" && u.clave && handleCopy(u.clave)
              }
              style={{
                cursor:
                  typeof u !== "string" && u.clave ? "pointer" : "default",
              }}
            >
              {typeof u === "string" ? u : u.numero}
            </div>
          ))}
          {data.ubicaciones.length > 8 && (
            <div className="grid-cell more">+{data.ubicaciones.length - 8}</div>
          )}
        </div>
      </div>
    </div>
  );
};

const nodeTypes = { pasilloNode: PasilloCustomNode };

/* --- COMPONENTE PRINCIPAL --- */
const CreacionInventario = () => {
  const [viewMode, setViewMode] = useState("create");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const [selectedCompany, setSelectedCompany] = useState("");
  const [bodegasExistentes, setBodegasExistentes] = useState([]);

  const [bodegaNombre, setBodegaNombre] = useState("");
  const [isNewBodega, setIsNewBodega] = useState(false);
  const [selectedBodegaId, setSelectedBodegaId] = useState("");
  const [estructura, setEstructura] = useState([
    { nombre: "", pasillos: [{ nombre: "", ubicaciones: ["", "", ""] }] },
  ]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const companies = [
    { id: "1", nombre: "Merkahorro" },
    { id: "2", nombre: "Megamayorista" },
    { id: "3", nombre: "Construahorro" },
  ];

  useEffect(() => {
    if (selectedCompany && viewMode === "create") {
      inventarioGeneralService
        .obtenerBodegas(selectedCompany)
        .then((bs) => {
          setBodegasExistentes(bs);
          setSelectedBodegaId("");
          setBodegaNombre("");
          setIsNewBodega(false);
        })
        .catch(console.error);
    } else if (viewMode === "create") {
      setBodegasExistentes([]);
    }
  }, [selectedCompany, viewMode]);

  const buildDiagram = (labelBodega, zonasData) => {
    const newNodes = [];
    const newEdges = [];
    const bId = "node-bodega";

    newNodes.push({
      id: bId,
      type: "input",
      data: { label: labelBodega || "Bodega" },
      position: { x: 0, y: 0 },
      className: "node-root-style",
    });

    if (zonasData && Array.isArray(zonasData)) {
      zonasData.forEach((zona, zIndex) => {
        const zId = `node-zona-${zIndex}`;
        newNodes.push({
          id: zId,
          data: { label: zona.nombre || `Zona ${zIndex + 1}` },
          position: { x: 0, y: 0 },
          className: "node-zone-style",
        });
        newEdges.push({
          id: `e-${bId}-${zId}`,
          source: bId,
          target: zId,
          type: "smoothstep",
          animated: true,
          style: { stroke: "#94a3b8", strokeWidth: 2 },
        });

        const pasillosList = zona.pasillos || [];
        pasillosList.forEach((pasillo, pIndex) => {
          const pId = `node-pasillo-${zIndex}-${pIndex}`;
          const listaUbicaciones = (pasillo.ubicaciones || []).map((u) =>
            typeof u === "object" && u !== null ? u : u
          );
          const estHeight = 100 + Math.ceil(listaUbicaciones.length / 4) * 25;

          newNodes.push({
            id: pId,
            type: "pasilloNode",
            position: { x: 0, y: 0 },
            data: {
              label: pasillo.numero || pasillo.nombre || `Pasillo`,
              ubicaciones: listaUbicaciones,
              height: estHeight,
            },
          });
          newEdges.push({
            id: `e-${zId}-${pId}`,
            source: zId,
            target: pId,
            type: "smoothstep",
            style: { stroke: "#cbd5e1", strokeWidth: 1.5 },
          });
        });
      });
    }
    const { nodes: lNodes, edges: lEdges } = getLayoutedElements(
      newNodes,
      newEdges
    );
    setNodes([...lNodes]);
    setEdges([...lEdges]);
  };

  useEffect(() => {
    if (viewMode === "create") {
      buildDiagram(bodegaNombre || "Nueva Bodega", estructura);
    }
  }, [bodegaNombre, estructura, viewMode]);

  const handleVerMapaHistorial = (bodega) => {
    buildDiagram(bodega.nombre, bodega.zonas);
  };

  // Handlers CRUD Formulario
  const addZona = () =>
    setEstructura([
      ...estructura,
      { nombre: "", pasillos: [{ nombre: "", ubicaciones: [""] }] },
    ]);
  const removeZona = (idx) => {
    if (estructura.length > 1)
      setEstructura(estructura.filter((_, i) => i !== idx));
  };
  const updateZona = (idx, val) => {
    const n = [...estructura];
    n[idx].nombre = val;
    setEstructura(n);
  };
  const addPasillo = (zIdx) => {
    const n = [...estructura];
    n[zIdx].pasillos.push({ nombre: "", ubicaciones: [""] });
    setEstructura(n);
  };
  const removePasillo = (zIdx, pIdx) => {
    const n = [...estructura];
    if (n[zIdx].pasillos.length > 1) {
      n[zIdx].pasillos = n[zIdx].pasillos.filter((_, i) => i !== pIdx);
      setEstructura(n);
    }
  };
  const updatePasillo = (zIdx, pIdx, val) => {
    const n = [...estructura];
    n[zIdx].pasillos[pIdx].nombre = val;
    setEstructura(n);
  };
  const addUbi = (zIdx, pIdx) => {
    const n = [...estructura];
    n[zIdx].pasillos[pIdx].ubicaciones.push("");
    setEstructura(n);
  };
  const removeUbi = (zIdx, pIdx, uIdx) => {
    const n = [...estructura];
    const p = n[zIdx].pasillos[pIdx];
    if (p.ubicaciones.length > 1) {
      p.ubicaciones = p.ubicaciones.filter((_, i) => i !== uIdx);
      setEstructura(n);
    }
  };
  const updateUbi = (zIdx, pIdx, uIdx, val) => {
    const n = [...estructura];
    n[zIdx].pasillos[pIdx].ubicaciones[uIdx] = val;
    setEstructura(n);
  };

  const handleBodegaSelect = (e) => {
    const v = e.target.value;
    if (v === "new") {
      setIsNewBodega(true);
      setBodegaNombre("");
      setSelectedBodegaId("");
    } else {
      setIsNewBodega(false);
      setSelectedBodegaId(v);
      setBodegaNombre(bodegasExistentes.find((b) => b.id === v)?.nombre || "");
    }
  };

  const handleGuardar = async () => {
    if (!selectedCompany || !bodegaNombre.trim()) {
      setMessage({ type: "error", text: "⚠️ Faltan datos básicos" });
      return;
    }
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      let bId = selectedBodegaId;
      if (isNewBodega) {
        const res = await inventarioGeneralService.crearBodega({
          nombre: bodegaNombre,
          compania_id: selectedCompany,
        });
        bId = res.data ? res.data.id : res.id;
      }
      for (const z of estructura) {
        if (!z.nombre.trim()) continue;
        const zRes = await inventarioGeneralService.crearZona({
          nombre: z.nombre,
          bodega_id: bId,
        });
        const zId = zRes.data ? zRes.data.id : zRes.id;

        for (const p of z.pasillos) {
          if (!p.nombre.trim()) continue;
          const pRes = await inventarioGeneralService.crearPasillo({
            numero: p.nombre,
            zona_id: zId,
          });
          const pId = pRes.data ? pRes.data.id : pRes.id;

          // GENERACIÓN DE CLAVES AQUÍ
          const ubicacionesPayload = p.ubicaciones
            .filter((u) => u.trim())
            .map((u) => ({
              numero: u,
              clave: generateLocationKey(bodegaNombre, z.nombre, p.nombre, u), // Generación Única
              pasillo_id: pId,
            }));
          if (ubicacionesPayload.length > 0)
            await inventarioGeneralService.crearUbicacionesBatch(
              ubicacionesPayload
            );
        }
      }
      setMessage({
        type: "success",
        text: "✅ Inventario creado con claves seguras.",
      });
      setBodegaNombre("");
      setIsNewBodega(false);
      setSelectedBodegaId("");
      setEstructura([
        { nombre: "", pasillos: [{ nombre: "", ubicaciones: ["", "", ""] }] },
      ]);
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Error: " + err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pro-layout">
      <div className="pro-header-strip">
        <div className="ph-left">
          <Building2 size={18} className="text-blue-600" />
          <span className="font-bold text-slate-700">
            Gestor de Espacios Físicos
          </span>
        </div>
        <div className="ph-right">
          <button
            className={`ph-btn ${viewMode === "create" ? "active" : ""}`}
            onClick={() => {
              setViewMode("create");
              setNodes([]);
            }}
          >
            <LayoutDashboard size={16} /> Diseño
          </button>
          <button
            className={`ph-btn ${viewMode === "history" ? "active" : ""}`}
            onClick={() => setViewMode("history")}
          >
            <History size={16} /> Historial
          </button>
        </div>
      </div>

      <div className="pro-main-content">
        <div className="pro-editor-panel">
          {viewMode === "history" ? (
            <div className="history-wrapper-full">
              <HistorialInventario
                companiaId={selectedCompany}
                setCompaniaId={setSelectedCompany}
                companies={companies}
                onSelectBodega={handleVerMapaHistorial}
              />
            </div>
          ) : (
            <>
              <div className="editor-scrollable">
                <div className="config-card">
                  <h4 className="card-h">
                    <Settings2 size={14} /> Configuración
                  </h4>
                  <div className="form-grid">
                    <div className="fg-col">
                      <label>Empresa</label>
                      <select
                        className="pro-input"
                        value={selectedCompany}
                        onChange={(e) => setSelectedCompany(e.target.value)}
                      >
                        <option value="">Seleccionar...</option>
                        {companies.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="fg-col">
                      <label>Bodega</label>
                      <select
                        className="pro-input"
                        value={isNewBodega ? "new" : selectedBodegaId}
                        onChange={handleBodegaSelect}
                      >
                        <option value="">Seleccionar...</option>
                        {bodegasExistentes.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.nombre}
                          </option>
                        ))}
                        <option value="new">+ Nueva...</option>
                      </select>
                    </div>
                  </div>
                  {isNewBodega && (
                    <input
                      className="pro-input mt-2"
                      placeholder="Nombre Bodega"
                      value={bodegaNombre}
                      onChange={(e) => setBodegaNombre(e.target.value)}
                      autoFocus
                    />
                  )}
                </div>

                <div className="structure-section">
                  <div className="section-header">
                    <h3>Estructura Física</h3>
                    <button className="btn-link" onClick={addZona}>
                      + Añadir Zona
                    </button>
                  </div>
                  {estructura.map((zona, zIndex) => (
                    <div key={zIndex} className="zone-block">
                      <div className="zone-block-header">
                        <MapPin size={16} className="text-blue-600" />
                        <input
                          className="input-clean"
                          placeholder={`Nombre Zona ${zIndex + 1}`}
                          value={zona.nombre}
                          onChange={(e) => updateZona(zIndex, e.target.value)}
                        />
                        {estructura.length > 1 && (
                          <button
                            className="btn-icon"
                            onClick={() => removeZona(zIndex)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <div className="zone-block-body">
                        {zona.pasillos.map((pasillo, pIndex) => (
                          <div key={pIndex} className="aisle-container">
                            <div className="aisle-header-row">
                              <CornerDownRight
                                size={14}
                                className="text-slate-400"
                              />
                              <span className="label-small">Pasillo:</span>
                              <input
                                className="input-small"
                                placeholder="Ej: A, 1..."
                                value={pasillo.nombre}
                                onChange={(e) =>
                                  updatePasillo(zIndex, pIndex, e.target.value)
                                }
                              />
                              {zona.pasillos.length > 1 && (
                                <button
                                  className="btn-x"
                                  onClick={() => removePasillo(zIndex, pIndex)}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                            <div className="locations-row">
                              <div className="icon-col">
                                <Grid3X3 size={12} className="text-slate-300" />
                              </div>
                              <div className="tags-wrapper">
                                {pasillo.ubicaciones.map((u, uIndex) => (
                                  <div
                                    key={uIndex}
                                    className="ubi-input-wrapper"
                                  >
                                    <input
                                      value={u}
                                      onChange={(e) =>
                                        updateUbi(
                                          zIndex,
                                          pIndex,
                                          uIndex,
                                          e.target.value
                                        )
                                      }
                                      placeholder="#"
                                    />
                                    {pasillo.ubicaciones.length > 1 && (
                                      <span
                                        className="del-tag"
                                        onClick={() =>
                                          removeUbi(zIndex, pIndex, uIndex)
                                        }
                                      >
                                        ×
                                      </span>
                                    )}
                                  </div>
                                ))}
                                <button
                                  className="btn-plus-tag"
                                  onClick={() => addUbi(zIndex, pIndex)}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                        <button
                          className="btn-add-aisle-dashed"
                          onClick={() => addPasillo(zIndex)}
                        >
                          <PlusCircle size={12} /> Agregar Pasillo
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="editor-footer-fixed">
                {message.text && (
                  <div className={`status-pill ${message.type}`}>
                    {message.text}
                  </div>
                )}
                <button
                  className="btn-save-main"
                  onClick={handleGuardar}
                  disabled={loading}
                >
                  {loading ? "Guardando..." : "GUARDAR ESTRUCTURA"}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="pro-canvas-panel">
          <div className="canvas-inner">
            <div className="canvas-legend-overlay">
              <span className="legend-dot b"></span> Bodega
              <span className="legend-dot z"></span> Zona
              <span className="legend-dot p"></span> Pasillo
            </div>
            {viewMode === "history" && nodes.length === 0 ? (
              <div className="empty-history-view">
                <MousePointer2 size={48} className="text-slate-300 mb-3" />
                <h3>Selecciona una bodega</h3>
                <p>
                  Haz clic en el botón{" "}
                  <Eye size={12} style={{ display: "inline" }} /> de la lista
                  izquierda
                </p>
              </div>
            ) : (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                fitView
                minZoom={0.1}
                attributionPosition="bottom-right"
              >
                <Background color="#f1f5f9" gap={24} size={1} />
                <Controls position="bottom-right" showInteractive={false} />
                <MiniMap
                  nodeColor={(n) =>
                    n.type === "input"
                      ? "#1e293b"
                      : n.type === "pasilloNode"
                      ? "#f59e0b"
                      : "#3b82f6"
                  }
                  style={{ height: 80, width: 120 }}
                />
              </ReactFlow>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreacionInventario;
