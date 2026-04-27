const Task = require('../models/Task');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { calculateImpactPoints } = require('../utils/pointsEngine');

// ── Haversine helper (km) ─────────────────────────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET /api/tasks/all - Global Source of Truth
const getAllTasks = async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching all tasks', error: error.message });
  }
};

// GET /api/tasks - Filtered view for Map/Grid
const getTasks = async (req, res) => {
  try {
    const { lat, lon, radius = 200, priority, status } = req.query;
    let query = {};
    
    if (priority && priority !== 'All') query.priority = priority;
    if (status) query.status = status;

    let tasks = await Task.find(query).populate('assignedTo', 'name email');

    if (lat && lon) {
      const vLat = parseFloat(lat);
      const vLon = parseFloat(lon);
      const km   = parseFloat(radius);
      tasks = tasks.filter(s => {
        if (s.lat == null || s.lon == null) return true;
        return haversineKm(vLat, vLon, s.lat, s.lon) <= km;
      });
    }

    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching tasks', error: error.message });
  }
};

// POST /api/tasks - Create Task with Heuristic Triage
const createTask = async (req, res) => {
  try {
    let {
      title, location, lat, lon,
      urgency,  // from Survey / OCR path
      priority, // from Task / manual path
      aiSummary, rawOcr,
      category, quantity, unit, urgencyScore, locationHint,
    } = req.body;

    // Normalise — accept either field name from the frontend
    urgency = urgency || priority;

    if (!location) return res.status(400).json({ message: 'Location is required' });

    // Heuristic Triage Engine — only fires when urgency was NOT explicitly set by the user
    const textToAnalyze = `${title || ''} ${aiSummary || ''} ${rawOcr || ''} ${category || ''}`.toLowerCase();
    let radiusLimit = 200;
    const userPickedUrgency = Boolean(req.body.urgency || req.body.priority); // explicit user choice?

    if (!userPickedUrgency && textToAnalyze.match(/medical|blood|fire|injury/)) {
      category = 'Emergency';
      urgency = 'Critical';
      urgencyScore = 5;
      radiusLimit = 10;
    } else if (!userPickedUrgency && textToAnalyze.match(/food|water|blanket|supplies/)) {
      category = 'Logistics';
      urgency = 'High';
      urgencyScore = 4;
      radiusLimit = 50;
    } else if (!userPickedUrgency && textToAnalyze.match(/road|power|bridge|shelter/)) {
      category = 'Infrastructure';
      urgency = 'Medium';
      urgencyScore = 3;
      radiusLimit = 120;
    } else {
      // Respect user's explicit choice; fall back to Low for AI-inferred tasks
      urgency = urgency || 'Low';
      urgencyScore = urgencyScore || 2;
      radiusLimit = 200;
    }

    // Final priority level (what gets stored in Task.priority)
    const finalPriority = urgency;

    let status = req.user?.role === 'ngo_admin' ? 'verified' : 'pending';
    let verificationStatus = req.user?.role === 'ngo_admin' ? 'Verified' : 'Pending';
    let verifiedBy = req.user?.role === 'ngo_admin' ? 'NGO Admin' : null;


    // Auto-allocate tags algorithm
    const extractedTags = new Set();
    const keywords = ['medical', 'food', 'water', 'shelter', 'logistics', 'infrastructure', 'emergency', 'supplies', 'fire', 'rescue', 'doctor', 'blood'];
    keywords.forEach(kw => {
      if (textToAnalyze.includes(kw)) {
        extractedTags.add(kw.charAt(0).toUpperCase() + kw.slice(1));
      }
    });
    if (category && category !== 'Other') extractedTags.add(category);

    const task = await Task.create({
      title, location, lat, lon,
      priority: finalPriority,   // Task model field
      aiSummary, rawOcr,
      category, quantity, unit, urgencyScore, locationHint, radiusLimit,
      creatorRole: req.user?.role === 'ngo_admin' ? 'NGO' : 'Volunteer',
      verificationStatus,
      status,
      verifiedBy,
      tags: Array.from(extractedTags)
    });

    const allTasks = await Task.find().sort({ createdAt: -1 });
    res.status(201).json({ message: 'Task created successfully', task, allTasks });
  } catch (error) {
    res.status(500).json({ message: 'Error creating task', error: error.message });
  }
};

// PUT /api/tasks/:id/verify - NGO Admin Verification
const verifyTask = async (req, res) => {
  try {
    if (req.user.role !== 'ngo_admin') return res.status(403).json({ message: 'NGO Admin role required' });

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const { category, quantity, unit, urgencyScore, locationHint, aiSummary, tags, location, priority, title } = req.body;
    if (category)     task.category     = category;
    if (quantity != null) task.quantity = Number(quantity);
    if (unit)         task.unit         = unit;
    if (urgencyScore != null) task.urgencyScore = Number(urgencyScore);
    if (locationHint) task.locationHint = locationHint;
    if (aiSummary)    task.aiSummary    = aiSummary;
    if (tags && Array.isArray(tags))  task.tags = tags;
    if (location)     task.location     = location;
    if (priority)     task.priority     = priority;
    if (title)        task.title        = title;

    task.status = 'verified';
    task.verificationStatus = 'Verified';
    task.verifiedBy = req.user.name || 'NGO Admin';
    await task.save();

    // Reward original reporter if exists
    // (In this system, we can award points if assignedVolunteerId/creator is present)
    
    const allTasks = await Task.find().sort({ createdAt: -1 });
    res.status(200).json({ message: 'Task verified', task, allTasks });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying task', error: error.message });
  }
};

// PUT /api/tasks/:id/resolve
const resolveTask = async (req, res) => {
  try {
    if (req.user.role !== 'ngo_admin') return res.status(403).json({ message: 'Forbidden' });

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const { userLat, userLng } = req.body;
    let isGpsVerified = false;

    if (userLat != null && userLng != null && task.lat != null && task.lon != null) {
      const dist = haversineKm(parseFloat(userLat), parseFloat(userLng), task.lat, task.lon);
      if (dist <= (task.radiusLimit || 200)) {
        isGpsVerified = true;
      }
    }

    task.status = 'resolved';
    task.verificationStatus = 'Resolved';
    task.isVisibleToAll = false;
    task.isGpsVerified = isGpsVerified;
    await task.save();

    const allTasks = await Task.find().sort({ createdAt: -1 });
    res.status(200).json({ message: 'Task resolved', task, allTasks });
  } catch (error) {
    res.status(500).json({ message: 'Error resolving task', error: error.message });
  }
};

// DELETE /api/tasks/:id - Delete with Password Challenge
const deleteTask = async (req, res) => {
  try {
    if (req.user.role !== 'ngo_admin') return res.status(403).json({ message: 'Forbidden' });

    const { password } = req.body;
    if (!password) return res.status(400).json({ message: 'Admin password required for deletion' });

    // Find the admin user to check password
    const adminUser = await User.findById(req.user.id);
    const isMatch = await bcrypt.compare(password, adminUser.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid admin password' });

    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const allTasks = await Task.find().sort({ createdAt: -1 });
    res.status(200).json({ message: 'Task deleted permanently', allTasks });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting task', error: error.message });
  }
};

// POST /api/tasks/:id/vouch
const vouchTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (task.vouches.some(v => v.toString() === req.user.id.toString())) {
      return res.status(400).json({ message: 'Already vouched' });
    }

    task.vouches.push(req.user.id);
    
    // Auto-verify if more than 3 vouches (so 4 or more)
    if (task.vouches.length > 3 && task.status === 'pending') {
      task.status = 'verified';
      task.verificationStatus = 'Verified';
      task.verifiedBy = 'Community Vouched';
    }

    await task.save();
    
    // Award points for vouching
    await User.findByIdAndUpdate(req.user.id, { $inc: { points: 5 } });

    const allTasks = await Task.find().sort({ createdAt: -1 });
    res.status(200).json({ message: 'Vouch recorded', task, allTasks });
  } catch (error) {
    res.status(500).json({ message: 'Error vouching', error: error.message });
  }
};

// POST /api/tasks/:id/complete
const completeTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    
    if (task.status === 'Completed') return res.status(400).json({ message: 'Already completed' });

    task.status = 'Completed';
    task.completedBy = req.user.id;
    await task.save();

    const points = calculateImpactPoints(task.priority);
    await User.findByIdAndUpdate(req.user.id, { 
      $inc: { points: points, tasksCompleted: 1 } 
    });

    const allTasks = await Task.find().sort({ createdAt: -1 });
    res.status(200).json({ message: `Task completed! Earned ${points} points.`, task, allTasks });
  } catch (error) {
    res.status(500).json({ message: 'Error completing task', error: error.message });
  }
};

module.exports = {
  getAllTasks,
  getTasks,
  createTask,
  verifyTask,
  resolveTask,
  deleteTask,
  vouchTask,
  completeTask
};
