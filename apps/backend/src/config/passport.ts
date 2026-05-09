import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import prisma from './prisma';
import dotenv from 'dotenv';

dotenv.config();

const requiredOAuthEnv = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'BACKEND_URL'] as const;
for (const key of requiredOAuthEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      callbackURL: `${process.env.BACKEND_URL}/auth/github/callback`,
    },
    async (accessToken: string, refreshToken: string, profile: any, done: any) => {
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
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

export default passport;
