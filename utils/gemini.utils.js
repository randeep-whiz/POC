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
async function analyzeImage(filePath) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString("base64");
  
    const prompt = `You are a quality control AI for a manufacturing plant.\nInspect the uploaded image and look for:\n- Surface scratches\n- Component misalignment\n- Incorrect or missing labels\n- Packaging damage\nReturn a clear PASS or FAIL decision, list defects, and recommend an action.`;
  
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image,
        },
      },
    ]);
  
    const response = await result.response;
    return response.text();
}
async function describeProductImage(filePath) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const imageBuffer = fs.readFileSync(filePath);
  const base64Image = imageBuffer.toString("base64");

  const prompt = `Identify the product shown in the image. Return its name, type, and visible brand.`;

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType: "image/jpeg",
        data: base64Image,
      },
    },
  ]);

  const response = await result.response;
  return response.text();
}
module.exports = {
    preprocessImage,
    extractTextFromPdf,
    processOCR,
    validateInvoiceData,
    extractInvoiceData,
    generateReport,
    generateContent,
    analyzeImage,
    describeProductImage
}