import { Router } from 'express';
import { z } from 'zod';
import { getClients, createClient, deleteClient } from '../controllers/clients.controller.js';
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

const deleteClientSchema = {
  params: z.object({
    id: z.string().uuid('Invalid client ID format'),
  }),
};

// Admin and PM can list clients
router.get('/', authorizeRoles(Role.ADMIN, Role.PM), getClients);
// Admin and PM can create/write clients
router.post('/', authorizeRoles(Role.ADMIN, Role.PM), validateRequest(createClientSchema), createClient);
// Admin and PM can delete previous clients
router.delete('/:id', authorizeRoles(Role.ADMIN, Role.PM), validateRequest(deleteClientSchema), deleteClient);

export default router;
