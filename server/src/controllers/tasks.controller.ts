import { Response } from 'express';
import { Prisma, ProjectStatus, TaskPriority, TaskStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';
import { broadcastActivity, emitNotification, broadcastProjectUpdate } from '../sockets/socketManager.js';

// Priority weight mapping for deterministic sorting
const priorityOrder: Record<TaskPriority, number> = {
  [TaskPriority.CRITICAL]: 4,
  [TaskPriority.HIGH]: 3,
  [TaskPriority.MEDIUM]: 2,
  [TaskPriority.LOW]: 1,
};

/**
 * Automatically synchronizes a project's status based on its tasks:
 * - If all tasks are DONE (at least 1 task), marks project as COMPLETED.
 * - If project is COMPLETED but contains open (non-DONE) tasks, reverts project to ACTIVE.
 */
export async function syncProjectStatus(projectId: string) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: { select: { id: true, status: true } },
      },
    });

    if (!project) return;

    const allTasks = project.tasks;
    if (allTasks.length > 0) {
      const allDone = allTasks.every((t) => t.status === TaskStatus.DONE);

      if (allDone && project.status !== ProjectStatus.COMPLETED) {
        await prisma.project.update({
          where: { id: projectId },
          data: { status: ProjectStatus.COMPLETED },
        });

        broadcastProjectUpdate(projectId, ProjectStatus.COMPLETED);

        // 1. Notify Project Creator / Manager
        const pmNotification = await prisma.notification.create({
          data: {
            userId: project.createdBy,
            title: 'Project Completed! 🎉',
            message: `All tasks for "${project.title}" are now completed. Project marked as COMPLETED.`,
          },
        });

        emitNotification(project.createdBy, {
          id: pmNotification.id,
          userId: project.createdBy,
          title: pmNotification.title,
          message: pmNotification.message,
          taskId: null,
          isRead: false,
          createdAt: pmNotification.createdAt.toISOString(),
        });

        // 2. Notify all Admins about project completion status (per spec: Admin only gets project completion notifications)
        const admins = await prisma.user.findMany({
          where: { role: 'ADMIN' },
          select: { id: true },
        });

        for (const admin of admins) {
          if (admin.id !== project.createdBy) {
            const adminNotif = await prisma.notification.create({
              data: {
                userId: admin.id,
                title: 'Project Completed! 🎉',
                message: `Project "${project.title}" has been completed (all tasks marked Done).`,
              },
            });

            emitNotification(admin.id, {
              id: adminNotif.id,
              userId: admin.id,
              title: adminNotif.title,
              message: adminNotif.message,
              taskId: null,
              isRead: false,
              createdAt: adminNotif.createdAt.toISOString(),
            });
          }
        }
      } else if (!allDone && project.status === ProjectStatus.COMPLETED) {
        // Revert to ACTIVE if tasks were moved out of DONE or new task added
        await prisma.project.update({
          where: { id: projectId },
          data: { status: ProjectStatus.ACTIVE },
        });

        broadcastProjectUpdate(projectId, ProjectStatus.ACTIVE);
      }
    }
  } catch (err) {
    console.error(`[syncProjectStatus] Failed to sync status for project ${projectId}:`, err);
  }
}

export const getTasks = async (req: AuthenticatedRequest, res: Response, next: any): Promise<any> => {
  try {
    const user = req.user!;
    const { status, priority, projectId, dueDateFrom, dueDateTo, isOverdue, scope } = req.query;

    const where: Prisma.TaskWhereInput = {};

    // 1. Role Scoping
    if (user.role === 'DEVELOPER') {
      where.assignedTo = user.userId;
    } else if (user.role === 'PM') {
      // If PM explicitly specifies scope='my', restrict to their projects.
      // Otherwise, allow PM to view overall tasks across all projects combining all available projects.
      if (scope === 'my') {
        where.project = { createdBy: user.userId };
      }
    }

    // 2. Query Filters
    if (status && Object.values(TaskStatus).includes(status as TaskStatus)) {
      where.status = status as TaskStatus;
    }

    if (priority && Object.values(TaskPriority).includes(priority as TaskPriority)) {
      where.priority = priority as TaskPriority;
    }

    if (projectId && typeof projectId === 'string') {
      where.projectId = projectId;
      if (user.role === 'PM' && scope === 'my') {
        where.project = { createdBy: user.userId };
      }
    }

    if (isOverdue === 'true') {
      where.status = { not: TaskStatus.DONE };
      where.OR = [
        { isOverdue: true },
        { dueDate: { lt: new Date() } },
      ];
    } else if (isOverdue === 'false') {
      where.isOverdue = false;
      where.dueDate = { gte: new Date() };
    }

    if (dueDateFrom || dueDateTo) {
      where.dueDate = {};
      if (dueDateFrom && typeof dueDateFrom === 'string') {
        where.dueDate.gte = new Date(dueDateFrom);
      }
      if (dueDateTo && typeof dueDateTo === 'string') {
        where.dueDate.lte = new Date(dueDateTo);
      }
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        project: { select: { id: true, title: true, createdBy: true, status: true } },
        assignee: { select: { id: true, name: true, email: true, username: true, headline: true, avatarUrl: true } },
      },
      orderBy: [
        { dueDate: 'asc' },
      ],
    });

    // Sort Developer tasks by Priority (CRITICAL > HIGH > MEDIUM > LOW) then Due Date
    if (user.role === 'DEVELOPER') {
      tasks.sort((a, b) => {
        const pDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (pDiff !== 0) return pDiff;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    }

    return res.json({
      success: true,
      data: { tasks },
    });
  } catch (err: any) {
    if (err?.code === 'P1017' || err?.message?.includes('closed the connection')) {
      try {
        await prisma.$disconnect();
        await prisma.$connect();
        // Retry once
        return getTasks(req, res, next);
      } catch (retryErr) {
        return next(retryErr);
      }
    }
    return next(err);
  }
};

export const getTaskById = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, title: true, createdBy: true } },
      assignee: { select: { id: true, name: true, email: true, username: true, headline: true, avatarUrl: true } },
      activityLogs: {
        include: { user: { select: { id: true, name: true, email: true, username: true, headline: true, avatarUrl: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!task) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Task not found' },
    });
  }

  // Role Access Checks
  if (user.role === 'DEVELOPER' && task.assignedTo !== user.userId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Developers can only view tasks assigned to them',
      },
    });
  }

  if (user.role === 'PM' && task.project.createdBy !== user.userId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Project Managers cannot access tasks from other PMs projects',
      },
    });
  }

  return res.json({
    success: true,
    data: { task },
  });
};

export const createTask = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { projectId, title, description, assignedTo, priority, dueDate } = req.body;

  // Developers cannot create tasks
  if (user.role === 'DEVELOPER') {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Developers cannot create tasks' },
    });
  }

  // Check project existence & ownership
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return res.status(404).json({
      success: false,
      error: { code: 'PROJECT_NOT_FOUND', message: 'Project not found' },
    });
  }

  if (user.role === 'PM' && project.createdBy !== user.userId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'PMs can only create tasks in projects they created',
      },
    });
  }

  // Validate assigned user exists and has DEVELOPER role
  let developerUser: any = null;
  if (assignedTo) {
    developerUser = await prisma.user.findUnique({ where: { id: assignedTo } });
    if (!developerUser || developerUser.role !== 'DEVELOPER') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ASSIGNEE',
          message: 'Tasks can only be assigned to users with the DEVELOPER role',
        },
      });
    }
  }

  const parsedDueDate = new Date(dueDate);
  const isOverdue = parsedDueDate < new Date();

  const task = await prisma.task.create({
    data: {
      projectId,
      title,
      description,
      assignedTo: assignedTo || null,
      priority: priority || TaskPriority.MEDIUM,
      dueDate: parsedDueDate,
      isOverdue,
      status: TaskStatus.TODO,
    },
    include: {
      project: { select: { id: true, title: true, createdBy: true } },
      assignee: { select: { id: true, name: true, email: true, username: true, headline: true, avatarUrl: true } },
    },
  });

  // If assigned to a developer, create an in-app notification and emit real-time event
  if (developerUser) {
    const notification = await prisma.notification.create({
      data: {
        userId: developerUser.id,
        taskId: task.id,
        title: 'New Task Assigned',
        message: `${user.name} assigned you "${task.title}" in ${project.title}`,
      },
    });

    emitNotification(developerUser.id, {
      id: notification.id,
      userId: developerUser.id,
      title: notification.title,
      message: notification.message,
      taskId: task.id,
      isRead: false,
      createdAt: notification.createdAt.toISOString(),
    });
  }

  // Synchronize project status in case an active task was added to a previously completed project
  await syncProjectStatus(projectId);

  return res.status(201).json({
    success: true,
    data: { task },
  });
};

export const updateTask = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  const { status, title, description, assignedTo, priority, dueDate, rejectionReason } = req.body;

  const existing = await prisma.task.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, title: true, createdBy: true } },
      assignee: { select: { id: true, name: true, email: true, username: true, headline: true, avatarUrl: true } },
    },
  });

  if (!existing) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Task not found' },
    });
  }

  // 1. RBAC & IDOR Rules
  if (user.role === 'DEVELOPER') {
    if (existing.assignedTo !== user.userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Developers can only modify tasks assigned to them',
        },
      });
    }

    // A Developer must NOT be able to modify title, description, priority, assignee, or dueDate
    if (
      title !== undefined ||
      description !== undefined ||
      assignedTo !== undefined ||
      priority !== undefined ||
      dueDate !== undefined
    ) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Developers are only permitted to update task status',
        },
      });
    }
  }

  if (user.role === 'PM' && existing.project.createdBy !== user.userId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Project Managers cannot modify tasks from other PMs projects',
      },
    });
  }

  const isStatusChanged = status && status !== existing.status;
  const oldStatus = existing.status;
  const newStatus = status as TaskStatus;

  // Execute status update + activity log + notifications sequentially
  const updatedTask = await prisma.task.update({
    where: { id },
    data: {
      status: status ?? existing.status,
      title: user.role !== 'DEVELOPER' && title !== undefined ? title : existing.title,
      description:
        user.role !== 'DEVELOPER' && description !== undefined
          ? description
          : existing.description,
      assignedTo:
        user.role !== 'DEVELOPER' && assignedTo !== undefined
          ? (assignedTo || null)
          : existing.assignedTo,
      priority:
        user.role !== 'DEVELOPER' && priority !== undefined ? priority : existing.priority,
      dueDate:
        user.role !== 'DEVELOPER' && dueDate !== undefined
          ? new Date(dueDate)
          : existing.dueDate,
      // If moved to DONE, clear overdue flag if desired, or maintain historical flag
      isOverdue: status === TaskStatus.DONE ? false : existing.isOverdue,
    },
    include: {
      project: { select: { id: true, title: true, createdBy: true } },
      assignee: { select: { id: true, name: true, email: true, username: true, headline: true, avatarUrl: true } },
    },
  });

  let activityLog: any = null;
  let reassignLog: any = null;
  let notification: any = null;
  let notifyUserId: string | null = null;
  let assignNotification: any = null;

  if (isStatusChanged) {
    let formattedMessage = `${user.name} moved Task "${updatedTask.title}" from ${oldStatus} → ${newStatus}`;

    // Decision 2-A & 3-B: If PM rejected IN_REVIEW -> IN_PROGRESS
    if (oldStatus === TaskStatus.IN_REVIEW && newStatus === TaskStatus.IN_PROGRESS) {
      if (rejectionReason) {
        formattedMessage = `${user.name} requested changes on Task "${updatedTask.title}": "${rejectionReason}"`;
      }
      if (updatedTask.assignedTo) {
        notification = await prisma.notification.create({
          data: {
            userId: updatedTask.assignedTo,
            taskId: updatedTask.id,
            title: 'Task Changes Requested',
            message: rejectionReason
              ? `${user.name} requested changes: "${rejectionReason}"`
              : `${user.name} moved "${updatedTask.title}" back to In Progress`,
          },
        });
        notifyUserId = updatedTask.assignedTo;
      }
    } else if (newStatus === TaskStatus.IN_REVIEW) {
      // If task moved to IN_REVIEW, notify the Project Manager who owns the project
      notification = await prisma.notification.create({
        data: {
          userId: existing.project.createdBy,
          taskId: updatedTask.id,
          title: 'Task Ready for Review',
          message: `${user.name} moved "${updatedTask.title}" in "${existing.project.title}" to In Review`,
        },
      });
      notifyUserId = existing.project.createdBy;
    }

    activityLog = await prisma.taskActivityLog.create({
      data: {
        taskId: id,
        userId: user.userId,
        oldStatus,
        newStatus,
        formattedMessage,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            headline: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  // Decision 9-B: If assignee changed by Admin or PM, log activity and notify new assignee
  const isAssigneeChanged =
    user.role !== 'DEVELOPER' &&
    assignedTo !== undefined &&
    assignedTo !== existing.assignedTo;

  if (isAssigneeChanged) {
    let reassignMessage = '';
    if (assignedTo) {
      const newAssignee = await prisma.user.findUnique({
        where: { id: assignedTo },
        select: { name: true, role: true },
      });
      reassignMessage = `${user.name} reassigned Task "${updatedTask.title}" to ${newAssignee?.name || 'developer'}`;

      // Per spec: ONLY developers receive "New Task Assigned" notifications
      if (newAssignee && newAssignee.role === 'DEVELOPER') {
        assignNotification = await prisma.notification.create({
          data: {
            userId: assignedTo,
            taskId: updatedTask.id,
            title: 'New Task Assigned',
            message: `${user.name} assigned you "${updatedTask.title}" in "${existing.project.title}"`,
          },
        });
      }
    } else {
      reassignMessage = `${user.name} unassigned Task "${updatedTask.title}"`;
    }

    reassignLog = await prisma.taskActivityLog.create({
      data: {
        taskId: id,
        userId: user.userId,
        oldStatus: updatedTask.status,
        newStatus: updatedTask.status,
        formattedMessage: reassignMessage,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            headline: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  // Broadcast Real-Time Events via WebSocket
  if (activityLog) {
    broadcastActivity(
      {
        id: activityLog.id,
        taskId: updatedTask.id,
        userId: user.userId,
        userName: user.name,
        userUsername: activityLog.user?.username,
        userHeadline: activityLog.user?.headline,
        userAvatar: activityLog.user?.avatarUrl,
        taskTitle: updatedTask.title,
        projectId: updatedTask.projectId,
        oldStatus,
        newStatus,
        formattedMessage: activityLog.formattedMessage,
        createdAt: activityLog.createdAt.toISOString(),
      },
      updatedTask.projectId,
      existing.project.createdBy,
      updatedTask.assignedTo
    );
  }

  if (reassignLog) {
    broadcastActivity(
      {
        id: reassignLog.id,
        taskId: updatedTask.id,
        userId: user.userId,
        userName: user.name,
        userUsername: reassignLog.user?.username,
        userHeadline: reassignLog.user?.headline,
        userAvatar: reassignLog.user?.avatarUrl,
        taskTitle: updatedTask.title,
        projectId: updatedTask.projectId,
        oldStatus: updatedTask.status,
        newStatus: updatedTask.status,
        formattedMessage: reassignLog.formattedMessage,
        createdAt: reassignLog.createdAt.toISOString(),
      },
      updatedTask.projectId,
      existing.project.createdBy,
      updatedTask.assignedTo
    );
  }

  if (notification && notifyUserId) {
    emitNotification(notifyUserId, {
      id: notification.id,
      userId: notifyUserId,
      title: notification.title,
      message: notification.message,
      taskId: updatedTask.id,
      isRead: false,
      createdAt: notification.createdAt.toISOString(),
    });
  }

  if (assignNotification && assignedTo) {
    emitNotification(assignedTo, {
      id: assignNotification.id,
      userId: assignedTo,
      title: assignNotification.title,
      message: assignNotification.message,
      taskId: updatedTask.id,
      isRead: false,
      createdAt: assignNotification.createdAt.toISOString(),
    });
  }

  if (isStatusChanged) {
    await syncProjectStatus(existing.projectId);
  }

  return res.json({
    success: true,
    data: { task: updatedTask },
  });
};

export const deleteTask = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;

  const existing = await prisma.task.findUnique({
    where: { id },
    include: { project: { select: { id: true, createdBy: true, title: true } } },
  });

  if (!existing) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Task not found' },
    });
  }

  // 1. PM can only delete tasks from projects they created
  if (user.role === 'PM' && existing.project.createdBy !== user.userId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Project Managers cannot delete tasks from other PMs projects',
      },
    });
  }

  // 2. Developers can delete tasks assigned to them, or tasks inside projects they belong to
  if (user.role === 'DEVELOPER') {
    const isAssigned = existing.assignedTo === user.userId;
    if (!isAssigned) {
      const devHasAccess = await prisma.task.findFirst({
        where: { projectId: existing.projectId, assignedTo: user.userId },
      });
      if (!devHasAccess) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Developers can only delete tasks inside projects they are assigned to',
          },
        });
      }
    }
  }

  const projectId = existing.projectId;

  await prisma.task.delete({ where: { id } });

  // Synchronize project status: if all remaining tasks are DONE, project becomes COMPLETED
  await syncProjectStatus(projectId);

  return res.json({
    success: true,
    message: 'Task deleted successfully',
  });
};

