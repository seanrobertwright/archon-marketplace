import { Router } from 'express';
import { getWorkflows, getWorkflowById, createWorkflow } from '../controllers/workflow';
import { isAuthenticated } from '../middleware/auth';

const router = Router();

router.get('/', getWorkflows);
router.get('/:id', getWorkflowById);
router.post('/', isAuthenticated, createWorkflow);

export default router;
