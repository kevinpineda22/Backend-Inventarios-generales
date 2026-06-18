// =====================================================
// SERVICIO: GENERACIÓN DE QR Y PDF DE CLAVES DE UBICACIONES
// =====================================================

import QRCode from "qrcode";
import PDFDocument from "pdfkit";

import UbicacionModel from "../models/Ubicacion.model.js";
import PasilloModel from "../models/Pasillo.model.js";

export class QrService {
  /**
   * Contenido que se codifica dentro del QR de una ubicación.
   * Se codifica únicamente la clave para que cualquier lector de QR
   * (incluido el de la app de conteo) obtenga directamente el valor.
   */
  static buildQrPayload(ubicacion) {
    return String(ubicacion.clave ?? "");
  }

  /**
   * Generar el QR de una ubicación como Data URL (PNG en base64).
   */
  static async generateUbicacionQrDataUrl(ubicacionId, options = {}) {
    const ubicacion = await UbicacionModel.findById(ubicacionId);
    if (!ubicacion) {
      throw new Error("Ubicación no encontrada");
    }

    const dataUrl = await QRCode.toDataURL(this.buildQrPayload(ubicacion), {
      errorCorrectionLevel: "M",
      margin: 1,
      width: options.width || 320,
    });

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
   * Generar el QR de una ubicación como buffer PNG (para enviar como imagen).
   */
  static async generateUbicacionQrBuffer(ubicacionId, options = {}) {
    const ubicacion = await UbicacionModel.findById(ubicacionId);
    if (!ubicacion) {
      throw new Error("Ubicación no encontrada");
    }

    const buffer = await QRCode.toBuffer(this.buildQrPayload(ubicacion), {
      errorCorrectionLevel: "M",
      margin: 1,
      width: options.width || 320,
    });

    return { ubicacion, buffer };
  }

  /**
   * Generar un PDF con las claves (texto + QR) de todas las ubicaciones
   * de un pasillo, ordenadas y de forma clara.
   * Devuelve un Buffer con el contenido del PDF.
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

    // Orden natural por número (soporta numéricos y alfanuméricos)
    const ordenadas = [...ubicaciones].sort((a, b) => {
      const na = Number(a.numero);
      const nb = Number(b.numero);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return String(a.numero).localeCompare(String(b.numero), "es", {
        numeric: true,
      });
    });

    // Pre-generar todos los QR (como Data URL -> buffer)
    const qrBuffers = await Promise.all(
      ordenadas.map((u) =>
        QRCode.toBuffer(this.buildQrPayload(u), {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 200,
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
      qrBuffers,
    });
  }

  /**
   * Renderiza el documento PDF y resuelve con un Buffer.
   */
  static _renderPdf({ pasillo, zona, bodega, ubicaciones, qrBuffers }) {
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
        const cardHeight = 185;

        let x = startX;
        let y = doc.y;
        let col = 0;

        const bottomLimit = doc.page.height - doc.page.margins.bottom;

        ubicaciones.forEach((u, idx) => {
          // Salto de página si no cabe la siguiente tarjeta
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
            qrBuffer: qrBuffers[idx],
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
   * Dibuja una tarjeta individual: número, QR y clave grande.
   */
  static _drawCard(doc, { x, y, width, height, numero, clave, qrBuffer }) {
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
      .text(`Ubicación ${numero}`, x, y + 10, {
        width,
        align: "center",
      });

    // QR centrado
    const qrSize = 95;
    const qrX = x + (width - qrSize) / 2;
    const qrY = y + 32;
    if (qrBuffer) {
      doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
    }

    // Etiqueta "Clave"
    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#6b7280")
      .text("CLAVE", x, qrY + qrSize + 8, { width, align: "center" });

    // Clave grande
    doc
      .fontSize(22)
      .font("Helvetica-Bold")
      .fillColor("#111827")
      .text(String(clave ?? "—"), x, qrY + qrSize + 18, {
        width,
        align: "center",
        characterSpacing: 2,
      });

    // Restablecer fuente por defecto
    doc.font("Helvetica");
  }
}

export default QrService;
