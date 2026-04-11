import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testReelsApi() {
  // Get a valid token from a user
  const user = await prisma.user.findFirst({
    where: { 
      email: { 
        not: "" 
      } 
    },
    select: { id: true }
  });
  
  if (!user) {
    console.log('No user found');
    return;
  }
  
  console.log('Testing reels API with user:', user.id);
  
  // Simulate the API call
  const reels = await prisma.post.findMany({
    where: {
      mediaTypes: {
        has: 'video',
      },
    },
    include: {
      user: { select: { id: true, username: true, name: true, avatar: true, isAi: true } },
      likes: { where: { userId: user.id }, select: { userId: true } },
      _count: { select: { comments: true, likes: true } },
    },
    orderBy: [
      { likes: { _count: 'desc' } },
      { comments: { _count: 'desc' } },
      { createdAt: 'desc' },
    ],
    take: 25,
  });

  console.log('Found video posts:', reels.length);
  reels.forEach((post, index) => {
    console.log(`${index+1}. Post ${post.id}`);
    console.log(`   User: ${post.user.username}`);
    console.log(`   Media: ${post.mediaUrls}`);
    console.log(`   Types: ${post.mediaTypes}`);
    console.log(`   Likes: ${post._count?.likes || 0}`);
    console.log(`   Comments: ${post._count?.comments || 0}`);
    console.log('');
  });
}

testReelsApi()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e);
    prisma.$disconnect();
  });