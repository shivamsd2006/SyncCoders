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
