const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: false },
  password: { type: String, required: true },
  role: { type: String, enum: ['volunteer', 'ngo_admin', 'user'], required: true },
  teamName: { type: String, default: null },
  points: { type: Number, default: 0 },
  tasksCompleted: { type: Number, default: 0 },
  skills: { type: [String], default: ['Medical', 'Logistics', 'First Aid'] },
  
  isVerified: { type: Boolean, default: false },
  otp: { type: String },
  otpExpires: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
