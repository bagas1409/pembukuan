import asyncHandler from "../utils/asyncHandler.js";
import { listAset, createAset, deleteAset } from "../services/asetService.js";

const list = asyncHandler(async (req, res) => {
  const docs = await listAset(req.user.id, req.query);
  res.json({ data: docs });
});

const create = asyncHandler(async (req, res) => {
  const doc = await createAset(req.user.id, req.body);
  res.status(201).json({ data: doc });
});

const remove = asyncHandler(async (req, res) => {
  await deleteAset(req.user.id, req.params.id);
  res.json({ message: "Aset dihapus" });
});

export { list, create, remove };
