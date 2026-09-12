import cron from 'node-cron';
import { TaskStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { emitNotification } from '../sockets/socketManager.js';

export function startOverdueScheduler() {
  console.log('⏰ Starting overdue task scheduler (runs every 60s)...');

  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();

      // Find tasks that are past their due date, not yet flagged, and not completed
      const tasksToFlag = await prisma.task.findMany({
        where: {
          dueDate: { lt: now },
          isOverdue: false,
          status: { not: TaskStatus.DONE },
        },
        include: {
          project: { select: { id: true, title: true, createdBy: true } },
          assignee: { select: { id: true, name: true } },
        },
      });

      if (tasksToFlag.length === 0) {
        return;
      }

      console.log(`[CRON] Detected ${tasksToFlag.length} tasks past due date. Flagging as overdue...`);

      for (const task of tasksToFlag) {
        // Update task isOverdue flag
        await prisma.task.update({
          where: { id: task.id },
          data: { isOverdue: true },
        });

        // 1. Notify assigned Developer if present
        if (task.assignedTo) {
          const devNotification = await prisma.notification.create({
            data: {
              userId: task.assignedTo,
              taskId: task.id,
              title: 'Task Overdue Alert',
              message: `Task "${task.title}" in ${task.project.title} is now overdue!`,
            },
          });

          emitNotification(task.assignedTo, {
            id: devNotification.id,
            userId: devNotification.userId,
            title: devNotification.title,
            message: devNotification.message,
            taskId: task.id,
            isRead: false,
            createdAt: devNotification.createdAt.toISOString(),
          });
        }

        // 2. Notify Project Manager who owns the project
        if (task.project.createdBy) {
          const pmNotification = await prisma.notification.create({
            data: {
              userId: task.project.createdBy,
              taskId: task.id,
              title: 'Task Overdue Alert',
              message: `Task "${task.title}" in project "${task.project.title}" is overdue!`,
            },
          });

          emitNotification(task.project.createdBy, {
            id: pmNotification.id,
            userId: pmNotification.userId,
            title: pmNotification.title,
            message: pmNotification.message,
            taskId: task.id,
            isRead: false,
            createdAt: pmNotification.createdAt.toISOString(),
          });
        }
      }

      console.log(`[CRON] Successfully processed and notified for ${tasksToFlag.length} overdue tasks`);
    } catch (error) {
      console.error('[CRON ERROR] Failed during overdue task check:', error);
    }
  });
}
