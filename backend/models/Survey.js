const mongoose = require('mongoose');

const surveySchema = new mongoose.Schema({
  rawOcr:      { type: String, default: '' },
  aiSummary:   { type: String, default: '' },
  title:       { type: String, default: '' },
  location:    { type: String, required: true },
  lat:         { type: Number, default: null },
  lon:         { type: Number, default: null },

  // ── Intelligence Slate (structured OCR extraction) ────────────────────────
  category:     { type: String, enum: ['Emergency', 'Logistics', 'Water', 'Food', 'Medical', 'Shelter', 'Infrastructure', 'Other'], default: 'Other' },
  quantity:     { type: Number, default: null },
  unit:         { type: String, default: '' },
  urgencyScore: { type: Number, min: 1, max: 5, default: null }, // 1=low, 5=life-threatening
  locationHint: { type: String, default: '' },

  urgency:     { type: String, enum: ['Critical', 'High', 'Medium', 'Low'], required: true },
  status:      { type: String, enum: ['pending', 'verified', 'resolved', 'allocated', 'Moderation'], default: 'pending' },
  isVisibleToAll:       { type: Boolean, default: true },
  radiusLimit: { type: Number, default: 200 },
  assignedVolunteerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  creatorRole: { type: String, enum: ['NGO', 'Volunteer'], default: 'Volunteer' },
  verifiedBy:  { type: String, default: null },
  isGpsVerified: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Survey', surveySchema);
