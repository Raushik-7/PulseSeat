'use client';

import { useState, useCallback, createContext, useContext, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Toast {
  id: string;
  title: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

// Simple global toast state
let listeners: Array<() => void> = [];
let toasts: Toast[] = [];

function notifyListeners() {
  listeners.forEach((l) => l());
}

export function toast({ title, type = 'info' }: { title: string; type?: Toast['type'] }) {
  const id = `toast_${Date.now()}`;
  toasts = [...toasts, { id, title, type }];
  notifyListeners();

  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    notifyListeners();
  }, 4000);
}

export function ToastContainer() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2 max-w-sm">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastItem({ toast: t }: { toast: Toast }) {
  const icons = {
    success: <CheckCircle className="h-4 w-4 text-green-400" />,
    error: <AlertCircle className="h-4 w-4 text-red-400" />,
    warning: <AlertTriangle className="h-4 w-4 text-yellow-400" />,
    info: <Info className="h-4 w-4 text-blue-400" />,
  };

  const borders = {
    success: 'border-green-500/20',
    error: 'border-red-500/20',
    warning: 'border-yellow-500/20',
    info: 'border-blue-500/20',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl bg-dark-900 border shadow-xl animate-slide-up',
        borders[t.type],
      )}
    >
      {icons[t.type]}
      <p className="text-sm text-dark-200">{t.title}</p>
    </div>
  );
}
