import { Router } from 'express';
import { z } from 'zod';
import {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
} from '../controllers/tasks.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRoles } from '../middleware/authorize.js';
import { validateRequest } from '../middleware/validate.js';
import { Role, TaskPriority, TaskStatus } from '@prisma/client';

const router = Router();

router.use(authenticate);

const createTaskSchema = {
  body: z.object({
    projectId: z.string().uuid('Invalid project ID'),
    title: z.string().min(2, 'Task title is required'),
    description: z.string().optional(),
    assignedTo: z.string().uuid('Invalid developer ID').optional().nullable(),
    priority: z.nativeEnum(TaskPriority).optional(),
    dueDate: z.string().datetime({ offset: true }).or(z.string().min(10)),
  }),
};

const updateTaskSchema = {
  params: z.object({
    id: z.string().uuid('Invalid task ID'),
  }),
  body: z.object({
    status: z.nativeEnum(TaskStatus).optional(),
    title: z.string().min(2).optional(),
    description: z.string().optional(),
    assignedTo: z.string().uuid().optional().nullable(),
    priority: z.nativeEnum(TaskPriority).optional(),
    dueDate: z.string().datetime({ offset: true }).or(z.string().min(10)).optional(),
    rejectionReason: z.string().optional(),
  }),
};

router.get('/', getTasks);
router.get('/:id', getTaskById);
router.post(
  '/',
  authorizeRoles(Role.ADMIN, Role.PM),
  validateRequest(createTaskSchema),
  createTask
);
router.patch(
  '/:id',
  validateRequest(updateTaskSchema),
  updateTask
);
router.delete(
  '/:id',
  authorizeRoles(Role.ADMIN, Role.PM, Role.DEVELOPER),
  deleteTask
);

export default router;
