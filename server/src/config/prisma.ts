import dns from 'node:dns';
import { PrismaClient } from '@prisma/client';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        try {
          return await query(args);
        } catch (err: any) {
          const errStr = `${err?.name || ''} ${err?.message || ''} ${err?.code || ''}`;
          const isRetryable =
            err?.code === 'P1017' ||
            err?.code === 'P1001' ||
            err?.code === 'P1000' ||
            err?.code === 'P1002' ||
            errStr.includes('closed the connection') ||
            errStr.includes('ConnectionReset') ||
            errStr.includes('ECONNRESET') ||
            errStr.includes('ECONNREFUSED') ||
            errStr.includes('PrismaClientInitializationError') ||
            errStr.includes("Can't reach database server");

          if (isRetryable) {
            console.warn(`[Prisma Auto-Reconnect] Connection dropped. Reconnecting and retrying ${model}.${operation}...`);
            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                await new Promise((resolve) => setTimeout(resolve, attempt * 600));
                try {
                  await basePrisma.$disconnect();
                } catch (_) {}
                await basePrisma.$connect();
                return await query(args);
              } catch (retryErr: any) {
                console.warn(`[Prisma Auto-Reconnect] Attempt ${attempt}/3 failed. ${attempt < 3 ? 'Retrying...' : ''}`);
                if (attempt === 3) {
                  throw retryErr;
                }
              }
            }
          }
          throw err;
        }
      },
    },
  },
});

