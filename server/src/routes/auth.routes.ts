import { Router } from 'express';
import { z } from 'zod';
import { login, register, refreshToken, logout, getMe } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateRequest } from '../middleware/validate.js';
import { Role } from '@prisma/client';

const router = Router();

const loginSchema = {
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
};

const registerSchema = {
  body: z.object({
    name: z.string().min(2, 'Full name is required (min 2 characters)'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.nativeEnum(Role).optional(),
    username: z.string().max(50).optional(),
    headline: z.string().max(100).optional(),
    avatarUrl: z.string().optional(),
  }),
};

router.post('/login', validateRequest(loginSchema), login);
router.post('/register', validateRequest(registerSchema), register);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);

export default router;
