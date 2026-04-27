const adminPinMiddleware = (req, res, next) => {
  const pin = req.headers['x-admin-pin'] || req.body.adminPin;

  if (pin && pin === '1234') {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden: Invalid Admin PIN' });
  }
};

module.exports = { adminPinMiddleware };
