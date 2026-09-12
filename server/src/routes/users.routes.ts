import { Router } from 'express';
import { getUsers, getDevelopers } from '../controllers/users.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRoles } from '../middleware/authorize.js';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

// Admin can see all users
router.get('/', authorizeRoles(Role.ADMIN), getUsers);

// Admin and PM can see list of developers to assign tasks
router.get('/developers', authorizeRoles(Role.ADMIN, Role.PM), getDevelopers);

export default router;
