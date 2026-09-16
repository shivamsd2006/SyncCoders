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

export const getTasks = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { status, priority, projectId, dueDateFrom, dueDateTo, isOverdue } = req.query;

  const where: Prisma.TaskWhereInput = {};

  // 1. Strict Role Scoping
  if (user.role === 'DEVELOPER') {
    where.assignedTo = user.userId;
  } else if (user.role === 'PM') {
    where.project = { createdBy: user.userId };
  }

  // 2. Query Filters
  if (status && Object.values(TaskStatus).includes(status as TaskStatus)) {
    where.status = status as TaskStatus;
  }

  if (priority && Object.values(TaskPriority).includes(priority as TaskPriority)) {
    where.priority = priority as TaskPriority;
  }

  if (projectId && typeof projectId === 'string') {
    // If PM, ensure they own the requested project
    if (user.role === 'PM') {
      where.projectId = projectId;
      where.project = { createdBy: user.userId };
    } else if (user.role === 'ADMIN') {
      where.projectId = projectId;
    }
  }

  if (isOverdue === 'true') {
    where.isOverdue = true;
  } else if (isOverdue === 'false') {
    where.isOverdue = false;
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
      project: { select: { id: true, title: true, createdBy: true } },
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

  // Execute atomic status update + activity log in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const updatedTask = await tx.task.update({
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

    let activityLog = null;
    let reassignLog = null;
    let notification = null;
    let notifyUserId: string | null = null;
    let assignNotification = null;

    if (isStatusChanged) {
      let formattedMessage = `${user.name} moved Task "${updatedTask.title}" from ${oldStatus} → ${newStatus}`;

      // Decision 2-A & 3-B: If PM rejected IN_REVIEW -> IN_PROGRESS
      if (oldStatus === TaskStatus.IN_REVIEW && newStatus === TaskStatus.IN_PROGRESS) {
        if (rejectionReason) {
          formattedMessage = `${user.name} requested changes on Task "${updatedTask.title}": "${rejectionReason}"`;
        }
        if (updatedTask.assignedTo) {
          notification = await tx.notification.create({
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
        notification = await tx.notification.create({
          data: {
            userId: existing.project.createdBy,
            taskId: updatedTask.id,
            title: 'Task Ready for Review',
            message: `${user.name} moved "${updatedTask.title}" in "${existing.project.title}" to In Review`,
          },
        });
        notifyUserId = existing.project.createdBy;
      }

      activityLog = await tx.taskActivityLog.create({
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
        const newAssignee = await tx.user.findUnique({
          where: { id: assignedTo },
          select: { name: true, role: true },
        });
        reassignMessage = `${user.name} reassigned Task "${updatedTask.title}" to ${newAssignee?.name || 'developer'}`;

        // Per spec: ONLY developers receive "New Task Assigned" notifications
        if (newAssignee && newAssignee.role === 'DEVELOPER') {
          assignNotification = await tx.notification.create({
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

      reassignLog = await tx.taskActivityLog.create({
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

    return {
      updatedTask,
      activityLog,
      reassignLog,
      notification,
      notifyUserId,
      assignNotification,
      assignedToUser: assignedTo,
    };
  });

  // Broadcast Real-Time Events via WebSocket outside the transaction
  if (result.activityLog) {
    broadcastActivity(
      {
        id: result.activityLog.id,
        taskId: result.updatedTask.id,
        userId: user.userId,
        userName: user.name,
        userUsername: result.activityLog.user?.username,
        userHeadline: result.activityLog.user?.headline,
        userAvatar: result.activityLog.user?.avatarUrl,
        taskTitle: result.updatedTask.title,
        projectId: result.updatedTask.projectId,
        oldStatus,
        newStatus,
        formattedMessage: result.activityLog.formattedMessage,
        createdAt: result.activityLog.createdAt.toISOString(),
      },
      result.updatedTask.projectId,
      existing.project.createdBy,
      result.updatedTask.assignedTo
    );
  }

  if (result.reassignLog) {
    broadcastActivity(
      {
        id: result.reassignLog.id,
        taskId: result.updatedTask.id,
        userId: user.userId,
        userName: user.name,
        userUsername: result.reassignLog.user?.username,
        userHeadline: result.reassignLog.user?.headline,
        userAvatar: result.reassignLog.user?.avatarUrl,
        taskTitle: result.updatedTask.title,
        projectId: result.updatedTask.projectId,
        oldStatus: result.updatedTask.status,
        newStatus: result.updatedTask.status,
        formattedMessage: result.reassignLog.formattedMessage,
        createdAt: result.reassignLog.createdAt.toISOString(),
      },
      result.updatedTask.projectId,
      existing.project.createdBy,
      result.updatedTask.assignedTo
    );
  }

  if (result.notification && result.notifyUserId) {
    emitNotification(result.notifyUserId, {
      id: result.notification.id,
      userId: result.notifyUserId,
      title: result.notification.title,
      message: result.notification.message,
      taskId: result.updatedTask.id,
      isRead: false,
      createdAt: result.notification.createdAt.toISOString(),
    });
  }

  if (result.assignNotification && result.assignedToUser) {
    emitNotification(result.assignedToUser, {
      id: result.assignNotification.id,
      userId: result.assignedToUser,
      title: result.assignNotification.title,
      message: result.assignNotification.message,
      taskId: result.updatedTask.id,
      isRead: false,
      createdAt: result.assignNotification.createdAt.toISOString(),
    });
  }

  if (isStatusChanged) {
    await syncProjectStatus(existing.projectId);
  }

  return res.json({
    success: true,
    data: { task: result.updatedTask },
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

