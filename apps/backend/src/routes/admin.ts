import { Router } from 'express';
import { isAdmin } from '../middleware/auth';
import prisma from '../config/prisma';

const router = Router();

// 1. User Management
router.get('/pending-users', isAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { submissionStatus: 'PENDING' }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending users' });
  }
});

router.post('/users/:id/resolve', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'APPROVED' or 'REJECTED'
    
    const user = await prisma.user.update({
      where: { id },
      data: { submissionStatus: status }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve user request' });
  }
});

// 2. Workflow Moderation
router.get('/quarantined-workflows', isAdmin, async (req, res) => {
  try {
    const workflows = await prisma.workflow.findMany({
      where: { status: 'QUARANTINED' },
      include: {
        author: { select: { username: true } }
      }
    });
    res.json(workflows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch quarantined workflows' });
  }
});

router.post('/workflows/:id/resolve', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'PUBLISHED' or 'REJECTED'
    
    const workflow = await prisma.workflow.update({
      where: { id },
      data: { status }
    });
    res.json(workflow);
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve workflow' });
  }
});

export default router;
