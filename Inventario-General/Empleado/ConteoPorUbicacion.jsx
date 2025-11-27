import { useState, useEffect, useRef } from "react";
import "./ConteoPorUbicacion.css";
import { inventarioGeneralService as inventarioService } from "../../services/inventarioGeneralService";
import { toast, ToastContainer } from "react-toastify";
import Swal from "sweetalert2";
import { FaTrashAlt, FaArrowLeft } from "react-icons/fa";

const unidadMedidaOptions = {
  UND: 1,
  P2: 2,
  P3: 3,
  P4: 4,
  P5: 5,
  P6: 6,
  P7: 7,
  P8: 8,
  P9: 9,
  P10: 10,
  P12: 12,
  P13: 13,
  P14: 14,
  P15: 15,
  P20: 20,
  P24: 24,
  P25: 25,
  P28: 28,
  P30: 30,
  P40: 40,
  P48: 48,
  P50: 50,
  P54: 54,
  P60: 60,
  P84: 84,
  P100: 100,
};

const ConteoPorUbicacion = ({
  ubicacion,
  usuarioId,
  usuarioNombre,
  usuarioEmail,
  companiaId,
  onCerrar,
}) => {
  const [items, setItems] = useState([]); // Items con diferencias (para conteo 3)
  const [conteoActual, setConteoActual] = useState([]); // Lista de items contados
  const [loading, setLoading] = useState(false);
  const [conteoIniciado, setConteoIniciado] = useState(false);
  const [conteoId, setConteoId] = useState(null);

  // Estados para la lógica de escaneo tipo ScannerFisico
  const [cantidadMultiplicador, setCantidadMultiplicador] = useState("0");
  const [lastScanned, setLastScanned] = useState({
    codigo: "",
    descripcion: "",
    item: "",
  });
  const [unidadesDisponibles, setUnidadesDisponibles] = useState([]);
  const [selectedBarcode, setSelectedBarcode] = useState("");

  const mainInputRef = useRef(null);
  const multiplierInputRef = useRef(null);
  const scanBuffer = useRef("");
  const scanTimeout = useRef(null);
  const initializationRef = useRef(false); // Ref para evitar doble inicialización

  useEffect(() => {
    if (!initializationRef.current) {
      initializationRef.current = true;
      iniciarNuevoConteo();
    }
  }, []);

  // Manejo de teclado global para escáner físico
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (document.activeElement === multiplierInputRef.current) {
        return;
      }

      if (e.key === "Enter") {
        if (scanBuffer.current.length > 4) {
          procesarCodigo(scanBuffer.current);
        }
        scanBuffer.current = "";
        e.preventDefault();
        return;
      }

      if (/^[a-zA-Z0-9]$/.test(e.key)) {
        scanBuffer.current += e.key;
      }

      if (scanTimeout.current) {
        clearTimeout(scanTimeout.current);
      }
      scanTimeout.current = setTimeout(() => {
        scanBuffer.current = "";
      }, 100);
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [conteoId, loading]); // Dependencias importantes

  const handleMultiplierKeyDown = (e) => {
    e.preventDefault();

    if (e.key >= "0" && e.key <= "9") {
      setCantidadMultiplicador((prev) => {
        if (prev === "0") return e.key;
        return prev + e.key;
      });
    } else if (e.key === "Backspace") {
      setCantidadMultiplicador((prev) => prev.slice(0, -1) || "0");
    } else if (e.key === "Enter") {
      if (lastScanned.codigo && !loading) {
        handleAgregarItem();
      }
    }
  };

  const iniciarNuevoConteo = async () => {
    try {
      setLoading(true);
      const tipoConteoCalculado = (ubicacion.conteo_actual || 0) + 1;

      const response = await inventarioService.iniciarConteo({
        ubicacionId: ubicacion.id,
        usuarioId: usuarioId,
        tipoConteo: tipoConteoCalculado,
        clave: ubicacion.clave,
        usuarioEmail: usuarioEmail,
      });

      const conteoData = response.data;
      setConteoId(conteoData.id);
      setConteoIniciado(true);

      // ✅ RECUPERACIÓN DE SESIÓN MEJORADA
      // Si el backend ya nos devuelve los items (porque recuperó sesión), los usamos directamente
      if (
        conteoData.items &&
        Array.isArray(conteoData.items) &&
        conteoData.items.length > 0
      ) {
        // Ordenar por fecha de creación (más antiguo primero) para luego invertir
        const itemsSorted = [...conteoData.items].sort(
          (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)
        );

        const itemsFormateados = itemsSorted.map((i) => ({
          id: i.id,
          item_id: i.item_id,
          item: i.item?.item || i.item?.nombre || "Item",
          descripcion: i.item?.descripcion || "Sin descripción",
          codigo_barra:
            i.item?.item || i.item?.codigo || i.item?.codigo_barra || "N/A",
          cantidad: i.cantidad,
        }));

        // Mostrar el más reciente arriba
        setConteoActual(itemsFormateados.reverse());
      } else {
        // Si no vienen items (o es nuevo conteo), intentamos cargarlos por si acaso
        cargarItemsConteo(conteoData.id);
      }

      if (ubicacion.conteo_actual === 2) {
        cargarItemsConDiferencias();
      }
    } catch (error) {
      console.error("Error al iniciar conteo:", error);
      toast.error("Error al iniciar el conteo: " + error.message);
    } finally {
      setLoading(false);
      setTimeout(() => mainInputRef.current?.focus(), 100);
    }
  };

  const cargarItemsConteo = async (id) => {
    try {
      const response = await inventarioService.obtenerItemsConteo(id);
      if (response.success && response.data) {
        const itemsFormateados = response.data.map((i) => ({
          id: i.id, // ID del registro, no del item maestro
          item_id: i.item_id,
          item: i.item?.item || i.item?.nombre || "Item",
          descripcion: i.item?.descripcion || "Sin descripción",
          codigo_barra:
            i.item?.item || i.item?.codigo || i.item?.codigo_barra || "N/A",
          cantidad: i.cantidad,
        }));
        // Ordenar por fecha de creación descendente (si viene del backend ordenado, esto es opcional)
        setConteoActual(itemsFormateados.reverse());
      }
    } catch (error) {
      console.error("Error al cargar items del conteo:", error);
    }
  };

  const cargarItemsConDiferencias = async () => {
    try {
      const response = await inventarioService.obtenerItemsConDiferencias(
        ubicacion.id
      );
      setItems(response.data || []);
    } catch (error) {
      console.error("Error al cargar items con diferencias:", error);
    }
  };

  const procesarCodigo = async (codigoEscaneado) => {
    if (!codigoEscaneado || loading) return;
    setLoading(true);
    setLastScanned({
      codigo: codigoEscaneado,
      descripcion: "Buscando...",
      item: "...",
    });
    setUnidadesDisponibles([]);
    setSelectedBarcode("");

    try {
      // Usamos el servicio existente para buscar
      const dataItem = await inventarioService.buscarItemPorCodigoBarra(
        codigoEscaneado,
        companiaId
      );

      if (!dataItem || !dataItem.success) {
        toast.error(`Producto no encontrado: ${codigoEscaneado}`);
        setLastScanned({
          codigo: codigoEscaneado,
          descripcion: "No encontrado",
          item: "N/A",
        });
        setTimeout(() => mainInputRef.current?.focus(), 100);
        return;
      }

      const producto = dataItem.data;

      // Simulamos estructura de unidades si el backend no la devuelve completa
      // Asumimos que el producto tiene unidad_medida
      const unidadPrincipal = {
        codigo_barras: producto.codigo_barra || codigoEscaneado,
        unidad_medida: producto.unidad_medida || "UND",
      };

      const unidades = [unidadPrincipal]; // Aquí podrías agregar más si el backend las devuelve
      setUnidadesDisponibles(unidades);
      setSelectedBarcode(unidadPrincipal.codigo_barras);

      setLastScanned({
        ...producto,
        codigo: codigoEscaneado,
        descripcion: producto.descripcion,
        item: producto.item || producto.nombre || producto.id,
      });

      // Foco al multiplicador para ingreso rápido de cantidad
      setTimeout(() => multiplierInputRef.current?.focus(), 100);
    } catch (error) {
      toast.error(`Error al buscar producto: ${error.message}`);
      setLastScanned((prev) => ({ ...prev, descripcion: "Error de búsqueda" }));
      setTimeout(() => mainInputRef.current?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  const handleAgregarItem = async () => {
    if (!lastScanned.codigo) {
      toast.error("Escanea un producto primero");
      return;
    }

    const multiplicador = parseInt(cantidadMultiplicador) || 1;
    if (multiplicador <= 0) {
      toast.error("La cantidad debe ser mayor a 0");
      return;
    }

    // Calcular cantidad total basada en unidad
    const unidadSeleccionadaObj = unidadesDisponibles.find(
      (u) => u.codigo_barras === selectedBarcode
    );
    const nombreUnidad = unidadSeleccionadaObj
      ? unidadSeleccionadaObj.unidad_medida
      : "UND";
    const factorUnidad = unidadMedidaOptions[nombreUnidad] || 1;
    const cantidadTotal = factorUnidad * multiplicador;

    try {
      setLoading(true);

      const response = await inventarioService.registrarConteoItem(conteoId, {
        codigoBarra: selectedBarcode || lastScanned.codigo,
        cantidad: cantidadTotal,
        companiaId: companiaId,
        usuarioEmail: usuarioEmail, // ✅ Enviamos el email para el historial
      });

      if (response.success) {
        const data = response.data;
        const itemInfo = data.item;

        // Actualizar lista local - AHORA AGREGAMOS SIEMPRE (Historial separado)
        // No buscamos índice, simplemente agregamos al principio
        const nuevoItem = {
          id: data.id, // ID único del registro en conteo_items
          item_id: itemInfo.id,
          item: itemInfo.item || itemInfo.nombre,
          descripcion: itemInfo.descripcion,
          // Usamos lastScanned.codigo como fallback final si el backend no devuelve el código
          codigo_barra:
            itemInfo.item ||
            itemInfo.codigo ||
            itemInfo.codigo_barra ||
            lastScanned.codigo ||
            "N/A",
          cantidad: data.cantidad, // Cantidad de ESTE registro
        };

        setConteoActual([nuevoItem, ...conteoActual]);

        toast.success(`✓ ${itemInfo.descripcion} (x${cantidadTotal}) agregado`);

        // Resetear para siguiente escaneo
        setLastScanned({ codigo: "", descripcion: "", item: "" });
        setCantidadMultiplicador("0");
        setUnidadesDisponibles([]);
        setSelectedBarcode("");
        setTimeout(() => mainInputRef.current?.focus(), 100);
      } else {
        toast.error(response.message || "Error al agregar item");
      }
    } catch (error) {
      console.error("Error al agregar item:", error);
      toast.error(error.message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const handleEliminarItem = async (registroId, cantidadActual) => {
    const result = await Swal.fire({
      title: "¿Eliminar registro?",
      text: "Se eliminará este escaneo específico.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    try {
      setLoading(true);
      // Ahora eliminamos por ID de registro, no restando cantidad
      // Necesitamos un endpoint para eliminar registro específico o usar el mismo con cantidad negativa si el backend lo soporta
      // Pero lo ideal es eliminar el row.
      // Como no tenemos endpoint de delete específico en el servicio frontend expuesto aquí (solo registrarConteoItem),
      // vamos a asumir que el backend tiene un endpoint de delete o modificamos el servicio.
      // Revisando inventarioService.js, no hay deleteItem.
      // Vamos a usar registrarConteoItem con cantidad negativa por ahora, PERO esto solo funciona si es upsert.
      // Si cambiamos a INSERT, necesitamos un DELETE real.

      // ⚠️ IMPORTANTE: Como vamos a cambiar el backend a INSERT, necesitamos un endpoint DELETE.
      // Voy a agregar deleteConteoItem al servicio.

      await inventarioService.eliminarConteoItem(registroId);

      setConteoActual(conteoActual.filter((i) => i.id !== registroId));
      toast.success("Registro eliminado");
    } catch (error) {
      console.error("Error al eliminar item:", error);
      toast.error("Error al eliminar el item: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizarConteo = async () => {
    const result = await Swal.fire({
      title: "¿Finalizar Conteo?",
      text:
        conteoActual.length === 0
          ? "No has contado ningún item. ¿Estás seguro de finalizar?"
          : `Has contado ${conteoActual.length} registros. ¿Deseas finalizar la ubicación?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, finalizar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#210d65",
      cancelButtonColor: "#d33",
    });

    if (!result.isConfirmed) return;

    try {
      setLoading(true);
      await inventarioService.finalizarConteo(conteoId);
      toast.success("Conteo finalizado exitosamente");

      setTimeout(() => {
        onCerrar(true);
      }, 1500);
    } catch (error) {
      console.error("Error al finalizar conteo:", error);
      toast.error("Error al finalizar el conteo");
      setLoading(false);
    }
  };

  const getTipoConteoLabel = () => {
    switch (ubicacion.conteo_actual) {
      case 0:
        return "Conteo #1";
      case 1:
        return "Conteo #2";
      case 2:
        return "Conteo de Diferencias";
      default:
        return "Conteo";
    }
  };

  return (
    <div className="conteo-por-ubicacion lector-scanner-content">
      <ToastContainer position="top-center" autoClose={2000} />

      <button
        className="floating-back-btn"
        onClick={() => onCerrar()}
        disabled={loading}
        title="Volver"
      >
        <FaArrowLeft />
      </button>

      <div className="conteo-header">
        <div className="conteo-info">
          <h2>{getTipoConteoLabel()}</h2>
          <p className="ubicacion-detalle">
            {ubicacion.bodegaNombre} / {ubicacion.zonaNombre} /{" "}
            {ubicacion.numero}
          </p>
        </div>
      </div>

      {/* Sección de Escaneo Estilo ScannerFisico */}
      <div className="lector-input-group">
        <label className="lector-input-label" htmlFor="lector-main-input">
          Escanear Código
        </label>
        <div style={{ display: "flex", gap: "10px" }}>
          <input
            id="lector-main-input"
            ref={mainInputRef}
            type="text"
            inputMode="none"
            autoFocus
            placeholder="Escanea código..."
            value={lastScanned.codigo || ""}
            onChange={(e) =>
              setLastScanned((prev) => ({ ...prev, codigo: e.target.value }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") procesarCodigo(lastScanned.codigo);
            }}
            className="lector-main-input"
            disabled={loading}
          />
          <button
            onClick={() => procesarCodigo(lastScanned.codigo)}
            className="btn-agregar"
            style={{ padding: "0 20px", margin: 0 }}
            disabled={loading}
          >
            🔍
          </button>
        </div>
      </div>

      <div className="lector-controls-group">
        <div className="lector-unit-field">
          <label className="lector-unit-label" htmlFor="lector-unit-select">
            Unidad de Medida
          </label>
          <select
            id="lector-unit-select"
            value={selectedBarcode}
            onChange={(e) => setSelectedBarcode(e.target.value)}
            className="lector-unit-select"
            disabled={unidadesDisponibles.length === 0 || loading}
          >
            {unidadesDisponibles.length > 0 ? (
              unidadesDisponibles.map((unidad, idx) => (
                <option key={idx} value={unidad.codigo_barras}>
                  {unidad.unidad_medida}
                </option>
              ))
            ) : (
              <option value="">Escanee un producto</option>
            )}
          </select>
        </div>
        <div className="lector-multiplier-field">
          <label
            className="lector-multiplier-label"
            htmlFor="lector-multiplier-input"
          >
            Multiplicador
          </label>
          <input
            id="lector-multiplier-input"
            ref={multiplierInputRef}
            type="text"
            readOnly
            value={cantidadMultiplicador}
            onKeyDown={handleMultiplierKeyDown}
            className="lector-multiplier-input"
            onClick={() => multiplierInputRef.current?.focus()}
          />
          <small className="lector-multiplier-help">
            Escribe números para sumar cantidad
          </small>
        </div>
      </div>

      {lastScanned.codigo && (
        <div className="lector-scanner-info">
          <p className="lector-info-item">
            <span className="lector-info-label">Descripción:</span>{" "}
            {lastScanned.descripcion}
          </p>
          <p className="lector-info-item">
            <span className="lector-info-label">Item:</span> {lastScanned.item}
          </p>
          <p className="lector-info-item">
            <span className="lector-info-label">Total a Registrar:</span>
            {(unidadMedidaOptions[
              unidadesDisponibles.find(
                (u) => u.codigo_barras === selectedBarcode
              )?.unidad_medida || "UND"
            ] || 1) * (parseInt(cantidadMultiplicador) || 1)}
          </p>
          <button
            onClick={handleAgregarItem}
            className="lector-finish-btn"
            style={{ marginTop: "10px", backgroundColor: "#210d65" }}
            disabled={loading}
          >
            Confirmar y Agregar
          </button>
        </div>
      )}

      {/* Items con diferencias */}
      {ubicacion.conteo_actual === 2 && items.length > 0 && (
        <div className="diferencias-section">
          <h3>⚠️ Recontar Diferencias:</h3>
          <div className="diferencias-list">
            {items.map((item, idx) => (
              <div key={idx} className="diferencia-item">
                <span>{item.descripcion}</span>
                <small>({item.codigo_barra})</small>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historial / Lista de conteo */}
      <div className="lector-history-section">
        <h3 className="lector-history-title">
          Items Contados ({conteoActual.length})
          <span style={{ float: "right", fontSize: "0.9em" }}>
            Total: {conteoActual.reduce((sum, item) => sum + item.cantidad, 0)}
          </span>
        </h3>
        <ul className="lector-history-list">
          {conteoActual.map((item, idx) => (
            <li key={idx} className="lector-history-item">
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span className="lector-history-description">
                  {item.descripcion}
                </span>
                <small style={{ color: "#666" }}>{item.codigo_barra}</small>
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <span style={{ fontWeight: "bold" }}>x{item.cantidad}</span>
                <button
                  onClick={() => handleEliminarItem(item.id, item.cantidad)}
                  className="lector-delete-btn"
                >
                  <FaTrashAlt />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div
        className="lector-actions-group"
        style={{ marginTop: "auto", paddingTop: "20px" }}
      >
        <button
          onClick={handleFinalizarConteo}
          className="lector-finish-btn"
          disabled={loading}
        >
          {loading ? "Procesando..." : "Finalizar Conteo de Ubicación"}
        </button>
      </div>
    </div>
  );
};

export default ConteoPorUbicacion;
