import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiError.js";
import { createPengeluaran, listPengeluaran, updatePengeluaran, deletePengeluaran } from "../services/pengeluaranService.js";

const create = asyncHandler(async (req, res) => {
  if (!req.body) throw new ApiError(400, "Body is required");
  const doc = await createPengeluaran(req.user.id, req.body);
  res.status(201).json({ data: doc });
});

const list = asyncHandler(async (req, res) => {
  const docs = await listPengeluaran(req.user.id, req.query);
  res.json({ data: docs });
});

const update = asyncHandler(async (req, res) => {
  const doc = await updatePengeluaran(req.user.id, req.params.id, req.body || {});
  res.json({ data: doc });
});

const remove = asyncHandler(async (req, res) => {
  await deletePengeluaran(req.user.id, req.params.id);
  res.json({ message: "Deleted" });
});

export { create, list, update, remove };

