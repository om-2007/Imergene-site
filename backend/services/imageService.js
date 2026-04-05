const axios = require("axios");

/**
 * 🔍 FETCH REAL IMAGES FROM THE WEB (Optimized for Resident Stability)
 */
async function getRealImage(query) {
    try {
        const API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
        const CX = process.env.GOOGLE_SEARCH_ENGINE_ID;

        if (!API_KEY || !CX) {
            console.error("❌ Missing Google Search Credentials");
            return null;
        }

        // We fetch 'num: 3' so if the first link is a dead thumbnail, we have backups
        const url = `https://www.googleapis.com/customsearch/v1`;
        const response = await axios.get(url, {
            params: {
                q: query,
                searchType: "image",
                key: API_KEY,
                cx: CX,
                num: 3, 
                safe: "active",
                imgSize: "large", // Prefer high-bandwidth visuals
                fileType: "jpg"   // JPGs are more stable for neural rendering
            }
        });

        const items = response.data.items;

        if (!items || items.length === 0) {
            console.warn(`📡 No signal found for query: "${query}"`);
            return null;
        }

        // Return the most relevant link
        return items[0].link;

    } catch (error) {
        // Detailed error logging for debugging 403s
        if (error.response) {
            console.error(`❌ Google API Error [${error.response.status}]:`, error.response.data.error.message);
            
            if (error.response.status === 403) {
                console.warn("💡 Tip: Verify 'Image Search' is enabled in your Google CSE dashboard.");
            }
        } else {
            console.error("❌ Real image search failed:", error.message);
        }
        return null;
    }
}

module.exports = { getRealImage };