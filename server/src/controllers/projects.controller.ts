import { Response } from 'express';
import { ProjectStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';

export const getProjects = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;

  if (user.role === 'DEVELOPER') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Developers are not authorized to view project management listings',
      },
    });
  }

  const { status } = req.query;
  const whereClause: any = user.role === 'ADMIN' ? {} : { createdBy: user.userId };

  if (status && Object.values(ProjectStatus).includes(status as ProjectStatus)) {
    whereClause.status = status as ProjectStatus;
  }

  const projects = await prisma.project.findMany({
    where: whereClause,
    include: {
      client: true,
      creator: { select: { id: true, name: true, email: true, username: true, headline: true, avatarUrl: true } },
      tasks: {
        select: {
          id: true,
          status: true,
          priority: true,
          isOverdue: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json({
    success: true,
    data: { projects },
  });
};

export const getProjectById = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      creator: { select: { id: true, name: true, email: true, username: true, headline: true, avatarUrl: true } },
      tasks: {
        include: {
          assignee: { select: { id: true, name: true, email: true, username: true, headline: true, avatarUrl: true } },
        },
        orderBy: { dueDate: 'asc' },
      },
    },
  });

  if (!project) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Project not found' },
    });
  }

  // RBAC ownership checks
  if (user.role === 'PM' && project.createdBy !== user.userId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Project Managers can only access projects they created',
      },
    });
  }

  if (user.role === 'DEVELOPER') {
    // Developers can only see tasks assigned to them within this project
    const hasAssignedTask = project.tasks.some((t) => t.assignedTo === user.userId);
    if (!hasAssignedTask) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Developers can only access projects containing tasks assigned to them',
        },
      });
    }

    // Filter out other developers' tasks per requirement
    project.tasks = project.tasks.filter((t) => t.assignedTo === user.userId);
  }

  return res.json({
    success: true,
    data: { project },
  });
};

export const createProject = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { title, description, clientId, status } = req.body;

  // Verify client exists
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_CLIENT', message: 'Client does not exist' },
    });
  }

  const project = await prisma.project.create({
    data: {
      title,
      description,
      clientId,
      status: ProjectStatus.ACTIVE,
      createdBy: user.userId,
    },
    include: {
      client: true,
      creator: { select: { id: true, name: true, email: true } },
    },
  });

  return res.status(201).json({
    success: true,
    data: { project },
  });
};

export const updateProject = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;
  const { title, description, clientId, status } = req.body;

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Project not found' },
    });
  }

  if (user.role === 'PM' && existing.createdBy !== user.userId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Project Managers can only update projects they created',
      },
    });
  }

  const updated = await prisma.project.update({
    where: { id },
    data: {
      title: title ?? existing.title,
      description: description ?? existing.description,
      clientId: clientId ?? existing.clientId,
      status:
        status && Object.values(ProjectStatus).includes(status as ProjectStatus)
          ? (status as ProjectStatus)
          : existing.status,
    },
    include: {
      client: true,
      creator: { select: { id: true, name: true, email: true } },
    },
  });

  return res.json({
    success: true,
    data: { project: updated },
  });
};

export const deleteProject = async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { id } = req.params;

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Project not found' },
    });
  }

  if (user.role === 'PM' && existing.createdBy !== user.userId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Project Managers can only delete projects they created',
      },
    });
  }

  await prisma.project.delete({ where: { id } });

  return res.json({
    success: true,
    message: 'Project deleted successfully',
  });
};
