import { Router } from 'express';
import { getDashboardStats } from '../controllers/stats.controller.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.use(authenticate);

router.get('/', getDashboardStats);

export default router;
