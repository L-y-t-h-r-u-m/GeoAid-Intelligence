const express = require('express');
const router = express.Router();
const multer = require('multer');
const ocrController = require('../controllers/ocrController');

// Configure multer to save files temporarily in the uploads/ directory
const upload = multer({ dest: 'uploads/' });

// POST route for the Scan & Sync feature
router.post('/scan-sync', upload.single('image'), ocrController.processScan);

module.exports = router;
