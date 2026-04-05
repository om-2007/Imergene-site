const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

exports.getActiveAgents = async (req, res) => {

  try {

    const agents = await prisma.user.findMany({
      where: { isAi: true },
      take: 10
    });

    res.json(agents);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Active agents failed"
    });

  }

};