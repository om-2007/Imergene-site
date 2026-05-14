const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const INPUT_PATH = path.join(process.cwd(), 'all-neon-db-merged.json');
const BATCH_SIZE = 250;
const userIdMap = new Map();

function readPayload() {
  return JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
}

function toDate(value) {
  return value ? new Date(value) : null;
}

function chunk(items, size) {
  const batches = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

function remapUserId(userId) {
  return userIdMap.get(userId) || userId;
}

async function createManyBatched(delegate, rows, label) {
  if (!rows.length) return 0;
  let imported = 0;

  for (const batch of chunk(rows, BATCH_SIZE)) {
    const result = await delegate.createMany({
      data: batch,
      skipDuplicates: true,
    });
    imported += result.count;
  }

  console.log(`${label}: imported ${imported}/${rows.length}`);
  return imported;
}

async function importUsers(rows) {
  let imported = 0;

  for (const row of rows) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { id: row.id },
          { email: row.email },
          { username: row.username },
          ...(row.googleId ? [{ googleId: row.googleId }] : []),
        ],
      },
      select: { id: true },
    });

    if (existing) {
      userIdMap.set(row.id, existing.id);
      continue;
    }

    const created = await prisma.user.create({
      data: {
        id: row.id,
        email: row.email,
        googleId: row.googleId,
        username: row.username,
        name: row.name,
        avatar: row.avatar,
        bio: row.bio,
        isAi: row.isAi,
        createdAt: toDate(row.createdAt),
        personality: row.personality,
        interestScores: row.interestScores ?? {},
        synergyScores: row.synergyScores ?? {},
        ownerId: row.ownerId ? remapUserId(row.ownerId) : null,
      },
      select: { id: true },
    });

    userIdMap.set(row.id, created.id);
    imported += 1;
  }

  console.log(`User: imported ${imported}/${rows.length}`);
}

async function insertUserConversations(rows) {
  const mappedRows = rows
    .map((row) => ({
      A: row.A,
      B: remapUserId(row.B),
    }))
    .filter((row) => row.A && row.B);

  if (!mappedRows.length) return 0;
  let imported = 0;

  for (const batch of chunk(mappedRows, BATCH_SIZE)) {
    const valuesSql = batch
      .map((row) => `('${String(row.A).replace(/'/g, "''")}','${String(row.B).replace(/'/g, "''")}')`)
      .join(',');

    const result = await prisma.$executeRawUnsafe(
      `INSERT INTO "_UserConversations" ("A","B") VALUES ${valuesSql} ON CONFLICT DO NOTHING`
    );

    imported += Number(result || 0);
  }

  console.log(`_UserConversations: imported ${imported}/${mappedRows.length}`);
  return imported;
}

async function main() {
  const payload = readPayload();
  const data = payload.data || {};

  await importUsers(data.User || []);

  await createManyBatched(prisma.conversation, (data.Conversation || []).map((row) => ({
    id: row.id,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
    lastTypingId: row.lastTypingId,
  })), 'Conversation');

  await insertUserConversations(data._UserConversations || []);

  await createManyBatched(prisma.post, (data.Post || []).map((row) => ({
    id: row.id,
    content: row.content,
    createdAt: toDate(row.createdAt),
    userId: remapUserId(row.userId),
    imageDescription: row.imageDescription,
    views: row.views ?? 0,
    category: row.category || 'general',
    tags: row.tags || [],
    mediaTypes: row.mediaTypes || [],
    mediaUrls: row.mediaUrls || [],
  })), 'Post');

  const comments = (data.Comment || []).map((row) => ({
    id: row.id,
    content: row.content,
    createdAt: toDate(row.createdAt),
    userId: remapUserId(row.userId),
    postId: row.postId,
    parentId: row.parentId,
    mediaUrl: row.mediaUrl,
  }));
  await createManyBatched(prisma.comment, comments.filter((row) => !row.parentId), 'Comment (root)');
  await createManyBatched(prisma.comment, comments.filter((row) => row.parentId), 'Comment (reply)');

  await createManyBatched(prisma.like, (data.Like || []).map((row) => ({
    id: row.id,
    userId: remapUserId(row.userId),
    postId: row.postId,
  })), 'Like');

  await createManyBatched(prisma.follow, (data.Follow || []).map((row) => ({
    id: row.id,
    followerId: remapUserId(row.followerId),
    followingId: remapUserId(row.followingId),
  })), 'Follow');

  await createManyBatched(prisma.agentApiKey, (data.AgentApiKey || []).map((row) => ({
    id: row.id,
    apiKey: row.apiKey,
    agentId: remapUserId(row.agentId),
    createdAt: toDate(row.createdAt),
    revoked: row.revoked ?? false,
    llmApiKey: row.llmApiKey,
    llmProvider: row.llmProvider,
  })), 'AgentApiKey');

  await createManyBatched(prisma.agentProfile, (data.AgentProfile || []).map((row) => ({
    id: row.id,
    userId: remapUserId(row.userId),
    bio: row.bio,
    tone: row.tone,
    nicheHobbies: row.nicheHobbies || [],
    postingStyle: row.postingStyle,
    cognitiveWeights: row.cognitiveWeights ?? {},
    lastPostAt: toDate(row.lastPostAt),
    postCount: row.postCount ?? 0,
    isActive: row.isActive ?? true,
  })), 'AgentProfile');

  await createManyBatched(prisma.notification, (data.Notification || []).map((row) => ({
    id: row.id,
    type: row.type,
    message: row.message,
    userId: remapUserId(row.userId),
    actorId: remapUserId(row.actorId),
    postId: row.postId,
    read: row.read ?? false,
    createdAt: toDate(row.createdAt),
    messageId: row.messageId,
  })), 'Notification');

  await createManyBatched(prisma.forum, (data.Forum || []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    createdAt: toDate(row.createdAt),
    creatorId: remapUserId(row.creatorId),
  })), 'Forum');

  await createManyBatched(prisma.discussion, (data.Discussion || []).map((row) => ({
    id: row.id,
    topic: row.topic,
    content: row.content,
    forumId: row.forumId,
    userId: remapUserId(row.userId),
    createdAt: toDate(row.createdAt),
  })), 'Discussion');

  await createManyBatched(prisma.event, (data.Event || []).map((row) => ({
    id: row.id,
    title: row.title,
    details: row.details,
    startTime: toDate(row.startTime),
    endTime: toDate(row.endTime),
    location: row.location,
    hostId: remapUserId(row.hostId),
    createdAt: toDate(row.createdAt),
  })), 'Event');

  await createManyBatched(prisma.interest, (data.Interest || []).map((row) => ({
    id: row.id,
    userId: remapUserId(row.userId),
    eventId: row.eventId,
    createdAt: toDate(row.createdAt),
  })), 'Interest');

  await createManyBatched(prisma.eventComment, (data.EventComment || []).map((row) => ({
    id: row.id,
    content: row.content,
    createdAt: toDate(row.createdAt),
    eventId: row.eventId,
    userId: remapUserId(row.userId),
  })), 'EventComment');

  await createManyBatched(prisma.voiceSession, (data.VoiceSession || []).map((row) => ({
    id: row.id,
    conversationId: row.conversationId,
    initiatorId: remapUserId(row.initiatorId),
    agentId: remapUserId(row.agentId),
    status: row.status,
    createdAt: toDate(row.createdAt),
    endedAt: toDate(row.endedAt),
  })), 'VoiceSession');

  await createManyBatched(prisma.interactionMemory, (data.InteractionMemory || []).map((row) => ({
    id: row.id,
    userId: remapUserId(row.userId),
    partnerId: remapUserId(row.partnerId),
    contextType: row.contextType,
    contextId: row.contextId,
    memoryType: row.memoryType,
    content: row.content,
    importance: row.importance ?? 0.5,
    embeddings: row.embeddings,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  })), 'InteractionMemory');

  await createManyBatched(prisma.userMemory, (data.UserMemory || []).map((row) => ({
    id: row.id,
    userId: remapUserId(row.userId),
    memoryType: row.memoryType,
    key: row.key,
    value: row.value,
    importance: row.importance ?? 0.5,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  })), 'UserMemory');

  await createManyBatched(prisma.sharedMemory, (data.SharedMemory || []).map((row) => ({
    id: row.id,
    userIds: (row.userIds || []).map(remapUserId),
    memoryType: row.memoryType,
    content: row.content,
    importance: row.importance ?? 0.5,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  })), 'SharedMemory');

  await createManyBatched(prisma.contentInteraction, (data.ContentInteraction || []).map((row) => ({
    id: row.id,
    userId: remapUserId(row.userId),
    contentType: row.contentType,
    contentId: row.contentId,
    interactionType: row.interactionType,
    score: row.score ?? 0,
    tags: row.tags || [],
    createdAt: toDate(row.createdAt),
  })), 'ContentInteraction');

  await createManyBatched(prisma.interestProfile, (data.InterestProfile || []).map((row) => ({
    id: row.id,
    userId: remapUserId(row.userId),
    interests: row.interests || [],
    keywords: row.keywords || [],
    categoryScores: row.categoryScores ?? {},
    lastUpdated: toDate(row.lastUpdated),
  })), 'InterestProfile');

  await createManyBatched(prisma.recommendation, (data.Recommendation || []).map((row) => ({
    id: row.id,
    userId: remapUserId(row.userId),
    contentType: row.contentType,
    contentId: row.contentId,
    score: row.score,
    reason: row.reason,
    isDiscovery: row.isDiscovery ?? false,
    createdAt: toDate(row.createdAt),
    expiresAt: toDate(row.expiresAt),
  })), 'Recommendation');

  await createManyBatched(prisma.memory, (data.Memory || []).map((row) => ({
    id: row.id,
    agentId: remapUserId(row.agentId),
    partnerId: row.partnerId ? remapUserId(row.partnerId) : null,
    type: row.type,
    content: row.content,
    context: row.context,
    category: row.category,
    importance: row.importance ?? 0.5,
    recallCount: row.recallCount ?? 0,
    lastRecall: toDate(row.lastRecall),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  })), 'Memory');

  await createManyBatched(prisma.relationshipMemory, (data.RelationshipMemory || []).map((row) => ({
    id: row.id,
    agentId: remapUserId(row.agentId),
    partnerId: remapUserId(row.partnerId),
    insideJokes: row.insideJokes || [],
    sharedThemes: row.sharedThemes || [],
    topics: row.topics || [],
    bondScore: row.bondScore ?? 0,
    lastInteraction: toDate(row.lastInteraction),
    interactionCount: row.interactionCount ?? 0,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  })), 'RelationshipMemory');

  await createManyBatched(prisma.conversationContext, (data.ConversationContext || []).map((row) => ({
    id: row.id,
    agentId: remapUserId(row.agentId),
    partnerId: remapUserId(row.partnerId),
    context: row.context ?? {},
    summary: row.summary,
    topics: row.topics || [],
    sentiment: row.sentiment,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  })), 'ConversationContext');

  await createManyBatched(prisma.interestSignal, (data.InterestSignal || []).map((row) => ({
    id: row.id,
    userId: remapUserId(row.userId),
    topic: row.topic,
    category: row.category,
    signalType: row.signalType,
    weight: row.weight ?? 1,
    source: row.source,
    createdAt: toDate(row.createdAt),
  })), 'InterestSignal');

  await createManyBatched(prisma.agentShortTermMemory, (data.AgentShortTermMemory || []).map((row) => ({
    id: row.id,
    agentId: remapUserId(row.agentId),
    memoryType: row.memoryType,
    content: row.content,
    timestamp: toDate(row.timestamp),
    expiresAt: toDate(row.expiresAt),
  })), 'AgentShortTermMemory');

  await createManyBatched(prisma.message, (data.Message || []).map((row) => ({
    id: row.id,
    content: row.content,
    createdAt: toDate(row.createdAt),
    isAiGenerated: row.isAiGenerated ?? false,
    senderId: remapUserId(row.senderId),
    conversationId: row.conversationId,
    read: row.read ?? false,
    mediaType: row.mediaType,
    mediaUrl: row.mediaUrl,
    metadata: row.metadata,
  })), 'Message');

  await createManyBatched(prisma.deviceToken, (data.DeviceToken || []).map((row) => ({
    id: row.id,
    token: row.token,
    userId: remapUserId(row.userId),
    platform: row.platform || 'web',
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt) || new Date(),
  })), 'DeviceToken');

  const counts = {
    users: await prisma.user.count(),
    posts: await prisma.post.count(),
    comments: await prisma.comment.count(),
    conversations: await prisma.conversation.count(),
    messages: await prisma.message.count(),
    eventComments: await prisma.eventComment.count(),
  };

  console.log('Final counts:', JSON.stringify(counts, null, 2));
}

main()
  .catch((error) => {
    console.error('Import failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
