import { Response } from 'express';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';
import { getOnlineCount } from '../sockets/socketManager.js';

export const getDashboardStats = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const now = new Date();

  if (user.role === 'ADMIN') {
    const [
      totalProjects,
      tasksByStatus,
      overdueTasksCount,
      totalUsers,
      totalClients,
    ] = await Promise.all([
      prisma.project.count(),
      prisma.task.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.task.count({
        where: { isOverdue: true, status: { not: TaskStatus.DONE } },
      }),
      prisma.user.count(),
      prisma.client.count(),
    ]);

    const statusCounts: Record<string, number> = {
      [TaskStatus.TODO]: 0,
      [TaskStatus.IN_PROGRESS]: 0,
      [TaskStatus.IN_REVIEW]: 0,
      [TaskStatus.DONE]: 0,
    };

    tasksByStatus.forEach((item) => {
      statusCounts[item.status] = item._count.id;
    });

    return res.json({
      success: true,
      data: {
        role: 'ADMIN',
        totalProjects,
        totalClients,
        totalUsers,
        tasksByStatus: statusCounts,
        overdueTasksCount,
        onlineUsersCount: getOnlineCount(),
      },
    });
  }

  if (user.role === 'PM') {
    // PM sees: their projects summary, tasks by priority, upcoming due dates this week
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      myProjects,
      tasksByPriority,
      upcomingDueThisWeek,
      overdueTasksCount,
    ] = await Promise.all([
      prisma.project.findMany({
        where: { createdBy: user.userId },
        include: {
          client: true,
          _count: { select: { tasks: true } },
        },
      }),
      prisma.task.groupBy({
        by: ['priority'],
        where: { project: { createdBy: user.userId } },
        _count: { id: true },
      }),
      prisma.task.findMany({
        where: {
          project: { createdBy: user.userId },
          status: { not: TaskStatus.DONE },
          dueDate: {
            gte: now,
            lte: oneWeekFromNow,
          },
        },
        include: {
          assignee: { select: { id: true, name: true } },
          project: { select: { id: true, title: true } },
        },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.task.count({
        where: {
          project: { createdBy: user.userId },
          isOverdue: true,
          status: { not: TaskStatus.DONE },
        },
      }),
    ]);

    const priorityCounts: Record<string, number> = {
      [TaskPriority.LOW]: 0,
      [TaskPriority.MEDIUM]: 0,
      [TaskPriority.HIGH]: 0,
      [TaskPriority.CRITICAL]: 0,
    };

    tasksByPriority.forEach((item) => {
      priorityCounts[item.priority] = item._count.id;
    });

    return res.json({
      success: true,
      data: {
        role: 'PM',
        projectsCount: myProjects.length,
        projectsSummary: myProjects,
        tasksByPriority: priorityCounts,
        upcomingDueThisWeek,
        overdueTasksCount,
        onlineUsersCount: getOnlineCount(),
      },
    });
  }

  // Developer dashboard stats:
  const [
    assignedTasksCount,
    pendingTasksCount,
    overdueTasksCount,
  ] = await Promise.all([
    prisma.task.count({ where: { assignedTo: user.userId } }),
    prisma.task.count({
      where: {
        assignedTo: user.userId,
        status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW] },
      },
    }),
    prisma.task.count({
      where: {
        assignedTo: user.userId,
        isOverdue: true,
        status: { not: TaskStatus.DONE },
      },
    }),
  ]);

  return res.json({
    success: true,
    data: {
      role: 'DEVELOPER',
      assignedTasksCount,
      pendingTasksCount,
      overdueTasksCount,
      onlineUsersCount: getOnlineCount(),
    },
  });
};
