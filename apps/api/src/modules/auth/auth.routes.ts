import { FastifyInstance } from 'fastify';
import { createHmac, randomBytes, createHash } from 'crypto';
import { z } from 'zod';
import { prisma } from '../../plugins/prisma';
import { signToken, requireAuth } from '../../middleware/auth';
import { AppError } from '../../utils/errors';
import { rawGet, rawSetEx, rawDel } from '../../plugins/redis-safe';
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

    // Verification token (hashed, TTL-bounded). Redis is the fast path; if it
    // is unavailable the signup must still succeed, so the token is written to
    // the Postgres fallback columns and verify-email reads them. Never fail
    // account creation because of an optional cache.
    const token = generateToken();
    const tokenHash = sha256(token);
    const storedInRedis = await rawSetEx(verifyKey(email), VERIFY_TTL_S, tokenHash);
    if (storedInRedis) {
      await rawSetEx(verifyRateKey(email), 2, '1'); // tiny anti-spam guard
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { resetTokenHash: tokenHash, resetTokenExpiresAt: new Date(Date.now() + VERIFY_TTL_S * 1000) },
      });
      logger.error('Redis unavailable — verification token stored in Postgres fallback (signup succeeded)');
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

    const user = await prisma.user.findUnique({ where: { email: targetEmail } });
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'No account found for this email');
    }

    const submittedHash = sha256(body.token);
    // Redis first (undefined = Redis unavailable, null = expired/missing); then
    // the Postgres fallback written when Redis was down at signup/resend.
    let stored = await rawGet(verifyKey(targetEmail));
    let fromPostgres = false;
    if (!stored && user.resetTokenHash) {
      stored = user.resetTokenHash;
      fromPostgres = true;
    }
    if (!stored) {
      throw new AppError(400, 'TOKEN_EXPIRED', 'This verification link has expired. Please request a new one.');
    }
    if (stored !== submittedHash) {
      throw new AppError(400, 'TOKEN_INVALID', 'Invalid verification link.');
    }
    if (fromPostgres && user.resetTokenExpiresAt && user.resetTokenExpiresAt < new Date()) {
      throw new AppError(400, 'TOKEN_EXPIRED', 'This verification link has expired. Please request a new one.');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        // Only clear the fallback when it is the token we just consumed.
        ...(user.resetTokenHash === submittedHash
          ? { resetTokenHash: null, resetTokenExpiresAt: null }
          : {}),
      },
    });
    await rawDel(verifyKey(targetEmail));

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

    // Anti-spam guard lives in Redis with a 1-minute TTL. If Redis is down the
    // guard cannot run (documented degradation: per-route HTTP rate limiting
    // still applies) but the user is never blocked from receiving the email.
    const recent = await rawGet(verifyRateKey(email));
    if (recent) {
      throw new AppError(429, 'RATE_LIMITED', 'Please wait a minute before requesting another email');
    }

    const token = generateToken();
    const tokenHash = sha256(token);
    const storedInRedis = await rawSetEx(verifyKey(email), VERIFY_TTL_S, tokenHash);
    if (storedInRedis) {
      await rawSetEx(verifyRateKey(email), RESEND_RATE_S, '1');
    } else {
      // Postgres fallback so verification still works during a Redis outage.
      await prisma.user.update({
        where: { id: user.id },
        data: { resetTokenHash: tokenHash, resetTokenExpiresAt: new Date(Date.now() + VERIFY_TTL_S * 1000) },
      });
      logger.error('Redis unavailable — verification token stored in Postgres fallback');
    }

    const verifyUrl = `${config.appUrl}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;
    const sent = await sendAuthEmail(email, verifyEmailTemplate(user.name, verifyUrl));

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

    const recent = await rawGet(resetRateKey(email));
    if (recent) {
      throw new AppError(429, 'RATE_LIMITED', 'Please wait a minute before requesting another reset email');
    }

    const token = generateToken();
    const tokenHash = sha256(token);
    const storedInRedis = await rawSetEx(resetKey(email), RESET_TTL_S, tokenHash);
    if (storedInRedis) {
      await rawSetEx(resetRateKey(email), RESET_RATE_S, '1');
    } else {
      // Postgres fallback so a Redis outage can't lock users out of reset.
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetTokenHash: tokenHash,
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

    // Token may live in Redis (normal) or Postgres (Redis-outage fallback).
    // undefined from rawGet means Redis was unavailable — same fallback path.
    let stored = await rawGet(resetKey(email));
    let fromPostgres = false;
    if (!stored && user.resetTokenHash) {
      stored = user.resetTokenHash;
      fromPostgres = true;
    }
    if (!stored) {
      throw new AppError(400, 'TOKEN_EXPIRED', 'This reset link has expired. Please request a new one.');
    }
    if (stored !== sha256(body.token)) {
      throw new AppError(400, 'TOKEN_INVALID', 'Invalid reset link.');
    }
    if (fromPostgres && user.resetTokenExpiresAt && user.resetTokenExpiresAt < new Date()) {
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
    // Best-effort cleanup; the DB-side token was cleared in the update above.
    await rawDel(resetKey(email));

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
