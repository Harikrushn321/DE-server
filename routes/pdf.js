const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const pdfController = require('../controller/pdfController');
const authMiddleware = require('../middlewares/authMiddleware');


// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (file.mimetype !== 'application/pdf') {
            return cb(new Error('Only PDF files are allowed!'), false);
        }
        cb(null, true);
    }
});

// All routes are protected and require authentication
router.use(authMiddleware);

// Upload PDF route (with multer middleware)
router.post('/upload', upload.single('file'), pdfController.uploadPDF);

// Query PDF route
router.post('/query', pdfController.queryPDF);

// Clear vector data route
router.post('/clear-vector-data', pdfController.clearVectorData);

// Get all PDFs for the logged-in user
router.get('/pdfs', pdfController.getAllPDFs);

// Get a single PDF by ID
router.get('/pdfs/:id', pdfController.getPDFById);

router.delete('/pdfs/:id', pdfController.deletePDF);

// Get query history for the logged-in user
router.get('/history', pdfController.getQueryHistory);

module.exports = router; 