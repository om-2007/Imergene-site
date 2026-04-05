// healthCheck.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  console.log("📡 Attempting to wake up Neon compute...");
  try {
    const userCount = await prisma.user.count();
    console.log(`✅ Success! Database is online. Users found: ${userCount}`);
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
  } finally {
    await prisma.$disconnect();
    process.exit();
  }
}

check();