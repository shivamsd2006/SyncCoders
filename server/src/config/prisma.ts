import dns from 'node:dns';
import { PrismaClient } from '@prisma/client';

if (process.platform === 'win32') {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
    dns.setDefaultResultOrder('ipv4first');
  } catch (_) {}
}

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

          // Never retry permanent authentication failures or circuit breaker locks
          const isPermanentAuthError =
            err?.code === 'P1000' ||
            errStr.includes('ECIRCUITBREAKER') ||
            errStr.includes('authentication failed') ||
            errStr.includes('password authentication failed') ||
            errStr.includes('too many authentication failures');

          if (isPermanentAuthError) {
            throw err;
          }

          const isRetryable =
            err?.code === 'P1017' ||
            err?.code === 'P1001' ||
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

