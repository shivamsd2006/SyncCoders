import { Response, NextFunction } from 'express';
import { prisma } from '../config/prisma.js';
import { AuthenticatedRequest } from '../types/index.js';

export const getClients = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
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
  } catch (err: any) {
    // If connection dropped, attempt quick reconnect once
    if (err?.code === 'P1017' || err?.message?.includes('closed the connection')) {
      try {
        await prisma.$disconnect();
        await prisma.$connect();
        const clients = await prisma.client.findMany({
          orderBy: { name: 'asc' },
          include: {
            _count: { select: { projects: true } },
          },
        });
        return res.json({ success: true, data: { clients } });
      } catch (retryErr) {
        return next(retryErr);
      }
    }
    return next(err);
  }
};

export const createClient = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { name, email, company } = req.body;
    const cleanName = (name || '').trim();
    if (!cleanName) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_NAME', message: 'Client name is required' },
      });
    }

    let cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) {
      const slug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');
      cleanEmail = `${slug || 'client'}@client.local`;
    }

    const client = await prisma.client.create({
      data: {
        name: cleanName,
        email: cleanEmail,
        company: company?.trim() || null,
      },
    });

    return res.status(201).json({
      success: true,
      data: { client },
    });
  } catch (err: any) {
    // If connection dropped, attempt quick reconnect once
    if (err?.code === 'P1017' || err?.message?.includes('closed the connection')) {
      try {
        await prisma.$disconnect();
        await prisma.$connect();
        const { name, email, company } = req.body;
        const cleanName = (name || '').trim();
        let cleanEmail = (email || '').trim().toLowerCase();
        if (!cleanEmail) {
          const slug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');
          cleanEmail = `${slug || 'client'}@client.local`;
        }
        const client = await prisma.client.create({
          data: {
            name: cleanName,
            email: cleanEmail,
            company: company?.trim() || null,
          },
        });
        return res.status(201).json({ success: true, data: { client } });
      } catch (retryErr) {
        return next(retryErr);
      }
    }
    return next(err);
  }
};

export const deleteClient = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
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
  } catch (err: any) {
    // If connection dropped, attempt quick reconnect once
    if (err?.code === 'P1017' || err?.message?.includes('closed the connection')) {
      try {
        await prisma.$disconnect();
        await prisma.$connect();
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
        await prisma.client.delete({ where: { id } });
        return res.json({
          success: true,
          data: { message: `Client "${existing.name}" deleted successfully` },
        });
      } catch (retryErr) {
        return next(retryErr);
      }
    }
    return next(err);
  }
};
