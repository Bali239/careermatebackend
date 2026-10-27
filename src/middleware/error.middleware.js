export function notFoundHandler(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

export function errorHandler(error, req, res, next) {
  const statusCode =
    error?.name === 'MulterError'
      ? error.code === 'LIMIT_FILE_SIZE'
        ? 413
        : 400
      : Number.isInteger(error.statusCode)
        ? error.statusCode
        : 500;
  if (error?.name === 'MulterError')
    error.message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'CV must be 10 MB or smaller'
        : 'Upload a PDF or Word document';
  const message = statusCode >= 500 ? 'Internal server error' : error.message;

  if (statusCode >= 500) {
    console.error('Request failed:', error.message);
  }

  res.status(statusCode).json({
    status: 'error',
    message,
    ...(process.env.NODE_ENV === 'development' && statusCode >= 500 ? { stack: error.stack } : {}),
    ...(error.details ? { details: error.details } : {}),
  });
}
