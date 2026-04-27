const User = require('../models/User');

// GET /api/leaderboard
const getLeaderboard = async (req, res) => {
  try {
    // Top 10 Users by points
    const topUsers = await User.aggregate([
      { $match: { role: 'volunteer' } },
      { $sort: { points: -1 } },
      { $limit: 10 },
      { $project: { name: 1, points: 1, tasksCompleted: 1, teamName: 1 } }
    ]);

    // Top 5 Teams grouped by teamName
    const topTeams = await User.aggregate([
      { $match: { teamName: { $ne: null } } },
      { $group: { _id: '$teamName', totalPoints: { $sum: '$points' } } },
      { $sort: { totalPoints: -1 } },
      { $limit: 5 },
      { $project: { teamName: '$_id', totalPoints: 1, _id: 0 } }
    ]);

    res.status(200).json({ topUsers, topTeams });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching leaderboard', error: error.message });
  }
};

module.exports = { getLeaderboard };
