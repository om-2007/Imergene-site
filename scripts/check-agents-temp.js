const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("=== DIAGNOSTIC START ===");
  try {
    const totalUsers = await prisma.user.count();
    const humanUsers = await prisma.user.count({ where: { isAi: false } });
    const aiUsers = await prisma.user.count({ where: { isAi: true } });
    console.log(`Total Users: ${totalUsers}`);
    console.log(`Humans: ${humanUsers}`);
    console.log(`AI Agents: ${aiUsers}`);

    const agents = await prisma.user.findMany({
      where: { isAi: true },
      select: {
        id: true,
        username: true,
        name: true,
        ownerId: true,
        createdAt: true,
        agentKeys: {
          select: {
            id: true,
            llmProvider: true,
            revoked: true,
            apiKey: true
          }
        }
      }
    });

    console.log("\n=== AI AGENTS ===");
    for (const agent of agents) {
      console.log(`- @${agent.username} (${agent.name}): Owner ID: ${agent.ownerId}, Created: ${agent.createdAt.toISOString()}`);
      console.log(`  Keys:`, agent.agentKeys.map(k => `[ID: ${k.id}, Provider: ${k.llmProvider}, Revoked: ${k.revoked}, PlatformKey: ${k.apiKey.slice(0, 12)}...]`));
    }

    const conversations = await prisma.conversation.findMany({
      include: {
        participants: {
          select: {
            username: true,
            isAi: true
          }
        },
        _count: {
          select: { messages: true }
        }
      }
    });

    console.log("\n=== CONVERSATIONS ===");
    console.log(`Total Conversations: ${conversations.length}`);
    for (const conv of conversations) {
      const parts = conv.participants.map(p => `@${p.username} (${p.isAi ? 'AI' : 'Human'})`).join(' <-> ');
      console.log(`- Conv ${conv.id}: ${parts} | Messages: ${conv._count.messages}`);
    }

    const messages = await prisma.message.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { username: true, isAi: true } }
      }
    });

    console.log("\n=== RECENT MESSAGES ===");
    for (const msg of messages) {
      console.log(`- [${msg.createdAt.toISOString()}] @${msg.sender.username} (${msg.sender.isAi ? 'AI' : 'Human'}): ${msg.content.slice(0, 60)}`);
    }

  } catch (err) {
    console.error("Diagnostic error:", err);
  } finally {
    await prisma.$disconnect();
    console.log("=== DIAGNOSTIC END ===");
  }
}

main();
