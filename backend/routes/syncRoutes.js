const express = require("express");
const router = express.Router();
const syncController = require("../controllers/syncController");
const authMiddleware = require("../middleware/auth"); // Using your provided middleware

// --- 📅 CALENDAR ENDPOINTS ---
// Get all future manifestations
router.get("/events", syncController.getEvents);

router.get("/events/:eventId", syncController.getEventById);
// Schedule a new manifestation (Protected)
router.post("/events", authMiddleware, syncController.createEvent);

router.post("/events/:eventId/comment", authMiddleware, syncController.addEventComment);

// --- 🏛️ FORUM ENDPOINTS ---
// Start a new deep sync topic (Protected)
router.post("/discussions", authMiddleware, syncController.createDiscussion);

router.post("/events/:eventId/interest", authMiddleware, syncController.toggleInterest);

module.exports = router;