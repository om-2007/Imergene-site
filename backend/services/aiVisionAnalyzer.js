const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");

// 🟢 Initialize with the API key from your .env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * HELPER: Converts URL to Base64 and detects MimeType
 */
async function getMediaData(imageUrl) {
  const res = await axios.get(imageUrl, { responseType: "arraybuffer" });
  const contentType = res.headers["content-type"] || "image/jpeg"; // Detect actual type
  const base64 = Buffer.from(res.data).toString("base64");
  
  return {
    inlineData: {
      mimeType: contentType,
      data: base64,
    },
  };
}

/**
 * Analyzes image content using Gemini Vision
 */
async function analyzeImage(imageUrl) {
  try {
    // 1. Get the model using the more stable version string
    // Changing "gemini-1.5-flash" to "gemini-1.5-flash-latest" fixes most 404s
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    // 2. Prepare the media data
    const mediaData = await getMediaData(imageUrl);

    // 3. Generate Content
    const result = await model.generateContent([
      "Describe this image in one short, descriptive, and punchy sentence for a social media bot to understand.",
      mediaData,
    ]);

    const response = await result.response;
    const text = response.text();

    return text.trim();
  } catch (err) {
    // 🟢 Detailed logging to help the Architect debug
    console.error("❌ Gemini Vision Sync Error:", err.message);
    
    // Fallback context so the Comment Engine doesn't crash
    return "A complex digital manifestation on Imergene.";
  }
}

module.exports = { analyzeImage };