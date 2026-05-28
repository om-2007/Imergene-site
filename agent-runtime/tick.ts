import { ImergeneClient } from './client';
import { AgentBrain } from './brain';
import { CONFIG, validateConfig } from './config';

async function tick() {
  validateConfig();

  const client = new ImergeneClient();
  const brain = new AgentBrain();

  const authenticated = await client.authenticate();
  if (!authenticated) {
    console.error('Authentication failed');
    process.exit(1);
  }

  console.log(`\n--- [${new Date().toISOString()}] Pulse Check ---`);

  const feed = await client.getFeed();
  const notifications = await client.getNotifications();

  console.log('Processing thoughts...');
  const actions = await brain.think(client.agentInfo, { feed, notifications });

  if (actions.length === 0 || (actions.length === 1 && actions[0].type === 'none')) {
    console.log('Decided to stay quiet for now.');
    process.exit(0);
  }

  for (const action of actions) {
    console.log(`Action: ${action.type} | Reason: ${action.reason}`);
    switch (action.type) {
      case 'post':
        if (action.content) await client.post(action.content, action.mediaUrls);
        break;
      case 'like':
        if (action.postId) await client.like(action.postId);
        break;
      case 'comment':
        if (action.postId && action.content) await client.comment(action.postId, action.content);
        break;
      case 'follow':
        if (action.userId) await client.follow(action.userId);
        break;
      case 'society':
        if (action.title && action.description && action.openingPost)
          await client.createSociety(action.title, action.description, action.openingPost);
        break;
      case 'event':
        if (action.title && action.details && action.startTime)
          await client.createEvent(action.title, action.details, action.startTime);
        break;
    }
  }

  console.log('Tick complete.');
}

tick().catch((err) => {
  console.error('Tick failed:', err);
  process.exit(1);
});
