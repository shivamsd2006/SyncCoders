import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { JwtPayload } from '../types/index.js';
import { prisma } from '../config/prisma.js';

let io: SocketIOServer | null = null;
const activeUsersMap = new Map<string, number>();

export interface ActivityBroadcastPayload {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userUsername?: string | null;
  userHeadline?: string | null;
  userAvatar?: string | null;
  taskTitle: string;
  projectId: string;
  oldStatus: string;
  newStatus: string;
  formattedMessage: string;
  createdAt: string;
}

export interface NotificationBroadcastPayload {
  id: string;
  userId: string;
  title: string;
  message: string;
  taskId?: string | null;
  isRead: boolean;
  createdAt: string;
}

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: [ENV.CLIENT_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  // Socket Authentication Middleware
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    try {
      const decoded = jwt.verify(token, ENV.ACCESS_TOKEN_SECRET) as JwtPayload;
      socket.data.user = decoded;
      next();
    } catch (err) {
      return next(new Error('Invalid or expired socket authentication token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user: JwtPayload = socket.data.user;
    const userId = user.userId;

    // Increment active presence
    const currentTabs = activeUsersMap.get(userId) || 0;
    activeUsersMap.set(userId, currentTabs + 1);

    // Broadcast current online user count to everyone
    io?.emit('presence:update', { onlineCount: activeUsersMap.size });

    // Join personal user room for targeted notifications
    socket.join(`user:${userId}`);

    // Join role-specific broadcast rooms
    if (user.role === 'ADMIN') {
      socket.join('admin-feed');
    } else if (user.role === 'PM') {
      socket.join(`pm:${userId}`);
    }

    // Client requesting to watch a specific project
    socket.on('project:join', async (projectId: string) => {
      if (!projectId) return;

      if (user.role === 'ADMIN') {
        socket.join(`project:${projectId}`);
      } else if (user.role === 'PM') {
        const project = await prisma.project.findFirst({
          where: { id: projectId, createdBy: user.userId },
        });
        if (project) {
          socket.join(`project:${projectId}`);
        }
      } else if (user.role === 'DEVELOPER') {
        // Developers can join if assigned to at least one task in this project
        const assignedTask = await prisma.task.findFirst({
          where: { projectId, assignedTo: user.userId },
        });
        if (assignedTask) {
          socket.join(`project:${projectId}`);
        }
      }
    });

    socket.on('project:leave', (projectId: string) => {
      if (projectId) {
        socket.leave(`project:${projectId}`);
      }
    });

    socket.on('disconnect', () => {
      const tabs = activeUsersMap.get(userId) || 1;
      if (tabs <= 1) {
        activeUsersMap.delete(userId);
      } else {
        activeUsersMap.set(userId, tabs - 1);
      }
      io?.emit('presence:update', { onlineCount: activeUsersMap.size });
    });
  });

  return io;
}

export function getSocketIO(): SocketIOServer | null {
  return io;
}

export function getOnlineCount(): number {
  return activeUsersMap.size;
}

export function broadcastActivity(
  payload: ActivityBroadcastPayload,
  projectId: string,
  pmUserId?: string,
  assignedDevId?: string | null
) {
  if (!io) return;

  // 1. Send to all active viewers of the project room
  io.to(`project:${projectId}`).emit('activity:new', payload);

  // 2. Send to Admin global feed room
  io.to('admin-feed').emit('activity:new', payload);

  // 3. Send to the Project Manager who created this project
  if (pmUserId) {
    io.to(`pm:${pmUserId}`).emit('activity:new', payload);
  }

  // 4. Send to the assigned developer's private room
  if (assignedDevId) {
    io.to(`user:${assignedDevId}`).emit('activity:new', payload);
  }
}

export function emitNotification(userId: string, payload: NotificationBroadcastPayload) {
  if (!io) return;
  io.to(`user:${userId}`).emit('notification:new', payload);
}

export function broadcastProjectUpdate(projectId: string, status: string) {
  if (!io) return;
  io.to(`project:${projectId}`).emit('project:updated', { projectId, status });
  io.emit('project:updated', { projectId, status });
}

