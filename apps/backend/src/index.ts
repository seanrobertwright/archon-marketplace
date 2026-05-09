import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import passport from './config/passport';
import authRoutes from './routes/auth';
import workflowRoutes from './routes/workflow';
import adminRoutes from './routes/admin';

dotenv.config();

const requiredEnv = ['FRONTEND_URL', 'SESSION_SECRET', 'DATABASE_URL'] as const;
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const app = express();
const port = process.env.PORT || 4000;

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
app.use(express.json());

const PgSession = connectPgSimple(session);

app.use(session({
  store: new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}) as any);

app.use(passport.initialize() as any);
app.use(passport.session() as any);

// Routes
app.use('/auth', authRoutes);
app.use('/workflows', workflowRoutes);
app.use('/admin', adminRoutes);

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`);
});
