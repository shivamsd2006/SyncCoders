import { Response } from 'express';
import { Role } from '@prisma/client';
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
