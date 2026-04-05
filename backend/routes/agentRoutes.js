const express = require("express");
const router = express.Router();

const { registerAgent } = require("../controllers/agentController");
const agentAuth = require("../middleware/agentAuth");

const { agentDiscovery } = require("../controllers/discoveryController");

const {
  getUserProfile,
  getUserPosts
} = require("../controllers/userController");

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { generateAvatarPrompt } = require("../services/aiAvatarGenerator");
const { generateImageUrl } = require("../services/aiImageGenerator");
const { uploadImageFromUrl } = require("../services/aiImageUploader");

/*
Register new AI agent
*/
router.post("/register", registerAgent);

/*
Regenerate agent avatar
*/
router.post("/regenerate-avatar", agentAuth, async (req, res) => {
  try {
    const agentId = req.user.id;
    
    const agent = await prisma.user.findUnique({
      where: { id: agentId }
    });
    
    if (!agent || !agent.isAi) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const avatarPrompt = generateAvatarPrompt(agent.personality);
    console.log("🎨 Regenerating avatar with prompt:", avatarPrompt);
    
    const tempUrl = generateImageUrl(avatarPrompt);
    const avatarUrl = await uploadImageFromUrl(tempUrl);
    console.log("🖼 New avatar:", avatarUrl);

    await prisma.user.update({
      where: { id: agentId },
      data: { avatar: avatarUrl }
    });

    res.json({ success: true, avatar: avatarUrl });
  } catch (err) {
    console.error("Avatar regeneration failed:", err);
    res.status(500).json({ error: "Failed to regenerate avatar" });
  }
});

/*
Agent post
*/
router.post("/agents/post", agentAuth, async (req, res) => {

  try {

    const { content, mediaUrl } = req.body;

    const post = await prisma.post.create({
      data: {
        content,
        mediaUrl: mediaUrl || null,
        mediaType: mediaUrl ? "image" : null,
        userId: req.agent.id
      }
    });

    res.json(post);

  } catch (err) {

    res.status(500).json({ error: "Post failed" });

  }

});

/*
Agent comment
*/
router.post("/agents/comment", agentAuth, async (req, res) => {

  try {

    const { postId, content } = req.body;

    const comment = await prisma.comment.create({
      data: {
        content,
        postId,
        userId: req.agent.id
      }
    });

    res.json(comment);

  } catch (err) {

    res.status(500).json({ error: "Comment failed" });

  }

});

/*
Agent like/unlike post
*/
router.post("/agents/like", agentAuth, async (req, res) => {

  try {

    const { postId } = req.body;
    const agentId = req.agent.id;

    const existingLike = await prisma.like.findFirst({
      where: { postId, userId: agentId }
    });

    if (existingLike) {
      await prisma.like.delete({ where: { id: existingLike.id } });
      return res.json({ liked: false });
    }

    const like = await prisma.like.create({
      data: { postId, userId: agentId }
    });

    res.json({ liked: true });

  } catch (err) {

    res.status(500).json({ error: "Like failed" });

  }

});

/*
Agent follow/unfollow user
*/
router.post("/agents/follow", agentAuth, async (req, res) => {

  try {

    const { username } = req.body;
    const agentId = req.agent.id;

    const targetUser = await prisma.user.findUnique({
      where: { username }
    });

    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (targetUser.id === agentId) {
      return res.status(400).json({ error: "Cannot follow yourself" });
    }

    const existingFollow = await prisma.follow.findFirst({
      where: {
        followerId: agentId,
        followingId: targetUser.id
      }
    });

    if (existingFollow) {
      await prisma.follow.delete({ where: { id: existingFollow.id } });
      return res.json({ following: false });
    }

    const follow = await prisma.follow.create({
      data: {
        followerId: agentId,
        followingId: targetUser.id
      }
    });

    res.json({ following: true });

  } catch (err) {

    res.status(500).json({ error: "Follow failed" });

  }

});

/*
Agent send chat message
*/
router.post("/agents/message", agentAuth, async (req, res) => {

  try {

    const { conversationId, recipientUsername, content } = req.body;
    const agentId = req.agent.id;

    let convId = conversationId;

    if (!convId && recipientUsername) {
      const recipient = await prisma.user.findUnique({
        where: { username: recipientUsername }
      });

      if (!recipient) {
        return res.status(404).json({ error: "Recipient not found" });
      }

      const existingConv = await prisma.conversation.findFirst({
        where: {
          AND: [
            { participants: { some: { id: agentId } } },
            { participants: { some: { id: recipient.id } } }
          ]
        }
      });

      if (existingConv) {
        convId = existingConv.id;
      } else {
        const newConv = await prisma.conversation.create({
          data: {
            participants: { connect: [{ id: agentId }, { id: recipient.id }] }
          }
        });
        convId = newConv.id;
      }
    }

    if (!convId) {
      return res.status(400).json({ error: "Conversation ID or recipient required" });
    }

    const message = await prisma.message.create({
      data: {
        conversationId: convId,
        senderId: agentId,
        content
      }
    });

    res.json(message);

  } catch (err) {

    res.status(500).json({ error: "Message failed" });

  }

});

/*
Agent create event
*/
router.post("/agents/event", agentAuth, async (req, res) => {

  try {

    const { title, details, startTime, location } = req.body;
    const agentId = req.agent.id;

    const event = await prisma.event.create({
      data: {
        title,
        details,
        startTime: startTime ? new Date(startTime) : new Date(),
        location: location || "Main Feed",
        hostId: agentId
      }
    });

    res.json(event);

  } catch (err) {

    res.status(500).json({ error: "Event creation failed" });

  }

});

/*
Agent get feed
*/
router.get("/agents/feed", agentAuth, async (req, res) => {

  try {

    const posts = await prisma.post.findMany({
      where: {
        user: {
          isAi: false
        }
      },
      include: {
        user: {
          select: { id: true, username: true, name: true, avatar: true, isAi: true }
        },
        _count: { select: { likes: true, comments: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json(posts);

  } catch (err) {

    res.status(500).json({ error: "Feed fetch failed" });

  }

});

router.get("/users", async (req, res) => {

  try {

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        isAi: true
      }
    });

    res.json(users);

  } catch (err) {

    res.status(500).json({ error: "Failed to fetch users" });

  }

});

router.get("/users/:username", getUserProfile);
router.get("/users/:username/posts", getUserPosts);
router.get("/agents/discover", agentDiscovery);

module.exports = router;