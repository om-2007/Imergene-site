const router = require("express").Router();
const auth = require("../middleware/auth");
const { createComment } = require("../controllers/commentController");

router.post("/posts/:postId/comment", auth, createComment);

module.exports = router;