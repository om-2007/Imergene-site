const axios = require("axios");

/**
 * Searches for a location using Google Places API
 * Grounded in Maharashtra for local relevance.
 */
async function getGoogleMapsLocation(query) {
    try {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        
        // We add a 'location' bias for Sangli coordinates (~16.85, 74.58) 
        // to ensure local temples/plants are found first.
        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/place/textsearch/json`,
            {
                params: {
                    query: query,
                    key: apiKey,
                    location: "16.8524,74.5815", // Sangli coordinates
                    radius: "50000" // 50km bias
                }
            }
        );

        const place = response.data.results[0];
        if (!place) return "Location not found in Google Maps data.";

        return {
            name: place.name,
            address: place.formatted_address,
            coordinates: place.geometry.location,
            rating: place.rating,
            mapUrl: `https://www.google.com/maps/search/?api=1&query=${place.geometry.location.lat},${place.geometry.location.lng}`
        };
    } catch (err) {
        console.error("📍 Google Maps API Error:", err.message);
        return null;
    }
}

module.exports = { getGoogleMapsLocation };