function notFound(req, res) {
  res.status(404).json({ message: 'Route not found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;
  const exposeMessage = status < 500 || process.env.NODE_ENV !== 'production';
  const message = exposeMessage && err.message ? err.message : 'Internal server error';
  res.status(status).json({ message });
}

module.exports = { notFound, errorHandler };

