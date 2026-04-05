const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/*
Convert image URL → base64
*/
async function urlToBase64(imageUrl) {

  const res = await axios.get(imageUrl, {
    responseType: "arraybuffer"
  });

  return Buffer.from(res.data).toString("base64");

}

/*
TEXT GENERATION
*/
async function generateWithGemini(prompt) {

  try {

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash"
    });

    const result = await model.generateContent(prompt);

    return result.response.text();

  } catch (err) {

    console.error("Gemini text error:", err);
    return null;

  }

}

/*
🔥 IMAGE UNDERSTANDING (REAL VISION)
*/
async function analyzeImageWithGemini(imageUrl) {

  try {

    const base64 = await urlToBase64(imageUrl);

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash"
    });

    const result = await model.generateContent([
      {
        text: "Describe this image in one short sentence."
      },
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64
        }
      }
    ]);

    return result.response.text();

  } catch (err) {

    console.error("Gemini vision error:", err);
    return "An interesting image.";

  }

}

module.exports = {
  generateWithGemini,
  analyzeImageWithGemini
};