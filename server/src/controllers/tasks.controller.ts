import { Response } from 'express';
import { Prisma, TaskPriority, TaskStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';
import { broadcastActivity, emitNotification } from '../sockets/socketManager.js';

// Priority weight mapping for deterministic sorting
const priorityOrder: Record<TaskPriority, number> = {
  [TaskPriority.CRITICAL]: 4,
  [TaskPriority.HIGH]: 3,
  [TaskPriority.MEDIUM]: 2,
  [TaskPriority.LOW]: 1,
};

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
      assignee: { select: { id: true, name: true, email: true } },
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
      assignee: { select: { id: true, name: true, email: true } },
      activityLogs: {
        include: { user: { select: { id: true, name: true } } },
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
      assignee: { select: { id: true, name: true, email: true } },
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

  return res.status(201).json({
    success: true,
    data: { task },
  });
};

export const updateTask = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  const { status, title, description, assignedTo, priority, dueDate } = req.body;

  const existing = await prisma.task.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, title: true, createdBy: true } },
      assignee: { select: { id: true, name: true, email: true } },
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
            ? assignedTo
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
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    let activityLog = null;
    let notification = null;

    if (isStatusChanged) {
      const formattedMessage = `${user.name} moved Task "${updatedTask.title}" from ${oldStatus} → ${newStatus}`;

      activityLog = await tx.taskActivityLog.create({
        data: {
          taskId: id,
          userId: user.userId,
          oldStatus,
          newStatus,
          formattedMessage,
        },
      });

      // If task moved to IN_REVIEW, notify the Project Manager who owns the project
      if (newStatus === TaskStatus.IN_REVIEW) {
        notification = await tx.notification.create({
          data: {
            userId: existing.project.createdBy,
            taskId: updatedTask.id,
            title: 'Task Ready for Review',
            message: `${user.name} moved "${updatedTask.title}" to In Review`,
          },
        });
      }
    }

    // If assignee changed by Admin or PM, notify the new assignee
    if (
      user.role !== 'DEVELOPER' &&
      assignedTo &&
      assignedTo !== existing.assignedTo
    ) {
      await tx.notification.create({
        data: {
          userId: assignedTo,
          taskId: updatedTask.id,
          title: 'New Task Assigned',
          message: `${user.name} assigned you "${updatedTask.title}"`,
        },
      });
    }

    return { updatedTask, activityLog, notification };
  });

  // Broadcast Real-Time Events via WebSocket outside the transaction
  if (result.activityLog) {
    broadcastActivity(
      {
        id: result.activityLog.id,
        taskId: result.updatedTask.id,
        userId: user.userId,
        userName: user.name,
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

  if (result.notification) {
    emitNotification(existing.project.createdBy, {
      id: result.notification.id,
      userId: existing.project.createdBy,
      title: result.notification.title,
      message: result.notification.message,
      taskId: result.updatedTask.id,
      isRead: false,
      createdAt: result.notification.createdAt.toISOString(),
    });
  }

  return res.json({
    success: true,
    data: { task: result.updatedTask },
  });
};

export const deleteTask = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;

  if (user.role === 'DEVELOPER') {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Developers cannot delete tasks' },
    });
  }

  const existing = await prisma.task.findUnique({
    where: { id },
    include: { project: { select: { createdBy: true } } },
  });

  if (!existing) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Task not found' },
    });
  }

  if (user.role === 'PM' && existing.project.createdBy !== user.userId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Project Managers cannot delete tasks from other PMs projects',
      },
    });
  }

  await prisma.task.delete({ where: { id } });

  return res.json({
    success: true,
    message: 'Task deleted successfully',
  });
};
