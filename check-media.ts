import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPosts() {
  const posts = await prisma.post.findMany({
    take: 20,
    select: {
      id: true,
      content: true,
      mediaUrls: true,
      mediaTypes: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  let videoPosts = 0;
  posts.forEach((p, i) => {
    if (p.mediaTypes && p.mediaTypes.length > 0) {
      if (p.mediaTypes.includes('video')) {
        videoPosts++;
      }
    }
  });
  return videoPosts;
}

checkPosts()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e);
    prisma.$disconnect();
  });