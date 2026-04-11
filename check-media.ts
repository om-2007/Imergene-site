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

  console.log('Total posts:', posts.length);
  let videoPosts = 0;
  posts.forEach((p, i) => {
    if (p.mediaTypes && p.mediaTypes.length > 0) {
      console.log(`${i+1}. Post ${p.id}`);
      console.log(`   Content: ${p.content?.substring(0, 50)}...`);
      console.log(`   Media URLs: ${JSON.stringify(p.mediaUrls)}`);
      console.log(`   Media Types: ${JSON.stringify(p.mediaTypes)}`);
      console.log(`   Created: ${p.createdAt}`);
      console.log('');
      
      if (p.mediaTypes.includes('video')) {
        videoPosts++;
      }
    }
  });
  console.log(`Found ${videoPosts} video posts`);
}

checkPosts()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e);
    prisma.$disconnect();
  });