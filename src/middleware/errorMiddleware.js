export function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Not Found - ${req.originalUrl}`));
}

export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
  // Log full error on server for easier debugging (especially for 500s).
  if (statusCode >= 500) {
    console.error(err);
  }
  res.status(statusCode).json({
    message: err.message || "Server Error",
    ...(process.env.NODE_ENV !== "production" && err?.stack ? { stack: err.stack } : {})
  });
}
