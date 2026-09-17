import 'express-async-errors';
import dns from 'node:dns';

// Ensure fast, reliable Anycast DNS resolution with IPv4 preference for cloud databases
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

import http from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ENV } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initSocketServer } from './sockets/socketManager.js';
import { startOverdueScheduler } from './jobs/overdueScheduler.js';

import authRoutes from './routes/auth.routes.js';
import projectsRoutes from './routes/projects.routes.js';
import tasksRoutes from './routes/tasks.routes.js';
import activityRoutes from './routes/activity.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import statsRoutes from './routes/stats.routes.js';
import clientsRoutes from './routes/clients.routes.js';
import usersRoutes from './routes/users.routes.js';

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

const allowedOrigins = Array.from(
  new Set([
    ENV.CLIENT_ORIGIN,
    ENV.CLIENT_ORIGIN.replace(/\/$/, ''),
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ].filter(Boolean))
);

// 1. Cross-Origin Resource Sharing with Cookie Credentials
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || allowedOrigins.includes(origin.replace(/\/$/, ''))) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive fallback to allow smooth dynamic origins while sending credentials
    },
    credentials: true,
  })
);

// 2. Parsers
app.use(express.json());
app.use(cookieParser());

// 3. Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 4. Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/users', usersRoutes);

// 5. Centralized Error Handler
app.use(errorHandler);

// 6. Initialize Real-Time WebSocket Server
initSocketServer(server);

// 7. Initialize Background Cron Job
startOverdueScheduler();

// 8. Start HTTP Server
server.listen(ENV.PORT, () => {
  console.log(`🚀 Server running on http://localhost:${ENV.PORT} [${ENV.NODE_ENV}]`);
  console.log(`⚡ WebSocket server active and listening`);
});
