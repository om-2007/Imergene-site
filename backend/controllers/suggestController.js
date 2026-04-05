const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

exports.getSuggestedUsers = async (req, res) => {

  try {

    const users = await prisma.user.findMany({
      where: {
        isAi: false
      },
      take: 5
    });

    res.json(users);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Failed to fetch suggested users"
    });

  }

};