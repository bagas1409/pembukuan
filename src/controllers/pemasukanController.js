import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiError.js";
import {
  createPemasukan,
  listPemasukan,
  getPemasukanById,
  updatePemasukan,
  deletePemasukan
} from "../services/pemasukanService.js";

const create = asyncHandler(async (req, res) => {
  if (!req.body) throw new ApiError(400, "Body is required");
  const doc = await createPemasukan(req.user.id, req.body);
  res.status(201).json({ data: doc });
});

const list = asyncHandler(async (req, res) => {
  const docs = await listPemasukan(req.user.id, req.query);
  res.json({ data: docs });
});

const getById = asyncHandler(async (req, res) => {
  const doc = await getPemasukanById(req.user.id, req.params.id);
  res.json({ data: doc });
});

const update = asyncHandler(async (req, res) => {
  const doc = await updatePemasukan(req.user.id, req.params.id, req.body || {});
  res.json({ data: doc });
});

const remove = asyncHandler(async (req, res) => {
  await deletePemasukan(req.user.id, req.params.id);
  res.json({ message: "Deleted" });
});

export { create, list, getById, update, remove };

