import { getPool } from "../config/db.js";
import { dashboard as dashboardSvc, labaRugi as labaRugiSvc, neraca as neracaSvc } from "./laporanService.js";
import { rowsRingkasan, rowsLabaRugi, rowsNeraca, safeFilePart } from "./laporanExportRows.js";

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function toNumberSigned(r) {
  if (r.value === undefined || r.value === null) return "";
  const n = Number(r.value || 0);
  return r.minus ? -n : n;
}

function addSection(lines, sectionName, rows) {
  let group = "";
  for (const r of rows) {
    if (r.spacer) continue;
    if (r.header) {
      group = r.label;
      continue;
    }
    const komponen = r.indent ? `  ${r.label}` : r.label;
    lines.push([sectionName, group, komponen, toNumberSigned(r)].map(csvEscape).join(";"));
  }
}

export async function streamLaporanCsv({ userId, year }, res) {
  const y = year && Number.isFinite(year) ? year : new Date().getFullYear();
  if (!Number.isInteger(y) || y < 2000 || y > 2100) {
    res.status(400).json({ message: "year tidak valid" });
    return;
  }

  const start = `${y}-01-01`;
  const end = `${y}-12-31`;

  const pool = getPool();
  const userRes = await pool.query(`SELECT nama_usaha as "namaUsaha" FROM users WHERE id=$1`, [userId]);
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

  const lines = [];
  lines.push(["Laporan", "Grup", "Komponen", "Nilai"].map(csvEscape).join(";"));
  addSection(lines, "Ringkasan", rowsRingkasan(db));
  addSection(lines, "Laba Rugi", rowsLabaRugi(lr));
  addSection(lines, "Neraca", rowsNeraca(nr));

  const filename = `Laporan_Akutansi_${safeFilePart(user.namaUsaha)}_${y}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);

  // UTF-8 BOM for Excel compatibility (ID locale)
  res.send("\uFEFF" + lines.join("\r\n"));
}
