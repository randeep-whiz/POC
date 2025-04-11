const express = require('express');
const multer = require('multer');
const geminiController = require('../controllers/geminiController');

const router = express.Router();

// Set up multer for file upload (stores files in 'uploads/' folder)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

// Set up Multer for file uploads
const upload = multer({ storage });

// Define the route
router.post('/process-document', upload.single('file'), geminiController.processDocument);

module.exports = router;
