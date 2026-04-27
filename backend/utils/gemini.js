const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Uses Gemini 1.5 Flash to summarize raw OCR text and extract structured task data.
 * @param {string} rawText - The text extracted from OCR.
 * @returns {Promise<Object>} - The structured task data.
 */
async function summarizeTask(rawText) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("⚠️ Gemini API Key missing. Returning raw text only.");
    return {
      summary: rawText.slice(0, 150) + "...",
      urgency: "Medium",
      location: "Unknown",
      category: "Other",
      tags: []
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const prompt = `
      You are an AI assistant for a disaster relief platform called GeoAid Intelligence.
      I will provide you with raw OCR text extracted from a field survey report.
      Your goal is to summarize the report and extract structured information.

      Raw OCR Text:
      "${rawText}"

      Please return ONLY a JSON object (no markdown, no extra text) with the following fields:
      - summary: A concise 1-2 sentence summary of the situation.
      - urgency: One of ["Critical", "High", "Medium", "Low"].
      - location: The specific address, landmark, or area mentioned (if any).
      - category: One of ["Medical", "Food", "Water", "Shelter", "Logistics", "Infrastructure", "Other"].
      - tags: An array of 3-5 keywords extracted from the text.

      If the text is too messy to understand, make your best guess for urgency as "Medium" and category as "Other".
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean potential markdown from response
    const cleanedJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    return JSON.parse(cleanedJson);
  } catch (error) {
    console.error("❌ Gemini Analysis Error:", error.message);
    return {
      summary: rawText.slice(0, 150) + "...",
      urgency: "Medium",
      location: "Unknown",
      category: "Other",
      tags: []
    };
  }
}

module.exports = { summarizeTask };
