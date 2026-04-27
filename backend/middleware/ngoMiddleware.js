/**
 * Middleware ensuring User is an NGO before access is granted.
 * Assumes `req.user` is securely mapped earlier in the flow.
 */
const verifyNgoRole = (req, res, next) => {
  if (req.user && req.user.role === 'ngo_admin') {
    next();
  } else {
    return res.status(403).json({ error: 'Forbidden: NGO access required' });
  }
};

module.exports = verifyNgoRole;
