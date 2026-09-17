import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error('❌ Server Error:', err.name || 'Error', err.message);

  // 1. Handle Zod Validation Errors
  if (err instanceof ZodError) {
    const firstMessage = err.errors[0]?.message || 'Request is not acceptable';
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: firstMessage,
        details: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
    });
  }

  // 2. Handle Database / Prisma / Connection Errors
  const errStr = `${err.name || ''} ${err.message || ''} ${(err as any).code || ''}`;
  const isDbConnectionError =
    (err as any).code === 'P1017' ||
    (err as any).code === 'P1001' ||
    (err as any).code === 'P1000' ||
    (err as any).code === 'P1002' ||
    (err as any).code === 'P1003' ||
    errStr.includes('closed the connection') ||
    errStr.includes('ConnectionReset') ||
    errStr.includes('ECONNREFUSED') ||
    errStr.includes('Transaction API error') ||
    errStr.includes('Transaction not found') ||
    errStr.includes('before disconnecting') ||
    errStr.includes('PrismaClientInitializationError');

  if (isDbConnectionError) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'Cannot connect to database. Please try again in a moment.',
      },
    });
  }

  // 3. Handle Other Prisma Errors (unique constraint, bad query, etc.)
  if (errStr.includes('Prisma') || errStr.includes('invocation')) {
    if ((err as any).code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'A record with this information already exists.',
        },
      });
    }
    return res.status(400).json({
      success: false,
      error: {
        code: 'REQUEST_NOT_ACCEPTABLE',
        message: 'Request is not acceptable.',
      },
    });
  }

  // 4. Safe HTTP Errors (4xx)
  const statusCode = err.statusCode || 500;
  if (statusCode >= 400 && statusCode < 500) {
    return res.status(statusCode).json({
      success: false,
      error: {
        code: err.code || 'BAD_REQUEST',
        message: err.message || 'Request is not acceptable',
      },
    });
  }

  // 5. Unhandled 500 Internal Server Errors - Never leak stack traces to the user
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Request is not acceptable. Please try again later.',
    },
  });
};
