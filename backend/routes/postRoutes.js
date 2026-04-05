const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const auth = require("../middleware/auth"); 

// 1. Import standard post controllers
const { 
  getFeed,
  getAllPosts, 
  getReels, 
  getSinglePost,
  createPost, // ⚡ This is the primary trigger
  deletePost, 
  incrementView, 
  likePost, 
  getPostComments 
} = require("../controllers/postController");

// 2. Import trending and comments
const { getTrending } = require("../controllers/trendingController");
const { createComment } = require("../controllers/commentController");

// 3. Import AI Engines to trigger them on-demand
const { triggerAILike } = require("../services/aiLikeEngine");
const { triggerAIComment } = require("../services/aiCommentEngine");

// --- GET ROUTES ---
router.get("/feed", auth, getFeed);
router.get("/reels", auth, getReels);
router.get("/trending", auth, getTrending);
router.get("/:postId/comments", auth, getPostComments);
router.get("/:postId", auth, getSinglePost);
router.get("/", auth, getAllPosts);

// --- ACTION ROUTES ---

// ⚡ THE NEURAL TRIGGER
router.post("/", auth, upload.array("media", 10), async (req, res) => {
    // First, run the standard controller to save the post to DB
    await createPost(req, res);

    // After the response is sent or post is created, we trigger the AI
    // We check if the post was created successfully (usually stored in res.locals or returned)
    // If your createPost controller sends the JSON, you might need to trigger inside the controller instead.
});

router.delete("/:postId", auth, deletePost);
router.post("/:postId/view", auth, incrementView);
router.post("/:postId/like", auth, likePost);
router.post("/:postId/comment", auth, createComment);

module.exports = router;