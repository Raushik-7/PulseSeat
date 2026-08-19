import { FastifyInstance } from 'fastify';
import { createHmac } from 'crypto';
import { z } from 'zod';
import { prisma } from '../../plugins/prisma.js';
import { signToken, requireAuth } from '../../middleware/auth.js';
import { AppError } from '../../utils/errors.js';

const signupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function hashPassword(password: string): string {
  return createHmac('sha256', 'pulseseat-salt').update(password).digest('hex');
}

export async function authRoutes(app: FastifyInstance) {
  // POST /api/v1/auth/signup
  app.post('/api/v1/auth/signup', async (request, reply) => {
    const body = signupSchema.parse(request.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists');
    }

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash: hashPassword(body.password),
      },
    });

    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    reply.status(201).send({
      success: true,
      data: {
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        token,
      },
    });
  });

  // POST /api/v1/auth/login
  app.post('/api/v1/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || user.passwordHash !== hashPassword(body.password)) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    reply.send({
      success: true,
      data: {
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        token,
      },
    });
  });

  // GET /api/v1/auth/me
  app.get('/api/v1/auth/me', { preHandler: [requireAuth] }, async (request, reply) => {
    const authUser = (request as any).user;

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    reply.send({ success: true, data: user });
  });
}
