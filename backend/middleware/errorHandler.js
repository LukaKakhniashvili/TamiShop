const notFound = (req, res, next) => {
  res.status(404);
  next(new Error(`ბილიკი ვერ მოიძებნა - ${req.originalUrl}`));
};

const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // Mongoose bad ObjectId
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'რესურსი ვერ მოიძებნა';
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0];
    message = `მსგავსი მნიშვნელობა უკვე არსებობს${field ? ` ველისთვის: ${field}` : ''}`;
  }

  res.status(statusCode).json({
    message,
    // მანქანურად წასაკითხი დეტალები (მაგ. { code: 'RESEND_COOLDOWN', resendAvailableInSeconds })
    ...(err.details || {}),
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};

module.exports = { notFound, errorHandler };
