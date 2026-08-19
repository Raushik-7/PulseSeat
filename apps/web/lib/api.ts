const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  token?: string;
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T = any>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, token } = options;

  const authHeaders: Record<string, string> = {};
  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new ApiError(
      res.status,
      data.error?.code || 'API_ERROR',
      data.error?.message || 'An error occurred',
    );
  }

  return data;
}

// Specific API methods
export const apiClient = {
  // Auth
  signup: (data: { name: string; email: string; password: string }) =>
    api('/api/v1/auth/signup', { method: 'POST', body: data }),

  login: (data: { email: string; password: string }) =>
    api('/api/v1/auth/login', { method: 'POST', body: data }),

  getMe: (token: string) => api('/api/v1/auth/me', { token }),

  // Events
  getEvents: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return api(`/api/v1/events${query}`);
  },

  getEvent: (id: string) => api(`/api/v1/events/${id}`),

  // Seats
  getSeats: (eventId: string) => api(`/api/v1/events/${eventId}/seats`),

  getAvailability: (eventId: string) => api(`/api/v1/events/${eventId}/availability`),

  // Bookings
  createBooking: (data: { eventId: string; seatIds: string[] }, token: string, idempotencyKey?: string) =>
    api('/api/v1/bookings', {
      method: 'POST',
      body: data,
      token,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
    }),

  getBookings: (token: string, status?: string) => {
    const query = status ? `?status=${status}` : '';
    return api(`/api/v1/bookings${query}`, { token });
  },

  getBooking: (id: string, token: string) => api(`/api/v1/bookings/${id}`, { token }),

  cancelBooking: (id: string, token: string) =>
    api(`/api/v1/bookings/${id}/cancel`, { method: 'POST', token }),

  // Admin
  getAdminDashboard: (token: string) => api('/api/v1/admin/dashboard', { token }),

  getAdminBookings: (token: string, params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return api(`/api/v1/admin/bookings${query}`, { token });
  },

  getAdminUsers: (token: string, params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return api(`/api/v1/admin/users${query}`, { token });
  },

  getAdminAnalytics: (token: string) => api('/api/v1/admin/analytics', { token }),

  getAuditLogs: (token: string, params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return api(`/api/v1/admin/audit-logs${query}`, { token });
  },

  resetSeats: (eventId: string, token: string) =>
    api(`/api/v1/admin/events/${eventId}/reset-seats`, { method: 'POST', token }),

  // Health
  getHealth: () => api('/health'),
  getHealthReady: () => api('/health/ready'),
};
