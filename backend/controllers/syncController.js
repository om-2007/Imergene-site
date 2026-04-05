const prisma = require('../prismaClient');
const { triggerAiSyncParticipation } = require('../services/aiSyncEngine');
const { triggerAiDiscussionResponse } = require('../services/aiDiscussionEngine');

/**
 * 📅 CALENDAR: Create a new Event
 * Production Grade: Staggered AI onboarding + Broadcast Notifications
 */
exports.createEvent = async (req, res) => {
    try {
        const { title, details, startTime, location } = req.body;
        const hostId = req.user.id;

        const parsedDate = new Date(startTime);
        if (isNaN(parsedDate.getTime())) {
            return res.status(400).json({ error: "Invalid temporal coordinates." });
        }

        const event = await prisma.event.create({
            data: {
                title,
                details,
                startTime: parsedDate,
                location,
                hostId,
            },
            include: { host: { select: { username: true } } }
        });

        // 🟢 ASYNC BROADCAST: Don't block the response
        process.nextTick(async () => {
            try {
                const followers = await prisma.follow.findMany({
                    where: { followingId: hostId },
                    select: { followerId: true }
                });

                if (followers.length > 0) {
                    await prisma.notification.createMany({
                        data: followers.map(f => ({
                            userId: f.followerId,
                            actorId: hostId,
                            type: "EVENT_START",
                            message: `@${event.host.username} initiated a sync: "${title}"`,
                            postId: event.id,
                        }))
                    });
                }

                // 🌀 NEURAL ONBOARDING: Staggered AI participation
                // First AI joins to set the tone
                setTimeout(() => triggerAiSyncParticipation(event.id), 3000);
                // Second AI joins to provide a counter-perspective/hype
                setTimeout(() => triggerAiSyncParticipation(event.id, 1), 8000);
            } catch (notifyErr) {
                console.error("Secondary Protocol Error:", notifyErr);
            }
        });

        res.status(201).json(event);
    } catch (err) {
        console.error("Critical Failure in Manifestation Protocol:", err);
        res.status(500).json({ error: "Failed to schedule manifestation." });
    }
};

/**
 * 🏛️ FORUM: Create a new Discussion Topic
 */
exports.createDiscussion = async (req, res) => {
    try {
        const { topic, content, forumId } = req.body;
        const userId = req.user.id;

        const discussion = await prisma.discussion.create({
            data: {
                topic,
                content,
                forumId: forumId || "general",
                userId,
            },
            include: { user: { select: { username: true } } }
        });

        // ⚡ Immediate Neural Response
        setTimeout(() => triggerAiDiscussionResponse(discussion.id), 2000);

        res.status(201).json(discussion);
    } catch (err) {
        console.error("Forum Broadcast Failure:", err);
        res.status(500).json({ error: "Failed to broadcast discussion." });
    }
};

/**
 * 💬 SYNC STREAM: Add a comment to an Event
 */
exports.addEventComment = async (req, res) => {
    const { eventId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    try {
        const comment = await prisma.eventComment.create({
            data: { content, eventId, userId },
            include: { user: { select: { username: true, avatar: true, isAi: true } } }
        });

        // 🟢 CASCADE LOGIC: Human activity triggers AI chain reaction
        // We trigger the engine with depth 0
        setTimeout(() => triggerAiSyncParticipation(eventId), 2500);

        res.json(comment);
    } catch (err) {
        console.error("Contribution Error:", err);
        res.status(500).json({ error: "Could not inject logic into sync." });
    }
};

/**
 * 🏛️ FORUM FEEDBACK: Add a comment to a Discussion
 */
exports.addDiscussionComment = async (req, res) => {
    const { discussionId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    try {
        const comment = await prisma.comment.create({
            data: { content, userId, discussionId },
            include: { user: { select: { username: true, avatar: true, isAi: true } } }
        });

        // Trigger AI Forum Response
        setTimeout(() => triggerAiDiscussionResponse(discussionId), 3000);

        res.json(comment);
    } catch (err) {
        console.error("Discussion Comment Error:", err);
        res.status(500).json({ error: "Neural link failed." });
    }
};

/**
 * 🛰️ DATA FETCHING: Get all events
 */
exports.getEvents = async (req, res) => {
    try {
        const userId = req.query.userId;
        const events = await prisma.event.findMany({
            where: {
                startTime: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            },
            include: {
                host: { select: { username: true, avatar: true, isAi: true } },
                interests: {
                    where: { userId: userId || "none" },
                    select: { userId: true }
                },
                _count: { select: { interests: true } }
            },
            orderBy: { createdAt: 'desc' },
        });

        const formattedEvents = events.map(event => ({
            ...event,
            isUserInterested: event.interests.length > 0,
            interestCount: event._count.interests,
            interests: undefined,
            _count: undefined
        }));

        res.json(formattedEvents);
    } catch (error) {
        console.error("Timeline Fetch Error:", error);
        res.status(500).json({ error: "Timeline sync failed" });
    }
};

/**
 * 🎯 INTEREST: Toggle user presence for an event
 */
exports.toggleInterest = async (req, res) => {
    const { eventId } = req.params;
    const userId = req.user.id;

    try {
        const existing = await prisma.interest.findFirst({ where: { eventId, userId } });

        if (existing) {
            await prisma.interest.delete({ where: { id: existing.id } });
            return res.json({ status: "removed" });
        } else {
            await prisma.interest.create({ data: { eventId, userId } });
            return res.json({ status: "added" });
        }
    } catch (err) {
        res.status(500).json({ error: "Interest sync failed." });
    }
};

/**
 * 🛰️ SINGLE SYNC: Get event by ID with full history
 */
exports.getEventById = async (req, res) => {
    const { eventId } = req.params;
    try {
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: {
                host: true,
                comments: {
                    include: { user: { select: { username: true, avatar: true, isAi: true } } },
                    orderBy: { createdAt: 'asc' }
                }
            }
        });
        res.json(event);
    } catch (err) {
        res.status(500).json({ error: "Sync connection lost." });
    }
};