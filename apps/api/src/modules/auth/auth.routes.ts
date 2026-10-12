import { FastifyInstance } from 'fastify';
import { createHmac, randomBytes, createHash } from 'crypto';
import { z } from 'zod';
import { prisma } from '../../plugins/prisma';
import { signToken, requireAuth } from '../../middleware/auth';
import { AppError } from '../../utils/errors';
import { getRedis } from '../../plugins/redis';
import { sendEmail } from '../email/email.service';
import { config } from '../../config/index';
import { logger } from '../../utils/logger';

// ─── Schemas ────────────────────────────────────────────────────────────────

const signupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const verifyEmailSchema = z.object({
  token: z.string().min(10).max(200),
});

const resendSchema = z.object({
  email: z.string().email(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function hashPassword(password: string): string {
  return createHmac('sha256', 'pulseseat-salt').update(password).digest('hex');
}

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

const VERIFY_TTL_S = 60 * 60 * 24; // 24h
const RESEND_RATE_S = 60; // 1/min
const RESET_TTL_S = 60 * 30; // 30 min
const RESET_RATE_S = 60;

function verifyKey(email: string) {
  return `verify:token:${email}`;
}
function verifyRateKey(email: string) {
  return `verify:ratelimit:${email}`;
}
function resetKey(email: string) {
  return `reset:token:${email}`;
}
function resetRateKey(email: string) {
  return `reset:ratelimit:${email}`;
}

const GENERIC_RESET_MSG = 'If an account exists for that email, a reset link has been sent.';

// ─── Email templates ────────────────────────────────────────────────────────

function brandedShell(inner: string, title: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e5e5e5;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:24px;font-weight:700;color:#818cf8;">PulseSeat</div>
      <p style="color:#6b7280;font-size:13px;margin-top:4px;">Built for the rush.</p>
    </div>
    <div style="background:#111;border:1px solid #222;border-radius:16px;padding:32px;">
      <h1 style="margin:0 0 8px;font-size:20px;color:#fff;">${title}</h1>
      ${inner}
    </div>
    <div style="text-align:center;padding:16px 0;border-top:1px solid #222;margin-top:24px;">
      <p style="font-size:12px;color:#4b5563;margin:0;">PulseSeat — Discover &amp; Book Live Events</p>
    </div>
  </div>
</body>
</html>`;
}

export function verifyEmailTemplate(name: string, verifyUrl: string): { subject: string; html: string } {
  const inner = `
    <p style="margin:0 0 20px;font-size:14px;color:#9ca3af;">Hi ${name}, confirm your email address to activate your PulseSeat account.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${verifyUrl}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:15px;">Verify Email</a>
    </div>
    <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">Or paste this link into your browser:</p>
    <p style="margin:0;font-size:12px;color:#818cf8;word-break:break-all;">${verifyUrl}</p>
    <p style="margin:20px 0 0;font-size:13px;color:#6b7280;">This link expires in 24 hours.</p>`;
  return { subject: 'Verify your PulseSeat account', html: brandedShell(inner, 'Confirm your email') };
}

export function resetPasswordTemplate(resetUrl: string): { subject: string; html: string } {
  const inner = `
    <p style="margin:0 0 20px;font-size:14px;color:#9ca3af;">We received a request to reset your PulseSeat password.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${resetUrl}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:15px;">Reset Password</a>
    </div>
    <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">Or paste this link into your browser:</p>
    <p style="margin:0;font-size:12px;color:#818cf8;word-break:break-all;">${resetUrl}</p>
    <p style="margin:20px 0 0;font-size:13px;color:#6b7280;">This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.</p>`;
  return { subject: 'Reset your PulseSeat password', html: brandedShell(inner, 'Reset your password') };
}

async function sendAuthEmail(to: string, message: { subject: string; html: string }): Promise<boolean> {
  try {
    return await sendEmail({ to, subject: message.subject, html: message.html });
  } catch (err) {
    logger.error({ err, to }, 'Failed to send auth email');
    return false;
  }
}

// ─── Routes ─────────────────────────────────────────────────────────────────

export async function authRoutes(app: FastifyInstance) {
  // ── POST /api/v1/auth/signup ────────────────────────────────────────────
  // Creates an unverified account and emails a verification link.
  // D.4 — Stricter per-route limits: credential/abuse-prone endpoints get
  // their own small in-memory buckets (independent of the general 100/min).
  app.post('/api/v1/auth/signup', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = signupSchema.parse(request.body);
    const email = body.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists. Please log in instead.');
    }

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email,
        passwordHash: hashPassword(body.password),
      },
    });

    // Generate + store verification token in Redis (short-lived, security
    // data). If Redis is down the signup itself must not fail — we log and
    // still create the account; the user can use resend-verification later.
    const token = generateToken();
    try {
      const redis = getRedis();
      await redis.setex(verifyKey(email), VERIFY_TTL_S, sha256(token));
      await redis.setex(verifyRateKey(email), 2, '1'); // tiny anti-spam guard
    } catch (err) {
      logger.error({ errMessage: err instanceof Error ? err.message : String(err) }, 'Could not store verification token in Redis (signup still succeeded)');
    }

    // Send verification email (link points at the frontend page)
    const verifyUrl = `${config.appUrl}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;
    const sent = await sendAuthEmail(email, verifyEmailTemplate(user.name, verifyUrl));

    reply.status(201).send({
      success: true,
      data: {
        user: { id: user.id, name: user.name, email: user.email },
        emailSent: sent,
        message: 'Account created. Please verify your email before logging in.',
      },
    });
  });

  // ── POST /api/v1/auth/verify-email ──────────────────────────────────────
  app.post('/api/v1/auth/verify-email', async (request, reply) => {
    const body = verifyEmailSchema.parse(request.body);
    const email = (request.query as any)?.email as string | undefined;
    // email may also arrive in body for robustness
    const emailFromBody = (request.body as any)?.email as string | undefined;
    const targetEmail = (email || emailFromBody || '').toLowerCase();
    if (!targetEmail) {
      throw new AppError(400, 'EMAIL_REQUIRED', 'Email is required to verify your account');
    }

    let stored: string | null = null;
    try {
      const redis = getRedis();
      stored = await redis.get(verifyKey(targetEmail));
    } catch (err) {
      logger.error({ errMessage: err instanceof Error ? err.message : String(err) }, 'Could not read verification token from Redis');
    }
    if (!stored) {
      throw new AppError(400, 'TOKEN_EXPIRED', 'This verification link has expired. Please request a new one.');
    }
    if (stored !== sha256(body.token)) {
      throw new AppError(400, 'TOKEN_INVALID', 'Invalid verification link.');
    }

    const user = await prisma.user.findUnique({ where: { email: targetEmail } });
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'No account found for this email');
    }

    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    try {
      const redis = getRedis();
      await redis.del(verifyKey(targetEmail));
    } catch (err) {
      logger.warn({ errMessage: err instanceof Error ? err.message : String(err) }, 'Could not delete verification token (already verified in DB)');
    }

    const token = signToken({ id: user.id, email: user.email, name: user.name, role: user.role });

    reply.send({
      success: true,
      data: {
        message: 'Email verified successfully',
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        token,
      },
    });
  });

  // ── POST /api/v1/auth/resend-verification ───────────────────────────────
  app.post('/api/v1/auth/resend-verification', { config: { rateLimit: { max: 3, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = resendSchema.parse(request.body);
    const email = body.email.toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Do not reveal account existence
      reply.send({ success: true, data: { message: 'If an account exists, a verification email has been sent.' } });
      return;
    }
    if (user.emailVerified) {
      reply.send({ success: true, data: { message: 'Email is already verified. You can log in.' } });
      return;
    }

    let redis: ReturnType<typeof getRedis> | null = null;
    let redisFailed = false;
    try {
      redis = getRedis();
      const recent = await redis.get(verifyRateKey(email));
      if (recent) {
        throw new AppError(429, 'RATE_LIMITED', 'Please wait a minute before requesting another email');
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      redisFailed = true;
      logger.error({ errMessage: err instanceof Error ? err.message : String(err) }, 'Resend-verification rate-limit check failed (degraded: allowing)');
    }
    const token = generateToken();
    try {
      if (redis && !redisFailed) {
        await redis.setex(verifyKey(email), VERIFY_TTL_S, sha256(token));
        await redis.setex(verifyRateKey(email), RESEND_RATE_S, '1');
      } else if (redisFailed) {
        redisFailed = true; // handled by the Postgres fallback below
      }
    } catch (err) {
      redisFailed = true;
      logger.error({ errMessage: err instanceof Error ? err.message : String(err) }, 'Could not store resend token in Redis');
    }

    const verifyUrl = `${config.appUrl}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;
    const sent = await sendAuthEmail(email, verifyEmailTemplate(user.name, verifyUrl));

    if (redisFailed) {
      // Postgres fallback for verification tokens too
      await prisma.user.update({
        where: { id: user.id },
        data: { resetTokenHash: sha256(token), resetTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000) },
      });
      logger.error('Redis unavailable — verification token stored in Postgres fallback');
    }

    reply.send({
      success: true,
      data: { message: 'Verification email sent', emailSent: sent },
    });
  });

  // ── POST /api/v1/auth/login ─────────────────────────────────────────────
  app.post('/api/v1/auth/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const email = body.email.toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.passwordHash !== hashPassword(body.password)) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    if (!user.emailVerified) {
      throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email before signing in.');
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

  // ── POST /api/v1/auth/forgot-password ───────────────────────────────────
  app.post('/api/v1/auth/forgot-password', { config: { rateLimit: { max: 3, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = forgotPasswordSchema.parse(request.body);
    const email = body.email.toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Do not reveal whether the account exists
      reply.send({ success: true, data: { message: GENERIC_RESET_MSG } });
      return;
    }

    let redisFailed = false;
    try {
      const redis = getRedis();
      const recent = await redis.get(resetRateKey(email));
      if (recent) {
        throw new AppError(429, 'RATE_LIMITED', 'Please wait a minute before requesting another reset email');
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      redisFailed = true;
    }

    const token = generateToken();
    try {
      const redis = getRedis();
      await redis.setex(resetKey(email), RESET_TTL_S, sha256(token));
      await redis.setex(resetRateKey(email), RESET_RATE_S, '1');
    } catch (err) {
      redisFailed = true;
    }

    if (redisFailed) {
      // Postgres fallback so a Redis outage can't lock users out of reset.
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetTokenHash: sha256(token),
          resetTokenExpiresAt: new Date(Date.now() + RESET_TTL_S * 1000),
        },
      });
      logger.error('Redis unavailable — reset token stored in Postgres fallback');
    }

    const resetUrl = `${config.appUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
    await sendAuthEmail(email, resetPasswordTemplate(resetUrl));

    reply.send({ success: true, data: { message: GENERIC_RESET_MSG } });
  });

  // ── POST /api/v1/auth/reset-password ────────────────────────────────────
  app.post('/api/v1/auth/reset-password', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = resetPasswordSchema.parse(request.body);
    const email = ((request.query as any)?.email || (request.body as any)?.email || '').toLowerCase();
    if (!email) {
      throw new AppError(400, 'EMAIL_REQUIRED', 'Email is required to reset your password');
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'No account found for this email');
    }

    // Token may live in Redis (normal) or Postgres (Redis-outage fallback)
    let stored: string | null | undefined = null;
    let postgresFallback = false;
    try {
      const redis = getRedis();
      stored = await redis.get(resetKey(email));
    } catch {
      postgresFallback = true;
    }
    if (!stored && user.resetTokenHash) {
      postgresFallback = true;
      stored = user.resetTokenHash;
    }
    if (!stored || postgresFallback) {
      if (!stored) {
        throw new AppError(400, 'TOKEN_EXPIRED', 'This reset link has expired. Please request a new one.');
      }
    }
    if (stored !== sha256(body.token)) {
      throw new AppError(400, 'TOKEN_INVALID', 'Invalid reset link.');
    }
    if (postgresFallback && user.resetTokenExpiresAt && user.resetTokenExpiresAt < new Date()) {
      throw new AppError(400, 'TOKEN_EXPIRED', 'This reset link has expired. Please request a new one.');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashPassword(body.password),
        resetTokenHash: null,
        resetTokenExpiresAt: null,
      },
    });
    if (!postgresFallback) {
      try {
        const redis = getRedis();
        await redis.del(resetKey(email));
      } catch {
        // non-fatal
      }
    }

    reply.send({ success: true, data: { message: 'Password updated. You can now log in with your new password.' } });
  });

  // ── GET /api/v1/auth/me ─────────────────────────────────────────────────
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
