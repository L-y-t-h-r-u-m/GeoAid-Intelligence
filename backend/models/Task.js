const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String, default: '' },
  location:    { type: String, required: true },
  lat:         { type: Number, default: null },
  lon:         { type: Number, default: null },

  // ── Intelligence Slate (structured OCR extraction) ────────────────────────
  category:     { type: String, enum: ['Emergency', 'Logistics', 'Water', 'Food', 'Medical', 'Shelter', 'Infrastructure', 'Other'], default: 'Other' },
  quantity:     { type: Number, default: null },
  unit:         { type: String, default: '' },
  urgencyScore: { type: Number, min: 1, max: 5, default: null }, 
  locationHint: { type: String, default: '' },
  tags: [{ type: String }],

  // ── Task Management ────────────────────────────────────────────────────────
  status: { type: String, enum: ['pending', 'verified', 'resolved', 'allocated', 'Moderation', 'Open', 'In-progress', 'Completed'], default: 'pending' },
  priority: { type: String, enum: ['Critical', 'High', 'Medium', 'Low'], default: 'Medium' },
  verificationStatus: { type: String, enum: ['Pending', 'Verified', 'Flagged', 'Resolved'], default: 'Pending' },
  
  // Visibility & Triage
  radiusLimit: { type: Number, default: 200 },
  isMock: { type: Boolean, default: false },

  // Legacy/Vouching
  vouches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], 
  creatorRole: { type: String, enum: ['NGO', 'Volunteer'], default: 'Volunteer' },
  verifiedBy: { type: String, default: null }, 

  // Assignment
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  isGpsVerified: { type: Boolean, default: false },

  // OCR References
  rawOcr: { type: String, default: '' },
  aiSummary: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
