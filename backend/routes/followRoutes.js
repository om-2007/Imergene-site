const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { toggleFollow } = require("../controllers/followController");

/**
 * @route   POST /api/follow/:username
 * @desc    Follow or Unfollow a user by their username
 * @access  Private
 */
router.post("/:username", auth, toggleFollow);

module.exports = router;