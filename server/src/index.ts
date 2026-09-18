import 'express-async-errors';
import dns from 'node:dns';

// Ensure fast, reliable Anycast DNS resolution with IPv4 preference for cloud databases on Windows
if (process.platform === 'win32') {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
    dns.setDefaultResultOrder('ipv4first');
  } catch (_) {}
}

// Sanitize database URLs (strips accidental quotes and trailing whitespace from cloud dashboard paste)
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.trim().replace(/^["']|["']$/g, '');
}
if (process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DIRECT_URL.trim().replace(/^["']|["']$/g, '');
}

import http from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ENV } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initSocketServer } from './sockets/socketManager.js';
import { startOverdueScheduler } from './jobs/overdueScheduler.js';
import { prisma } from './config/prisma.js';

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

// 3. Health & root status check
app.get('/', (_req, res) => {
  res.json({
    message: '🚀 SyncCoders Backend API is active and running',
    endpoints: '/api',
    health: '/health',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Diagnostic database connectivity check
app.get('/api/db-check', async (_req, res) => {
  const rawDbUrl = process.env.DATABASE_URL || '';
  const rawDirectUrl = process.env.DIRECT_URL || '';

  const maskUrl = (url: string) => {
    try {
      const u = new URL(url);
      return `${u.protocol}//${u.username}:****@${u.host}${u.pathname}${u.search}`;
    } catch (_) {
      return url.length > 10 ? `${url.substring(0, 10)}... (malformed URL)` : '(empty/invalid)';
    }
  };

  const info = {
    hasDatabaseUrl: Boolean(rawDbUrl),
    databaseUrlMasked: maskUrl(rawDbUrl),
    hasDirectUrl: Boolean(rawDirectUrl),
    directUrlMasked: maskUrl(rawDirectUrl),
    rawUrlStartsWithQuote: rawDbUrl.startsWith('"') || rawDbUrl.startsWith("'"),
    rawUrlEndsWithQuote: rawDbUrl.endsWith('"') || rawDbUrl.endsWith("'"),
    port: rawDbUrl.includes(':6543') ? 6543 : rawDbUrl.includes(':5432') ? 5432 : 'other',
  };

  try {
    const userCount = await prisma.user.count();
    return res.json({ success: true, message: 'Database connected successfully', userCount, info });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: err?.message || String(err),
      info,
    });
  }
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
