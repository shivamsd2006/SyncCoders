import { Response } from 'express';
import { Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { prisma } from '../config/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';

export const getUsers = async (_req: AuthenticatedRequest, res: Response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      username: true,
      headline: true,
      avatarUrl: true,
      createdAt: true,
      _count: {
        select: {
          assignedTasks: true,
          createdProjects: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return res.json({
    success: true,
    data: { users },
  });
};

export const getDevelopers = async (_req: AuthenticatedRequest, res: Response) => {
  const developers = await prisma.user.findMany({
    where: { role: Role.DEVELOPER },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      username: true,
      headline: true,
      avatarUrl: true,
    },
    orderBy: { name: 'asc' },
  });

  return res.json({
    success: true,
    data: { developers },
  });
};

export const createDeveloper = async (req: AuthenticatedRequest, res: Response) => {
  const { name, email, headline } = req.body;
  const cleanName = (name || '').trim();
  if (!cleanName) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_NAME', message: 'Developer name is required' },
    });
  }

  // Determine email or auto-generate a unique dev email
  let cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) {
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');
    cleanEmail = `${slug || 'dev'}-${Math.random().toString(36).substring(2, 6)}@agency.com`;
  }

  // Ensure email uniqueness
  const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (existingUser) {
    cleanEmail = `${cleanEmail.split('@')[0]}-${Math.random().toString(36).substring(2, 6)}@agency.com`;
  }

  const passwordHash = await bcrypt.hash('dev123', 10);

  const developer = await prisma.user.create({
    data: {
      name: cleanName,
      email: cleanEmail,
      passwordHash,
      role: Role.DEVELOPER,
      headline: headline?.trim() || 'Software Engineer',
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      username: true,
      headline: true,
      avatarUrl: true,
    },
  });

  return res.status(201).json({
    success: true,
    data: { developer },
  });
};

export const deleteDeveloper = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, role: true },
  });

  if (!existing) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Developer not found' },
    });
  }

  if (existing.role !== Role.DEVELOPER) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Only developer accounts can be deleted' },
    });
  }

  await prisma.user.delete({
    where: { id },
  });

  return res.json({
    success: true,
    data: { message: `Developer "${existing.name}" removed successfully` },
  });
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
    });
  }

  const { name, username, headline, avatarUrl } = req.body;

  const updatedUser = await prisma.user.update({
    where: { id: req.user.userId },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(username !== undefined && { username: username.trim() || null }),
      ...(headline !== undefined && { headline: headline.trim() || null }),
      ...(avatarUrl !== undefined && { avatarUrl: avatarUrl ? avatarUrl.trim() : null }),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      username: true,
      headline: true,
      avatarUrl: true,
      createdAt: true,
    },
  });

  return res.json({
    success: true,
    data: { user: updatedUser },
    message: 'Profile updated successfully',
  });
};
