import { FastifyRequest, FastifyReply } from 'fastify';
import { createHmac } from 'crypto';
import { prisma } from '../plugins/prisma.js';
import { config } from '../config/index.js';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
}

function base64UrlEncode(data: string): string {
  return Buffer.from(data).toString('base64url');
}

function base64UrlDecode(data: string): string {
  return Buffer.from(data, 'base64url').toString();
}

export function signToken(user: AuthUser): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    }),
  );

  const signature = base64UrlEncode(
    createHmac('sha256', config.jwtSecret).update(`${header}.${payload}`).digest(),
  );

  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) return null;

    const expectedSignature = base64UrlEncode(
      createHmac('sha256', config.jwtSecret).update(`${header}.${payload}`).digest(),
    );

    if (signature !== expectedSignature) return null;

    const decoded = JSON.parse(base64UrlDecode(payload));
    if (decoded.exp * 1000 < Date.now()) return null;

    return {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
    };
  } catch {
    return null;
  }
}

// Fastify preHandler hooks
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
    return;
  }

  const token = authHeader.slice(7);
  const user = verifyToken(token);
  if (!user) {
    reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    });
    return;
  }

  (request as any).user = user;
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply);
  if (reply.sent) return;

  const user = (request as any).user as AuthUser;
  if (user.role !== 'ADMIN') {
    reply.status(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Admin access required' },
    });
    return;
  }
}

export function getUser(request: FastifyRequest): AuthUser | null {
  return (request as any).user || null;
}
