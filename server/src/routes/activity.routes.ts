import { Router } from 'express';
import { getActivityFeed } from '../controllers/activity.controller.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

router.use(authenticate);

router.get('/', getActivityFeed);

export default router;
