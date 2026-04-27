const { DocumentAnalysisClient, AzureKeyCredential } = require("@azure/ai-form-recognizer");
const fs = require('fs');
require('dotenv').config();

let client;
try {
  if (process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT && process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY) {
    client = new DocumentAnalysisClient(
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
      new AzureKeyCredential(process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY)
    );
  } else {
    console.warn("⚠️ OCR Client skipped: Missing Azure environment variables.");
  }
} catch (e) {
  console.error("❌ Failed to initialize OCR Client:", e.message);
}

exports.processScan = async (req, res) => {
  console.log("--- 🚀 OCR Request Started ---");

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No image uploaded." });
    }

    const filePath = req.file.path;
    const fileBuffer = fs.readFileSync(filePath);

    console.log("--- 🧠 Azure Analysis in progress...");
    if (!client) {
      return res.status(503).json({ success: false, error: "OCR Service is currently unavailable (Configuration missing)." });
    }
    const poller = await client.beginAnalyzeDocument("prebuilt-layout", fileBuffer);
    const { content } = await poller.pollUntilDone();

    console.log("--- ✨ Extraction Successful! ---");

    // SAFE CLEANUP: If this fails, we don't want to crash the whole request
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log("--- 🗑️ Temp file removed.");
      }
    } catch (cleanupError) {
      console.error("⚠️ Cleanup Warning (Non-critical):", cleanupError.message);
    }

    // THE FIX: Use 'extractedText' to match your React 'data.extractedText' call
    return res.status(200).json({
      success: true,
      message: "Data synced successfully",
      extractedText: content, // Changed from rawText to extractedText
      requiresManualReview: true
    });

  } catch (error) {
    console.error("--- 💥 Azure OCR Error:", error.message);

    // Ensure file is deleted if Azure fails
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) { }
    }

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: "Processing failed",
        details: error.message
      });
    }
  }
};