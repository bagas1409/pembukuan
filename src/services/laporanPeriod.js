function pad2(n) {
  return String(n).padStart(2, "0");
}

function monthNameId(y, m) {
  const d = new Date(Date.UTC(y, m - 1, 1));
  return new Intl.DateTimeFormat("id-ID", { month: "long" }).format(d);
}

function formatDateId(d) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

export function resolveLaporanPeriod({ year, month }) {
  const y = year && Number.isFinite(year) ? year : new Date().getFullYear();
  if (!Number.isInteger(y) || y < 1900 || y > 2100) {
    return { error: "year tidak valid" };
  }

  const m = month === null || month === undefined ? null : Number(month);
  if (m !== null) {
    if (!Number.isInteger(m) || m < 1 || m > 12) {
      return { error: "month tidak valid" };
    }

    const mm = pad2(m);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const dd = pad2(lastDay);
    const start = `${y}-${mm}-01`;
    const end = `${y}-${mm}-${dd}`;
    const startDate = new Date(`${start}T00:00:00.000Z`);
    const endDate = new Date(`${end}T00:00:00.000Z`);
    const periodTitle = `${monthNameId(y, m)} ${y}`;
    const periodeLine = `Periode: ${periodTitle} (${formatDateId(startDate)} – ${formatDateId(endDate)})`;
    const periodTag = `${y}-${mm}`;

    return { y, month: m, start, end, startDate, endDate, periodTitle, periodeLine, periodTag };
  }

  const start = `${y}-01-01`;
  const end = `${y}-12-31`;
  const startDate = new Date(`${y}-01-01T00:00:00.000Z`);
  const endDate = new Date(`${y}-12-31T00:00:00.000Z`);
  const periodeLine = `Periode: ${y} (${formatDateId(startDate)} – ${formatDateId(endDate)})`;
  const periodTag = String(y);

  return { y, month: null, start, end, startDate, endDate, periodTitle: String(y), periodeLine, periodTag };
}

