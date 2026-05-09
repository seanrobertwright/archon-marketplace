import { Router } from 'express';
import passport from '../config/passport';
import prisma from '../config/prisma';
import { isAuthenticated } from '../middleware/auth';

const router = Router();

router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

router.get(
  '/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  (req, res) => {
    // Successful authentication, redirect to frontend.
    res.redirect(process.env.FRONTEND_URL!);
  }
);

router.get('/logout', (req, res) => {
  req.logout(() => {
    res.json({ message: 'Logged out' });
  });
});

router.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json(req.user);
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

router.post('/request-access', isAuthenticated, async (req, res) => {
  try {
    const userId = (req.user as any).id;
    const user = await prisma.user.update({
      where: { id: userId },
      data: { submissionStatus: 'PENDING' }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to request access' });
  }
});

export default router;
