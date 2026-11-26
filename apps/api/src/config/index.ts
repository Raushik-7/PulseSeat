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

  // Redis — provider-neutral. Any Redis-compatible endpoint works (Upstash,
  // Redis Cloud, Railway, self-hosted…): only REDIS_URL changes on migration.
  // REDIS_ENABLED=false runs the whole API with caching disabled (circuit-open
  // behaviour permanently), which is also the escape hatch during a quota outage.
  redis: {
    url: process.env.REDIS_URL || '',
    enabled: (process.env.REDIS_ENABLED ?? 'true').toLowerCase() !== 'false',
    // Hard ceiling on a single command: a half-dead socket must never stall a
    // request. ioredis supports both natively, so no wrapper-level timer is
    // needed for the client itself.
    connectTimeoutMs: parseInt(process.env.REDIS_CONNECT_TIMEOUT_MS || '3000', 10),
    commandTimeoutMs: parseInt(process.env.REDIS_COMMAND_TIMEOUT_MS || '1500', 10),
    // After this many failed reconnect attempts the client gives up instead of
    // churning forever; the next request re-creates it after the cooldown.
    maxReconnectAttempts: parseInt(process.env.REDIS_MAX_RECONNECT_ATTEMPTS || '8', 10),
    reconnectCooldownMs: parseInt(process.env.REDIS_RECONNECT_COOLDOWN_MS || '60000', 10),
    // How long the circuit breaker stops issuing commands after repeated
    // failures (quota exhaustion, provider outage). Recovery is a single probe.
    breakerCooldownMs: parseInt(process.env.REDIS_BREAKER_COOLDOWN_MS || '30000', 10),
  },

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

  // Email outbox — Postgres-backed, no Redis/BullMQ. Booking emails are low
  // volume; a durable DB queue drained by the maintenance loop gives the same
  // delivery guarantee with zero idle command cost.
  emailOutbox: {
    batchSize: parseInt(process.env.EMAIL_OUTBOX_BATCH_SIZE || '20', 10),
    maxAttempts: parseInt(process.env.EMAIL_OUTBOX_MAX_ATTEMPTS || '5', 10),
    retryBaseMs: parseInt(process.env.EMAIL_OUTBOX_RETRY_BASE_MS || '30000', 10),
    retainSentDays: parseInt(process.env.EMAIL_OUTBOX_RETAIN_SENT_DAYS || '7', 10),
  },
} as const;
