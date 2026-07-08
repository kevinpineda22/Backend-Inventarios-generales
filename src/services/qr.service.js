// =====================================================
// SERVICIO: GENERACIÓN DE CÓDIGO DE BARRA (CODE 128) Y PDF
// =====================================================

import bwipjs from "bwip-js";
import PDFDocument from "pdfkit";

import UbicacionModel from "../models/Ubicacion.model.js";
import PasilloModel from "../models/Pasillo.model.js";

const BARCODE_CFG = {
  bcid: "code128",
  scale: 3,
  height: 10,
  includetext: true,
  textxalign: "center",
  paddingwidth: 10,
  paddingheight: 8,
  backgroundcolor: "ffffff",
  barcolor: "000000",
};

const BARCODE_CFG_PDF = {
  bcid: "code128",
  scale: 2,
  height: 8,
  includetext: false,
  paddingwidth: 6,
  paddingheight: 4,
  backgroundcolor: "ffffff",
  barcolor: "000000",
};

export class QrService {
  /**
   * Contenido que se codifica dentro del código de barra de una ubicación.
   */
  static buildPayload(ubicacion) {
    return String(ubicacion.clave ?? "");
  }

  /**
   * Generar el código de barra de una ubicación como Data URL (PNG en base64).
   */
  static async generateUbicacionQrDataUrl(ubicacionId, options = {}) {
    const ubicacion = await UbicacionModel.findById(ubicacionId);
    if (!ubicacion) {
      throw new Error("Ubicación no encontrada");
    }

    const buffer = await bwipjs.toBuffer({
      ...BARCODE_CFG,
      text: this.buildPayload(ubicacion),
      scale: options.scale || 3,
    });

    const dataUrl = `data:image/png;base64,${buffer.toString("base64")}`;

    return {
      success: true,
      data: {
        ubicacion_id: ubicacion.id,
        numero: ubicacion.numero,
        clave: ubicacion.clave,
        qr: dataUrl,
      },
    };
  }

  /**
   * Generar el código de barra de una ubicación como buffer PNG.
   */
  static async generateUbicacionQrBuffer(ubicacionId, options = {}) {
    const ubicacion = await UbicacionModel.findById(ubicacionId);
    if (!ubicacion) {
      throw new Error("Ubicación no encontrada");
    }

    const buffer = await bwipjs.toBuffer({
      ...BARCODE_CFG,
      text: this.buildPayload(ubicacion),
      scale: options.scale || 3,
    });

    return { ubicacion, buffer };
  }

  /**
   * Generar un PDF con las claves (texto + código de barra) de todas
   * las ubicaciones de un pasillo, ordenadas y de forma clara.
   */
  static async generatePasilloClavesPdf(pasilloId) {
    const pasillo = await PasilloModel.findById(pasilloId);
    if (!pasillo) {
      throw new Error("Pasillo no encontrado");
    }

    const ubicaciones = await UbicacionModel.findByPasillo(pasilloId);
    if (!ubicaciones || ubicaciones.length === 0) {
      throw new Error("El pasillo no tiene ubicaciones registradas");
    }

    // Orden natural por número
    const ordenadas = [...ubicaciones].sort((a, b) => {
      const na = Number(a.numero);
      const nb = Number(b.numero);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return String(a.numero).localeCompare(String(b.numero), "es", {
        numeric: true,
      });
    });

    // Pre-generar todos los códigos de barra (como buffer PNG)
    const barcodeBuffers = await Promise.all(
      ordenadas.map((u) =>
        bwipjs.toBuffer({
          ...BARCODE_CFG_PDF,
          text: this.buildPayload(u),
        })
      )
    );

    const zona = pasillo.zona || {};
    const bodega = zona.bodega || {};

    return await this._renderPdf({
      pasillo,
      zona,
      bodega,
      ubicaciones: ordenadas,
      barcodeBuffers,
    });
  }

  static _renderPdf({
    pasillo,
    zona,
    bodega,
    ubicaciones,
    barcodeBuffers,
  }) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: "A4",
          margin: 40,
          info: {
            Title: `Claves Pasillo ${pasillo.numero ?? pasillo.id}`,
            Author: "Backend Inventario General",
          },
        });

        const chunks = [];
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        // ---------- Encabezado ----------
        doc
          .fontSize(18)
          .fillColor("#111827")
          .text("Claves de Ubicaciones", { align: "center" });

        const subtituloPartes = [];
        if (bodega.nombre) subtituloPartes.push(`Bodega: ${bodega.nombre}`);
        if (zona.nombre) subtituloPartes.push(`Zona: ${zona.nombre}`);
        subtituloPartes.push(`Pasillo: ${pasillo.nombre || pasillo.numero}`);

        doc
          .moveDown(0.3)
          .fontSize(11)
          .fillColor("#374151")
          .text(subtituloPartes.join("  ·  "), { align: "center" });

        doc
          .moveDown(0.2)
          .fontSize(9)
          .fillColor("#6b7280")
          .text(
            `Total de ubicaciones: ${ubicaciones.length}  ·  Generado: ${new Date().toLocaleString(
              "es-CO"
            )}`,
            { align: "center" }
          );

        doc.moveDown(1);

        // ---------- Cuadrícula de tarjetas ----------
        const columns = 3;
        const gap = 14;
        const startX = doc.page.margins.left;
        const usableWidth =
          doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const cardWidth = (usableWidth - gap * (columns - 1)) / columns;
        const cardHeight = 165;

        let x = startX;
        let y = doc.y;
        let col = 0;

        const bottomLimit = doc.page.height - doc.page.margins.bottom;

        ubicaciones.forEach((u, idx) => {
          if (y + cardHeight > bottomLimit) {
            doc.addPage();
            y = doc.page.margins.top;
            x = startX;
            col = 0;
          }

          this._drawCard(doc, {
            x,
            y,
            width: cardWidth,
            height: cardHeight,
            numero: u.numero,
            clave: u.clave,
            barcodeBuffer: barcodeBuffers[idx],
          });

          col += 1;
          if (col >= columns) {
            col = 0;
            x = startX;
            y += cardHeight + gap;
          } else {
            x += cardWidth + gap;
          }
        });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Dibuja una tarjeta individual: número, código de barra y clave grande.
   */
  static _drawCard(doc, { x, y, width, height, numero, clave, barcodeBuffer }) {
    // Marco
    doc
      .roundedRect(x, y, width, height, 8)
      .lineWidth(1)
      .strokeColor("#d1d5db")
      .stroke();

    // Título de la ubicación
    doc
      .fontSize(11)
      .fillColor("#111827")
      .font("Helvetica-Bold")
      .text(`Ubicación ${numero}`, x, y + 8, {
        width,
        align: "center",
      });

    // Código de barra centrado
    const barcodeW = width - 24;
    const barcodeX = x + (width - barcodeW) / 2;
    const barcodeY = y + 28;
    if (barcodeBuffer) {
      doc.image(barcodeBuffer, barcodeX, barcodeY, {
        width: barcodeW,
      });
    }

    // Clave grande debajo
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .fillColor("#111827")
      .text(String(clave ?? "—"), x, y + height - 38, {
        width,
        align: "center",
        characterSpacing: 2,
      });

    doc.font("Helvetica");
  }

  // ────────────────────────────────────────────────────────────
  // GENERAR ETIQUETAS PARA IMPRIMIR (Media Carta)
  // ────────────────────────────────────────────────────────────

  /**
   * Generar PDF con etiquetas para imprimir en media carta.
   * Cada etiqueta muestra: Pasillo, Ubicacion y codigo de barras Code 128.
   * @param {Array<{id: string, numero: string, clave: string, pasillo: {numero: string, nombre?: string}}>} ubicaciones
   */
  static async generateEtiquetasPdf(ubicaciones) {
    // Ordenar por pasillo, luego por ubicacion
    const ordenadas = [...ubicaciones].sort((a, b) => {
      const pa = String(a.pasillo?.numero ?? a.pasillo?.nombre ?? "");
      const pb = String(b.pasillo?.numero ?? b.pasillo?.nombre ?? "");
      const cmp = pa.localeCompare(pb, "es", { numeric: true });
      if (cmp !== 0) return cmp;
      const na = Number(a.numero);
      const nb = Number(b.numero);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return String(a.numero).localeCompare(String(b.numero), "es", {
        numeric: true,
      });
    });

    // Pre-generar codigos de barra
    const barcodeBuffers = await Promise.all(
      ordenadas.map((u) =>
        bwipjs.toBuffer({
          ...BARCODE_CFG_PDF,
          text: this.buildPayload(u),
        })
      )
    );

    return this._renderEtiquetasPdf(ordenadas, barcodeBuffers);
  }

  /**
   * Renderizar PDF media carta (612 x 396 pts = half letter landscape).
   * 2 columnas x 2 filas = 4 etiquetas por pagina.
   */
  static _renderEtiquetasPdf(ubicaciones, barcodeBuffers) {
    return new Promise((resolve, reject) => {
      try {
        const PAGE_W = 612; // 8.5"
        const PAGE_H = 396; // 5.5"
        const MARGIN = 18;
        const doc = new PDFDocument({
          size: [PAGE_W, PAGE_H],
          margin: MARGIN,
          info: {
            Title: "Etiquetas de Ubicaciones",
            Author: "Backend Inventario General",
          },
        });

        const chunks = [];
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        const cols = 2;
        const rows = 2;
        const gapX = 12;
        const gapY = 12;
        const usableW = PAGE_W - MARGIN * 2;
        const usableH = PAGE_H - MARGIN * 2;
        const labelW = (usableW - gapX * (cols - 1)) / cols;
        const labelH = (usableH - gapY * (rows - 1)) / rows;

        let x = MARGIN;
        let y = MARGIN;
        let col = 0;
        let row = 0;

        ubicaciones.forEach((u, idx) => {
          if (row >= rows) {
            doc.addPage();
            x = MARGIN;
            y = MARGIN;
            col = 0;
            row = 0;
          }

          this._drawLabel(doc, {
            x,
            y,
            width: labelW,
            height: labelH,
            pasillo: u.pasillo?.nombre || u.pasillo?.numero || "",
            numero: u.numero,
            clave: u.clave,
            barcodeBuffer: barcodeBuffers[idx],
          });

          col += 1;
          if (col >= cols) {
            col = 0;
            x = MARGIN;
            y += labelH + gapY;
            row += 1;
          } else {
            x += labelW + gapX;
          }
        });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Dibuja una etiqueta individual: Pasillo, Ubicacion, codigo de barras.
   */
  static _drawLabel(doc, { x, y, width, height, pasillo, numero, clave, barcodeBuffer }) {
    // Borde punteado suave para guia de corte
    doc
      .rect(x, y, width, height)
      .lineWidth(0.5)
      .strokeColor("#cbd5e1")
      .stroke();

    // Pasillo
    doc
      .fontSize(11)
      .fillColor("#374151")
      .font("Helvetica-Bold")
      .text(`Pasillo: ${pasillo}`, x, y + 10, {
        width,
        align: "center",
      });

    // Ubicacion
    doc
      .fontSize(16)
      .fillColor("#111827")
      .font("Helvetica-Bold")
      .text(`Ubicación ${numero}`, x, y + 30, {
        width,
        align: "center",
      });

    // Codigo de barras
    const barcodeW = width - 28;
    const barcodeX = x + (width - barcodeW) / 2;
    const barcodeY = y + 58;
    if (barcodeBuffer) {
      doc.image(barcodeBuffer, barcodeX, barcodeY, {
        width: barcodeW,
      });
    }

    // Clave debajo del codigo (referencia)
    doc
      .fontSize(10)
      .fillColor("#6b7280")
      .font("Helvetica")
      .text(String(clave ?? ""), x, barcodeY + (barcodeBuffer ? 28 : 0), {
        width,
        align: "center",
      });

    doc.font("Helvetica");
  }
}

export default QrService;
