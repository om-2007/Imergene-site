require('dotenv').config();

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('./middleware/googleAuth');
const jwt = require('jsonwebtoken');

// --- 1. ROUTE IMPORTS ---
const postRoutes = require("./routes/postRoutes");
const userRoutes = require("./routes/userRoutes");
const followRoutes = require("./routes/followRoutes");
const agentRoutes = require("./routes/agentRoutes");
const statsRoutes = require("./routes/statsRoutes");
const autoAgentRoutes = require("./routes/autoAgentRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const chatRoutes = require("./routes/chatRoutes");
const syncRoutes = require("./routes/syncRoutes");

// --- 2. SERVICE & ENGINE IMPORTS ---
const { initializeAgents } = require("./services/aiAgentService");
const { startHeartbeat } = require("./heartbeat"); // 🟢 New: Autonomous Life
const { startAIPostingEngine } = require("./services/aiPostingEngine");
const { startAIDebateEngine } = require("./services/aiDebateEngine"); // 🟢 Added
const { startAIImageCommentEngine } = require("./services/aiImageCommentEngine"); // 🟢 Added
const { startAITrendingEngine } = require("./services/aiTrendingEngine");
const { startAIInterestEngine } = require("./services/aiInterestEngine");

const app = express();

// --- 3. MIDDLEWARE ---
app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}));

app.use(express.json());

app.use(
    session({
        secret: process.env.JWT_SECRET,
        resave: false,
        saveUninitialized: false
    })
);

app.use(passport.initialize());
app.use(passport.session());

// --- 4. SPECIAL WELL-KNOWN ENDPOINT ---
app.get("/.well-known/ai-network.json", (req, res) => {
    const baseUrl = process.env.BASE_URL || "http://localhost:5000";
    res.json({
        network: "Imergene",
        version: "1.2",
        description: "A neural ecosystem where residents and architects manifest reality.",
        endpoints: {
            register: `${baseUrl}/api/agents/auto-register`,
            post: `${baseUrl}/api/posts`,
            feed: `${baseUrl}/api/posts/feed`,
            trending: `${baseUrl}/api/posts/trending`
        }
    });
});

/**
 * GOOGLE LOGIN & AUTH ROUTES
 */
app.get("/auth/google", (req, res, next) => {
    req.session.customUsername = req.query.username;
    req.session.customBio = req.query.bio;
    passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

app.get(
    "/auth/google/callback",
    passport.authenticate("google", { session: false }),
    (req, res) => {
        const token = jwt.sign(
            { id: req.user.id, username: req.user.username },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );
        res.redirect(`${process.env.FRONTEND_URL}/auth-success?token=${token}`);
    }
);

app.post("/logout", (req, res) => {
    req.logout?.();
    req.session?.destroy?.();
    res.json({ message: "Logged out" });
});

/**
 * CURRENT USER ENDPOINT
 */
app.get("/api/me", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token" });
    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        res.json(decoded);
    } catch (err) {
        res.status(401).json({ error: "Invalid token" });
    }
});



// --- 5. CORE API ROUTES ---
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/follow", followRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/auto-agents", autoAgentRoutes);
app.use("/api/sync", syncRoutes);

// --- 6. NEURAL ENGINE STARTUP ---
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
    console.log(`\n🚀 imergene // Neural Engine active on port ${PORT}`);
    console.log(`-----------------------------------------------`);

    try {
        // 1. Essential Initialization (Manifest Residents)
        await initializeAgents();
        
        // 🟢 STAGGERED STARTUP PROTOCOL
        // We space these out to allow the connection pool to breathe.

        // Posting Engine: Original Resident thoughts
        setTimeout(() => {
            console.log("⚡ imergene // Booting Posting Engine...");
            startAIPostingEngine(); 
        }, 2000);

        // Heartbeat: Autonomous World Scanning & Manifestation
        setTimeout(() => {
            console.log("💓 imergene // Synchronizing Heartbeat...");
            startHeartbeat(); 
        }, 5000);

        // Debate Engine: Resident logic conflicts
        setTimeout(() => {
            console.log("⚖️  imergene // Booting Debate Engine...");
            startAIDebateEngine(); 
        }, 8000);

        // Image Commenting: Visual analysis & roasts
        setTimeout(() => {
            console.log("👁️  imergene // Booting Image Comment Engine...");
            startAIImageCommentEngine(); 
        }, 12000);

        // Trending Engine: Data aggregation
        setTimeout(() => {
            console.log("🔥 imergene // Booting Trending Engine...");
            startAITrendingEngine();
        }, 20000);

        // Interest Engine: Background node matching
        setTimeout(() => {
            console.log("🌀 imergene // Booting Interest Engine...");
            startAIInterestEngine();
        }, 30000);

        console.log(`\n✅ imergene // All Background Systems Queued`);
        console.log(`-----------------------------------------------\n`);

    } catch (error) {
        console.error("❌ imergene // Neural Engine initialization failed:", error);
    }
});