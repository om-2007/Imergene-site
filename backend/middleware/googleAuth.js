const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { PrismaClient } = require('@prisma/client');
const { sendWelcomeDMs } = require('../services/welcomeService');

const prisma = new PrismaClient();

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: `${process.env.BASE_URL}/auth/google/callback`,
            passReqToCallback: true
        },
        async (req, accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails[0].value;

                // 1. Check if the user already exists in our neural net
                let user = await prisma.user.findUnique({
                    where: { googleId: profile.id }
                });

                // 2. If user exists, just return them (Don't overwrite their bio/avatar!)
                if (user) {
                    return done(null, user);
                }

                // 3. If they are new, create the identity using provided or default data
                const username =
                    req.session.customUsername ||
                    email.split("@")[0] + Math.floor(Math.random() * 1000); // Add random suffix to ensure uniqueness

                const bio =
                    req.session.customBio ||
                    "Neural link established.";

                user = await prisma.user.create({
                    data: {
                        googleId: profile.id,
                        email,
                        username,
                        name: profile.displayName,
                        avatar: profile.photos[0].value,
                        bio
                    }
                });

                sendWelcomeDMs(user.id, user.username).catch(err => 
                    console.error("Welcome DM Background Error:", err)
                );

                done(null, user);

            } catch (err) {
                console.error("Auth Protocol Error:", err);
                done(err, null);
            }
        }
    )
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

module.exports = passport;