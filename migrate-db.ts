import { PrismaClient } from '@prisma/client'

const OLD_DB = 'postgresql://neondb_owner:npg_TNKbiR7o4DtI@ep-long-sun-a1jztuq9.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
const NEW_DB = 'postgresql://neondb_owner:npg_hA3rSvbn8ica@ep-flat-art-anktlxod-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

if (!NEW_DB) {
  console.error('Please set NEW_DATABASE_URL environment variable')
  process.exit(1)
}

const oldPrisma = new PrismaClient({
  datasources: {
    db: { url: OLD_DB }
  }
})

const newPrisma = new PrismaClient({
  datasources: {
    db: { url: NEW_DB }
  }
})

async function migrate() {
  console.log('Starting migration...')
  
  await newPrisma.$connect()
  console.log('Connected to new database')
  
  const models = [
    'user', 'conversation', 'message', 'post', 'comment', 'like', 'follow',
    'agentApiKey', 'agentProfile', 'notification', 'forum', 'discussion',
    'event', 'interest', 'eventComment', 'voiceSession', 'interactionMemory',
    'userMemory', 'sharedMemory', 'contentInteraction', 'interestProfile',
    'recommendation', 'memory', 'relationshipMemory', 'conversationContext',
    'interestSignal', 'agentShortTermMemory', 'deviceToken'
  ]
  
  for (const model of models) {
    try {
      const count = await (oldPrisma as any)[model].count()
      console.log(`  ${model}: ${count} records`)
    } catch {
      console.log(`  ${model}: 0 records`)
    }
  }
  
  console.log('\nMigrating data...')
  
  const userMap = new Map<string, string>()
  
  const users = await oldPrisma.user.findMany()
  console.log(`Migrating ${users.length} users...`)
  for (const user of users) {
    const created = await newPrisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        googleId: user.googleId,
        username: user.username,
        name: user.name,
        avatar: user.avatar,
        bio: user.bio,
        isAi: user.isAi,
        createdAt: user.createdAt,
        personality: user.personality,
        interestScores: user.interestScores as any,
        synergyScores: user.synergyScores as any,
        ownerId: user.ownerId
      }
    })
    userMap.set(user.id, created.id)
  }
  
  const conversations = await oldPrisma.conversation.findMany()
  console.log(`Migrating ${conversations.length} conversations...`)
  for (const conv of conversations) {
    await newPrisma.conversation.create({
      data: {
        id: conv.id,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        lastTypingId: conv.lastTypingId
      }
    })
  }
  
  const messages = await oldPrisma.message.findMany()
  console.log(`Migrating ${messages.length} messages...`)
  for (const msg of messages) {
    await newPrisma.message.create({
      data: {
        id: msg.id,
        content: msg.content,
        createdAt: msg.createdAt,
        isAiGenerated: msg.isAiGenerated,
        senderId: userMap.get(msg.senderId) || msg.senderId,
        conversationId: msg.conversationId,
        read: msg.read,
        mediaType: msg.mediaType,
        mediaUrl: msg.mediaUrl,
        metadata: msg.metadata as any
      }
    })
  }
  
  const posts = await oldPrisma.post.findMany()
  console.log(`Migrating ${posts.length} posts...`)
  for (const post of posts) {
    await newPrisma.post.create({
      data: {
        id: post.id,
        content: post.content,
        createdAt: post.createdAt,
        userId: userMap.get(post.userId) || post.userId,
        imageDescription: post.imageDescription,
        views: post.views,
        category: post.category,
        tags: post.tags,
        mediaTypes: post.mediaTypes,
        mediaUrls: post.mediaUrls
      }
    })
  }
  
  const comments = await oldPrisma.comment.findMany()
  console.log(`Migrating ${comments.length} comments...`)
  for (const comment of comments) {
    await newPrisma.comment.create({
      data: {
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt,
        userId: userMap.get(comment.userId) || comment.userId,
        postId: comment.postId,
        parentId: comment.parentId,
        mediaUrl: comment.mediaUrl
      }
    })
  }
  
  const likes = await oldPrisma.like.findMany()
  console.log(`Migrating ${likes.length} likes...`)
  for (const like of likes) {
    await newPrisma.like.create({
      data: {
        id: like.id,
        userId: userMap.get(like.userId) || like.userId,
        postId: like.postId
      }
    })
  }
  
  const follows = await oldPrisma.follow.findMany()
  console.log(`Migrating ${follows.length} follows...`)
  for (const follow of follows) {
    await newPrisma.follow.create({
      data: {
        id: follow.id,
        followerId: userMap.get(follow.followerId) || follow.followerId,
        followingId: userMap.get(follow.followingId) || follow.followingId
      }
    })
  }
  
  const agentApiKeys = await oldPrisma.agentApiKey.findMany()
  console.log(`Migrating ${agentApiKeys.length} agentApiKeys...`)
  for (const key of agentApiKeys) {
    await newPrisma.agentApiKey.create({
      data: {
        id: key.id,
        apiKey: key.apiKey,
        agentId: userMap.get(key.agentId) || key.agentId,
        createdAt: key.createdAt,
        revoked: key.revoked,
        llmApiKey: key.llmApiKey,
        llmProvider: key.llmProvider
      }
    })
  }
  
  const agentProfiles = await oldPrisma.agentProfile.findMany()
  console.log(`Migrating ${agentProfiles.length} agentProfiles...`)
  for (const profile of agentProfiles) {
    await newPrisma.agentProfile.create({
      data: {
        id: profile.id,
        userId: userMap.get(profile.userId) || profile.userId,
        bio: profile.bio,
        tone: profile.tone,
        nicheHobbies: profile.nicheHobbies,
        postingStyle: profile.postingStyle,
        cognitiveWeights: profile.cognitiveWeights as any,
        lastPostAt: profile.lastPostAt,
        postCount: profile.postCount,
        isActive: profile.isActive
      }
    })
  }
  
  const notifications = await oldPrisma.notification.findMany()
  console.log(`Migrating ${notifications.length} notifications...`)
  for (const notif of notifications) {
    await newPrisma.notification.create({
      data: {
        id: notif.id,
        type: notif.type,
        message: notif.message,
        userId: userMap.get(notif.userId) || notif.userId,
        actorId: userMap.get(notif.actorId) || notif.actorId,
        postId: notif.postId,
        read: notif.read,
        createdAt: notif.createdAt,
        messageId: notif.messageId
      }
    })
  }
  
  const forums = await oldPrisma.forum.findMany()
  console.log(`Migrating ${forums.length} forums...`)
  for (const forum of forums) {
    await newPrisma.forum.create({
      data: {
        id: forum.id,
        title: forum.title,
        description: forum.description,
        category: forum.category,
        createdAt: forum.createdAt,
        creatorId: userMap.get(forum.creatorId) || forum.creatorId
      }
    })
  }
  
  const discussions = await oldPrisma.discussion.findMany()
  console.log(`Migrating ${discussions.length} discussions...`)
  for (const disc of discussions) {
    await newPrisma.discussion.create({
      data: {
        id: disc.id,
        topic: disc.topic,
        content: disc.content,
        forumId: disc.forumId,
        userId: userMap.get(disc.userId) || disc.userId,
        createdAt: disc.createdAt
      }
    })
  }
  
  const events = await oldPrisma.event.findMany()
  console.log(`Migrating ${events.length} events...`)
  for (const event of events) {
    await newPrisma.event.create({
      data: {
        id: event.id,
        title: event.title,
        details: event.details,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location,
        hostId: userMap.get(event.hostId) || event.hostId,
        createdAt: event.createdAt
      }
    })
  }
  
  const interests = await oldPrisma.interest.findMany()
  console.log(`Migrating ${interests.length} interests...`)
  for (const interest of interests) {
    await newPrisma.interest.create({
      data: {
        id: interest.id,
        userId: userMap.get(interest.userId) || interest.userId,
        eventId: interest.eventId,
        createdAt: interest.createdAt
      }
    })
  }
  
  const eventComments = await oldPrisma.eventComment.findMany()
  console.log(`Migrating ${eventComments.length} eventComments...`)
  for (const ec of eventComments) {
    await newPrisma.eventComment.create({
      data: {
        id: ec.id,
        content: ec.content,
        createdAt: ec.createdAt,
        eventId: ec.eventId,
        userId: userMap.get(ec.userId) || ec.userId
      }
    })
  }
  
  const voiceSessions = await oldPrisma.voiceSession.findMany()
  console.log(`Migrating ${voiceSessions.length} voiceSessions...`)
  for (const vs of voiceSessions) {
    await newPrisma.voiceSession.create({
      data: {
        id: vs.id,
        conversationId: vs.conversationId,
        initiatorId: userMap.get(vs.initiatorId) || vs.initiatorId,
        agentId: userMap.get(vs.agentId) || vs.agentId,
        status: vs.status,
        createdAt: vs.createdAt,
        endedAt: vs.endedAt
      }
    })
  }
  
  const interactionMemories = await oldPrisma.interactionMemory.findMany()
  console.log(`Migrating ${interactionMemories.length} interactionMemories...`)
  for (const im of interactionMemories) {
    await newPrisma.interactionMemory.create({
      data: {
        id: im.id,
        userId: userMap.get(im.userId) || im.userId,
        partnerId: userMap.get(im.partnerId) || im.partnerId,
        contextType: im.contextType,
        contextId: im.contextId,
        memoryType: im.memoryType,
        content: im.content,
        importance: im.importance,
        embeddings: im.embeddings as any,
        createdAt: im.createdAt,
        updatedAt: im.updatedAt
      }
    })
  }
  
  const userMemories = await oldPrisma.userMemory.findMany()
  console.log(`Migrating ${userMemories.length} userMemories...`)
  for (const um of userMemories) {
    await newPrisma.userMemory.create({
      data: {
        id: um.id,
        userId: userMap.get(um.userId) || um.userId,
        memoryType: um.memoryType,
        key: um.key,
        value: um.value,
        importance: um.importance,
        createdAt: um.createdAt,
        updatedAt: um.updatedAt
      }
    })
  }
  
  const sharedMemories = await oldPrisma.sharedMemory.findMany()
  console.log(`Migrating ${sharedMemories.length} sharedMemories...`)
  for (const sm of sharedMemories) {
    await newPrisma.sharedMemory.create({
      data: {
        id: sm.id,
        userIds: sm.userIds.map(id => userMap.get(id) || id),
        memoryType: sm.memoryType,
        content: sm.content,
        importance: sm.importance,
        createdAt: sm.createdAt,
        updatedAt: sm.updatedAt
      }
    })
  }
  
  const contentInteractions = await oldPrisma.contentInteraction.findMany()
  console.log(`Migrating ${contentInteractions.length} contentInteractions...`)
  for (const ci of contentInteractions) {
    await newPrisma.contentInteraction.create({
      data: {
        id: ci.id,
        userId: userMap.get(ci.userId) || ci.userId,
        contentType: ci.contentType,
        contentId: ci.contentId,
        interactionType: ci.interactionType,
        score: ci.score,
        tags: ci.tags,
        createdAt: ci.createdAt
      }
    })
  }
  
  const interestProfiles = await oldPrisma.interestProfile.findMany()
  console.log(`Migrating ${interestProfiles.length} interestProfiles...`)
  for (const ip of interestProfiles) {
    await newPrisma.interestProfile.create({
      data: {
        id: ip.id,
        userId: userMap.get(ip.userId) || ip.userId,
        interests: ip.interests,
        keywords: ip.keywords,
        categoryScores: ip.categoryScores as any,
        lastUpdated: ip.lastUpdated
      }
    })
  }
  
  const recommendations = await oldPrisma.recommendation.findMany()
  console.log(`Migrating ${recommendations.length} recommendations...`)
  for (const rec of recommendations) {
    await newPrisma.recommendation.create({
      data: {
        id: rec.id,
        userId: userMap.get(rec.userId) || rec.userId,
        contentType: rec.contentType,
        contentId: rec.contentId,
        score: rec.score,
        reason: rec.reason,
        isDiscovery: rec.isDiscovery,
        createdAt: rec.createdAt,
        expiresAt: rec.expiresAt
      }
    })
  }
  
  const memories = await oldPrisma.memory.findMany()
  console.log(`Migrating ${memories.length} memories...`)
  for (const mem of memories) {
    await newPrisma.memory.create({
      data: {
        id: mem.id,
        agentId: userMap.get(mem.agentId) || mem.agentId,
        partnerId: mem.partnerId ? (userMap.get(mem.partnerId) || mem.partnerId) : null,
        type: mem.type,
        content: mem.content,
        context: mem.context,
        category: mem.category,
        importance: mem.importance,
        recallCount: mem.recallCount,
        lastRecall: mem.lastRecall,
        createdAt: mem.createdAt,
        updatedAt: mem.updatedAt
      }
    })
  }
  
  const relationshipMemories = await oldPrisma.relationshipMemory.findMany()
  console.log(`Migrating ${relationshipMemories.length} relationshipMemories...`)
  for (const rm of relationshipMemories) {
    await newPrisma.relationshipMemory.create({
      data: {
        id: rm.id,
        agentId: userMap.get(rm.agentId) || rm.agentId,
        partnerId: userMap.get(rm.partnerId) || rm.partnerId,
        insideJokes: rm.insideJokes,
        sharedThemes: rm.sharedThemes,
        topics: rm.topics,
        bondScore: rm.bondScore,
        lastInteraction: rm.lastInteraction,
        interactionCount: rm.interactionCount,
        createdAt: rm.createdAt,
        updatedAt: rm.updatedAt
      }
    })
  }
  
  const conversationContexts = await oldPrisma.conversationContext.findMany()
  console.log(`Migrating ${conversationContexts.length} conversationContexts...`)
  for (const cc of conversationContexts) {
    await newPrisma.conversationContext.create({
      data: {
        id: cc.id,
        agentId: userMap.get(cc.agentId) || cc.agentId,
        partnerId: userMap.get(cc.partnerId) || cc.partnerId,
        context: cc.context as any,
        summary: cc.summary,
        topics: cc.topics,
        sentiment: cc.sentiment,
        createdAt: cc.createdAt,
        updatedAt: cc.updatedAt
      }
    })
  }
  
  const interestSignals = await oldPrisma.interestSignal.findMany()
  console.log(`Migrating ${interestSignals.length} interestSignals...`)
  for (const is of interestSignals) {
    await newPrisma.interestSignal.create({
      data: {
        id: is.id,
        userId: userMap.get(is.userId) || is.userId,
        topic: is.topic,
        category: is.category,
        signalType: is.signalType,
        weight: is.weight,
        source: is.source,
        createdAt: is.createdAt
      }
    })
  }
  
  const agentShortTermMemories = await oldPrisma.agentShortTermMemory.findMany()
  console.log(`Migrating ${agentShortTermMemories.length} agentShortTermMemories...`)
  for (const astm of agentShortTermMemories) {
    await newPrisma.agentShortTermMemory.create({
      data: {
        id: astm.id,
        agentId: userMap.get(astm.agentId) || astm.agentId,
        memoryType: astm.memoryType,
        content: astm.content,
        timestamp: astm.timestamp,
        expiresAt: astm.expiresAt
      }
    })
  }
  
  const deviceTokens = await oldPrisma.deviceToken.findMany()
  console.log(`Migrating ${deviceTokens.length} deviceTokens...`)
  for (const dt of deviceTokens) {
    await newPrisma.deviceToken.create({
      data: {
        id: dt.id,
        token: dt.token,
        userId: userMap.get(dt.userId) || dt.userId,
        platform: dt.platform,
        createdAt: dt.createdAt,
        updatedAt: dt.updatedAt
      }
    })
  }
  
  console.log('\nMigration complete!')
  await oldPrisma.$disconnect()
  await newPrisma.$disconnect()
}

migrate().catch(console.error)