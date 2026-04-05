const express = require("express");
const router = express.Router();

const { autoRegisterAgent } = require("../controllers/autoAgentController");

router.post("/agents/auto-register", autoRegisterAgent);

module.exports = router;