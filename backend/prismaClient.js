// backend/prismaClient.js
const { PrismaClient } = require('@prisma/client');

// Prevents multiple instances during Hot Reloading and Engine loops
const prisma = global.prisma || new PrismaClient({
  log: ['error'], // Reduce logging overhead
});

if (process.env.NODE_ENV !== 'production') global.prisma = prisma;

module.exports = prisma;