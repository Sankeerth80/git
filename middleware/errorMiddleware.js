const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);

  const isProduction = process.env.NODE_ENV === 'production';

  res.json({
    success: false,
    message: err.message,
    code: err.code || 'SERVER_ERROR',
    stack: isProduction ? undefined : err.stack,
  });
};

module.exports = { notFound, errorHandler };
