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
        const operationType = req.body.operationType;
        const customPrompt = req.body.prompt;

        if (!['invoice', 'xray', 'goods', 'search'].includes(operationType)) {
            return res.status(400).json({
                message: "Invalid operation type"
            });
        }

        // File validation for all types
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
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
                type: req.file.mimetype 
            });
        }

        if (req.file.size > maxFileSize) {
            return res.status(400).json({ 
                message: 'File too large', 
                size: req.file.size 
            });
        }

        console.log('Processing search with file:', req.file?.originalname);
        console.log('Catalog size:', catalog.length);
        console.log('Operation type:', operationType);

        // For search operations, handle the description differently
        if (operationType === 'search') {
            const description = await processDocument(req.file, operationType, {
                filePath: req.file.path,
                prompt: customPrompt
            });

            // Perform the search with the description
            const searchResponse = {
                type: 'search',
                description: description.analysis, // Use the analysis as description
                matches: fuse.search(description.analysis)
            };

            response = {
                query: description.analysis,
                match: searchResponse.matches[0]?.item || null,
                alternatives: searchResponse.matches.slice(1, 3).map(m => m.item),
                promptUsed: customPrompt || DEFAULT_PROMPTS[operationType]
            };
        } else {
            // Handle other operation types as before
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
            catalogSize: catalog.length,
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

exports.Xray = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ message: 'Invalid file type', type: req.file.mimetype });
    }

    const maxFileSize = 5 * 1024 * 1024; // 5MB
    if (req.file.size > maxFileSize) {
      return res.status(400).json({ message: 'File too large', size: req.file.size });
    }

    const imagePath = path.join(__dirname, '../', req.file.path);
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: "You are a medical imaging specialist. Analyze this X-ray image and provide a detailed medical report. Include: 1. Findings 2. Impression 3. Recommendations."
            },
            {
              inlineData: {
                mimeType: req.file.mimetype,
                data: base64Image
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        topK: 32,
        topP: 1,
        maxOutputTokens: 2048
      }
    };

    const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, requestBody, {
      headers: { 'Content-Type': 'application/json' }
    });

    const aiText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    fs.unlinkSync(imagePath); // cleanup uploaded image

    if (!aiText) {
      return res.status(500).json({ message: 'No response from AI' });
    }

    res.status(200).json({
      message: 'X-ray analysis complete',
      report: generateReport(aiText),
      analysis: aiText,
      meta: {
        name: req.file.originalname,
        mime: req.file.mimetype,
        size: req.file.size,
        processedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Error:', err);
    if (req.file && req.file.path) {
      try { fs.unlinkSync(path.join(__dirname, "../", req.file.path)); } catch (e) {}
    }

    res.status(500).json({
      message: 'Failed to analyze image',
      error: err.message,
      details: err.response?.data || {}
    });
  }
};

exports.Goods = async (req, res) => {
    try {
        // Use the unified processDocument function instead
        const result = await processDocument(req.file, 'goods', {
            prompt: req.body.prompt // optional custom prompt
        });
        
        fs.unlinkSync(req.file.path); // Clean up
        res.json({ result: result.analysis });
    } catch (error) {
        console.error("Inspection error:", error);
        if (req.file && req.file.path) {
            try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        res.status(500).json({ error: "Image inspection failed" });
    }
};

exports.Search = async (req, res) => {
    try {
        const imagePath = req.file.path;
        const description = await describeProductImage(imagePath);
        fs.unlinkSync(imagePath);

        const matches = fuse.search(description);
        const topMatch = matches[0]?.item || null;

        res.json({
            query: description,
            match: topMatch,
            alternatives: matches.slice(1, 3).map(m => m.item)
        });
    } catch (error) {
        console.error("Error in search:", error);
        res.status(500).json({ error: "Failed to process image" });
    }
};