const path = require('path');
const fs = require('fs');
const db = require("../models");
const Invoice = db.invoice;
const Fuse = require('fuse.js');
const { processDocument } = require('../utils/gemini.utils.js');

// Load catalog with error handling
let catalog = [];
try {
    const catalogPath = path.join(__dirname, "catalog.json");
    if (fs.existsSync(catalogPath)) {
        const catalogData = fs.readFileSync(catalogPath, "utf-8");
        catalog = JSON.parse(catalogData);
        console.log('Catalog loaded successfully with', catalog.length, 'items');
    } else {
        console.warn('Catalog file not found at:', catalogPath);
        catalog = []; // Use empty catalog as fallback
    }
} catch (error) {
    console.error('Error loading catalog:', error);
    catalog = []; // Use empty catalog as fallback
}

// Initialize Fuse with loaded catalog
const fuse = new Fuse(catalog, {
    keys: ["name", "brand", "category", "tags"],
    threshold: 0.4
});

exports.processDocument = async (req, res) => {
    try {
        console.log('Request body:', req.body);
        console.log('Files:', req.file);

        const customPrompt = req.body.prompt;

        // File validation
        if (!req.file) {
            return res.status(400).json({ 
                message: 'No file uploaded'
            });
        }

        // Validate file size and type
        const maxFileSize = 5 * 1024 * 1024; // 5MB
        const allowedMimeTypes = [
            'image/jpeg', 
            'image/png', 
            'image/jpg',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain'
        ];
        
        if (!allowedMimeTypes.includes(req.file.mimetype)) {
            return res.status(400).json({ 
                message: 'Invalid file type', 
                type: req.file.mimetype,
                allowedTypes: allowedMimeTypes
            });
        }

        if (req.file.size > maxFileSize) {
            return res.status(400).json({ 
                message: 'File too large', 
                size: req.file.size,
                maxSize: maxFileSize
            });
        }

        // Use the utility function instead of direct API call
        const result = await processDocument(req.file, {
            prompt: customPrompt
        });

        if (!result.success) {
            throw new Error(result.error || 'Processing failed');
        }

        // Prepare response
        let response = {
            analysis: result.analysis,
            promptUsed: customPrompt || "Default analysis prompt",
            fileInfo: {
                name: req.file.originalname,
                type: req.file.mimetype,
                size: req.file.size
            }
        };

        // Only add catalog matches if catalog is not empty
        if (catalog.length > 0 && result.analysis) {
            const matches = fuse.search(result.analysis);
            if (matches.length > 0) {
                response.catalogMatches = {
                    bestMatch: matches[0].item,
                    alternatives: matches.slice(1, 3).map(m => m.item)
                };
            }
        }

        // Cleanup files
        if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(200).json(response);
    } catch (error) {
        console.error("Processing Error:", error);
        
        // Cleanup on error
        if (req.file && req.file.path) {
            try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        
        res.status(500).json({
            message: "Error processing document",
            error: error.message,
            fileInfo: req.file ? {
                name: req.file.originalname,
                type: req.file.mimetype,
                size: req.file.size
            } : 'No file'
        });
    }
};