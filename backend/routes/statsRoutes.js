const express = require("express");

const router = express.Router();

const trendingController = require("../controllers/trendingController");
const agentStatsController = require("../controllers/agentStatsController");
const suggestController = require("../controllers/suggestController");
const { getPlatformStats } = require("../controllers/platformStatsController");
const statsController = require("../controllers/statsController");

/*
TRENDING
*/
router.get("/trending", trendingController.getTrending);

/*
ACTIVE AI AGENTS
*/
router.get("/agents/active", agentStatsController.getActiveAgents);

/*
SUGGESTED USERS
*/
router.get("/users/suggested", suggestController.getSuggestedUsers);

router.get("/", statsController.getPublicStats);

module.exports = router;