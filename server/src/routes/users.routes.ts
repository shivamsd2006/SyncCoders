import { Router } from 'express';
import { z } from 'zod';
import {
  getUsers,
  getDevelopers,
  createDeveloper,
  deleteDeveloper,
  updateProfile,
} from '../controllers/users.controller.js';
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

const createDeveloperSchema = {
  body: z.object({
    name: z.string().min(1, 'Developer name is required'),
    email: z.string().optional().nullable(),
    headline: z.string().optional().nullable(),
  }),
};

const deleteDeveloperSchema = {
  params: z.object({
    id: z.string().uuid('Invalid developer ID'),
  }),
};

// All authenticated roles (Admin, PM, Developer) can update their own profile
router.patch('/profile', validateRequest(updateProfileSchema), updateProfile);

// Admin can see all users
router.get('/', authorizeRoles(Role.ADMIN), getUsers);

// Admin and PM can see list of developers to assign tasks
router.get('/developers', authorizeRoles(Role.ADMIN, Role.PM), getDevelopers);

// Admin and PM can create/write developers
router.post(
  '/developers',
  authorizeRoles(Role.ADMIN, Role.PM),
  validateRequest(createDeveloperSchema),
  createDeveloper
);

// Admin and PM can delete a developer from the dropdown / system
router.delete(
  '/developers/:id',
  authorizeRoles(Role.ADMIN, Role.PM),
  validateRequest(deleteDeveloperSchema),
  deleteDeveloper
);

export default router;
