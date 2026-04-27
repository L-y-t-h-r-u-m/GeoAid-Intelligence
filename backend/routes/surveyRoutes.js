const express = require('express');
const router  = express.Router();
const { getSurveys, createSurvey, verifySurvey, resolveSurvey } = require('../controllers/surveyController');
const { protect }           = require('../middleware/authMiddleware');
const { adminPinMiddleware } = require('../middleware/adminPinMiddleware');

// GET all surveys (supports ?lat=&lon=&radius=&priority= query params)
router.get('/', getSurveys);

// POST create a survey
router.post('/', protect, createSurvey);

// PUT verify
router.put('/:id/verify', protect, verifySurvey);

// PUT resolve (NGO admin only)
router.put('/:id/resolve', protect, resolveSurvey);

// DELETE (admin password required)
router.delete('/:id', protect, async (req, res) => {
  const Survey = require('../models/Survey');
  const User   = require('../models/User');
  const bcrypt = require('bcryptjs');

  try {
    // 1. Must be an NGO admin
    if (req.user.role !== 'ngo_admin') {
      return res.status(403).json({ message: 'Forbidden: Only NGO admins can delete surveys.' });
    }

    // 2. Require password in request body
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ message: 'Password is required to authorize deletion.' });
    }

    // 3. Fetch the admin's stored password hash and verify
    const admin = await User.findById(req.user.id).select('+password');
    if (!admin) {
      return res.status(404).json({ message: 'Admin account not found.' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect Admin Password.' });
    }

    // 4. Authorized — delete the survey
    const deleted = await Survey.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Survey not found.' });
    }

    res.status(200).json({ message: 'Survey deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting survey', error: error.message });
  }
});

module.exports = router;
