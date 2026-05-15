'use client';

import { useCallback } from 'react';

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error';
  exiting?: boolean;
}

interface ToastProps {
  toasts: ToastItem[];
}

export default function Toast({ toasts }: ToastProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast--${t.type}${t.exiting ? ' toast--exiting' : ''}`}
          role="status"
        >
          {t.type === 'success' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
            </svg>
          )}
          {t.message}
        </div>
      ))}
    </div>
  );
}

/**
 * useToast — hook to add/dismiss toasts.
 * Import and use in any client component that needs toast notifications.
 */
export function useToast(
  setToasts: React.Dispatch<React.SetStateAction<ToastItem[]>>
) {
  const addToast = useCallback(
    (message: string, type: ToastItem['type']) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
        );
      }, 2700);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    },
    [setToasts]
  );
  return { addToast };
}
