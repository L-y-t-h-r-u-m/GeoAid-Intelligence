const mongoose = require('mongoose');

const volunteerScanSchema = new mongoose.Schema({
  fullName: { type: String },
  skills: [{ type: String }],
  contactNumber: { type: String },
  rawText: { type: String },
  requiresManualReview: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('VolunteerScan', volunteerScanSchema);
