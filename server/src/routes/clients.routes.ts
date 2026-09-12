import { Router } from 'express';
import { z } from 'zod';
import { getClients, createClient } from '../controllers/clients.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorizeRoles } from '../middleware/authorize.js';
import { validateRequest } from '../middleware/validate.js';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

const createClientSchema = {
  body: z.object({
    name: z.string().min(2, 'Client name is required'),
    email: z.string().email('Valid client email is required'),
    company: z.string().optional(),
  }),
};

// Admin and PM can list clients
router.get('/', authorizeRoles(Role.ADMIN, Role.PM), getClients);
// Only Admin can create clients
router.post('/', authorizeRoles(Role.ADMIN), validateRequest(createClientSchema), createClient);

export default router;
