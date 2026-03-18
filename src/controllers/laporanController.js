import asyncHandler from "../utils/asyncHandler.js";
import { labaRugi as labaRugiSvc, neraca as neracaSvc, dashboard as dashboardSvc } from "../services/laporanService.js";
import { streamLaporanPdf } from "../services/laporanPdfService.js";
import { streamLaporanXlsx } from "../services/laporanXlsxService.js";
import { streamLaporanCsv } from "../services/laporanCsvService.js";

const labaRugi = asyncHandler(async (req, res) => {
  const data = await labaRugiSvc(req.user.id, req.query);
  res.json({ data });
});

const neraca = asyncHandler(async (req, res) => {
  const data = await neracaSvc(req.user.id, req.query);
  res.json({ data });
});

const dashboard = asyncHandler(async (req, res) => {
  const data = await dashboardSvc(req.user.id, req.query);
  res.json({ data });
});

const pdf = asyncHandler(async (req, res) => {
  const year = req.query?.year ? Number(req.query.year) : null;
  await streamLaporanPdf({ userId: req.user.id, year }, res);
});

const xlsx = asyncHandler(async (req, res) => {
  const year = req.query?.year ? Number(req.query.year) : null;
  await streamLaporanXlsx({ userId: req.user.id, year }, res);
});

const csv = asyncHandler(async (req, res) => {
  const year = req.query?.year ? Number(req.query.year) : null;
  await streamLaporanCsv({ userId: req.user.id, year }, res);
});

export { labaRugi, neraca, dashboard, pdf, xlsx, csv };
