import { getPool } from "../config/db.js";
import { dashboard as dashboardSvc, labaRugi as labaRugiSvc, neraca as neracaSvc } from "./laporanService.js";
import { rowsRingkasan, rowsLabaRugi, rowsNeraca, safeFilePart } from "./laporanExportRows.js";
import { resolveLaporanPeriod } from "./laporanPeriod.js";

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

export async function streamLaporanCsv({ userId, year, month }, res) {
  const period = resolveLaporanPeriod({ year, month });
  if (period.error) {
    res.status(400).json({ message: period.error });
    return;
  }

  const { y, start, end, periodTag } = period;

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
    dashboardSvc(userId, { start, end })
  ]);

  const lines = [];
  lines.push(["Laporan", "Grup", "Komponen", "Nilai"].map(csvEscape).join(";"));
  addSection(lines, "Ringkasan", rowsRingkasan(db));
  addSection(lines, "Laba Rugi", rowsLabaRugi(lr));
  addSection(lines, "Neraca", rowsNeraca(nr));

  const filename = `Laporan_Akutansi_${safeFilePart(user.namaUsaha)}_${periodTag}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);

  // UTF-8 BOM for Excel compatibility (ID locale)
  res.send("\uFEFF" + lines.join("\r\n"));
}
