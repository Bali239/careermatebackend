export const SuccessResponse = (status, res, data, message = 'Success') => {
  return res.status(status).json({
    status: 'success',
    message,
    data,
  });
};

export const ErrorResponse = (status, res, error, message = 'Error') => {
  return res.status(status).json({
    status: 'error',
    message,
    error,
  });
};