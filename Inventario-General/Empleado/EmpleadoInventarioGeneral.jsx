import { useState, useEffect } from "react";
import ConteoPorUbicacion from "./ConteoPorUbicacion";
import PanelReconteoDiferencias from "./PanelReconteoDiferencias";
import "./EmpleadoInventarioGeneral.css";
import { inventarioGeneralService as inventarioService } from "../../services/inventarioGeneralService";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../supabaseClient";

const EmpleadoInventarioGeneral = ({
  usuarioId: propUsuarioId,
  usuarioNombre: propUsuarioNombre,
}) => {
  const { user } = useAuth();
  const [supabaseUser, setSupabaseUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setSupabaseUser(user);
      }
    };
    fetchUser();
  }, []);

  // Determinar usuario (props, supabase o useAuth)
  // Si no hay usuario autenticado, usamos un UUID nulo (Nil UUID) para cumplir con el tipo UUID NOT NULL
  const GUEST_UUID = "00000000-0000-0000-0000-000000000000";
  // Prioridad: Prop > Supabase (Real UUID) > useAuth (LocalStorage) > Guest
  const usuarioId = propUsuarioId || supabaseUser?.id || user?.id || GUEST_UUID;
  const usuarioNombre =
    propUsuarioNombre || user?.nombre || user?.email || "Invitado";
  const usuarioEmail = user?.email || supabaseUser?.email || "";

  const [selectedCompany, setSelectedCompany] = useState("");

  // Estructura completa cargada al inicio
  const [estructuraCompleta, setEstructuraCompleta] = useState([]);

  // Listas para los selectores (derivadas de estructuraCompleta)
  const [bodegas, setBodegas] = useState([]);
  const [zonas, setZonas] = useState([]);
  const [pasillos, setPasillos] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);

  const [seleccion, setSeleccion] = useState({
    bodega: "",
    zona: "",
    pasillo: "",
    ubicacion: "",
  });

  const [tipoConteoSeleccionado, setTipoConteoSeleccionado] = useState(1); // 1: Primer Conteo, 2: Segundo Conteo

  const [mostrarConteo, setMostrarConteo] = useState(false);
  const [mostrarReconteo, setMostrarReconteo] = useState(false); // Nuevo estado para reconteo
  const [mostrarPasswordModal, setMostrarPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [ubicacionActual, setUbicacionActual] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const companies = [
    { id: "1", nombre: "Merkahorro" },
    { id: "2", nombre: "Megamayorista" },
    { id: "3", nombre: "Construahorro" },
  ];

  // 1. Cargar Estructura Completa cuando cambia la compañía
  useEffect(() => {
    if (selectedCompany) {
      cargarEstructuraCompleta();
    } else {
      setEstructuraCompleta([]);
      setBodegas([]);
    }
  }, [selectedCompany]);

  // 2. Actualizar Zonas cuando cambia la bodega
  useEffect(() => {
    if (seleccion.bodega && estructuraCompleta.length > 0) {
      const bodegaEncontrada = estructuraCompleta.find(
        (b) => b.id === seleccion.bodega
      );
      // Filtrar zonas cerradas
      setZonas((bodegaEncontrada?.zonas || []).filter(z => z.estado !== 'cerrado'));
    } else {
      setZonas([]);
    }
  }, [seleccion.bodega, estructuraCompleta]);

  // 3. Actualizar Pasillos cuando cambia la zona
  useEffect(() => {
    if (seleccion.zona && zonas.length > 0) {
      const zonaEncontrada = zonas.find((z) => z.id === seleccion.zona);
      // Filtrar pasillos cerrados
      setPasillos((zonaEncontrada?.pasillos || []).filter(p => p.estado !== 'cerrado'));
    } else {
      setPasillos([]);
    }
  }, [seleccion.zona, zonas]);

  // 4. Actualizar Ubicaciones cuando cambia el pasillo (AHORA CON FETCH PARA ESTADO ACTUALIZADO)
  useEffect(() => {
    const fetchUbicacionesActualizadas = async () => {
      if (seleccion.pasillo) {
        try {
          setLoading(true);
          // Usamos obtenerNavegacion para traer el estado fresco de los conteos (conteo1_estado, etc.)
          const response = await inventarioService.obtenerNavegacion({
            companiaId: selectedCompany,
            bodegaId: seleccion.bodega,
            zonaId: seleccion.zona,
            pasilloId: seleccion.pasillo,
          });

          if (response.data && response.data.ubicaciones) {
            setUbicaciones(response.data.ubicaciones);
          } else {
            // Fallback a la estructura local si falla o viene vacío
            const pasilloEncontrado = pasillos.find(
              (p) => p.id === seleccion.pasillo
            );
            setUbicaciones(pasilloEncontrado?.ubicaciones || []);
          }
        } catch (error) {
          console.error("Error al actualizar ubicaciones:", error);
          // Fallback silencioso
          const pasilloEncontrado = pasillos.find(
            (p) => p.id === seleccion.pasillo
          );
          setUbicaciones(pasilloEncontrado?.ubicaciones || []);
        } finally {
          setLoading(false);
        }
      } else {
        setUbicaciones([]);
      }
    };

    fetchUbicacionesActualizadas();
  }, [seleccion.pasillo]); // Quitamos 'pasillos' de dependencia para evitar loops si no cambia el ID

  const cargarEstructuraCompleta = async () => {
    try {
      setLoading(true);
      // Usamos el mismo endpoint que HistorialInventario.jsx
      const response = await inventarioService.obtenerEstructura(
        selectedCompany
      );

      if (response && response.data) {
        setEstructuraCompleta(response.data);
        // Filtrar bodegas cerradas
        setBodegas(response.data.filter(b => b.estado !== 'cerrado'));
      } else {
        setEstructuraCompleta([]);
        setBodegas([]);
      }
    } catch (error) {
      console.error("Error al cargar estructura:", error);
      setMessage({
        type: "error",
        text: "Error al cargar estructura: " + error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerificarPassword = () => {
    const CLAVE_MAESTRA = "2050"; // Clave definida
    if (passwordInput === CLAVE_MAESTRA) {
      setMostrarReconteo(true);
      setMostrarPasswordModal(false);
      setPasswordInput("");
      setMessage({ type: "success", text: "Acceso concedido." });
    } else {
      setMessage({ type: "error", text: "⛔ Clave incorrecta." });
    }
  };

  const handleCompanyChange = (e) => {
    const companyId = e.target.value;
    setSelectedCompany(companyId);
    setSeleccion({
      bodega: "",
      zona: "",
      pasillo: "",
      ubicacion: "",
    });
  };

  const handleBodegaChange = (e) => {
    const bodegaId = e.target.value;
    setSeleccion((prev) => ({
      ...prev,
      bodega: bodegaId,
      zona: "",
      pasillo: "",
      ubicacion: "",
    }));
  };

  const handleZonaChange = (e) => {
    const zonaId = e.target.value;
    setSeleccion((prev) => ({
      ...prev,
      zona: zonaId,
      pasillo: "",
      ubicacion: "",
    }));
  };

  const handlePasilloChange = (e) => {
    const pasilloId = e.target.value;
    setSeleccion((prev) => ({
      ...prev,
      pasillo: pasilloId,
      ubicacion: "",
    }));
  };

  const handleSeleccionarUbicacion = async (ubicacionId) => {
    try {
      setLoading(true);

      // En lugar de llamar a una ruta nueva que puede no estar disponible sin reinicio,
      // refrescamos las ubicaciones del pasillo actual para obtener el estado más reciente.
      const response = await inventarioService.obtenerNavegacion({
        companiaId: selectedCompany,
        bodegaId: seleccion.bodega,
        zonaId: seleccion.zona,
        pasilloId: seleccion.pasillo,
      });

      const ubicacionesFrescas = response.data?.ubicaciones || [];
      const ubicacionFresca = ubicacionesFrescas.find(
        (u) => u.id === ubicacionId
      );

      if (!ubicacionFresca) {
        throw new Error(
          "La ubicación seleccionada no se encuentra disponible."
        );
      }

      // Actualizamos la lista completa para reflejar cambios en otros botones también
      setUbicaciones(ubicacionesFrescas);

      // Validar si se puede seleccionar según el tipo de conteo
      if (tipoConteoSeleccionado === 1) {
        if (ubicacionFresca.conteo1_estado === "finalizado") {
          setMessage({
            type: "error",
            text: "El primer conteo ya fue finalizado para esta ubicación.",
          });
          return;
        }
      } else if (tipoConteoSeleccionado === 2) {
        if (ubicacionFresca.conteo1_estado !== "finalizado") {
          setMessage({
            type: "error",
            text: "Debe finalizar el primer conteo antes de iniciar el segundo.",
          });
          return;
        }
        if (ubicacionFresca.conteo2_estado === "finalizado") {
          setMessage({
            type: "error",
            text: "El segundo conteo ya fue finalizado para esta ubicación.",
          });
          return;
        }
      }

      setUbicacionActual({
        ...ubicacionFresca,
        bodegaNombre: bodegas.find((b) => b.id === seleccion.bodega)?.nombre,
        zonaNombre: zonas.find((z) => z.id === seleccion.zona)?.nombre,
        pasilloNumero: pasillos.find((p) => p.id === seleccion.pasillo)?.numero,
        // Forzamos el conteo actual según la selección del usuario
        conteo_actual: tipoConteoSeleccionado - 1,
      });

      setSeleccion({ ...seleccion, ubicacion: ubicacionId });
      setMessage({ type: "", text: "" });

      // Efecto suave de scroll hacia la sección de la clave
      setTimeout(() => {
        const clavePanel = document.getElementById("clave-panel-section");
        if (clavePanel) {
          clavePanel.scrollIntoView({ behavior: "smooth", block: "center" });
          // Opcional: enfocar el input
          const input = document.getElementById("clave-input");
          if(input) input.focus();
        }
      }, 300);

    } catch (error) {
      console.error("Error:", error);
      setMessage({
        type: "error",
        text: "Error al conectar con la ubicación. Intente nuevamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleIniciarConteo = (clave) => {
    if (!ubicacionActual) {
      setMessage({ type: "error", text: "No hay ubicación seleccionada" });
      return;
    }

    // Validación de clave
    if (clave.trim() !== ubicacionActual.clave) {
      setMessage({
        type: "error",
        text: "⛔ Clave incorrecta. Verifique e intente nuevamente.",
      });
      return;
    }

    setMostrarConteo(true);
    setMessage({
      type: "success",
      text: "✅ Clave correcta. Iniciando conteo...",
    });

    // Limpiar mensaje después de un momento
    setTimeout(() => setMessage({ type: "", text: "" }), 1500);
  };

  const handleCerrarConteo = (finalizado = false) => {
    setMostrarConteo(false);
    setUbicacionActual(null);

    if (finalizado) {
      setSeleccion({
        bodega: "",
        zona: "",
        pasillo: "",
        ubicacion: "",
      });
    } else {
      setSeleccion({ ...seleccion, ubicacion: "" });
    }

    // Recargar estructura para actualizar estados visuales (opcional, pero recomendado)
    cargarEstructuraCompleta();
  };

  if (mostrarReconteo) {
    return (
      <PanelReconteoDiferencias
        companiaId={selectedCompany}
        usuarioId={usuarioId}
        usuarioNombre={usuarioNombre}
        usuarioEmail={usuarioEmail}
        filtros={seleccion}
        onCerrar={() => setMostrarReconteo(false)}
      />
    );
  }

  if (mostrarConteo && ubicacionActual) {
    return (
      <ConteoPorUbicacion
        ubicacion={ubicacionActual}
        usuarioId={usuarioId}
        usuarioNombre={usuarioNombre}
        usuarioEmail={usuarioEmail}
        companiaId={selectedCompany}
        onCerrar={handleCerrarConteo}
      />
    );
  }

  return (
    <div className="empleado-inventario-general">
      <div className="empleado-header">
        <h1>Panel de Conteo - Empleado</h1>
        <p className="user-info">
          Usuario: <strong>{usuarioNombre || "Invitado"}</strong>
        </p>
      </div>

      {/* Selección de Compañía y Tipo de Conteo */}
      <div className="form-section">
        <div className="form-group">
          <label>Seleccionar Compañía:</label>
          <select
            value={selectedCompany}
            onChange={handleCompanyChange}
            className="select-input"
          >
            <option value="">-- Selecciona una compañía --</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Tipo de Conteo:</label>
          <div
            className="radio-group"
            style={{ display: "flex", gap: "20px", marginTop: "10px" }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="tipoConteo"
                value={1}
                checked={tipoConteoSeleccionado === 1}
                onChange={() => setTipoConteoSeleccionado(1)}
              />
              Primer Conteo
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="tipoConteo"
                value={2}
                checked={tipoConteoSeleccionado === 2}
                onChange={() => setTipoConteoSeleccionado(2)}
              />
              Segundo Conteo
            </label>
          </div>
        </div>

        {selectedCompany && (
          <div
            className="form-group"
            style={{ display: "flex", alignItems: "flex-end" }}
          >
            <button
              className="btn-diferencias"
              style={{
                backgroundColor: "#e74c3c",
                color: "white",
                padding: "10px 20px",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
              onClick={() => setMostrarPasswordModal(true)}
            >
              ⚠️ Recontar Diferencias
            </button>
          </div>
        )}
      </div>

      {selectedCompany && (
        <div className="seleccion-grid">
          {/* Selección de Bodega */}
          <div className="seleccion-card">
            <h3>1. Bodega</h3>
            <select
              value={seleccion.bodega}
              onChange={handleBodegaChange}
              className="select-input"
            >
              <option value="">-- Selecciona bodega --</option>
              {bodegas.map((bodega) => (
                <option key={bodega.id} value={bodega.id}>
                  {bodega.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Selección de Zona */}
          <div className="seleccion-card">
            <h3>2. Zona</h3>
            <select
              value={seleccion.zona}
              onChange={handleZonaChange}
              className="select-input"
              disabled={!seleccion.bodega}
            >
              <option value="">-- Selecciona zona --</option>
              {zonas.map((zona) => (
                <option key={zona.id} value={zona.id}>
                  {zona.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Selección de Pasillo */}
          <div className="seleccion-card">
            <h3>3. Pasillo</h3>
            <select
              value={seleccion.pasillo}
              onChange={handlePasilloChange}
              className="select-input"
              disabled={!seleccion.zona}
            >
              <option value="">-- Selecciona pasillo --</option>
              {pasillos.map((pasillo) => (
                <option key={pasillo.id} value={pasillo.id}>
                  Pasillo {pasillo.numero}
                </option>
              ))}
            </select>
          </div>

          {/* Selección de Ubicación */}
          <div className="seleccion-card">
            <h3>4. Ubicación</h3>
            <div className="ubicaciones-grid">
              {seleccion.pasillo && ubicaciones.length > 0 ? (
                ubicaciones.map((ubicacion) => {
                  // Lógica de estado visual
                  let estadoClase = "";
                  let estadoTexto = "Disponible";
                  let disabled = false;

                  if (tipoConteoSeleccionado === 1) {
                    if (ubicacion.conteo1_estado === "finalizado") {
                      estadoClase = "completado"; // Asumimos que existe clase CSS o usaremos estilo inline
                      estadoTexto = "✓ 1er Conteo Listo";
                      disabled = true;
                    }
                  } else if (tipoConteoSeleccionado === 2) {
                    if (ubicacion.conteo1_estado !== "finalizado") {
                      estadoClase = "bloqueado";
                      estadoTexto = "🔒 Requiere 1er Conteo";
                      disabled = true;
                    } else if (ubicacion.conteo2_estado === "finalizado") {
                      estadoClase = "completado";
                      estadoTexto = "✓ 2do Conteo Listo";
                      disabled = true;
                    }
                  }

                  return (
                    <button
                      key={ubicacion.id}
                      onClick={() =>
                        !disabled && handleSeleccionarUbicacion(ubicacion.id)
                      }
                      className={`ubicacion-btn ${
                        seleccion.ubicacion === ubicacion.id ? "selected" : ""
                      } ${estadoClase}`}
                      disabled={loading || disabled}
                      style={
                        disabled
                          ? {
                              opacity: 0.6,
                              cursor: "not-allowed",
                              backgroundColor: "#e0e0e0",
                              color: "#666",
                            }
                          : {}
                      }
                    >
                      <div className="ubicacion-numero">
                        #{ubicacion.numero}
                      </div>
                      <div className="ubicacion-estado">{estadoTexto}</div>
                    </button>
                  );
                })
              ) : (
                <p className="no-ubicaciones">
                  {loading
                    ? "Cargando..."
                    : "Selecciona un pasillo para ver ubicaciones"}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {message.text && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}

      {/* Panel de clave para iniciar conteo */}
      {ubicacionActual && !mostrarConteo && (
        <div id="clave-panel-section" className="clave-panel">
          <h3>Ubicación Seleccionada: #{ubicacionActual.numero}</h3>
          <p>
            Tipo de Conteo:{" "}
            <strong>
              {tipoConteoSeleccionado === 1 ? "Conteo #1" : "Conteo #2"}
            </strong>
          </p>
          <div className="clave-input-group">
            <input
              type="text"
              placeholder="Ingresa la clave de la ubicación"
              id="clave-input"
              className="clave-input"
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleIniciarConteo(e.target.value);
                }
              }}
            />
            <button
              onClick={() => {
                const clave = document.getElementById("clave-input").value;
                handleIniciarConteo(clave);
              }}
              className="btn-iniciar"
            >
              Iniciar Conteo
            </button>
          </div>
        </div>
      )}

      {/* Modal de Password para Reconteo */}
      {mostrarPasswordModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex',
          justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div className="modal-content" style={{
            backgroundColor: 'white', padding: '20px', borderRadius: '8px',
            width: '300px', textAlign: 'center'
          }}>
            <h3>🔐 Acceso Restringido</h3>
            <p>Ingrese la clave para acceder al reconteo de diferencias.</p>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="clave-input"
              placeholder="Clave de acceso..."
              style={{ width: '100%', padding: '10px', margin: '10px 0', borderRadius: '4px', border: '1px solid #ccc' }}
              onKeyPress={(e) => e.key === 'Enter' && handleVerificarPassword()}
            />
            <div className="modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '10px' }}>
              <button 
                onClick={() => { setMostrarPasswordModal(false); setPasswordInput(""); }}
                style={{ padding: '8px 16px', border: '1px solid #ccc', background: '#f5f5f5', borderRadius: '4px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button 
                onClick={handleVerificarPassword}
                style={{ padding: '8px 16px', border: 'none', background: '#e74c3c', color: 'white', borderRadius: '4px', cursor: 'pointer' }}
              >
                Ingresar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmpleadoInventarioGeneral;
