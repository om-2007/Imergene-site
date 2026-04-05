const axios = require("axios");
const { OpenAI } = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


exports.generateImageUrl = async (prompt) => {
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: `(Square profile picture, high quality, digital art): ${prompt}`,
      n: 1,
      size: "1024x1024",
    });
    return response.data[0].url;
  } catch (error) {
    console.error("❌ DALL-E failed:", error.message);
    return null;
  }
};

async function requestImage(prompt, targetUrl) {
  try {
    // 🟢 Step 1: Sanitize the prompt (ComfyUI hates newlines in JSON)
    const cleanPrompt = prompt.replace(/[\n\r]/g, " ").replace(/"/g, "'");

    const workflow = {
      "3": {
        "inputs": {
          "seed": Math.floor(Math.random() * 1000000),
          "steps": 20, // 🟢 INCREASED: 8 steps is too low for clarity. 20 is the sweet spot.
          "cfg": 8,    // 🟢 SLIGHTLY HIGHER: Better adherence to the "visibility" prompt.
          "sampler_name": "euler_ancestral", // 🟢 BETTER SAMPLER: Usually produces sharper results than basic euler.
          "scheduler": "karras",            // 🟢 SHARPER SCHEDULER: Karras often yields cleaner edges.
          "denoise": 1,
          "model": ["4", 0],
          "positive": ["6", 0],
          "negative": ["7", 0],
          "latent_image": ["5", 0]
        },
        "class_type": "KSampler"
      },
      "4": {
        "inputs": {
          "ckpt_name": "dreamshaper_8.safetensors" 
        },
        "class_type": "CheckpointLoaderSimple"
      },
      "5": {
        "inputs": { "width": 512, "height": 512, "batch_size": 1 },
        "class_type": "EmptyLatentImage"
      },
      "6": {
        "inputs": {
          // 🟢 ADDED CLARITY TAGS: Sharp focus, high contrast, and studio lighting.
          "text": `(extreme high resolution, masterpiece, sharp focus, high contrast, studio lighting, detailed textures, clearly visible subject, 8k), ${cleanPrompt}`,
          "clip": ["4", 1]
        },
        "class_type": "CLIPTextEncode"
      },
      "7": {
        "inputs": {
          // 🟢 EXPANDED NEGATIVE PROMPT: Explicitly forbidding blur and fog.
          "text": "nude, naked, explicit, NSFW, (blurry, out of focus, low resolution, fog, hazy, dark, gloomy, distorted, watermark, text, signature, grainy, noise, low contrast)",
          "clip": ["4", 1]
        },
        "class_type": "CLIPTextEncode"
      },
      "8": {
        "inputs": { "samples": ["3", 0], "vae": ["4", 2] },
        "class_type": "VAEDecode"
      },
      "9": {
        "inputs": { "filename_prefix": "AGENT_POST", "images": ["8", 0] },
        "class_type": "SaveImage"
      }
    };

    // 🟢 Step 2: Send the request
    console.log(`📡 Sending optimized JSON to ${targetUrl}...`);
    const response = await axios.post(`${targetUrl}/prompt`, 
      { prompt: workflow }, 
      { 
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000 
      }
    );

    return response.data.prompt_id;

  } catch (err) {
    // 🔴 Step 3: Log the ACTUAL error from ComfyUI
    if (err.response && err.response.data) {
      console.error("❌ ComfyUI REJECTED DATA:", JSON.stringify(err.response.data.node_errors));
    } else {
      console.error(`❌ Worker [${targetUrl}] Request Failed:`, err.message);
    }
    return null;
  }
}

module.exports = { requestImage, generateImageUrl };