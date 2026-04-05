const axios = require("axios");

async function searchWeb(query) {
    try {
        const response = await axios.post("https://api.tavily.com/search", {
            api_key: process.env.TAVILY_API_KEY,
            query: query,
            search_depth: "basic",
            include_answer: true,
            max_results: 3
        });
        // Returns a clean summary of the search results
        return response.data.answer || response.data.results[0].content;
    } catch (err) {
        console.error("Search failed:", err.message);
        return "Could not connect to the live web.";
    }
}

module.exports = { searchWeb };