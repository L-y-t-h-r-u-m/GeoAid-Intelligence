const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Review = require('../models/Review');
const { protect } = require('../middleware/authMiddleware');
const verifyNgoRole = require('../middleware/ngoMiddleware');

// POST /api/users/:id/review (NGO Admins rating volunteers)
router.post('/:id/review', protect, verifyNgoRole, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const volunteer = await User.findById(req.params.id);
    if (!volunteer || volunteer.role !== 'volunteer') {
      return res.status(404).json({ error: 'Volunteer not found' });
    }

    const newReview = new Review({
      adminId: req.user.id,
      volunteerId: req.params.id,
      rating,
      comment
    });

    await newReview.save();

    res.status(200).json({ message: 'Review submitted successfully', review: newReview });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// PUT /api/users/:id/skills (Update volunteer skills)
router.put('/:id/skills', protect, async (req, res) => {
  try {
    // Only allow users to update their own skills, or admins
    if (req.user.id !== req.params.id && req.user.role !== 'ngo_admin') {
      return res.status(403).json({ error: 'Unauthorized to update these skills' });
    }

    const { skills } = req.body;
    if (!Array.isArray(skills)) {
      return res.status(400).json({ error: 'Skills must be an array of strings' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { skills } },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ message: 'Skills updated successfully', skills: user.skills });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update skills' });
  }
});

module.exports = router;
