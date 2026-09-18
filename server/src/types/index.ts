import { Role } from '@prisma/client';
import { Request } from 'express';

export interface JwtPayload {
  userId: string;
  email: string;
  name: string;
  role: Role;
}

export interface AuthenticatedRequest<
  P = any,
  ResBody = any,
  ReqBody = any,
  ReqQuery = any
> extends Request<P, ResBody, ReqBody, ReqQuery> {
  user?: JwtPayload;
}
