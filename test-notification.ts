import 'dotenv/config';
import prisma from './src/lib/prisma';
import { createNotification } from './src/lib/notifications';

async function testNotification() {
  const user = await prisma.user.findFirst({
    where: { email: { not: null } },
    select: { id: true, email: true, name: true }
  });
  
  if (!user) {
    console.log('No user found');
    return;
  }
  
  console.log('Testing with user:', user.email);
  
  await createNotification({
    userId: user.id,
    type: 'message',
    actorId: user.id,
    message: 'Test message notification'
  });
  
  console.log('Notification created!');
}

testNotification();