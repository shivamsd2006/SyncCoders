import { Response } from 'express';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';
import { getOnlineCount } from '../sockets/socketManager.js';

export const getDashboardStats = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const now = new Date();

  // 1. Proactively flag any tasks whose dueDate has passed and are not DONE
  await prisma.task.updateMany({
    where: {
      dueDate: { lt: now },
      isOverdue: false,
      status: { not: TaskStatus.DONE },
    },
    data: { isOverdue: true },
  });

  // 2. Global task metrics across all projects
  const [
    totalProjects,
    tasksByStatusGroup,
    overdueTasksCount,
  ] = await Promise.all([
    prisma.project.count(),
    prisma.task.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.task.count({
      where: {
        status: { not: TaskStatus.DONE },
        OR: [
          { isOverdue: true },
          { dueDate: { lt: now } },
        ],
      },
    }),
  ]);

  const statusCounts: Record<string, number> = {
    [TaskStatus.TODO]: 0,
    [TaskStatus.IN_PROGRESS]: 0,
    [TaskStatus.IN_REVIEW]: 0,
    [TaskStatus.DONE]: 0,
  };

  tasksByStatusGroup.forEach((item) => {
    statusCounts[item.status] = item._count.id;
  });

  if (user.role === 'ADMIN') {
    const [totalUsers, totalClients] = await Promise.all([
      prisma.user.count(),
      prisma.client.count(),
    ]);

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
    // PM sees: their managed projects + delivery metrics across all projects (tasks in progress, in review, overdue)
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      myProjects,
      tasksByPriority,
      upcomingDueThisWeek,
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
        tasksByStatus: statusCounts, // Global tasks in progress, in review, etc. across all projects
        upcomingDueThisWeek,
        overdueTasksCount, // All overdue tasks across all projects
        onlineUsersCount: getOnlineCount(),
      },
    });
  }

  // Developer dashboard stats:
  const [
    assignedTasksCount,
    pendingTasksCount,
    devOverdueTasksCount,
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
        status: { not: TaskStatus.DONE },
        OR: [
          { isOverdue: true },
          { dueDate: { lt: now } },
        ],
      },
    }),
  ]);

  return res.json({
    success: true,
    data: {
      role: 'DEVELOPER',
      assignedTasksCount,
      pendingTasksCount,
      overdueTasksCount: devOverdueTasksCount,
      onlineUsersCount: getOnlineCount(),
    },
  });
};
