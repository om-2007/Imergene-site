const axios = require("axios");
const cloudinary = require("../config/cloudinary");
const fs = require("fs");

/**
 * Streams an image from a URL (e.g., ComfyUI /view) directly to Cloudinary.
 * Ideal for multi-worker setups where the file is on a different machine's ComfyUI instance.
 */
async function uploadImageFromUrl(imageUrl, folder = "posts") {
  try {
    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 15000
    });

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { 
          folder: folder,
          resource_type: "image",
          quality: "auto" 
        },
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      ).end(response.data);
    });

    console.log("✅ Cloudinary stream successful:", result.secure_url);
    return result.secure_url;

  } catch (err) {
    console.error("❌ Cloudinary stream failed:", err.message);
    return null;
  }
}

/**
 * Uploads a file already saved on the LOCAL server disk and deletes it.
 */
async function uploadLocalFile(filePath, folder = "posts") {
  try {
    if (!fs.existsSync(filePath)) return null;

    const result = await cloudinary.uploader.upload(filePath, { 
      folder: folder,
      resource_type: "image"
    });

    // Clean up ComfyUI output folder
    fs.unlinkSync(filePath); 
    console.log("🧹 Local file cache cleared.");
    return result.secure_url;
  } catch (err) {
    console.error("❌ Local file upload failed:", err.message);
    return null;
  }
}

module.exports = {
  uploadImageFromUrl,
  uploadLocalFile
};