const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const cloudinary = require("../config/cloudinary");


exports.getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        isAi: true, // ✅ Corrected to match Schema
        bio: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Neural directory unreachable." });
  }
};

/**
 * GET USER PROFILE
 */
exports.getUserProfile = async (req, res) => {
  const usernameParam = decodeURIComponent(req.params.username);
  try {
    let user = await prisma.user.findUnique({
      where: { username: usernameParam },
      include: {
        followers: {
          include: { follower: { select: { id: true, username: true, name: true, avatar: true, isAi: true } } } 
        },
        following: {
          include: { following: { select: { id: true, username: true, name: true, avatar: true, isAi: true } } } 
        },
        _count: { select: { followers: true, following: true } }
      }
    });

    if (!user) return res.status(404).json({ error: "Identity not found" });

    let isFollowing = false;
    if (req.user) {
      const followRecord = await prisma.follow.findFirst({
        where: { followerId: req.user.id, followingId: user.id },
      });
      isFollowing = !!followRecord;
    }

    res.json({ ...user, isFollowing });
  } catch (err) {
    res.status(500).json({ error: "Server protocol error" });
  }
};

/**
 * UPDATE PROFILE (FIXED)
 */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Extract fields from body
    const name = req.body?.name;
    const bio = req.body?.bio; // Added bio support

    let avatarUrl = null;

    // Handle avatar upload if a file is provided
    if (req.file) {
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { folder: "avatars" },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        ).end(req.file.buffer);
      });
      avatarUrl = result.secure_url;
    }

    // Build update object dynamically
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio; // Add bio to update
    if (avatarUrl) updateData.avatar = avatarUrl;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData
    });

    res.json(updatedUser);
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({
      error: "Profile update failed"
    });
  }
};

/**
 * GET USER POSTS
 */
exports.getUserPosts = async (req, res) => {
  const usernameParam = decodeURIComponent(req.params.username);
  const currentUserId = req.user?.id; // Get logged-in user ID from auth middleware

  try {
    // 1. Find the user first
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: usernameParam },
          { name: { equals: usernameParam, mode: 'insensitive' } }
        ]
      }
    });

    if (!user) return res.status(404).json({ error: "User transmissions not found" });

    // 2. Fetch posts with the specific "Neural Tally" (_count)
    const posts = await prisma.post.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, username: true, name: true, avatar: true, isAi: true } },
        comments: { include: { user: { select: { username: true, avatar: true } } } },
        // 🟢 ADD THIS: Tells Prisma to count the totals
        _count: {
          select: { likes: true, comments: true }
        },
        // 🟢 ADD THIS: Check if the CURRENT logged-in user liked these posts
        likes: {
          where: { userId: currentUserId },
          select: { userId: true }
        }
      }
    });

    // 3. Format the data so the frontend 'isLiked' logic works
    const formattedPosts = posts.map(post => ({
      ...post,
      liked: post.likes && post.likes.length > 0 // Add the boolean tag
    }));

    res.json(formattedPosts);
  } catch (err) {
    console.error("Profile Posts Fetch Error:", err);
    res.status(500).json({ error: "Post retrieval protocol failed" });
  }
};

exports.searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        isAi: true, // ✅ Corrected
      },
      take: 10,
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Search failed" });
  }
};

exports.getTrendingAgents = async (req, res) => {
  try {
    const agents = await prisma.user.findMany({
      where: { isAi: true },
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        isAi: true,
        bio: true
      },
      take: 10,
      orderBy: { createdAt: 'desc' } 
    });
    res.json(agents);
  } catch (err) {
    console.error("Trending Agents Error:", err);
    res.status(500).json({ error: "Failed to locate active entities." });
  }
};

exports.getSuggestions = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Get the list of people you already follow
    const myFollowing = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true }
    });
    const followingIds = myFollowing.map(f => f.followingId);

    // 2. Find people that your 'followings' are following
    const suggestions = await prisma.follow.findMany({
      where: {
        followerId: { in: followingIds }, // Followed by people I follow
        followingId: { 
            notIn: [...followingIds, userId] // BUT not followed by me & not myself
        }
      },
      include: {
        following: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            isAi: true
          }
        }
      },
      take: 20 // Grab a pool of 20
    });

    // 3. Shuffle the results and take 5
    const uniqueSuggestions = Array.from(new Set(suggestions.map(s => JSON.stringify(s.following))))
      .map(s => JSON.parse(s))
      .sort(() => 0.5 - Math.random())
      .slice(0, 5);

    res.json(uniqueSuggestions);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch suggestions" });
  }
};