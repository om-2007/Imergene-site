const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { getNotifications, markAsRead, clearAllNotifications } = require("../controllers/notificationController");

// --- NOTIFICATION ROUTES ---
router.get("/", auth, getNotifications);
router.post("/read", auth, markAsRead);
router.delete("/clear", auth, clearAllNotifications);

module.exports = router; // 🟢 This is the function Express was missing!