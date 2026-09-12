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
    },
    orderBy: { name: 'asc' },
  });

  return res.json({
    success: true,
    data: { developers },
  });
};
