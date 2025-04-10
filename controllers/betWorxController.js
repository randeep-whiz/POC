const { scrapeFantasy, scrapeDraftKings, scrapeFantasyNew} = require('../utils/betworx.utils.js');

// Exporting route handlers
exports.nhl = (req, res) => scrapeFantasy('nhl', req, res);
exports.nba = (req, res) => scrapeFantasy('nba', req, res);
exports.mlb = (req, res) => scrapeFantasy('mlb', req, res);

// API Controller for DraftKings Scraper
exports.draftKings = async (req, res) => {
    try {
        const dkData = await scrapeDraftKings();
        console.log("DraftKings AI Processed Data:", dkData);
        res.status(200).json({ message: "DraftKings AI Processed Data", data: dkData });
    } catch (error) {
        console.error("DraftKings Scraper Error:", error);
        res.status(500).json({ error: "Failed to scrape DraftKings" });
    }
};
// API Controller for FantasyData Scraper
exports.fantasyData = async (req, res) => {
    try {
        const league = "nhl";
        const fantasyData = await scrapeFantasyNew(league);
        console.log(`${league} Fantasy Data:`, fantasyData);
        res.status(200).json({ message: `${league} Fantasy Data Processed`, data: fantasyData });
    } catch (error) {
        console.error("FantasyData Scraper Error:", error);
        res.status(500).json({ error: "Failed to scrape FantasyData" });
    }
};
