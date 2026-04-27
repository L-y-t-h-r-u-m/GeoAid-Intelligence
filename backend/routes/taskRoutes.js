const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { protect } = require('../middleware/authMiddleware');
const verifyNgoRole = require('../middleware/ngoMiddleware');

// Public/Basic Filtered Routes
router.get('/', taskController.getTasks);

// Single Source of Truth Global Fetch
router.get('/all', taskController.getAllTasks);

// Protected Actions
router.post('/', protect, taskController.createTask);
router.post('/:id/vouch', protect, taskController.vouchTask);
router.post('/:id/complete', protect, taskController.completeTask);

// NGO Admin Only Mutations
router.put('/:id/verify', protect, verifyNgoRole, taskController.verifyTask);
router.put('/:id/resolve', protect, verifyNgoRole, taskController.resolveTask);
router.delete('/:id', protect, verifyNgoRole, taskController.deleteTask); // DELETE with password in body

module.exports = router;
