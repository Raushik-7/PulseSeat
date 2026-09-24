import nodemailer from 'nodemailer';
import { config } from '../../config/index';
import { logger } from '../../utils/logger';

// ─── Email Service ───────────────────────────────────────────────────────────
//
// Production-ready email service using Nodemailer with SMTP.
// Supports any SMTP provider: Gmail, SendGrid, AWS SES, Mailgun, etc.
//
// Configuration via environment variables:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
//
// In development without SMTP configured, logs emails to console.

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Lazy-initialized transporter
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  if (config.email.host && config.email.user && config.email.pass) {
    // Production: connect to real SMTP server
    transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });
    logger.info({ host: config.email.host, port: config.email.port }, 'Email SMTP transporter configured');
  } else {
    // Development fallback: log to console, don't send real emails
    transporter = nodemailer.createTransport({
      jsonTransport: true,
    });
    logger.warn('No SMTP configured — emails will be logged to console only');
  }

  return transporter;
}

// ─── Send Email ──────────────────────────────────────────────────────────────

export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const transport = getTransporter();

  try {
    const info = await transport.sendMail({
      from: config.email.from || 'PulseSeat <noreply@pulseseat.dev>',
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });

    // In dev with jsonTransport, info.message is the JSON — just log it
    if (typeof info.message === 'string') {
      logger.info({ to: message.to, subject: message.subject }, '📧 Email sent');
    } else {
      logger.info({ to: message.to, subject: message.subject, messageId: info.messageId }, '📧 Email sent');
    }

    return true;
  } catch (err) {
    logger.error({ err, to: message.to, subject: message.subject }, '❌ Failed to send email');
    return false;
  }
}

// ─── Email Templates ─────────────────────────────────────────────────────────

export interface BookingConfirmationData {
  userName: string;
  userEmail: string;
  bookingReference: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  city: string;
  seats: Array<{ seatNumber: string; row: string; section: string }>;
  totalAmount: number;
}

export interface BookingCancellationData {
  userName: string;
  userEmail: string;
  bookingReference: string;
  eventName: string;
  refundAmount: number;
}

// ─── Booking Confirmation Email ─────────────────────────────────────────────

export function bookingConfirmationTemplate(data: BookingConfirmationData): EmailMessage {
  const seatList = data.seats
    .map((s) => `<li style="padding:4px 0;">${s.seatNumber} — ${s.section} (${s.row})</li>`)
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e5e5e5;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:24px;font-weight:700;color:#a855f7;">⚡ PulseSeat</div>
      <p style="color:#6b7280;font-size:14px;margin-top:4px;">Built for the rush.</p>
    </div>

    <!-- Success Banner -->
    <div style="background:linear-gradient(135deg,#22c55e22,#22c55e11);border:1px solid #22c55e33;border-radius:16px;padding:24px;text-align:center;margin-bottom:24px;">
      <div style="font-size:32px;margin-bottom:8px;">✅</div>
      <h1 style="margin:0;font-size:20px;color:#22c55e;">Booking Confirmed</h1>
      <p style="margin:8px 0 0;font-size:13px;color:#6b7280;">Your seats are locked in.</p>
    </div>

    <!-- Booking Reference -->
    <div style="background:#1a1a2e;border:1px solid #333;border-radius:12px;padding:16px;text-align:center;margin-bottom:24px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;">Booking Reference</div>
      <div style="font-size:22px;font-weight:700;color:#a855f7;font-family:monospace;margin-top:4px;">${data.bookingReference}</div>
    </div>

    <!-- Event Details -->
    <div style="background:#111;border:1px solid #222;border-radius:12px;padding:20px;margin-bottom:24px;">
      <h2 style="margin:0 0 12px;font-size:16px;color:#fff;">Event Details</h2>
      <table style="width:100%;font-size:14px;color:#999;">
        <tr><td style="padding:6px 0;color:#666;">Event</td><td style="padding:6px 0;color:#fff;font-weight:500;">${data.eventName}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Date</td><td style="padding:6px 0;color:#fff;">${data.eventDate}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Time</td><td style="padding:6px 0;color:#fff;">${data.eventTime}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Venue</td><td style="padding:6px 0;color:#fff;">${data.venue}, ${data.city}</td></tr>
      </table>
    </div>

    <!-- Seats -->
    <div style="background:#111;border:1px solid #222;border-radius:12px;padding:20px;margin-bottom:24px;">
      <h2 style="margin:0 0 12px;font-size:16px;color:#fff;">Your Seats</h2>
      <ul style="list-style:none;padding:0;margin:0;font-size:14px;color:#ccc;">
        ${seatList}
      </ul>
      <div style="border-top:1px solid #333;margin-top:12px;padding-top:12px;display:flex;justify-content:space-between;">
        <span style="color:#999;">Total Paid</span>
        <span style="font-size:18px;font-weight:700;color:#22c55e;">₹${data.totalAmount.toLocaleString()}</span>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:24px 0;border-top:1px solid #222;">
      <p style="font-size:12px;color:#4b5563;margin:0;">This is an automated email from PulseSeat.</p>
      <p style="font-size:12px;color:#4b5563;margin:8px 0 0;">A concurrency-safe ticket booking platform.</p>
    </div>
  </div>
</body>
</html>`;

  const text = `Booking Confirmed!\n\nBooking Reference: ${data.bookingReference}\nEvent: ${data.eventName}\nDate: ${data.eventDate}\nTime: ${data.eventTime}\nVenue: ${data.venue}, ${data.city}\nSeats: ${data.seats.map((s) => s.seatNumber).join(', ')}\nTotal: ₹${data.totalAmount.toLocaleString()}\n\nThank you for booking with PulseSeat.`;

  return {
    to: data.userEmail,
    subject: `✅ Booking Confirmed — ${data.bookingReference} — ${data.eventName}`,
    html,
    text,
  };
}

// ─── OTP Verification Email ───────────────────────────────────────────────

export function otpEmailTemplate(code: string, purpose: 'login' | 'signup'): string {
  const actionText = purpose === 'login' ? 'log in to' : 'create an account on';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e5e5e5;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:24px;font-weight:700;color:#818cf8;">PulseSeat</div>
    </div>

    <!-- OTP Box -->
    <div style="background:#111;border:1px solid #222;border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;">
      <h1 style="margin:0 0 8px;font-size:20px;color:#fff;">Verification Code</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Use this code to ${actionText} PulseSeat</p>

      <div style="font-size:40px;font-weight:800;letter-spacing:12px;color:#818cf8;font-family:monospace;padding:16px 0;border-top:1px solid #222;border-bottom:1px solid #222;margin:0 20px;">
        ${code}
      </div>

      <p style="margin:20px 0 0;font-size:13px;color:#6b7280;">This code expires in 5 minutes.</p>
    </div>

    <!-- Security Note -->
    <div style="background:#1a1a2e;border:1px solid #333;border-radius:12px;padding:16px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#999;text-align:center;">
        🔒 If you didn't request this code, you can safely ignore this email. Your account is secure.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:16px 0;border-top:1px solid #222;">
      <p style="font-size:12px;color:#4b5563;margin:0;">PulseSeat — Discover & Book Live Events</p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Booking Cancellation Email ─────────────────────────────────────────────

export function bookingCancellationTemplate(data: BookingCancellationData): EmailMessage {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e5e5e5;">
  <div style="max-width:600px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:24px;font-weight:700;color:#a855f7;">⚡ PulseSeat</div>
    </div>

    <div style="background:#f9731622;border:1px solid #f9731633;border-radius:16px;padding:24px;text-align:center;margin-bottom:24px;">
      <div style="font-size:32px;margin-bottom:8px;">🚫</div>
      <h1 style="margin:0;font-size:20px;color:#f97316;">Booking Cancelled</h1>
      <p style="margin:8px 0 0;font-size:13px;color:#6b7280;">Your booking has been cancelled and seats released.</p>
    </div>

    <div style="background:#111;border:1px solid #222;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;font-size:14px;color:#999;">
        <tr><td style="padding:6px 0;color:#666;">Reference</td><td style="padding:6px 0;color:#fff;font-family:monospace;">${data.bookingReference}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Event</td><td style="padding:6px 0;color:#fff;">${data.eventName}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Refund</td><td style="padding:6px 0;color:#22c55e;font-weight:600;">₹${data.refundAmount.toLocaleString()}</td></tr>
      </table>
    </div>

    <div style="text-align:center;padding:24px 0;border-top:1px solid #222;">
      <p style="font-size:12px;color:#4b5563;margin:0;">Refund will be processed within 5-7 business days.</p>
    </div>
  </div>
</body>
</html>`;

  return {
    to: data.userEmail,
    subject: `Booking Cancelled — ${data.bookingReference}`,
    html,
  };
}
