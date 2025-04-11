const path = require('path');
const fs = require('fs');
const db = require("../models"); // Adjust path based on your structure
const Invoice = db.invoice;
const axios = require('axios');
const Fuse = require('fuse.js');
const { processDocument, DEFAULT_PROMPTS } = require('../utils/gemini.utils.js');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

console.log(__dirname);
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
        // Add debug logging
        console.log('Request body:', req.body);
        console.log('Files:', req.file);
        
        let operationType = req.body.operationType;
        const customPrompt = req.body.prompt;

        // Add type coercion and trimming
        if (typeof operationType === 'string') {
            operationType = operationType.trim().toLowerCase();
        }

        // More detailed validation
        const validOperationTypes = ['invoice', 'xray', 'goods', 'search'];
        if (!operationType) {
            return res.status(400).json({
                message: "Operation type is required",
                received: operationType,
                validTypes: validOperationTypes
            });
        }

        if (!validOperationTypes.includes(operationType)) {
            return res.status(400).json({
                message: "Invalid operation type",
                received: operationType,
                validTypes: validOperationTypes
            });
        }

        // File validation for all types
        if (!req.file) {
            return res.status(400).json({ 
                message: 'No file uploaded',
                operationType: operationType
            });
        }

        // Validate file size and type
        const maxFileSize = 5 * 1024 * 1024; // 5MB
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
        
        // Add PDF to allowed types for invoice
        if (operationType === 'invoice') {
            allowedMimeTypes.push('application/pdf');
        }
        
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

        console.log('Processing with file:', req.file?.originalname);
        console.log('Operation type:', operationType);

        let response;
        // For search operations, handle the description differently
        if (operationType === 'search') {
            const description = await processDocument(req.file, operationType, {
                filePath: req.file.path,
                prompt: customPrompt
            });

            // Perform the search with the description
            const searchResponse = {
                type: 'search',
                description: description.analysis,
                matches: fuse.search(description.analysis)
            };

            response = {
                query: description.analysis,
                match: searchResponse.matches[0]?.item || null,
                alternatives: searchResponse.matches.slice(1, 3).map(m => m.item),
                promptUsed: customPrompt || DEFAULT_PROMPTS[operationType]
            };
        } else {
            // Handle other operation types
            const result = await processDocument(req.file, operationType, {
                filePath: req.file.path,
                prompt: customPrompt
            });

            switch (operationType) {
                case 'invoice':
                    response = await handleInvoiceResult(result);
                    break;
                default:
                    response = result;
            }
            response.promptUsed = customPrompt || DEFAULT_PROMPTS[operationType];
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
            requestBody: req.body,
            fileInfo: req.file ? {
                name: req.file.originalname,
                type: req.file.mimetype,
                size: req.file.size
            } : 'No file'
        });
    }
};

async function handleInvoiceResult(result) {
    try {
        if (!result.validation.vendorValid || !result.validation.amountValid || !result.data.invoiceNumber) {
            return {
                message: "Validation Error",
                validation: result.validation
            };
        }

        // Add error handling for database operations
        try {
            const existingInvoice = await Invoice.findOne({ 
                where: { 
                    invoice_number: result.data.invoiceNumber 
                } 
            });

            if (existingInvoice) {
                return {
                    message: "Duplicate invoice detected!",
                    data: { existingInvoice }
                };
            }

            const newInvoice = await Invoice.create({
                invoice_number: result.data.invoiceNumber,
                amount: result.data.amount,
                vendor: result.data.vendor
            });

            return {
                message: "Document processed successfully!",
                data: newInvoice,
                validation: result.validation
            };
        } catch (dbError) {
            console.error("Database Error:", dbError);
            throw new Error(`Database operation failed: ${dbError.message}`);
        }
    } catch (error) {
        console.error("Invoice Processing Error:", error);
        throw error;
    }
}

function handleSearchResult(result) {
    try {
        if (!result || !result.analysis) {
            throw new Error('No analysis available for search');
        }

        // Ensure catalog is loaded
        if (!catalog || !Array.isArray(catalog)) {
            throw new Error('Product catalog is not properly loaded');
        }

        // Perform fuzzy search using the analysis text
        const matches = fuse.search(result.analysis);
        
        return {
            type: 'search',
            query: result.analysis,
            match: matches[0]?.item || null,
            alternatives: matches.slice(1, 3).map(m => m.item)
        };
    } catch (error) {
        console.error("Search Processing Error:", error);
        throw error;
    }
}