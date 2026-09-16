import { Response } from 'express';
import { prisma } from '../config/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';

export const getNotifications = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;

  const whereClause: any = { userId: user.userId };

  // Strict role scoping per specification:
  // 1. Admin: ONLY receives notifications about project completion status
  if (user.role === 'ADMIN') {
    whereClause.title = { contains: 'Project Completed' };
  }
  // 2. PM: ONLY receives notifications about project status and task review/overdue status
  else if (user.role === 'PM') {
    whereClause.title = {
      in: [
        'Project Completed! 🎉',
        'Project Completed',
        'Task Ready for Review',
        'Task Overdue Alert',
        'Task Changes Requested',
      ],
    };
  }
  // 3. Developer: ONLY receives notifications for assigned tasks, changes requested, or overdue
  else if (user.role === 'DEVELOPER') {
    whereClause.title = {
      in: [
        'New Task Assigned',
        'Task Changes Requested',
        'Task Overdue Alert',
      ],
    };
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        task: { select: { id: true, title: true, projectId: true } },
      },
    }),
    prisma.notification.count({
      where: { ...whereClause, isRead: false },
    }),
  ]);

  return res.json({
    success: true,
    data: {
      notifications,
      unreadCount,
    },
  });
};

export const markNotificationRead = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;

  const notification = await prisma.notification.findUnique({
    where: { id },
  });

  if (!notification) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Notification not found' },
    });
  }

  if (notification.userId !== user.userId) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Cannot mark another user\'s notification as read' },
    });
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });

  const unreadCount = await prisma.notification.count({
    where: { userId: user.userId, isRead: false },
  });

  return res.json({
    success: true,
    data: {
      notification: updated,
      unreadCount,
    },
  });
};

export const markAllNotificationsRead = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;

  const whereClause: any = { userId: user.userId, isRead: false };
  if (user.role === 'ADMIN') {
    whereClause.title = { contains: 'Project Completed' };
  } else if (user.role === 'PM') {
    whereClause.title = {
      in: [
        'Project Completed! 🎉',
        'Project Completed',
        'Task Ready for Review',
        'Task Overdue Alert',
        'Task Changes Requested',
      ],
    };
  } else if (user.role === 'DEVELOPER') {
    whereClause.title = {
      in: [
        'New Task Assigned',
        'Task Changes Requested',
        'Task Overdue Alert',
      ],
    };
  }

  await prisma.notification.updateMany({
    where: whereClause,
    data: { isRead: true },
  });

  return res.json({
    success: true,
    data: { unreadCount: 0 },
    message: 'All notifications marked as read',
  });
};

