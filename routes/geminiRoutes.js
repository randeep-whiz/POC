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
router.post('/invoice-doc', upload.single('document'), geminiController.invoiceDoc);
router.post('/xray', upload.single('xray-image'), geminiController.Xray);
router.post('/goods', upload.single('goods-image'), geminiController.Goods);
router.post('/search', upload.single('image'), geminiController.Search);

module.exports = router;
