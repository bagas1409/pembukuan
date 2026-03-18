import asyncHandler from "../utils/asyncHandler.js";
import { listUtangPiutang, getUtangPiutangById } from "../services/utangPiutangService.js";

const list = asyncHandler(async (req, res) => {
  const docs = await listUtangPiutang(req.user.id, req.query);
  res.json({ data: docs });
});

const getById = asyncHandler(async (req, res) => {
  const doc = await getUtangPiutangById(req.user.id, req.params.id);
  res.json({ data: doc });
});

export { list, getById };

