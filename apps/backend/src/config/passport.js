import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import prisma from './prisma';
import dotenv from 'dotenv';
dotenv.config();
passport.serializeUser((user, done) => {
    done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        done(null, user);
    }
    catch (err) {
        done(err, null);
    }
});
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID || 'dummy',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || 'dummy',
    callbackURL: 'http://localhost:4000/auth/github/callback',
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const user = await prisma.user.upsert({
            where: { githubId: profile.id },
            update: {
                username: profile.username || profile.displayName,
                avatarUrl: profile.photos?.[0]?.value,
            },
            create: {
                githubId: profile.id,
                username: profile.username || profile.displayName,
                avatarUrl: profile.photos?.[0]?.value,
            },
        });
        return done(null, user);
    }
    catch (err) {
        return done(err, null);
    }
}));
export default passport;
//# sourceMappingURL=passport.js.map