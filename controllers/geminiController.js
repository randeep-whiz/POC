const path = require('path');
const fs = require('fs');
const db = require("../models"); // Adjust path based on your structure
const Invoice = db.invoice;
const axios = require('axios');
const Fuse = require('fuse.js');
const {preprocessImage, extractTextFromPdf, processOCR, validateInvoiceData, extractInvoiceData, generateReport, analyzeImage,describeProductImage } = require('../utils/gemini.utils.js');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

console.log(__dirname);
// Load catalog
const catalogPath = path.join(__dirname, "catalog.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));

const fuse = new Fuse(catalog, {
  keys: ["name", "brand", "category", "tags"],
  threshold: 0.4
});

exports.invoiceDoc = async (req, res) => {
    try {
        const { path: filename } = req.body;

        if (!filename) {
            return res.status(400).json({ message: "No file path provided" });
        }

        const uploadDir = path.join(__dirname, "../uploads");
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filePath = path.join(uploadDir, filename);
        if (!fs.existsSync(filePath)) {
            return res.status(400).json({ message: "File not found" });
        }

        console.log("Processing File:", filePath);

        let extractedText = null;

        //Check filetype to determine how to extract the text
        if (filename.toLowerCase().endsWith('.pdf')) {
            extractedText = await extractTextFromPdf(filePath);
            console.log("Extracted OCR Text PDF:\n", extractedText); 
        } else {
            // Assume it's an image and perform OCR
            const processedFilePath = await preprocessImage(filePath);
            console.log("Processed file path:", processedFilePath);
            
            const extractedText = await processOCR(processedFilePath);
            console.log("Extracted OCR Text:\n", extractedText);       
        }

        if (!extractedText) {
            return res.status(500).json({ message: "OCR processing failed." });
        }

        // Extract invoice data
        const invoiceData = extractInvoiceData(extractedText);
        console.log('Extracted Data:', invoiceData);

        // Validate extracted invoice data
        const validationResults = validateInvoiceData(invoiceData);
        console.log('Validation Results:', validationResults);
        if(validationResults.vendorValid === true && validationResults.amountValid === true && invoiceData.invoiceNumber > 0){
            // Check if invoice already exists
            const existingInvoice = await Invoice.findOne({ where: { invoice_number: invoiceData.invoiceNumber } });

            if (existingInvoice) {
                return res.status(400).json({
                    message: "Duplicate invoice detected!",
                    data: { existingInvoice },
                });
            }

            // Save to database
            const newInvoice = await Invoice.create({
                invoice_number: invoiceData.invoiceNumber,
                amount: invoiceData.amount,
                vendor: invoiceData.vendor
            });

            res.status(200).json({
                message: "Document processed successfully!",
                data: newInvoice,
                validation: validationResults
            });
        } else {
            res.status(201).json({
                message: "Validation Error",               
                validation: validationResults
            });
        }
    } catch (error) {
        console.error("OCR Processing Error:", error);
        res.status(500).json({ message: "Error processing the document", error: error.message });
    }
};
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
        const imagePath = req.file.path;
        const analysis = await analyzeImage(imagePath);
        fs.unlinkSync(imagePath); // Clean up
        res.json({ result: analysis });
    } catch (error) {
        console.error("Inspection error:", error);
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