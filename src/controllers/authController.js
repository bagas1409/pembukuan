import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiError.js";
import { register as registerSvc, login as loginSvc, me as meSvc } from "../services/authService.js";

const register = asyncHandler(async (req, res) => {
  const { namaUsaha, email, password } = req.body || {};
  if (!namaUsaha || !email || !password) throw new ApiError(400, "namaUsaha, email, password are required");
  const result = await registerSvc({ namaUsaha, email, password });
  res.status(201).json(result);
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw new ApiError(400, "email, password are required");
  const result = await loginSvc({ email, password });
  res.json(result);
});

const me = asyncHandler(async (req, res) => {
  const result = await meSvc(req.user.id);
  res.json({ user: result });
});

export { register, login, me };
