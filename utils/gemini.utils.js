

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const db = require("../models");
const pdfParse = require('pdf-parse');
const Jimp = require("jimp");
const Tesseract = require('tesseract.js');

// Add API key validation
if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY environment variable is not set!');
    process.exit(1); // Exit if API key is not configured
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Main document processing function
async function processDocument(file, options = {}) {
    try {
        // Input validation
        if (!file || !file.path) {
            throw new Error('Invalid file input: File or file path is missing');
        }

        if (!file.mimetype) {
            throw new Error('Invalid file input: Missing mimetype');
        }

        // Check if file exists
        if (!fs.existsSync(file.path)) {
            throw new Error(`File not found at path: ${file.path}`);
        }

        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            generationConfig: {
                temperature: 0.4,
                topK: 32,
                topP: 1,
                maxOutputTokens: 2048,
            }
        });

        console.log(`Processing file: ${file.originalname} (${file.mimetype})`);

        // Read and encode file
        const imageBuffer = fs.readFileSync(file.path);
        const base64Content = imageBuffer.toString('base64');

        // Prepare content parts
        const parts = [
            { 
                text: options.prompt || "Please analyze this document and provide detailed information about its contents."
            },
            {
                inlineData: {
                    mimeType: file.mimetype,
                    data: base64Content
                }
            }
        ];

        try {
            // Generate content
            const result = await model.generateContent(parts);
            if (!result || !result.response) {
                throw new Error('No response from Gemini API');
            }

            const response = await result.response;
            return {
                success: true,
                analysis: response.text(),
                fileType: file.mimetype.startsWith('image/') ? 'image' : 'document',
                mimeType: file.mimetype
            };

        } catch (apiError) {
            // Handle API-specific errors
            console.error('Gemini API Error:', apiError);
            throw new Error(`Gemini API Error: ${apiError.message}`);
        }

    } catch (error) {
        console.error('Document processing error:', {
            message: error.message,
            file: file ? {
                name: file.originalname,
                type: file.mimetype,
                size: file.size
            } : 'No file info',
            stack: error.stack
        });

        return {
            success: false,
            error: error.message,
            details: {
                fileName: file?.originalname,
                fileType: file?.mimetype,
                fileSize: file?.size
            }
        };
    }
}

module.exports = {
    processDocument
};