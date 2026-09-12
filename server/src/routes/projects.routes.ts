import { Router } from 'express';
import { z } from 'zod';
import {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
} from '../controllers/projects.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRoles } from '../middleware/authorize.js';
import { validateRequest } from '../middleware/validate.js';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

const createProjectSchema = {
  body: z.object({
    title: z.string().min(3, 'Project title must be at least 3 characters'),
    description: z.string().optional(),
    clientId: z.string().uuid('Invalid client ID format'),
  }),
};

const updateProjectSchema = {
  params: z.object({
    id: z.string().uuid('Invalid project ID'),
  }),
  body: z.object({
    title: z.string().min(3).optional(),
    description: z.string().optional(),
    clientId: z.string().uuid().optional(),
  }),
};

router.get('/', getProjects);
router.get('/:id', getProjectById);
router.post(
  '/',
  authorizeRoles(Role.ADMIN, Role.PM),
  validateRequest(createProjectSchema),
  createProject
);
router.patch(
  '/:id',
  authorizeRoles(Role.ADMIN, Role.PM),
  validateRequest(updateProjectSchema),
  updateProject
);
router.delete(
  '/:id',
  authorizeRoles(Role.ADMIN, Role.PM),
  deleteProject
);

export default router;
