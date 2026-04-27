const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// CORS configuration to allow Vercel frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || '*', // Set to your vercel domain in prod
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());

// Load Routes
const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const ocrRoutes = require('./routes/ocrRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const userRoutes = require('./routes/userRoutes');

// Use Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/surveys', taskRoutes); // Alias for frontend compatibility
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api', ocrRoutes);

// ── Database & Seeding ────────────────────────────────────────────────────────
const Task = require('./models/Task');

const seedDatabase = async () => {
  try {
    const mockTasks = [
      // ── Local Tasks (NYC area) ─────────────────────────────
      {
        title: 'Emergency: Medical Supplies Needed',
        location: 'Downtown Medical Center', lat: 40.7128, lon: -74.0060,
        category: 'Medical', priority: 'Critical', urgencyScore: 5,
        status: 'resolved', verificationStatus: 'Resolved',
        verifiedBy: 'NGO Admin', creatorRole: 'NGO',
        description: 'Immediate delivery of insulin and bandages required.',
        radiusLimit: 10, isMock: true, isGpsVerified: true,
        tags: ['Medical', 'Emergency']
      },
      {
        title: 'Water Distribution Point',
        location: 'Prospect Park Entrance', lat: 40.6732, lon: -73.9701,
        category: 'Water', priority: 'High', urgencyScore: 4,
        status: 'verified', verificationStatus: 'Verified',
        verifiedBy: 'NGO Admin', creatorRole: 'NGO',
        description: 'Clean drinking water distribution for local residents.',
        radiusLimit: 50, isMock: true, isGpsVerified: false,
        tags: ['Water', 'Logistics']
      },
      {
        title: 'Debris Clearing on Main St',
        location: 'Main St & 5th Ave', lat: 40.7580, lon: -73.9855,
        category: 'Infrastructure', priority: 'Medium', urgencyScore: 3,
        status: 'verified', verificationStatus: 'Verified',
        verifiedBy: 'Community', creatorRole: 'Volunteer',
        description: 'Heavy branches blocking traffic. Needs community support.',
        radiusLimit: 120, isMock: true, isGpsVerified: false,
        tags: ['Infrastructure']
      },
      {
        title: 'Emergency Food Packs - Shelter Zone A',
        location: 'Community Shelter Zone A', lat: 40.7282, lon: -73.7949,
        category: 'Food', priority: 'Critical', urgencyScore: 5,
        status: 'verified', verificationStatus: 'Verified',
        verifiedBy: 'Community', creatorRole: 'Volunteer',
        description: '200 families need food packs urgently. No supplies left.',
        radiusLimit: 30, isMock: true, isGpsVerified: false,
        tags: ['Food', 'Emergency']
      },
      {
        title: 'Temporary Shelter Setup',
        location: 'Flushing Meadows Park', lat: 40.7282, lon: -73.8458,
        category: 'Shelter', priority: 'High', urgencyScore: 4,
        status: 'pending', verificationStatus: 'Pending',
        verifiedBy: null, creatorRole: 'Volunteer',
        description: '50 displaced families need temporary shelter.',
        radiusLimit: 80, isMock: true, isGpsVerified: false,
        tags: ['Shelter']
      },
      {
        title: 'Medical Triage Point Needed',
        location: 'Bronx Community Hospital', lat: 40.8448, lon: -73.8648,
        category: 'Medical', priority: 'Low', urgencyScore: 2,
        status: 'pending', verificationStatus: 'Pending',
        verifiedBy: null, creatorRole: 'Volunteer',
        description: 'Minor injuries - need basic first aid supplies.',
        radiusLimit: 200, isMock: true, isGpsVerified: false,
        tags: ['Medical']
      },
      // ── Global Tasks ──────────────────────────────────────
      {
        title: 'Flood Relief - Chennai Coast',
        location: 'Chennai, India', lat: 13.0827, lon: 80.2707,
        category: 'Emergency', priority: 'Critical', urgencyScore: 5,
        status: 'verified', verificationStatus: 'Verified',
        verifiedBy: 'NGO Admin', creatorRole: 'NGO',
        description: 'Severe flooding affecting coastal villages. Boats & supplies needed.',
        radiusLimit: 100, isMock: true, isGpsVerified: true,
        tags: ['Emergency', 'Water', 'Rescue']
      },
      {
        title: 'Earthquake Response - Kahramanmaras',
        location: 'Kahramanmaras, Turkey', lat: 37.5858, lon: 36.9371,
        category: 'Emergency', priority: 'Critical', urgencyScore: 5,
        status: 'resolved', verificationStatus: 'Resolved',
        verifiedBy: 'NGO Admin', creatorRole: 'NGO',
        description: 'Rescue teams required for structural collapse sites.',
        radiusLimit: 50, isMock: true, isGpsVerified: true,
        tags: ['Emergency', 'Rescue', 'Medical']
      },
      {
        title: 'Refugee Food Distribution - Nairobi',
        location: 'Nairobi, Kenya', lat: -1.2921, lon: 36.8219,
        category: 'Food', priority: 'High', urgencyScore: 4,
        status: 'verified', verificationStatus: 'Verified',
        verifiedBy: 'NGO Admin', creatorRole: 'NGO',
        description: 'Weekly food ration for 500+ refugee families.',
        radiusLimit: 200, isMock: true, isGpsVerified: false,
        tags: ['Food', 'Logistics']
      },
      {
        title: 'Clean Water Supply - Dhaka Slum',
        location: 'Dhaka, Bangladesh', lat: 23.8103, lon: 90.4125,
        category: 'Water', priority: 'Medium', urgencyScore: 3,
        status: 'pending', verificationStatus: 'Pending',
        verifiedBy: null, creatorRole: 'Volunteer',
        description: 'Contaminated water supply affecting 1000 residents.',
        radiusLimit: 200, isMock: true, isGpsVerified: false,
        tags: ['Water']
      },
      {
        title: 'Community Mental Health Support',
        location: 'Beirut, Lebanon', lat: 33.8938, lon: 35.5018,
        category: 'Medical', priority: 'Low', urgencyScore: 2,
        status: 'pending', verificationStatus: 'Pending',
        verifiedBy: null, creatorRole: 'Volunteer',
        description: 'Post-trauma counseling groups needed in the community center.',
        radiusLimit: 200, isMock: true, isGpsVerified: false,
        tags: ['Medical', 'Counseling']
      },
      {
        title: 'Wildfire Evacuation Assistance',
        location: 'Sydney, Australia', lat: -33.8688, lon: 151.2093,
        category: 'Emergency', priority: 'Critical', urgencyScore: 5,
        status: 'verified', verificationStatus: 'Verified',
        verifiedBy: 'NGO Admin', creatorRole: 'NGO',
        description: 'Immediate evacuation transport needed as fires spread to suburbs.',
        radiusLimit: 100, isMock: true, isGpsVerified: true,
        tags: ['Emergency', 'Transport', 'Rescue']
      }
    ];

    await Task.insertMany(mockTasks);
    console.log('✅ Mock database seeded with 10 local + global intelligence tasks.');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  }
};

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/resource-allocation';

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log(`Connected to MongoDB Database`);
    
    // Auto-Seeding Logic
    const count = await Task.countDocuments();
    if (count === 0) {
      console.log('🚀 No tasks found. Initializing auto-seed...');
      await seedDatabase();
    }

    const server = app.listen(PORT, () => console.log(`Backend server successfully running on port ${PORT}`));
    
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Please kill the process or use a different port.`);
        process.exit(1);
      } else {
        console.error('❌ Server error:', err);
      }
    });
  })
  .catch(err => console.error('❌ MongoDB connection error. Is your local DB running? Error:', err));
