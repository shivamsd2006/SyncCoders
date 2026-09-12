import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';

export const getActivityFeed = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const limit = req.query.limit ? Math.min(parseInt(req.query.limit as string, 10), 100) : 20;

  const where: Prisma.TaskActivityLogWhereInput = {};

  // 1. Role-based scoping of historical activity feed
  if (user.role === 'DEVELOPER') {
    // Developer sees activity only on tasks currently or previously assigned to them
    where.task = { assignedTo: user.userId };
  } else if (user.role === 'PM') {
    // PM sees activity only from their own projects
    where.task = {
      project: { createdBy: user.userId },
    };
  }
  // Admin sees activity across all projects (no filter on where)

  const logs = await prisma.taskActivityLog.findMany({
    where,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      task: {
        select: {
          id: true,
          title: true,
          projectId: true,
          project: { select: { id: true, title: true } },
        },
      },
    },
  });

  return res.json({
    success: true,
    data: {
      activities: logs.map((log) => ({
        id: log.id,
        taskId: log.taskId,
        taskTitle: log.task.title,
        projectId: log.task.projectId,
        projectName: log.task.project.title,
        userId: log.userId,
        userName: log.user.name,
        oldStatus: log.oldStatus,
        newStatus: log.newStatus,
        formattedMessage: log.formattedMessage,
        createdAt: log.createdAt.toISOString(),
      })),
    },
  });
};
