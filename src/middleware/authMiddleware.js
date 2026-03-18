import jwt from "jsonwebtoken";
import ApiError from "../utils/apiError.js";

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(new ApiError(401, "Unauthorized"));
  }

  const token = header.substring("Bearer ".length);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id };
    return next();
  } catch {
    return next(new ApiError(401, "Invalid token"));
  }
}

export default authMiddleware;
