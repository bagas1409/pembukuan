import PDFDocument from "pdfkit";
import { getPool } from "../config/db.js";
import { dashboard as dashboardSvc, labaRugi as labaRugiSvc, neraca as neracaSvc } from "./laporanService.js";
import { rowsRingkasan, rowsLabaRugi, rowsNeraca, formatRp, formatRpMinus, safeFilePart } from "./laporanExportRows.js";

function formatDateId(d) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

function drawSectionTitle(doc, title) {
  doc.moveDown(0.9);
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#000")
    .text(title.toUpperCase(), left, doc.y, { width, align: "left" });
  doc.moveDown(0.25);
  doc
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .lineWidth(1)
    .strokeColor("#000")
    .stroke();
  doc.moveDown(0.5);
}

function drawTable(doc, rows) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const col1W = Math.floor((right - left) * 0.62);
  const col2W = (right - left) - col1W;
  const rowH = 18;

  function ensureSpace(extra = rowH) {
    const bottom = doc.page.height - doc.page.margins.bottom;
    if (doc.y + extra > bottom) {
      doc.addPage();
    }
  }

  // Header row
  ensureSpace(rowH * 2);
  const y0 = doc.y;
  doc
    .rect(left, y0, col1W, rowH)
    .fillAndStroke("#000", "#000");
  doc
    .rect(left + col1W, y0, col2W, rowH)
    .fillAndStroke("#000", "#000");
  doc.fillColor("#fff").font("Helvetica-Bold").fontSize(10);
  doc.text("Komponen", left + 6, y0 + 5, { width: col1W - 12 });
  doc.text("Nilai", left + col1W + 6, y0 + 5, { width: col2W - 12, align: "right" });
  doc.y = y0 + rowH;

  for (const r of rows) {
    if (r.spacer) {
      ensureSpace(rowH);
      doc.y += 6;
      continue;
    }

    ensureSpace(rowH);
    const y = doc.y;

    // row borders
    doc.rect(left, y, col1W, rowH).strokeColor("#e2e8f0").stroke();
    doc.rect(left + col1W, y, col2W, rowH).strokeColor("#e2e8f0").stroke();

    if (r.header) {
      doc.fillColor("#000").font("Helvetica-Bold").fontSize(10);
      doc.text(r.label, left + 6, y + 5, { width: col1W - 12 });
      doc.y = y + rowH;
      continue;
    }

    const labelX = left + 6 + (r.indent ? 12 : 0);
    const valueText = r.minus ? formatRpMinus(r.value) : formatRp(r.value);

    doc.fillColor("#000").font(r.bold ? "Helvetica-Bold" : "Helvetica").fontSize(10);
    doc.text(r.label, labelX, y + 5, { width: col1W - 12 - (r.indent ? 12 : 0) });

    doc
      .fillColor(r.minus ? "#b91c1c" : "#000")
      .font(r.bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(10)
      .text(valueText, left + col1W + 6, y + 5, { width: col2W - 12, align: "right" });

    doc.y = y + rowH;
  }

  doc.moveDown(0.8);
}

export async function streamLaporanPdf({ userId, year }, res) {
  const y = year && Number.isFinite(year) ? year : new Date().getFullYear();
  if (!Number.isInteger(y) || y < 2000 || y > 2100) {
    res.status(400).json({ message: "year tidak valid" });
    return;
  }

  const start = `${y}-01-01`;
  const end = `${y}-12-31`;

  const pool = getPool();
  const userRes = await pool.query(`SELECT nama_usaha as "namaUsaha", email FROM users WHERE id=$1`, [userId]);
  const user = userRes.rows[0];
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  const [lr, nr, db] = await Promise.all([
    labaRugiSvc(userId, { start, end }),
    neracaSvc(userId, { start, end }),
    dashboardSvc(userId, { year: y })
  ]);

  const filename = `Laporan_Akutansi_${safeFilePart(user.namaUsaha)}_${y}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ size: "A4", margin: 50, info: { Title: `Laporan Akuntansi ${y}` } });
  doc.pipe(res);

  // Header (judul "Laporan Akuntansi" dihapus sesuai request)
  doc.font("Helvetica").fontSize(11).fillColor("#000").text(`Nama Usaha: ${user.namaUsaha}`);
  doc.text(`Email: ${user.email}`);
  doc.text(
    `Periode: ${y} (${formatDateId(new Date(`${y}-01-01T00:00:00.000Z`))} – ${formatDateId(
      new Date(`${y}-12-31T00:00:00.000Z`)
    )})`
  );
  doc.text(`Dibuat: ${formatDateId(new Date())}`);
  doc.moveDown(0.2);

  drawSectionTitle(doc, "Ringkasan Keuangan");
  drawTable(doc, rowsRingkasan(db));

  drawSectionTitle(doc, "Laporan Laba Rugi");
  drawTable(doc, rowsLabaRugi(lr));

  // Start Neraca on a new page (lembar kedua)
  doc.addPage();
  drawSectionTitle(doc, "Laporan Neraca");
  drawTable(doc, rowsNeraca(nr));

  doc.end();
}
