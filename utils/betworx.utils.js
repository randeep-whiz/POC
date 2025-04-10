const axios = require('axios');
const cheerio = require('cheerio');
const { chromium } = require('playwright');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent";

async function scrapeFantasy(league, req, res) {
    const url = `https://fantasydata.com/${league}/odds`;

    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        // Extract the main title and table
        const title = $('h1').text();
        const table = $('.table-wrapper table.stats.csv.xls').html() || "No table found";

        res.status(200).json({ 
            message: "Data fetched successfully", 
            title, 
            table: `<table>${table}</table>` 
        });
    } catch (error) {
        console.error(`Error fetching ${league} data:`, error.message);
        res.status(500).json({ error: `Failed to fetch ${league} data` });
    }
}
// Function to process data using Google Gemini AI
async function processWithAI(data) {
    try {
        const prompt = `Extract structured betting odds from the following raw text:\n\n${JSON.stringify(data)}`;
        console.log("Sending Prompt to AI:", prompt);

        const requestBody = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 1,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 8192
            }
        };

        const response = await axios.post(`${API_URL}?key=${GEMINI_API_KEY}`, requestBody, {
            headers: { "Content-Type": "application/json" }
        });

        // Extract AI-generated response safely
        const aiResponse = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from AI";
        return aiResponse;

    } catch (error) {
        console.error("AI Processing Error:", error);
        return data; // Return original data if AI fails
    }
}

// Scraper for DraftKings
async function scrapeDraftKings() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto("https://sportsbook.draftkings.com/", { waitUntil: "domcontentloaded" });

    const odds = await page.evaluate(() => {
        return Array.from(document.querySelectorAll(".sportsbook-odds")).map(el => el.innerText);
    });

    await browser.close();
    return await processWithAI(odds);
}
// Scraper for FantasyData (Alternative Source)
async function scrapeFantasyNew(league) {
    const url = `https://fantasydata.com/${league}/odds`;

    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        // Extract main content
        const table = $(".table-wrapper").html() || "No table found";
        console.log("Extracted FantasyData Table:", table);

        return await processWithAI(table);
    } catch (error) {
        console.error(`Error fetching ${league} data:`, error.message);
        return `Failed to fetch ${league} data`;
    }
}

module.exports = {
    scrapeFantasy,
    scrapeDraftKings,
    scrapeFantasyNew
}