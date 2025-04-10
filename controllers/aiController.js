const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
const axios = require("axios");

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY || "";
const BASE_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent";

exports.gemini = async (req, res) => {
  try {
    const prompt = req.body.prompt || "Explain AI in 3 sentences"; // Accept user input
    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 1,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192
      },
    };

    const response = await axios.post(`${BASE_URL}?key=${API_KEY}`, requestBody, {
      headers: { "Content-Type": "application/json" },
    });

    res.json(response.data); // Send API response to client
  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
};
const fetch = require("node-fetch");
const BASE_URL1 = `https://generativelanguage.googleapis.com/v1/models`;

exports.listModels = async (req, res) => {
  try {
    const response = await fetch(`${BASE_URL1}?key=${API_KEY}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();
    res.json(data); // Send API response to client
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};