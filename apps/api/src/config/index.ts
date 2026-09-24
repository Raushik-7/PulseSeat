// Application configuration loaded from environment variables

export const config = {
  // Server — PORT first so platform-assigned ports (Railway/Render/Fly) win.
  // Empty or '0' PORT values are ignored (some hosts export PORT=0 by default).
  port:
    process.env.PORT && process.env.PORT !== '0'
      ? parseInt(process.env.PORT, 10)
      : parseInt(process.env.API_PORT || '3001', 10),
  host: process.env.API_HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',

  // Database
  databaseUrl: process.env.DATABASE_URL!,

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // Rate Limiting
  rateLimit: {
    general: parseInt(process.env.RATE_LIMIT_GENERAL || '100', 10),
    booking: parseInt(process.env.RATE_LIMIT_BOOKING || '10', 10),
    login: parseInt(process.env.RATE_LIMIT_LOGIN || '5', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  },

  // Booking
  booking: {
    holdDurationMs: parseInt(process.env.BOOKING_HOLD_DURATION_MS || '900000', 10),
    idempotencyExpiryS: parseInt(process.env.BOOKING_IDEMPOTENCY_EXPIRY_S || '3600', 10),
  },

  // Payment — Stripe or Mock
  payment: {
    provider: (process.env.PAYMENT_PROVIDER || 'mock') as 'mock' | 'stripe' | 'razorpay',
    secret: process.env.STRIPE_SECRET_KEY || process.env.PAYMENT_SECRET || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },

  // Email — SMTP
  email: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'PulseSeat <noreply@pulseseat.dev>',
  },

  // Frontend URL (for email links)
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',

  // Queue
  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5', 10),
    retryAttempts: parseInt(process.env.QUEUE_RETRY_ATTEMPTS || '3', 10),
    retryDelayMs: parseInt(process.env.QUEUE_RETRY_DELAY_MS || '2000', 10),
  },
} as const;
