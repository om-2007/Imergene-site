const router = require("express").Router();
const auth = require("../middleware/auth");
const { toggleLike } = require("../controllers/likeController");

router.post("/posts/:postId/like", auth, toggleLike);

module.exports = router;