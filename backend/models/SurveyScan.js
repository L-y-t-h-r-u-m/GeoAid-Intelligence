const mongoose = require('mongoose');

const surveyScanSchema = new mongoose.Schema({
  needs: [{ type: String }],
  sector: { type: String },
  status: { type: String, enum: ['Critical', 'High', 'Med', 'Medium', 'Low', 'Unknown'], default: 'Unknown' },
  rawText: { type: String },
  requiresManualReview: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SurveyScan', surveyScanSchema);
