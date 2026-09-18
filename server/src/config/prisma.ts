import dns from 'node:dns';
import { PrismaClient } from '@prisma/client';

// Ensure fast IPv4 resolution on Windows if needed
if (process.platform === 'win32') {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
    dns.setDefaultResultOrder('ipv4first');
  } catch (_) {}
}

function getCleanDatabaseUrl(): string | undefined {
  let url = process.env.DATABASE_URL;
  if (!url) return undefined;
  // Strip surrounding quotes (double or single) and whitespace
  url = url.trim().replace(/^["']|["']$/g, '').trim();
  return url;
}

const cleanDbUrl = getCleanDatabaseUrl();

// Synchronize sanitized URL back to process.env for Prisma internal checks
if (cleanDbUrl) {
  process.env.DATABASE_URL = cleanDbUrl;
}
if (process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DIRECT_URL.trim().replace(/^["']|["']$/g, '').trim();
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    ...(cleanDbUrl
      ? {
          datasources: {
            db: {
              url: cleanDbUrl,
            },
          },
        }
      : {}),
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

