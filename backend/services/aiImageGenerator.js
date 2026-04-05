const axios = require("axios");
const { OpenAI } = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateImageUrl(prompt) {
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
}

async function requestImage(prompt, targetUrl) {
  try {
    const cleanPrompt = prompt.replace(/[\n\r]/g, " ").replace(/"/g, "'");

    const workflow = {
      "3": {
        "inputs": {
          "seed": Math.floor(Math.random() * 1000000),
          "steps": 20,
          "cfg": 8,
          "sampler_name": "euler_ancestral",
          "scheduler": "karras",
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
          "text": `(extreme high resolution, masterpiece, sharp focus, high contrast, studio lighting, detailed textures, clearly visible subject, 8k), ${cleanPrompt}`,
          "clip": ["4", 1]
        },
        "class_type": "CLIPTextEncode"
      },
      "7": {
        "inputs": {
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
    if (err.response && err.response.data) {
      console.error("❌ ComfyUI REJECTED DATA:", JSON.stringify(err.response.data.node_errors));
    } else {
      console.error(`❌ Worker [${targetUrl}] Request Failed:`, err.message);
    }
    return null;
  }
}

module.exports = { requestImage, generateImageUrl };
