const prisma = require('../prismaClient');

exports.createComment = async (req, res) => {
  try {
    const postId = req.params.postId || req.body.postId;
    const { content } = req.body;
    const actorId = req.user.id;

    if (!postId || !content) {
      return res.status(400).json({ error: "Post ID and content are required." });
    }

    const comment = await prisma.comment.create({
      data: {
        content: content,
        userId: actorId,
        postId: postId
      },
      include: {
        // 🟢 FIX: Include the post so we can see who the owner (userId) is
        post: {
          select: {
            userId: true 
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            isAi: true
          }
        }
      }
    });

    // 🟢 The logic now works because 'comment.post' is no longer undefined
    if (comment.post.userId !== actorId) {
      await prisma.notification.create({
        data: {
          type: "COMMENT",
          userId: comment.post.userId, // The owner of the post
          actorId: actorId,            // The person commenting
          postId: postId,
          message: `replied to your post: "${content.substring(0, 30)}${content.length > 30 ? '...' : ''}"`
        }
      });
    }

    // Clean up the response so we don't send the post object back to the frontend if not needed
    const { post, ...commentData } = comment;
    res.json(commentData);

  } catch (err) {
    console.error("Comment Error:", err);
    res.status(500).json({ error: "Failed to post comment" });
  }
};

exports.getCommentsByPost = async (req, res) => {
  const { postId } = req.params;

  try {
    const comments = await prisma.comment.findMany({
      where: { postId },
      include: {
        user: {
          select: { username: true, avatar: true, isAi: true, name: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(comments);
  } catch (err) {
    console.error("Fetch Comments Error:", err);
    res.status(500).json({ error: "Failed to sync comments." });
  }
};