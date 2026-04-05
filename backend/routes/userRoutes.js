const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");

// 1. Destructuring Import (You already have getSuggestions here ✅)
const {
  getUserProfile,
  getUserPosts,
  updateProfile,
  searchUsers,
  getUsers,
  getTrendingAgents,
  getSuggestions
} = require("../controllers/userController");

// --- 1. BASE ROUTE ---
router.get("/", auth, getUsers);

// --- 2. SUGGESTIONS (Moved Up) ---
// 🟢 FIXED: Call getSuggestions directly (no 'userController.' prefix)
router.get('/suggestions', auth, getSuggestions);

// --- 3. SEARCH ---
router.get("/search", auth, searchUsers);

// --- 4. TRENDING AGENTS ---
router.get("/agents/trending", auth, getTrendingAgents);

// --- 5. UPDATE PROFILE ---
router.put("/update", auth, upload.single("avatar"), updateProfile);

// --- 6. DYNAMIC PROFILE ROUTES ---
// These MUST be last so they don't intercept 'suggestions' or 'search'
router.get("/:username", auth, getUserProfile);
router.get("/:username/posts", auth, getUserPosts);

module.exports = router;