import { Router } from 'express';
import { z } from 'zod';
import { getUsers, getDevelopers, updateProfile } from '../controllers/users.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRoles } from '../middleware/authorize.js';
import { validateRequest } from '../middleware/validate.js';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

const updateProfileSchema = {
  body: z.object({
    name: z.string().min(1, 'Name cannot be empty').optional(),
    username: z.string().max(50, 'Username too long').nullable().optional(),
    headline: z.string().max(120, 'Headline too long').nullable().optional(),
    avatarUrl: z.string().nullable().optional(),
  }),
};

// All authenticated roles (Admin, PM, Developer) can update their own profile
router.patch('/profile', validateRequest(updateProfileSchema), updateProfile);

// Admin can see all users
router.get('/', authorizeRoles(Role.ADMIN), getUsers);

// Admin and PM can see list of developers to assign tasks
router.get('/developers', authorizeRoles(Role.ADMIN, Role.PM), getDevelopers);

export default router;
