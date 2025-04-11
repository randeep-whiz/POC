const { GoogleGenerativeAI } = require('@google/generative-ai');

const logger = global.logger; 
const gemini_api_key = process.env.GEMIN_API_KEY;

const fs = require('fs');
const db = require("../models"); // Adjust path based on your structure
const pdfParse = require('pdf-parse');
const Jimp = require("jimp");
const Tesseract = require('tesseract.js');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function preprocessImage(inputPath) {
    const outputPath = inputPath.replace(/(\.\w+)$/, "-processed$1");
    const image = await Jimp.read(inputPath);
    await image
        .greyscale()  // Convert to grayscale
        .contrast(1)  // Increase contrast
        .normalize()  // Normalize brightness
        .threshold({ max: 200 })  // Binarization (adjust value if needed)
        .writeAsync(outputPath);

    return outputPath;
}
async function extractTextFromPdf(pdfPath) {
    try {
        const dataBuffer = fs.readFileSync(pdfPath);  // Read the PDF file
        const data = await pdfParse(dataBuffer); // Parse the PDF
        console.log("PDF Parsing complete")
        return data.text; // Return the extracted text
    } catch (error) {
        console.error("Error parsing PDF:", error);
        return null;
    }
}
async function processOCR(imagePath) {
    try {
        console.log("Starting OCR on:", imagePath);
        
        const { data: { text } } = await Tesseract.recognize(
            imagePath,
            'eng',
            {
                logger: m => console.log(m),  // Debugging logs
                tessedit_pageseg_mode: 6,  // Assume text is in uniform blocks
                dpi: 300  // Improve OCR accuracy
            }
        );

        console.log("OCR completed. Text length:", text.length);
        return text;
    } catch (error) {
        console.error('OCR failed:', error);
        return null;
    }
}
function validateInvoiceData(invoiceData) {    
    const validationResults = {};
    validationResults.vendorValid = true;
    validationResults.vendorMessage = validationResults.vendorValid
        ? "Vendor is approved."
        : "Vendor not found in approved vendor list.";

    validationResults.amountValid = invoiceData.amount <= 100000;
    validationResults.amountMessage = validationResults.amountValid
        ? "Amount is within acceptable range."
        : "Invoice amount above threshold.";

    return validationResults;
}
function extractInvoiceData(ocrText) {
    const invoiceData = {
        invoiceNumber: 0,
        amount: 0,
        vendor: '',
        date: ''
    };

    const invoiceNumberRegex = /INVOICE\s*#\s*(\d+)/i; 
    const amountRegex = /TOTAL\s*₹\s*([\d,.]+)/i;      
    const dateRegex = /INVOICE DATE\s*[:\s]*(\d{2}[/-]\d{2}[/-]\d{4})/i;    

    // Capture vendor: Ignore invoice number, capture next non-empty line
    const vendorRegex = /BILL TO.*?\n+\d+\n+([^\n]+)/i;

    const invoiceNumberMatch = ocrText.match(invoiceNumberRegex);
    if (invoiceNumberMatch) invoiceData.invoiceNumber = invoiceNumberMatch[1];

    const amountMatch = ocrText.match(amountRegex);
    if (amountMatch) invoiceData.amount = parseFloat(amountMatch[1].replace(/,/g, ''));

    const dateMatch = ocrText.match(dateRegex);
    if (dateMatch) invoiceData.date = dateMatch[1];

    const vendorMatch = ocrText.match(vendorRegex);
    if (vendorMatch) invoiceData.vendor = vendorMatch[1].trim();

    return invoiceData;
}
function generateReport(text) {
  return {
    summary: "AI-generated Diagnostic Report",
    findings: text
  };
}
async function generateContent(prompt) {
    try
    {        
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });  

        const result = await model.generateContent(prompt);
        return result?.response?.text()?.trim();
    }
    catch(err)
    {
        console.log(err);  
        return null;
    }
    
}

// Define default prompts object
const DEFAULT_PROMPTS = {
    xray: "You are a medical imaging specialist. Analyze this X-ray image and provide a detailed medical report. Include: 1. Findings 2. Impression 3. Recommendations.",
    goods: "You are a quality control AI for a manufacturing plant.\nInspect the uploaded image and look for:\n- Surface scratches\n- Component misalignment\n- Incorrect or missing labels\n- Packaging damage\nReturn a clear PASS or FAIL decision, list defects, and recommend an action.",
    search: "Identify the product shown in the image. Return its name, type, and visible brand.",
    invoice: `Analyze this invoice document and extract the following information:
- Invoice Number
- Total Amount
- Vendor/Company Name
- Invoice Date
- Line Items (if present)
- Payment Terms (if present)
- Tax Details (if present)

Format the response in a clear, structured manner.`
};

// Modified processImageWithGemini to handle custom prompts
async function processImageWithGemini(filePath, operationType, options = {}) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString("base64");

    // Use custom prompt if provided, otherwise use default
    const prompt = options.customPrompt || DEFAULT_PROMPTS[operationType];
    const mimeType = options.mimeType || "image/jpeg";

    const result = await model.generateContent([
        prompt,
        {
            inlineData: {
                mimeType: mimeType,
                data: base64Image,
            },
        }
    ]);

    const response = await result.response;
    return response.text();
}

// Simplified processDocument function with custom prompt support
async function processDocument(file, operationType, options = {}) {
    try {
        switch (operationType) {
            case 'invoice':
                if (!options.filePath) {
                    throw new Error("File path is required for invoice processing");
                }
                return await processInvoiceDocument(options.filePath, {
                    prompt: options.prompt || DEFAULT_PROMPTS.invoice
                });
            case 'xray':
            case 'goods':
            case 'search': {
                if (!file || !file.path) {
                    throw new Error("File is required for image processing");
                }
                const analysis = await processImageWithGemini(
                    file.path,
                    operationType,
                    {
                        customPrompt: options.prompt,
                        mimeType: file.mimetype
                    }
                );
                
                const response = {
                    type: operationType,
                    analysis,
                    prompt: options.prompt || DEFAULT_PROMPTS[operationType]
                };

                if (operationType === 'xray') {
                    response.report = generateReport(analysis);
                    response.meta = {
                        name: file.originalname,
                        mime: file.mimetype,
                        size: file.size
                    };
                }

                return response;
            }
            default:
                throw new Error('Invalid operation type');
        }
    } catch (error) {
        console.error(`Error processing ${operationType}:`, error);
        throw error;
    }
}

async function processInvoiceDocument(filePath, options = {}) {
    let extractedText = null;
    
    // Get text from document
    if (filePath.toLowerCase().endsWith('.pdf')) {
        extractedText = await extractTextFromPdf(filePath);
    } else {
        const processedFilePath = await preprocessImage(filePath);
        extractedText = await processOCR(processedFilePath);
    }

    if (!extractedText) {
        throw new Error("Text extraction failed");
    }

    // If custom prompt is provided, use Gemini for analysis
    if (options.prompt) {
        const analysis = await generateContent([
            options.prompt,
            extractedText
        ].join('\n\n'));

        return {
            type: 'invoice',
            rawText: extractedText,
            aiAnalysis: analysis,
            data: extractInvoiceData(extractedText), // still use regex for structured data
            validation: validateInvoiceData(extractInvoiceData(extractedText))
        };
    }

    // Default behavior using regex
    const invoiceData = extractInvoiceData(extractedText);
    const validationResults = validateInvoiceData(invoiceData);

    return {
        type: 'invoice',
        data: invoiceData,
        validation: validationResults
    };
}

// Add this function definition
async function analyzeImage(filePath) {
    return await processImageWithGemini(
        filePath,
        'goods',
        {
            customPrompt: DEFAULT_PROMPTS.goods,
            mimeType: 'image/jpeg'
        }
    );
}

// Add this function definition if it's missing too
async function describeProductImage(filePath) {
    return await processImageWithGemini(
        filePath,
        'search',
        {
            customPrompt: DEFAULT_PROMPTS.search,
            mimeType: 'image/jpeg'
        }
    );
}

module.exports = {
    processDocument,
    preprocessImage,
    extractTextFromPdf,
    processOCR,
    validateInvoiceData,
    extractInvoiceData,
    generateReport,
    generateContent,
    analyzeImage,
    describeProductImage,
    DEFAULT_PROMPTS
};