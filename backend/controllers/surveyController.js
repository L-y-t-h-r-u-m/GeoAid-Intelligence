const Survey = require('../models/Survey');
const User   = require('../models/User');
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

// GET /api/surveys?lat=&lon=&radius=200&priority=All
const getSurveys = async (req, res) => {
  try {
    const surveys = await Survey.find().populate('assignedVolunteerId', 'name email');
    const { lat, lon, radius = 200, priority } = req.query;

    let result = surveys;

    // Geofence filter — only applies if viewer supplies their coords
    if (lat && lon) {
      const vLat = parseFloat(lat);
      const vLon = parseFloat(lon);
      const km   = parseFloat(radius);
      result = result.filter(s => {
        if (s.lat == null || s.lon == null) return true; // tasks without coords always show
        return haversineKm(vLat, vLon, s.lat, s.lon) <= km;
      });
    }

    // Priority filter
    if (priority && priority !== 'All') {
      result = result.filter(s => s.urgency === priority);
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching surveys', error: error.message });
  }
};

// POST /api/surveys  — create a new survey/task
const createSurvey = async (req, res) => {
  try {
    let {
      title, location, lat, lon, urgency, aiSummary, rawOcr,
      // Intelligence Slate fields
      category, quantity, unit, urgencyScore, locationHint,
    } = req.body;

    if (!location) {
      return res.status(400).json({ message: 'location is required' });
    }

    // Heuristic Triage Engine — only fires when urgency was NOT explicitly set by the user
    const textToAnalyze = `${title || ''} ${aiSummary || ''} ${rawOcr || ''} ${category || ''}`.toLowerCase();
    const userPickedUrgency = Boolean(req.body.urgency);
    let radiusLimit = 200;

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
      urgency = urgency || 'Low';
      urgencyScore = urgencyScore || 2;
      radiusLimit = 200;
    }

    const isNgo = req.user?.role === 'ngo_admin';
    const creatorRole = isNgo ? 'NGO' : 'Volunteer';
    
    let status = 'pending';
    let verifiedBy = null;
    
    if (isNgo) {
      status = 'verified';
      verifiedBy = 'NGO Admin';
    } else if (urgency === 'Critical' || urgency === 'High') {
      status = 'verified';
      verifiedBy = 'Community';
    }

    const survey = await Survey.create({
      title, location, lat, lon, urgency, aiSummary, rawOcr,
      category, quantity, unit, urgencyScore, locationHint, radiusLimit,
      creatorRole, status, verifiedBy
    });
    res.status(201).json(survey);
  } catch (error) {
    res.status(500).json({ message: 'Error creating survey', error: error.message });
  }
};

// PUT /api/surveys/:id/verify
const verifySurvey = async (req, res) => {
  try {
    if (req.user.role !== 'ngo_admin') {
      return res.status(403).json({ message: 'Forbidden: Only NGO admins can verify surveys' });
    }
    const survey = await Survey.findById(req.params.id);
    if (!survey) return res.status(404).json({ message: 'Survey not found' });
    if (survey.status === 'verified') return res.status(400).json({ message: 'Already verified' });

    // Apply Intelligence Slate corrections from the verification modal
    const { category, quantity, unit, urgencyScore, locationHint, aiSummary } = req.body || {};
    if (category)     survey.category     = category;
    if (quantity     != null) survey.quantity = Number(quantity);
    if (unit)         survey.unit         = unit;
    if (urgencyScore != null) survey.urgencyScore = Number(urgencyScore);
    if (locationHint) survey.locationHint = locationHint;
    if (aiSummary)    survey.aiSummary    = aiSummary;

    survey.status = 'verified';
    await survey.save();

    if (survey.assignedVolunteerId) {
      const volunteer = await User.findById(survey.assignedVolunteerId);
      if (volunteer) {
        volunteer.points         += calculateImpactPoints(survey.urgency);
        volunteer.tasksCompleted += 1;
        await volunteer.save();
      }
    }
    res.status(200).json({ message: 'Survey verified', survey });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying survey', error: error.message });
  }
};

// PUT /api/surveys/:id/resolve  — mark as resolved (admin only)
const resolveSurvey = async (req, res) => {
  try {
    if (req.user.role !== 'ngo_admin') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    const survey = await Survey.findById(req.params.id);
    if (!survey) return res.status(404).json({ message: 'Survey not found' });
    
    const { userLat, userLng } = req.body;
    let isGpsVerified = false;
    
    // Check GPS verification if user provided coords and task has coords
    if (userLat != null && userLng != null && survey.lat != null && survey.lon != null) {
      const dist = haversineKm(parseFloat(userLat), parseFloat(userLng), survey.lat, survey.lon);
      if (dist <= (survey.radiusLimit || 200)) {
        isGpsVerified = true;
      }
    }
    
    survey.status = 'resolved';
    survey.isVisibleToAll = false;
    survey.isGpsVerified = isGpsVerified;
    await survey.save();
    
    res.status(200).json({ message: 'Survey resolved', survey });
  } catch (error) {
    res.status(500).json({ message: 'Error resolving survey', error: error.message });
  }
};

module.exports = { getSurveys, createSurvey, verifySurvey, resolveSurvey };
