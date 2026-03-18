import asyncHandler from "../utils/asyncHandler.js";
import { createPersediaan, listPersediaan, deletePersediaan } from "../services/persediaanService.js";

const create = asyncHandler(async (req, res) => {
  const doc = await createPersediaan(req.user.id, req.body);
  res.status(201).json({ data: doc });
});

const list = asyncHandler(async (req, res) => {
  const docs = await listPersediaan(req.user.id, req.query);
  res.json({ data: docs });
});

const remove = asyncHandler(async (req, res) => {
  await deletePersediaan(req.user.id, req.params.id);
  res.json({ message: "Persediaan dihapus" });
});

export { create, list, remove };

