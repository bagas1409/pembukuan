import ExcelJS from "exceljs";
import { getPool } from "../config/db.js";
import {
  dashboard as dashboardSvc,
  labaRugi as labaRugiSvc,
  neraca as neracaSvc,
} from "./laporanService.js";
import {
  rowsRingkasan,
  rowsLabaRugi,
  rowsNeraca,
  safeFilePart,
} from "./laporanExportRows.js";
import { resolveLaporanPeriod } from "./laporanPeriod.js";

const COLORS = {
  black: "FF000000",
  white: "FFFFFFFF",
  slate50: "FFF8FAFC",
  slate100: "FFF1F5F9",
  slate200: "FFE2E8F0",
  slate700: "FF334155",
};

function applyCellBorder(cell) {
  cell.border = {
    top: { style: "thin", color: { argb: COLORS.slate200 } },
    left: { style: "thin", color: { argb: COLORS.slate200 } },
    bottom: { style: "thin", color: { argb: COLORS.slate200 } },
    right: { style: "thin", color: { argb: COLORS.slate200 } },
  };
}

function applyHeaderRowStyle(row) {
  row.font = { bold: true, color: { argb: COLORS.white } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.black },
  };
  row.alignment = { vertical: "middle" };
  row.height = 18;
}

function applySectionTitleStyle(row) {
  row.font = { bold: true, color: { argb: COLORS.white } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.black },
  };
  row.alignment = { vertical: "middle" };
  row.height = 18;
}

function applyGroupRowStyle(row) {
  row.font = { bold: true, color: { argb: COLORS.black } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.slate100 },
  };
  row.alignment = { vertical: "middle" };
  row.height = 16;
}

function applyMetaRowStyle(row) {
  row.font = { bold: false, color: { argb: "FF0F172A" } };
  row.alignment = { vertical: "middle" };
  row.height = 16;
}

function applyThickOutline(ws, { top, bottom }) {
  // Outline a 2-column table from A..B across the given rows (inclusive)
  for (let r = top; r <= bottom; r++) {
    const leftCell = ws.getCell(r, 1);
    const rightCell = ws.getCell(r, 2);

    leftCell.border = leftCell.border || {};
    rightCell.border = rightCell.border || {};

    if (r === top) {
      leftCell.border.top = { style: "medium", color: { argb: COLORS.black } };
      rightCell.border.top = { style: "medium", color: { argb: COLORS.black } };
    }
    if (r === bottom) {
      leftCell.border.bottom = {
        style: "medium",
        color: { argb: COLORS.black },
      };
      rightCell.border.bottom = {
        style: "medium",
        color: { argb: COLORS.black },
      };
    }

    leftCell.border.left = { style: "medium", color: { argb: COLORS.black } };
    rightCell.border.right = { style: "medium", color: { argb: COLORS.black } };
  }
}

function setupWorksheet(ws) {
  ws.properties.defaultRowHeight = 16;
  ws.columns = [
    { header: "Komponen", key: "label", width: 46 },
    { header: "Nilai", key: "value", width: 22 },
  ];

  // Print-friendly setup (match PDF intent)
  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    showGridLines: false,
  };
  ws.pageMargins = {
    left: 0.5,
    right: 0.5,
    top: 0.75,
    bottom: 0.75,
    header: 0.3,
    footer: 0.3,
  };
}

function writeDocumentHeader(ws, meta) {
  ws.mergeCells("A1:B1");
  ws.getCell("A1").value = "Laporan Akuntansi";
  ws.getCell("A1").font = {
    bold: true,
    size: 16,
    color: { argb: COLORS.black },
  };
  ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 24;

  ws.getCell("A2").value = "Nama Usaha";
  ws.getCell("B2").value = meta?.namaUsaha || "-";
  ws.getCell("A3").value = "Email";
  ws.getCell("B3").value = meta?.email || "-";
  ws.getCell("A4").value = "Periode";
  ws.getCell("B4").value = meta?.periodeText || "-";
  ws.getCell("A5").value = "Dibuat";
  ws.getCell("B5").value = meta?.createdText || "-";

  for (const rr of [2, 3, 4, 5]) {
    const row = ws.getRow(rr);
    applyMetaRowStyle(row);
    ws.getCell(rr, 1).font = { bold: true, color: { argb: COLORS.slate700 } };
    ws.getCell(rr, 2).alignment = { horizontal: "right", vertical: "middle" };
  }
}

function writeSection(ws, { title, rows, startRow }) {
  // Section title row (visual separator)
  ws.mergeCells(`A${startRow}:B${startRow}`);
  ws.getCell(`A${startRow}`).value = title.toUpperCase();
  applySectionTitleStyle(ws.getRow(startRow));
  ws.getCell(`A${startRow}`).alignment = {
    horizontal: "left",
    vertical: "middle",
  };
  applyCellBorder(ws.getCell(startRow, 1));
  applyCellBorder(ws.getCell(startRow, 2));

  // Table header row
  const headerRowIdx = startRow + 1;
  ws.getCell(headerRowIdx, 1).value = "Komponen";
  ws.getCell(headerRowIdx, 2).value = "Nilai";
  applyHeaderRowStyle(ws.getRow(headerRowIdx));
  ws.getCell(headerRowIdx, 1).alignment = {
    horizontal: "left",
    vertical: "middle",
  };
  ws.getCell(headerRowIdx, 2).alignment = {
    horizontal: "right",
    vertical: "middle",
  };
  applyCellBorder(ws.getCell(headerRowIdx, 1));
  applyCellBorder(ws.getCell(headerRowIdx, 2));

  let r = headerRowIdx + 1;
  for (const row of rows) {
    if (row.spacer) {
      ws.getRow(r).height = 8;
      r += 1;
      continue;
    }
    if (row.header) {
      ws.mergeCells(`A${r}:B${r}`);
      ws.getCell(r, 1).value = row.label;
      applyGroupRowStyle(ws.getRow(r));
      ws.getCell(r, 1).alignment = { horizontal: "left", vertical: "middle" };
      applyCellBorder(ws.getCell(r, 1));
      applyCellBorder(ws.getCell(r, 2));
      r += 1;
      continue;
    }

    const label = row.indent ? `  ${row.label}` : row.label;
    const value = row.minus ? -Number(row.value || 0) : Number(row.value || 0);

    ws.getCell(r, 1).value = label;
    ws.getCell(r, 2).value = value;
    ws.getCell(r, 2).numFmt = '"Rp" #,##0;[Red]("Rp" #,##0)';
    ws.getCell(r, 2).alignment = { horizontal: "right" };
    ws.getCell(r, 1).alignment = { vertical: "middle", wrapText: true };
    ws.getRow(r).height = 16;

    if (r % 2 === 0) {
      ws.getCell(r, 1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.slate50 },
      };
      ws.getCell(r, 2).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.slate50 },
      };
    }

    if (row.bold) {
      ws.getCell(r, 1).font = { bold: true };
      ws.getCell(r, 2).font = { bold: true };

      // subtle separator for totals/subtotals (match PDF "divider" feel)
      ws.getCell(r, 1).border = ws.getCell(r, 1).border || {};
      ws.getCell(r, 2).border = ws.getCell(r, 2).border || {};
      ws.getCell(r, 1).border.top = {
        style: "medium",
        color: { argb: COLORS.black },
      };
      ws.getCell(r, 2).border.top = {
        style: "medium",
        color: { argb: COLORS.black },
      };
    }

    applyCellBorder(ws.getCell(r, 1));
    applyCellBorder(ws.getCell(r, 2));
    r += 1;
  }

  // Strong outline around the whole section (title + table)
  applyThickOutline(ws, { top: startRow, bottom: r - 1 });

  // Page break after each section (print-friendly)
  ws.getRow(r).addPageBreak();
  return { nextRow: r + 2, freezeAt: headerRowIdx };
}

function addDataTableSheet(
  workbook,
  { meta, ringkasanRows, labaRugiRows, neracaRows },
) {
  const ws = workbook.addWorksheet("Tabel");
  setupWorksheet(ws);

  writeDocumentHeader(ws, meta);

  const startRow = 7;
  ws.getCell(`A${startRow}`).value = "Catatan";
  ws.getCell(`B${startRow}`).value =
    "Sheet ini berupa Excel Table (bisa filter/sort).";
  ws.getCell(`A${startRow}`).font = {
    bold: true,
    color: { argb: COLORS.slate700 },
  };
  ws.getCell(`B${startRow}`).alignment = { horizontal: "right" };

  const headerRow = startRow + 2; // leave one row gap
  const tableRef = `A${headerRow}`;

  function rowsToTableRows(sectionName, rows) {
    let group = "";
    const out = [];
    for (const r of rows) {
      if (r.spacer) continue;
      if (r.header) {
        group = r.label;
        continue;
      }
      const komponen = r.indent ? `  ${r.label}` : r.label;
      const nilai = r.minus ? -Number(r.value || 0) : Number(r.value || 0);
      out.push([sectionName, group, komponen, nilai]);
    }
    return out;
  }

  const tableRows = [
    ...rowsToTableRows("Ringkasan", ringkasanRows),
    ...rowsToTableRows("Laba Rugi", labaRugiRows),
    ...rowsToTableRows("Neraca", neracaRows),
  ];

  ws.addTable({
    name: "LaporanRingkas",
    ref: tableRef,
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleMedium9", showRowStripes: true },
    columns: [
      { name: "Laporan" },
      { name: "Grup" },
      { name: "Komponen" },
      { name: "Nilai" },
    ],
    rows: tableRows,
  });

  ws.getColumn(1).width = 14;
  ws.getColumn(2).width = 18;
  ws.getColumn(3).width = 46;
  ws.getColumn(4).width = 22;
  ws.getColumn(4).numFmt = '"Rp" #,##0;[Red]("Rp" #,##0)';
  ws.getColumn(4).alignment = { horizontal: "right" };

  ws.views = [{ state: "frozen", ySplit: headerRow }];
  return ws;
}

function addSingleReportSheet(
  workbook,
  { meta, ringkasanRows, labaRugiRows, neracaRows },
) {
  const ws = workbook.addWorksheet("Laporan");
  setupWorksheet(ws);
  writeDocumentHeader(ws, meta);

  ws.headerFooter = {
    oddFooter: `&L${meta?.namaUsaha || ""}&CPeriode ${meta?.periodeText || ""}&RHalaman &P / &N`,
  };

  let currentRow = 7;
  const sec1 = writeSection(ws, {
    title: "Ringkasan Keuangan",
    rows: ringkasanRows,
    startRow: currentRow,
  });
  const sec2 = writeSection(ws, {
    title: "Laporan Laba Rugi",
    rows: labaRugiRows,
    startRow: sec1.nextRow,
  });
  writeSection(ws, {
    title: "Laporan Neraca",
    rows: neracaRows,
    startRow: sec2.nextRow,
  });

  // Freeze top meta area + first table header visibility (works across viewers)
  ws.views = [{ state: "frozen", ySplit: 8 }];
  return ws;
}

export async function streamLaporanXlsx({ userId, year, month }, res) {
  const period = resolveLaporanPeriod({ year, month });
  if (period.error) {
    res.status(400).json({ message: period.error });
    return;
  }

  const { y, start, end, startDate, endDate, periodTitle, periodTag } = period;

  const pool = getPool();
  const userRes = await pool.query(
    `SELECT nama_usaha as "namaUsaha", email FROM users WHERE id=$1`,
    [userId],
  );
  const user = userRes.rows[0];
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  const [lr, nr, db] = await Promise.all([
    labaRugiSvc(userId, { start, end }),
    neracaSvc(userId, { start, end }),
    dashboardSvc(userId, { start, end }),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Akutansi";
  workbook.created = new Date();
  workbook.views = [{ activeTab: 0 }];

  const meta = {
    namaUsaha: user.namaUsaha,
    email: user.email,
    periodeText: `${y} (01 Jan ${y} – 31 Des ${y})`,
    createdText: new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date()),
  };

  const fmt = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  meta.periodeText = `${periodTitle} (${fmt.format(startDate)} – ${fmt.format(endDate)})`;

  addSingleReportSheet(workbook, {
    meta,
    ringkasanRows: rowsRingkasan(db),
    labaRugiRows: rowsLabaRugi(lr),
    neracaRows: rowsNeraca(nr),
  });
  addDataTableSheet(workbook, {
    meta,
    ringkasanRows: rowsRingkasan(db),
    labaRugiRows: rowsLabaRugi(lr),
    neracaRows: rowsNeraca(nr),
  });

  const filename = `Laporan_Akutansi_${safeFilePart(user.namaUsaha)}_${periodTag}.xlsx`;

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);

  await workbook.xlsx.write(res);
  res.end();
}
