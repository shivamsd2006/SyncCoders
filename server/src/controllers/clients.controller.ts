import { Response } from 'express';
import { prisma } from '../config/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';

export const getClients = async (_req: AuthenticatedRequest, res: Response) => {
  const clients = await prisma.client.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { projects: true } },
    },
  });

  return res.json({
    success: true,
    data: { clients },
  });
};

export const createClient = async (req: AuthenticatedRequest, res: Response) => {
  const { name, email, company } = req.body;

  const client = await prisma.client.create({
    data: {
      name,
      email: email.toLowerCase().trim(),
      company,
    },
  });

  return res.status(201).json({
    success: true,
    data: { client },
  });
};

export const deleteClient = async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.client.findUnique({
    where: { id },
    include: { _count: { select: { projects: true } } },
  });

  if (!existing) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Client not found' },
    });
  }

  await prisma.client.delete({
    where: { id },
  });

  return res.json({
    success: true,
    data: { message: `Client "${existing.name}" deleted successfully` },
  });
};
